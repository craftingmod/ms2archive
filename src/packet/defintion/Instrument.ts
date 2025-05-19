export function getInstrumentOpcode(isKMS2: boolean) {
  return isKMS2 ? 0x74 : 0x75  
}