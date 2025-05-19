import { expect, test } from "bun:test"
import { loadTrophyRanks } from "./TrophyRankLoader.ts"

test("파싱 잘되나", () => {
  const trophyRanks = loadTrophyRanks()
  expect(
trophyRanks
  ).toBeArrayOfSize(1221171)
})