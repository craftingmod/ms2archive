import { PacketServer } from "./packet/PacketServer.ts"

const packetServer = new PacketServer(3210)
packetServer.listen()
