import type { CharacterInfo, CharacterMemberInfo } from "./struct/MS2CharInfo.js";

export interface PartyInfo {
  partyId: string
  leader: CharacterInfo
  members: CharacterMemberInfo[]
  partyDate: {
    year: number,
    month: number,
    day: number,
  },
  clearSec: number,
  clearRank: number,
}