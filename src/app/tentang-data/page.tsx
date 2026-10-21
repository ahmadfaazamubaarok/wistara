import type { Metadata } from "next";
import { AttributionBar } from "@/components/attribution-bar";
import { FormulaCalculator } from "@/components/about/formula-calculator";
import { TableOfContents, type TocItem } from "@/components/about/table-of-contents";
import { ScoreChip } from "@/components/score-chip";
import { SiteFooter } from "@/components/site-footer";
import { BMKG_MARINE_URL, BMKG_URL, OPENFREEMAP_URL, OSM_COPYRIGHT_URL } from "@/lib/attribution";
import { SeaBadge } from "@/components/sea-badge";
import { SEA_FIXED_NOTICE, SEA_STATUS_HINT } from "@/lib/marine/sea-labels";
import { CATEGORY_LABEL, DEST_CATEGORIES } from "@/lib/categories";
import { getPool } from "@/lib/db";
import { getScoreProfiles } from "@/lib/db/destinations";
import { formatWibDateTime } from "@/lib/format";
import {
  HEAT_FREE_C,
  HEAT_MAX_C,
  RAIN_PENALTY,
  VISIBILITY_PENALTY,
  WIND_FREE_KMH,
  WIND_MAX_KMH,
} from "@/lib/scoring/penalties";
import { DEFAULT_VISIT_WINDOW } from "@/lib/scoring/open-hours";
import { MAX_REASONS, REASON_THRESHOLD } from "@/lib/scoring/score";
import { ALT_MAX, ALT_MIN_SCORE, ALT_RADIUS_M, ALT_TRIGGER_BELOW } from "@/lib/forecast/alternatives";
import { STALE_AFTER_MS } from "@/lib/weather/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Metode & Tentang Data",
  description:
    "Bagaimana Wistara menghitung kelayakan kunjungan wisata dari prakiraan BMKG: rumus matematis, empat penalti, bobot kategori, dan contoh perhitungannya.",
};

const title = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

async function loadFreshness() {
  const { rows } = await getPool().query<{
    bmkg_last: Date | null;
    bmkg_analysis: Date | null;
    osm_last: Date | null;
    unverified: number;
    total: number;
  }>(`
    select (select max(last_success_at) from forecast_fetches) as bmkg_last,
           (select max(analysis_date) from forecasts) as bmkg_analysis,
           (select max(fetched_at) from facilities) as osm_last,
           (select count(*) from destinations where verified_at is null)::int as unverified,
           (select count(*) from destinations)::int as total`);
  return rows[0];
}

const fmt = (date: Date | null) => (date ? formatWibDateTime(date.toISOString()) : "belum ada");

const TOC_ITEMS: TocItem[] = [
  { id: "ringkas", label: "Ringkasnya" },
  { id: "rumus", label: "Rumusnya & Contoh", number: "01" },
  { id: "band", label: "Empat Band Skor", number: "02" },
  { id: "penalti", label: "Penalti Cuaca", number: "03" },
  { id: "bobot", label: "Bobot Kategori", number: "04" },
  { id: "jam", label: "Jam Buka & Kunjungan", number: "05" },
  { id: "sumber", label: "Sumber & Kesegaran", number: "06" },
  { id: "alternatif", label: "Alternatif Hujan", number: "07" },
  { id: "fasilitas", label: "Fasilitas OSM", number: "08" },
  { id: "maritim", label: "Prakiraan Maritim BMKG", number: "09" },
];

