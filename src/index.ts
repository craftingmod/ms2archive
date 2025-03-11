import { Archiver } from "./ms2/archive/Archiver.ts"
import { Fixer } from "./ms2/archive/Fixer.ts"
import { getAllFullscreenEvents } from "./ms2/archive/Lister.ts"
import { BoardCategory } from "./ms2/fetch/BoardRoute.ts"
import { FSEFetcher } from "./ms2/fetch/FullScreenEventFetch.ts"
import { ArchiveStorage } from "./ms2/storage/ArchiveStorage.ts"
import fs from "node:fs/promises"

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

/*
const links = (await fs.readFile("./list.txt", {encoding: "utf8"})).split("\n")
const fseParser = new FSEFetcher()
for (let link of links) {
  link = link.replace("http://", "https://")
  if (!link.startsWith("https://maplestory2.nexon.com/")) {
    continue
  }
  await fseParser.fetchFSE(link)
}
  */

for (let i = 1; i <= 9; i += 1) {
  await archiver.archiveEventComments(i)
}