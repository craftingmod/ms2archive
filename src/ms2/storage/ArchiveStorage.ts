import { Database } from "bun:sqlite"
import { BoardCategory } from "../fetch/BoardRoute.ts"
import type { MS2Article } from "../fetch/ArticleFetch.ts"
import { joinOrNull } from "../Util.ts"
import type { MS2Comment } from "../base/MS2Comment.ts"

/**
 * 게시글 DB 테이블 구조
 */
export interface ArticleStruct {
  articleId: number,
  title: string,
  content: string,
  attachments: string | null,
  viewCount: number,
  likeCount: number,
  tags: string | null,
  createdAt: number,
  authorJob: number | null,
  authorLevel: number | null,
  authorName: string,
  authorIcon: string | null,
  commentCount: number,
}

export interface CommentStruct {
  articleId: number,
  commentIndex: number,
  authorName: string,
  content: string,
  createdAt: number,
}

export class ArchiveStorage {
  public database: Database

  public constructor(protected filename: string) {
    this.database = new Database(`./data/${filename}.db`, {
      create: true,
      strict: true,
    })
    this.database.exec("PRAGMA journal_mode = WAL;")

    this.init()
  }

  public init() {
    this.createTable(BoardCategory.Free)
    this.createTable(BoardCategory.Proposal)
  }

  protected createTable(board: BoardCategory) {
    // 게시글
    this.database.query(`CREATE TABLE IF NOT EXISTS ${board}Board (
      articleId INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      authorName TEXT NOT NULL,
      authorJob INTEGER,
      authorLevel INTEGER,
      authorIcon TEXT,
      viewCount INTEGER NOT NULL,
      likeCount INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      commentCount INTEGER NOT NULL,
      tags TEXT,
      content TEXT NOT NULL,
      attachments TEXT
    )`).run()

    // 댓글
    this.database.query(`CREATE TABLE IF NOT EXISTS ${board}Comment (
      articleId INTEGER NOT NULL,
      commentIndex INTEGER NOT NULL,
      authorName TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    )`).run()
  }

  public insertArticle(board: BoardCategory, article: MS2Article) {
    // @todo ORM 쓰기
    this.database.query(`
  INSERT INTO ${board}Board (
    articleId,
    title,
    authorName,
    authorJob,
    authorLevel,
    authorIcon,
    viewCount,
    likeCount,
    createdAt,
    commentCount,
    tags,
    content,
    attachments
  ) VALUES (
    $articleId,
    $title,
    $authorName,
    $authorJob,
    $authorLevel,
    $authorIcon,
    $viewCount,
    $likeCount,
    $createdAt,
    $commentCount,
    $tags,
    $content,
    $attachments
  )`).run({
      articleId: article.articleId,
      title: article.title,
      content: article.content,
      attachments: joinOrNull(article.attachments),
      viewCount: article.viewed,
      likeCount: article.liked,
      tags: joinOrNull(article.tags),
      createdAt: article.createdAt.getTime(),
      authorJob: article.author.job,
      authorLevel: article.author.level,
      authorName: article.author.nickname,
      authorIcon: article.author.icon ?? null,
      commentCount: article.commentCount,
    } satisfies ArticleStruct)

    // 댓글 추가
    if (article.comments.length <= 0) {
      return
    }

    const query = this.database.prepare(`
      INSERT INTO ${board}Comment (
      articleId,
      commentIndex,
      authorName,
      content,
      createdAt
    ) VALUES (
      $articleId,
      $commentIndex,
      $authorName,
      $content,
      $createdAt
    )`)

    const insertQuery = this.database.transaction((elements: MS2Comment[]) => {
      for (const el of elements) {
        query.run({
          articleId: article.articleId,
          commentIndex: el.commentIndex,
          authorName: el.authorName,
          content: el.content,
          createdAt: el.createdAt.getTime(),
        } satisfies CommentStruct)
      }
      return elements.length
    })

    // Transaction Start
    insertQuery(article.comments)
  }

  public getLowestArticleId(board: BoardCategory) {

    const query = this.database.query(`SELECT articleId FROM ${board}Board
      ORDER BY articleId`).get() as {articleId: number} | undefined

    if (query == null) {
      return null
    }

    return query.articleId
  }

}