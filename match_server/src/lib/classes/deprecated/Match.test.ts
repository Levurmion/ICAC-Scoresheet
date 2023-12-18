import { RedisClientType, createClient } from "redis";
import * as types from "../../types";
import { LiveMatch } from "./Match";
import { User } from "@supabase/gotrue-js/src/lib/types";
import { RedisJSON } from "@redis/json/dist/commands";
import { waitForEvent } from "../../utilities";

interface MockUser {
    id: string,
    first_name: string,
    last_name: string,
    university: string
}

const matchId = "match:idempotent-test-suite-test-match";
const mockUsers: MockUser[] = [
    { id: "user-id-001", first_name: "Wilbert", last_name: "Anderson", university: "Imperial College London" },
    { id: "user-id-002", first_name: "Erica", last_name: "Felicity", university: "Imperial College London" },
    { id: "user-id-003", first_name: "Lok Hay", last_name: "Lau", university: "Imperial College London" },
    { id: "user-id-004", first_name: "Tristan", last_name: "Lim", university: "Imperial College London" },
    { id: "user-id-005", first_name: "Ludwina", last_name: "Eugenia", university: "Imperial College London" },
];
const testMatchProps: types.LiveMatch = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 4,
    arrows_per_end: 3,
    num_ends: 20,
    host: "cc560b74-5452-4f58-b0a9-0b09d2afa075",
    created_at: new Date("2023-12-06T14:31:59.458Z"),
    current_end: 0,
    participants: {},
};
const expectedMatchParticipant: types.MatchParticipant<"archer"> = {
    first_name: "",
    last_name: "",
    university: "",
    ready: false,
    role: "archer",
    scores: [],
    ends_confirmed: new Array(testMatchProps.num_ends).fill(false),
};
const redisClient = createClient({
    url: "redis://localhost:6379",
}) as RedisClientType;


describe("Match Class Testing Suite", () => {
    let matchInstance: LiveMatch;
    let currentParticipants: { [matchId: string]: types.MatchParticipant<"archer"> } = {};

    beforeAll(async () => {
        await redisClient.connect();
        await redisClient.json.SET(matchId, "$", testMatchProps as unknown as RedisJSON);
    });

    afterAll(async () => {
        await redisClient.json.DEL(matchId);
        await redisClient.disconnect();
    });

    test("Match.getLiveMatch() instantiates Match by match ID", async () => {
        matchInstance = await LiveMatch.getLiveMatch(matchId, redisClient) as LiveMatch;
        expect(matchInstance).toBeInstanceOf(LiveMatch);
        expect(matchInstance).toMatchObject(testMatchProps);
    });

    test("Match.getLiveMatch() returns null if match ID is invalid", async () => {
        const nonexistentMatch = await LiveMatch.getLiveMatch("nonexistent-key", redisClient);
        expect(nonexistentMatch).toBe(null);
    });

    test("it can register users while the number of users are less than max_participants", () => {
        for (const user of mockUsers.slice(0, 4)) {
            currentParticipants[user.id] = {
                ...expectedMatchParticipant,
                first_name: user.first_name,
                last_name: user.last_name,
                university: user.university
            };
            const registerUserResult = matchInstance.registerUser(user.id, user.first_name, user.last_name, user.university);
            expect(registerUserResult).toBe(true);
            expect(matchInstance.getParticipants()).toMatchObject(currentParticipants);
        }

        // now match has got to be full
        expect(matchInstance.getMatchState()).toEqual(["full", "open"]);

        // fifth person should reject and return false
        const registerExtraParticipantResult = matchInstance.registerUser(mockUsers[4].id, mockUsers[4].first_name, mockUsers[4].last_name, mockUsers[4].university);
        expect(registerExtraParticipantResult).toBe(false);

        // make sure the participant list is unchanged
        expect(matchInstance.getParticipants()).toMatchObject(currentParticipants);
    });

    test("it returns false if trying to remove a non-existent user", () => {
        const removeUnregisteredUserResult = matchInstance.removeUser("unregistred-user");
        expect(removeUnregisteredUserResult).toBe(false);
    });

    test("it reverts back to open if capacity is lower than max_participants", () => {
        const userToRemove = mockUsers[3];
        const removeUserResult = matchInstance.removeUser(userToRemove.id);
        delete currentParticipants[userToRemove.id];
        expect(removeUserResult).toBe(true);
        expect(matchInstance.getMatchState()).toEqual(["open", "full"]);
        expect(matchInstance.getParticipants()).toMatchObject(currentParticipants);
    });

    test("it allows registered users to get ready in the lobby", () => {
        for (const user of mockUsers.slice(0, 3)) {
            currentParticipants[user.id].ready = true;
            const setReadyResult = matchInstance.setReady(user.id);
            expect(setReadyResult).toMatchObject(currentParticipants);
        }
    });

    test("it allows registered users to unready in the lobby", () => {
        for (const user of mockUsers.slice(0, 3)) {
            currentParticipants[user.id].ready = false;
            const setUnreadyResult = matchInstance.setUnready(user.id);
            expect(setUnreadyResult).toMatchObject(currentParticipants);
        }
    });

    test("it returns null when trying to ready/unready and unregistered user", () => {
        const setBadReadyResult = matchInstance.setReady("unregistered-user");
        const setBadUnreadyResult = matchInstance.setUnready("unregistered-user");
        expect(setBadReadyResult).toBe(null);
        expect(setBadUnreadyResult).toBe(null);
    });

    test("it does not proceed to the submit state if the match is not full", () => {
        for (const user of mockUsers.slice(0, 3)) {
            currentParticipants[user.id].ready = true;
            const setUnreadyResult = matchInstance.setReady(user.id);
            expect(setUnreadyResult).toMatchObject(currentParticipants);
        }
        expect(matchInstance.getMatchState()).toEqual(["open", "full"]);
    });

    test("it proceeds to the submit state if the match is full and all participants are ready", () => {
        const fourthUser = mockUsers[3];
        matchInstance.registerUser(fourthUser.id, fourthUser.first_name, fourthUser.last_name, fourthUser.university);
        expect(matchInstance.getMatchState()).toEqual(["full", "open"]);
        currentParticipants[fourthUser.id] = {
            ...expectedMatchParticipant,
            first_name: fourthUser.first_name,
            last_name: fourthUser.last_name,
            university: fourthUser.university,
            ready: true,
        };
        const setReadyResult = matchInstance.setReady(fourthUser.id);
        expect(setReadyResult).toMatchObject(currentParticipants);
        expect(matchInstance.getMatchState()).toEqual(["submit", "full"]);
    });

    test("it can save itself into Redis", async () => {
        await matchInstance.save(redisClient);
        const updatedRedisMatch = await LiveMatch.getLiveMatch(matchId, redisClient) as LiveMatch;
        expect(matchInstance).toMatchObject(updatedRedisMatch);
    });

    test("it can synchronize with redis", async () => {
        const otherMatchInstance = await LiveMatch.getLiveMatch(matchId, redisClient) as LiveMatch;
        const firstUser = mockUsers[0]
        matchInstance.removeUser(firstUser.id)
        await matchInstance.save(redisClient)
        expect(matchInstance).not.toMatchObject(otherMatchInstance)
        await otherMatchInstance.sync(redisClient)
        expect(matchInstance).toMatchObject(otherMatchInstance)
    })
});

