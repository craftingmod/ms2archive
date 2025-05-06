import { test, expect } from "bun:test"
import { rootDir } from "./Constants.ts"
import Path from "node:path"

test("Is root directory correct?", () => {
  expect(
    rootDir.substring(rootDir.lastIndexOf(Path.sep) + 1)
  ).toBe("ms2archive")
})