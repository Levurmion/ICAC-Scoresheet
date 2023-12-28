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
import useSupabaseBasicClient from "../lib/supabase/useSupabaseBasicClient";
import { authenticateConnectionRequest } from "../lib/middlewares";

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
io.use(authenticateConnectionRequest)


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
        // const allParticipantsConnected = currentMatchState.participants.every(participant => participant.connected)
        if (current_state === "open" || current_state === "full") {
            io.to(matchId).emit("lobby-update", currentMatchState)
        } else if (current_state === "stalled" || current_state === "paused") {
            io.to(matchId).emit("pause-match", currentMatchState)
        } else if (previous_state === "paused" || current_state === "finished" || current_state === "reported" || current_state === "saved") {
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
            const { current_state, participants } = currentMatchState

            if (current_state === "open" || current_state === "full") {
                socket.broadcast.to(matchId).emit("lobby-update", currentMatchState)
            } else if (current_state === "paused") {
                await Match.setState(matchId, "stalled", redisClient)
                const updatedMatchState = await Match.getSocketIORedisMatchState(matchId, redisClient)
                socket.broadcast.to(matchId).emit("pause-match", updatedMatchState)
            } else if (current_state === "saved" && participants.length === 0) { // match has been saved and this was the last user
                await Match.deleteRedisMatch(matchId, redisClient)
            }

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
            const { current_state } = currentMatchState
            if (current_state === "confirmation") {
                io.to(matchId).emit("end-confirmation", currentMatchState)
            }

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

                        // get report and save to Supabase
                        const matchReport = await userMatch.getMatchReport()

                        if (matchReport) {
                            try {
                                const supabase = useSupabaseBasicClient()

                                const {
                                    competition,
                                    host,
                                    name,
                                    started_at,
                                    finished_at,
                                    scoresheets
                                } = matchReport

                                // save match first
                                const writeMatch = await supabase
                                    .from("matches")
                                    .insert({
                                        competition,
                                        name,
                                        host,
                                        started_at,
                                        finished_at
                                    })
                                    .select()
                                
                                if (writeMatch.status >= 400) {
                                    throw new Error(writeMatch.error?.message)
                                }

                                const supabaseMatchId = writeMatch.data?.[0].id
                                const scoresheetsWithMatchId = scoresheets.map(scoresheet => {
                                    return {...scoresheet, match_id: supabaseMatchId}
                                })

                                // now save scoresheets
                                const writeScoresheets = await supabase
                                    .from("scoresheets")
                                    .insert(scoresheetsWithMatchId as any)
                                    .select()
                                
                                if (writeScoresheets.status >= 400) {
                                    throw new Error(writeScoresheets.error?.message)
                                }

                                const savedScoresheets = writeScoresheets.data
                                await Match.setState(matchId, "saved", userRedisClient)

                                if (savedScoresheets) {
                                    io.to(matchId).emit("save-update", "OK")
                                }

                            } catch (error: any) {
                                io.to(matchId).emit("save-update", error.message)
                            }
                        }
                    }
                    break
                case "reject":
                    io.to(matchId).emit("end-reset", currentMatchState)
                    break
                case "waiting":
                    io.to(matchId).emit("confirmation-update", currentMatchState)
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

            const currentMatchState = await userMatch.getSocketIORedisMatchState()
            if (action === "reject") {
                io.to(matchId).emit("end-reset", currentMatchState)
            } else if (action === "waiting") {
                io.to(matchId).emit("confirmation-update", currentMatchState)
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

        const { current_state } = await Match.getState(matchId, redisClient)

        // expire session if match is not finished
        if (current_state !== "finished" && current_state !== "reported") {
            await redisClient.expire(socket.data.sessionId, sessionExpirySeconds)
            console.log(reason, `${socket.data.sessionId} expiring in ${sessionExpirySeconds}...`)
        }

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
            const matchId = await redisClient.HGET("active-sessions", expiredKey) as string
            await Match.syncExpiredSession(expiredKey, redisClient)
            const { current_state, previous_state } = await Match.getState(matchId, redisClient)
            console.log("cleared: ", expiredKey)

            // if session expired while match was paused, stall the match
            if (current_state === "paused") {
                await Match.setState(matchId, "stalled", redisClient)
            }
        }
    });

    // start expiring all previous instance that could have persisted due to a crash
    const sessionIds = await redisClient.KEYS("match-session:*")
    for (const sessionId of sessionIds) {
        await redisClient.EXPIRE(sessionId, sessionExpirySeconds, "NX")
        console.log("expiring: ", sessionId)
    }

    // notify listening
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
