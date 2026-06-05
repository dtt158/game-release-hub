export type PlatformTab = "PC" | "PlayStation" | "Xbox" | "Nintendo" | "Mobile";

export type RegionCode = "NA" | "EU" | "CN" | "JP" | "KR" | "GLOBAL";

export type ReleaseStatus = "confirmed" | "tbd";

export interface RegionRelease {
  region: RegionCode;
  date: string | null;
  status: ReleaseStatus;
  source: string;
}

export interface GameLink {
  label: string;
  url: string;
  kind: "official" | "store" | "database";
}

export interface GameEntry {
  id: string;
  title: string;
  titleOriginal?: string;
  slug: string;
  coverUrl?: string;
  summary: string;
  genres: string[];
  platforms: PlatformTab[];
  releaseMonth: string;
  releases: RegionRelease[];
  links: GameLink[];
  sources: string[];
}

export interface SourceHealth {
  generatedAt: string;
  mode: "live" | "partial" | "fallback";
  sources: Array<{
    name: string;
    status: "ok" | "missing-key" | "error" | "fallback";
    message: string;
  }>;
}

export interface LastUpdated {
  generatedAt: string;
  rangeStart: string;
  rangeEnd: string;
  totalGames: number;
}
