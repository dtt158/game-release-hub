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

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

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

interface SteamAppDetail {
  name: string;
  steam_appid: number;
  short_description: string;
  header_image: string;
  genres?: Array<{ id: string; description: string }>;
  release_date?: { coming_soon: boolean; date: string };
  platforms?: { windows: boolean; mac: boolean; linux: boolean };
  website?: string | null;
}

interface SteamFeaturedItem {
  id: number;
  name: string;
  large_capsule_image: string;
  small_capsule_image: string;
  header_image: string;
  windows_available: boolean;
  mac_available: boolean;
  linux_available: boolean;
}

// Famitsu types — derived from __NEXT_DATA__ inspection
interface FamitsuTitleItem {
  id: number;
  platform: string;
  nameJa: string;
  thumbnail: string;
  releaseDateOrder: number; // YYYYMMDD as number
  releaseDateType: string;  // "Confirmed" | "TBD" | etc.
  gameTitleId: number;
  isMain: boolean;
  isDownload: boolean;
  isCeroZ: boolean;
  isGlobal: boolean;
}

interface FamitsuGameTitle {
  gameTitleId: number;
  gameTitlePlatForms: string[];
  gameTitleItems: FamitsuTitleItem[];
}

interface FamitsuDateGroup {
  releaseDateFull: string;
  releaseDateOrder: number;
  gameTitles: FamitsuGameTitle[];
}

interface FamitsuNextData {
  props: {
    pageProps: {
      scheduleTitleGroupsData: {
        data: Record<string, FamitsuDateGroup>;
        totalTitles: number;
      };
    };
  };
}

// TheGamesDB types
interface TgdbUpdate {
  id: number;
  edit_datetime: string;
}

interface TgdbGame {
  id: number;
  game_title: string;
  release_date?: string | null;
  platform?: number | null;
  overview?: string | null;
  genres?: number[] | null;
}

interface TgdbBoxartItem {
  id: number;
  type: string;
  side: string;
  filename: string;
}

