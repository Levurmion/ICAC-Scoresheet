import { MatchParams } from "../../lib/types"
import { persistentUserSignIn } from "../../lib/utilities"

const supertest = require('supertest')
const agent = supertest.agent

const userAgent = agent('http://localhost:8001/api')

describe("Testing /matches endpoints", () => {

    // test data
    const badMatches = [
        {"name": "Mighty_Match_1@", "num_archers": 227, "num_ends": 200, "arrows_per_end": 166},
        {"name": "Swift_Match()_2", "num_archers": 197, "num_ends": 6, "arrows_per_end": 63},
        {"name": "Swift_Match_3", "num_ends": 117, "arrows_per_end": 75},
    ]
    const matchesToCreate = [
        {"name": "Mighty_Match_1", "num_archers": 227, "num_ends": 200, "arrows_per_end": 166},
        {"name": "Swift_Match_2", "num_archers": 197, "num_ends": 6, "arrows_per_end": 63},
        {"name": "Swift_Match_3", "num_archers": 24, "num_ends": 117, "arrows_per_end": 75},
        {"name": "Storm_Match_4", "num_archers": 21, "num_ends": 172, "arrows_per_end": 195},
        {"name": "Eagle_Match_5", "num_archers": 157, "num_ends": 47, "arrows_per_end": 221},
        {"name": "Mighty_Match_6", "num_archers": 41, "num_ends": 55, "arrows_per_end": 193},
        {"name": "Mighty_Match_7", "num_archers": 69, "num_ends": 119, "arrows_per_end": 253},
        {"name": "Falcon_Match_8", "num_archers": 180, "num_ends": 62, "arrows_per_end": 144},
        {"name": "Rapid_Match_9", "num_archers": 3, "num_ends": 214, "arrows_per_end": 114},
        {"name": "Mighty_Match_10", "num_archers": 17, "num_ends": 139, "arrows_per_end": 131}
    ]
    const existingMatches = [
        {"name": "Rapid_Match_9", "num_archers": 3, "num_ends": 214, "arrows_per_end": 114},
        {"name": "Mighty_Match_10", "num_archers": 17, "num_ends": 139, "arrows_per_end": 131}
    ]
    const matchNames = matchesToCreate.map(matchParams => matchParams.name)
    let liveMatchIds: []


    test("Sign In User: POST /auth/sign-in", async () => {
        const res = await userAgent.post('/auth/sign-in').send(persistentUserSignIn)
        expect(res.statusCode).toEqual(200)
    })

    test("Create a Match: POST /matches", async () => {
        // matches with missing fields or bad names
        for (const badMatch of badMatches) {
            const res = await userAgent.post('/matches').send(badMatch)
            expect(res.statusCode).toBe(400)
        }
        // create 10 unique matches
        for (const matchParams of matchesToCreate) {
            const res = await userAgent.post('/matches').send(matchParams)
            expect(res.statusCode).toEqual(201)
        }
        // matches with identical names
        for (const existingMatch of existingMatches) {
            const res = await userAgent.post('/matches').send(existingMatch)
            expect(res.statusCode).toBe(409)
        }
    })

    test("Retrieve Matches with Bad Requests: GET /matches/:match_name", async () => {
        // attempting to retrieve all matches without host constraint
        const allMatchRes = await userAgent
        .get("/matches/*")
        // attempting to retrieve a match that does not exist
        const noMatchRes = await userAgent
        .get("/matches/does_not_exist")
        // attempting to retrieve a live match with an invalid state
        const badStateMatchRes = await userAgent
        .get("/matches/_Match_")
        .query({
            state: "invalid state"
        })

        expect(allMatchRes.statusCode).toBe(400)
        expect(badStateMatchRes.statusCode).toBe(400)
        expect(noMatchRes.statusCode).toBe(204)
    })

    test("Retrieve Live Matches by Name: GET /matches/:match_name", async () => {
        const res = await userAgent
        .get("/matches/Match")
        .query({
            state: ["live"],
            host_only: true
        })
        const matchProperties = [
            "name",
            "num_archers",
            "arrows_per_end",
            "num_ends",
            "created_at",
            "current_end",
            "current_state",
            "previous_state",
            "host",
            "participants"
        ]
        const retrievedMatches = res.body
        const firstRetrievedMatch = retrievedMatches?.[0]
        liveMatchIds = retrievedMatches.map((match: {id: string, value: {}}) => {
            return match.id
        })

        // make sure returned object shape is correct
        expect(firstRetrievedMatch).toHaveProperty("id")
        expect(firstRetrievedMatch).toHaveProperty("value")
        matchProperties.forEach(prop => {
            expect(firstRetrievedMatch.value).toHaveProperty(prop)
        })
        
        // check that all 10 live matches were retrieved
        for (const retrievedMatch of retrievedMatches) {
            expect(matchNames).toContain(retrievedMatch.value.name)
        }
    })

    test("Retrieve Past Matches by Name: GET /matches/:match_name", async () => {
        const res = await userAgent
        .get('/matches/completed_match')
        const completedMatchProperties = [
            "competition",
            "finished_at",
            "host",
            "id",
            "name",
            "started_at"
        ]
        const pastMatchNames = [
            "completed_match1",
            "completed_match2"
        ]
        const retrievedPastMatches = res.body
        const firstRetrievedPastMatch = retrievedPastMatches?.[0]

        // make sure returned object shape is correct
        completedMatchProperties.forEach(prop => {
            expect(firstRetrievedPastMatch).toHaveProperty(prop)
        })

        // check that both past matches were retrieved
        for (const pastMatch of retrievedPastMatches) {
            expect(pastMatchNames).toContain(pastMatch.name)
        }
    })

    test("Delete Live Matches by ID: DELETE /matches", async () => {
        for (const matchId of liveMatchIds) {
            const res = await userAgent.delete(`/matches/${matchId}`)
            expect(res.statusCode).toBe(200)
        }
    })

})