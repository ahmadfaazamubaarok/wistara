// Logika evaluasi status laut per slot 3 jam berdasarkan data prakiraan maritim BMKG.
// Fungsi murni tanpa akses jaringan atau basis data (diuji secara unit).
//
// ATURAN KERAS:
// Kata "aman" tidak boleh muncul di nilai enum, label, maupun respons API.
// Status paling rendah adalah "perhatian".

export type SeaStatus = "perhatian" | "waspada" | "bahaya" | "informasi_terbatas";

// ASUMSI DESAIN tim, bukan standar BMKG atau SAR:
// Hembusan angin di atas 25 knot menaikkan status laut 1 tingkat
export const GUST_ESCALATE_KT = 25;

// ASUMSI DESAIN tim, bukan standar BMKG atau SAR:
// Ambang batas tinggi gelombang jika wave_cat kosong
export const WAVE_HEIGHT_THRESHOLDS = {
  PERHATIAN_MAX: 1.25, // di bawah 1.25 m = perhatian
  WASPADA_MAX: 2.5,    // 1.25 m s.d. di bawah 2.5 m = waspada, 2.5 m ke atas = bahaya
} as const;

export type MarinePointInput = {
  validAt: Date | string;
  resolutionMinutes: number; // 60 atau 180
  waveCat: string | null;
  waveHeight: number | null;
  windGustKt: number | null;
  currentSpeedKt: number | null;
};

export type SeaSlotEvaluation = {
  status: SeaStatus;
  waveCat: string | null;
  waveHeightMax: number | null;
  windGustMaxKmh: number | null;
  currentSpeedMaxKmh: number | null;
  pointCount: number;
  windEscalated?: boolean;
};

const SEVERITY_RANK: Record<SeaStatus, number> = {
  informasi_terbatas: 0,
  perhatian: 1,
  waspada: 2,
  bahaya: 3,
};

/**
 * Peringkat urutan untuk daftar rekomendasi (0 = didahulukan, 1 = didorong ke bawah).
 *
 * Pantai berstatus Bahaya pada slot yang direkomendasikan tidak boleh berada di atas
 * hanya karena cuaca daratnya bagus. Ini hanya mengubah URUTAN tampilan; skor 0-100
 * tidak disentuh (gelombang tidak masuk skor). Status lain, termasuk
 * informasi_terbatas, tidak dihukum: tidak ada data bukan berarti bahaya.
 */
export function seaRecommendationRank(status: SeaStatus | null | undefined): 0 | 1 {
  return status === "bahaya" ? 1 : 0;
}

function escalateStatus(status: SeaStatus): SeaStatus {
  if (status === "perhatian") return "waspada";
  if (status === "waspada") return "bahaya";
  return status;
}

function evaluateSinglePoint(point: MarinePointInput): SeaStatus {
  const cat = point.waveCat?.trim();

  if (cat) {
    if (cat === "Tenang" || cat === "Rendah") return "perhatian";
    if (cat === "Sedang") return "waspada";
    if (
      cat === "Tinggi" ||
      cat === "Sangat Tinggi" ||
      cat === "Ekstrem" ||
      cat === "Sangat Ekstrem"
    ) {
      return "bahaya";
    }
  }

  // Jika wave_cat kosong atau tak dikenal tetapi wave_height ada
  if (point.waveHeight !== null && Number.isFinite(point.waveHeight)) {
    if (point.waveHeight < WAVE_HEIGHT_THRESHOLDS.PERHATIAN_MAX) return "perhatian";
    if (point.waveHeight < WAVE_HEIGHT_THRESHOLDS.WASPADA_MAX) return "waspada";
    return "bahaya";
  }

  return "informasi_terbatas";
}

/**
 * Menghitung status laut dan ringkasan kondisi maritim untuk satu slot 3 jam.
 *
 * @param slotStart Awal slot waktu (Date atau string ISO)
 * @param points Daftar titik maritim yang tersedia
 * @param options Konteks: isStale (apakah data maritim basi > 24 jam) dan marineAreaCode
 */
