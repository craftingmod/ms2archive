import { FSEFetcher } from "../ms2/fetch/FullScreenEventFetch.ts";

// const fseFetch = new FSEFetcher()

/*
fseFetch.fetchFSE(
  "https://maplestory2.nexon.com/Support/Refund",
  "Refund",
  null,
)
*/

/*
fseFetch.fetchFSE(
  "https://maplestory2.nexon.com/Guidebook/Comeback",
  "Comeback",
  null,
)*/

/*
fseFetch.fetchFSE(
  "https://maplestory2.nexon.com/Guidebook/Beginner",
  "Beginner",
  null,
)
  */

const fseFetch = new FSEFetcher(true)

/*
fseFetch.fetchFSE(
  "https://maplestory2.nexon.com/Guide/Job",
  "GuideJob",
  "maview",
)
*/

/*
const maviewRoutes = [
  "News/Notice",
  "News/ListSub",
  "News/Patchnote",
  "News/Cashshop?ct=2",
  "News/Events",
  "News/EventsResult",
  "Kch/Qna",
  "Board/Free/List",
  "Kch/Knowhow",
  "Board/Artwork/List",
  "Board/Guild/List",
  "Proposal/List",
  "Rank/Guild",
  "Rank/Character",
  "Rank/DarkStream",
  "Rank/PVP",
  "Rank/GuildPVP",
  "Rank/Architect",
  "Rank/Boss3",
  "Support/inquiry",
  "Support/Download",
]

for (const slashroute of maviewRoutes) {
  let route = slashroute
  if (route.indexOf("?") >= 0) {
    route = route.substring(0, route.indexOf("?"))
  }
  route = route.replaceAll("/", "")
  await fseFetch.fetchFSE(
    `https://maplestory2.nexon.com/${slashroute}`,
    route,
    "maview",
  )
}
  */

const maviewRoutes = [
  "Probability/Socket",
  "Probability/Dungeon",
  "Probability/Enchant",
  "Probability/PetCapture",
  "Probability/Key",
  "Probability/Life",
  "Probability/Etc",
]

for (const slashroute of maviewRoutes) {
  let route = slashroute
  if (route.indexOf("?") >= 0) {
    route = route.substring(0, route.indexOf("?"))
  }
  route = route.replaceAll("/", "")
  await fseFetch.fetchFSE(
    `https://maplestory2.nexon.com/${slashroute}`,
    route,
    "maview",
  )
}

