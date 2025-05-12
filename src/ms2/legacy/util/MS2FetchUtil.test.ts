import { expect, test } from "bun:test"
import { searchLatestPage } from "./MS2FetchUtil.ts"

test("이진 검색 체크1", async () => {
  const pageCheck = await searchLatestPage(async (page) => {
    if (page <= 1572578) {
      return true
    }
    return null
  })
  expect(pageCheck).toBe(1572578)
}, 10000)

test("이진 검색 체크2", async () => {
  const pageCheck = await searchLatestPage(async (page) => {
    if (page <= 1572578) {
      return [1,2,3,4,5,6,7,8,9,10]
    }
    return []
  }, 1000)
  expect(pageCheck).toBe(1572578)
}, 10000)

test("이진 검색 체크3", async () => {
  const pageCheck = await searchLatestPage(async (page) => {
    if (page < 1572578) {
      return [1,2,3,4,5,6,7,8,9,10]
    } else if (page === 1572578) {
      return [1,2,3,4,5]
    }
    return []
  }, 1000)
  expect(pageCheck).toBe(1572578)
}, 10000)