// Klien pengambil RSS dan berkas detail CAP XML peringatan dini cuaca BMKG.
// Sumber resmi BMKG: https://www.bmkg.go.id/alerts/nowcast/id

import { getAllTagsContent, getTagContent } from "./cap-parser";

export type BmkgRssItem = {
  title: string;
  link: string;
  description: string;
  guid: string;
  pubDate: string;
};

export const DEFAULT_BMKG_ALERTS_RSS_URL = "https://www.bmkg.go.id/alerts/nowcast/id";

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "JelajahLokal/0.1 (+https://github.com/alelkohan/wistara)";

/** Ambil dan uraikan daftar item peringatan dari feed RSS BMKG nowcast. */
export async function fetchBmkgAlertsRss(
  rssUrl: string = process.env.BMKG_ALERTS_RSS_URL || DEFAULT_BMKG_ALERTS_RSS_URL,
): Promise<BmkgRssItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!res.ok) {
      throw new Error(`BMKG RSS alerts mengembalikan status HTTP ${res.status}`);
    }

    const xml = await res.text();
    const itemBlocks = getAllTagsContent(xml, "item");

    return itemBlocks.map((block) => {
      const title = getTagContent(block, "title") ?? "";
      const link = getTagContent(block, "link") ?? "";
      const description = getTagContent(block, "description") ?? "";
      const guid = getTagContent(block, "guid") ?? link;
      const pubDate = getTagContent(block, "pubDate") ?? "";

      return {
        title,
        link,
        description,
        guid,
        pubDate,
      };
    }).filter((item) => Boolean(item.link));
  } finally {
    clearTimeout(timer);
  }
}

/** Ambil konten CAP XML dari tautan detail peringatan BMKG. */
export async function fetchBmkgCapXml(capUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(capUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/xml, text/xml, */*",
      },
    });

    if (!res.ok) {
      throw new Error(`Gagal mengambil BMKG CAP XML (${capUrl}): status ${res.status}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
