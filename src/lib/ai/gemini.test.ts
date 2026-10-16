import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG_ENTRIES } from "./test-helpers";

function geminiResponse(text: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status, headers });
}

const context = { todayLabel: "Sabtu, 2026-10-17 (WIB)", catalog: CATALOG_ENTRIES, history: [], focus: [] };

describe("klien Gemini", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("AI_API_KEY", "kunci-uji-rahasia");
    vi.stubEnv("AI_MODEL", "model-uji");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("mengirim kunci lewat header, bukan lewat URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(JSON.stringify({ intent: "recommend" })));
    vi.stubGlobal("fetch", fetchMock);
    const { understandWithGemini } = await import("./gemini");

    await understandWithGemini("besok ke mana", context);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("kunci-uji-rahasia");
    expect(String(url)).not.toContain("key=");
    expect((init as RequestInit).headers).toMatchObject({ "x-goog-api-key": "kunci-uji-rahasia" });
  });

  it("memvalidasi keluaran pemahaman: nilai di luar skema dibuang, bukan dipercaya", async () => {
    const out = {
      intent: "recommend",
      when: { dayOffset: 1, hour: 13, part: "siang" },
      destinationRefs: ["candi-prambanan"],
      categories: ["pantai", "kolam-renang"],
      preferences: ["teduh"],
      days: 1,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse(JSON.stringify(out))));
    const { understandWithGemini } = await import("./gemini");
    const result = await understandWithGemini("besok siang", context);
    expect(result?.intent).toBe("recommend");
    expect(result?.when).toEqual({ dayOffset: 1, hour: 13, part: "siang" });
    expect(result?.destinationRefs).toEqual(["candi-prambanan"]);
    expect(result?.categories).toBeUndefined(); // ada nilai tidak sah -> seluruh bidang dibuang
  });

  it("JSON rusak atau intent tak dikenal = null/diabaikan, tidak melempar galat", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(geminiResponse("bukan json")));
    const { understandWithGemini } = await import("./gemini");
    expect(await understandWithGemini("halo", context)).toBeNull();
  });

  it("429 memutus panggilan berikutnya sementara (hemat kuota), tanpa menunggu lagi", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("kuota", { status: 429, headers: { "retry-after": "30" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { understandWithGemini, isAiAvailable } = await import("./gemini");

    expect(isAiAvailable()).toBe(true);
    expect(await understandWithGemini("halo", context)).toBeNull();
    expect(isAiAvailable()).toBe(false);

    const calls = fetchMock.mock.calls.length;
    expect(await understandWithGemini("halo lagi", context)).toBeNull();
    expect(fetchMock.mock.calls.length).toBe(calls); // tidak memanggil lagi
  });

  it("tanpa kunci: tidak memanggil jaringan sama sekali", async () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { understandWithGemini, rewriteWithGemini, isAiConfigured } = await import("./gemini");
    expect(isAiConfigured()).toBe(false);
    expect(await understandWithGemini("halo", context)).toBeNull();
    expect(await rewriteWithGemini({ query: "x", baseReply: "y", cards: [], notices: [] })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("log galat tidak memuat isi respons atau kunci", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("isi-rahasia-kunci-uji-rahasia", { status: 500 })));
    const { understandWithGemini } = await import("./gemini");
    await understandWithGemini("halo", context);
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("kunci-uji-rahasia");
    expect(logged).toContain("500");
  });
});
