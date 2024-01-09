import { createServer } from "http";
import { Server } from "socket.io";
import "dotenv/config";
import redisClient from "../lib/redis/redisClient";
import { Response, Request } from "express";
import useSupabaseClient from "../lib/supabase/useSupabaseClient";
import { decodeJWT, getSession, getSessionExpirySeconds, saveDataIntoSocket, setSession } from "../lib/utilities";
import {
    ClientToServerEvents,
    InterServerEvents,
    MatchTokenPayload,
    Score,
    ServerToClientEvents,
    SocketData,
    SocketIORedisMatchState,
    UserSession,
} from "../lib/types";
import Match from "../lib/classes/Match";
import { Archer } from "../lib/classes/Archer";
import { randomUUID } from "crypto";
import useSupabaseBasicClient from "../lib/supabase/useSupabaseBasicClient";
import { authenticateConnectionRequest } from "../lib/middlewares";
import { createAdapter } from "@socket.io/redis-streams-adapter";
import initArcherSocket from "../lib/socket-initializers/initArcherSocket";

const cors = require("cors");
const express = require("express");
const app = express();
const server = createServer(app);

// COMPUTED FROM ENVIRONMENT VARIABLES
const sessionExpirySeconds = getSessionExpirySeconds();

// SESSION EXPIRY CLEANUP AND SOCKET.IO STREAMS ADAPTER CLIENTS
const cleanupClient = redisClient.duplicate();
const socketIOStreamsClient = redisClient.duplicate();
(async () => {
    await socketIOStreamsClient.connect();
})();

app.use(
    cors({
        origin: ["http://frontend", "http://backend"],
        credentials: true,
    })
);

// SocketIO Server
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
    cookie: true,
    connectionStateRecovery: {
        maxDisconnectionDuration: 60000,
        skipMiddlewares: true
    },
    adapter: createAdapter(socketIOStreamsClient),
});
io.use(authenticateConnectionRequest);

// Socket.IO entrypoint
io.on("connection", async (socket) => {
    const { sessionId, matchId, userId, role } = socket.data;

    // make socket join a match room identified by the matchId
    console.log(socket.data.userId, "connected!");
    socket.join(matchId);

    // create the user's match instance with a separate redisClient
    const userRedisClient = redisClient.duplicate();
    await userRedisClient.connect();

    // initialize socket with appropriate event listeners depending on user role
    let user: Archer
    if (role === "archer") {
        user = await Archer.initArcher(userId, userRedisClient) as Archer
        await initArcherSocket(socket, io, user, redisClient, userRedisClient)
    }

    // LOBBY EVENTS
    socket.on("user-leave", async (replyCb) => {
        try {
            const matchExists = await userRedisClient.json.GET(matchId)
            if (!matchExists) { // match has been deleted by host
                replyCb("OK")
            } else {
                await user.leaveMatch();
                replyCb("OK");
    
                // broadcast update to match room
                const currentMatchState = await Match.getSocketIORedisMatchState(matchId, redisClient);
                const { current_state } = currentMatchState;
    
                if (current_state === "open") {
                    socket.broadcast.to(matchId).emit("lobby-update", currentMatchState);
                } else if (current_state === "paused" || current_state === "stalled") {
                    socket.broadcast.to(matchId).emit("pause-match", currentMatchState);
                }
            }

            // gracefully disconnect
            socket.disconnect();
            await userRedisClient.disconnect();
        } catch (error: any) {
            replyCb(error.message);
        }
    });

    socket.on("user-ready", async () => {
        try {
            await user.setReady();

            // broadcast update to match room
            const currentMatchState = await user.getSocketIORedisMatchState();
            const { current_state } = currentMatchState;

            if (current_state === "submit") {
                io.to(matchId).emit("end-submit", currentMatchState);
            } else {
                io.to(matchId).emit("lobby-update", currentMatchState);
            }
        } catch (error: any) {
            io.to(matchId).emit("lobby-update:error", error.message);
        }
    });

    socket.on("user-unready", async () => {
        try {
            await user.setUnready();

            // broadcast update to match room
            const currentMatchState = await user.getSocketIORedisMatchState();
            io.to(matchId).emit("lobby-update", currentMatchState);
        } catch (error: any) {
            io.to(matchId).emit("lobby-update:error", error.message);
        }
    });


    // DISCONNECTION EVENTS
    socket.on("disconnect", async (reason) => {
        if (reason === "transport close" || reason === "client namespace disconnect") {
            await user.setDisconnect(sessionExpirySeconds);

            const currentMatchState = await user.getSocketIORedisMatchState();
            const { current_state } = currentMatchState;

            if (current_state === "open" || current_state === "full") {
                socket.broadcast.to(matchId).emit("lobby-update", currentMatchState);
            } else if (current_state === "paused") {
                socket.broadcast.to(matchId).emit("pause-match", currentMatchState);
            }
        }

        // disconnect userRedisClient
        await userRedisClient.disconnect();
    });
});

const matchServer = server.listen(process.env.PORT, async () => {
    // setup Redis clients
    await redisClient.connect();
    await cleanupClient.connect();
    await cleanupClient.pSubscribe("__keyevent@0__:expired", async (expiredKey: string, channel: string) => {
        if (expiredKey.startsWith("match-session:")) {
            await Match.syncExpiredSession(expiredKey, redisClient);
            console.log("cleared: ", expiredKey);
        }
    });

    // start expiring all previous instance that could have persisted due to a crash
    const sessionIds = await redisClient.KEYS("match-session:*");
    for (const sessionId of sessionIds) {
        await redisClient.EXPIRE(sessionId, sessionExpirySeconds, "NX");
        console.log("expiring: ", sessionId);
    }

    // notify listening
    console.log(`match-server listening on port ${process.env.PORT}.`);
});

// shutdown function
matchServer.on('close' ,async () => {
    await redisClient.disconnect();
    await cleanupClient.disconnect();
    process.exit(0);
});

// server error handlers
process.on("uncaughtException", (err) => {
    console.error("Unhandled Exception:", err);
});
