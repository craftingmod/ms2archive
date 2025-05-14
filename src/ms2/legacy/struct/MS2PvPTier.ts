export enum MS2PvPTier {
  GrandChampion = "Grand Champion",
  Champion = "Champion",
  Diamond = "Diamond",
  Platinum = "Platinum",
  Gold = "Gold",
  Silver = "Silver",
  Bronze = "Bronze",
}

export const MS2PvPTierKr:{[key in string] : MS2PvPTier} = {
  "그랜드 챔피언": MS2PvPTier.GrandChampion,
  "챔피언": MS2PvPTier.Champion,
  "다이아": MS2PvPTier.Diamond,
  "플래티넘": MS2PvPTier.Platinum,
  "골드": MS2PvPTier.Gold,
  "실버": MS2PvPTier.Silver,
  "브론즈": MS2PvPTier.Bronze,
}