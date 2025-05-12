import { Archiver } from "./ms2/archive/Archiver.ts"
import { Fixer } from "./ms2/archive/Fixer.ts"
import { ArchiveStorage } from "./ms2/storage/ArchiveStorage.ts"
const storage = new ArchiveStorage("ms2archive")

const archiver = new Archiver(storage)
const fixer = new Fixer(storage)

// await archiver.archiveBoard(BoardCategory.Free)
// await archiver.archiveBoard(BoardCategory.Proposal)
// await archiver.archiveBoard(BoardCategory.Artwork)
// await archiver.archiveBoard(BoardCategory.Guild)
// await archiver.archiveBoard(BoardCategory.Knowhow)
// await archiver.archiveBoard(BoardCategory.Notice)
// await archiver.archiveNews()
// await archiver.archiveBoard(BoardCategory.Patchnote)
// await fixer.analyzeAttachments(BoardCategory.News)
// await archiver.archiveThumbList(BoardCategory.Cashshop)
// await fixer.addShopSummary(BoardCategory.Cashshop)

await archiver.archiveDarkStream()