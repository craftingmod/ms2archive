import Path from "node:path"
import { fileURLToPath } from "node:url"

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = Path.dirname(currentFilePath)

export const rootDir = Path.resolve(currentDir, "../")

export const dataDir = Path.resolve(rootDir, "./data")