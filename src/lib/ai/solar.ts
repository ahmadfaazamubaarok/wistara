// Perhitungan astronomis murni waktu matahari terbit (sunrise) dan terbenam (sunset).
// Berbasis algoritma posisi matahari NOAA / Jean Meeus tanpa dependensi API luar.
// Berskala (scalable): dapat menghitung waktu matahari di sembarang koordinat (lat, lon) di Indonesia/dunia.

export type SolarTimes = {
  sunrise: Date;
  sunset: Date;
  /** Jam terbenam dalam representasi desimal waktu lokal (misal 17.65 = 17:39). */
  sunsetLocalHour: number;
};

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
// Zenith resmi saat piringan matahari menyentuh ufuk (90°50')
const OFFICIAL_ZENITH = 90.8333;

function dayOfYear(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0));
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Menghitung waktu matahari terbit dan terbenam berdasarkan koordinat dan tanggal.
 */
export function calculateSolarTimes(lat: number, lon: number, date: Date): SolarTimes {
  const n = dayOfYear(date);
  const lngHour = lon / 15;

  function calcTime(isSunrise: boolean): Date {
    const t = isSunrise ? n + (6 - lngHour) / 24 : n + (18 - lngHour) / 24;

    // Anomali rata-rata matahari
    const M = (0.9856 * t) - 3.289;

    // Bujur sejati matahari
    let L = M + (1.916 * Math.sin(M * DEG_TO_RAD)) + (0.020 * Math.sin(2 * M * DEG_TO_RAD)) + 282.634;
    L = ((L % 360) + 360) % 360;

    // Asensiorekta matahari
    let RA = RAD_TO_DEG * Math.atan(0.91764 * Math.tan(L * DEG_TO_RAD));
    RA = ((RA % 360) + 360) % 360;

    // Sesuaikan kuadran
    const Lquadrant = Math.floor(L / 90) * 90;
    const RAquadrant = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquadrant - RAquadrant)) / 15;

    // Deklinasi matahari
    const sinDec = 0.39782 * Math.sin(L * DEG_TO_RAD);
    const cosDec = Math.cos(Math.asin(sinDec));

    // Sudut jam lokal matahari
    const cosH = (Math.cos(OFFICIAL_ZENITH * DEG_TO_RAD) - (sinDec * Math.sin(lat * DEG_TO_RAD))) / (cosDec * Math.cos(lat * DEG_TO_RAD));

    // Bila matahari tidak terbit/terbenam (polar), batas aman
    let H: number;
    if (cosH > 1) H = 0;
    else if (cosH < -1) H = 180;
    else H = (isSunrise ? 360 - RAD_TO_DEG * Math.acos(cosH) : RAD_TO_DEG * Math.acos(cosH)) / 15;

    // Waktu lokal rata-rata
    const T = H + RA - (0.06571 * t) - 6.622;

    // Waktu UTC (jam)
    let UT = T - lngHour;
    UT = ((UT % 24) + 24) % 24;

    const hours = Math.floor(UT);
    const minutes = Math.floor((UT - hours) * 60);
    const seconds = Math.round(((UT - hours) * 60 - minutes) * 60);

    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, seconds));
  }

  const sunrise = calcTime(true);
  const sunset = calcTime(false);

  // Hitung jam lokal WIB (+7) atau sesuai lon
  const timeZoneOffsetHours = 7; // WIB
  const utcHours = sunset.getUTCHours() + sunset.getUTCMinutes() / 60;
  const sunsetLocalHour = ((utcHours + timeZoneOffsetHours) % 24);

  return {
    sunrise,
    sunset,
    sunsetLocalHour,
  };
}

/**
 * Mengecek apakah waktu matahari terbenam berada di dalam jendela waktu slot (mis. slot 15.00–18.00).
 */
export function isSunsetInSlot(sunset: Date, slotStartUtc: Date, slotDurationHours = 3): boolean {
  const startMs = slotStartUtc.getTime();
  const endMs = startMs + slotDurationHours * 3600 * 1000;
  const sunsetMs = sunset.getTime();
  return sunsetMs >= startMs && sunsetMs <= endMs;
}
