#!/usr/bin/env node
/**
 * Yayınlanacak tarball'ı gerçekten paketleyip temiz bir dizine kurar.
 *
 * `npm test` ve diğer kontroller hep repo AĞACINDAN çalışıyor: workspace
 * sembolik bağları, `src/` yanı başında, `node_modules` paylaşımlı. Kullanıcının
 * gördüğü şey ise tarball. Aradaki fark "yerelde çalışır, yayında 404" hata
 * sınıfının tamamı:
 *
 *   · `files` alanından düşmüş bir dosya
 *   · `exports` haritasında yanlış yol
 *   · paket içinde çözülmeyen bir bağımlılık sürümü
 *   · var olmayan bir hedefi gösteren source map
 *
 * Bunların hiçbiri repo ağacında görünmüyor. Bu betik zinciri uçtan uca
 * koşturuyor: pack → temiz dizine kur → import et → gerçek bir hesap yap.
 *
 *   node tools/check-pack.mjs
 *
 * `npm pack` yerel bir tarball kuruyor, dolayısıyla ağ gerekmez.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReporter } from './_harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const r = createReporter('Yayınlanan paket şekli');

const work = mkdtempSync(join(tmpdir(), 'swisseph-pack-'));

/*
 * npm'i cli.js üzerinden, node ile çağırıyoruz.
 *
 * Windows'ta `npm.cmd`'yi execFileSync ile çalıştırmak EINVAL veriyor (Node 20+
 * artık .cmd için shell şart koşuyor), `shell: true` ise geçici dizin yollarında
 * quoting derdi açıyor. cli.js'i doğrudan çalıştırmak ikisinden de kurtarıyor ve
 * platformlar arasında aynı.
 */
const NPM_CLI = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npmArgs = existsSync(NPM_CLI) ? [NPM_CLI] : null;

/** Sessiz npm çağrısı; çıktıyı döndürür, hata fırlatır. */
const run = (args, cwd) => {
  if (npmArgs) {
    return execFileSync(process.execPath, [...npmArgs, ...args],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  }
  // cli.js bulunamadıysa shell'e düş; argümanları tırnak içine alıyoruz.
  const quoted = args.map((a) => (/[\s"]/.test(a) ? `"${a}"` : a)).join(' ');
  return execFileSync(`npm ${quoted}`, {
    cwd, encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
};

/**
 * MCP sunucusunu bir kez konuşturur.
 *
 * stdin `input` ile yazılıp kapatıldığı için sunucu yanıtını verip çıkıyor —
 * ayrı bir sonlandırma mantığı gerekmiyor.
 *
 * Ham stdout da dönüyor, çünkü bu kanalda sürümün doğru olması kadar BAŞKA
 * HİÇBİR ŞEYİN OLMAMASI da önemli: stdout protokolün kendisi ve araya düşen
 * tek bir satır — bir uyarı, WASM'den kaçmış bir printf — akışı bozup istemciye
 * sunucuyu düşürtüyor, hem de ortada hata mesajı olmadan.
 */
function initializeHandshake(entry) {
  const request = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'check-pack', version: '1.0.0' },
    },
  }) + '\n';

  const res = spawnSync(process.execPath, [entry], {
    input: request, encoding: 'utf8', timeout: 60_000,
  });

  const stdout = res.stdout ?? '';
  const lines = stdout.split('\n').filter((l) => l.trim() !== '');
  let version = null;
  const strayLines = [];

  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1) version = msg.result?.serverInfo?.version ?? null;
    } catch {
      strayLines.push(line);
    }
  }

  return { version, strayLines };
}

// 6. adımda repo'nun node_modules'ü altına açılan kopya; finally temizliyor.
let extracted = null;

