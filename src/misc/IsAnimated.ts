import Bun from "bun"
import isAnimated from "is-file-animated"

export async function isAnimatedPath(path: string) {

  const file = Bun.file(path)
  if (!await file.exists()) {
    throw new Error("File Not Exist!")
  }

  const fileStream = file.stream()

  const fileBlob = await new Response(fileStream).blob()

  const isAnim = await isAnimated(
    fileBlob
  )

  return isAnim
}