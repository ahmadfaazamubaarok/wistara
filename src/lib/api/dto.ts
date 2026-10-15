// Pemetaan objek domain ke bentuk respons API (lihat schemas.ts).

import type { z } from "zod";
import type { Destination } from "../db/destinations";
import type { BestOfDay } from "../forecast/destination-forecast";
import type { ScoredSlot } from "../forecast/slots";
import { googleMapsRouteUrl } from "./http";
import type { destinationSchema, slotSchema } from "./schemas";

export type DestinationDto = z.infer<typeof destinationSchema>;
export type SlotDto = z.infer<typeof slotSchema>;

export function toDestinationDto(destination: Destination): DestinationDto {
  return {
    slug: destination.slug,
    name: destination.name,
    category: destination.category,
    isIndoor: destination.isIndoor,
    lat: destination.lat,
    lon: destination.lon,
    region: destination.region,
    description: destination.description,
    openHours: destination.openHours,
    openHoursVerifiedAt: destination.verifiedAt,
    routeUrl: googleMapsRouteUrl(destination.lat, destination.lon),
  };
}

export function toSlotDto(slot: ScoredSlot, hasAlternatives: boolean): SlotDto {
  return {
    localTime: slot.localTime,
    validAt: slot.validAt,
    weatherDesc: slot.weatherDesc,
    t: slot.t,
    ws: slot.ws,
    hu: slot.hu,
    wd: slot.wd,
    tcc: slot.tcc,
    isOpen: slot.isOpen,
    score: slot.score,
    band: slot.band,
    label: slot.label as SlotDto["label"],
    reasons: slot.reasons,
    dominantPenalty: slot.dominant,
    hasAlternatives,
  };
}

export const compact = (list: (BestOfDay | null)[]): BestOfDay[] =>
  list.filter((item): item is BestOfDay => item !== null);
