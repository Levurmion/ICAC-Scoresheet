import { NextFunction, Request, Response } from "express";
import useSupabaseClient from "./supabase/useSupabaseClient";
import { Socket } from "socket.io";
import { MatchTokenPayload, UserSession } from "./types";
import { decodeJWT, saveDataIntoSocket } from "./utilities";
import Match from "./classes/Match";
import redisClient from "./redis/redisClient";

const cookie = require("cookie")

// authentication middleware
export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const supabase = useSupabaseClient({ req });
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user === null) {
        res.sendStatus(401);
        return;
    } else {
        next();
    }
}

export async function authenticateConnectionRequest (socket: Socket, next: (err?: any) => void) {

    console.log("connection attempted...")

    // permit access for development
    const { devToken } = socket.handshake.auth
    console.log(devToken)
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
        const sessionExists = await Match.getSession(devToken.user_id, redisClient);
        if (sessionExists) {
            saveDataIntoSocket(socket, devToken.match_uuid, devToken.user_uuid, Match.createUserSessionId(devToken.user_id));
            next()
            return
        }

        const sessionId = await Match.setSession(devUserSession, redisClient);
        if (sessionId) {
            saveDataIntoSocket(socket, devToken.match_uuid, devToken.user_uuid, sessionId);
            next();
            return
        }
    }

    const { request } = socket;
    const cookieJar = request.headers.cookie;
    const cookies = cookie.parse(cookieJar as string);
    const supabase = useSupabaseClient({ req: request as Request });
    const authResponse = await supabase.auth.getUser();

    if (authResponse.error) {
        console.log(authResponse.error)
        next(new Error('authentication error'));
        return
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
            return next(new Error(`Access token error: ${error.message}.`));
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
                return next(new Error("Failed to set a new session."));
            }
        } else {
            return next(new Error("Access and auth token credentials did not match."));
        }
    } else {
        return next(new Error("User does not have a valid session/access token."));
    }
}