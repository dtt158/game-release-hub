import type { GameEntry, LastUpdated, SourceHealth } from "../types";

export const sampleGames: GameEntry[] = [
  {
    id: "sample-death-stranding-2",
    title: "死亡搁浅 2：冥滩之上",
    titleOriginal: "Death Stranding 2: On the Beach",
    slug: "death-stranding-2-on-the-beach",
    coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co8x2t.jpg",
    summary: "山姆再度踏上连接世界的旅程，在更广阔的荒野、据点和异常气候中重建人类之间的联系。",
    genres: ["动作", "冒险"],
    platforms: ["PlayStation"],
    releaseMonth: "2025-06",
    releases: [
      { region: "NA", date: "2025-06-26", status: "confirmed", source: "sample" },
      { region: "EU", date: "2025-06-26", status: "confirmed", source: "sample" },
      { region: "JP", date: "2025-06-26", status: "confirmed", source: "sample" },
      { region: "KR", date: "2025-06-26", status: "confirmed", source: "sample" },
    ],
    links: [
      { label: "官网", url: "https://www.kojimaproductions.jp/", kind: "official" },
      { label: "PlayStation Store", url: "https://www.playstation.com/", kind: "store" },
    ],
    sources: ["Sample"],
  },
  {
    id: "sample-grand-theft-auto-vi",
    title: "侠盗猎车手 VI",
    titleOriginal: "Grand Theft Auto VI",
    slug: "grand-theft-auto-vi",
    coverUrl: "https://media.rawg.io/media/games/7e7/7e7e8a10b4fdc7219c7f1d5c24ef6f55.jpg",
    summary: "回到霓虹与海风交织的罪恶城，双主角故事线围绕抢劫、逃亡与城市势力展开。",
    genres: ["动作", "开放世界"],
    platforms: ["PlayStation", "Xbox"],
    releaseMonth: "2026-05",
    releases: [
      { region: "NA", date: "2026-05-26", status: "confirmed", source: "sample" },
      { region: "EU", date: "2026-05-26", status: "confirmed", source: "sample" },
      { region: "JP", date: null, status: "tbd", source: "sample" },
      { region: "KR", date: null, status: "tbd", source: "sample" },
    ],
    links: [
      { label: "Rockstar", url: "https://www.rockstargames.com/", kind: "official" },
    ],
    sources: ["Sample"],
  },
  {
    id: "sample-silk-song",
    title: "空洞骑士：丝之歌",
    titleOriginal: "Hollow Knight: Silksong",
    slug: "hollow-knight-silksong",
    coverUrl: "https://media.rawg.io/media/games/0b1/0b1e998e1f38d279f30d6c81c9e9ad8b.jpg",
    summary: "扮演 Hornet 探索全新的昆虫王国，在高速战斗和平台跳跃中揭开朝圣之路的秘密。",
    genres: ["动作", "类银河战士恶魔城", "独立"],
    platforms: ["PC", "PlayStation", "Xbox", "Nintendo"],
    releaseMonth: "2026-09",
    releases: [
      { region: "GLOBAL", date: null, status: "tbd", source: "sample" },
    ],
    links: [
      { label: "官网", url: "https://hollowknightsilksong.com/", kind: "official" },
      { label: "Steam", url: "https://store.steampowered.com/", kind: "store" },
    ],
    sources: ["Sample"],
  },
  {
    id: "sample-wuthering-waves",
    title: "鸣潮",
    titleOriginal: "Wuthering Waves",
    slug: "wuthering-waves",
    coverUrl: "https://media.rawg.io/media/games/6fb/6fbd390fd0728c190bd36f7d5d9d6b2b.jpg",
    summary: "开放世界动作 RPG，围绕共鸣者、残象与灾后世界展开，持续推出新区域与角色版本。",
    genres: ["动作角色扮演", "开放世界"],
    platforms: ["PC", "Mobile"],
    releaseMonth: "2026-07",
    releases: [
      { region: "CN", date: "2026-07-01", status: "confirmed", source: "sample" },
      { region: "NA", date: "2026-07-01", status: "confirmed", source: "sample" },
      { region: "JP", date: "2026-07-01", status: "confirmed", source: "sample" },
      { region: "KR", date: "2026-07-01", status: "confirmed", source: "sample" },
    ],
    links: [
      { label: "官网", url: "https://wutheringwaves.kurogames.com/", kind: "official" },
      { label: "TapTap", url: "https://www.taptap.cn/", kind: "store" },
    ],
    sources: ["Sample"],
  },
  {
    id: "sample-dragon-quest-xii",
    title: "勇者斗恶龙 XII：命运之炎",
    titleOriginal: "ドラゴンクエストXII 選ばれし運命の炎",
    slug: "dragon-quest-xii",
    summary: "系列全新正统续作，采用暗色调和更成熟的剧情路线，首次引入实时指令式战斗系统。",
    genres: ["角色扮演", "JRPG"],
    platforms: ["PlayStation", "Xbox", "PC", "Nintendo"],
    releaseMonth: "2026-12",
    releases: [
      { region: "JP", date: null, status: "tbd", source: "sample" },
      { region: "NA", date: null, status: "tbd", source: "sample" },
      { region: "EU", date: null, status: "tbd", source: "sample" },
    ],
    links: [
      { label: "官网", url: "https://www.dragonquest.jp/", kind: "official" },
    ],
    sources: ["Sample"],
  },
  {
    id: "sample-persona-6",
    title: "女神异闻录 6",
    titleOriginal: "ペルソナ6",
    slug: "persona-6",
    summary: "Atlus 旗下人气 RPG 系列最新正统续作，全新主角与伙伴在都市与异世界之间展开冒险。",
    genres: ["角色扮演", "JRPG", "社交模拟"],
    platforms: ["PlayStation", "PC"],
    releaseMonth: "2027-03",
    releases: [
      { region: "JP", date: null, status: "tbd", source: "sample" },
      { region: "NA", date: null, status: "tbd", source: "sample" },
    ],
    links: [
      { label: "Atlus", url: "https://atlus.com/", kind: "official" },
    ],
    sources: ["Sample"],
  },
  {
    id: "sample-mh-wilds-expansion",
    title: "怪物猎人：荒野 大型扩展",
    titleOriginal: "モンスターハンターワイルズ 超大型拡張コンテンツ",
    slug: "monster-hunter-wilds-expansion",
    summary: "《怪物猎人：荒野》首个超大型扩展内容，加入新区域、新怪物群与 G 级难度。",
    genres: ["动作", "角色扮演", "多人合作"],
    platforms: ["PlayStation", "Xbox", "PC"],
    releaseMonth: "2026-11",
    releases: [
      { region: "JP", date: null, status: "tbd", source: "sample" },
      { region: "GLOBAL", date: null, status: "tbd", source: "sample" },
    ],
    links: [
      { label: "官网", url: "https://www.monsterhunter.com/wilds/", kind: "official" },
      { label: "Steam", url: "https://store.steampowered.com/", kind: "store" },
    ],
    sources: ["Sample"],
  },
];

export const sampleLastUpdated: LastUpdated = {
  generatedAt: new Date().toISOString(),
  rangeStart: "2026-03-01",
  rangeEnd: "2027-12-31",
  totalGames: sampleGames.length,
};

export const sampleSourceHealth: SourceHealth = {
  generatedAt: new Date().toISOString(),
  mode: "fallback",
  sources: [
    { name: "IGDB", status: "missing-key", message: "未配置 IGDB_CLIENT_ID / IGDB_CLIENT_SECRET" },
    { name: "RAWG", status: "missing-key", message: "未配置 RAWG_API_KEY" },
    { name: "Steam", status: "fallback", message: "降级模式不请求 Steam" },
    { name: "Famitsu", status: "fallback", message: "降级模式不请求 Famitsu" },
    { name: "GiantBomb", status: "missing-key", message: "未配置 GIANTBOMB_API_KEY" },
    { name: "Sample", status: "fallback", message: "正在使用内置样例数据" },
  ],
};
