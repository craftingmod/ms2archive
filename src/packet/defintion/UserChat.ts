export interface UserChatSend {
  message: string,
}

export interface UserChatRecv {
  accountId: bigint,
  characterId: bigint,
  username: string,
  useStringId: false,
  message: string,
  type: 0,
  unknown1?: unknown,
  channel: number,
  isMentorRelated: false,
}