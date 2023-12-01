import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from 'cors'
import { clearInterval } from "timers";
import 'dotenv/config'
import redisClient from "../lib/redis/useRedisClient.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cookie: true
});

app.use(cors({
    origin: [
        "http://frontend",
        "http://backend"
    ]
}))

app.get("/", (req, res) => {
    res.send("Welcome to the /match-server. Provide an access token to join a match.");
});

io.on('connection', (socket) => {
    console.log(socket.id, 'connected!')
    socket.emit('greetings', `Welcome!`)

    socket.on('echo', (msg: string) => {
        console.log(`echoing ${msg}!`)
        socket.emit('echo', msg)
    })
})

const matchServer = server.listen(3030, async () => {
    await redisClient.connect()
    console.log("match-server listening on port 3030.");
});

// shutdown function
function shutdownCb () {
    matchServer.close(async () => {
        await redisClient.disconnect()
        process.exit(0)
    })
}

// graceful shutdown handlers
process.on('SIGINT', shutdownCb);
process.on('SIGTERM', shutdownCb);
process.on('uncaughtException', async (err) => {
    console.error('Unhandled Exception:', err);
    await redisClient.disconnect()
});
