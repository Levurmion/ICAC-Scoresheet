import redisClient from "../../lib/redis/useRedisClient";
import { Router } from "express";
import { MatchParams, Match } from "../../lib/types";
import { authenticate } from "../../lib/middlewares";
import { v4 as uuid4 } from 'uuid'
import { RedisJSON } from "@redis/json/dist/commands";
import useSupabaseClient from "../../lib/supabase/useSupabaseClient";
import { getUserId, isValidAlphanumeric } from "../../lib/utilities";
import { isValidLiveMatchState } from "../../lib/typeGuards";


const matches = Router()

// authenticate everything in this route
matches.use(authenticate)

// create a new match
matches.post('/', async (req, res) => {

    const matchParams: MatchParams = req.body
    const { name, num_archers, arrows_per_end, num_ends } = matchParams
    const host = await getUserId({ req, res })

    // if one of the required fields are missing
    if ([name, num_archers, arrows_per_end, num_ends].some(param => param === undefined || null)) {
        res.status(400).send("missing required fields")
        return
    }
    else if (!isValidAlphanumeric(name)) {
        res.status(400).send("match name is not a valid alphanumeric string with underscores or spaces")
        return
    }

    if (host === false) {
        res.sendStatus(401)
        return
    }

    const matchUUID = uuid4()
    const match: Match = {
        ...matchParams,
        host,
        created_at: new Date(),
        current_end: 0,
        current_state: 'open',
        previous_state: 'open',
        participants: {}
    }

    // check if an exact match name exists
    if ((await redisClient.ft.search("idx:matches", `@name:"${name}"`)).total > 0) {
        res.status(409).send('name already taken by an existing live match')
    } 
    else {
        await redisClient.json.SET(`match:${matchUUID}`, '$', match as unknown as RedisJSON)
        res.sendStatus(201)
    }
})


// retrieve an existing match
matches.get('/:match_name', async (req, res) => {
    const { match_name } = req.params
    const { state, host_only } = req.query
    const host = await getUserId({ req, res })

    if (host === false) {
        res.sendStatus(401)
        return
    }

    if (
        match_name === undefined ||
        (match_name === "*" && host_only !== "true") ||
        (state !== undefined && state !== "live" && !isValidLiveMatchState(state as unknown as string | string[]))
    ) {
        res.sendStatus(400)
        return
    }
    else if (state === undefined) {
        const supabase = useSupabaseClient({ req, res })
        const { data, error } = host_only === "true" ? (
            await supabase.from('matches').select('*').ilike('name', `%${match_name}%`).eq("host", host)) : (
            await supabase.from('matches').select('*').ilike('name', `%${match_name}%`)
            )

        if (error) {
            res.status(Number(error.code)).send(error.hint)
            return
        }
        else if (data.length > 0) {
            res.status(200).json(data)
            return
        }
        else if (data.length === 0) {
            res.sendStatus(204)
        }
    }
    else {
        const nameQuery = match_name === "*" ? "" : `@name:*${match_name}*`
        let stateQuery: string|undefined = undefined
        let hostQuery: string|undefined = undefined

        // generate stateQuery
        if (state === "live") {
            // leave as is
        }
        else if (Array.isArray(state)) {
            stateQuery = "live" in state ? "" : `@current_state:(${state.join("|")})`
        }
        else if (typeof state === "string") {
            stateQuery = `@current_state:${state}`
        }

        // generate hostQuery
        if (host_only === "true") {
            const supabase = useSupabaseClient({ req, res })
            // escape hyphens in UUID
            hostQuery = `@host:{${host.replace(/-/g, "\\-")}}`
        }

        const redisQuery = [nameQuery, stateQuery, hostQuery].filter(val => val !== undefined).join(" ")
        const matches = await redisClient.ft.SEARCH(
            "idx:matches", 
            redisQuery,
        )
        
        if (matches.total > 0) {
            res.status(200).json(matches.documents)
        }
        else if (matches.total === 0) {
            res.sendStatus(204)
        }
    }

})


matches.delete('/:match_id', async (req, res) => {
    const { match_id } = req.params
    // $.host is a TAG field, returns as an array of strings
    // needs to be typecasted since TS doesn't know this
    const matchHost = (await redisClient.json.GET(match_id, {
        path: "$.host"
    }) as string[])[0]
    const userId = await getUserId({ req, res })

    if (matchHost) {
        if (matchHost === userId) {
            await redisClient.DEL(match_id)
            res.sendStatus(200)
        }
        else {
            res.sendStatus(403)
        }
    }
    else {
        res.sendStatus(404)
    }
})

export default matches