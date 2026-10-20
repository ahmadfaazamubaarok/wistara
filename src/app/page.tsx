import type { Metadata } from "next";
import { HomeExplorer, type HomeItem } from "@/components/home/explorer";
import { listDestinations } from "@/lib/db/destinations";
import { getManyForecasts } from "@/lib/forecast/destination-forecast";
import { evaluateSeaSlot } from "@/lib/marine/sea-status";
import { getAreaForecast, type MarineAreaForecast } from "@/lib/weather/marine-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Waktu terbaik berkunjung ke destinasi DIY",
};

const DEFAULT_MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

// Beranda (PRD F1): peta + daftar. Skor terbaik per hari dihitung di server dari
// prakiraan yang tersimpan di database, bukan dari browser.
export default async function Home() {
  const now = new Date();
  const destinations = await listDestinations();
  const { bySlug, source, dayKeys } = await getManyForecasts(destinations, { days: 3, now });

  // Ambil prakiraan 3 wilayah maritim DIY untuk destinasi pantai
  const marineResults = await Promise.all([
    getAreaForecast("P.N.01", { now }).catch(() => null),
    getAreaForecast("P.N.02", { now }).catch(() => null),
    getAreaForecast("P.N.03", { now }).catch(() => null),
  ]);
  const marineByCode = new Map<string, MarineAreaForecast>();
  if (marineResults[0]) marineByCode.set("P.N.01", marineResults[0]);
  if (marineResults[1]) marineByCode.set("P.N.02", marineResults[1]);
  if (marineResults[2]) marineByCode.set("P.N.03", marineResults[2]);

  const items: HomeItem[] = destinations.map((destination) => {
    const forecast = bySlug.get(destination.slug);
    const marine = destination.marineAreaCode ? marineByCode.get(destination.marineAreaCode) : null;
    const isMarineStale = marine?.isStale ?? true;
    const marineRows = marine?.rows ?? [];

    return {
      slug: destination.slug,
      name: destination.name,
      category: destination.category,
      lat: destination.lat,
      lon: destination.lon,
      kabupaten: destination.region.kabupaten,
      marineAreaCode: destination.marineAreaCode,
      bestByDay: (forecast?.bestByDay ?? []).map((best) => {
        if (!best) return null;
        let seaStatus = null;
        let waveHeightMax = null;
        let waveCat = null;
        if (destination.category === "pantai") {
          const evalRes = evaluateSeaSlot(best.localTime, marineRows, {
            isStale: isMarineStale,
            marineAreaCode: destination.marineAreaCode,
          });
          seaStatus = evalRes.status;
          waveHeightMax = evalRes.waveHeightMax;
          waveCat = evalRes.waveCat;
        }
        return {
          localTime: best.localTime,
          score: best.score,
          label: best.label,
          band: best.band,
          seaStatus,
          waveHeightMax,
          waveCat,
        };
      }),
      slots: (forecast?.slots ?? []).map((slot) => {
        let seaStatus = null;
        let waveHeightMax = null;
        let waveCat = null;
        if (destination.category === "pantai") {
          const evalRes = evaluateSeaSlot(slot.validAt, marineRows, {
            isStale: isMarineStale,
            marineAreaCode: destination.marineAreaCode,
          });
          seaStatus = evalRes.status;
          waveHeightMax = evalRes.waveHeightMax;
          waveCat = evalRes.waveCat;
        }
        return {
          validAt: slot.validAt,
          localTime: slot.localTime,
          isOpen: slot.isOpen,
          score: slot.score,
          label: slot.label,
          band: slot.band,
          weatherDesc: slot.weatherDesc,
          t: slot.t,
          seaStatus,
          waveHeightMax,
          waveCat,
        };
      }),
      hasForecast: (forecast?.slots.length ?? 0) > 0,
    };
  });

  return (
    <main id="konten" className="flex flex-1 flex-col">
      <HomeExplorer
        items={items}
        days={dayKeys}
        source={source ? { isStale: source.isStale, fetchedAt: source.fetchedAt } : null}
        mapStyleUrl={process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE}
      />
    </main>
  );
}
