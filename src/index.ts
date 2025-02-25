import { Archiver } from "./ms2/archive/Archiver.ts"
import { BoardCategory } from "./ms2/base/BoardRoute"
import { ArchiveStorage } from "./ms2/storage/ArchiveStorage.ts"

const storage = new ArchiveStorage("ms2archive")

const archiver = new Archiver(storage)

await archiver.archiveBoard(BoardCategory.Free)