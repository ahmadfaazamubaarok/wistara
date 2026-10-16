import { describe, expect, it } from "vitest";
import { calculateSolarTimes, isSunsetInSlot } from "./solar";

describe("solar calculations", () => {
  it("menghitung jam terbit dan terbenam matahari di Yogyakarta secara wajar (~17.30 - 17.50 WIB)", () => {
    // Koordinat Yogyakarta: -7.7956, 110.3695
    const yogyakartaLat = -7.7956;
    const yogyakartaLon = 110.3695;
    const testDate = new Date("2026-10-17T00:00:00Z");

    const solar = calculateSolarTimes(yogyakartaLat, yogyakartaLon, testDate);

    // Di bulan Oktober di Jogja, matahari terbenam sekitar pukul 17.30 - 17.45 WIB
    expect(solar.sunsetLocalHour).toBeGreaterThan(17.3);
    expect(solar.sunsetLocalHour).toBeLessThan(18.0);

    // Terbit sekitar pukul 05.15 - 05.35 WIB
    const sunriseLocalHour = (solar.sunrise.getUTCHours() + solar.sunrise.getUTCMinutes() / 60 + 7) % 24;
    expect(sunriseLocalHour).toBeGreaterThan(5.0);
    expect(sunriseLocalHour).toBeLessThan(5.8);
  });

  it("mendeteksi bahwa sunset jatuh pada slot sore (15.00 - 18.00 WIB)", () => {
    const yogyakartaLat = -7.7956;
    const yogyakartaLon = 110.3695;
    const testDate = new Date("2026-10-17T00:00:00Z");

    const solar = calculateSolarTimes(yogyakartaLat, yogyakartaLon, testDate);

    // Slot sore 15.00 WIB = 08.00 UTC
    const slotSoreUtc = new Date("2026-10-17T08:00:00Z");
    expect(isSunsetInSlot(solar.sunset, slotSoreUtc)).toBe(true);

    // Slot siang 12.00 WIB = 05.00 UTC
    const slotSiangUtc = new Date("2026-10-17T05:00:00Z");
    expect(isSunsetInSlot(solar.sunset, slotSiangUtc)).toBe(false);
  });
});
