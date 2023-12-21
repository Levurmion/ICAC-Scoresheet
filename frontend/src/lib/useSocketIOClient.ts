import { io } from "socket.io-client"

const clientSocket = io({
    path: '/match-server/socket.io/',
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnection: true
})

export default clientSocket