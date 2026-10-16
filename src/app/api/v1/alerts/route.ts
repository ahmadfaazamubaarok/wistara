import { ApiError, withApi } from "@/lib/api/errors";
import { parseQuery, publicJson } from "@/lib/api/http";
import { alertsQuery } from "@/lib/api/schemas";
import { createDemoAlert, getActiveAlertsForDestination, listActiveAlerts } from "@/lib/db/alerts";
import { getDestinationBySlug } from "@/lib/db/destinations";

export const dynamic = "force-dynamic";

// GET /api/v1/alerts?destination=pantai-parangtritis&demo=1
// PRD F10: Peringatan dini cuaca ekstrem BMKG yang mengenai destinasi atau wilayah DIY
export const GET = withApi(async (request) => {
  const { destination: slug, demo } = parseQuery(alertsQuery, request);
  const now = new Date();
  const allowDemo = process.env.NODE_ENV !== "production";

  if (slug) {
    const dest = await getDestinationBySlug(slug);
    if (!dest) throw new ApiError("NOT_FOUND", `Destinasi "${slug}" tidak ditemukan`);

    let alerts = await getActiveAlertsForDestination(dest, now);
    if (alerts.length === 0 && demo && allowDemo) {
      alerts = [createDemoAlert(dest, now)];
    }

    return publicJson({
      total: alerts.length,
      alerts,
    });
  }

  let alerts = await listActiveAlerts(now);
  if (alerts.length === 0 && demo && allowDemo) {
    // Alert umum DIY untuk mode demo
    const effective = new Date(now.getTime() - 30 * 60 * 1000);
    const expires = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    alerts = [
      {
        capId: "DEMO-ALERT-DIY",
        identifier: "DEMO-ALERT-DIY-001",
        event: "Peringatan Dini Cuaca Ekstrem",
        headline: "Peringatan Dini Cuaca DIY: Hujan Lebat Disertai Petir dan Angin Kencang",
        description:
          "Berpotensi terjadi hujan dengan intensitas lebat yang dapat disertai kilat/petir dan angin kencang di wilayah Bantul, Sleman, Kulon Progo, Gunungkidul, dan Kota Yogyakarta.",
        instruction:
          "Masyarakat diimbau waspada terhadap bahaya hidrometeorologi seperti banjir genangan, pohon tumbang, dan jalan licin.",
        severity: "Severe",
        urgency: "Immediate",
        effective: effective.toISOString(),
        expires: expires.toISOString(),
        areaDesc: "D.I. Yogyakarta",
        admKecamatan: ["Kretek", "Ngaglik", "Tepus", "Kraton", "Wonosari"],
      },
    ];
  }

  return publicJson({
    total: alerts.length,
    alerts,
  });
});
