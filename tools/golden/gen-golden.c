/*
 * Altın referans üreteci.
 *
 * Vendor'lanmış Swiss Ephemeris C kaynağını NATIVE derleyip (gcc, x86-64)
 * geniş bir girdi ızgarası üzerinde çalıştırır ve sonuçları tam hassasiyetle
 * yazar. Node tarafı aynı satırları WASM build'ine verip karşılaştırır.
 *
 * Tasarım: her satır KENDİ GİRDİLERİNİ taşır. Izgarayı hem C'de hem JS'te
 * ayrı tanımlasaydık zamanla birbirinden kayarlar ve "aynı girdi" sandığımız
 * şeyi karşılaştırmaz olurduk. Fixture'ın kendisi ızgaranın tanımıdır.
 *
 * Sayılar %.17g ile yazılıyor — IEEE754 double'ı tam olarak gidip getiren
 * en kısa gösterim. Yuvarlanmış çıktı karşılaştırmayı anlamsız kılardı.
 *
 * Çıktı: sekmeyle ayrılmış, stdout.
 */

#include <stdio.h>
#include <string.h>
#include "swephexp.h"

#define D "\t"
#define F "%.17g"

/* --- ızgara tanımları --------------------------------------------------- */

/* Yıllar: .se1 kapsamının (1800-2399) içi ve dışı kasten karışık.
 * Dışarıdakiler Moshier'e sessiz düşüşü de karşılaştırmaya sokuyor. */
static const int YEARS[] = {
  1500, 1600, 1700, 1800, 1850, 1900, 1950,
  2000, 2024, 2050, 2100, 2200, 2300, 2399, 2500
};
#define N_YEARS (sizeof(YEARS) / sizeof(YEARS[0]))

static const int MONTHS[] = { 1, 4, 7, 10 };
#define N_MONTHS (sizeof(MONTHS) / sizeof(MONTHS[0]))

static const int DAYS[] = { 1, 15 };
#define N_DAYS (sizeof(DAYS) / sizeof(DAYS[0]))

/* Gök cisimleri 0-20. 14 (Earth) dahil: jeosentrik istendiğinde hata
 * döndürüyor ve hata yolunun da aynı davranması gerekiyor. */
#define N_BODIES 21

/* Bayrak kümeleri. Farklı kod yollarını tetiklemek için seçildi:
 * dosya okuma, analitik teori, koordinat dönüşümü, ışık süresi düzeltmesi. */
static const int32 FLAGSETS[] = {
  SEFLG_SWIEPH | SEFLG_SPEED,
  SEFLG_MOSEPH | SEFLG_SPEED,
  SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_EQUATORIAL,
  SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_HELCTR,
  SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_TRUEPOS,
  SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_J2000 | SEFLG_NONUT,
};
#define N_FLAGSETS (sizeof(FLAGSETS) / sizeof(FLAGSETS[0]))

/* Ev sistemleri: swe_house_name()'in tanıdığı tüm kodlar. */
static const char *HOUSE_SYSTEMS = "ABCDEFGHIiJKLMNOPQRSTUVWXY";

/* Konumlar — kutup bölgeleri kasten dahil: Placidus ve Koch kutup
 * dairesinin ötesinde tanımsız, o hata yolunun da eşleşmesi gerekiyor. */
static const struct { double lat, lon; const char *name; } PLACES[] = {
  {  39.93,  32.86, "Ankara"       },
  {  51.51,  -0.13, "London"       },
  { -33.87, 151.21, "Sydney"       },
  {   0.00,   0.00, "Equator"      },
  {  66.50,  25.70, "ArcticCircle" },
  {  70.00,  23.00, "AboveArctic"  },
  { -70.00,   0.00, "Antarctic"    },
  {  89.00,   0.00, "NearPole"     },
};
#define N_PLACES (sizeof(PLACES) / sizeof(PLACES[0]))

