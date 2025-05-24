import { fetchGuestBook } from "../ms2/fetch/MS2SiteFetch.ts";
import { CharacterInfoDB } from "../ms2/storage/CharacterInfoDB.ts";
import { GuestbookStorage } from "../ms2/storage/GuestbookStorage.ts";

import Debug from "debug"

const Verbose = Debug("ms2:verbose:guestbook")

const charDB = new CharacterInfoDB("./data/ms2char.db", true)
const guestbookDB = new GuestbookStorage()

const queryAids = charDB.getAids()

const existAids = new Set(
  guestbookDB.guestbookExistStore.findAll().map((v) => v.ownerAccountId)
)

// 핑찌
// const queryAids = [101453n]

let aidDone = 0
for (const accountId of queryAids) {
  if (existAids.has(accountId)) {
    ++aidDone
    continue
  }

  Verbose(`[GuestBook] AID ${accountId} (${++aidDone}/${queryAids.length})`)

  let commentCount = -1
  let currentFetched = 0
  for (let page = 1; true; page += 1) {
    Verbose(`[GuestBook] Archiving AID ${accountId}, Page ${page} (${currentFetched}/${commentCount})`)

    const fetchedGuestbook = await fetchGuestBook(process.env.MS2TOKEN ?? "", accountId, page)

    if (fetchedGuestbook == null) {
      Verbose(`[GuestBook] Fetch failed! Skipping..`)
      continue
    }

    if (commentCount < 0) {
      commentCount = fetchedGuestbook.commentCount
    }

    const guestbooks = fetchedGuestbook.comments
    guestbookDB.guestbookStore.insertMany(guestbooks)

    currentFetched += fetchedGuestbook.comments.length

    if (fetchedGuestbook.comments.length <= 0
      || currentFetched >= commentCount) {
      break
    }
  }

  guestbookDB.guestbookExistStore.insertOne({
    ownerAccountId: accountId,
    commentCount: currentFetched,
  })
}