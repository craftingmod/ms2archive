export enum BoardCategory {
  /**
   * 자유 게시판
   */
  Free = "Free",
  /**
   * 공략 게시판
   */
  Knowhow = "Knowhow",
  /**
   * 그림 게시판
   */
  Artwork = "Artwork",
  /**
   * 길드 게시판
   */
  Guild = "Guild",
  /**
   * 건의 게시판
   */
  Proposal = "Proposal",
}

interface RequestData {
  listRoute: string,
  detailRoute: (articleId: number) => string,
  commentRoute: (articleId: number, page: number) => string,
}

function boardDefault(route: string) {
  return {
    listRoute: `Board/${route}/List`,
    detailRoute: (articleId) => `Board/${route}/DetailView?sn=${articleId}`,
    commentRoute: (articleId, page) => 
      `Board/Comments/_PartialCommentList?pn=${
        page}&id=${articleId}&ls=10&bn=${route.toLowerCase()}`,
  } satisfies RequestData
}

export const BoardRoute:Record<BoardCategory, RequestData> = {
  [BoardCategory.Free]: boardDefault("Free"),
  [BoardCategory.Knowhow]: {
    listRoute: "Kch/Knowhow",
    detailRoute: (articleId) => `Kch/KnowhowView?sn=${articleId}`,
    commentRoute: (articleId, page) =>
      `Comment/BoardList?page=${page}&s=${articleId}`,
  },
  [BoardCategory.Artwork]: boardDefault("Artwork"),
  [BoardCategory.Guild]: boardDefault("Guild"),
  [BoardCategory.Proposal]: boardDefault("Proposal"),
}