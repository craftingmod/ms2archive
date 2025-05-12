import { expect, test } from "bun:test"
import { fetchBossClearedByDate, fetchBossClearedLastPage, fetchBossClearedRate, fetchGuildRankList, fetchTrophyRankList } from "./MS2RankFetch.ts"
import { DungeonId } from "../struct/MS2DungeonId.ts"

test("트로피 파싱 테스트", async () => {
  const trophyList = await fetchTrophyRankList(1)
  console.log(trophyList)
  expect(trophyList).toBeArrayOfSize(10)
}, 10000)

test("길드원 파싱 테스트", async () => {
  const guildList = await fetchGuildRankList(1)
  console.log(guildList)
  expect(guildList).toBeArrayOfSize(10)
}, 10000)

test("던전 파싱 테스트", async () => {
  const dungeonList = await fetchBossClearedByDate(
    DungeonId.REVERSE_ZAKUM, 1, false
  )

  console.log(dungeonList)

  expect(dungeonList).toBeArrayOfSize(10)
})

test("던전 마지막 클리어 페이지 테스트", async () => {
  const lastClearedPage = await fetchBossClearedLastPage(DungeonId.HARD_ROOK, 1)

  expect(lastClearedPage).toBe(22)
})

test("던전 최다참여 테스트", async () => {
  const clearedCount = (await fetchBossClearedRate(DungeonId.HARD_ROOK, "밸붕"))[0].clearedCount

  expect(clearedCount).toBe(39)
})