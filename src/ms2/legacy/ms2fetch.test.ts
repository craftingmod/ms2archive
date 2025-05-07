import { expect, test } from "bun:test"
import { fetchGuildRankList, searchLatestPage } from "./ms2fetch.ts"

test("길드 목록 파싱1 (1페이지)", async () => {
  const parsedRank = await fetchGuildRankList(1) ?? []
  console.log(parsedRank)

  expect(parsedRank.length).toBe(10)
}, 3000)

test("길드 목록 파싱1 (8페이지)", async () => {
  const parsedRank = await fetchGuildRankList(8) ?? []
  console.log(parsedRank)

  expect(parsedRank.length).toBe(10)
}, 3000)

test("길드 목록 파싱2 (10만페이지)", async () => {
  const parsedRank = await fetchGuildRankList(100000) ?? []
  console.log(parsedRank)

  expect(parsedRank.length).toBe(0)
}, 3000)

test("길드 목록 마지막 체크", async () => {
  const latestPage = await searchLatestPage((page) => {
    return fetchGuildRankList(page)
  })
  console.log(latestPage)

  expect(latestPage).toBeGreaterThan(10000)
}, 100000)