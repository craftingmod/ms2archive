import { extractNumber } from "../Util";

export function parseLevel(levelstr: string) {
  const level = extractNumber(levelstr.match(/Lv\.\d+/)) ?? -1
  return level
}