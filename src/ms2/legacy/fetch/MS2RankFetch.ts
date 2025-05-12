import { bossClearedByDatePostfix, bossClearedByRatePostfix, bossClearedWithMemberPostfix, darkStreamPostfix, getRankFromElement, guildTrophyPostfix, parseCommaNumber, parseYMDString, queryCIDFromImageURL, queryJobFromIcon, queryLevelFromText, searchLatestPage, trophyPostfix } from "../util/MS2FetchUtil.ts"
import { fetchMS2FormattedList } from "./MS2BaseFetch.ts"
import type { BossClearedRankInfo, BossPartyInfo, BossPartyLeaderInfo, BossPartyMemberInfo, TrophyRankInfo } from "../struct/MS2RankInfo.ts"
import type { DungeonId } from "../struct/MS2DungeonId.ts"
import { JobCode, Job } from "../struct/MS2CharInfo.ts"

export interface GuildRank {
  rank: number,
  guildId: bigint | null,
  guildName: string,
  guildProfileURL: string | null,
  leaderName: string,
  trophyCount: number,
}

/**
 * 트로피 랭킹을 파싱합니다.
 * @param page 페이지
 * @returns 트로피 랭킹
 */
export async function fetchTrophyRankList(page = 1, nickname = "") {
  return fetchMS2FormattedList({
    fetchOptions: {
      postfix: trophyPostfix,
      urlSearchParams: {
        tp: "realtime",
        page: String(page),
        k: nickname,
      },
    },
    validateTitle: "개인 트로피",
    listSelector: ".rank_list_character > .board tbody tr",
  }, ($i) => {
    // rank
    const rank = getRankFromElement($i)
    // parse character info
    const characterId = queryCIDFromImageURL($i.find(".character > img:nth-child(1)").attr("src") ?? "")
    // nickname
    const nickname = $i.find(".character").text().trim()
    // profile image
    const profileURL = $i.find(".character > img").attr("src") ?? ""
    const result: TrophyRankInfo = {
      characterId,
      nickname,
      trophyCount: Number.parseInt($i.find(".last_child").text().replace(",", "")),
      trophyRank: rank,
      profileURL,
    }
    return result
  })
}

/**
 * 길드 순위 n페이지를 파싱합니다.
 * @param page 페이지
 * @returns 순위 목록
 */
export async function fetchGuildRankList(page = 1, guildname = "") {
  return fetchMS2FormattedList({
    fetchOptions: {
      postfix: guildTrophyPostfix,
      urlSearchParams: {
        tp: "realtime",
        page: String(page),
        k: guildname,
      },
    },
    validateTitle: "길드원 전체의 트로피 개수",
    listSelector: ".rank_list_guild > .board tbody tr",
  }, ($el) => {

    const rank = getRankFromElement($el)
    const guildProfileURL = $el.find(".character > img").attr("src") ?? null
    const guildId = queryCIDFromImageURL(guildProfileURL ?? "")
    const guildName = $el.find(".character").text().trim()
    const leaderName = $el.find(":nth-child(3)").text().trim()

    const trophyCount = Number.parseInt($el.find(":nth-child(4)").text().trim().replace(/,/g, ""))

    return {
      rank,
      guildId,
      guildName,
      guildProfileURL,
      leaderName,
      trophyCount,
    } satisfies GuildRank
  })
}


/**
 * 보스 클리어 기록을 시간 순 정렬 목록에서 가져옵니다.
 * @param dungeonId 던전 ID
 * @param page 페이지
 * @param detail 파티원 목록까지 불러오는지 여부
 * @returns 보스 클리어 목록
 */
export async function fetchBossClearedByDate(
  dungeonId: DungeonId,
  page: number,
  detail = true
) {
  return (await fetchMS2FormattedList({
    fetchOptions: {
      postfix: bossClearedByDatePostfix,
      urlSearchParams: {
        b: String(dungeonId),
        page: String(page),
      },
    },
    validateTitle: "보스 명예의 전당",
    listSelector: ".rank_list_boss1 > .board tbody tr",
  }, async ($i) => {

    // Leader
    const $leader = $i.find(".party_leader")
    const imageURL = $leader.find(".name > img:nth-child(1)").attr("src") ?? ""
    const partyLeader: BossPartyLeaderInfo = {
      characterId: queryCIDFromImageURL(imageURL),
      job: queryJobFromIcon($leader.find(".name > img:nth-child(2)").attr("src") ?? ""),
      nickname: $leader.find(".name").text().trim(),
      level: queryLevelFromText($leader.find(".info").text().trim()),
      profileURL: imageURL,
    }
    // Rank
    const rank = getRankFromElement($i)
    // Date
    let dateNumbers = $i.find(".date").text().match(/\d+/g) ?? []
    if (dateNumbers.length < 3) {
      dateNumbers = ["1970", "1", "1"]
    }
    const partyDate = {
      year: Number.parseInt(dateNumbers[0] ?? "1970"),
      month: Number.parseInt(dateNumbers[1] ?? "1"),
      day: Number.parseInt(dateNumbers[2] ?? "1"),
    }
    // Clear Time
    const clearTimeText = $i.find(".record").text()
    // 분
    const clearTimeTextMin = clearTimeText.match(/\d+분/g) ?? ["0분"]
    const clearTimeMin = Number.parseInt(clearTimeTextMin[0]?.replace("분", "")?.trim() ?? "0")
    // 초
    const clearTimeTextSec = clearTimeText.match(/\d+초/g) ?? ["0초"]
    const clearTimeSec = Number.parseInt(clearTimeTextSec[0]?.replace("초", "")?.trim() ?? "0")

    const clearSec = clearTimeMin * 60 + clearTimeSec
    // Party Id
    const partyId = $i.find(".party_list").attr("id") ?? ""
    // Members
    let members: Array<BossPartyMemberInfo> = []
    if (partyId.length >= 1 && detail) {
      members = await fetchBossPartyInfo(partyId)
    }
    return {
      partyId,
      leader: partyLeader,
      members,
      clearRank: rank,
      clearSec,
      partyDate,
    } as BossPartyInfo
  })) ?? []
}

