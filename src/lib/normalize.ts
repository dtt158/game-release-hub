import type { GameEntry, RegionRelease } from "../types";
import { toMonth } from "./date";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function mergeRegionReleases(releases: RegionRelease[]): RegionRelease[] {
  const byRegion = new Map<string, RegionRelease>();

  for (const release of releases) {
    const existing = byRegion.get(release.region);
    if (!existing) {
      byRegion.set(release.region, release);
      continue;
    }

    if (!existing.date && release.date) {
      byRegion.set(release.region, release);
      continue;
    }

    if (existing.date && release.date && release.date < existing.date) {
      byRegion.set(release.region, release);
    }
  }

  return Array.from(byRegion.values()).sort((a, b) => a.region.localeCompare(b.region));
}

export function monthFromReleases(releases: RegionRelease[]): string {
  const dated = releases
    .map((release) => release.date)
    .filter(Boolean)
    .sort() as string[];
  return toMonth(dated[0]) ?? new Date().toISOString().slice(0, 7);
}

export function mergeGames(entries: GameEntry[]): GameEntry[] {
  const byKey = new Map<string, GameEntry>();

  for (const entry of entries) {
    const key = entry.slug || slugify(entry.titleOriginal ?? entry.title);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...entry,
        releases: mergeRegionReleases(entry.releases),
      });
      continue;
    }

    const mergedReleases = mergeRegionReleases([...existing.releases, ...entry.releases]);
    byKey.set(key, {
      ...existing,
      title: existing.title || entry.title,
      titleOriginal: existing.titleOriginal || entry.titleOriginal,
      coverUrl: existing.coverUrl || entry.coverUrl,
      summary: existing.summary.length >= entry.summary.length ? existing.summary : entry.summary,
      genres: Array.from(new Set([...existing.genres, ...entry.genres])),
      platforms: Array.from(new Set([...existing.platforms, ...entry.platforms])),
      releaseMonth: monthFromReleases(mergedReleases),
      releases: mergedReleases,
      links: dedupeLinks([...existing.links, ...entry.links]),
      sources: Array.from(new Set([...existing.sources, ...entry.sources])),
    });
  }

  return Array.from(byKey.values()).sort((a, b) => a.releaseMonth.localeCompare(b.releaseMonth));
}

function dedupeLinks(links: GameEntry["links"]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.kind}:${link.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
