import type { PlatformTab, RegionCode } from "../types";

const platformAliases: Array<[RegExp, PlatformTab]> = [
  [/\b(steam|epic|gog|windows|pc|mac|linux)\b/i, "PC"],
  [/\b(playstation|ps5|ps4|ps3|ps vita|psvr)\b/i, "PlayStation"],
  [/\b(xbox|series x|series s|xone|x360)\b/i, "Xbox"],
  [/\b(nintendo|switch|wii|3ds|ds|gamecube)\b/i, "Nintendo"],
  [/\b(android|ios|iphone|ipad|mobile|app store|google play|taptap)\b/i, "Mobile"],
];

export function mapPlatformName(name: string): PlatformTab | null {
  return platformAliases.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

export function normalizePlatforms(names: string[]): PlatformTab[] {
  return Array.from(new Set(names.map(mapPlatformName).filter(Boolean) as PlatformTab[]));
}

export function mapRegionName(name?: string | null): RegionCode {
  if (!name) return "GLOBAL";
  const normalized = name.toLowerCase();
  if (/(china|chinese|cn|国行|中国|大陆|taptap)/i.test(normalized)) return "CN";
  if (/(japan|jp|cero|日本)/i.test(normalized)) return "JP";
  if (/(korea|kr|grac|韩国|韓国)/i.test(normalized)) return "KR";
  if (/(europe|eu|pegI|uk|germany|france|spain|italy|欧洲|歐洲)/i.test(normalized)) return "EU";
  if (/(north america|usa|united states|canada|na|esrb|america|欧美|北美)/i.test(normalized)) return "NA";
  if (/(worldwide|global|international|全球)/i.test(normalized)) return "GLOBAL";
  return "GLOBAL";
}

export function regionLabel(region: RegionCode): string {
  return {
    NA: "北美",
    EU: "欧洲",
    CN: "中国",
    JP: "日本",
    KR: "韩国",
    GLOBAL: "全球",
  }[region];
}
