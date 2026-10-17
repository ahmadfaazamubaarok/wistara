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

  it("chatWithGemini mengirim percakapan multi-turn dengan peran user/model yang valid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse("Halo Farrel, ada yang bisa kubantu?"));
    vi.stubGlobal("fetch", fetchMock);
    const { chatWithGemini } = await import("./gemini");

    const reply = await chatWithGemini({
      query: "Tadi namaku siapa?",
      history: [
        { role: "user", content: "Halo namaku Farrel" },
        { role: "assistant", content: "Halo Farrel! Senang kenalan denganmu." },
      ],
      catalog: CATALOG_ENTRIES,
      focus: ["candi-prambanan"],
    });

    expect(reply).toBe("Halo Farrel, ada yang bisa kubantu?");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.contents).toHaveLength(3);
    expect(body.contents[0]).toEqual({ role: "user", parts: [{ text: "Halo namaku Farrel" }] });
    expect(body.contents[1]).toEqual({ role: "model", parts: [{ text: "Halo Farrel! Senang kenalan denganmu." }] });
    expect(body.contents[2]).toEqual({ role: "user", parts: [{ text: "Tadi namaku siapa?" }] });
    expect(body.generationConfig.temperature).toBe(0.7);
  });

  it("formatHistoryToContents menggabungkan pesan berturut-turut dari peran yang sama dan memastikan diawali user", async () => {
    const { formatHistoryToContents } = await import("./gemini");
    const contents = formatHistoryToContents(
      [
        { role: "assistant", content: "Pesan sambutan pembuka" },
        { role: "user", content: "Halo" },
        { role: "user", content: "Aku mau tanya" },
        { role: "assistant", content: "Iya silakan" },
      ],
      "Tempat sejuk di Jogja apa ya?",
    );

    expect(contents[0].role).toBe("user");
    expect(contents[0].parts[0].text).toContain("Halo\nAku mau tanya");
    expect(contents[1].role).toBe("model");
    expect(contents[1].parts[0].text).toBe("Iya silakan");
    expect(contents[2].role).toBe("user");
    expect(contents[2].parts[0].text).toBe("Tempat sejuk di Jogja apa ya?");
  });
});
