import { Archiver } from "./ms2/archive/Archiver.ts"
import { Fixer } from "./ms2/archive/Fixer.ts"
import { ArchiveStorage } from "./ms2/storage/ArchiveStorage.ts"

/* eslint-disable @typescript-eslint/no-unused-vars */
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

// await fixer.fixArchitectScore()

// await archiver.archiveDarkStream()
// await archiver.archiveGuildPvP()
// await archiver.archiveArchitect()

// await archiver.checkLastPvPPages()

// await archiver.archivePvPS17()
// await archiver.archivePvP()
await archiver.archiveQnA()