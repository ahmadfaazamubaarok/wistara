import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext (cegah open redirect setelah login)", () => {
  it.each([
    ["/rencana", "/rencana"],
    ["/destinasi/pantai-baron", "/destinasi/pantai-baron"],
    ["/destinasi/keraton-yogyakarta?x=1#slot", "/destinasi/keraton-yogyakarta?x=1#slot"],
    ["/", "/"],
  ])("jalur internal diterima: %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "https://situs-jahat.example",
    "http://localhost:3000/rencana",
    "//situs-jahat.example",
    "///situs-jahat.example",
    "/\\situs-jahat.example",
    "\\\\situs-jahat.example",
    "javascript:alert(1)",
    "rencana", // bukan jalur absolut
    "/rencana\r\nSet-Cookie: x=1",
    "/rencana\u0000",
    "",
    " /rencana",
  ])("diganti jalur bawaan: %j", (input) => {
    expect(safeNext(input)).toBe("/rencana");
  });

  it("nilai bukan teks atau terlalu panjang diganti jalur bawaan", () => {
    expect(safeNext(null)).toBe("/rencana");
    expect(safeNext(undefined)).toBe("/rencana");
    expect(safeNext(["/x"])).toBe("/rencana");
    expect(safeNext(`/${"a".repeat(400)}`)).toBe("/rencana");
  });

  it("jalur bawaan bisa diubah", () => {
    expect(safeNext("https://x.test", "/")).toBe("/");
  });
});
