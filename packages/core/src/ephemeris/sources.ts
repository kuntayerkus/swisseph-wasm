/**
 * Where ephemeris files come from.
 *
 * Swiss Ephemeris reads its files **synchronously** on the C side
 * (`swi_fopen`/`fread`). There is no way to await a fetch in the middle of a
 * C call, so files have to be loaded *before* any calculation. The arithmetic
 * in `files.ts` is what makes that practical: because the file a date needs
 * is known in advance, only the ~2 MB actually required is pulled from a
 * 379 MB archive.
 *
 * A missing file is not an error — Swiss Ephemeris falls back to Moshier on
 * its own. That is why `read()` may return null, and why callers do not have
 * to treat it as a failure.
 */

/** A source that can supply an ephemeris file by name. */
export interface EphemerisSource {
  /** The file's contents, or null when the source does not have it. */
  read(fileName: string): Promise<Uint8Array | null>;
  /** Name shown in diagnostic output. */
  readonly description: string;
}

/**
 * Files already in memory. Use this when you fetched them yourself — a
 * bundler import, a user upload, your own cache.
 */
export class MemoryEphemeris implements EphemerisSource {
  readonly description = 'bellek';
  #files: Map<string, Uint8Array>;

  constructor(files: Record<string, Uint8Array | ArrayBuffer>) {
    this.#files = new Map(
      Object.entries(files).map(([name, content]) => [
        name,
        content instanceof Uint8Array ? content : new Uint8Array(content),
      ]),
    );
  }

  async read(fileName: string): Promise<Uint8Array | null> {
    return this.#files.get(fileName) ?? null;
  }
}

export interface FetchEphemerisOptions {
  /**
   * Base URL the files sit under. Defaults to the data package's copy on
   * jsDelivr, which serves every published npm package automatically, so
   * there is no hosting cost.
   */
  baseUrl?: string;
  /**
   * Where downloaded files are kept. Without one, the browser's Cache API is
   * used; if that is unavailable, the source runs uncached and downloads
   * every time.
   */
  cache?: EphemerisCache;
  /** Replace `fetch` — for tests, a proxy, or custom headers. */
  fetchImpl?: typeof fetch;
}

/** Persistent storage for downloaded files. */
export interface EphemerisCache {
  get(key: string): Promise<Uint8Array | null>;
  set(key: string, value: Uint8Array): Promise<void>;
}

/**
 * Fetches files over HTTP, caching them when a cache is available.
 *
 * Written for the browser, but works under Node 18+ through global `fetch`.
 */
export class FetchEphemeris implements EphemerisSource {
  readonly description: string;
  #baseUrl: string;
  #cache: EphemerisCache | null;
  #fetch: typeof fetch;

  constructor(options: FetchEphemerisOptions = {}) {
    this.#baseUrl = (options.baseUrl ?? DEFAULT_CDN_BASE).replace(/\/+$/, '');
    this.#cache = options.cache ?? null;
    this.description = `fetch(${this.#baseUrl})`;

    const impl = options.fetchImpl ?? globalThis.fetch;
    if (typeof impl !== 'function') {
      throw new Error(
        'No fetch in this environment. Supply an implementation through the ' +
        'fetchImpl option.',
      );
    }

    // globalThis'e BAĞLAMAK zorunlu: tarayıcıda fetch, this'inin Window
    // (ya da WorkerGlobalScope) olmasını şart koşuyor ve ayrık bir referans
    // olarak çağrılınca "Illegal invocation" atıyor. Node'un fetch'i bu
    // kontrolü yapmadığından hata yalnızca tarayıcıda ortaya çıkıyor —
    // Node testleri bu yüzden sorunu göremedi.
    this.#fetch = options.fetchImpl ? impl : impl.bind(globalThis);
  }

  async read(fileName: string): Promise<Uint8Array | null> {
    if (this.#cache) {
      const hit = await this.#cache.get(fileName);
      if (hit) return hit;
    }

    const response = await this.#fetch(`${this.#baseUrl}/${fileName}`);
    // 404 beklenen bir durum: istenen aralık veri paketinde olmayabilir.
    // Swiss Ephemeris bu durumda Moshier'e düşeceği için hata fırlatmıyoruz.
    if (!response.ok) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (this.#cache) await this.#cache.set(fileName, bytes);
    return bytes;
  }
}

/** The data package's address on jsDelivr. */
export const DEFAULT_CDN_BASE =
  'https://cdn.jsdelivr.net/npm/@kuntay/swisseph-data/ephe';

/**
 * Reads from a real directory under Node.
 *
 * **Usually not what you want under Node.** Prefer
 * `createSwissEph({ ephemerisDirectory: '...' })`, which mounts the directory
 * through NODEFS with no copying. This class reads files into memory, which
 * means a 2 MB copy per instance.
 */
export class NodeFsEphemeris implements EphemerisSource {
  readonly description: string;
  #directory: string;

  constructor(directory: string) {
    this.#directory = directory;
    this.description = `dosya sistemi(${directory})`;
  }

  async read(fileName: string): Promise<Uint8Array | null> {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    try {
      return new Uint8Array(await readFile(join(this.#directory, fileName)));
    } catch {
      return null;
    }
  }
}

/**
 * A persistent cache built on the browser's Cache API.
 *
 * Cache API rather than IndexedDB: it is the natural interface for binary
 * data, the browser handles the quota, and the API surface is far smaller.
 * When it is unavailable — an insecure context, for instance — `create()`
 * returns null and the caller carries on without a cache.
 */
export class BrowserCache implements EphemerisCache {
  #cacheName: string;

  private constructor(cacheName: string) {
    this.#cacheName = cacheName;
  }

  static create(cacheName = 'swisseph-ephemeris'): BrowserCache | null {
    return typeof caches === 'undefined' ? null : new BrowserCache(cacheName);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const cache = await caches.open(this.#cacheName);
    const hit = await cache.match(key);
    return hit ? new Uint8Array(await hit.arrayBuffer()) : null;
  }

  async set(key: string, value: Uint8Array): Promise<void> {
    const cache = await caches.open(this.#cacheName);
    // Uint8Array'i Response'a sarmak için ArrayBuffer'a çeviriyoruz;
    // view offset'i olan bir dizi doğrudan verilirse yanlış aralık yazılır.
    const body = value.buffer.slice(
      value.byteOffset, value.byteOffset + value.byteLength,
    ) as ArrayBuffer;
    await cache.put(key, new Response(body));
  }
}
