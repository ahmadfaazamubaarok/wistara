import { describe, expect, it, vi } from "vitest";
import fixture from "./__fixtures__/parangtritis-34.02.03.2002.json";
import { BmkgError, fetchBmkgForecast } from "./client";

const ok = () => new Response(JSON.stringify(fixture), { status: 200 });
const status = (code: number) => new Response("x", { status: code });

describe("fetchBmkgForecast", () => {
  it("mengambil dan mem-parse prakiraan", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok());
    const result = await fetchBmkgForecast("34.02.03.2002", { fetchImpl, baseUrl: "https://bmkg.test/x" });
    expect(result.slots).toHaveLength(19);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://bmkg.test/x?adm4=34.02.03.2002");
  });

  it("menolak kode adm4 tidak valid TANPA menghubungi jaringan", async () => {
    const fetchImpl = vi.fn();
    for (const bad of ["", "34.02.03", "34.02.03.2002&x=1", "../etc/passwd", "34.02.03.2002 "]) {
      await expect(fetchBmkgForecast(bad, { fetchImpl })).rejects.toThrow(BmkgError);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("404 tidak diulang dan membawa status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(status(404));
    await expect(fetchBmkgForecast("34.02.03.0002", { fetchImpl })).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("500 diulang sekali lalu berhasil", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(status(500)).mockResolvedValueOnce(ok());
    const result = await fetchBmkgForecast("34.02.03.2002", { fetchImpl });
    expect(result.slots).toHaveLength(19);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gagal terus: berhenti setelah percobaan ulang habis", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(status(503));
    await expect(fetchBmkgForecast("34.02.03.2002", { fetchImpl, retries: 1 })).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("kegagalan jaringan menjadi BmkgError tanpa status", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchBmkgForecast("34.02.03.2002", { fetchImpl, retries: 0 })).rejects.toMatchObject({
      name: "BmkgError",
      status: null,
    });
  });

  it("respons 200 yang bukan JSON ditolak", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>", { status: 200 }));
    await expect(fetchBmkgForecast("34.02.03.2002", { fetchImpl, retries: 0 })).rejects.toThrow(/JSON/);
  });

  it("respons 200 dengan struktur salah ditolak", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await expect(fetchBmkgForecast("34.02.03.2002", { fetchImpl, retries: 0 })).rejects.toThrow(/format/);
  });
});
