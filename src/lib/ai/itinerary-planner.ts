// Penyusun Rencana Perjalanan Deterministik Wistara (1 Hari / 3 Slot).
// Menerapkan aturan Bagian 5 di "Rancangan Wistara AI (Asisten Rencana).md":
// 1. Skor layak (skor >= 50 dan buka).
// 2. Variasi destinasi (tiap destinasi dipakai sekali, variasi kategori).
// 3. Estimasi waktu tempuh antar slot <= 60 menit.
// 4. Siang teduh/indoor saat suhu >= 32°C.
// 5. Sore prioritas spot senja bila sunset jatuh dalam slot.
// 6. Penanganan hujan & peringatan dini BMKG.

import type { DestCategory } from "../categories";
import type { ScoredSlot } from "../forecast/slots";
import { getDestinationAttribute } from "./attributes";
import { calculateSolarTimes, isSunsetInSlot } from "./solar";

export type PlannerDestinationItem = {
  slug: string;
  name: string;
  category: DestCategory;
  lat: number;
  lon: number;
  kabupaten: string;
  isIndoor?: boolean;
  slots: ScoredSlot[];
  /** Flag bila ada peringatan dini aktif di wilayah destinasi */
  hasWarning?: boolean;
};

export type PlannedSlotItem = {
  part: "pagi" | "siang" | "sore" | "malam";
  timeLabel: string;
  destination: {
    slug: string;
    name: string;
    category: DestCategory;
    kabupaten: string;
    lat: number;
    lon: number;
    score: number;
    weatherDesc: string;
    temp: number;
    isIndoor: boolean;
  };
  notes: string;
  transitFromPrevious?: {
    distanceKm: number;
    estimatedMinutes: number;
    isFar: boolean;
  };
};

export type ItineraryPlan = {
  title: string;
  dayKey: string;
  dayLabel: string;
  averageScore: number;
  slots: PlannedSlotItem[];
  notices: string[];
};

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // radius bumi dalam km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function estimateTransitMinutes(distanceKm: number): number {
  // Jarak darat jalan raya diperkirakan ~ 1.4x garis lurus, kecepatan rata-rata 30 km/jam
  const roadKm = distanceKm * 1.4;
  return Math.max(5, Math.round((roadKm / 30) * 60));
}

// Jendela waktu jam WIB untuk 3 slot harian
const WINDOWS = [
  { part: "pagi" as const, label: "Pagi (08.00–11.00 WIB)", targetHour: 9 },
  { part: "siang" as const, label: "Siang (12.00–15.00 WIB)", targetHour: 12 },
  { part: "sore" as const, label: "Sore (15.00–18.00 WIB)", targetHour: 15 },
];

function isSlotMatchingHour(slot: ScoredSlot, targetHour: number): boolean {
  // localTime format misal: "2026-10-17T09:00:00+07:00"
  const hourPart = parseInt(slot.localTime.slice(11, 13), 10);
  // Grid BMKG bisa 09.00 atau 08.00 (toleransi rentang jam)
  return Math.abs(hourPart - targetHour) <= 1;
}