/**
 * 보스 클리어 횟수를 가져옵니다.
 * @param dungeonId 던전 ID
 * @param nickname 닉네임
 * @returns 보스 클리어 횟수 (2개 이상일 수도 있음)
 */
export async function fetchBossClearedRate(
  dungeonId: DungeonId,
  nickname: string,
) {
  return fetchMS2FormattedList({
    fetchOptions: {
      postfix: bossClearedByRatePostfix,
      urlSearchParams: {
        b: String(dungeonId),
        k: nickname,
      },
    },
    listSelector: ".rank_list_boss3 > .board tbody tr",
  }, ($i) => {
    // rank
    const rank = getRankFromElement($i)

    // parse character info
    const job = queryJobFromIcon($i.find(".character > img:nth-child(2)").attr("src") ?? "")

    let serverNickname = $i.find(".character").text().trim()
    if (serverNickname.length <= 0) {
      serverNickname = nickname
    }

    const imageURL = $i.find(".character > img:nth-child(1)").attr("src") ?? ""

    const characterId = queryCIDFromImageURL(imageURL)

    const clearedCount = Number.parseInt($i.find(".record").text().replace(",", ""))

    return {
      characterId,
      job,
      nickname: serverNickname,
      clearedCount,
      clearedRank: rank,
      profileURL: imageURL,
    } satisfies BossClearedRankInfo
  })
}

/**
 * 파티 ID로 보스 클리어 파티원 목록을 불러옵니다.
 * @param partyId 파티 ID
 * @returns 파티원 정보
 */
export async function fetchBossPartyInfo(
  partyId: string,
) {
  return fetchMS2FormattedList({
    fetchOptions: {
      postfix: bossClearedWithMemberPostfix,
      urlSearchParams: {
        r: partyId,
      },
    },
    listSelector: "ul > li",
  }, ($i) => {
    return {
      job: queryJobFromIcon($i.find(".icon > img").attr("src") ?? ""),
      nickname: $i.find(".name").text().trim(),
      level: queryLevelFromText($i.find(".info").text()),
    } satisfies BossPartyMemberInfo
  })
}

/**
 * 보스 클리어 기록의 마지막 페이지를 가져옵니다.
 * @param dungeonId 던전 ID 
 * @param startPage 검색 시작 페이지
 * @returns 가장 마지막 페이지
 */
export async function fetchBossClearedLastPage(
  dungeonId: DungeonId,
  startPage = 1,
) {
  return searchLatestPage(
    (page) => fetchBossClearedByDate(dungeonId, page, false),
    startPage,
  )
}

/**
 * 다크 스트림 기록을 가져옵니다.
 * @param fields 요구 fields
 * @returns 다크 스트림 기록
 */
export async function fetchDarkStreamRankList(fields: {
  job: Job,
  season: number,
  page: number,
}) {
  const { job, season, page } = fields
  if (job === Job.Beginner || job === Job.UNKNOWN) {
    throw new Error("Job must not be Beginner!")
  }

  return fetchMS2FormattedList({
    fetchOptions: {
      postfix: darkStreamPostfix,
      urlSearchParams: {
        s: String(season),
        j: String(JobCode[job]),
        page: String(page),
      },
    },
    listSelector: ".rank_list_dark > .board tbody tr",
  }, ($) => {

    const profileURL = $.find(".character > img").attr("src") ?? ""

    return {
      rank: getRankFromElement($),
      job: job as Job,
      characterId: queryCIDFromImageURL(profileURL),
      profileURL,
      nickname: $.find(".character").text().trim(),
      rankYMD: parseYMDString(
        $.find(".time").text()
      ),
      score: parseCommaNumber(
        $.find(".last_child").text()
      ),
    }
  })


}
