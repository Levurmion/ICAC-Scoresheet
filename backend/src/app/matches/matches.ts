import redisClient from "../../lib/redis/useRedisClient";
import { Router } from "express";
import { MatchParams, LiveMatch, MatchTokenPayload } from "../../lib/types";
import { authenticate } from "../../lib/middlewares";
import { v4 as uuid4 } from "uuid";
import { RedisJSON } from "@redis/json/dist/commands";
import useSupabaseClient from "../../lib/supabase/useSupabaseClient";
import { getRedisMatch, getRedisMatchReservations, getUserId, isValidAlphanumeric, setRedisMatchReservation } from "../../lib/utilities";
import { isRestrictedMatch, isValidLiveMatchState } from "../../lib/typeGuards";
import "dotenv/config";

const jwt = require("jsonwebtoken");
const matches = Router();

// authenticate everything in this route
matches.use(authenticate);

// create a new match
matches.post("/", async (req, res) => {
    const matchParams: MatchParams = req.body;
    const { name, max_participants, arrows_per_end, num_ends } = matchParams;
    const host = await getUserId({ req, res });

    // if one of the required fields are missing
    if ([name, max_participants, arrows_per_end, num_ends].some((param) => param === undefined || null)) {
        return res.status(400).send("missing required fields");
    } else if (!isValidAlphanumeric(name)) {
        return res.status(400).send("match name is not a valid alphanumeric string with underscores or spaces");
    }

    if (host === false) {
        return res.sendStatus(401);
    }

    const matchUUID = uuid4();
    const match: LiveMatch = {
        ...matchParams,
        host,
        created_at: new Date(),
        current_end: 0,
        current_state: "open",
        previous_state: "open",
        participants: {},
    };

    // check if an exact match name exists
    if ((await redisClient.ft.search("idx:matches", `@name:"${name}"`)).total > 0) {
        return res.status(409).send("name already taken by an existing live match");
    } else {
        await redisClient.json.SET(`match:${matchUUID}`, "$", match as unknown as RedisJSON);
        return res.sendStatus(201);
    }
});

// retrieve an existing (live/completed) match
matches.get("/:match_name", async (req, res) => {
    const { match_name } = req.params;
    const { state, host_only } = req.query;
    // assert type because user already authenticated by middleware
    const host = (await getUserId({ req, res })) as string;

    // perform request validation
    // determine 400 status message if validation fails
    res.status(400);
    if (match_name === undefined) {
        return res.send("no match name provided");
    } else if (match_name === "*" && host_only !== "true") {
        return res.send("wildcard character not allowed without switching `host_only` to `true`");
    } else if (state !== undefined && state !== "live" && !isValidLiveMatchState(state)) {
        return res.send("the queried state was not a valid live match state");
    }

    // request valid, determine whether request was asking for a completed/live match
    if (state === undefined) {
        const supabase = useSupabaseClient({ req, res });
        const supabaseRequest = supabase.from("matches").select("*").ilike("name", `%${match_name}%`);
        const { data, error } = host_only === "true" ? await supabaseRequest.eq("host", host) : await supabaseRequest;

        if (error) {
            return res.status(Number(error.code)).send(error.hint);
        } else if (data.length > 0) {
            return res.status(200).json(data);
        } else if (data.length === 0) {
            return res.sendStatus(204);
        }
    } else {
        const nameQuery = match_name === "*" ? "" : `@name:*${match_name}*`;
        let stateQuery: string | undefined = undefined;
        let hostQuery: string | undefined = undefined;

        // generate stateQuery
        if (state === "live") {
            // leave as is
        } else if (Array.isArray(state)) {
            stateQuery = "live" in state ? "" : `@current_state:(${state.join("|")})`;
        } else if (typeof state === "string") {
            stateQuery = `@current_state:${state}`;
        }

        // generate hostQuery
        if (host_only === "true") {
            const supabase = useSupabaseClient({ req, res });
            // escape hyphens in UUID
            hostQuery = `@host:{${host.replace(/-/g, "\\-")}}`;
        }

        const redisQuery = [nameQuery, stateQuery, hostQuery].filter((val) => val !== undefined).join(" ");
        const matches = await redisClient.ft.SEARCH("idx:matches", redisQuery);

        if (matches.total > 0) {
            res.status(200).json(matches.documents);
        } else if (matches.total === 0) {
            res.sendStatus(204);
        }
    }
});

