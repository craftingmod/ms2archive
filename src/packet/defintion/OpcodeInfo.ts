import PacketDefJSON from "../../../res/PacketDefinitions.json"

export interface IOpcodeInfo {
  isOutbound: boolean,
  opcode: number,
  name: string,
  ignoreLog: boolean,
}

function parseOpcodeInfo() {
  const outMap = new Map<number, IOpcodeInfo>()
  const inMap = new Map<number, IOpcodeInfo>()

  for (const defintion of PacketDefJSON) {
    if (defintion.isOutbound) {
      outMap.set(defintion.opcode, defintion)
    } else {
      inMap.set(defintion.opcode, defintion)
    }
  }
  return { outMap, inMap }
}

export const OpcodeInfoList = parseOpcodeInfo()