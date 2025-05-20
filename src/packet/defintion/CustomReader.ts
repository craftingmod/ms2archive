import { ByteReader } from "ms2packet.ts";

export class CustomReader extends ByteReader {
  public override readInt(): number {
    return this.readUInt()
  }
  public readLong(): bigint {
    return this.readULong()
  }
  public readShort(): number {
    return this.readUShort()
  }
  public readString(): string {
    return this.readUnicodeString()
  }
}