function buildLobbyUpdateUserPayload (user: MockUser, ready: boolean) {
    return {
        ...user,
        ready
    }
}

describe("Match Class Event Emitter Testing Suite", () => {

    let matchInstance: LiveMatch
    const currentParticipants: { [matchId: string]: types.MatchParticipant<"archer"> } = {};

    beforeAll(async () => {
        await redisClient.connect();
        await redisClient.json.SET(matchId, "$", testMatchProps as unknown as RedisJSON);
    });

    afterAll(async () => {
        await redisClient.json.DEL(matchId);
        await redisClient.disconnect();
    });

    test("It can emit the server:lobby-update event with the correct payloads", async () => {
        matchInstance = await LiveMatch.getLiveMatch(matchId, redisClient) as LiveMatch
        const firstUser = mockUsers[0]

        // check that 'server:lobby-update' was emitted when user signed up and validate payload
        const registerUserUpdate = waitForEvent(matchInstance, 'server:lobby-update')
        matchInstance.registerUser(firstUser.id, firstUser.first_name, firstUser.last_name, firstUser.university)
        const registerUserPayload = await registerUserUpdate as Array<any>
        expect(registerUserPayload[0]).toMatchObject(buildLobbyUpdateUserPayload(firstUser, false))

        // check that 'server:lobby-update' was emitted when user READIES and validate payload
        const userReadyUpdate = waitForEvent(matchInstance, 'server:lobby-update')
        matchInstance.setReady(firstUser.id)
        const userReadyPayload = await userReadyUpdate as Array<any>
        expect(userReadyPayload[0]).toMatchObject(buildLobbyUpdateUserPayload(firstUser, true))

        // check that 'server:lobby-update' was emitted when user UNREADIES and validate payload
        const userUnreadyUpdate = waitForEvent(matchInstance, 'server:lobby-update')
        matchInstance.setUnready(firstUser.id)
        const userUnreadyPayload = await userUnreadyUpdate as Array<any>
        expect(userUnreadyPayload[0]).toMatchObject(buildLobbyUpdateUserPayload(firstUser, false))

        // check that 'server:lobby-update' was emitted when NEW USER JOINS and validate payload
        const newUserJoinUpdate = waitForEvent(matchInstance, 'server:lobby-update')
        const secondUser = mockUsers[1]
        matchInstance.registerUser(secondUser.id, secondUser.first_name, secondUser.last_name, secondUser.university)
        const newUserJoinPayload = await newUserJoinUpdate as Array<any>
        newUserJoinPayload.forEach((user, idx) => {
            expect(user).toMatchObject(buildLobbyUpdateUserPayload(mockUsers[idx], false))
        })
    })

})