static const char *STARS[] = {
  "Aldebaran", "Regulus", "Antares", "Fomalhaut", "Sirius", "Spica",
  "Algol", "Vega", "Betelgeuse", "Rigel", "Polaris", "Arcturus",
  "Canopus", "Capella", "Procyon", "Deneb", "Altair", "Bellatrix",
  "Alcyone", "Zubenelgenubi",
};
#define N_STARS (sizeof(STARS) / sizeof(STARS[0]))

static const int32 SID_MODES[] = {
  SE_SIDM_FAGAN_BRADLEY, SE_SIDM_LAHIRI, SE_SIDM_DELUCE, SE_SIDM_RAMAN,
  SE_SIDM_USHASHASHI, SE_SIDM_KRISHNAMURTI, SE_SIDM_DJWHAL_KHUL,
  SE_SIDM_YUKTESHWAR, SE_SIDM_JN_BHASIN, SE_SIDM_TRUE_CITRA,
};
#define N_SID_MODES (sizeof(SID_MODES) / sizeof(SID_MODES[0]))

/* --- yardımcılar --------------------------------------------------------- */

static void print_doubles(const double *x, int n) {
  for (int i = 0; i < n; i++) printf(D F, x[i]);
}

/* serr içinde sekme/yeni satır olursa satır formatı bozulur. */
static void print_clean(const char *s) {
  putchar('\t');
  for (const char *p = s; *p; p++) putchar((*p == '\t' || *p == '\n' || *p == '\r') ? ' ' : *p);
}

