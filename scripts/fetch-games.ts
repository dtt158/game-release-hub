import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sampleGames, sampleLastUpdated, sampleSourceHealth } from "../src/data/sampleGames";
import { getRangeBounds } from "../src/lib/date";
import { mapPlatformName, mapRegionName } from "../src/lib/mapping";
import { mergeGames, monthFromReleases, slugify } from "../src/lib/normalize";
import type { GameEntry, GameLink, LastUpdated, PlatformTab, RegionCode, SourceHealth } from "../src/types";

const outputDir = path.join(process.cwd(), "public", "data");
const now = new Date();
const bounds = getRangeBounds(now, 3, 18);

type SourceStatus = SourceHealth["sources"][number];

interface IgdbReleaseDate {
  id: number;
  date?: number;
  human?: string;
  region?: number;
  platform?: { name?: string };
  game?: {
    id: number;
    name: string;
    slug?: string;
    summary?: string;
    storyline?: string;
    cover?: { url?: string };
    genres?: Array<{ name: string }>;
    platforms?: Array<{ name: string }>;
    websites?: Array<{ url: string; category?: number }>;
  };
}

interface RawgGame {
  id: number;
  name: string;
  slug: string;
  released?: string;
  background_image?: string;
  genres?: Array<{ name: string }>;
  platforms?: Array<{ platform: { name: string } }>;
  stores?: Array<{ store: { name: string; domain?: string } }>;
}

interface RawgDetail {
  description_raw?: string;
  website?: string;
}

async function main() {
  const statuses: SourceStatus[] = [];
  const entries: GameEntry[] = [];

  const igdbEntries = await readIgdb(statuses);
  entries.push(...igdbEntries);

  const rawgEntries = await readRawg(statuses);
  entries.push(...rawgEntries);

  let games = mergeGames(entries).filter((game) => game.platforms.length > 0);
  if (games.length === 0) {
    games = sampleGames;
    statuses.push(...sampleSourceHealth.sources);
  }

  const generatedAt = new Date().toISOString();
  const health: SourceHealth = {
    generatedAt,
    mode: computeMode(statuses, games === sampleGames),
    sources: statuses,
  };
  const updated: LastUpdated = {
    generatedAt,
    rangeStart: bounds.rangeStart,
    rangeEnd: bounds.rangeEnd,
    totalGames: games.length,
  };

  await mkdir(outputDir, { recursive: true });
  await writeJson("games.json", games);
  await writeJson("last-updated.json", updated);
  await writeJson("source-health.json", health);

  console.log(`Generated ${games.length} games in ${health.mode} mode`);
}

async function readIgdb(statuses: SourceStatus[]): Promise<GameEntry[]> {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    statuses.push({
      name: "IGDB",
      status: "missing-key",
      message: "未配置 IGDB_CLIENT_ID / IGDB_CLIENT_SECRET",
    });
    return [];
  }

  try {
    const tokenResponse = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(
        clientSecret,
      )}&grant_type=client_credentials`,
      { method: "POST" },
    );
    if (!tokenResponse.ok) throw new Error(`Twitch auth ${tokenResponse.status}`);
    const token = (await tokenResponse.json()) as { access_token: string };

    const start = Math.floor(new Date(bounds.rangeStart).getTime() / 1000);
    const end = Math.floor(new Date(bounds.rangeEnd).getTime() / 1000);
    const body = [
      "fields date,human,region,platform.name,game.id,game.name,game.slug,game.summary,game.storyline,game.cover.url,game.genres.name,game.platforms.name,game.websites.url,game.websites.category;",
      `where date >= ${start} & date <= ${end} & game.category = 0;`,
      "sort date asc;",
      "limit 500;",
    ].join(" ");

    const response = await fetch("https://api.igdb.com/v4/release_dates", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Client-ID": clientId,
        Authorization: `Bearer ${token.access_token}`,
      },
      body,
    });
    if (!response.ok) throw new Error(`IGDB ${response.status}`);

    const releases = (await response.json()) as IgdbReleaseDate[];
    statuses.push({
      name: "IGDB",
      status: "ok",
      message: `读取 ${releases.length} 条发售日期记录`,
    });

    return releases
      .filter((release) => release.game)
      .map((release) => mapIgdbRelease(release))
      .filter(Boolean) as GameEntry[];
  } catch (error) {
    statuses.push({
      name: "IGDB",
      status: "error",
      message: error instanceof Error ? error.message : "IGDB 请求失败",
    });
    return [];
  }
}

async function readRawg(statuses: SourceStatus[]): Promise<GameEntry[]> {
  const key = process.env.RAWG_API_KEY;
  if (!key) {
    statuses.push({
      name: "RAWG",
      status: "missing-key",
      message: "未配置 RAWG_API_KEY",
    });
    return [];
  }

  try {
    const url = new URL("https://api.rawg.io/api/games");
    url.searchParams.set("key", key);
    url.searchParams.set("dates", `${bounds.rangeStart},${bounds.rangeEnd}`);
    url.searchParams.set("ordering", "released");
    url.searchParams.set("page_size", "40");

    const response = await fetch(url);
    if (!response.ok) throw new Error(`RAWG ${response.status}`);
    const payload = (await response.json()) as { results: RawgGame[] };

    const details = await Promise.all(
      payload.results.slice(0, 30).map(async (game) => {
        try {
          const detailUrl = new URL(`https://api.rawg.io/api/games/${game.id}`);
          detailUrl.searchParams.set("key", key);
          const detailResponse = await fetch(detailUrl);
          return detailResponse.ok ? ((await detailResponse.json()) as RawgDetail) : {};
        } catch {
          return {};
        }
      }),
    );

    statuses.push({
      name: "RAWG",
      status: "ok",
      message: `读取 ${payload.results.length} 款游戏，补充 ${details.length} 条详情`,
    });

    return payload.results.map((game, index) => mapRawgGame(game, details[index] ?? {})).filter(Boolean) as GameEntry[];
  } catch (error) {
    statuses.push({
      name: "RAWG",
      status: "error",
      message: error instanceof Error ? error.message : "RAWG 请求失败",
    });
    return [];
  }
}