export default async function AboutDataPage() {
  const [profiles, freshness] = await Promise.all([getScoreProfiles(), loadFreshness()]);
  const staleHours = STALE_AFTER_MS / 3_600_000;

  const th = "py-2.5 pr-4 text-left text-[13px] font-semibold text-muted";
  const td = "py-2.5 pr-4 align-top text-body";

  return (
    <>
      <div className="mx-auto max-w-6xl w-full min-w-0 px-4 py-6 md:px-8 md:py-12 lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-14 overflow-x-clip">
        {/* Navigasi Daftar Isi (Desktop Sidebar & Mobile Bar) */}
        <TableOfContents items={TOC_ITEMS} />

        {/* Konten Dokumen Utama */}
        <main id="konten" className="w-full min-w-0 max-w-[72ch] pb-24 overflow-x-clip">
          <header>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Metode · Sistem Penilaian Wistara
            </p>
            <h1 className="mt-3 font-serif text-[clamp(26px,4vw,44px)] font-normal leading-[1.15] tracking-tight text-ink">
              Bagaimana Wistara menilai kelayakan kunjungan wisata.
            </h1>
            <p className="mt-4 text-[16px] sm:text-[17px] leading-[1.65] text-body">
              Setiap warna dan rekomendasi di peta berasal dari satu perhitungan objektif: nilai dasar
              100 dikurangi empat penalti cuaca BMKG terbobot. Halaman ini menjelaskan dari mana data
              berasal, bagaimana rumus menghitungnya, dan contoh nyatanya di berbagai destinasi.
            </p>

            {/* Metadata Bar */}
            <dl className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-hairline py-3 text-[13px]">
              <div className="flex gap-1.5 min-w-0">
                <dt className="text-muted shrink-0">Prakiraan:</dt>
                <dd className="font-semibold text-ink">BMKG 3 Hari</dd>
              </div>
              <div className="flex gap-1.5 min-w-0">
                <dt className="text-muted shrink-0">Cakupan:</dt>
                <dd className="font-semibold text-ink">20 Destinasi DIY</dd>
              </div>
              <div className="flex gap-1.5 min-w-0">
                <dt className="text-muted shrink-0">Peta & Fasilitas:</dt>
                <dd className="font-semibold text-ink">OpenStreetMap (ODbL)</dd>
              </div>
              <div className="flex gap-1.5 min-w-0">
                <dt className="text-muted shrink-0">Pembaruan:</dt>
                <dd className="font-semibold text-ink">Otomatis 2× Sehari</dd>
              </div>
            </dl>
          </header>

          <div className="mt-8 flex flex-col gap-8 w-full min-w-0">
            {/* Ringkasnya */}
            <section id="ringkas" aria-labelledby="ringkas-h" className="w-full min-w-0 scroll-mt-28">
              <h2 id="ringkas-h" className="font-serif text-[26px] font-normal text-ink">
                Ringkasnya
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-hairline bg-surface-card/40 p-4">
                  <p className="text-[14px] font-bold text-ink">Satu rumus objektif</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                    Skor = 100 dikurangi empat penalti cuaca terbobot. Warna penanda di peta membaca langsung skor ini.
                  </p>
                </div>
                <div className="rounded-xl border border-hairline bg-surface-card/40 p-4">
                  <p className="text-[14px] font-bold text-ink">Prakiraan resmi BMKG</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                    Data cuaca per 3 jam untuk 3 hari ke depan dari API publik BMKG hingga tingkat desa/kelurahan.
                  </p>
                </div>
                <div className="rounded-xl border border-hairline bg-surface-card/40 p-4">
                  <p className="text-[14px] font-bold text-ink">Sensitivitas per kategori</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                    Angin kencang dan hujan berbahaya di pantai selatan, namun tidak mengganggu kenyamanan pameran di dalam museum.
                  </p>
                </div>
                <div className="rounded-xl border border-hairline bg-surface-card/40 p-4">
                  <p className="text-[14px] font-bold text-ink">Keputusan & alternatif</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">
                    Aplikasi memberi tahu kapan waktu terbaik berangkat, dan langsung menyarankan destinasi indoor saat cuaca buruk.
                  </p>
                </div>
              </div>
            </section>

            {/* 01. Rumusnya & Contoh */}
            <section id="rumus" aria-labelledby="rumus-h" className="w-full min-w-0 scroll-mt-28">
              <h2 id="rumus-h" className="flex items-baseline gap-2.5 font-serif text-[26px] font-normal text-ink">
                <span className="font-mono text-[16px] font-semibold text-link" aria-hidden="true">
                  01
                </span>
                Rumusnya
              </h2>

              <div className="mt-4 space-y-4 text-[15.5px] leading-[1.7] text-body">
                {/* Kotak Formula Besar */}
                <div className="rounded-xl border border-hairline bg-surface-card p-4 sm:p-5 md:p-6 text-ink overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <p className="font-serif text-[clamp(15px,2.2vw,22px)] leading-snug break-words">
                    Skor = maks(0, 100 − (w<sub>hujan</sub>·P<sub>hujan</sub> + w<sub>angin</sub>·P<sub>angin</sub> + w<sub>panas</sub>·P<sub>panas</sub> + w<sub>pandang</sub>·P<sub>pandang</sub>))
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Penalti Terbobot = Bobot Kategori (<em>w</em>) × Nilai Penalti Parameter BMKG (<em>P</em>)
                  </p>
                </div>

                <p>
                  Setiap slot 3 jam bermula dari nilai dasar <strong>100 poin</strong>. Nilai ini kemudian
                  dikurangi oleh empat penalti parameter cuaca dari BMKG (hujan, angin, panas, dan jarak
                  pandang). Setiap penalti memiliki nilai 0 hingga 100, lalu dikalikan dengan bobot sesuai
                  jenis destinasi.
                </p>
                <p>
                  Pendekatan ini menjamin bahwa kondisi cuaca yang sama tidak diperlakukan seragam: angin 25 km/jam
                  di pantai selatan berisiko gelombang tinggi dan pasir terbawa angin, sedangkan angin yang sama
                  sama sekali tidak mempengaruhi kunjungan ke museum indoor.
                </p>

                {/* Komponen Contoh Simulasi Ber-tab */}
                <FormulaCalculator />
              </div>
            </section>

            {/* 02. Empat Band Skor */}
            <section id="band" aria-labelledby="band-h" className="w-full min-w-0 scroll-mt-28">
              <h2 id="band-h" className="flex items-baseline gap-2.5 font-serif text-[26px] font-normal text-ink">
                <span className="font-mono text-[16px] font-semibold text-link" aria-hidden="true">
                  02
                </span>
                Empat Band Skor
              </h2>
              <div className="mt-4 space-y-4 text-[15.5px] leading-[1.7] text-body">
                <p>
                  Skor akhir dikelompokkan ke dalam empat band kelayakan. Ambang batas ini merupakan konstanta
                  desain yang dirancang agar rekomendasi mudah dibaca seketika:
                </p>

                {/* Visualisasi Spektrum Band */}
                <div className="pt-2 w-full max-w-full overflow-hidden" aria-hidden="true">
                  <div className="relative h-3.5 overflow-hidden rounded-full border border-hairline flex">
                    <span className="h-full bg-score-bad-bg border-r border-hairline" style={{ width: "50%" }} />
                    <span className="h-full bg-score-mid-bg border-r border-hairline" style={{ width: "25%" }} />
                    <span className="h-full bg-score-good-bg" style={{ width: "25%" }} />
                  </div>
                  <div className="relative mt-1.5 h-4 font-mono text-[12px] text-muted">
                    <span className="absolute left-0">0</span>
                    <span className="absolute -translate-x-1/2" style={{ left: "50%" }}>
                      50
                    </span>
                    <span className="absolute -translate-x-1/2" style={{ left: "75%" }}>
                      75
                    </span>
                    <span className="absolute right-0">100</span>
                  </div>
                </div>

                <div className="w-full max-w-full overflow-x-auto rounded-lg border border-hairline/60">
                  <table className="w-full min-w-[500px] border-collapse text-[14px]">
                    <caption className="sr-only">Rentang skor dan artinya</caption>
                    <thead>
                      <tr className="border-b border-hairline">
                        <th className={th}>Band Status</th>
                        <th className={th}>Rentang Skor</th>
                        <th className={th}>Makna Bagi Wisatawan</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr]:border-b [&_tr]:border-hairline">
                      <tr>
                        <td className={td}>
                          <ScoreChip score={90} />
                        </td>
                        <td className={`${td} font-mono tabular-nums`}>75 – 100</td>
                        <td className={td}>Kondisi cuaca sangat mendukung aktivitas wisata. Minim atau tanpa penalti.</td>
                      </tr>
                      <tr>
                        <td className={td}>
                          <ScoreChip score={65} />
                        </td>
                        <td className={`${td} font-mono tabular-nums`}>50 – 74</td>
                        <td className={td}>Masih layak dikunjungi, namun ada faktor cuaca yang mulai terasa (panas siang atau gerimis ringan).</td>
                      </tr>
                      <tr>
                        <td className={td}>
                          <ScoreChip score={30} />
                        </td>
                        <td className={`${td} font-mono tabular-nums`}>0 – 49</td>
                        <td className={td}>Kurang nyaman atau berisiko. Bila penalti utamanya hujan, sistem memicu alternatif indoor.</td>
                      </tr>
                      <tr>
                        <td className={td}>
                          <ScoreChip score={null} />
                        </td>
                        <td className={`${td} font-mono text-muted`}>–</td>
                        <td className={td}>Di luar jam operasional resmi destinasi; tidak dinilai kelayakannya.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-[13.5px] text-muted">
                  Warna status selalu disertai ikon geometris berbeda (lingkaran centang, setengah lingkaran, segitiga peringatan, gembok)
                  dan teks label, sehingga lulus uji aksesibilitas tanpa bergantung pada warna semata.
                </p>
              </div>
            </section>

            {/* 03. Penalti Cuaca */}
            <section id="penalti" aria-labelledby="penalti-h" className="w-full min-w-0 scroll-mt-28">
              <h2 id="penalti-h" className="flex items-baseline gap-2.5 font-serif text-[26px] font-normal text-ink">
                <span className="font-mono text-[16px] font-semibold text-link" aria-hidden="true">
                  03
                </span>
                Penalti Cuaca
              </h2>
              <div className="mt-4 space-y-4 text-[15.5px] leading-[1.7] text-body">
                <p>
                  Nilai penalti mentah (0 sampai 100) ditentukan oleh aturan berdasar data parameter resmi BMKG:
                </p>
                <div className="w-full max-w-full overflow-x-auto rounded-lg border border-hairline/60">
                  <table className="w-full min-w-[540px] border-collapse text-[14.5px]">
                    <thead>
                      <tr className="border-b border-hairline">
                        <th className={th}>Parameter</th>
                        <th className={th}>Input Data BMKG</th>
                        <th className={th}>Rumus & Aturan Penalti Mentah</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr]:border-b [&_tr]:border-hairline">
                      <tr>
                        <td className={`${td} font-semibold text-ink`}>Hujan (P<sub>hujan</sub>)</td>
                        <td className={td}>Kondisi cuaca (<code>weather_desc</code>)</td>
                        <td className={td}>
                          {Object.entries(RAIN_PENALTY)
                            .map(([name, value]) => `${title(name)} = ${value}`)
                            .join(" · ")}
                        </td>
                      </tr>
                      <tr>
                        <td className={`${td} font-semibold text-ink`}>Angin (P<sub>angin</sub>)</td>
                        <td className={td}>Kecepatan angin (<code>ws</code>, km/jam)</td>
                        <td className={td}>
                          0 jika ≤ {WIND_FREE_KMH} km/jam, naik linier hingga 100 pada {WIND_MAX_KMH} km/jam
                        </td>
                      </tr>
                      <tr>
                        <td className={`${td} font-semibold text-ink`}>Panas (P<sub>panas</sub>)</td>
                        <td className={td}>Suhu udara (<code>t</code>, °C)</td>
                        <td className={td}>
                          0 jika ≤ {HEAT_FREE_C} °C, naik linier hingga 100 pada {HEAT_MAX_C} °C
                        </td>
                      </tr>
                      <tr>
                        <td className={`${td} font-semibold text-ink`}>Jarak Pandang (P<sub>pandang</sub>)</td>
                        <td className={td}>Deskripsi cuaca / visibilitas</td>
                        <td className={td}>
                          {Object.entries(VISIBILITY_PENALTY)
                            .map(([name, value]) => `${title(name)} = ${value}`)
                            .join(" · ")}
                          ; kondisi lain = 0
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* 04. Bobot Kategori */}
            <section id="bobot" aria-labelledby="bobot-h" className="w-full min-w-0 scroll-mt-28">
              <h2 id="bobot-h" className="flex items-baseline gap-2.5 font-serif text-[26px] font-normal text-ink">
                <span className="font-mono text-[16px] font-semibold text-link" aria-hidden="true">
                  04
                </span>
                Bobot per Jenis Destinasi
              </h2>
              <div className="mt-4 space-y-4 text-[15.5px] leading-[1.7] text-body">
                <p>
                  Setiap jenis destinasi memiliki profil kerentanan berbeda yang disimpan di tabel basis data{" "}
                  <code>score_profiles</code>:
                </p>
                <div className="w-full max-w-full overflow-x-auto rounded-lg border border-hairline/60">
                  <table className="w-full min-w-[500px] border-collapse text-[14.5px] tabular-nums">
                    <thead>
                      <tr className="border-b border-hairline">
                        <th className={th}>Kategori</th>
                        <th className={th}>Hujan (w<sub>rain</sub>)</th>
                        <th className={th}>Angin (w<sub>wind</sub>)</th>
                        <th className={th}>Panas (w<sub>heat</sub>)</th>
                        <th className={th}>Pandang (w<sub>vis</sub>)</th>
                        <th className={th}>Pertimbangan Karakteristik</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr]:border-b [&_tr]:border-hairline">
                      {DEST_CATEGORIES.map((category) => {
                        const p = profiles[category];
                        let desc = "";
                        if (category === "pantai") desc = "Terbuka penuh, angin kencang berbahaya di pantai selatan";
                        else if (category === "alam") desc = "Jalur hiking licin saat hujan, pemandangan butuh jarak pandang";
                        else if (category === "budaya") desc = "Area terbuka luas, terik matahari siang sangat menyengat";
                        else if (category === "desa_wisata") desc = "Kombinasi aktivitas luar ruang dan pendopo budaya";
                        else if (category === "museum") desc = "Mayoritas pameran di dalam gedung tertutup ber-AC";

                        return (
                          <tr key={category}>
                            <td className={`${td} font-semibold text-ink`}>{CATEGORY_LABEL[category]}</td>
                            <td className={td}>{p?.wRain ?? "–"}</td>
                            <td className={td}>{p?.wWind ?? "–"}</td>
                            <td className={td}>{p?.wHeat ?? "–"}</td>
                            <td className={td}>{p?.wVis ?? "–"}</td>
                            <td className={`${td} font-sans text-[13px] text-muted`}>{desc}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-hairline bg-surface-card/40 p-4 text-[13.5px] leading-relaxed text-muted">
                  <p>
                    <strong>Ambang dan bobot ini adalah asumsi desain tim</strong> yang didasarkan pada karakteristik fisik
                    kawasan wisata di DIY, bukan standar mutlak BMKG. Nilai-nilai ini dikalibrasi berkala melalui evaluasi respons pengguna.
                  </p>
                  <p className="mt-2">
                    <strong>Alasan yang muncul di kartu:</strong> Penalti berbobot yang nilainya lebih besar dari{" "}
                    <strong>{REASON_THRESHOLD} poin</strong> ditampilkan sebagai keterangan pendukung (maksimal {MAX_REASONS} alasan
                    terbesar).
                  </p>
                </div>
              </div>
            </section>

            {/* 05. Jam Buka & Kunjungan */}
            <section id="jam" aria-labelledby="jam-h" className="w-full min-w-0 scroll-mt-28">
              <h2 id="jam-h" className="flex items-baseline gap-2.5 font-serif text-[26px] font-normal text-ink">
                <span className="font-mono text-[16px] font-semibold text-link" aria-hidden="true">
                  05
                </span>
                Jam Buka dan Kunjungan
              </h2>
              <div className="mt-4 space-y-4 text-[15.5px] leading-[1.7] text-body">
                <p>
                  Sebuah slot 3 jam dianggap buka bila <strong>jam mulainya</strong> berada di dalam rentang operasional destinasi.
                  Misalnya, slot 06.00 untuk destinasi yang baru dibuka pukul 08.30 dinilai &ldquo;Tutup&rdquo; dan tidak diberi skor.
                </p>
                <p>
                  Destinasi alam terbuka tanpa tiket masuk formal (pantai, gumuk pasir, bukit) dievaluasi pada jendela kunjungan wajar{" "}
                  <strong>{DEFAULT_VISIT_WINDOW[0].replace(":", ".")}–{DEFAULT_VISIT_WINDOW[1].replace(":", ".")} WIB</strong>.
                </p>
                <div className="rounded-xl border border-hairline bg-surface-soft p-4 text-[13.5px] text-muted">
                  Jam buka pada <strong>{freshness.unverified} dari {freshness.total} destinasi</strong> merupakan hasil kompilasi
                  terbuka dan belum diverifikasi langsung ke masing-masing pengelola. Wisatawan diimbau selalu mengonfirmasi jam
                  operasional resmi sebelum bepergian.
                </div>
              </div>
            </section>

            {/* 06. Sumber & Kesegaran Data */}
            <section id="sumber" aria-labelledby="sumber-h" className="w-full min-w-0 scroll-mt-28">
              <h2 id="sumber-h" className="flex items-baseline gap-2.5 font-serif text-[26px] font-normal text-ink">
                <span className="font-mono text-[16px] font-semibold text-link" aria-hidden="true">
                  06
                </span>
                Sumber Data & Kesegaran
              </h2>
              <div className="mt-4 space-y-4 text-[15.5px] leading-[1.7] text-body">
                <p>
                  Seluruh data diambil oleh server, diproses, dan disimpan di basis data internal sebelum disajikan ke pengguna.
                  Aplikasi mematuhi penuh batas wajar dan lisensi penggunaan data terbuka:
                </p>

                <div className="w-full max-w-full overflow-x-auto rounded-lg border border-hairline/60">
                  <table className="w-full min-w-[620px] border-collapse text-[14px]">
                    <thead>
                      <tr className="border-b border-hairline">
                        <th className={th}>Sumber Data</th>
                        <th className={th}>Penggunaan di Wistara</th>
                        <th className={th}>Lisensi & Ketentuan</th>
                        <th className={th}>Pembaruan Terkini</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr]:border-b [&_tr]:border-hairline">
                      <tr>
                        <td className={`${td} font-semibold text-ink`}>
                          <a href={BMKG_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-link">
                            BMKG Prakiraan Cuaca
                          </a>
                        </td>
                        <td className={td}>Prakiraan per 3 jam, 3 hari ke depan, tingkat desa/kelurahan</td>
                        <td className={td}>Hak cipta BMKG, wajib atribusi, batas 60 req/menit</td>
                        <td className={`${td} font-mono text-[13px] tabular-nums`}>
                          Diambil {fmt(freshness.bmkg_last)}
                          <br />
                          <span className="text-muted">Produksi BMKG: {fmt(freshness.bmkg_analysis)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td className={`${td} font-semibold text-ink`}>
                          <a href={BMKG_MARINE_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-link">
                            BMKG Maritim
                          </a>
                        </td>
                        <td className={td}>Tinggi gelombang, arus, dan angin laut (P.N.01, P.N.02, P.N.03)</td>
                        <td className={td}>Data maritim BMKG, wajib atribusi</td>
                        <td className={td}>Pembaruan berkala harian</td>
                      </tr>
                      <tr>
                        <td className={`${td} font-semibold text-ink`}>
                          <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-link">
                            OpenStreetMap
                          </a>
                        </td>
                        <td className={td}>Koordinat wisata & fasilitas (toilet, parkir, ibadah, makan, halte, stasiun)</td>
                        <td className={td}>© Kontributor OpenStreetMap, lisensi ODbL</td>
                        <td className={`${td} font-mono text-[13px] tabular-nums`}>Diimpor {fmt(freshness.osm_last)}</td>
                      </tr>
                      <tr>
                        <td className={`${td} font-semibold text-ink`}>
                          <a href={OPENFREEMAP_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-link">
                            OpenFreeMap
                          </a>
                        </td>
                        <td className={td}>Lapisan peta dasar vektor Positron</td>
                        <td className={td}>Gratis dengan atribusi otomatis di peta</td>
                        <td className={td}>Langsung dari server tile</td>
                      </tr>
                      <tr>
                        <td className={`${td} font-semibold text-ink`}>Kemendagri (Wilayah)</td>
                        <td className={td}>Pemetaan koordinat destinasi ke kode adm4 desa BMKG</td>
                        <td className={td}>Dataset cahyadsn/wilayah (MIT) sesuai Kepmendagri</td>
                        <td className={td}>Saat inisialisasi basis data</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-[13.5px] text-muted">
                  Data cuaca dianggap <strong>kedaluwarsa (stale)</strong> bila pembaruan terakhir yang berhasil lebih dari {staleHours} jam
                  lalu. Saat hal itu terjadi, sistem menampilkan banner &ldquo;Data belum diperbarui&rdquo; beserta riwayat waktu terakhir
                  dan tidak memblokir akses pengguna.
                </p>
              </div>
            </section>

            {/* 07. Alternatif Saat Hujan */}
            <section id="alternatif" aria-labelledby="alt-h" className="w-full min-w-0 scroll-mt-28">
              <h2 id="alt-h" className="flex items-baseline gap-2.5 font-serif text-[26px] font-normal text-ink">
                <span className="font-mono text-[16px] font-semibold text-link" aria-hidden="true">
                  07
                </span>
                Alternatif Saat Cuaca Buruk (F5)
              </h2>
              <div className="mt-4 space-y-3 text-[15.5px] leading-[1.7] text-body">
                <p>
                  Saat cuaca buruk, wisatawan membutuhkan jalan keluar nyata, bukan sekadar peringatan pembatalan.
                  Sistem rekomendasi alternatif (F5) otomatis aktif dengan ketentuan:
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-[15px]">
                  <li>Skor slot destinasi bernilai <strong>di bawah {ALT_TRIGGER_BELOW} poin</strong> (kategori Kurang sesuai).</li>
                  <li>Faktor penalti terbesarnya adalah <strong>hujan</strong>.</li>
                  <li>
                    Sistem mencari maksimal {ALT_MAX} destinasi dalam ruangan (<code>is_indoor = true</code>) dalam radius{" "}
                    <strong>{ALT_RADIUS_M / 1000} km</strong> yang sedang buka di slot tersebut dengan skor minimal{" "}
                    <strong>{ALT_MIN_SCORE} poin</strong>, diurutkan dari jarak terdekat.
                  </li>
                  <li>
                    Bila tidak ada destinasi indoor yang memenuhi syarat di radius tersebut, sistem menyarankan slot waktu lain
                    di destinasi yang sama yang memiliki skor kelayakan tertinggi.
                  </li>
                </ul>
              </div>
            </section>

            {/* 08. Fasilitas OSM */}
            <section id="fasilitas" aria-labelledby="fasilitas-h" className="w-full min-w-0 scroll-mt-28">
              <h2 id="fasilitas-h" className="flex items-baseline gap-2.5 font-serif text-[26px] font-normal text-ink">
                <span className="font-mono text-[16px] font-semibold text-link" aria-hidden="true">
                  08
                </span>
                Kelengkapan Fasilitas OSM
              </h2>
              <div className="mt-4 space-y-3 text-[15.5px] leading-[1.7] text-body">
                <p>
                  Data fasilitas sekitar (toilet, tempat parkir, tempat makan, tempat ibadah, ATM, halte, dan stasiun) bersumber
                  dari pemetaan kolaboratif OpenStreetMap.
                </p>
                <p>
                  Tingkat kelengkapan data bervariasi secara geografis: sangat padat di pusat Kota Yogyakarta, dan lebih renggang
                  di kawasan pesisir pantai atau perbukitan terpencil. Apabila fasilitas tertentu tidak muncul pada radius pencarian,
                  sistem menampilkan status <em>&ldquo;Belum terpetakan di OpenStreetMap&rdquo;</em>, bukan menyatakan fasilitas tersebut
                  pasti tidak tersedia di dunia nyata.
                </p>
              </div>
            </section>

            {/* 09. Prakiraan Maritim & Status Laut */}
            <section id="maritim" aria-labelledby="maritim-h" className="w-full min-w-0 scroll-mt-28">
              <h2 id="maritim-h" className="flex items-baseline gap-2.5 font-serif text-[26px] font-normal text-ink">
                <span className="font-mono text-[16px] font-semibold text-link" aria-hidden="true">
                  09
                </span>
                Prakiraan maritim dan status laut
              </h2>

              <div className="mt-4 space-y-5 text-[15.5px] leading-[1.7] text-body">
                <p>
                  Untuk destinasi pantai, Wistara menampilkan prakiraan maritim BMKG berupa kategori dan tinggi gelombang, arus
                  permukaan, dan hembusan angin laut. Data ini adalah <strong>prakiraan model untuk satu wilayah perairan</strong>,
                  bukan hasil sensor dan bukan kondisi di titik tertentu di bibir pantai. Semua pantai dalam satu wilayah perairan
                  mendapat angka yang sama.
                </p>

                <div className="rounded-xl border border-hairline bg-surface-card p-5 text-[14.5px] leading-relaxed">
                  <h3 className="font-serif text-[17px] font-normal text-ink">Kenapa status laut dipisah dari skor cuaca?</h3>
                  <p className="mt-2 text-body">
                    Skor 0 sampai 100 hanya mengukur kenyamanan cuaca di darat, yaitu hujan, angin, panas, dan jarak pandang. Bila
                    gelombang ikut dimasukkan, skor tinggi bisa terbaca sebagai &ldquo;laut aman&rdquo;. Karena itu di halaman pantai
                    skor diberi keterangan &ldquo;Cuaca darat&rdquo;, dan status laut selalu tampil di sebelahnya. Cuaca darat bisa
                    mendukung sementara gelombang di perairan diprakirakan tinggi.
                  </p>
                </div>

                <div className="rounded-xl border-l-4 border-sea-danger-text bg-surface-card p-5 text-[14.5px] leading-relaxed">
                  <h3 className="font-serif text-[17px] font-normal text-ink">Kenapa tidak ada status &ldquo;aman&rdquo;?</h3>
                  <p className="mt-2 text-body">
                    Arus balik (<em>rip current</em>) adalah arus kuat yang mengalir dari bibir pantai ke arah laut. Arus ini bersifat
                    lokal, bisa muncul saat gelombang terlihat kecil, dan tidak tercakup dalam prakiraan per wilayah perairan. Karena
                    itu status paling rendah di Wistara hanya menyebut datanya, yaitu &ldquo;Gelombang rendah&rdquo;, tanpa kata
                    perintah dan tanpa janji. Kata perintah baru dipakai saat BMKG memprakirakan gelombang sedang atau tinggi.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <h3 className="font-serif text-[20px] font-normal text-ink">Cara menghitung status laut per slot 3 jam</h3>

                  <div className="rounded-xl border border-hairline bg-surface-card p-5">
                    <h4 className="font-semibold text-ink">1. Memasangkan pantai ke wilayah perairan BMKG</h4>
                    <p className="mt-2 text-[14.5px] text-body">
                      Setiap pantai dipasangkan ke poligon wilayah perairan BMKG terdekat dari koordinatnya, bukan dari kode wilayah
                      prakiraan darat. Pasangan yang meragukan (jarak lebih dari 5 km, atau dua poligon hampir sama dekat) dikosongkan,
                      lalu ditinjau manual oleh tim. Pantai yang belum punya pasangan menampilkan &ldquo;Data laut belum tersedia&rdquo;.
                    </p>
                    <ul className="mt-2.5 list-disc space-y-1 pl-5 text-[14px] text-body">
                      <li><strong className="font-mono text-ink">P.N.01</strong> Perairan Kulonprogo, misalnya Pantai Glagah dan Pantai Trisik</li>
                      <li><strong className="font-mono text-ink">P.N.02</strong> Perairan Bantul, misalnya Pantai Parangtritis, Depok, dan Goa Cemara</li>
                      <li><strong className="font-mono text-ink">P.N.03</strong> Perairan Gunungkidul, misalnya Pantai Baron, Drini, Indrayanti, dan Wediombo</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-hairline bg-surface-card p-5">
                    <h4 className="font-semibold text-ink">2. Mencocokkan waktu</h4>
                    <p className="mt-2 text-[14.5px] text-body">
                      Prakiraan maritim hari pertama berresolusi 1 jam, hari kedua sampai keempat berresolusi 3 jam. Wistara mengambil
                      semua titik maritim yang waktunya beririsan dengan slot 3 jam yang sama dengan slot cuaca darat.
                    </p>
                  </div>

                  <div className="rounded-xl border border-hairline bg-surface-card p-5">
                    <h4 className="font-semibold text-ink">3. Memakai kondisi terburuk</h4>
                    <p className="mt-2 text-[14.5px] text-body">
                      Bila satu slot berisi beberapa titik, yang dipakai adalah kategori, tinggi gelombang, dan hembusan angin
                      <strong> terburuk</strong>, bukan rata-ratanya. Bila gelombang sempat masuk kategori Sedang selama satu jam, seluruh
                      slot dinilai Waspada.
                    </p>
                  </div>

                  <div className="rounded-xl border border-hairline bg-surface-card p-5">
                    <h4 className="font-semibold text-ink">4. Menentukan status dari kategori gelombang BMKG</h4>
                    <div className="mt-3 w-full max-w-full overflow-x-auto rounded-lg border border-hairline/60">
                      <table className="w-full min-w-[520px] border-collapse text-[14px]">
                        <thead>
                          <tr className="border-b border-hairline">
                            <th className={th}>Kategori BMKG</th>
                            <th className={th}>Tinggi gelombang</th>
                            <th className={th}>Tampilan di Wistara</th>
                            <th className={th}>Kalimat pendamping</th>
                          </tr>
                        </thead>
                        <tbody className="[&_tr]:border-b [&_tr]:border-hairline">
                          <tr>
                            <td className={`${td} font-semibold text-ink`}>Tenang, Rendah</td>
                            <td className={`${td} tabular-nums`}>di bawah 1,25 m</td>
                            <td className={td}><SeaBadge status="perhatian" waveCat="Rendah" waveHeight={1.1} size="sm" /></td>
                            <td className={td}>{SEA_STATUS_HINT.perhatian}</td>
                          </tr>
                          <tr>
                            <td className={`${td} font-semibold text-ink`}>Sedang</td>
                            <td className={`${td} tabular-nums`}>1,25 sampai di bawah 2,5 m</td>
                            <td className={td}><SeaBadge status="waspada" waveCat="Sedang" waveHeight={1.9} size="sm" /></td>
                            <td className={td}>{SEA_STATUS_HINT.waspada}</td>
                          </tr>
                          <tr>
                            <td className={`${td} font-semibold text-ink`}>Tinggi, Sangat Tinggi, Ekstrem, Sangat Ekstrem</td>
                            <td className={`${td} tabular-nums`}>2,5 m ke atas</td>
                            <td className={td}><SeaBadge status="bahaya" waveCat="Tinggi" waveHeight={2.6} size="sm" /></td>
                            <td className={td}>{SEA_STATUS_HINT.bahaya}</td>
                          </tr>
                          <tr>
                            <td className={`${td} font-semibold text-ink`}>Tidak ada data, atau data lebih dari 24 jam</td>
                            <td className={td}>-</td>
                            <td className={td}><SeaBadge status="informasi_terbatas" size="sm" /></td>
                            <td className={td}>{SEA_STATUS_HINT.informasi_terbatas}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-[13.5px] text-muted">
                      Bila kategori kosong, status ditentukan dari tinggi gelombang dengan ambang yang sama. Angka di badge contoh
                      adalah ilustrasi.
                    </p>
                  </div>

                  <div className="rounded-xl border border-hairline bg-surface-card p-5">
                    <h4 className="font-semibold text-ink">5. Menaikkan status saat angin laut kencang</h4>
                    <p className="mt-2 text-[14.5px] text-body">
                      Bila hembusan angin laut maksimum dalam slot lebih dari 25 knot (sekitar 46 km/jam), status naik satu tingkat.
                      Gelombang rendah menjadi Waspada, dan Waspada menjadi Bahaya. Contohnya, gelombang rendah 1,1 m dengan hembusan
                      27 knot tampil sebagai <SeaBadge status="waspada" waveCat="Rendah" waveHeight={1.1} size="sm" />.
                    </p>
                  </div>

                  <div className="rounded-xl border border-hairline bg-surface-card p-5">
                    <h4 className="font-semibold text-ink">6. Kesegaran data</h4>
                    <p className="mt-2 text-[14.5px] text-body">
                      Wistara mencoba mengambil ulang data maritim bila data yang tersimpan sudah lebih dari 6 jam. Bila pengambilan
                      gagal, data terakhir tetap dipakai sampai berumur 24 jam. Lewat dari itu, status menjadi &ldquo;Data laut belum
                      tersedia&rdquo;. Ambang 24 jam lebih ketat dari cuaca darat (13 jam) karena menyangkut kegiatan di air.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-hairline bg-surface-card p-4 text-[13.5px] leading-relaxed text-muted">
                  <p>
                    <strong className="text-ink">Pernyataan metodologi.</strong> Data maritim bersumber dari BMKG melalui API data
                    maritim publik. Pemetaan kategori gelombang ke status Wistara, ambang hembusan angin 25 knot, dan batas umur data
                    24 jam adalah <strong>asumsi desain tim Wistara</strong>, bukan standar resmi BMKG atau Basarnas. {SEA_FIXED_NOTICE}
                  </p>
                </div>
              </div>
            </section>

            <AttributionBar />
          </div>
        </main>
      </div>

      <SiteFooter />
    </>
  );
}
