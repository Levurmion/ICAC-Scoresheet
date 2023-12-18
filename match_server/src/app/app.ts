import { createServer } from "http";
import { Server } from "socket.io";
import "dotenv/config";
import redisClient from "../lib/redis/redisClient";
import { Response, Request } from "express";
import useSupabaseClient from "../lib/supabase/useSupabaseClient";
import { decodeJWT, getSession, getSessionExpirySeconds, saveDataIntoSocket, setSession } from "../lib/utilities";
import { MatchTokenPayload, UserSession } from "../lib/types";
import { LiveMatch } from "../lib/classes/deprecated/Match";
import Match from "../lib/classes/Match";

const cors = require("cors");
const cookie = require("cookie");
const express = require("express");

const app = express();
const server = createServer(app);
const io = new Server(server, {
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
    })
);

app.get("/", (req: Request, res: Response) => {
    res.send("Welcome to the /match-server. Provide an access token to join a match.");
});

// middleware to authenticate connections prior to Websocket upgrade
io.use(async (socket, next) => {
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
                saveDataIntoSocket(socket, accessToken.match_uuid, authToken.id, sessionId);
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
    console.log(socket.data.userId, "connected!");
    // cancel session expiry
    await redisClient.PERSIST(socket.data.sessionId)


    socket.on('disconnect', async (reason) => {
        await redisClient.expire(socket.data.sessionId, sessionExpirySeconds)
        console.log(reason, `${socket.data.sessionId} expiring in ${sessionExpirySeconds}...`)
    })
});

const matchServer = server.listen(3030, async () => {
    await redisClient.connect();
    await cleanupClient.connect();
    await cleanupClient.pSubscribe("__keyevent@0__:expired", async (expiredKey: string, channel: string) => {
        if (expiredKey.startsWith("match-session:")) {
            await Match.syncExpiredSession(expiredKey, redisClient)
            console.log("cleared: ", expiredKey)
        }
    });
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
