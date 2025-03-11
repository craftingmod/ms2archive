import chalk from "chalk"
import { BoardCategory, BoardRoute } from "../fetch/BoardRoute.ts";
import { fetchArticle, fetchArticleList, fetchEventComments, fetchLatestArticleId, writeImages, type ArticleHeader, type MS2Article } from "../fetch/ArticleFetch.ts";
import type { ArchiveStorage, EventComment } from "../storage/ArchiveStorage.ts"
import Debug from "debug"
import { sleep } from "bun";

const debug = Debug("ms2archive:Archiver")

export class Archiver {
  public constructor(protected storage: ArchiveStorage) {

  }

  /**
   * 특정 Category의 게시판을 아카이빙 합니다.
   * @param board 
   */
  public async archiveBoard(board: BoardCategory) {
    if (BoardRoute[board].listAsThumb ?? false) {
      await this.archiveThumbList(board)
      return
    }

    const lastArticleId =
      this.storage.getLowestArticleId(board) ?? (await fetchLatestArticleId(board, true))
    if (lastArticleId == null) {
      throw new Error("Last article parsing failed!")
    }
    debug(`Start articleId: ${chalk.yellow(lastArticleId)}`)

    for (let i = lastArticleId - 1; i >= 1; i -= 1) {

      // 게시글 파싱
      const article = await fetchArticle(board, i)

      debug(`Archiving ${chalk.yellow(i)}... (${chalk.green(lastArticleId - i - 1)} done. ${article == null ? chalk.red("Not Found") : chalk.green("Exist")})`)

      if (article == null) {
        continue
      }

      this.insertArticle(board, article)
    }
  }

  /**
   * 섬네일 리스트 있는 것을 백업합니다. (매거진/상점아이템/이벤트는 구조가 특수해서 따로)
   */
  public async archiveThumbList(
    board: BoardCategory,
  ) {
    // Thumb 전용
    if (!(BoardRoute[board].listAsThumb ?? false)) {
      throw new Error("Thumbnail Only!")
    }

    // 1. 매거진 리스트 뽑기
    const news: ArticleHeader[] = []
    // eslint-disable-next-line no-constant-condition
    for (let page = 1; true; page += 1) {
      const fetchedArticles = await fetchArticleList(board, page)
      if (fetchedArticles == null) {
        page -= 1
        await sleep(2000)
        continue
      }
      news.push(...fetchedArticles)
      if (fetchedArticles.length <= 0) {
        break
      }
    }

    for (let archiveCount = 0; archiveCount < news.length; archiveCount += 1) {
      const header = news[archiveCount]

      const article = await fetchArticle(
        board, header.articleId,
      )
      debug(`Archiving News: ${archiveCount}/${news.length-1}`)

      if (article == null) {
        archiveCount -= 1
        await sleep(5000)
        continue
      }

      // 섬네일 추가
      const thumb = header.thumbnail.trim()
      if (thumb.length > 0) {
        article.attachments.unshift(thumb)
      }

      this.insertArticle(board, article)
    }

  }
  /**
   * 전체화면 이벤트들 댓글을 백업합니다.
   */
  public async archiveEventComments(eventIndex: number) {
    const comments = [] as EventComment[]
    // 끝까지 파싱
    for (let page = 1; true; page += 1) {
      const pagedComments = await fetchEventComments(eventIndex, page)
      if (pagedComments == null) {
        throw new Error("Comments should be not null!")
      }
      if (pagedComments.length <= 0) {
        break
      }

      comments.push(...pagedComments)
    }

    // 정렬
    comments.sort((a, b) => a.createdAt - b.createdAt)

    for (let i = 0; i < comments.length; i += 1) {
      comments[i].commentIndex = (i + 1)
    }

    // 넣기
    this.storage.insertEventComments(...comments)
  }

  protected async insertArticle(board: BoardCategory, article: MS2Article) {
    // 이미지 저장
    const images = await writeImages(article)

    // content 치환
    for (let k = 0; k < images.length; k += 1) {
      const imagePath = images[k]
      if (imagePath == null) {
        article.content = article.content.replaceAll(article.attachments[k], "")
        article.attachments[k] = "null"
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