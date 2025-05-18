import { PacketServer } from "../packet/PacketServer.ts"

/* eslint-disable no-var, @typescript-eslint/no-unused-vars */
declare var self: Worker

const packetServer = new PacketServer(3210)
packetServer.listen()
