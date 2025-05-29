import { expect, test } from "bun:test"
import { fetchCapsuleInfo, fetchCapsuleList, fetchItemData, fetchItemDataAll } from "./MS2ProbFetch.ts"

test.skip("캡슐 파싱 테스트1", async () => {
  const gatchaInfo = await fetchCapsuleInfo(639591)
  console.log(gatchaInfo)
  expect(gatchaInfo?.capsuleInfo).toBeArrayOfSize(10)
}, 10000)

test.skip("캡슐 파싱 테스트2", async () => {
  const gatchaList = await fetchCapsuleList(1)
  console.log(gatchaList)
  expect(gatchaList).toBeArrayOfSize(10)
}, 10000)

test.skip("아이템 리스트 파싱 테스트1", async () => {
  const itemListRoot = await fetchItemData({
    equipType: "무기",
  })
  console.log(itemListRoot)
  expect(itemListRoot).toBeArrayOfSize(13)
}, 10000)

test("아이템 리스트 파싱 테스트2", async () => {
  const itemListAll = await fetchItemDataAll()
  expect(1).toBe(2)
}, 1000 * 3600 * 24)