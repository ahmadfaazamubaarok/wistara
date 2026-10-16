import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchBmkgAlertsRss, fetchBmkgCapXml } from "../bmkg/alerts-client";
import { parseCapXml } from "../bmkg/cap-parser";
import { cleanupExpiredAlerts, saveWeatherAlert } from "../db/alerts";

export type SyncAlertsResult = {
  fetched: number;
  synced: number;
  errors: number;
};

const DIY_KEYWORDS = [
  "yogyakarta",
  "jogja",
  "diy",
  "sleman",
  "bantul",
  "gunungkidul",
  "kulon progo",
  "kulonprogo",
];

/**
 * Sinkronisasi data CAP XML tunggal ke basis data weather_alerts.
 */
export async function syncCapAlertFromXml(xml: string) {
  const alert = parseCapXml(xml);
  await saveWeatherAlert(alert);
  return alert;
}

/**
 * Muat fixture sampel peringatan cuaca DIY ke basis data untuk simulasi dev.
 */
export async function seedSampleAlert() {
  const xmlPath = join(process.cwd(), "src/lib/bmkg/__fixtures__/alert-diy.xml");
  const xml = readFileSync(xmlPath, "utf-8");
  return syncCapAlertFromXml(xml);
}

/**
 * Pengambil sungguhan yang membaca feed RSS BMKG nowcast, mengunduh berkas CAP XML
 * yang berdampak pada wilayah DIY (atau seluruh peringatan aktif jika sedikit),
 * menyimpannya ke database, dan membersihkan peringatan usang.
 */
export async function syncBmkgAlerts(options?: {
  rssUrl?: string;
  limit?: number;
}): Promise<SyncAlertsResult> {
  const limit = options?.limit ?? 5;
  const result: SyncAlertsResult = { fetched: 0, synced: 0, errors: 0 };

  try {
    const items = await fetchBmkgAlertsRss(options?.rssUrl);
    result.fetched = items.length;

    // Prioritaskan item yang menyebut wilayah DIY, lalu item lain hingga batas limit
    const diyItems = items.filter((item) => {
      const text = `${item.title} ${item.description} ${item.link}`.toLowerCase();
      return DIY_KEYWORDS.some((kw) => text.includes(kw));
    });

    const otherItems = items.filter((item) => !diyItems.includes(item));
    const toProcess = [...diyItems, ...otherItems].slice(0, limit);

    for (const item of toProcess) {
      try {
        const xml = await fetchBmkgCapXml(item.link);
        await syncCapAlertFromXml(xml);
        result.synced += 1;
      } catch (err) {
        result.errors += 1;
        console.error(`[alerts-sync] Gagal sinkronisasi peringatan ${item.link}:`, err);
      }
    }

    // Bersihkan alert yang sudah kadaluarsa lebih dari 24 jam
    await cleanupExpiredAlerts();
  } catch (err) {
    result.errors += 1;
    console.error("[alerts-sync] Gagal mengambil feed RSS peringatan BMKG:", err);
  }

  return result;
}
