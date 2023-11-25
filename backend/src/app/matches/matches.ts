import redisClient from "../../lib/redis/useRedisClient";
import { Router } from "express";
import { MatchParams, Match } from "../../lib/types";
import { authenticate } from "../../lib/middlewares";
import { v4 as uuid4 } from 'uuid'
import { RedisJSON } from "@redis/json/dist/commands";
import useSupabaseClient from "../../lib/supabase/useSupabaseClient";


const matches = Router()

// authenticate everything in this route
matches.use(authenticate)

// create a new match
matches.post('/', async (req, res) => {

    const matchParams: MatchParams = req.body
    const { name, num_archers, arrows_per_end, num_ends } = matchParams
    
    const supabase = useSupabaseClient({ req, res })
    const userData = await supabase.auth.getUser()
    const host = userData.data.user?.id

    // if one of the required fields are missing
    if ([name, num_archers, arrows_per_end, num_ends].some(param => param === undefined || null)) {
        res.sendStatus(400)
        return
    }

    if (host === undefined) {
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

    // always prefix match name with "match:" to prevent accidental key collisions
    const matchName = `match:${matchParams.name}`

    // check if match name exists
    if (await redisClient.EXISTS(matchUUID)) {
        res.status(409).send('name already taken by an existing live match')
    } 
    else {
        await redisClient.json.SET(matchUUID, '$', match as unknown as RedisJSON)
        res.sendStatus(201)
    }
})


// retrieve an existing match
matches.get('/:match_name', async (req, res) => {

    const { match_name } = req.params
    const { state, host_only } = req.query

    console.log(match_name)
    console.log(state)
    console.log(host_only)

    if (
        match_name === undefined ||
        (match_name === "*" && host_only !== "true")
    ) {
        res.sendStatus(400)
        return
    }
    else if (state === undefined) {
        const supabase = useSupabaseClient({ req, res })
        const { data, error } = await supabase.from('matches').select('*').ilike('name', `%${match_name}%`)

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
        const stateQuery = `{${(state as string[]).join("|")}}`
        console.log(stateQuery)

        const matches = await redisClient.ft.SEARCH(
            "idx:matches", 
            `@name:${match_name} @current_state:${stateQuery} @host:${host_only ?? "*"}`
        )

        console.log(matches)
        
        if (matches.total > 0) {
            res.status(200).json(matches.documents)
        }
        else if (matches.total === 0) {
            res.sendStatus(204)
        }
    }

})


matches.delete('/:match_id', async (req, res) => {

    const { match_id } = req.body.param
    const match = await redisClient.json.GET(match_id)

    console.log(match_id)
    console.log(match)

}) 

export default matches