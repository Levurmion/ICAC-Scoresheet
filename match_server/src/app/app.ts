import { createServer } from "http";
import { Server } from "socket.io";
import "dotenv/config";
import redisClient from "../lib/redis/redisClient";
import { Response, Request } from "express";
import useSupabaseClient from "../lib/supabase/useSupabaseClient";
import { decodeJWT, getSession, getSessionExpirySeconds, saveDataIntoSocket, setSession } from "../lib/utilities";
import { ClientToServerEvents, InterServerEvents, MatchTokenPayload, Score, ServerToClientEvents, SocketData, SocketIORedisMatchState, UserSession } from "../lib/types";
import Match from "../lib/classes/Match";
import { randomUUID } from "crypto";

const cors = require("cors");
const cookie = require("cookie");
const express = require("express");

const app = express();
const server = createServer(app);
const io = new Server<
ClientToServerEvents,
ServerToClientEvents,
InterServerEvents,
SocketData
>(server, {
    cookie: true,
    connectionStateRecovery: {
        maxDisconnectionDuration: 5 * 1000, // 5 minutes
        skipMiddlewares: true,
    },
});

// COMPUTED FROM ENVIRONMENT VARIABLES
const sessionExpirySeconds = getSessionExpirySeconds();

// SESSION EXPIRY CLEANUP CLIENT
const cleanupClient = redisClient.duplicate();

app.use(
    cors({
        origin: ["http://frontend", "http://backend"],
        credentials: true
    })
);

app.get("/", (req: Request, res: Response) => {
    res.send("Welcome to the /match-server. Provide an access token to join a match.");
});

// middleware to authenticate connections prior to Websocket upgrade
io.use(async (socket, next) => {

    console.log("connection attempted...")

    // permit access for development
    const { devToken } = socket.handshake.auth
    if (devToken) {
        console.log('connecting with devToken')
        const devUserSession: UserSession<"archer"> = {
            match_id: devToken.match_uuid,
            user_id: devToken.user_uuid,
            first_name: "Test",
            last_name: devToken.user_uuid,
            ready: false,
            university: "Some University",
            role: devToken.role,
            scores: [],
            ends_confirmed: [],
            connected: true,
        };
        const sessionId = await Match.setSession(devUserSession, redisClient);
        if (sessionId) {
            saveDataIntoSocket(socket, devToken.match_uuid, devToken.user_uuid, sessionId);
            next();
            return
        }
    }

    // will allow multiple users by virtue of generating random UUIDs for the User
    // DOES NOT PERSIST SESSIONS between reconnections because UserID keeps changing
    // old sessions will be automatically expired and cleaned up
    // vvvvv uncomment for offline development ===============
    // const offlineToken: MatchTokenPayload = {
    //     match_uuid: "match:80d4a076-5041-4736-aa07-cadd4a6fac46", // replace with an existing match
    //     user_uuid: randomUUID(),
    //     role: "archer"
    // }
    // const offlineSessionPayload: UserSession = {
    //     match_id: offlineToken.match_uuid,
    //     user_id: offlineToken.user_uuid,
    //     first_name: "Elbert",
    //     last_name: `Timothy${Math.random()}`,
    //     university: "Imperial College London",
    //     ready: false,
    //     connected: true,
    //     role: offlineToken.role,
    //     scores: [],
    //     ends_confirmed: []
    // }
    // const sessionId = await Match.setSession(offlineSessionPayload, redisClient);
    // if (sessionId) {
    //     saveDataIntoSocket(socket, offlineToken.match_uuid, offlineToken.user_uuid, sessionId);
    //     next();
    //     return
    // }
    // ^^^^ uncomment for offline development ============


    const { request } = socket;
    const cookieJar = request.headers.cookie;
    const cookies = cookie.parse(cookieJar as string);
    const supabase = useSupabaseClient({ req: request as Request });
    const authResponse = await supabase.auth.getUser();

    if (authResponse.error) {
        console.log(authResponse.error)
        throw new Error('authentication error');
    }

    const accessToken = cookies["match_access_token"];
    const authToken = authResponse.data.user;
    const userId = authToken.id

    // attempt to get user session from Redis
    const userSession = await Match.getSession(userId, redisClient);

    if (userSession) {
        const sessionId = Match.createUserSessionId(userId)
        saveDataIntoSocket(socket, userSession.match_id, userId, sessionId);
        next();
    } else if (accessToken) {
        // verify, throw error otherwise
        let tokenPayload: MatchTokenPayload;
        try {
            tokenPayload = decodeJWT(accessToken);
        } catch (error: any) {
            throw new Error(`Access token error: ${error.message}.`);
        }

        if (tokenPayload.user_uuid === authToken.id) {
            const userMetadata = authToken.user_metadata
            const sessionPayload: UserSession = {
                match_id: tokenPayload.match_uuid,
                user_id: userId,
                first_name: userMetadata.first_name,
                last_name: userMetadata.last_name,
                university: userMetadata.university,
                ready: false,
                connected: true,
                role: tokenPayload.role,
                scores: [],
                ends_confirmed: []
            }

            const sessionId = await Match.setSession(sessionPayload, redisClient);
            if (sessionId) {
                // remove reservation
                await redisClient.DEL(`reservation:${tokenPayload.match_uuid}:${authToken.id}`)
                saveDataIntoSocket(socket, tokenPayload.match_uuid, authToken.id, sessionId);
                next();
            } else {
                throw new Error("Failed to set a new session.");
            }
        } else {
            throw new Error("Access and auth token credentials did not match.");
        }
    } else {
        throw new Error("User does not have a valid session/access token.");
    }
});

