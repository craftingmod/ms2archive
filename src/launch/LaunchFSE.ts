import { FSEFetcher } from "../ms2/fetch/FullScreenEventFetch.ts";

const fseFetch = new FSEFetcher()

fseFetch.fetchFSE(
  "https://maplestory2.nexon.com/Support/Refund",
  "Refund",
)