import { RedisClientType, createClient } from "redis";
import * as types from "../types";
import { LiveMatch } from "./Match";
import { User } from '@supabase/gotrue-js/src/lib/types'
import { RedisJSON } from "@redis/json/dist/commands";

describe("Match Class Testing Suite", () => {
    const redisClient = createClient({
        url: "redis://localhost:6379",
    }) as RedisClientType;
    const matchId = "match:idempotent-test-suite-test-match";
    const testMatchProps: types.LiveMatch = {
        name: "Test Match",
        round: "Portsmouth",
        max_participants: 4,
        arrows_per_end: 3,
        num_ends: 20,
        host: "cc560b74-5452-4f58-b0a9-0b09d2afa075",
        created_at: new Date("2023-12-06T14:31:59.458Z"),
        current_end: 0,
        current_state: "open",
        previous_state: "open",
        participants: {},
    };
    let matchInstance: LiveMatch
    const mockUsers = [
        {id: "user-id-001", first_name: "Wilbert", last_name: "Anderson"},
        {id: "user-id-002", first_name: "Erica", last_name: "Felicity"},
        {id: "user-id-003", first_name: "Lok", last_name: "Hay Lau"},
        {id: "user-id-004", first_name: "Tristan", last_name: "Lim"},
        {id: "user-id-005", first_name: "Ludwina", last_name: "Eugenia"},
    ]
    const expectedMatchParticipant: types.MatchParticipant<'archer'> = {
        first_name: '',
        last_name: '',
        ready: false,
        role: 'archer',
        scores: [],
        ends_confirmed: new Array(testMatchProps.num_ends).fill(false)
    }

    beforeAll(async () => {
        await redisClient.connect();
        await redisClient.json.SET(matchId, '$', testMatchProps as unknown as RedisJSON)
    });

    afterAll(async () => {
        await redisClient.json.DEL(matchId)
        await redisClient.disconnect();
    });

    test("Match.getLiveMatch() instantiates Match by match ID", async () => {
        matchInstance = await LiveMatch.getLiveMatch(matchId, redisClient);
        expect(matchInstance).toBeInstanceOf(LiveMatch);
        expect(matchInstance).toMatchObject(testMatchProps);
    });

    test("Match.getLiveMatch() returns null if match ID is invalid", async () => {
        const nonexistentMatch = await LiveMatch.getLiveMatch("nonexistent-key", redisClient);
        expect(nonexistentMatch).toBe(null);
    });

    test("it can register users while the number of users are less than max_participants", () => {
        const currentParticipants = {}

        for (const user of mockUsers.slice(0,4)) {
            currentParticipants[user.id] = {
                ...expectedMatchParticipant,
                first_name: user.first_name,
                last_name: user.last_name
            }
            const registerUserResult = matchInstance.registerUser(user.id, user.first_name, user.last_name)
            expect(registerUserResult).toBe(true)
            expect(matchInstance.participants).toMatchObject(currentParticipants)
        }

        // now match has got to be full
        expect(matchInstance.previous_state).toBe("open")
        expect(matchInstance.current_state).toBe("full")

        // fifth person should reject and return false
        const registerExtraParticipantResult = matchInstance.registerUser(mockUsers[4].id, mockUsers[4].first_name, mockUsers[4].last_name)
        expect(registerExtraParticipantResult).toBe(false)

        // make sure the participant list is unchanged
        expect(matchInstance.participants).toMatchObject(currentParticipants)
    })
});