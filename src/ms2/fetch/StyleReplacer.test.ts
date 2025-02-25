import { test, expect } from "bun:test"
import Bun from "bun"
import { replaceStyle } from "./StyleReplacer"

test("DOM Style TEST", async () => {
  const file = Bun.file("./domSample.txt")
  const content = await file.text()

  await Bun.write(Bun.file("./tmp/test.html"), replaceStyle(content))

  expect(replaceStyle(content).indexOf("NanumGothic")).toEqual(
    -1
  )
})