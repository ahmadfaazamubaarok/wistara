import Link from "next/link";
import { SeaBadge, WaveIcon } from "@/components/sea-badge";
import { MiscIcon } from "@/components/icons";
import type { BeachSafety, Destination } from "@/lib/db/destinations";
import { SEA_FIXED_NOTICE, SEA_STATUS_HINT, formatWaveHeight } from "@/lib/marine/sea-labels";
import type { SeaSlotEvaluation, SeaStatus } from "@/lib/marine/sea-status";
import type { MarineAreaForecast } from "@/lib/weather/marine-service";

// Kartu kondisi laut di halaman detail pantai.
// Semua kalimat di sini hanya menjelaskan DATA BMKG (prakiraan model per
// wilayah perairan) dan tidak pernah menjanjikan kondisi di bibir pantai.

export type SeaWorstSlot = {
  status: SeaStatus;
  waveCat: string | null;
  waveHeightMax: number | null;
  /** Label waktu siap tampil, mis. "Besok 09.00". */
  when: string;
};

type Props = {
  destination: Destination;
  seaEvaluation: SeaSlotEvaluation | null;
  marineForecast: MarineAreaForecast | null;
  beachSafety: BeachSafety | null;
  /** Slot yang dinilai, mis. "Besok 09.00 WIB (waktu terbaik cuaca darat)". */
  slotLabel: string | null;
  /** Status terberat dalam rentang prakiraan; null bila tidak ada data. */
  worst: SeaWorstSlot | null;
};

const SUMMARY: Record<SeaStatus, string> = {
  perhatian:
    "BMKG memprakirakan gelombang rendah di wilayah perairan ini. Angka ini berlaku untuk perairan, bukan untuk titik tertentu di bibir pantai, dan arus balik tetap bisa terjadi walau gelombang kecil.",
  waspada:
    "BMKG memprakirakan gelombang sedang, atau hembusan angin laut kencang, di wilayah perairan ini. Hindari bermain air di luar zona yang ditandai petugas.",
  bahaya:
    "BMKG memprakirakan gelombang tinggi di wilayah perairan ini. Jangan bermain air dan jauhi area pecah ombak.",
  informasi_terbatas:
    "Prakiraan maritim untuk pantai ini belum tersedia atau sudah lebih dari 24 jam. Wistara tidak menebak kondisi laut tanpa data.",
};

const SWIM_TEXT: Record<BeachSafety["swimStatus"], string> = {
  dilarang: "Dilarang berenang menurut sumber yang tercatat",
  zona_terbatas: "Berenang hanya di zona yang ditandai petugas",
  belum_diverifikasi: "Status berenang belum diverifikasi",
};

const HAZARD_TEXT: Record<string, string> = {
  arus_balik: "arus balik",
  karang: "karang",
  tebing: "tebing",
  muara: "muara",
  palung: "palung",
};

function speedText(kmh: number | null): string {
  return kmh === null ? "Tidak tersedia" : `${kmh.toLocaleString("id-ID")} km/jam`;
}

