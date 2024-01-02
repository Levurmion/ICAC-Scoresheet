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
import { randomUUID } from "crypto";
import useSupabaseBasicClient from "../lib/supabase/useSupabaseBasicClient";
import { authenticateConnectionRequest } from "../lib/middlewares";
import { createAdapter } from "@socket.io/redis-streams-adapter";

const cors = require("cors");
const cookie = require("cookie");
const express = require("express");

const app = express();
const server = createServer(app);

const socketIOStreamsClient = redisClient.duplicate();
(async () => {
    await socketIOStreamsClient.connect();
})();

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server, {
    cookie: true,
    adapter: createAdapter(socketIOStreamsClient),
});

// COMPUTED FROM ENVIRONMENT VARIABLES
const sessionExpirySeconds = getSessionExpirySeconds();

// SESSION EXPIRY CLEANUP CLIENT
const cleanupClient = redisClient.duplicate();

app.use(
    cors({
        origin: ["http://frontend", "http://backend"],
        credentials: true,
    })
);

app.get("/", (req: Request, res: Response) => {
    res.send("Welcome to the /match-server. Provide an access token to join a match.");
});

// middleware to authenticate connections prior to Websocket upgrade
io.use(authenticateConnectionRequest);

// Socket.IO entrypoint
io.on("connection", async (socket) => {
    const { sessionId, matchId, userId } = socket.data;

    // make socket join a match room identified by the matchId
    console.log(socket.data.userId, "connected!");
    socket.join(matchId);

    // create the user's match instance with a separate redisClient
    const userRedisClient = redisClient.duplicate();
    await userRedisClient.connect();
    const userMatch = (await Match.initMatchForUser(userId, userRedisClient)) as Match;

    // ping successful connection
    socket.emit("connected", `Welcome to the /match-server. This is ${matchId}.`);

    // broadcast current match state with the NEW PARTICIPANT to everyone in the room
    try {
        // update connection status to connected regardless which also cancels session expiry
        await userMatch.setConnect();

        const currentMatchState = await userMatch.getSocketIORedisMatchState();
        const { current_state, previous_state } = currentMatchState;
        // const allParticipantsConnected = currentMatchState.participants.every(participant => participant.connected)
        if (current_state === "open" || current_state === "full") {
            io.to(matchId).emit("lobby-update", currentMatchState);
        } else if (current_state === "stalled" || current_state === "paused") {
            io.to(matchId).emit("pause-match", currentMatchState);
        } else if (previous_state === "paused" || current_state === "finished" || current_state === "reported" || current_state === "saved" || current_state === "save error") {
            io.to(matchId).emit("resume-match", currentMatchState);
        }
    } catch (error: any) {
        io.to(matchId).emit("lobby-update:error", error.message);
    }

    // LOBBY EVENTS
    socket.on("user-leave", async (replyCb) => {
        try {
            const matchExists = await userRedisClient.json.GET(matchId)
            if (!matchExists) { // match has been deleted by host
                replyCb("OK")
            } else {
                await userMatch.leaveMatch();
                replyCb("OK");
    
                // broadcast update to match room
                const currentMatchState = await Match.getSocketIORedisMatchState(matchId, redisClient);
                const { current_state, participants } = currentMatchState;
    
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
            await userMatch.setReady();

            // broadcast update to match room
            const currentMatchState = await userMatch.getSocketIORedisMatchState();
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
            await userMatch.setUnready();

            // broadcast update to match room
            const currentMatchState = await userMatch.getSocketIORedisMatchState();
            io.to(matchId).emit("lobby-update", currentMatchState);
        } catch (error: any) {
            io.to(matchId).emit("lobby-update:error", error.message);
        }
    });

    // SUBMISSION EVENTS
    socket.on("user-submit", async (scores: Score[], replyCb: (reply: string) => void) => {
        try {
            await userMatch.submitEndArrows(scores);
            replyCb("OK");

            // broadcast update to match room
            const currentMatchState = await userMatch.getSocketIORedisMatchState();
            const { current_state } = currentMatchState;
            if (current_state === "confirmation") {
                io.to(matchId).emit("end-confirmation", currentMatchState);
            }
        } catch (error: any) {
            replyCb(error.message);
        }
    });

    // CONFIRMATION EVENTS
    socket.on("user-confirm", async (replyCb: (reply: string) => void) => {
        try {
            const action = await userMatch.confirmEnd();
            replyCb("OK");

            const currentMatchState = await userMatch.getSocketIORedisMatchState();
            const { current_state } = currentMatchState;
            switch (action) {
                case "proceed":
                    if (current_state === "submit") {
                        io.to(matchId).emit("end-submit", currentMatchState);
                    } else if (current_state === "finished") {
                        io.to(matchId).emit("match-finished", currentMatchState);

                        // get report and save to Supabase
                        const matchReport = await userMatch.getMatchReport();

                        if (matchReport) {
                            try {
                                const supabase = useSupabaseBasicClient();

                                const { competition, host, name, started_at, finished_at, scoresheets } = matchReport;

                                // save match first
                                const writeMatch = await supabase
                                    .from("matches")
                                    .insert({
                                        competition,
                                        name,
                                        host,
                                        started_at,
                                        finished_at,
                                    })
                                    .select();

                                if (writeMatch.status >= 400) {
                                    await Match.setState(matchId, "save error", redisClient);
                                    throw new Error(writeMatch.error?.message);
                                }

                                const supabaseMatchId = writeMatch.data?.[0].id;
                                const scoresheetsWithMatchId = scoresheets.map((scoresheet) => {
                                    return { ...scoresheet, match_id: supabaseMatchId };
                                });

                                // now save scoresheets
                                const writeScoresheets = await supabase
                                    .from("scoresheets")
                                    .insert(scoresheetsWithMatchId as any)
                                    .select();

                                if (writeScoresheets.status >= 400) {
                                    await Match.setState(matchId, "save error", userRedisClient);
                                    throw new Error(writeScoresheets.error?.message);
                                }

                                const savedScoresheets = writeScoresheets.data;
                                await Match.setState(matchId, "saved", userRedisClient);
                                const currentMatchState = await Match.getSocketIORedisMatchState(matchId, userRedisClient);

                                if (savedScoresheets) {
                                    io.to(matchId).emit("save-update", currentMatchState);
                                }
                            } catch (error: any) {
                                // stall match
                                await Match.setState(matchId, "save error", userRedisClient);
                                const currentMatchState = await Match.getSocketIORedisMatchState(matchId, userRedisClient);
                                io.to(matchId).emit("save-update", currentMatchState);
                            }
                        }
                    }
                    break;
                case "reject":
                    io.to(matchId).emit("end-reset", currentMatchState);
                    break;
                case "waiting":
                    io.to(matchId).emit("confirmation-update", currentMatchState);
                    break;
            }
        } catch (error: any) {
            replyCb(error.message);
        }
    });

    socket.on("user-reject", async (replyCb: (reply: string) => void) => {
        try {
            const action = await userMatch.rejectEnd();
            replyCb("OK");

            const currentMatchState = await userMatch.getSocketIORedisMatchState();
            if (action === "reject") {
                io.to(matchId).emit("end-reset", currentMatchState);
            } else if (action === "waiting") {
                io.to(matchId).emit("confirmation-update", currentMatchState);
            }
        } catch (error: any) {
            replyCb(error.message);
        }
    });

    // DISCONNECTION EVENTS
    socket.on("disconnect", async (reason) => {
        if (reason === "transport close" || reason === "client namespace disconnect") {
            await userMatch.setDisconnect(sessionExpirySeconds);

            const currentMatchState = await userMatch.getSocketIORedisMatchState();
            const { current_state } = currentMatchState;

            if (current_state === "open" || current_state === "full") {
                socket.broadcast.to(matchId).emit("lobby-update", currentMatchState);
            } else if (current_state === "paused") {
                socket.broadcast.to(matchId).emit("pause-match", currentMatchState);
            }
        }

        // if cache is slower than reconnection, there will be a chance that users reconnect before
        // the code below this line manages to execute - result will be a race condition whereby
        // 1. user reconnect - session refreshed (without expiry having been set)
        // 2. current_state obtained
        // 3. if match is running (not finished or reported), the session will get expired anyway
        //
        // Maybe we perform a transaction within userMatch.setDisconnect()?

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
