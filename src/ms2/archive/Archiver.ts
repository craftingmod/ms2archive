import chalk from "chalk"
import { BoardCategory, BoardRoute } from "../fetch/BoardRoute.ts";
import { fetchArticle, fetchArticleList, fetchEventComments, fetchLatestArticleId, UnknownTime, writeImages, type ArticleHeader, type MS2Article } from "../fetch/ArticleFetch.ts";
import type { ArchiveStorage, EventComment } from "../storage/ArchiveStorage.ts"
import Debug from "debug"
import { sleep } from "bun";
import { Job } from "../base/MS2Job.ts";
import { RankStorage } from "../storage/RankStorage.ts";
import { fetchGuildRankList, fetchTrophyRankList } from "../legacy/ms2fetch.ts";

const debug = Debug("ms2archive:Archiver")

export class Archiver {

  public rankStorage = new RankStorage()

  public constructor(protected storage: ArchiveStorage) {

  }

  public async archiveGuildRank() {
    const localHighestRankData = (this.rankStorage.database.prepare(
      `SELECT MAX(rank) FROM guildRankStore;`
    ).get()) as { ["MAX(rank)"]: bigint | undefined }

    const localHighestRank = Number(localHighestRankData["MAX(rank)"] ?? 0)
    const localHighestPage = Math.max(Math.floor((localHighestRank / 10)), 1)
    
    /*
    const remoteHighestRankPage = await searchLatestPage(
      (page) => fetchGuildRankList(page),
      Math.floor((localHighestRank / 10)),
    )
      */
    // Atomic value
    const remoteHighestRankPage = 13487

    for (let page = localHighestPage; page <= remoteHighestRankPage; page += 1) {
      const guildRankList = await fetchGuildRankList(page)
      if (guildRankList == null) {
        continue
      }
      const guildRankListFiltered = (page === localHighestPage) ? guildRankList.filter(
        (rank) => rank.rank <= localHighestRank
      ) : guildRankList
      

      debug(`Archiving Guild ranks: ${
        chalk.yellow(page)
      }/${
        chalk.green(remoteHighestRankPage)
      } pages`)

      this.rankStorage.guildRankStore.insertMany(
        guildRankListFiltered.map(
          (rank) => ({
            guildId: rank.guildId,
            guildName: rank.guildName,
            guildProfileURL: rank.guildProfileURL,
            leaderName: rank.leaderName,
            leaderCharacterId: null,
            trophyCount: rank.trophyCount,
            rank: rank.rank,
          })
        )
      )
    }
  }

  public async archiveTrophyRank() {
    const localMinTrophyRankData = (this.rankStorage.database.prepare(
      `SELECT MAX(trophyRank) FROM trophyRankStore;`
    ).get()) as { ["MAX(trophyRank)"]: bigint | undefined }

    const localMinTrophyRankNum = Number(localMinTrophyRankData["MAX(trophyRank)"] ?? 0)
    const localMinTrophyRank = Math.max(Math.floor((localMinTrophyRankNum / 10)), 1)

    const remoteHighestRankPage = 30000

    for (let page = localMinTrophyRank; page <= remoteHighestRankPage; page += 1) {

      const trophyRankList = await fetchTrophyRankList(page)
      if (trophyRankList == null) {
        continue
      }

      debug(`Archiving Trophy ranks: ${
        chalk.yellow(page)
      }/${
        chalk.green(remoteHighestRankPage)
      } pages`)

      this.rankStorage.trophyRankStore.insertMany(
        trophyRankList.map(
          (rank) => ({
            characterId: rank.characterId,
            nickname: rank.nickname,
            trophyCount: rank.trophyCount,
            trophyRank: rank.trophyRank,
            profileURL: rank.profileURL,
          })
        )
      )
    }
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
      debug(`Archiving News: ${archiveCount}/${news.length - 1}`)

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

      await this.insertArticle(board, article)
    }

  }
  /**
   * 전체화면 이벤트들 댓글을 백업합니다.
   */
  public async archiveEventComments(eventIndex: number) {
    const comments = [] as EventComment[]
    // 끝까지 파싱
    for (let page = 1; page <= 100; page += 1) {
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

  public async archiveEvents() {
    // 1. 매거진 리스트 뽑기
    const events: Array<ArticleHeader & {hasId: boolean}> = []
    for (let page = 1; true; page += 1) {
      const fetchedArticles = await fetchArticleList(BoardCategory.Events, page)
      if (fetchedArticles == null) {
        page -= 1
        await sleep(2000)
        continue
      }
      events.push(...fetchedArticles.map((v) => ({
        ...v,
        hasId: v.articleId !== -1,
      })))
      if (fetchedArticles.length <= 0) {
        break
      }
    }
    // 2. ID 보정
    let latestId = -1
    let latestIdIndex = -1
    for (let i = 0; i < events.length; i += 1) {
      const event = events[i]
      if (event.articleId !== -1) {
        latestId = event.articleId
        latestIdIndex = i
        continue
      }
      // articleId가 -1이 아니면 보정
      event.articleId = latestId - Math.abs(i - latestIdIndex)
    }
    // 3. 넣기
    const lastArticleId = this.storage.getLowestArticleId(BoardCategory.Events)
    for (let archiveCount = 0; archiveCount < events.length; archiveCount += 1) {
      const header = events[archiveCount]

      if (lastArticleId != null && header.articleId >= lastArticleId) {
        continue
      }

      if (!header.hasId || header.articleId >= 1000) {
        // 더미
        await this.insertArticle(BoardCategory.Events, {
          articleId: header.articleId,
          title: header.title,
          content: header.rawHref,
          attachments: [header.thumbnail.trim()],
          viewed: -1,
          liked: -1,
          tags: [],
          createdAt: UnknownTime,
          author: {
            job: Job.Beginner,
            level: -1,
            nickname: "GM",
          },
          commentCount: 0,
          comments: [],
          boardName: BoardCategory.Events,
        })
        continue
      }

      const article = await fetchArticle(
        BoardCategory.Events, header.articleId,
      )
      debug(`Archiving News: ${archiveCount}/${events.length - 1}`)

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

      await this.insertArticle(BoardCategory.Events, article)
    }
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