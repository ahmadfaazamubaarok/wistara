import type { Metadata } from "next";
import { HomeExplorer, type HomeItem } from "@/components/home/explorer";
import { listDestinations } from "@/lib/db/destinations";
import { getManyForecasts } from "@/lib/forecast/destination-forecast";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Waktu terbaik berkunjung ke destinasi DIY",
};

const DEFAULT_MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

// Beranda (PRD F1): peta + daftar. Skor terbaik per hari dihitung di server dari
// prakiraan yang tersimpan di database, bukan dari browser.
export default async function Home() {
  const destinations = await listDestinations();
  const { bySlug, source, dayKeys } = await getManyForecasts(destinations);

  const items: HomeItem[] = destinations.map((destination) => {
    const forecast = bySlug.get(destination.slug);
    return {
      slug: destination.slug,
      name: destination.name,
      category: destination.category,
      lat: destination.lat,
      lon: destination.lon,
      kabupaten: destination.region.kabupaten,
      bestByDay: (forecast?.bestByDay ?? []).map((best) =>
        best ? { localTime: best.localTime, score: best.score, label: best.label, band: best.band } : null,
      ),
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
