import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPlatformName, mapRegionName, normalizePlatforms } from "../src/lib/mapping";

describe("platform mapping", () => {
  it("maps PC storefronts into PC tab", () => {
    assert.deepEqual(normalizePlatforms(["Steam", "Epic Games Store", "GOG", "Windows PC"]), ["PC"]);
  });

  it("maps console and mobile platforms", () => {
    assert.equal(mapPlatformName("PlayStation 5"), "PlayStation");
    assert.equal(mapPlatformName("Xbox Series X|S"), "Xbox");
    assert.equal(mapPlatformName("Nintendo Switch 2"), "Nintendo");
    assert.equal(mapPlatformName("TapTap Android"), "Mobile");
  });
});

describe("region mapping", () => {
  it("maps target regions", () => {
    assert.equal(mapRegionName("North America"), "NA");
    assert.equal(mapRegionName("Europe"), "EU");
    assert.equal(mapRegionName("中国大陆"), "CN");
    assert.equal(mapRegionName("Japan CERO"), "JP");
    assert.equal(mapRegionName("Korea GRAC"), "KR");
    assert.equal(mapRegionName("Worldwide"), "GLOBAL");
  });
});