io.on("connection", async (socket) => {

    const {
        sessionId,
        matchId,
        userId
    } = socket.data

    // make socket join a match room identified by the matchId
    console.log(socket.data.userId, "connected!");
    socket.join(matchId)

    // cancel session expiry
    await redisClient.PERSIST(sessionId)

    // create the user's match instance with a separate redisClient
    const userRedisClient = redisClient.duplicate()
    await userRedisClient.connect()
    const userMatch = await Match.initMatchForUser(userId, userRedisClient) as Match

    // ping successful connection
    socket.emit("connected", `Welcome to the /match-server. This is ${matchId}.`)

    // broadcast current match state with the NEW PARTICIPANT to everyone in the room
    try {
        // update connection status to connected regardless
        await userMatch.setConnect()

        const currentMatchState = await userMatch.getSocketIORedisMatchState()
        const { current_state, previous_state } = currentMatchState
        if (current_state === "open" || current_state === "full") {
            io.to(matchId).emit("lobby-update", currentMatchState)
        } else if (previous_state === "paused") {
            io.to(matchId).emit("resume-match", currentMatchState)
        }

    } catch (error: any) {
        io.to(matchId).emit("lobby-update:error", error.message)
    }

    // LOBBY EVENTS
    socket.on("user-leave", async (replyCb) => {
        try {
            await userMatch.leaveMatch()
            replyCb("OK")

            // broadcast update to match room
            const currentMatchState = await Match.getSocketIORedisMatchState(matchId, redisClient)
            socket.broadcast.to(matchId).emit("lobby-update", currentMatchState)

            // gracefully disconnect
            socket.disconnect()
            await userRedisClient.disconnect()

        } catch (error: any) {
            replyCb(error.message)
        }
    })

    socket.on("user-ready", async () => {
        try {
            await userMatch.setReady()

            // broadcast update to match room
            const currentMatchState = await userMatch.getSocketIORedisMatchState()
            const { current_state } = currentMatchState

            if (current_state === "submit") {
                io.to(matchId).emit("end-submit", currentMatchState)
            } else {
                io.to(matchId).emit("lobby-update", currentMatchState)
            }

        } catch (error: any) {
            io.to(matchId).emit("lobby-update:error", error.message)
        }
    })

    socket.on("user-unready", async () => {
        try {
            await userMatch.setUnready()

            // broadcast update to match room
            const currentMatchState = await userMatch.getSocketIORedisMatchState()
            io.to(matchId).emit("lobby-update", currentMatchState)

        } catch (error: any) {
            io.to(matchId).emit("lobby-update:error", error.message)
        }
    })

    // SUBMISSION EVENTS
    socket.on("user-submit", async (scores: Score[], replyCb: (reply: string) => void) => {
        try {
            await userMatch.submitEndArrows(scores)
            replyCb("OK")

            // broadcast update to match room
            const currentMatchState = await userMatch.getSocketIORedisMatchState()
            io.to(matchId).emit("end-confirmation", currentMatchState)

        } catch (error: any) {
            replyCb(error.message)
        }
    })

    // CONFIRMATION EVENTS
    socket.on("user-confirm", async (replyCb: (reply: string) => void) => {
        try {
            const action = await userMatch.confirmEnd()
            replyCb("OK")
            
            const currentMatchState = await userMatch.getSocketIORedisMatchState()
            const { current_state } = currentMatchState
            switch (action) {
                case "proceed":
                    if (current_state === "submit") {
                        io.to(matchId).emit("end-submit", currentMatchState)
                    } else if (current_state === "finished") {
                        io.to(matchId).emit("match-finished", currentMatchState)
                    }
                    break
                case "reject":
                    io.to(matchId).emit("end-reset", currentMatchState)
                    break
            }

        } catch (error: any) {
            replyCb(error.message)
        }
    })

    socket.on("user-reject", async (replyCb: (reply: string) => void) => {
        try {
            const action = await userMatch.rejectEnd()
            replyCb("OK")

            if (action === "reject") {
                const currentMatchState = await userMatch.getSocketIORedisMatchState()
                io.to(matchId).emit("end-reset", currentMatchState)
            }

        } catch (error: any) {
            replyCb(error.message)
        }
    })

    // DISCONNECTION EVENTS
    socket.on('disconnect', async (reason) => {
        if (reason === "transport close" || reason === "client namespace disconnect") {
            await userMatch.setDisconnect()
            const currentMatchState = await userMatch.getSocketIORedisMatchState()
            const {current_state} = currentMatchState

            if (current_state === "open" || current_state === "full") {
                socket.broadcast.to(matchId).emit("lobby-update", currentMatchState)
            } else if (current_state === "paused") {
                socket.broadcast.to(matchId).emit("pause-match", currentMatchState)
            }
        }

        // expire session anyway - whether it exists or not to be safe
        await redisClient.expire(socket.data.sessionId, sessionExpirySeconds)
        console.log(reason, `${socket.data.sessionId} expiring in ${sessionExpirySeconds}...`)

        // disconnect userRedisClient
        await userRedisClient.disconnect()
    })
});



const matchServer = server.listen(3030, async () => {
    // setup Redis clients
    await redisClient.connect();
    await cleanupClient.connect();
    await cleanupClient.pSubscribe("__keyevent@0__:expired", async (expiredKey: string, channel: string) => {
        if (expiredKey.startsWith("match-session:")) {
            await Match.syncExpiredSession(expiredKey, redisClient)
            console.log("cleared: ", expiredKey)
        }
    });

    // start expiring all previous instance that could have persisted due to a crash
    const sessionIds = await redisClient.KEYS("match-session:*")
    for (const sessionId of sessionIds) {
        await redisClient.EXPIRE(sessionId, sessionExpirySeconds, "NX")
        console.log("expiring: ", sessionId)
    }
    console.log("match-server listening on port 3030.");
});

// shutdown function
function shutdownCb() {
    matchServer.close(async () => {
        await redisClient.disconnect();
        await cleanupClient.disconnect();
        process.exit(0);
    });
}

// graceful shutdown handlers
process.on("SIGINT", shutdownCb);
process.on("SIGTERM", shutdownCb);
process.on("uncaughtException", (err) => {
    console.error("Unhandled Exception:", err);
});