export function evaluateSeaSlot(
  slotStart: Date | string,
  points: MarinePointInput[],
  options: { isStale?: boolean; marineAreaCode?: string | null } = {},
): SeaSlotEvaluation {
  const emptyResult = (status: SeaStatus): SeaSlotEvaluation => ({
    status,
    waveCat: null,
    waveHeightMax: null,
    windGustMaxKmh: null,
    currentSpeedMaxKmh: null,
    pointCount: 0,
  });

  // Aturan 1: Jika data basi, atau pantai tidak terhubung ke wilayah maritim
  if (options.isStale || !options.marineAreaCode) {
    return emptyResult("informasi_terbatas");
  }

  const slotStartMs = new Date(slotStart).getTime();
  const slotEndMs = slotStartMs + 3 * 60 * 60 * 1000;

  // Aturan 2: Ambil semua titik yang beririsan dengan slot 3 jam
  const overlappingPoints = points.filter((p) => {
    const ptStartMs = new Date(p.validAt).getTime();
    const durationMs = (p.resolutionMinutes || 60) * 60 * 1000;
    const ptEndMs = ptStartMs + durationMs;
    // Dua interval beririsan jika awal interval terbesar < akhir interval terkecil
    return Math.max(slotStartMs, ptStartMs) < Math.min(slotEndMs, ptEndMs);
  });

  if (overlappingPoints.length === 0) {
    return emptyResult("informasi_terbatas");
  }

  // Aturan 3 & 4: Tentukan status dasar dari nilai terburuk
  let baseStatus: SeaStatus = "informasi_terbatas";
  let worstRank = -1;
  let worstWaveCat: string | null = null;
  let maxWaveHeight: number | null = null;
  let maxWindGustKt: number | null = null;
  let maxCurrentSpeedKt: number | null = null;

  for (const pt of overlappingPoints) {
    const ptStatus = evaluateSinglePoint(pt);
    const rank = SEVERITY_RANK[ptStatus];

    if (rank > worstRank) {
      worstRank = rank;
      baseStatus = ptStatus;
      // Kategori harus milik titik terburuk. Jangan mewarisi kategori titik
      // yang lebih ringan, agar label tidak bertentangan dengan status.
      worstWaveCat = pt.waveCat?.trim() || null;
    } else if (rank === worstRank && !worstWaveCat && pt.waveCat?.trim()) {
      worstWaveCat = pt.waveCat.trim();
    }

    if (pt.waveHeight !== null) {
      if (maxWaveHeight === null || pt.waveHeight > maxWaveHeight) {
        maxWaveHeight = pt.waveHeight;
      }
    }

    if (pt.windGustKt !== null) {
      if (maxWindGustKt === null || pt.windGustKt > maxWindGustKt) {
        maxWindGustKt = pt.windGustKt;
      }
    }

    if (pt.currentSpeedKt !== null) {
      if (maxCurrentSpeedKt === null || pt.currentSpeedKt > maxCurrentSpeedKt) {
        maxCurrentSpeedKt = pt.currentSpeedKt;
      }
    }
  }

  // Aturan 5: Eskalasi satu tingkat bila wind_gust_kt maksimum > 25 knot
  let finalStatus = baseStatus;
  if (maxWindGustKt !== null && maxWindGustKt > GUST_ESCALATE_KT) {
    finalStatus = escalateStatus(baseStatus);
  }

  // Konversi knot ke km/jam (1 knot = 1.852 km/jam)
  const windGustMaxKmh =
    maxWindGustKt !== null ? Math.round(maxWindGustKt * 1.852) : null;
  const currentSpeedMaxKmh =
    maxCurrentSpeedKt !== null
      ? Math.round(maxCurrentSpeedKt * 1.852 * 10) / 10
      : null;

  return {
    status: finalStatus,
    waveCat: worstWaveCat,
    waveHeightMax: maxWaveHeight,
    windGustMaxKmh,
    currentSpeedMaxKmh,
    pointCount: overlappingPoints.length,
    windEscalated: maxWindGustKt !== null && maxWindGustKt > GUST_ESCALATE_KT && finalStatus !== baseStatus,
  };
}
