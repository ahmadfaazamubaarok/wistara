import { ApiError, withApi } from "@/lib/api/errors";
import { parseParams, parseQuery, publicJson } from "@/lib/api/http";
import { forecastQuery, slugParams } from "@/lib/api/schemas";
import { getDestinationBySlug } from "@/lib/db/destinations";
import { getDestinationForecast } from "@/lib/forecast/destination-forecast";
import { evaluateSeaSlot } from "@/lib/marine/sea-status";
import { getAreaForecast } from "@/lib/weather/marine-service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

// GET /api/v1/destinations/{slug}/sea?days=3
// Prakiraan kondisi maritim BMKG per slot 3 jam untuk destinasi kategori pantai.
export const GET = withApi<Context>(async (request, { params }) => {
  const { slug } = parseParams(slugParams, await params);
  const { days } = parseQuery(forecastQuery, request);

  const destination = await getDestinationBySlug(slug);
  if (!destination) {
    throw new ApiError("NOT_FOUND", `Destinasi "${slug}" tidak ditemukan`);
  }

  if (destination.category !== "pantai") {
    throw new ApiError("NOT_FOUND", `Destinasi "${slug}" bukan kategori pantai`);
  }

  const now = new Date();
  const forecast = await getDestinationForecast(destination, { days, now });

  let marineAreaName: string | null = null;
  let stationName: string | null = null;
  let issuedAt: Date | null = null;
  let fetchedAt: Date | null = null;
  let isStale = false;
  let marineRows: Parameters<typeof evaluateSeaSlot>[1] = [];

  if (destination.marineAreaCode) {
    const marine = await getAreaForecast(destination.marineAreaCode, { now });
    marineAreaName = marine.areaName;
    stationName = marine.stationName;
    issuedAt = marine.issuedAt;
    fetchedAt = marine.fetchedAt;
    isStale = marine.isStale;
    marineRows = marine.rows;
  } else {
    isStale = true;
  }

  const slots = forecast.slots.map((slot) => {
    const evalResult = evaluateSeaSlot(slot.validAt, marineRows, {
      isStale,
      marineAreaCode: destination.marineAreaCode,
    });
    return {
      validAt: slot.validAt,
      localTime: slot.localTime,
      status: evalResult.status,
      waveCat: evalResult.waveCat,
      waveHeightMax: evalResult.waveHeightMax,
      windGustMaxKmh: evalResult.windGustMaxKmh,
      currentSpeedMaxKmh: evalResult.currentSpeedMaxKmh,
      pointCount: evalResult.pointCount,
    };
  });

  return publicJson({
    destination: {
      slug: destination.slug,
      marineAreaCode: destination.marineAreaCode,
    },
    source: {
      provider: "BMKG" as const,
      areaName: marineAreaName,
      stationName,
      issuedAt: issuedAt ? issuedAt.toISOString() : null,
      fetchedAt: fetchedAt ? fetchedAt.toISOString() : null,
      isStale,
    },
    notice:
      "Status berlaku untuk wilayah perairan, bukan jaminan kondisi di bibir pantai. Ikuti arahan petugas di lokasi.",
    slots,
  });
});
