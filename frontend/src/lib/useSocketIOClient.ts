import { io } from "socket.io-client"

export default function useSocketIOClient () {
    const clientSocket = io({
        autoConnect: false,
        path: '/match-server/socket.io/'
    })
    return clientSocket
}