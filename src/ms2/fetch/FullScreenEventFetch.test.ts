import { expect, test } from "bun:test"
import { fetchFullScreenEvent, FSEFetcher, relative } from "./FullScreenEventFetch.ts"

test("Basic Test", async () => {
  const fetch = await fetchFullScreenEvent(
    "https://maplestory2.nexon.com/events/20220908/Event1"
  )

  console.log(fetch)

  expect(fetch.metaData.title).toBe("[메이플스토리2] 깨어나! 황금더키볼!")
})

test("로컬 리소스 테스트", async () => {
  const fseFetcher = new FSEFetcher()
  await fseFetcher.fetchFSE(
    "https://maplestory2.nexon.com/events/20220908/Event1"
  )

  console.log(fseFetcher.fseList)

  expect(fseFetcher.fseList).toBeArrayOfSize(1)
}, 30000)

test.skip("상대 경로 테스트", async () => {
  const testPath = relative("./data/fse/test.html", "./data/fse/res/common/sideBar.css")

  console.log(testPath)
  expect(testPath).toBe("res/common/sideBar.css")
})