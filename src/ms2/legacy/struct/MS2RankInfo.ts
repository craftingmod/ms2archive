import type { Job, TrophyCharacterInfo } from "./MS2CharInfo.ts"

export type TrophyRankInfo = Omit<TrophyCharacterInfo, "job" | "level">

/**
 * 던전 파티원 멤버에서 나오는 캐릭터 정보
 */
export interface BossPartyMemberInfo {
  job: Job,
  nickname: string,
  level: number,
}

/**
 * 던전 리더에서 나오는 정보
 * = CharacterInfo
 */
export interface BossPartyLeaderInfo extends BossPartyMemberInfo {
  characterId: bigint,
  profileURL: string,
}

/**
 * 던전 명예의 전당에서 나오는 정보
 */
export interface BossPartyInfo {
  partyId: string,
  leader: BossPartyLeaderInfo,
  members: BossPartyMemberInfo[],
  clearRank: number,
  clearSec: number,
  partyDate: {
    year: number,
    month: number,
    day: number,
  },
}

/**
 * 던전 최다참여에서 나오는 정보
 */
export interface BossClearedRankInfo extends Omit<BossPartyLeaderInfo, "level"> {
  clearedCount: number,
  clearedRank: number,
}