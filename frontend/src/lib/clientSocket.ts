import { io, Socket } from "socket.io-client"
import { ClientToServerEvents, ServerToClientEvents } from "./types"

const clientSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
    path: '/match-server/socket.io/',
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnection: true,
    transports: ["websocket"]
})

export default clientSocket