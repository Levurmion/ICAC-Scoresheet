import { createServer } from "http";
import { Server } from "socket.io";
import "dotenv/config";
import redisClient from "../lib/redis/redisClient";
import { Response, Request } from "express";
import useSupabaseClient from "../lib/supabase/useSupabaseClient";
import { createMatchSessionId, decodeJWT, getMatchSessionExpiry } from "../lib/utilities";
import { MatchTokenPayload } from "../lib/types";
import { LiveMatch } from "../lib/classes/Match";

const cors = require("cors");
const cookie = require("cookie");
const express = require("express");

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cookie: true,
    connectionStateRecovery: {
        maxDisconnectionDuration: 15 * 60 * 1000, // 15 minutes
        skipMiddlewares: true,
    },
});

// COMPUTED FROM ENVIRONMENT VARIABLES
const sessionExpiry = getMatchSessionExpiry();

app.use(
    cors({
        origin: ["http://frontend", "http://backend"],
    })
);

app.get("/", (req: Request, res: Response) => {
    res.send("Welcome to the /match-server. Provide an access token to join a match.");
});

// middleware to authenticate connections prior to Websocket upgrade
io.use(async (socket, next) => {
    const { request } = socket;
    const clientIp = request.headers["x-forwarded-for"] as string;
    const cookieJar = request.headers.cookie;
    const cookies = cookie.parse(cookieJar as string);
    const accessToken = cookies["match_access_token"];

    const supabase = useSupabaseClient({ req: request as Request });
    const {
        data: { user },
    } = await supabase.auth.getUser();

    try {
        if (user === null) {
            throw new Error("user is unauthenticated");
        }

        const userId = user.id;
        let decodedToken: MatchTokenPayload | undefined;

        try {
            // check if user has a valid token
            decodedToken = decodeJWT(accessToken);
        } catch (error) {
            console.log(error);
        }

        // check if user has an active session in Redis
        const sessionId = createMatchSessionId(clientIp, userId);
        const matchId = await redisClient.get(sessionId);
        const userMetadata = user?.user_metadata

        // if user has both a valid token and active session, check that the matchIds match
        if (matchId && decodedToken) {
            // matchId in session matches token - let through to the match
            if (decodedToken.match_uuid === matchId) {
                socket.data = {
                    ...userMetadata,
                    userId,
                    sessionId,
                    matchId
                }
                return next();
                // matchId in session does not match token - user is trying to access more than 1 match
            } else if (decodedToken.match_uuid !== matchId) {
                throw new Error("user has an active session in another match");
            }

            // user has an active session but no access token - connect to the match with the active session
        } else if (matchId) {
            socket.data = {
                ...userMetadata,
                userId,
                sessionId,
                matchId
            }
            return next();

            // user is joining a new match as they have no active sessions but a valid token
        } else if (decodedToken) {
            // credentials in access token match authentication credentials
            if (userId === decodedToken.user_uuid) {
                await redisClient.SET(sessionId, decodedToken.match_uuid); // save session
                socket.data = {
                    ...userMetadata,
                    userId,
                    sessionId,
                    matchId: decodedToken.match_uuid
                }
                return next();
            } else {
                throw new Error("access token does not match auth credentials");
            }
        }

        throw new Error("user does not have an active session nor a valid access token");
    } catch (error: any) {
        console.log(error);
        next(error);
    }
});

io.on("connection", async (socket) => {

    console.log(socket.id, "connected!");

    // PERSIST session in Redis if client reconnected
    await redisClient.PERSIST(socket.data.sessionId);
    const match = (await LiveMatch.getLiveMatch(socket.data.matchId, redisClient)) as LiveMatch;

    // utility function to sync before and save after all modifications
    async function syncAndSave (callback: (...args: any[]) => any) {
        await match.sync(redisClient)
        callback()
        await match.save(redisClient)
    }

    // ATTACH SERVER EVENT CALLBACKS
    match.on("server:lobby-update", (payload) => {
        console.log('lobby updated!')
        io.to(match.id).emit("server:lobby-update", payload);
    });

    // ATTACH CLIENT EVENT CALLBACKS
    socket.on('client:request-init', (replyCb) => {
        replyCb(JSON.parse(JSON.stringify(match)))
    })

    socket.on("client:leave", async () => {
        await syncAndSave(() => {
            match.removeUser(socket.data.userId)
        })
        const { sessionId } = socket.data;
        await redisClient.DEL(sessionId);
        socket.disconnect();
    });

    socket.on("client:lobby-ready", async () => {
        await syncAndSave(() => {
            match.setReady(socket.data.userId);
        })
    });

    socket.on("client:lobby-unready", async () => {
        await syncAndSave(() => {
            match.setUnready(socket.data.userId)
        })
    });

    socket.on("disconnect", async (reason) => {
        await redisClient.EXPIRE(socket.data.sessionId, sessionExpiry, "NX");
        await syncAndSave(() => {
            match.setDisconnected(socket.data.userId)
        })
        console.log(reason);
    });

    // INITIALIZATION ONLY AFTER ALL EVENT LISTENERS HAVE BEEN ATTACHED!
    const { first_name, last_name, university, userId } = socket.data
    await syncAndSave(() => {
        match.registerUser(userId, first_name, last_name, university)
        match.setConnected(socket.data.userId)
    })

    // divert socket to a match room represented by the matchId
    socket.join(socket.data.matchId);
});

const matchServer = server.listen(3030, async () => {
    await redisClient.connect();
    console.log("match-server listening on port 3030.");
});

// shutdown function
function shutdownCb() {
    matchServer.close(async () => {
        await redisClient.disconnect();
        process.exit(0);
    });
}

// graceful shutdown handlers
process.on("SIGINT", shutdownCb);
process.on("SIGTERM", shutdownCb);
process.on("uncaughtException", (err) => {
    console.error("Unhandled Exception:", err);
});
