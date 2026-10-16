// Parser untuk OASIS Common Alerting Protocol (CAP) v1.2 dari BMKG.
// Mengubah dokumen XML peringatan dini menjadi objek bertipe tanpa ketergantungan paket eksternal.

export type CapAlert = {
  capId: string;
  identifier: string;
  sender: string;
  sent: Date;
  status: string;
  msgType: string;
  scope: string;
  references: string | null;
  event: string;
  urgency: string | null;
  severity: string | null;
  certainty: string | null;
  headline: string | null;
  description: string;
  instruction: string | null;
  effective: Date;
  expires: Date;
  areaDesc: string;
  polygonWkt: string | null;
  admKecamatan: string[];
};

/** Ambil teks di dalam tag XML tertentu pertama kali (case-insensitive, mendukung namespace). */
export function getTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, "i");
  const match = xml.match(regex);
  if (!match) return null;
  return match[1].trim();
}

/** Ambil semua teks di dalam tag XML tertentu (case-insensitive, mendukung namespace). */
export function getAllTagsContent(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, "gi");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const STOPWORDS = new RegExp(
  "^(?:kabupaten|kota|provinsi|daerah|wilayah|khususnya|kondisi|masyarakat|berpotensi|" +
  "terjadi|hujan|lebat|sedang|ringan|petir|kilat|angin|kencang|banjir|longsor|genangan|" +
  "pohon|tumbang|jalan|licin|cuaca|ekstrem|peringatan|dini|wib|wita|wit)$",
  "i"
);

/**
 * Ekstraksi nama-nama kecamatan dari teks areaDesc atau description BMKG.
 * Hanya mengekstraksi dari segmen dengan tanda titik dua (setelah nama kabupaten/kota)
 * atau frasa spesifik "khususnya di ...", bukan kalimat umum.
 */
export function extractKecamatanNames(text: string): string[] {
  const result = new Set<string>();
  if (!text) return [];

  const candidates: string[] = [];

  // Pola 1: Frasa "khususnya di <daftar nama> [titik/kondisi/dsb]"
  const khususMatches = text.matchAll(/khususnya di\s+([^.;]+?)(?=(?:\s*\.\s*(?:Kondisi|Dapat|Masyarakat))|[.;]|$)/gi);
  for (const m of khususMatches) {
    if (m[1]) candidates.push(m[1]);
  }

  // Pola 2: Segmen yang memiliki titik dua setelah unit administratif (Kabupaten/Kota/Kecamatan)
  const sections = text.split(/[;.]+/);
  for (const section of sections) {
    const colonIdx = section.indexOf(":");
    if (colonIdx === -1) continue;
    const header = section.slice(0, colonIdx);
    if (/(?:kabupaten|kota|kab\.|kecamatan|kec\.|wilayah|daerah)/i.test(header)) {
      candidates.push(section.slice(colonIdx + 1));
    }
  }

  for (const candidate of candidates) {
    const rawTokens = candidate.split(/[,/]+/);
    for (const raw of rawTokens) {
      const cleaned = raw
        .replace(/\b(?:dan|serta|wilayah|kecamatan|kec\.|kabupaten|kota)\b/gi, "")
        .replace(/[^a-zA-Z\s-]/g, "")
        .trim();

      if (cleaned.length < 3) continue;
      if (STOPWORDS.test(cleaned)) continue;

      result.add(toTitleCase(cleaned));
    }
  }

  return Array.from(result);
}

/**
 * Ubah satu string koordinat "lat,lon lat,lon ..." menjadi ring koordinat WKT "((lon lat, ...))".
 */
export function parseSinglePolygonRing(polygonText: string): string | null {
  const pairs = polygonText.trim().split(/\s+/).filter(Boolean);
  if (pairs.length < 3) return null;

  const coords = pairs
    .map((pair) => {
      const parts = pair.split(",").map(Number);
      if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
      const [lat, lon] = parts;
      return `${lon} ${lat}`;
    })
    .filter((c): c is string => c !== null);

  if (coords.length < 3) return null;

  // Tutup poligon bila belum tertutup
  if (coords[0] !== coords[coords.length - 1]) {
    coords.push(coords[0]);
  }

  return `(${coords.join(", ")})`;
}

