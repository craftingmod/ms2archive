/**
 * 직업 목록 (A-Z 정렬 후에 초보자 추가)
 */
export enum Job {
  UNKNOWN,
  Archer,
  Assassin,
  Berserker,
  HeavyGunner,
  Knight,
  Priest,
  RuneBlader,
  SoulBinder,
  Striker,
  Thief,
  Wizard,
  Beginner,
}

/**
 * 직업 이름
 */
export enum JobName {
  UNKNOWN = "정보 없음",
  Archer = "레인저",
  Assassin = "어쌔신",
  Berserker = "버서커",
  HeavyGunner = "헤비거너",
  Knight = "나이트",
  Priest = "프리스트",
  RuneBlader = "룬블레이더",
  SoulBinder = "소울바인더",
  Striker = "스트라이커",
  Thief = "시프",
  Wizard = "위자드",
  Beginner = "초보자",
}

export const JobCode: { [key in Job]: number } = {
  [Job.UNKNOWN]: -1,
  [Job.Archer]: 50,
  [Job.Assassin]: 80,
  [Job.Berserker]: 20,
  [Job.HeavyGunner]: 60,
  [Job.Knight]: 10,
  [Job.Priest]: 40,
  [Job.RuneBlader]: 90,
  [Job.SoulBinder]: 110,
  [Job.Striker]: 100,
  [Job.Thief]: 70,
  [Job.Wizard]: 30,
  [Job.Beginner]: 1,
}

/**
 * 직업 -> 직업 이름
 */
export const JobNameMap: { [key in Job]: JobName } = [
  JobName.UNKNOWN,
  JobName.Archer,
  JobName.Assassin,
  JobName.Berserker,
  JobName.HeavyGunner,
  JobName.Knight,
  JobName.Priest,
  JobName.RuneBlader,
  JobName.SoulBinder,
  JobName.Striker,
  JobName.Thief,
  JobName.Wizard,
  JobName.Beginner,
]

const jobIconPrefix = `https://ssl.nexon.com/S2/Game/maplestory2/MAVIEW/ranking/`

/**
 * Extract Job from character job icon url
 * @param iconURL Icon URL
 */
export function parseJobFromIcon(iconURL: string): Job {
  if (iconURL.startsWith(jobIconPrefix)) {
    let postfix = iconURL.substring(jobIconPrefix.length)
    postfix = postfix.substring(4)
    postfix = postfix.substring(0, postfix.indexOf(".png")).toLowerCase()
    switch (postfix) {
      case "archer":
        return Job.Archer
      case "assassin":
        return Job.Assassin
      case "berserker":
        return Job.Berserker
      case "heavygunner":
        return Job.HeavyGunner
      case "knight":
        return Job.Knight
      case "priest":
        return Job.Priest
      case "runeblader":
        return Job.RuneBlader
      case "soulbinder":
        return Job.SoulBinder
      case "striker":
        return Job.Striker
      case "thief":
        return Job.Thief
      case "wizard":
        return Job.Wizard
      case "beginner":
        return Job.Beginner
      default:
        return Job.Beginner
    }
  } else {
    return Job.Beginner
  }
}

/**
 * 숫자(인덱싱 같은 거)를 직업으로 변환
 * @param num number
 * @returns 직업
 */
export function numberToJob(num: number) {
  if (Math.floor(num) !== num || num < Job.UNKNOWN || num > Job.Beginner) {
    return Job.UNKNOWN
  }
  return num as Job
}