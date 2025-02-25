import chalk from "chalk"
import type { BoardCategory } from "../base/BoardRoute.ts";
import { fetchArticle, fetchLatestArticleId, writeImages } from "../fetch/ArticleFetch.ts";
import type { ArchiveStorage } from "../storage/ArchiveStorage.ts"
import Debug from "debug"

const debug = Debug("ms2archive:Archiver")

export class Archiver {
  public constructor(protected storage: ArchiveStorage) {

  }

  /**
   * 특정 Category의 게시판을 아카이빙 합니다.
   * @param board 
   */
  public async archiveBoard(board: BoardCategory) {
    const lastArticleId =
      this.storage.getLowestArticleId(board) ?? (await fetchLatestArticleId(board, true))
    if (lastArticleId == null) {
      throw new Error("Last article parsing failed!")
    }
    debug(`Start articleId: ${chalk.yellow(lastArticleId)}`)

    for (let i = lastArticleId - 1; i >= 1; i -= 1) {
      debug(`Archiving ${chalk.yellow(i)}... (${chalk.green(lastArticleId - i - 1)} done.)`)
      
      // 게시글 파싱
      const article = await fetchArticle(board, i)
      if (article == null) {
        continue
      }

      // 이미지 저장
      const images = await writeImages(article)

      // content 치환
      for (let k = 0; k < images.length; k += 1) {
        const imagePath = images[k]
        if (imagePath == null) {
          article.content = article.content.replaceAll(article.attachments[k], "")
          article.attachments[k] = ""
          continue
        }
        article.content = article.content.replaceAll(article.attachments[k], imagePath)
        if (article.attachments[k].startsWith("data:")) {
          article.attachments[k] = "base64"
        }
      }

      // DB에 쓰기
      this.storage.insertArticle(board, article)
    }
  }
}