function mapIgdbRelease(release: IgdbReleaseDate): GameEntry | null {
  if (!release.game) return null;

  const game = release.game;
  const platforms = normalizePlatformObjects([
    ...(game.platforms?.map((platform) => platform.name) ?? []),
    release.platform?.name,
  ]);
  if (platforms.length === 0) return null;

  const date = release.date ? new Date(release.date * 1000).toISOString().slice(0, 10) : null;
  const releases = [
    {
      region: mapIgdbRegion(release.region),
      date,
      status: date ? "confirmed" : "tbd",
      source: "IGDB",
    },
  ] satisfies GameEntry["releases"];

  return {
    id: `igdb-${game.id}`,
    title: game.name,
    titleOriginal: game.name,
    slug: game.slug ?? slugify(game.name),
    coverUrl: normalizeIgdbImage(game.cover?.url),
    summary: game.summary || game.storyline || "暂无简介。",
    genres: game.genres?.map((genre) => genre.name) ?? [],
    platforms,
    releaseMonth: monthFromReleases(releases),
    releases,
    links: mapIgdbLinks(game.websites ?? []),
    sources: ["IGDB"],
  };
}

function mapRawgGame(game: RawgGame, detail: RawgDetail): GameEntry | null {
  const platforms = normalizePlatformObjects(game.platforms?.map((item) => item.platform.name) ?? []);
  if (platforms.length === 0) return null;

  const links: GameLink[] = [
    { label: "RAWG", url: `https://rawg.io/games/${game.slug}`, kind: "database" },
    ...mapRawgStoreLinks(game),
  ];
  if (detail.website) links.unshift({ label: "官网", url: detail.website, kind: "official" });

  const releases = [
    {
      region: "GLOBAL" as const,
      date: game.released ?? null,
      status: game.released ? "confirmed" as const : "tbd" as const,
      source: "RAWG",
    },
  ];

  return {
    id: `rawg-${game.id}`,
    title: game.name,
    titleOriginal: game.name,
    slug: game.slug,
    coverUrl: game.background_image,
    summary: detail.description_raw || "暂无简介。",
    genres: game.genres?.map((genre) => genre.name) ?? [],
    platforms,
    releaseMonth: monthFromReleases(releases),
    releases,
    links,
    sources: ["RAWG"],
  };
}

function normalizePlatformObjects(names: Array<string | undefined>): PlatformTab[] {
  return Array.from(new Set(names.map((name) => (name ? mapPlatformName(name) : null)).filter(Boolean) as PlatformTab[]));
}

function mapIgdbRegion(region?: number): RegionCode {
  const names: Record<number, string> = {
    1: "Europe",
    2: "North America",
    5: "Japan",
    6: "China",
    8: "Worldwide",
    9: "Korea",
  };
  return mapRegionName(region ? names[region] : null);
}

function normalizeIgdbImage(url?: string): string | undefined {
  if (!url) return undefined;
  const httpsUrl = url.startsWith("//") ? `https:${url}` : url;
  return httpsUrl.replace("t_thumb", "t_cover_big");
}

function mapIgdbLinks(websites: NonNullable<IgdbReleaseDate["game"]>["websites"] = []): GameLink[] {
  const labelByCategory: Record<number, string> = {
    1: "官网",
    13: "Steam",
    16: "Epic",
    17: "GOG",
    18: "Discord",
  };
  return websites
    .filter((site) => site.url)
    .slice(0, 6)
    .map((site) => ({
      label: labelByCategory[site.category ?? 0] ?? "详情",
      url: site.url,
      kind: site.category === 1 ? "official" : "store",
    }));
}

function mapRawgStoreLinks(game: RawgGame): GameLink[] {
  return (game.stores ?? [])
    .filter((item) => item.store.domain)
    .slice(0, 4)
    .map((item) => ({
      label: item.store.name,
      url: `https://${item.store.domain}`,
      kind: "store",
    }));
}

function computeMode(statuses: SourceStatus[], isFallback: boolean): SourceHealth["mode"] {
  if (isFallback) return "fallback";
  const okCount = statuses.filter((source) => source.status === "ok").length;
  if (okCount >= 2) return "live";
  if (okCount === 1) return "partial";
  return "fallback";
}

async function writeJson(filename: string, value: unknown) {
  await writeFile(path.join(outputDir, filename), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
