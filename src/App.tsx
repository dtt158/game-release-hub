import { CalendarDays, ExternalLink, Filter, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { sampleGames, sampleLastUpdated, sampleSourceHealth } from "./data/sampleGames";
import { getMonthRange, monthLabel } from "./lib/date";
import { regionLabel } from "./lib/mapping";
import type { GameEntry, LastUpdated, PlatformTab, RegionCode, SourceHealth } from "./types";

const platformTabs: PlatformTab[] = ["PC", "PlayStation", "Xbox", "Nintendo", "Mobile"];
const regionTabs: Array<RegionCode | "ALL"> = ["ALL", "NA", "EU", "CN", "JP", "KR", "GLOBAL"];

interface DataState {
  games: GameEntry[];
  updated: LastUpdated;
  health: SourceHealth;
}

async function loadData(): Promise<DataState> {
  try {
    const [games, updated, health] = await Promise.all([
      fetch("./data/games.json").then((response) => response.json()),
      fetch("./data/last-updated.json").then((response) => response.json()),
      fetch("./data/source-health.json").then((response) => response.json()),
    ]);
    return { games, updated, health };
  } catch {
    return {
      games: sampleGames,
      updated: sampleLastUpdated,
      health: sampleSourceHealth,
    };
  }
}

export function App() {
  const [data, setData] = useState<DataState>({
    games: sampleGames,
    updated: sampleLastUpdated,
    health: sampleSourceHealth,
  });
  const [platform, setPlatform] = useState<PlatformTab>("PC");
  const [region, setRegion] = useState<RegionCode | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("ALL");
  const [futureOnly, setFutureOnly] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    loadData().then(setData);
  }, []);

  const months = useMemo(() => getMonthRange(new Date(), 3, 18), []);
  const genres = useMemo(
    () => ["ALL", ...Array.from(new Set(data.games.flatMap((game) => game.genres))).sort()],
    [data.games],
  );
  const today = new Date().toISOString().slice(0, 10);

  const filteredGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return data.games.filter((game) => {
      const hasPlatform = game.platforms.includes(platform);
      const hasRegion = region === "ALL" || game.releases.some((release) => release.region === region);
      const hasGenre = genre === "ALL" || game.genres.includes(genre);
      const hasQuery =
        !normalizedQuery ||
        [game.title, game.titleOriginal, game.summary, ...game.genres]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));
      const isFuture =
        !futureOnly ||
        game.releases.some((release) => !release.date || release.date >= today);
      return hasPlatform && hasRegion && hasGenre && hasQuery && isFuture;
    });
  }, [data.games, futureOnly, genre, platform, query, region, today]);

  const gamesByMonth = useMemo(() => {
    return months.map((month) => ({
      month,
      games: filteredGames.filter((game) => game.releaseMonth === month),
    }));
  }, [filteredGames, months]);

  const activeMonthGames = gamesByMonth.find((group) => group.month === selectedMonth)?.games ?? [];
  const sourceModeLabel = {
    live: "实时数据",
    partial: "部分数据源",
    fallback: "样例降级",
  }[data.health.mode];

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Game Release Hub</p>
          <h1>游戏发售日历</h1>
          <p className="meta-line">
            <CalendarDays size={16} />
            {data.updated.rangeStart} 至 {data.updated.rangeEnd} · 共 {data.updated.totalGames} 款 ·{" "}
            {sourceModeLabel}
          </p>
        </div>
        <div className={`health-badge health-${data.health.mode}`}>
          <Sparkles size={16} />
          {new Date(data.updated.generatedAt).toLocaleString("zh-CN")}
        </div>
      </section>

      <section className="controls" aria-label="筛选工具">
        <div className="platform-tabs" role="tablist" aria-label="平台">
          {platformTabs.map((tab) => (
            <button
              key={tab}
              className={tab === platform ? "active" : ""}
              onClick={() => setPlatform(tab)}
              role="tab"
              aria-selected={tab === platform}
            >
              {tab}
            </button>
          ))}
        </div>

        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索游戏、简介、类型"
          />
        </label>

        <label className="select-box">
          <Filter size={16} />
          <select value={region} onChange={(event) => setRegion(event.target.value as RegionCode | "ALL")}>
            {regionTabs.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "全部地区" : regionLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label className="select-box">
          <select value={genre} onChange={(event) => setGenre(event.target.value)}>
            {genres.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "全部类型" : item}
              </option>
            ))}
          </select>
        </label>

        <label className="toggle-box">
          <input
            type="checkbox"
            checked={futureOnly}
            onChange={(event) => setFutureOnly(event.target.checked)}
          />
          只看未来
        </label>
      </section>

      <section className="month-strip" aria-label="月份导航">
        {gamesByMonth.map((group) => (
          <button
            key={group.month}
            className={group.month === selectedMonth ? "active" : ""}
            onClick={() => setSelectedMonth(group.month)}
          >
            <span>{monthLabel(group.month)}</span>
            <strong>{group.games.length}</strong>
          </button>
        ))}
      </section>

      <section className="content-grid">
        <aside className="source-panel">
          <h2>数据源状态</h2>
          {data.health.sources.map((source) => (
            <div className="source-row" key={source.name}>
              <span>{source.name}</span>
              <strong>{source.status}</strong>
              <p>{source.message}</p>
            </div>
          ))}
          <p className="attribution">
            数据来源：IGDB · RAWG · Steam。RAWG 数据和图片需保留来源链接；IGDB/RAWG 密钥配置在 GitHub Actions Secrets 中；Steam 数据免费获取，覆盖 US/JP/CN 区。
          </p>
        </aside>

        <section className="month-panel">
          <div className="month-heading">
            <div>
              <p className="eyebrow">{platform}</p>
              <h2>{monthLabel(selectedMonth)}</h2>
            </div>
            <span>{activeMonthGames.length} 款</span>
          </div>

          {activeMonthGames.length === 0 ? (
            <div className="empty-state">当前筛选条件下没有发售信息。</div>
          ) : (
            <div className="game-list">
              {activeMonthGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function GameCard({ game }: { game: GameEntry }) {
  const detailsLink = game.links[0];

  return (
    <article className="game-card">
      <div className="cover-wrap">
        {game.coverUrl ? <img src={game.coverUrl} alt={`${game.title} 封面`} /> : <div className="cover-fallback" />}
      </div>
      <div className="game-body">
        <div className="game-title-row">
          <div>
            <h3>{game.title}</h3>
            {game.titleOriginal && <p className="original-title">{game.titleOriginal}</p>}
          </div>
          {detailsLink && (
            <a href={detailsLink.url} target="_blank" rel="noreferrer" aria-label={`打开 ${game.title} 详情`}>
              <ExternalLink size={18} />
            </a>
          )}
        </div>
        <p className="summary">{game.summary || "暂无简介。"}</p>
        <div className="tag-row">
          {game.genres.slice(0, 4).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="release-grid">
          {game.releases.map((release) => (
            <div className={release.region === "GLOBAL" ? "release global" : "release"} key={release.region}>
              <span>{regionLabel(release.region)}</span>
              <strong>{release.date ?? "待定"}</strong>
            </div>
          ))}
        </div>
        <div className="link-row">
          {game.links.slice(0, 4).map((link) => (
            <a key={`${link.kind}-${link.url}`} href={link.url} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}
