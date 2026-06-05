import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeGames, mergeRegionReleases } from "../src/lib/normalize";
import type { GameEntry, RegionRelease } from "../src/types";

describe("release normalization", () => {
  it("keeps the earliest dated release per region and replaces tbd when dated", () => {
    const releases: RegionRelease[] = [
      { region: "JP", date: null, status: "tbd", source: "a" },
      { region: "JP", date: "2026-05-03", status: "confirmed", source: "b" },
      { region: "JP", date: "2026-05-02", status: "confirmed", source: "c" },
    ];

    assert.deepEqual(mergeRegionReleases(releases), [
      { region: "JP", date: "2026-05-02", status: "confirmed", source: "c" },
    ]);
  });

  it("merges duplicate games by slug", () => {
    const base: GameEntry = {
      id: "one",
      title: "Example Game",
      slug: "example-game",
      summary: "short",
      genres: ["Action"],
      platforms: ["PC"],
      releaseMonth: "2026-05",
      releases: [{ region: "NA", date: "2026-05-01", status: "confirmed", source: "a" }],
      links: [{ label: "官网", url: "https://example.com", kind: "official" }],
      sources: ["A"],
    };

    const merged = mergeGames([
      base,
      {
        ...base,
        id: "two",
        summary: "a longer summary",
        genres: ["RPG"],
        platforms: ["PlayStation"],
        releases: [{ region: "JP", date: null, status: "tbd", source: "b" }],
        sources: ["B"],
      },
    ]);

    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].platforms, ["PC", "PlayStation"]);
    assert.deepEqual(merged[0].genres, ["Action", "RPG"]);
    assert.equal(merged[0].releases.length, 2);
    assert.equal(merged[0].summary, "a longer summary");
  });
});
