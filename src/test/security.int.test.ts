import { Client } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as cronRefresh } from "@/app/api/cron/refresh/route";
import { GET as getDestination } from "@/app/api/v1/destinations/[slug]/route";
import { GET as listDestinations } from "@/app/api/v1/destinations/route";
import nextConfig from "../../next.config";
import { call, withSlug } from "./helpers";

afterEach(() => vi.unstubAllEnvs());

describe("injeksi SQL dan input berbahaya", () => {
  const payloads = [
    "'; DROP TABLE destinations; --",
    "' OR '1'='1",
    "\" OR \"\"=\"",
    "1; SELECT pg_sleep(5)",
    "%27%20UNION%20SELECT%20NULL--",
    "\\'; truncate facilities; --",
  ];

  it.each(payloads)("parameter q diperlakukan sebagai teks biasa: %s", async (payload) => {
    const result = await call(listDestinations, `/api/v1/destinations?q=${encodeURIComponent(payload)}`);
    expect(result.status).toBe(200);
    expect((result.json as { destinations: unknown[] }).destinations).toHaveLength(0);
  });

  it("tabel utuh setelah semua payload dicoba", async () => {
    const all = await call(listDestinations, "/api/v1/destinations");
    expect((all.json as { destinations: unknown[] }).destinations).toHaveLength(365);
  });

  it.each(payloads)("slug berbahaya ditolak 400 sebelum menyentuh database: %s", async (payload) => {
    const result = await call(getDestination, "/x", withSlug(payload));
    expect(result.status).toBe(400);
  });
});

describe("hak akses basis data (RLS dan GRANT)", () => {
  async function asRole<T>(role: "anon" | "authenticated", run: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("begin");
      await client.query(`set local role ${role}`);
      return await run(client);
    } finally {
      await client.query("rollback").catch(() => undefined);
      await client.end();
    }
  }

  it.each(["anon", "authenticated"] as const)("%s boleh MEMBACA data referensi publik", async (role) => {
    const count = await asRole(role, async (c) => {
      const { rows } = await c.query("select count(*)::int as n from destinations");
      return rows[0].n;
    });
    expect(count).toBe(365);
  });

  // Anon key Supabase publik di browser dan PostgREST membuka skema public dengannya,
  // jadi tulis ke tabel referensi HARUS ditolak di tingkat basis data.
  it.each(["anon", "authenticated"] as const)("%s TIDAK boleh menulis ke tabel referensi", async (role) => {
    const attempts = [
      "insert into score_profiles (category, w_rain, w_wind, w_heat, w_vis) values ('pantai', 0, 0, 0, 0)",
      "update score_profiles set w_rain = 0",
      "delete from destinations",
      "update destinations set name = 'diretas'",
      "delete from facilities",
      "insert into forecasts (adm4_code, valid_at, local_time, analysis_date) values ('34.02.03.2002', now(), now(), now())",
      "truncate destinations cascade",
    ];
    for (const sql of attempts) {
      await expect(asRole(role, (c) => c.query(sql)), `${role}: ${sql}`).rejects.toThrow(/permission denied|row-level security/i);
    }
  });

  it.each(["anon", "authenticated"] as const)("%s tidak bisa melihat status internal pengambilan BMKG", async (role) => {
    await expect(asRole(role, (c) => c.query("select * from forecast_fetches"))).rejects.toThrow(/permission denied/i);
  });

  it("semua tabel di schema public mengaktifkan RLS", async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      const { rows } = await client.query<{ relname: string }>(
        `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
      );
      expect(rows.map((r) => r.relname)).toEqual([]);
    } finally {
      await client.end();
    }
  });
});

describe("endpoint cron", () => {
  const authed = (value: string) => new Request("http://localhost/api/cron/refresh", { headers: { authorization: value } });

  it("tanpa header Authorization -> 401", async () => {
    const result = await call(cronRefresh, "/api/cron/refresh");
    expect(result.status).toBe(401);
  });

  it.each(["Bearer salah", "test-cron-secret", "Bearer ", "bearer test-cron-secret"])(
    "kredensial salah ditolak: %j",
    async (value) => {
      const response = await cronRefresh(authed(value), undefined);
      expect(response.status).toBe(401);
    },
  );

  it("tanpa CRON_SECRET di server, endpoint tertutup walau header 'cocok'", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await cronRefresh(authed("Bearer "), undefined);
    expect(response.status).toBe(401);
  });
});

describe("header keamanan", () => {
  it("next.config menetapkan header dasar untuk semua rute", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/:path*");
    const headers = Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("geolocation=(self)");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("server tidak membocorkan X-Powered-By", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
