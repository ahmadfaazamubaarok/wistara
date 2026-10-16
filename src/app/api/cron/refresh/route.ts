import { timingSafeEqual } from "node:crypto";
import { errorResponse, withApi } from "@/lib/api/errors";
import { noStoreJson } from "@/lib/api/http";
import { getPool } from "@/lib/db";
import { syncBmkgAlerts } from "@/lib/weather/alerts-sync";
import { warmRegion } from "@/lib/weather/service";

export const dynamic = "force-dynamic";
// Batas fungsi Vercel Hobby 60 detik.
export const maxDuration = 60;

/** Jeda antar-wilayah: ±55 permintaan/menit, di bawah batas BMKG 60/menit/IP. */
const BMKG_GAP_MS = 1100;
/**
 * Berhenti MEMULAI pengambilan baru setelah ini. Satu pengambilan bisa memakan sampai
 * ±16 detik (timeout 8 dtk x 2 percobaan), jadi 40 + 16 tetap di bawah 60 detik.
 */
const START_BUDGET_MS = 40_000;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // tanpa rahasia, endpoint ini tertutup
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// GET /api/cron/refresh (dipanggil Vercel Cron, header Authorization: Bearer $CRON_SECRET).
// Memanaskan cache prakiraan sekaligus menyentuh database agar proyek Supabase
// Free tidak dianggap tidak aktif dan dijeda. Wilayah yang paling lama tidak
// diperbarui dikerjakan lebih dulu; yang tidak sempat ditunda ke refresh saat
// dibaca atau cron berikutnya, tidak pernah dipotong di tengah.
export const GET = withApi(async (request) => {
  if (!authorized(request)) return errorResponse("UNAUTHORIZED", "Tidak berwenang");

  const startedAt = Date.now();

  // PRD F10: Sinkronkan peringatan dini cuaca terkini dari BMKG
  const alertStats = await syncBmkgAlerts().catch((err) => {
    console.error("[cron] Gagal sinkronisasi peringatan BMKG:", err);
    return { fetched: 0, synced: 0, errors: 1 };
  });

  const { rows } = await getPool().query<{ adm4_code: string }>(
    `select d.adm4_code
     from (select distinct adm4_code from destinations) d
     left join forecast_fetches f on f.adm4_code = d.adm4_code
     order by f.last_success_at asc nulls first, d.adm4_code`,
  );

  const counts = { refreshed: 0, failed: 0, skipped: 0, deferred: 0 };
  for (let i = 0; i < rows.length; i += 1) {
    if (Date.now() - startedAt > START_BUDGET_MS) {
      counts.deferred = rows.length - i;
      break;
    }
    counts[await warmRegion(rows[i].adm4_code)] += 1;
    if (i < rows.length - 1) await new Promise((resolve) => setTimeout(resolve, BMKG_GAP_MS));
  }

  return noStoreJson({
    regions: rows.length,
    alerts: alertStats,
    ...counts,
    durationMs: Date.now() - startedAt,
  });
});
