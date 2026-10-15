/**
 * Tujuan pengalihan setelah login. HANYA jalur internal yang diterima, agar tautan
 * /masuk?next=https://situs-jahat.example tidak menjadi open redirect.
 */
export function safeNext(value: unknown, fallback = "/rencana"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 300) return fallback;
  // Harus jalur absolut internal: "/x", bukan "//host" (protocol-relative), "/\host", atau "https://".
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  // Karakter kontrol (termasuk CR/LF untuk header injection) tidak diizinkan.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