interface TgdbInclude {
  boxart?: {
    base_url: { medium: string; thumb: string };
    data: Record<string, TgdbBoxartItem[]>;
  };
  platform?: {
    data: Record<string, { id: number; name: string; alias: string }>;
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const statuses: SourceStatus[] = [];
  const entries: GameEntry[] = [];

  const [igdbEntries, rawgEntries, steamEntries, famitsuEntries, tgdbEntries] = await Promise.all([
    readIgdb(statuses),
    readRawg(statuses),
    readSteam(statuses),
    readFamitsu(statuses),
    readTheGamesDB(statuses),
  ]);
  entries.push(...igdbEntries, ...rawgEntries, ...steamEntries, ...famitsuEntries, ...tgdbEntries);

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

// ---------------------------------------------------------------------------
// IGDB — paginated, up to 1500 release-date records
// ---------------------------------------------------------------------------

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
    const headers = {
      Accept: "application/json",
      "Client-ID": clientId,
      Authorization: `Bearer ${token.access_token}`,
    };

    const allReleases: IgdbReleaseDate[] = [];
    const pageSize = 500;
    const maxPages = 3;

    for (let page = 0; page < maxPages; page++) {
      const body = [
        "fields date,human,region,platform.name,game.id,game.name,game.slug,game.summary,game.storyline,game.cover.url,game.genres.name,game.platforms.name,game.websites.url,game.websites.category;",
        `where date >= ${start} & date <= ${end} & game.category = 0;`,
        "sort date asc;",
        `limit ${pageSize};`,
        `offset ${page * pageSize};`,
      ].join(" ");

      const response = await fetch("https://api.igdb.com/v4/release_dates", {
        method: "POST",
        headers,
        body,
      });
      if (!response.ok) throw new Error(`IGDB page ${page}: ${response.status}`);

      const releases = (await response.json()) as IgdbReleaseDate[];
      allReleases.push(...releases);
      if (releases.length < pageSize) break;
    }

    statuses.push({
      name: "IGDB",
      status: "ok",
      message: `读取 ${allReleases.length} 条发售日期记录`,
    });

    return allReleases
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

// ---------------------------------------------------------------------------
// RAWG — multi-page, up to ~120 games
// ---------------------------------------------------------------------------

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
    const allGames: RawgGame[] = [];
    const maxPages = 3;

    for (let page = 1; page <= maxPages; page++) {
      const url = new URL("https://api.rawg.io/api/games");
      url.searchParams.set("key", key);
      url.searchParams.set("dates", `${bounds.rangeStart},${bounds.rangeEnd}`);
      url.searchParams.set("ordering", "released");
      url.searchParams.set("page_size", "40");
      url.searchParams.set("page", String(page));

      const response = await fetch(url);
      if (!response.ok) break;
      const payload = (await response.json()) as { results: RawgGame[]; next: string | null };
      allGames.push(...payload.results);
      if (!payload.next) break;
    }

    const details = await Promise.all(
      allGames.slice(0, 60).map(async (game) => {
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
      message: `读取 ${allGames.length} 款游戏，补充 ${details.length} 条详情`,
    });

    return allGames.map((game, index) => mapRawgGame(game, details[index] ?? {})).filter(Boolean) as GameEntry[];
  } catch (error) {
    statuses.push({
      name: "RAWG",
      status: "error",
      message: error instanceof Error ? error.message : "RAWG 请求失败",
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Steam — free, no API key, fetches "coming soon" from US/JP/CN regions
// ---------------------------------------------------------------------------

async function readSteam(statuses: SourceStatus[]): Promise<GameEntry[]> {
  try {
    const regions = ["us", "jp", "cn"];
    const seen = new Set<number>();
    const itemIds: number[] = [];

    for (const cc of regions) {
      try {
        const response = await fetch(
          `https://store.steampowered.com/api/featuredcategories/?cc=${cc}&l=schinese`,
        );
        if (!response.ok) continue;
        const data = (await response.json()) as Record<string, { items?: SteamFeaturedItem[] }>;
        for (const item of data.coming_soon?.items ?? []) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            itemIds.push(item.id);
          }
        }
      } catch {
        continue;
      }
    }

    if (itemIds.length === 0) {
      statuses.push({
        name: "Steam",
        status: "error",
        message: "未能获取 Steam 即将发售列表",
      });
      return [];
    }

    const entries: GameEntry[] = [];
    for (const appId of itemIds.slice(0, 30)) {
      try {
        await sleep(250);
        const response = await fetch(
          `https://store.steampowered.com/api/appdetails?appids=${appId}&l=schinese`,
        );
        if (!response.ok) continue;
        const data = (await response.json()) as Record<
          string,
          { success: boolean; data?: SteamAppDetail }
        >;
        const wrapper = data[String(appId)];
        if (!wrapper?.success || !wrapper.data) continue;

        const entry = mapSteamApp(wrapper.data);
        if (entry) entries.push(entry);
      } catch {
        continue;
      }
    }

    statuses.push({
      name: "Steam",
      status: "ok",
      message: `读取 ${entries.length} 款即将发售游戏（${regions.join("/")} 区）`,
    });
    return entries;
  } catch (error) {
    statuses.push({
      name: "Steam",
      status: "error",
      message: error instanceof Error ? error.message : "Steam 请求失败",
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Famitsu (ファミ通) — JP release calendar via __NEXT_DATA__ JSON, no key
// ---------------------------------------------------------------------------

async function readFamitsu(statuses: SourceStatus[]): Promise<GameEntry[]> {
  try {
    // Build list of YYYYMM strings: current month + next 6
    const monthsToFetch: string[] = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      monthsToFetch.push(
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`,
      );
    }

    const allEntries: GameEntry[] = [];
    let fetchedMonths = 0;

    for (const yyyymm of monthsToFetch) {
      await sleep(400);
      try {
        const response = await fetch(`https://www.famitsu.com/schedule/all-platforms/${yyyymm}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; GameReleaseHub/1.0)",
            "Accept-Language": "ja,en;q=0.5",
          },
        });
        if (!response.ok) continue;

        const html = await response.text();
        const match = html.match(
          /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
        );
        if (!match) continue;

        const nextData = JSON.parse(match[1]) as FamitsuNextData;
        const schedData = nextData.props?.pageProps?.scheduleTitleGroupsData;
        if (!schedData?.data) continue;

        fetchedMonths++;
        for (const dateGroup of Object.values(schedData.data)) {
          for (const gameTitle of dateGroup.gameTitles ?? []) {
            const entry = mapFamitsuTitle(gameTitle, dateGroup.releaseDateOrder);
            if (entry) allEntries.push(entry);
          }
        }
      } catch {
        continue;
      }
    }

    if (allEntries.length === 0) {
      statuses.push({
        name: "Famitsu",
        status: "error",
        message: "未能从 Famitsu 解析到发售数据",
      });
      return [];
    }

    statuses.push({
      name: "Famitsu",
      status: "ok",
      message: `读取 ${allEntries.length} 款游戏（JP 发售日历，共 ${fetchedMonths} 个月）`,
    });
    return allEntries;
  } catch (error) {
    statuses.push({
      name: "Famitsu",
      status: "error",
      message: error instanceof Error ? error.message : "Famitsu 请求失败",
    });
    return [];
  }
}

function mapFamitsuTitle(
  gameTitle: FamitsuGameTitle,
  releaseDateOrder: number,
): GameEntry | null {
  // Only use the physical main release to avoid duplicate editions
  const mainItems = gameTitle.gameTitleItems.filter((i) => i.isMain && !i.isDownload);
  if (mainItems.length === 0) {
    // If no physical main, fall back to any main item
    const anyMain = gameTitle.gameTitleItems.find((i) => i.isMain);
    if (!anyMain) return null;
    mainItems.push(anyMain);
  }

  const platforms = normalizePlatformObjects(gameTitle.gameTitlePlatForms);
  if (platforms.length === 0) return null;

  const primary = mainItems[0];
  const ds = String(releaseDateOrder); // YYYYMMDD
  const date = ds.length === 8
    ? `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`
    : null;

  const releases = [
    {
      region: "JP" as RegionCode,
      date,
      status: primary.releaseDateType === "Confirmed" ? ("confirmed" as const) : ("tbd" as const),
      source: "Famitsu",
    },
  ] satisfies GameEntry["releases"];

  return {
    id: `fami-${gameTitle.gameTitleId}`,
    title: primary.nameJa,
    titleOriginal: primary.nameJa,
    slug: slugify(primary.nameJa),
    coverUrl: primary.thumbnail || undefined,
    summary: "暂无简介。",
    genres: [],
    platforms,
    releaseMonth: monthFromReleases(releases),
    releases,
    links: [
      { label: "Famitsu", url: "https://www.famitsu.com/schedule/", kind: "database" },
    ],
    sources: ["Famitsu"],
  };
}

// ---------------------------------------------------------------------------
// TheGamesDB — open game database, free API key (thegamesdb.net)
// Strategy: fetch recently updated entries, keep those in our date range
// ---------------------------------------------------------------------------

async function readTheGamesDB(statuses: SourceStatus[]): Promise<GameEntry[]> {
  const key = process.env.THEGAMESDB_API_KEY;
  if (!key) {
    statuses.push({
      name: "TheGamesDB",
      status: "missing-key",
      message: "未配置 THEGAMESDB_API_KEY（thegamesdb.net 免费申请）",
    });
    return [];
  }

  try {
    // Collect game IDs updated in the last 180 days across multiple pages
    const since = Math.floor(Date.now() / 1000) - 180 * 24 * 3600;
    const allIds: number[] = [];
    let page = 1;

    while (allIds.length < 300) {
      const url = new URL("https://api.thegamesdb.net/v1/Games/Updates");
      url.searchParams.set("apikey", key);
      url.searchParams.set("time", String(since));
      url.searchParams.set("page", String(page));

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`TheGamesDB Updates ${resp.status}`);
      const data = (await resp.json()) as {
        code: number;
        data: { count: number; updates: TgdbUpdate[] };
        pages: { next?: string | null };
      };
      if (data.code !== 200) throw new Error(`TheGamesDB: ${data.code}`);

      allIds.push(...data.data.updates.map((u) => u.id));
      if (!data.pages?.next || data.data.updates.length === 0) break;
      page++;
      await sleep(500);
    }

    if (allIds.length === 0) {
      statuses.push({ name: "TheGamesDB", status: "ok", message: "近期无更新数据" });
      return [];
    }

    // Batch fetch details in chunks of 50
    const entries: GameEntry[] = [];
    const chunkSize = 50;
    for (let i = 0; i < Math.min(allIds.length, 200); i += chunkSize) {
      const chunk = allIds.slice(i, i + chunkSize);
      await sleep(500);

      const detailUrl = new URL("https://api.thegamesdb.net/v1/Games/ByGameID");
      detailUrl.searchParams.set("apikey", key);
      detailUrl.searchParams.set("id", chunk.join(","));
      detailUrl.searchParams.set("fields", "game_title,release_date,platform,overview,genres");
      detailUrl.searchParams.set("include", "boxart,platform");

      const detailResp = await fetch(detailUrl);
      if (!detailResp.ok) continue;

      const detailData = (await detailResp.json()) as {
        code: number;
        data: { games: Record<string, TgdbGame>; count: number };
        include: TgdbInclude;
      };
      if (detailData.code !== 200) continue;

      for (const game of Object.values(detailData.data.games)) {
        const entry = mapTgdbGame(game, detailData.include);
        if (entry) entries.push(entry);
      }
    }

    statuses.push({
      name: "TheGamesDB",
      status: "ok",
      message: `读取 ${entries.length} 款发售日期在范围内的游戏`,
    });
    return entries;
  } catch (error) {
    statuses.push({
      name: "TheGamesDB",
      status: "error",
      message: error instanceof Error ? error.message : "TheGamesDB 请求失败",
    });
    return [];
  }
}

function mapTgdbGame(game: TgdbGame, include: TgdbInclude): GameEntry | null {
  if (!game.release_date) return null;

  const date = game.release_date.slice(0, 10);
  if (date < bounds.rangeStart || date > bounds.rangeEnd) return null;

  const platformInfo = game.platform != null
    ? include.platform?.data[String(game.platform)]
    : null;
  const platforms = platformInfo ? normalizePlatformObjects([platformInfo.name]) : [];
  if (platforms.length === 0) return null;

  const boxartList = include.boxart?.data[String(game.id)] ?? [];
  const front = boxartList.find((b) => b.type === "front" || b.side === "front");
  const baseUrl = include.boxart?.base_url.medium;
  const coverUrl = front && baseUrl ? `${baseUrl}${front.filename}` : undefined;

  const releases = [
    { region: "GLOBAL" as RegionCode, date, status: "confirmed" as const, source: "TheGamesDB" },
  ] satisfies GameEntry["releases"];

  return {
    id: `tgdb-${game.id}`,
    title: game.game_title,
    titleOriginal: game.game_title,
    slug: slugify(game.game_title),
    coverUrl,
    summary: game.overview || "暂无简介。",
    genres: [],
    platforms,
    releaseMonth: monthFromReleases(releases),
    releases,
    links: [
      { label: "TheGamesDB", url: `https://thegamesdb.net/game.php?id=${game.id}`, kind: "database" },
    ],
    sources: ["TheGamesDB"],
  };
}

// ---------------------------------------------------------------------------
// Shared mappers (IGDB / RAWG / Steam)
// ---------------------------------------------------------------------------

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
      status: game.released ? ("confirmed" as const) : ("tbd" as const),
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

function mapSteamApp(detail: SteamAppDetail): GameEntry | null {
  const platforms: PlatformTab[] = [];
  if (detail.platforms?.windows || detail.platforms?.mac || detail.platforms?.linux) {
    platforms.push("PC");
  }
  if (platforms.length === 0) return null;

  let date: string | null = null;
  let releaseStatus: "confirmed" | "tbd" = "tbd";
  if (detail.release_date?.date) {
    date = parseSteamDate(detail.release_date.date);
    if (date) releaseStatus = "confirmed";
  }

  const releases = [
    { region: "GLOBAL" as RegionCode, date, status: releaseStatus, source: "Steam" },
  ] satisfies GameEntry["releases"];

  const links: GameLink[] = [
    { label: "Steam", url: `https://store.steampowered.com/app/${detail.steam_appid}`, kind: "store" },
  ];
  if (detail.website) {
    links.unshift({ label: "官网", url: detail.website, kind: "official" });
  }

  return {
    id: `steam-${detail.steam_appid}`,
    title: detail.name,
    titleOriginal: detail.name,
    slug: slugify(detail.name),
    coverUrl: detail.header_image,
    summary: detail.short_description || "暂无简介。",
    genres: detail.genres?.map((g) => g.description) ?? [],
    platforms,
    releaseMonth: monthFromReleases(releases),
    releases,
    links,
    sources: ["Steam"],
  };
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function parseSteamDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const cnMatch = dateStr.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (cnMatch) {
    return `${cnMatch[1]}-${cnMatch[2].padStart(2, "0")}-${cnMatch[3].padStart(2, "0")}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePlatformObjects(names: Array<string | undefined>): PlatformTab[] {
  return Array.from(
    new Set(names.map((name) => (name ? mapPlatformName(name) : null)).filter(Boolean) as PlatformTab[]),
  );
}

function mapIgdbRegion(region?: number): RegionCode {
  const names: Record<number, string> = {
    1: "Europe",
    2: "North America",
    3: "Australia",
    4: "New Zealand",
    5: "Japan",
    6: "China",
    7: "Asia",
    8: "Worldwide",
    9: "Korea",
    10: "Brazil",
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
