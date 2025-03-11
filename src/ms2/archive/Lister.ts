import { fetchArticleList } from "../fetch/ArticleFetch.ts"
import { BoardCategory } from "../fetch/BoardRoute"

export async function getAllFullscreenEvents() {
  const fullscreenEvents:string[] = []
  // eslint-disable-next-line no-constant-condition
  for (let page = 1; true; page += 1) {
    const fetchedList = await fetchArticleList(BoardCategory.Events, page)
    if (fetchedList == null || fetchedList.length <= 0) {
      break
    }
    for (const event of fetchedList) {
      if (event.articleId < 0) {
        fullscreenEvents.push(event.rawHref)
      }
    }
  }
  return fullscreenEvents
}