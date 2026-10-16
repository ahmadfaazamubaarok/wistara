import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getAlerts } from "@/app/api/v1/alerts/route";
import { alertListResponseSchema } from "@/lib/api/schemas";
import type { CapAlert } from "@/lib/bmkg/cap-parser";
import { getPool } from "@/lib/db";
import {
  cleanupExpiredAlerts,
  getActiveAlertsForDestination,
  listActiveAlerts,
  saveWeatherAlert,
} from "@/lib/db/alerts";
import { getDestinationBySlug } from "@/lib/db/destinations";
import { call } from "./helpers";

describe("Weather Alerts (F10) Integration Tests", () => {
  beforeEach(async () => {
    // Bersihkan tabel peringatan cuaca sebelum tiap tes
    await getPool().query("delete from weather_alerts");
  });

  const baseAlert: CapAlert = {
    capId: "TEST-ALERT-001",
    identifier: "TEST-ALERT-001",
    sender: "cuaca.ekstrem@bmkg.go.id",
    sent: new Date("2026-10-16T08:00:00Z"),
    status: "Actual",
    msgType: "Alert",
    scope: "Public",
    references: null,
    event: "Hujan Lebat dan Petir",
    urgency: "Immediate",
    severity: "Severe",
    certainty: "Observed",
    headline: "Peringatan Dini Cuaca Bantul: Hujan Lebat Disertai Petir",
    description: "Berpotensi terjadi hujan lebat di Kabupaten Bantul: Kretek, Sanden.",
    instruction: "Waspada potensi banjir lokal dan angin kencang.",
    effective: new Date("2026-10-16T08:30:00Z"),
    expires: new Date("2026-10-16T12:00:00Z"),
    areaDesc: "Kabupaten Bantul: Kretek, Sanden",
    polygonWkt: null,
    admKecamatan: ["Kretek", "Sanden"],
  };

  it("menyimpan alert ke tabel weather_alerts dan dapat dibaca kembali", async () => {
    await saveWeatherAlert(baseAlert);

    const now = new Date("2026-10-16T09:00:00Z"); // di dalam rentang effective..expires
    const active = await listActiveAlerts(now);

    expect(active).toHaveLength(1);
    expect(active[0].capId).toBe("TEST-ALERT-001");
    expect(active[0].event).toBe("Hujan Lebat dan Petir");
    expect(active[0].admKecamatan).toEqual(["Kretek", "Sanden"]);
  });

  it("mengabaikan alert di masa depan (effective > now) dan yang sudah kadaluarsa (expires < now)", async () => {
    await saveWeatherAlert(baseAlert);

    // 1. Sebelum waktu effective (belum berlaku)
    const beforeEffective = new Date("2026-10-16T08:00:00Z");
    const activeBefore = await listActiveAlerts(beforeEffective);
    expect(activeBefore).toHaveLength(0);

    // 2. Setelah waktu expires (sudah selesai)
    const afterExpires = new Date("2026-10-16T12:30:00Z");
    const activeAfter = await listActiveAlerts(afterExpires);
    expect(activeAfter).toHaveLength(0);

    // 3. Saat aktif
    const activeNow = await listActiveAlerts(new Date("2026-10-16T10:00:00Z"));
    expect(activeNow).toHaveLength(1);
  });

  it("mencocokkan destinasi berdasarkan admKecamatan secara ketat tanpa salah cocok pada deskripsi", async () => {
    // Buat alert untuk Kretek, tapi di deskripsi menyebut kata 'Kraton' secara kebetulan
    const alertWithProse: CapAlert = {
      ...baseAlert,
      capId: "TEST-ALERT-KRETEK",
      identifier: "TEST-ALERT-KRETEK",
      description: "Hujan lebat di wilayah pesisir, awan bergerak dari arah Kraton ke selatan Kabupaten Bantul: Kretek.",
      areaDesc: "Kabupaten Bantul: Kretek",
      admKecamatan: ["Kretek"],
    };
    await saveWeatherAlert(alertWithProse);

    const parangtritis = await getDestinationBySlug("pantai-parangtritis");
    const keraton = await getDestinationBySlug("keraton-yogyakarta");

    expect(parangtritis).toBeDefined();
    expect(keraton).toBeDefined();
    expect(parangtritis?.region.kecamatan).toBe("Kretek");
    expect(keraton?.region.kecamatan).toBe("Kraton");

    const now = new Date("2026-10-16T09:00:00Z");

    // Parangtritis (kecamatan: Kretek) HARUS cocok
    const alertsParangtritis = await getActiveAlertsForDestination(parangtritis!, now);
    expect(alertsParangtritis).toHaveLength(1);
    expect(alertsParangtritis[0].capId).toBe("TEST-ALERT-KRETEK");

    // Keraton (kecamatan: Kraton) TIDAK BOLEH cocok meskipun kata 'Kraton' ada dalam deskripsi
    const alertsKeraton = await getActiveAlertsForDestination(keraton!, now);
    expect(alertsKeraton).toHaveLength(0);
  });

  it("mencocokkan koordinat destinasi dengan poligon spasial PostGIS ST_Intersects", async () => {
    // Parangtritis berlokasi di lon: 110.363, lat: -8.025
    // Buat poligon kotak di sekitar Parangtritis
    const boxWkt = "POLYGON((110.30 -8.05, 110.40 -8.05, 110.40 -8.00, 110.30 -8.00, 110.30 -8.05))";

    const spatialAlert: CapAlert = {
      ...baseAlert,
      capId: "TEST-ALERT-SPATIAL",
      identifier: "TEST-ALERT-SPATIAL",
      areaDesc: "Wilayah Pesisir Selatan",
      admKecamatan: [], // Kosongkan kecamatan untuk menguji murni pencocokan spasial
      polygonWkt: boxWkt,
    };
    await saveWeatherAlert(spatialAlert);

    const parangtritis = await getDestinationBySlug("pantai-parangtritis");
    const indrayanti = await getDestinationBySlug("pantai-indrayanti");

    const now = new Date("2026-10-16T09:00:00Z");

    const alertsParangtritis = await getActiveAlertsForDestination(parangtritis!, now);
    expect(alertsParangtritis).toHaveLength(1);
    expect(alertsParangtritis[0].capId).toBe("TEST-ALERT-SPATIAL");

    const alertsIndrayanti = await getActiveAlertsForDestination(indrayanti!, now);
    expect(alertsIndrayanti).toHaveLength(0);
  });

  it("mendukung MULTIPOLYGON spasial untuk area dengan banyak poligon", async () => {
    const multiWkt =
      "MULTIPOLYGON(((110.30 -8.05, 110.40 -8.05, 110.40 -8.00, 110.30 -8.00, 110.30 -8.05)), ((110.35 -7.80, 110.40 -7.80, 110.40 -7.75, 110.35 -7.75, 110.35 -7.80)))";

    const multiAlert: CapAlert = {
      ...baseAlert,
      capId: "TEST-ALERT-MULTI",
      identifier: "TEST-ALERT-MULTI",
      admKecamatan: [],
      polygonWkt: multiWkt,
    };
    await saveWeatherAlert(multiAlert);

    const parangtritis = await getDestinationBySlug("pantai-parangtritis");
    const now = new Date("2026-10-16T09:00:00Z");

    const alerts = await getActiveAlertsForDestination(parangtritis!, now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].capId).toBe("TEST-ALERT-MULTI");
  });

  it("menangani pesan Cancel dan Update dengan benar", async () => {
    // 1. Simpan alert awal
    await saveWeatherAlert(baseAlert);

    const now = new Date("2026-10-16T09:00:00Z");
    let active = await listActiveAlerts(now);
    expect(active).toHaveLength(1);

    // 2. Terima pesan Cancel yang merujuk TEST-ALERT-001
    const cancelAlert: CapAlert = {
      ...baseAlert,
      capId: "TEST-CANCEL-001",
      identifier: "TEST-CANCEL-001",
      msgType: "Cancel",
      references: "cuaca.ekstrem@bmkg.go.id,TEST-ALERT-001,2026-10-16T08:00:00Z",
      sent: new Date("2026-10-16T09:30:00Z"),
      effective: new Date("2026-10-16T09:30:00Z"),
      expires: new Date("2026-10-16T09:30:00Z"),
    };
    await saveWeatherAlert(cancelAlert);

    // Alert awal harus langsung tidak aktif
    active = await listActiveAlerts(now);
    expect(active).toHaveLength(0);
  });

  it("endpoint GET /api/v1/alerts tidak menampilkan demo alert di lingkungan production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const res = await call(getAlerts, "/api/v1/alerts?destination=pantai-parangtritis&demo=1");
      expect(res.status).toBe(200);

      const body = alertListResponseSchema.parse(res.json);
      // Di produksi, parameter demo=1 tidak boleh menghasilkan banner BMKG karangan
      expect(body.total).toBe(0);
      expect(body.alerts).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("membersihkan alert yang sudah kadaluarsa dengan cleanupExpiredAlerts", async () => {
    const expiredAlert: CapAlert = {
      ...baseAlert,
      capId: "OLD-ALERT-001",
      identifier: "OLD-ALERT-001",
      effective: new Date("2026-10-10T00:00:00Z"),
      expires: new Date("2026-10-10T04:00:00Z"),
    };
    await saveWeatherAlert(expiredAlert);
    await saveWeatherAlert(baseAlert);

    const deleted = await cleanupExpiredAlerts(new Date("2026-10-12T00:00:00Z"));
    expect(deleted).toBe(1);

    const pool = getPool();
    const { rows } = await pool.query("select cap_id from weather_alerts");
    expect(rows.map((r) => r.cap_id)).toEqual(["TEST-ALERT-001"]);
  });
});