export function BeachMaritimeCard({ destination, seaEvaluation, marineForecast, beachSafety, slotLabel, worst }: Props) {
  if (destination.category !== "pantai") return null;

  const status: SeaStatus = seaEvaluation?.status ?? "informasi_terbatas";
  const hasData = status !== "informasi_terbatas";
  const areaName = marineForecast?.areaName ?? null;
  const height = formatWaveHeight(seaEvaluation?.waveHeightMax ?? null);
  const showWorst = worst && worst.status !== "informasi_terbatas" && worst.status !== status;

  return (
    <section aria-labelledby="maritim-card-h" className="rounded-xl border border-hairline bg-surface-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0">
          <h2 id="maritim-card-h" className="flex items-center gap-2 !text-[18px] font-semibold text-ink">
            <WaveIcon size={18} />
            Kondisi laut
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {areaName ? `Prakiraan maritim BMKG untuk ${areaName}` : "Pantai ini belum dipasangkan ke wilayah perairan BMKG"}
            {slotLabel && hasData ? ` · ${slotLabel}` : ""}
          </p>
        </div>
        <SeaBadge status={status} waveCat={seaEvaluation?.waveCat} waveHeight={seaEvaluation?.waveHeightMax} />
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-body">{SUMMARY[status]}</p>

      {seaEvaluation?.windEscalated && (
        <p className="mt-2 text-[14px] leading-relaxed text-body">
          Status dinaikkan satu tingkat karena hembusan angin laut diprakirakan lebih dari 25 knot (sekitar 46 km/jam).
        </p>
      )}

      {showWorst && worst && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[14px] text-body">
          <span>Status terberat dalam 3 hari ke depan</span>
          <SeaBadge status={worst.status} waveCat={worst.waveCat} waveHeight={worst.waveHeightMax} size="sm" />
          <span className="text-muted">{worst.when}</span>
        </p>
      )}

      {hasData && (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-hairline bg-canvas p-3">
            <dt className="text-[12px] text-muted">Tinggi gelombang maks.</dt>
            <dd className="mt-1 text-[16px] font-bold tabular-nums text-ink">{height ?? "Tidak tersedia"}</dd>
            <dd className="text-[12px] text-muted">{seaEvaluation?.waveCat ? `Kategori ${seaEvaluation.waveCat}` : "Kategori tidak tersedia"}</dd>
          </div>
          <div className="rounded-lg border border-hairline bg-canvas p-3">
            <dt className="text-[12px] text-muted">Hembusan angin laut maks.</dt>
            <dd className="mt-1 text-[16px] font-bold tabular-nums text-ink">{speedText(seaEvaluation?.windGustMaxKmh ?? null)}</dd>
          </div>
          <div className="rounded-lg border border-hairline bg-canvas p-3">
            <dt className="text-[12px] text-muted">Arus permukaan maks.</dt>
            <dd className="mt-1 text-[16px] font-bold tabular-nums text-ink">{speedText(seaEvaluation?.currentSpeedMaxKmh ?? null)}</dd>
            <dd className="text-[12px] text-muted">Arus di perairan, bukan arus balik di pantai</dd>
          </div>
          <div className="rounded-lg border border-hairline bg-canvas p-3">
            <dt className="text-[12px] text-muted">Wilayah BMKG</dt>
            <dd className="mt-1 text-[14px] font-semibold text-ink">{destination.marineAreaCode}</dd>
            {marineForecast?.issuedAt && (
              <dd className="text-[12px] text-muted">
                Rilis{" "}
                {new Intl.DateTimeFormat("id-ID", {
                  timeZone: "Asia/Jakarta",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(marineForecast.issuedAt)}{" "}
                WIB
              </dd>
            )}
          </div>
        </dl>
      )}

      <div className="mt-4 rounded-lg border-l-4 border-sea-danger-text bg-canvas p-4">
        <h3 className="text-[15px] font-semibold text-ink">Sebelum bermain air</h3>
        {beachSafety ? (
          <div className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-body">
            <p className="font-medium text-ink">{SWIM_TEXT[beachSafety.swimStatus]}.</p>
            {beachSafety.hazards.length > 0 && (
              <p>Bahaya yang tercatat {beachSafety.hazards.map((h) => HAZARD_TEXT[h] ?? h).join(", ")}.</p>
            )}
            {beachSafety.sarPostName && <p>Pos SAR terdekat {beachSafety.sarPostName}.</p>}
            {beachSafety.emergencyContact && <p>Kontak darurat {beachSafety.emergencyContact}.</p>}
            {beachSafety.notes && <p>{beachSafety.notes}</p>}
            <p className="text-[12.5px] text-muted">
              <a href={beachSafety.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                Sumber
              </a>{" "}
              · diverifikasi {beachSafety.verifiedAt}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[14px] leading-relaxed text-body">
            Informasi keselamatan pantai ini belum kami verifikasi. Tanyakan zona yang boleh dipakai bermain air ke petugas di lokasi.
          </p>
        )}
        <p className="mt-2 text-[14px] font-medium text-ink">{SEA_STATUS_HINT[status]}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3 text-[12.5px] text-muted">
        <span className="flex items-start gap-1.5">
          <MiscIcon name="info" size={14} />
          {SEA_FIXED_NOTICE}
        </span>
        <Link href="/tentang-data#maritim" className="font-medium">
          Cara status laut dihitung
        </Link>
      </div>
    </section>
  );
}