int main(int argc, char *argv[]) {
  char serr[AS_MAXCH];
  char sname[AS_MAXCH];
  double x[6];
  double cusps[37];        /* Gauquelin sektörleri 37 istiyor, 13 değil */
  double ascmc[10];
  double cusp_speed[37];
  double ascmc_speed[10];

  if (argc > 1) swe_set_ephe_path(argv[1]);

  /* Başlık kasten saf ASCII: fixture dosyasında kodlama belirsizliği olmasın. */
  printf("# Swiss Ephemeris golden reference corpus\n");
  printf("# version" D "%s\n", swe_version(sname));

  /* --- tarih dönüşümleri ------------------------------------------------ */
  for (size_t yi = 0; yi < N_YEARS; yi++) {
    for (size_t mi = 0; mi < N_MONTHS; mi++) {
      for (size_t di = 0; di < N_DAYS; di++) {
        for (int gregflag = 0; gregflag <= 1; gregflag++) {
          double hour = (di == 0) ? 0.0 : 12.0;
          double jd = swe_julday(YEARS[yi], MONTHS[mi], DAYS[di], hour, gregflag);
          int jy, jm, jd_out;
          double jut;
          swe_revjul(jd, gregflag, &jy, &jm, &jd_out, &jut);
          printf("date" D "%d" D "%d" D "%d" D F D "%d" D F D "%d" D "%d" D "%d" D F "\n",
                 YEARS[yi], MONTHS[mi], DAYS[di], hour, gregflag, jd, jy, jm, jd_out, jut);
        }
      }
    }
  }

  /* --- gök cismi konumları ---------------------------------------------- */
  for (size_t yi = 0; yi < N_YEARS; yi++) {
    for (size_t mi = 0; mi < N_MONTHS; mi++) {
      double jd = swe_julday(YEARS[yi], MONTHS[mi], 15, 12.0, SE_GREG_CAL);
      for (int ipl = 0; ipl < N_BODIES; ipl++) {
        for (size_t fi = 0; fi < N_FLAGSETS; fi++) {
          serr[0] = '\0';
          int32 ret = swe_calc_ut(jd, ipl, FLAGSETS[fi], x, serr);
          printf("calc" D F D "%d" D "%d" D "%d", jd, ipl, FLAGSETS[fi], ret);
          print_doubles(x, 6);
          print_clean(serr);
          putchar('\n');
        }
      }
    }
  }

  /* --- sidereal konumlar ------------------------------------------------ */
  for (size_t si = 0; si < N_SID_MODES; si++) {
    swe_set_sid_mode(SID_MODES[si], 0, 0);
    for (size_t yi = 0; yi < N_YEARS; yi++) {
      double jd = swe_julday(YEARS[yi], 6, 15, 12.0, SE_GREG_CAL);

      serr[0] = '\0';
      double ayan[1];
      int32 aret = swe_get_ayanamsa_ex_ut(jd, SEFLG_SWIEPH, ayan, serr);
      printf("ayanamsa" D F D "%d" D "%d" D F, jd, SID_MODES[si], aret, ayan[0]);
      print_clean(serr);
      putchar('\n');

      for (int ipl = 0; ipl <= SE_PLUTO; ipl++) {
        serr[0] = '\0';
        int32 flags = SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_SIDEREAL;
        int32 ret = swe_calc_ut(jd, ipl, flags, x, serr);
        printf("calcsid" D F D "%d" D "%d" D "%d" D "%d",
               jd, ipl, flags, SID_MODES[si], ret);
        print_doubles(x, 6);
        print_clean(serr);
        putchar('\n');
      }
    }
  }
  swe_set_sid_mode(SE_SIDM_FAGAN_BRADLEY, 0, 0);   /* durumu geri al */

  /* --- ev sistemleri ---------------------------------------------------- */
  for (size_t yi = 0; yi < N_YEARS; yi++) {
    double jd = swe_julday(YEARS[yi], 3, 15, 9.25, SE_GREG_CAL);
    for (size_t pi = 0; pi < N_PLACES; pi++) {
      for (const char *hs = HOUSE_SYSTEMS; *hs; hs++) {
        serr[0] = '\0';
        int ret = swe_houses_ex2(jd, 0, PLACES[pi].lat, PLACES[pi].lon, *hs,
                                 cusps, ascmc, cusp_speed, ascmc_speed, serr);
        printf("houses" D F D F D F D "%c" D "%d", jd, PLACES[pi].lat, PLACES[pi].lon, *hs, ret);
        /* 1-tabanlı dizi: cusps[1..12]. Gauquelin'de 37 var ama ilk 12'yi
         * karşılaştırmak yeterli — fazlası fixture'ı gereksiz şişirir. */
        print_doubles(cusps + 1, 12);
        print_doubles(ascmc, 8);
        print_clean(serr);
        putchar('\n');
      }
    }
  }

  /* --- sabit yıldızlar -------------------------------------------------- */
  for (size_t yi = 0; yi < N_YEARS; yi++) {
    double jd = swe_julday(YEARS[yi], 9, 1, 0.0, SE_GREG_CAL);
    for (size_t si = 0; si < N_STARS; si++) {
      strcpy(sname, STARS[si]);
      serr[0] = '\0';
      int32 ret = swe_fixstar2(sname, jd, SEFLG_SWIEPH | SEFLG_SPEED, x, serr);
      printf("star" D "%s" D F D "%d" D "%d", STARS[si], jd, SEFLG_SWIEPH | SEFLG_SPEED, ret);
      print_doubles(x, 6);
      print_clean(sname);
      print_clean(serr);
      putchar('\n');
    }
  }

  /* --- delta T ---------------------------------------------------------- */
  for (size_t yi = 0; yi < N_YEARS; yi++) {
    for (size_t mi = 0; mi < N_MONTHS; mi++) {
      double jd = swe_julday(YEARS[yi], MONTHS[mi], 1, 0.0, SE_GREG_CAL);
      serr[0] = '\0';
      double dt = swe_deltat_ex(jd, SEFLG_SWIEPH, serr);
      printf("deltat" D F D "%d" D F, jd, SEFLG_SWIEPH, dt);
      print_clean(serr);
      putchar('\n');
    }
  }

  swe_close();
  return 0;
}