try {
  // --- 1. paketle -------------------------------------------------------
  r.section('1) npm pack');

  const packed = [];
  for (const pkg of ['core', 'mcp']) {
    const dir = join(ROOT, 'packages', pkg);
    if (!existsSync(join(dir, 'package.json'))) {
      r.skip(`${pkg} paketlenemedi`, 'package.json yok');
      continue;
    }
    const out = run(['pack', '--workspace', `./packages/${pkg}`,
                     '--pack-destination', work, '--json'], ROOT);
    const [info] = JSON.parse(out);
    packed.push({ pkg, file: join(work, info.filename), info });
    r.check(`${pkg.padEnd(6)} paketlendi`, existsSync(join(work, info.filename)),
      `${info.filename} — ${(info.size / 1024).toFixed(0)} KB, ${info.entryCount} dosya`);
  }

  const core = packed.find((p) => p.pkg === 'core');

  // --- 2. temiz dizine kur ---------------------------------------------
  r.section('2) Temiz bir tüketiciye kurulum');

  const consumer = join(work, 'consumer');
  mkdirSync(consumer, { recursive: true });
  writeFileSync(join(consumer, 'package.json'),
    JSON.stringify({ name: 'consumer', private: true, type: 'module' }, null, 2));

  if (core) {
    run(['install', '--no-audit', '--no-fund', core.file], consumer);
    const installed = join(consumer, 'node_modules', '@kuntay', 'swisseph');
    r.check('kuruldu', existsSync(installed), installed.replace(work, '<tmp>'));

    // package.json'ın işaret ettiği her giriş noktası GERÇEKTEN var mı?
    const pkg = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
    const targets = [pkg.main, pkg.types, pkg.exports?.['./wasm']].filter(Boolean);
    const missing = targets.filter((t) => !existsSync(join(installed, t)));
    r.check('package.json giriş noktaları var', missing.length === 0,
      missing.length ? `EKSİK: ${missing.join(' ')}` : targets.join(' '));

    // --- 3. source map'ler çözülüyor mu -------------------------------
    r.section('3) Source map hedefleri');

    for (const map of ['dist/index.js.map', 'dist/index.d.ts.map']) {
      const mapPath = join(installed, map);
      if (!existsSync(mapPath)) { r.check(`${map} var`, false); continue; }
      const parsed = JSON.parse(readFileSync(mapPath, 'utf8'));
      const selfContained = Array.isArray(parsed.sourcesContent)
        && parsed.sourcesContent.some((s) => typeof s === 'string' && s.length > 0);
      const onDisk = parsed.sources.every(
        (s) => existsSync(resolve(dirname(mapPath), s)));
      r.check(`${map.padEnd(20)} çözülüyor`, selfContained || onDisk,
        selfContained ? 'kaynağı gömülü' : onDisk ? `-> ${parsed.sources[0]}` :
          `KIRIK: ${parsed.sources[0]} yok`);
    }

    // --- 4. import et ve GERÇEK bir hesap yap -------------------------
    r.section('4) Kurulu paketten hesap');

    const probe = join(consumer, 'probe.mjs');
    writeFileSync(probe, `
import { createSwissEph, Body, HouseSystem, REQUIRES_EPHEMERIS_FILE, ALL_LOTS,
         NON_HERMETIC_LOTS, calculateLots } from '@kuntay/swisseph';
const swe = await createSwissEph();
const jd = swe.julianDay(1990, 5, 15, 14.5);
const sun = swe.calcWithSign(jd, Body.Sun);
const houses = swe.houses(jd, 39.93, 32.86, HouseSystem.Placidus);
const gauquelin = swe.houses(jd, 39.93, 32.86, HouseSystem.GauquelinSectors);
const lots = swe.lots(jd, { latitude: 39.93, longitude: 32.86 });
const subset = calculateLots(lots.points, lots.sect.sect, NON_HERMETIC_LOTS);
console.log(JSON.stringify({
  version: swe.version,
  sunLongitude: sun.longitude,
  sunSign: sun.sign,
  ascendant: houses.ascendant,
  cusps: houses.cusps.length,
  gauquelinCusps: gauquelin.cusps.length,
  allLots: Object.keys(ALL_LOTS).length,
  subsetLots: Object.keys(subset).length,
  fortuneName: lots.lots.Fortune.name,
  requiresFile: REQUIRES_EPHEMERIS_FILE.size,
}));
swe.dispose();
`);

    const out = execFileSync(process.execPath, [probe],
      { cwd: consumer, encoding: 'utf8' });
    const got = JSON.parse(out.trim().split('\n').pop());

    r.check('import + createSwissEph()', got.version === '2.10.03', `SE ${got.version}`);
    r.check('Güneş konumu makul',
      got.sunSign === 'Taurus' && got.sunLongitude > 54 && got.sunLongitude < 55,
      `${got.sunLongitude.toFixed(4)}° ${got.sunSign}`);
    r.check('Yükselen hesaplanıyor',
      got.ascendant > 0 && got.ascendant < 360, `${got.ascendant.toFixed(4)}°`);
    r.check('Placidus 12 cusp', got.cusps === 12, `${got.cusps}`);
    // Kırpma hatası tam olarak burada, yayınlanmış pakette görünmüyordu.
    r.check('Gauquelin 36 sektör', got.gauquelinCusps === 36, `${got.gauquelinCusps}`);
    r.check('lot kümeleri çağrılabilir',
      got.allLots === 15 && got.subsetLots === 8,
      `ALL_LOTS ${got.allLots}, NON_HERMETIC_LOTS ${got.subsetLots}`);
    // Public yüzey İngilizce olmalı — yayınlanan pakette de.
    r.check('lot adları İngilizce', got.fortuneName === 'Lot of Fortune',
      got.fortuneName);
    r.check('REQUIRES_EPHEMERIS_FILE dışa verilmiş', got.requiresFile === 6,
      `${got.requiresFile} cisim`);
  }

  // --- 5. MCP paketi çözülebilir bir sürüme bağlı mı -------------------
  r.section('5) MCP bağımlılık sürümü');

  const mcp = packed.find((p) => p.pkg === 'mcp');
  if (mcp) {
    const mcpPkg = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'mcp', 'package.json'), 'utf8'));
    const corePkg = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'core', 'package.json'), 'utf8'));
    const dep = mcpPkg.dependencies?.['@kuntay/swisseph'];
    r.check('mcp -> @kuntay/swisseph, çekirdek sürümüyle aynı',
      String(dep).replace(/^[\^~]/, '') === corePkg.version,
      `"${dep}" vs çekirdek ${corePkg.version}`);
  }

  /*
   * --- 6. MCP sunucusu YAYINLANMIŞ DÜZENDE açılıyor mu ------------------
   *
   * Buraya kadar mcp yalnızca paketlenip bağımlılık string'i okunuyordu;
   * sunucunun kendisi hiç çalıştırılmıyordu. Bir MCP istemcisinin gördüğü ilk
   * ve tek sürüm bilgisi `initialize` yanıtındaki serverInfo, ve o sürüm
   * package.json'dan okunuyor — yani `dist/index.js`'ten bir üst dizindeki
   * dosyanın yayınlanmış düzende de çözülmesi gerekiyor. Ağaçta çalışması
   * bunu kanıtlamıyor. Ölçüldü: sabit kodlanmış '0.1.0' 0.2.0 yayınlandıktan
   * sonra da öyle kaldı ve hiçbir kontrol fark etmedi.
   *
   * Tarball `npm install` ile KURULMUYOR, açılıyor. Kurmak @kuntay/swisseph'i
   * registry'den çözmeye kalkardı ve yayın sırasında çekirdeğin yeni sürümü
   * henüz orada olmadığı için 404 alırdı — ultracode.md'de ölçülmüş tuzak.
   * Bunun yerine bağımlılık, 2. adımda zaten kurulmuş çekirdekten kopyalanıyor.
   */
  if (mcp && core) {
    r.section('6) MCP sunucusu yayınlanmış düzende açılıyor mu');

    /*
     * Repo'nun node_modules'ü ALTINA çıkarılıyor, geçici dizine değil.
     *
     * MCP paketinin üç bağımlılığı var: @kuntay/swisseph, @modelcontextprotocol/sdk
     * ve zod. Yalıtılmış bir dizinde açılınca ilki kopyalansa bile diğer ikisi
     * ERR_MODULE_NOT_FOUND veriyor, üstelik SDK'nın kendi geçişli bağımlılıkları
     * repo kökünde hoist edilmiş durumda — hepsini kopyalamak kırılgan olurdu.
     * node_modules/ altında Node çözümleme sırasında üst dizinlere yürüyüp
     * <repo>/node_modules'ü buluyor ve üçü de çözülüyor, bu betiğin ölçmek
     * istediği şey (dist/../package.json okunabiliyor mu) ise değişmiyor.
     */
    /*
     * Dizin adı her koşuda BENZERSİZ, sabit değil.
     *
     * Sabit adla çalışırken temizlik başarısız olursa bayat bir çıkarma
     * kalıyor ve kontrol sessizce yanlış yere geçiyor: `expected` de
     * `reported` da o eski kopyadan okunacağı için ikisi uyuşur ve test
     * yeşil verir. Windows'ta bu teorik değil — node_modules altında
     * rmSync(force) hata vermeden hiçbir şey silmiyor (rm -rf siliyor),
     * muhtemelen dizini açık tutan bir izleyici yüzünden.
     *
     * mkdtemp ile bayatlık imkânsız hale geliyor; temizlik ise en iyi çaba.
     */
    const nodeModules = join(ROOT, 'node_modules');
    for (const entry of readdirSync(nodeModules)) {
      if (entry.startsWith('.check-pack-mcp-')) {
        try { rmSync(join(nodeModules, entry), { recursive: true, force: true }); }
        catch { /* kalıntı zararsız, sonraki koşu kendi dizinini açıyor */ }
      }
    }
    const mcpRoot = mkdtempSync(join(nodeModules, '.check-pack-mcp-'));
    extracted = mcpRoot;

    /*
     * tar'a HİÇBİR mutlak yol verilmiyor: tarball hedefe kopyalanıp cwd oraya
     * alınıyor, argümanların tamamı göreli.
     *
     * Git for Windows'un GNU tar'ı mutlak Windows yollarını iki ayrı şekilde
     * bozuyor ve ikisi de ölçüldü: `-f C:\...` sürücü harfindeki iki noktayı
     * host ayracı sanıp "Cannot connect to C:" diyor, `-C C:\...` ise ters
     * bölüleri kaçış karakteri sayıp "No such file or directory" veriyor.
     * Göreli yollar her iki tar uygulamasında da sorunsuz.
     */
    const localTarball = join(mcpRoot, 'pkg.tgz');
    copyFileSync(mcp.file, localTarball);
    execFileSync('tar', ['-xzf', 'pkg.tgz', '--strip-components=1'],
      { cwd: mcpRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    rmSync(localTarball, { force: true });

    const entry = join(mcpRoot, 'dist', 'index.js');
    r.check('giriş noktası açıldı', existsSync(entry), 'dist/index.js');
    r.check('package.json bir üst dizinde', existsSync(join(mcpRoot, 'package.json')),
      'dist/../package.json — serverInfo sürümü buradan okunuyor');

    const manifest = JSON.parse(readFileSync(join(mcpRoot, 'package.json'), 'utf8'));
    const expected = manifest.version;
    const { version: reported, strayLines } = initializeHandshake(entry);

    r.check('initialize yanıtı geldi', reported !== null,
      reported ? `serverInfo.version ${reported}` : 'sunucu yanıt vermedi');
    r.check('bildirilen sürüm package.json ile aynı', reported === expected,
      `${reported} vs ${expected}`);

    /*
     * stdout'ta JSON-RPC DIŞINDA hiçbir şey yok.
     *
     * Emscripten glue'su stdout'u varsayılan olarak console.log'a bağlıyor,
     * yani WASM'in yazdığı her satır doğrudan protokol kanalına düşüyor.
     * instance.ts bunu stderr'e çeviriyor; burada da kanalın gerçekten temiz
     * olduğu YAYINLANMIŞ düzende doğrulanıyor. Kirlenirse belirti "sunucu
     * bağlanamadı" olur ve sebebi hiçbir yerde yazmaz.
     */
    r.check('stdout yalnızca JSON-RPC taşıyor', strayLines.length === 0,
      strayLines.length === 0 ? 'protokol dışı satır yok'
        : `${strayLines.length} protokol dışı satır: ${strayLines[0].slice(0, 60)}`);

    /*
     * --- bin gerçekten var mı ve bir insanla konuşabiliyor mu ---
     *
     * `bin` hedefi tarball'da yoksa `npx @kuntay/swisseph-mcp` kurulum anında
     * düşer — istemci "sunucu başlatılamadı" der ve model aracı hiç görmez.
     *
     * `--version` de burada sınanıyor çünkü bir zamanlar argv tamamen yok
     * sayılıyordu: kurulumunu denetlemek için onu yazan kişi hiçbir çıktı
     * almadan asılı kalan bir sunucu görüyordu. Sağlıklı bir sunucunun bozuk
     * görünmesinin en kısa yolu buydu.
     */
    const binTarget = typeof manifest.bin === 'string'
      ? manifest.bin : Object.values(manifest.bin ?? {})[0];
    const binPath = binTarget ? join(mcpRoot, binTarget) : null;
    r.check('bin hedefi tarball içinde', Boolean(binPath && existsSync(binPath)),
      binTarget ?? 'package.json içinde bin yok');

    if (binPath && existsSync(binPath)) {
      const probe = spawnSync(process.execPath, [binPath, '--version'], {
        input: '', encoding: 'utf8', timeout: 60_000,
      });
      r.check('--version sunucuyu başlatmadan çıkıyor',
        probe.status === 0 && (probe.stdout ?? '').trim() === expected,
        `çıkış ${probe.status}, stdout ${JSON.stringify((probe.stdout ?? '').trim())}`);
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
  if (extracted) rmSync(extracted, { recursive: true, force: true });
}

r.finish('Yayınlanan tarball temiz bir tüketicide çalışıyor.');
