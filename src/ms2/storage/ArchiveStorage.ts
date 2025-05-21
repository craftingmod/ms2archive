import { Database } from "bun:sqlite"
import { BoardCategory, BoardRoute } from "../fetch/BoardRoute.ts"
import type { MS2Article } from "../fetch/ArticleFetch.ts"
import { joinOrNull } from "../util/MS2ParseUtil.ts"
import type { MS2Comment } from "../struct/MS2Comment.ts"
import type { QnAArticle } from "../fetch/QnAFetch.ts"

/**
 * 게시글 DB 테이블 구조
 */
export interface ArticleStruct {
  articleId: number,
  title: string,
  content: string,
  summary?: string | null | undefined,
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

export interface EventComment {
  eventIndex: number,
  commentIndex: number,
  content: string,
  authorId: bigint,
  authorName: string,
  authorJob: number,
  authorThumb: string | null,
  createdAt: number,
}

export class ArchiveStorage {
  public database: Database

  public constructor(protected filename: string) {
    this.database = new Database(`./data/${filename}.db`, {
      create: true,
      strict: true,
      safeIntegers: true,
    })
    this.database.exec("PRAGMA journal_mode = WAL;")

    this.init()
  }

  public init() {
    for (const cat of Object.values(BoardCategory)) {
      this.createBoardTable(cat)
    }
    this.createEventCommentTable()
    this.createQnATable()
  }

  protected createBoardTable(board: BoardCategory) {
    const boardInfo = BoardRoute[board]
    // 게시글
    this.database.query(`CREATE TABLE IF NOT EXISTS ${board}Board (
      articleId INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      ${(boardInfo.useSummary ?? false) ? "summary TEXT," : ""}
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

  protected createQnATable() {
    this.database.query(`CREATE TABLE IF NOT EXISTS QnABoard (
      articleId INTEGER PRIMARY KEY,
      content TEXT NOT NULL,
      authorName TEXT NOT NULL,
      authorJob INTEGER,
      authorLevel INTEGER,
      createdAt INTEGER NOT NULL,
      commentCount INTEGER NOT NULL,
      tags TEXT
    );`).run()

    this.database.query(`CREATE TABLE IF NOT EXISTS QnAComment (
      articleId INTEGER NOT NULL,
      commentId INTEGER NOT NULL,
      content TEXT NOT NULL,
      likes INTEGER NOT NULL,
      authorName TEXT NOT NULL,
      authorJob INTEGER,
      authorLevel INTEGER,
      createdAt INTEGER NOT NULL
    );`).run()
  }

  public insertQnA(...articles: QnAArticle[]) {
    const queryArticle = this.database.prepare(`INSERT OR REPLACE INTO QnABoard (
      articleId,
      content,
      authorName,
      authorJob,
      authorLevel,
      createdAt,
      commentCount,
      tags
    ) VALUES (
      $articleId,
      $content,
      $authorName,
      $authorJob,
      $authorLevel,
      $createdAt,
      $commentCount,
      $tags
    );`)

    const queryComment = this.database.prepare(`INSERT INTO QnAComment (
      articleId,
      commentId,
      content,
      likes,
      authorName,
      authorJob,
      authorLevel,
      createdAt
    ) VALUES (
      $articleId,
      $commentId,
      $content,
      $likes,
      $authorName,
      $authorJob,
      $authorLevel,
      $createdAt
    );`)

    const insertArticles = this.database.transaction((elements: QnAArticle[]) => {
      for (const article of elements) {
        queryArticle.run({
          articleId: article.questionId,
          content: article.question,
          authorName: article.nickname,
          authorJob: article.job,
          authorLevel: article.level,
          createdAt: article.timestamp.getTime(),
          commentCount: article.answerCount,
          tags: joinOrNull(article.tags),
        })
        for (const comment of article.answers) {
          queryComment.run({
            articleId: article.questionId,
            commentId: comment.replyId,
            content: comment.content,
            likes: comment.replyLike,
            authorName: comment.nickname,
            authorJob: comment.job,
            authorLevel: comment.level,
            createdAt: comment.timestamp.getTime(),
          })
        }
      }
      return elements.length
    })

    insertArticles(articles)
  }

  protected createEventCommentTable() {
    this.database.query(`CREATE TABLE IF NOT EXISTS FullEventComment (
      eventIndex INTEGER NOT NULL,
      commentIndex INTEGER NOT NULL,
      content TEXT NOT NULL,
      authorId BIGINT NOT NULL,
      authorName TEXT NOT NULL,
      authorJob INTEGER,
      authorThumb TEXT,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (eventIndex, commentIndex)
    )`).run()
  }

  public insertArticle(board: BoardCategory, article: MS2Article, summary?: string) {
    const boardInfo = BoardRoute[board]
    // @todo ORM 쓰기
    this.database.query(`
  INSERT INTO ${board}Board (
    articleId,
    title,
    ${(boardInfo.useSummary ?? false) ? "summary," : ""}
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
    ${(boardInfo.useSummary ?? false) ? "$summary," : ""}
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
      summary: summary ?? null,
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

  public insertEventComments(...comments: EventComment[]) {
    const query = this.database.prepare(`INSERT INTO FullEventComment (
      eventIndex,
      commentIndex,
      content,
      authorId,
      authorName,
      authorJob,
      authorThumb,
      createdAt  
    ) VALUES (
     $eventIndex,
     $commentIndex,
     $content,
     $authorId,
     $authorName,
     $authorJob,
     $authorThumb,
     $createdAt 
    );`)

    const insertComments = this.database.transaction((elements: EventComment[]) => {
      for (const comment of elements) {
        query.run({
          ...comment,
        })
      }
      return elements.length
    })

    insertComments(comments)
  }

  public getLowestArticleId(board: BoardCategory) {

    const query = this.database.query(`SELECT articleId FROM ${board}Board
      ORDER BY articleId`).get() as {articleId: bigint} | undefined

    if (query == null) {
      return null
    }

    return Number(query.articleId)
  }

}