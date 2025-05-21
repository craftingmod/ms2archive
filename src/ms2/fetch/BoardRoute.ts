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
  /**
   * 공지사항
   */
  Notice = "Notice",
  /**
   * 뉴-스
   */
  News = "News",
  /**
   * 패치노트
   */
  Patchnote = "Patchnote",
  /**
   * 캐시샵
   */
  Cashshop = "Cashshop",
  /**
   * 이벤트
   */
  Events = "Events",
  /**
   * 당첨자 발표
   */
  EventsResultView = "EventsResultView",
}

interface RequestData {
  /**
   * 글 목록 URL
   */
  listRoute: (page: number) => string,
  /**
   * 글 ID가 포함된 href DOM Selector
   */
  articleSelector: string,
  /**
   * 글 자세한 정보 URL 생성기
   * @param articleId 게시글 ID
   * @returns URL
   */
  detailRoute: (articleId: number) => string,
  /**
   * 댓글 페이지 URL 생성기
   * @param articleId 게시글 ID
   * @param page 댓글 페이지
   * @returns URL
   */
  commentRoute: (articleId: number, page: number) => string,
  /**
   * DOM 정리해서 저장하기 여부
   */
  cleanupDOM?: boolean,
  /**
   * 게시글 목록이 섬네일 포함일 경우 여부 
   */
  listAsThumb?: boolean,
  /**
   * 설명을 쓸 지에 대한 여부
   */
  useSummary?: boolean,
}

function boardDefault(route: string, listType: number) {
  return {
    listRoute: (page) => `Board/${route}/List?pn=${page}`,
    articleSelector: `.board_list${listType} > ul > li`,
    detailRoute: (articleId) => `Board/${route}/DetailView?sn=${articleId}`,
    commentRoute: (articleId, page) => 
      `Board/Comments/_PartialCommentList?pn=${
        page}&id=${articleId}&ls=10&bn=${route.toLowerCase()}`,
    cleanupDOM: true,
  } satisfies RequestData
}

export const BoardRoute:Record<BoardCategory, RequestData> = {
  [BoardCategory.Free]: boardDefault("Free", 6),
  [BoardCategory.Knowhow]: {
    listRoute: (page) => `Kch/Knowhow?pn=${page}`,
    articleSelector: `.board_list9 > ul > li`,
    detailRoute: (articleId) => `Kch/KnowhowView?sn=${articleId}`,
    commentRoute: (articleId, page) =>
      `Comment/BoardList?page=${page}&s=${articleId}`,
  },
  [BoardCategory.Artwork]: boardDefault("Artwork", 7),
  [BoardCategory.Guild]: boardDefault("Guild", 7),
  [BoardCategory.Proposal]: boardDefault("Proposal", 6),
  [BoardCategory.Notice]: {
    ...boardDefault("Notice", 6),
    listRoute: (page) => `News/Notice?pn=${page}`,
    detailRoute: (articleId) => `News/NoticeView?sn=${articleId}`,
  },
  [BoardCategory.News]: {
    listRoute: (page) => `News/ListSub?page=${page}`,
    articleSelector: `.board_list2 > ul > li`,
    detailRoute: (articleId) => `News/DetailView?s=${articleId}`,
    commentRoute: (articleId, page) => 
      `Comment/NewsList?page=${page}&s=${articleId}`,
    cleanupDOM: false,
    listAsThumb: true,
  },
  [BoardCategory.Patchnote]: {
    ...boardDefault("Patchnote", 6),
    listRoute: (page) => `News/Patchnote?pn=${page}`,
    detailRoute: (articleId) => `News/PatchnoteView?sn=${articleId}`,
    cleanupDOM: false,
  },
  [BoardCategory.Cashshop]: {
    listRoute: (page) => `News/Cashshop?ct=2&pn=${page}`,
    articleSelector: `.board_list2 > .sale_board > ul > li > dl`,
    detailRoute: (articleId) => `News/CashshopView?sn=${articleId}`,
    commentRoute: boardDefault("Cashshop", 2).commentRoute,
    cleanupDOM: false,
    listAsThumb: true,
    useSummary: true,
  },
  [BoardCategory.Events]: {
    ...boardDefault("Events", 8),
    listRoute: (page) => `News/Events?ct=2&pn=${page}`,
    detailRoute: (articleId) => `News/EventsView?sn=${articleId}`,
    cleanupDOM: false,
    listAsThumb: true,
    useSummary: true,
  },
  [BoardCategory.EventsResultView]: {
    ...boardDefault("EventsResult", 6),
    listRoute: (page) => `News/EventsResult?pn=${page}`,
    detailRoute: (articleId) => `News/EventsResultView?sn=${articleId}`,
    cleanupDOM: false,
  }
}