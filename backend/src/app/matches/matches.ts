import redisClient from "../../lib/redis/useRedisClient";
import { Router } from "express";
import { MatchParams, LiveMatch, MatchTokenPayload, LiveMatchRedisType } from "../../lib/types";
import { authenticate } from "../../lib/middlewares";
import { v4 as uuid4 } from "uuid";
import { RedisJSON } from "@redis/json/dist/commands";
import useSupabaseClient from "../../lib/supabase/useSupabaseClient";
import { getRedisMatch, getRedisMatchReservations, getUserId, isValidAlphanumeric, isValidDateString, setRedisMatchReservation } from "../../lib/utilities";
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
    const host = await getUserId({ req, res }) as string;
    const requiredFields = [
        name,
        max_participants,
        arrows_per_end,
        num_ends
    ]

    // if one of the required fields are missing
    if (requiredFields.some((param) => param === undefined || null)) {
        return res.status(400).send("missing required fields");
    } else if (!isValidAlphanumeric(name)) {
        return res.status(400).send("name was not a valid alphanumeric string with underscores or spaces");
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
    const potentialMatches = await redisClient.ft.search("idx:matches", `@name:(${name})`)

    console.log(potentialMatches)

    if (potentialMatches.documents.some(match => match.value.name === name)) {
        return res.status(409).send("name already taken by a live match");
    } else {
        await redisClient.json.SET(`match:${matchUUID}`, "$", match as unknown as RedisJSON);
        return res.status(201).json({
            id:`match:${matchUUID}`,
            value: match
        });
    }
});

// retrieve an existing live match
matches.get("/live/:match_name", async (req, res) => {
    const { match_name } = req.params;
    const { state, host_only, by_id } = req.query;
    const host = await getUserId({ req, res }) as string;

    // perform request validation
    // determine 400 status message if validation fails
    res.status(400);
    if (match_name === undefined) {
        return res.send("name not provided");
    } else if (state !== undefined && state !== "live" && !isValidLiveMatchState(state)) {
        return res.send("invalid state query");
    }

    if (by_id) {
        const match = await redisClient.json.GET(match_name)

        if (match) {
            return res.status(200).json(match)
        } else {
            return res.sendStatus(204)
        }
    }

    const nameQuery = match_name === "*" ? "" : `@name:(${match_name})`;
    let stateQuery: string | undefined = undefined;
    let hostQuery: string | undefined = undefined;

    // generate stateQuery
    if (state === "live") {
        // leave as is
    } else if (Array.isArray(state)) {
        stateQuery = "live" in state ? "" : `@current_state:(${state.join("|")})`;
    } else if (typeof state === "string") {
        stateQuery = `@current_state:(${state})`;
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
        return res.status(200).json(matches.documents);
    } else if (matches.total === 0) {
        return res.sendStatus(204);
    }
})

// retrieve a completed match
matches.get("/completed/:match_name", async (req, res) => {
    const { match_name } = req.params;
    const { state, host_only, before, after } = req.query;
    const host = await getUserId({ req, res }) as string;

    // perform request validation
    // determine 400 status message if validation fails
    res.status(400);
    if (match_name === undefined) {
        return res.send("name not provided");
    }
    if (
        (before !== undefined && !isValidDateString(before as string)) || 
        (after !== undefined && !isValidDateString(after as string))
    ) {
        return res.send("invalid date queries")
    }

    // construct supabase query
    const supabase = useSupabaseClient({ req, res });
    let supabaseRequest = supabase.from("matches").select("*").ilike("name", `%${match_name}%`);
    if (host_only) {
        supabaseRequest = supabaseRequest.eq("host", host)
    }
    if (before) {
        supabaseRequest = supabaseRequest.lte("finished_at", before)
    }
    if (after) {
        supabaseRequest = supabaseRequest.gte("finished_at", after)
    }

    const { data, error } = await supabaseRequest

    if (error) {
        return res.status(Number(error.code)).send(error.hint);
    } else if (data.length > 0) {
        return res.status(200).json(data);
    } else if (data.length === 0) {
        return res.sendStatus(204);
    }
});

// delete a live match
matches.delete("/:match_id", async (req, res) => {
    const { match_id } = req.params;
    if (!match_id) {
        return res.status(400).send('match id not provided')
    }

    // $.host is a TAG field, returns as an array of strings
    // needs to be typecasted since TS doesn't know this
    const matchHost = (
        (await redisClient.json.GET(match_id, {
            path: "$.host",
        })) as string[]
    )?.[0];
    
    if (matchHost) {
        const user_id = await getUserId({ req, res });
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
        return res.status(403).send("user currently possesses a valid access token");
    }

    const { match_id } = req.params;
    const match = await getRedisMatch(match_id);
    const matchState = match?.current_state;

    if (match === null) {
        return res.status(404).send("live match does not exist");
    } else if (matchState === "open") {
        // check that the number of participants + current reservations do not exceed the match max_participants limit
        const { max_participants } = match;
        const numberParticipants = Object.keys(match.participants).length;
        const numberReservations = await getRedisMatchReservations(match_id);

        if (numberParticipants + numberReservations >= max_participants) {
            return res.status(403).send("match fully reserved");
        }

        const user_id = (await getUserId({ req, res })) as string;
        const payload: MatchTokenPayload = {
            match_uuid: match_id,
            user_uuid: user_id,
            role: "archer",
        }; // defaults role to archer

        if (isRestrictedMatch(match)) {
            if (!(user_id in match.whitelist)) {
                return res.status(403).send("restricted match (not in whitelist)");
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
        return res.status(403).send("match is no longer open");
    }
});

// access token debugging endpoint
matches.get("/token/validate", async (req, res) => {
    const cookies = req.cookies;
    const accessToken = cookies["match_access_token"];

    // verify JWT
    try {
        const decodedToken = jwt.verify(accessToken, process.env.MATCH_TOKEN_SECRET);
        return res.status(200).json(decodedToken);
    } catch (error) {
        // invalid signature
        return res.status(400).send(error);
    }
});

export default matches;