// delete a live match
matches.delete("/:match_id", async (req, res) => {
    const { match_id } = req.params;
    // $.host is a TAG field, returns as an array of strings
    // needs to be typecasted since TS doesn't know this
    const matchHost = (
        (await redisClient.json.GET(match_id, {
            path: "$.host",
        })) as string[]
    )[0];
    const user_id = await getUserId({ req, res });

    if (matchHost) {
        if (matchHost === user_id) {
            await redisClient.DEL(match_id);
            return res.sendStatus(200);
        } else {
            return res.sendStatus(403);
        }
    } else {
        return res.sendStatus(404);
    }
});

// retrieve the results for a completed match
matches.get("/:match_id/results", async (req, res) => {
    const { match_id } = req.params;
    const supabase = useSupabaseClient({ req, res });
    const { data } = await supabase.from("scoresheets").select().eq("match_id", match_id);

    if (data === null || data.length === 0) {
        return res.sendStatus(204);
    } else if (data.length > 0) {
        return res.status(200).json(data);
    }
});

// request for access token to an open live match
matches.post("/:match_id/reserve", async (req, res) => {
    // first check if `match_access_token` cookie exists in request
    const requestCookies = req.cookies;
    if (requestCookies["match_access_token"]) {
        return res.status(403).send("cannot reserve a spot in another match whilst possessing a valid access token");
    }

    const { match_id } = req.params;
    const match = await getRedisMatch(match_id);
    const matchState = match?.current_state;

    if (match === null) {
        return res.status(404).send("The requested live match does not exist.");
    } else if (matchState === "open") {
        // check that the number of participants + current reservations do not exceed the match max_participants limit
        const { max_participants } = match;
        const numberParticipants = Object.keys(match.participants).length;
        const numberReservations = await getRedisMatchReservations(match_id);

        if (numberParticipants + numberReservations >= max_participants) {
            return res.status(403).send("Match is open but currently fully reserved.");
        }

        const user_id = (await getUserId({ req, res })) as string;
        const payload: MatchTokenPayload = {
            match_uuid: match_id,
            user_uuid: user_id,
            role: "archer",
        }; // defaults role to archer

        if (isRestrictedMatch(match)) {
            if (!(user_id in match.whitelist)) {
                return res.status(403).send("User not in the whitelist for this restricted match.");
            } else {
                // update role as user could be a judge in restricted matches
                payload.role = match.whitelist.user_id;
            }
        }

        // sign access token
        const accessToken: string = jwt.sign(payload, process.env.MATCH_TOKEN_SECRET, {
            expiresIn: 15000, // 15 seconds
            issuer: process.env.HOST_DOMAIN,
            subject: user_id,
            audience: req.ip,
        });

        // set JWT as an HttpOnly cookie in response
        res.cookie("match_access_token", accessToken, {
            maxAge: 15000, // delete cookie after 15 seconds
            httpOnly: true,
            sameSite: "strict",
        });

        // mark a reservation
        await setRedisMatchReservation(match_id, user_id, 15);

        return res.sendStatus(200);
    } else {
        return res.status(403).send("The requested live match is no longer open.");
    }
});

// access token debugging endpoint
matches.get("/token/validate", async (req, res) => {
    const cookies = req.cookies;
    const accessToken = cookies["match_access_token"];

    // verify JWT
    try {
        const decodedToken = jwt.verify(accessToken, process.env.MATCH_TOKEN_SECRET);
        return res.status(200).send(JSON.stringify(decodedToken));
    } catch (error) {
        // invalid signature
        return res.status(400).send(error);
    }
});

export default matches;
