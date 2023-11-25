import { MatchParams } from "../../lib/types"
import { persistentUserSignIn } from "../../lib/utilities"

const supertest = require('supertest')
const agent = supertest.agent

const userAgent = agent('http://localhost:8001/api')

describe("Testing /matches endpoints", () => {

    const matchName = "dummy-match"
    const matchParams: MatchParams = {
        name: matchName,
        num_archers: 2,
        num_ends: 20,
        arrows_per_end: 3
    }
    let redisMatchObject: {name: string, id: string}

    test("Sign In User: POST /auth/sign-in", async () => {
        const res = await userAgent.post('/auth/sign-in').send(persistentUserSignIn)
        expect(res.statusCode).toEqual(200)
    })

    test("Create a Match: POST /matches", async () => {
        const res = await userAgent.post('/matches').send(matchParams)
        expect(res.statusCode).toEqual(201)
    })

    test("Retrieve a Match by Name: GET /matches/:match_name", async () => {
        const res = await userAgent
            .get(`/matches/${matchName}`)
            .query({
                match_name: matchName,
                state: ["open", "full"]
            })
        expect(res.body?.[0]).toHaveProperty("match_name", "match_id")
        expect(res.body?.[0]?.match_name).toEqual(matchName)
        redisMatchObject = res.body?.[0]
    })

})