/**
 * Ubah satu atau banyak teks poligon CAP menjadi format WKT PostGIS:
 * - 1 poligon: "POLYGON(((lon lat, ...)))"
 * - >1 poligon: "MULTIPOLYGON(((lon lat, ...)), ((lon lat, ...)))"
 */
export function capPolygonsToWkt(polygonTexts: string[]): string | null {
  const rings = polygonTexts
    .map(parseSinglePolygonRing)
    .filter((r): r is string => r !== null);

  if (rings.length === 0) return null;
  if (rings.length === 1) return `POLYGON(${rings[0]})`;
  return `MULTIPOLYGON(${rings.map((r) => `(${r})`).join(", ")})`;
}

/**
 * Parse string CAP XML menjadi objek CapAlert.
 * Melempar Error bila XML tidak valid atau field penting (identifier, event, description) kosong.
 */
export function parseCapXml(xml: string): CapAlert {
  const identifier = getTagContent(xml, "identifier");
  if (!identifier) throw new Error("CAP XML tidak valid: tag <identifier> tidak ditemukan");

  const sender = getTagContent(xml, "sender") ?? "BMKG";
  const sentStr = getTagContent(xml, "sent");
  const sent = sentStr ? new Date(sentStr) : new Date();

  const status = getTagContent(xml, "status") ?? "Actual";
  const msgType = getTagContent(xml, "msgType") ?? "Alert";
  const scope = getTagContent(xml, "scope") ?? "Public";
  const references = getTagContent(xml, "references");

  // Ambil semua blok <info>, pilih yang berbahasa Indonesia atau blok pertama
  const infoBlocks = getAllTagsContent(xml, "info");
  const primaryInfo = infoBlocks.find((b) => /<language>id<\/language>/i.test(b)) ?? infoBlocks[0] ?? xml;

  const event = getTagContent(primaryInfo, "event") ?? "Peringatan Dini Cuaca";
  const urgency = getTagContent(primaryInfo, "urgency");
  const severity = getTagContent(primaryInfo, "severity");
  const certainty = getTagContent(primaryInfo, "certainty");
  const headline = getTagContent(primaryInfo, "headline");
  const description = getTagContent(primaryInfo, "description");
  if (!description) throw new Error("CAP XML tidak valid: tag <description> tidak ditemukan");

  const instruction = getTagContent(primaryInfo, "instruction");
  const effectiveStr = getTagContent(primaryInfo, "effective");
  const expiresStr = getTagContent(primaryInfo, "expires");

  const effective = effectiveStr ? new Date(effectiveStr) : sent;
  const expires = expiresStr ? new Date(expiresStr) : new Date(effective.getTime() + 4 * 60 * 60 * 1000);

  // Ambil SEMUA blok <area> di dalam primaryInfo
  const areaBlocks = getAllTagsContent(primaryInfo, "area");
  const areaDescs: string[] = [];
  const polygonTexts: string[] = [];

  if (areaBlocks.length === 0) {
    const desc = getTagContent(primaryInfo, "areaDesc");
    if (desc) areaDescs.push(desc);
    const polys = getAllTagsContent(primaryInfo, "polygon");
    polygonTexts.push(...polys);
  } else {
    for (const area of areaBlocks) {
      const desc = getTagContent(area, "areaDesc");
      if (desc) areaDescs.push(desc);
      const polys = getAllTagsContent(area, "polygon");
      polygonTexts.push(...polys);
    }
  }

  const areaDesc = areaDescs.length > 0 ? areaDescs.join("; ") : description;
  const polygonWkt = capPolygonsToWkt(polygonTexts);
  const admKecamatan = extractKecamatanNames(`${areaDesc} ${description}`);

  return {
    capId: identifier,
    identifier,
    sender,
    sent,
    status,
    msgType,
    scope,
    references,
    event,
    urgency,
    severity,
    certainty,
    headline,
    description,
    instruction,
    effective,
    expires,
    areaDesc,
    polygonWkt,
    admKecamatan,
  };
}
