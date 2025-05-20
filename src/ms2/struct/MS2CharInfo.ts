import { Job } from "./MS2Job.ts"
import type { BossPartyLeaderInfo } from "./MS2RankInfo.ts"

/**
 * 크리티컬 계수
 */
export const CritCoef: { [key in Job]: number } = [
  0,
  6.4575,
  0.55125,
  4.305,
  2.03875,
  3.78,
  7.34125,
  3.78,
  3.40375,
  2.03875,
  0.60375,
  3.40375,
  1.63625,
]

/**
 * 기준으로 삼는 캐릭터 정보
 */
export type CharacterInfo = BossPartyLeaderInfo

/**
 * 트로피 검색에서 나오는 정보
 */
export interface TrophyCharacterInfo extends CharacterInfo {
  trophyRank: number
  trophyCount: number
}

/**
 * 던전 클리어 순위에서 나오는 정보
 */
export interface DungeonClearedCharacterInfo extends CharacterInfo {
  clearedCount: number
  clearedRank: number
}

/**
 * 메인 캐릭터 정보
 */
export interface MainCharacterInfo extends CharacterInfo {
  mainCharacterId: bigint
  accountId: bigint
  houseName: string
  houseScore: number
  houseRank: number
  houseDate: number // yyyymm
}

/*
export interface TotalCharacterInfo extends MainCharacterInfo, PredictCharacterInfo {
  accountSpoofed: boolean
}
*/