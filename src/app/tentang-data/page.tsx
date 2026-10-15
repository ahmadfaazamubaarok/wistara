import type { Metadata } from "next";
import { AttributionBar } from "@/components/attribution-bar";
import { ScoreChip } from "@/components/score-chip";
import { SiteFooter } from "@/components/site-footer";
import { BMKG_URL, OPENFREEMAP_URL, OSM_COPYRIGHT_URL } from "@/lib/attribution";
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
  title: "Tentang Data",
  description: "Sumber data, lisensi, waktu pembaruan, dan cara skor kelayakan kunjungan dihitung.",
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

export default async function AboutDataPage() {
  const [profiles, freshness] = await Promise.all([getScoreProfiles(), loadFreshness()]);
  const staleHours = STALE_AFTER_MS / 3_600_000;

  const th = "py-2 pr-4 text-left text-[13px] font-semibold text-muted";
  const td = "py-2 pr-4 align-top";

  return (
    <>
      <main id="konten" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 md:px-8 md:py-10">
        <h1>Tentang Data</h1>
        <p className="mt-3 max-w-[65ch]">
          Dari mana data JelajahLokal berasal, seberapa baru, dan bagaimana skor kelayakan kunjungan dihitung. Skor adalah
          rekomendasi berbasis prakiraan, <strong>bukan jaminan kondisi di lokasi</strong>.
        </p>

        <div className="mt-8 flex max-w-[860px] flex-col gap-10">
          <section aria-labelledby="sumber">
            <h2 id="sumber">Sumber data</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={th}>Sumber</th>
                    <th className={th}>Dipakai untuk</th>
                    <th className={th}>Lisensi dan syarat</th>
                    <th className={th}>Pembaruan terakhir</th>
                  </tr>
                </thead>
                <tbody className="[&_tr]:border-b [&_tr]:border-hairline">
                  <tr>
                    <td className={td}>
                      <a href={BMKG_URL} target="_blank" rel="noopener noreferrer">BMKG Prakiraan Cuaca</a>
                    </td>
                    <td className={td}>Prakiraan per 3 jam, 3 hari ke depan, tingkat desa/kelurahan</td>
                    <td className={td}>Wajib mencantumkan BMKG sebagai sumber. Batas 60 permintaan per menit.</td>
                    <td className={`${td} tabular-nums`}>
                      Diambil {fmt(freshness.bmkg_last)}
                      <br />
                      <span className="text-[13px] text-muted">Diproduksi BMKG {fmt(freshness.bmkg_analysis)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td className={td}>
                      <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
                    </td>
                    <td className={td}>Koordinat destinasi, toilet, parkir, tempat makan, tempat ibadah, ATM, halte, stasiun</td>
                    <td className={td}>© OpenStreetMap contributors, lisensi ODbL. Diimpor sekali, bukan dipanggil saat Anda membuka halaman.</td>
                    <td className={`${td} tabular-nums`}>Diimpor {fmt(freshness.osm_last)}</td>
                  </tr>
                  <tr>
                    <td className={td}>
                      <a href={OPENFREEMAP_URL} target="_blank" rel="noopener noreferrer">OpenFreeMap</a>
                    </td>
                    <td className={td}>Peta dasar</td>
                    <td className={td}>Gratis dengan atribusi; tanpa jaminan tingkat layanan. Bila peta tidak termuat, daftar tetap bisa dipakai.</td>
                    <td className={td}>Langsung dari penyedia</td>
                  </tr>
                  <tr>
                    <td className={td}>Kode wilayah Kemendagri</td>
                    <td className={td}>Memetakan destinasi ke desa/kelurahan yang dipakai BMKG</td>
                    <td className={td}>Dataset cahyadsn/wilayah (MIT). Setiap kode divalidasi dengan memanggil API BMKG.</td>
                    <td className={td}>Saat impor data</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted">
              Data cuaca dianggap <strong>lama</strong> bila pengambilan terakhir yang berhasil lebih dari {staleHours} jam
              lalu; halaman akan menampilkan label &ldquo;Data belum diperbarui&rdquo; beserta waktunya. Saat BMKG tidak bisa
              diakses, data terakhir tetap ditampilkan.
            </p>
          </section>

          <section aria-labelledby="skor">
            <h2 id="skor">Cara skor dihitung</h2>
            <p className="mt-3 max-w-[65ch]">
              Setiap slot 3 jam bernilai 100, dikurangi empat penalti cuaca. Setiap penalti bernilai 0 sampai 100 lalu
              dikalikan bobot sesuai jenis destinasi, karena angin kencang lebih berbahaya di pantai daripada di museum.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-md bg-surface-card p-4 font-mono text-sm leading-relaxed text-ink">
              {`Skor = maks(0, 100 − (w hujan × P hujan + w angin × P angin
                     + w panas × P panas + w jarak pandang × P jarak pandang))`}
            </pre>

            <h3 className="mt-6">Penalti</h3>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[520px] border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={th}>Penalti</th>
                    <th className={th}>Masukan dari BMKG</th>
                    <th className={th}>Aturan</th>
                  </tr>
                </thead>
                <tbody className="[&_tr]:border-b [&_tr]:border-hairline">
                  <tr>
                    <td className={td}>Hujan</td>
                    <td className={td}>Kondisi cuaca</td>
                    <td className={td}>
                      {Object.entries(RAIN_PENALTY)
                        .map(([name, value]) => `${title(name)} = ${value}`)
                        .join(" · ")}
                    </td>
                  </tr>
                  <tr>
                    <td className={td}>Angin</td>
                    <td className={td}>Kecepatan angin (km/jam)</td>
                    <td className={td}>
                      0 bila ≤ {WIND_FREE_KMH}, naik linear sampai 100 pada {WIND_MAX_KMH} km/jam
                    </td>
                  </tr>
                  <tr>
                    <td className={td}>Panas</td>
                    <td className={td}>Suhu (°C)</td>
                    <td className={td}>
                      0 bila ≤ {HEAT_FREE_C}, naik linear sampai 100 pada {HEAT_MAX_C} °C
                    </td>
                  </tr>
                  <tr>
                    <td className={td}>Jarak pandang</td>
                    <td className={td}>Kondisi cuaca</td>
                    <td className={td}>
                      {Object.entries(VISIBILITY_PENALTY)
                        .map(([name, value]) => `${title(name)} = ${value}`)
                        .join(" · ")}
                      ; selain itu 0
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="mt-6">Bobot per jenis destinasi</h3>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[420px] border-collapse text-[15px] tabular-nums">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className={th}>Kategori</th>
                    <th className={th}>Hujan</th>
                    <th className={th}>Angin</th>
                    <th className={th}>Panas</th>
                    <th className={th}>Jarak pandang</th>
                  </tr>
                </thead>
                <tbody className="[&_tr]:border-b [&_tr]:border-hairline">
                  {DEST_CATEGORIES.map((category) => {
                    const p = profiles[category];
                    return (
                      <tr key={category}>
                        <td className={td}>{CATEGORY_LABEL[category]}</td>
                        <td className={td}>{p?.wRain ?? "–"}</td>
                        <td className={td}>{p?.wWind ?? "–"}</td>
                        <td className={td}>{p?.wHeat ?? "–"}</td>
                        <td className={td}>{p?.wVis ?? "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-[65ch] text-sm text-muted">
              <strong>Ambang dan bobot ini adalah asumsi desain tim</strong>, bukan standar BMKG atau standar keselamatan
              wisata. Angkanya disimpan di basis data dan akan disetel setelah uji pengguna.
            </p>

            <h3 className="mt-6">Label dan alasan</h3>
            <ul className="mt-2 flex flex-wrap items-center gap-3">
              <li><ScoreChip score={90} /> 75 sampai 100</li>
              <li><ScoreChip score={60} /> 50 sampai 74</li>
              <li><ScoreChip score={30} /> 0 sampai 49</li>
              <li><ScoreChip score={null} /> di luar jam buka, tidak dinilai</li>
            </ul>
            <p className="mt-3 max-w-[65ch]">
              Alasan yang ditampilkan adalah penalti berbobot lebih besar dari {REASON_THRESHOLD}, diurutkan dari yang
              terbesar, maksimal {MAX_REASONS}. Status dibedakan dengan warna, ikon, dan teks sekaligus.
            </p>
          </section>

          <section aria-labelledby="jam">
            <h2 id="jam">Jam buka dan slot</h2>
            <p className="mt-3 max-w-[65ch]">
              Sebuah slot dianggap buka bila <strong>jam mulainya</strong> berada di dalam jam buka. Slot 06.00 untuk tempat
              yang baru buka 08.30 dinilai tutup. Destinasi tanpa jam buka tetap (pantai, alam, desa wisata) dinilai pada
              jendela kunjungan {DEFAULT_VISIT_WINDOW[0].replace(":", ".")}–{DEFAULT_VISIT_WINDOW[1].replace(":", ".")} WIB, yang
              juga asumsi desain.
            </p>
            <p className="mt-3 max-w-[65ch]">
              Jam buka pada {freshness.unverified} dari {freshness.total} destinasi{" "}
              <strong>belum diverifikasi ke pengelola</strong>. Selalu cek informasi resmi pengelola tentang penutupan atau
              keselamatan sebelum berangkat.
            </p>
          </section>

          <section aria-labelledby="alt">
            <h2 id="alt">Alternatif saat hujan</h2>
            <p className="mt-3 max-w-[65ch]">
              Saran muncul bila skor slot di bawah {ALT_TRIGGER_BELOW} dan penalti terbesarnya hujan. Isinya maksimal {ALT_MAX}{" "}
              destinasi indoor dalam radius {ALT_RADIUS_M / 1000} km yang buka pada slot itu dan berskor minimal {ALT_MIN_SCORE},
              terdekat lebih dulu. Bila tidak ada, kami menyarankan slot lain di destinasi yang sama.
            </p>
          </section>

          <section aria-labelledby="osm">
            <h2 id="osm">Kelengkapan fasilitas</h2>
            <p className="mt-3 max-w-[65ch]">
              Fasilitas berasal dari OpenStreetMap yang disunting sukarelawan, sehingga kelengkapannya berbeda-beda: padat di
              pusat kota, jarang di pantai dan desa. Bila satu tipe tidak ditemukan, kami menulis &ldquo;Belum terpetakan di
              OpenStreetMap&rdquo;, bukan berarti fasilitasnya pasti tidak ada.
            </p>
          </section>

          <AttributionBar />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