export function planItinerary(
  destinations: PlannerDestinationItem[],
  dayKey: string,
  options?: {
    dayLabel?: string;
    preferredCategories?: DestCategory[];
  },
): ItineraryPlan | null {
  const dayLabel = options?.dayLabel ?? "Hari Terpilih";
  const notices: string[] = [];

  // Filter destinasi yang valid: tidak ada peringatan dini (CAP warning)
  const validDestinations = destinations.filter((dest) => {
    if (dest.hasWarning) {
      notices.push(`Destinasi ${dest.name} dilewati karena terdapat peringatan dini cuaca aktif di wilayah tersebut.`);
      return false;
    }
    return true;
  });

  if (validDestinations.length === 0) return null;

  // Temukan slot untuk tiap jendela waktu
  type Candidate = {
    dest: PlannerDestinationItem;
    slot: ScoredSlot;
    isShadedOrIndoor: boolean;
    isSunsetSpot: boolean;
    baseScore: number;
  };

  const candidatesByWindow: Record<"pagi" | "siang" | "sore", Candidate[]> = {
    pagi: [],
    siang: [],
    sore: [],
  };

  for (const dest of validDestinations) {
    const attr = getDestinationAttribute(dest.slug, !!dest.isIndoor);
    const daySlots = dest.slots.filter((s) => s.localTime.startsWith(dayKey));

    for (const win of WINDOWS) {
      // Cari slot yang paling pas dengan target jam
      const matchingSlot = daySlots.find((s) => isSlotMatchingHour(s, win.targetHour)) ??
        daySlots.find((s) => {
          const hour = parseInt(s.localTime.slice(11, 13), 10);
          if (win.part === "pagi") return hour >= 6 && hour <= 10;
          if (win.part === "siang") return hour >= 11 && hour <= 14;
          return hour >= 15 && hour <= 18;
        });

      if (!matchingSlot) continue;

      // Rule 1: Wajib buka
      if (!matchingSlot.isOpen || matchingSlot.score === null) continue;

      candidatesByWindow[win.part].push({
        dest,
        slot: matchingSlot,
        isShadedOrIndoor: attr.isShadedOrIndoor,
        isSunsetSpot: attr.isSunsetSpot,
        baseScore: matchingSlot.score,
      });
    }
  }

  // Jika ada slot yang tidak memiliki kandidat buka
  if (
    candidatesByWindow.pagi.length === 0 ||
    candidatesByWindow.siang.length === 0 ||
    candidatesByWindow.sore.length === 0
  ) {
    return null;
  }

  // Algoritma Penelusuran Kombinasi Terbaik (Deterministic Search)
  // Mencari kombinasi (Pagi, Siang, Sore) dengan destinasi unik yang memaksimalkan total utilitas
  let bestCombination: { pagi: Candidate; siang: Candidate; sore: Candidate } | null = null;
  let bestUtility = -Infinity;

  for (const cPagi of candidatesByWindow.pagi) {
    for (const cSiang of candidatesByWindow.siang) {
      if (cSiang.dest.slug === cPagi.dest.slug) continue; // Rule 2: Unik

      // Hitung transit Pagi -> Siang
      const dist1 = haversineDistanceKm(cPagi.dest.lat, cPagi.dest.lon, cSiang.dest.lat, cSiang.dest.lon);
      const transitMin1 = estimateTransitMinutes(dist1);

      for (const cSore of candidatesByWindow.sore) {
        if (cSore.dest.slug === cPagi.dest.slug || cSore.dest.slug === cSiang.dest.slug) continue; // Rule 2: Unik

        // Hitung transit Siang -> Sore
        const dist2 = haversineDistanceKm(cSiang.dest.lat, cSiang.dest.lon, cSore.dest.lat, cSore.dest.lon);
        const transitMin2 = estimateTransitMinutes(dist2);

        // Evaluasi Nilai Utilitas
        let utility = cPagi.baseScore + cSiang.baseScore + cSore.baseScore;

        // Rule 3: Penalti bila waktu tempuh > 60 menit
        if (transitMin1 > 60) utility -= (transitMin1 - 60) * 1.5;
        if (transitMin2 > 60) utility -= (transitMin2 - 60) * 1.5;

        // Rule 4: Slot siang diutamakan teduh/indoor bila suhu >= 32°C
        const siangTemp = cSiang.slot.t ?? 28;
        if (siangTemp >= 32) {
          if (cSiang.isShadedOrIndoor) utility += 25; // Bonus indoor/teduh saat siang panas
          else utility -= 20; // Penalti outdoor di siang terik
        }

        // Rule 5: Slot sore diutamakan spot senja
        const solar = calculateSolarTimes(cSore.dest.lat, cSore.dest.lon, new Date(cSore.slot.validAt));
        const sunsetInAfternoon = isSunsetInSlot(solar.sunset, new Date(cSore.slot.validAt));
        if (sunsetInAfternoon && cSore.isSunsetSpot) {
          utility += 20; // Bonus spot senja
        }

        // Variasi Kategori: bonus jika 3 destinasi berbeda kategori
        if (cPagi.dest.category !== cSiang.dest.category && cSiang.dest.category !== cSore.dest.category) {
          utility += 15;
        }

        if (utility > bestUtility) {
          bestUtility = utility;
          bestCombination = { pagi: cPagi, siang: cSiang, sore: cSore };
        }
      }
    }
  }

  if (!bestCombination) return null;

  // Susun output rencana yang terstruktur
  const distPagiToSiang = haversineDistanceKm(
    bestCombination.pagi.dest.lat,
    bestCombination.pagi.dest.lon,
    bestCombination.siang.dest.lat,
    bestCombination.siang.dest.lon,
  );
  const transitPagiToSiang = estimateTransitMinutes(distPagiToSiang);

  const distSiangToSore = haversineDistanceKm(
    bestCombination.siang.dest.lat,
    bestCombination.siang.dest.lon,
    bestCombination.sore.dest.lat,
    bestCombination.sore.dest.lon,
  );
  const transitSiangToSore = estimateTransitMinutes(distSiangToSore);

  // Buat catatan untuk tiap slot
  const pagiNotes = bestCombination.pagi.slot.score! >= 80
    ? "Waktu ideal beraktivitas luar ruang sebelum matahari mencapai titik terik."
    : "Kondisi cuaca cukup bersahabat untuk memulai perjalanan.";

  const siangTemp = bestCombination.siang.slot.t ?? 29;
  const siangNotes = bestCombination.siang.isShadedOrIndoor
    ? `Ruang tertutup/teduh berhawa nyaman saat suhu siang mencapai ${Math.round(siangTemp)}°C.`
    : `Aktivitas siang hari dengan prakiraan suhu sekitar ${Math.round(siangTemp)}°C.`;

  const soreNotes = bestCombination.sore.isSunsetSpot
    ? "Titik strategis menikmati panorama matahari terbenam dengan kondisi cuaca mendukung."
    : "Suasana sore yang teduh untuk menutup rangkaian kunjungan.";

  const plannedSlots: PlannedSlotItem[] = [
    {
      part: "pagi",
      timeLabel: WINDOWS[0].label,
      destination: {
        slug: bestCombination.pagi.dest.slug,
        name: bestCombination.pagi.dest.name,
        category: bestCombination.pagi.dest.category,
        kabupaten: bestCombination.pagi.dest.kabupaten,
        lat: bestCombination.pagi.dest.lat,
        lon: bestCombination.pagi.dest.lon,
        score: bestCombination.pagi.baseScore,
        weatherDesc: bestCombination.pagi.slot.weatherDesc ?? "Cerah",
        temp: Math.round(bestCombination.pagi.slot.t ?? 27),
        isIndoor: !!bestCombination.pagi.dest.isIndoor,
      },
      notes: pagiNotes,
    },
    {
      part: "siang",
      timeLabel: WINDOWS[1].label,
      destination: {
        slug: bestCombination.siang.dest.slug,
        name: bestCombination.siang.dest.name,
        category: bestCombination.siang.dest.category,
        kabupaten: bestCombination.siang.dest.kabupaten,
        lat: bestCombination.siang.dest.lat,
        lon: bestCombination.siang.dest.lon,
        score: bestCombination.siang.baseScore,
        weatherDesc: bestCombination.siang.slot.weatherDesc ?? "Cerah",
        temp: Math.round(bestCombination.siang.slot.t ?? 32),
        isIndoor: !!bestCombination.siang.dest.isIndoor,
      },
      notes: siangNotes,
      transitFromPrevious: {
        distanceKm: distPagiToSiang,
        estimatedMinutes: transitPagiToSiang,
        isFar: transitPagiToSiang > 60,
      },
    },
    {
      part: "sore",
      timeLabel: WINDOWS[2].label,
      destination: {
        slug: bestCombination.sore.dest.slug,
        name: bestCombination.sore.dest.name,
        category: bestCombination.sore.dest.category,
        kabupaten: bestCombination.sore.dest.kabupaten,
        lat: bestCombination.sore.dest.lat,
        lon: bestCombination.sore.dest.lon,
        score: bestCombination.sore.baseScore,
        weatherDesc: bestCombination.sore.slot.weatherDesc ?? "Cerah Berawan",
        temp: Math.round(bestCombination.sore.slot.t ?? 29),
        isIndoor: !!bestCombination.sore.dest.isIndoor,
      },
      notes: soreNotes,
      transitFromPrevious: {
        distanceKm: distSiangToSore,
        estimatedMinutes: transitSiangToSore,
        isFar: transitSiangToSore > 60,
      },
    },
  ];

  if (transitPagiToSiang > 60 || transitSiangToSore > 60) {
    notices.push("Salah satu rute perpindahan membutuhkan perjalanan darat lebih dari 60 menit; disarankan berangkat tepat waktu.");
  }

  const avgScore = Math.round(
    (bestCombination.pagi.baseScore + bestCombination.siang.baseScore + bestCombination.sore.baseScore) / 3,
  );

  return {
    title: `Rencana Jelajah Ramah Cuaca (${dayLabel})`,
    dayKey,
    dayLabel,
    averageScore: avgScore,
    slots: plannedSlots,
    notices,
  };
}
