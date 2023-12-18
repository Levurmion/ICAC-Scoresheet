import { RedisJSON } from "@redis/json/dist/commands";
import { RedisClientType, createClient } from "redis";
import * as types from "../types";
import Match from "./Match";
import redisClient from "../redis/redisClient";
import { beforeEach } from "node:test";

// create new client because we are testing from outside the container
const testClient = createClient() as RedisClientType;
const testMatchId = "test-match-fake-id-001";
const testMatch: types.RedisMatch = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 4,
    arrows_per_end: 3,
    num_ends: 20,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 0,
    current_state: "open",
    previous_state: "open",
    submission_map: {},
};
const testSessionIds = ["match-session:user-001", "match-session:user-002", "match-session:user-003", "match-session:user-004"];
const testUserSessions: types.UserSession<"archer">[] = [
    {
        match_id: testMatchId,
        user_id: "user-001",
        first_name: "Alice",
        last_name: "Johnson",
        ready: false,
        university: "Some University",
        role: "archer",
        scores: [],
        ends_confirmed: new Array(20).fill(false),
        connected: true,
    },
    {
        match_id: testMatchId,
        user_id: "user-002",
        first_name: "Bob",
        last_name: "Smith",
        ready: false,
        university: "Some University",
        role: "archer",
        scores: [],
        ends_confirmed: new Array(20).fill(false),
        connected: true,
    },
    {
        match_id: testMatchId,
        user_id: "user-003",
        first_name: "Charlie",
        last_name: "Brown",
        ready: false,
        university: "Some University",
        role: "archer",
        scores: [],
        ends_confirmed: new Array(20).fill(false),
        connected: true,
    },
    {
        match_id: testMatchId,
        user_id: "user-004",
        first_name: "Diana",
        last_name: "Prince",
        ready: false,
        university: "Some University",
        role: "archer",
        scores: [],
        ends_confirmed: new Array(20).fill(false),
        connected: true,
    },
];
const extraUserSession: types.UserSession<"archer"> = {
    match_id: testMatchId,
    user_id: "extra-user-001",
    first_name: "Ethan",
    last_name: "Hunt",
    ready: false,
    university: "Some University",
    role: "archer",
    scores: [],
    ends_confirmed: new Array(20).fill(false),
    connected: true,
};
const extraUserId = "extra-user-001";
const extraUserSessionId = "match-session:extra-user-001";
const expMatchUsers: { [userId: string]: types.UserSession<"archer"> } = {};
let redisMatch: Match;

describe("Match Testing Suite", () => {
    `
    Match-Session relationships will be bidirectionally captured using Redis hash tables.
    - 1 match can be associated with many sessions
    - 1 session can only be associated with one match

    Match -1-----0< Session

    The sessions associated with each Match is going to be stored in the "match-participants" hash table. This will store match IDs as hash keys followed by a list of the associated session IDs.

    "match-participants"
    match-id-1: [session1, session2, session3],
    match-id-2: [session4, session5]

    The converse relationship mapping each session to their respective matches will be stored in the "active-sessions" hash table. Each hash key will be the session ID of a user followed by its associated match ID.

    "active-sessions"
    session1: match-id-1,
    session2: match-id-1,
    session3: match-id-1,
    session4: match-id-2,
    session5: match-id-2
    `;

    // connect to Redis
    beforeAll(async () => {
        await testClient.connect();
    });

    // disconnect Redis
    afterAll(async () => {
        await testClient.disconnect();
    });

    describe("Testing Match Creation", () => {
        test("Match can be created and retrieved", async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient);
            const retrievedTestMatch = await Match.getRedisMatch(testMatchId, testClient);
            expect(retrievedTestMatch).toEqual(testMatch);
        });

        test("Match can be deleted", async () => {
            await Match.deleteRedisMatch(testMatchId, testClient);
            expect(await testClient.json.GET(testMatchId)).toBe(null);
        });
    });

    describe("Testing The Consistency of Match-Session Relationship", () => {
        beforeAll(async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient);
        });

        afterAll(async () => {
            await Match.deleteRedisMatch(testMatchId, testClient);
            // await Match.deleteSession(extraUserId, testClient)
        });

        test("Session is Properly Set", async () => {
            // set session and check
            await Match.setSession(extraUserSession, testClient);
            const session = await Match.getSession(extraUserId, testClient);
            expect(session).toEqual(extraUserSession);
        });

        test("match-participants Hash Table is Properly Set", async () => {
            const matchParticipants = JSON.parse((await testClient.HGET("match-participants", testMatchId)) as string);
            expect(matchParticipants).toEqual([extraUserSessionId]);
        });

        test("Sessions cannot be double-booked on a single match", async () => {
            expect(async () => {await Match.setSession(extraUserSession, testClient)}).rejects.toThrow('Cannot set a new session: Session already exists.')
            const matchParticipants = JSON.parse((await testClient.HGET("match-participants", testMatchId)) as string);
            expect(matchParticipants).toEqual([extraUserSessionId]);
        });

        test("Additional sessions will be appended to the array", async () => {
            await Match.setSession(testUserSessions[0], testClient);
            const matchParticipants = JSON.parse((await testClient.HGET("match-participants", testMatchId)) as string);
            expect(matchParticipants).toEqual([extraUserSessionId, testSessionIds[0]]);
        });

        test("active-sessions Hash Table is Properly Set", async () => {
            const activeSessionMatches = await testClient.HMGET("active-sessions", [extraUserSessionId, testSessionIds[0]]);
            expect(activeSessionMatches).toEqual([testMatchId, testMatchId]);
        });

        test("match-participants and active-sessions can be Synchronized with Expired Matches", async () => {
            // trying to sync a still available session - should throw error
            expect(async () => {
                await Match.syncExpiredSession(extraUserSessionId, testClient);
            }).rejects.toThrow("Cannot sync expired session: Session still exists.");

            // manually delete session to mock expiry
            await testClient.json.DEL(extraUserSessionId);
            const matchParticipants = JSON.parse((await testClient.HGET("match-participants", testMatchId)) as string);
            const activeSessionMatches = await testClient.HMGET("active-sessions", [extraUserSessionId, testSessionIds[0]]);
            expect(matchParticipants).toEqual([extraUserSessionId, testSessionIds[0]]);
            expect(activeSessionMatches).toEqual([testMatchId, testMatchId]);

            // synchronize match with session availability
            await Match.syncExpiredSession(extraUserSessionId, testClient);
            const matchParticipantsSynced = JSON.parse((await testClient.HGET("match-participants", testMatchId)) as string);
            const activeSessionMatchesSynced = await testClient.HMGET("active-sessions", [extraUserSessionId, testSessionIds[0]]);
            expect(matchParticipantsSynced).toEqual([testSessionIds[0]]);
            expect(activeSessionMatchesSynced).toEqual([null, testMatchId]);

            // reset
            await Match.setSession(extraUserSession, testClient);
        });

        test("Deleting a Session Clears it From match-participants and active-sessions", async () => {
            await Match.deleteSession(extraUserId, testClient)
            const matchParticipantsSynced = JSON.parse((await testClient.HGET("match-participants", testMatchId)) as string);
            const activeSessionMatchesSynced = await testClient.HMGET("active-sessions", [extraUserSessionId, testSessionIds[0]]);
            expect(matchParticipantsSynced).toEqual([testSessionIds[0]]);
            expect(activeSessionMatchesSynced).toEqual([null, testMatchId]);
        })

        test("Deleting a Match Clears all Sessions and Corresponding Relationships", async () => {
            await Match.deleteRedisMatch(testMatchId, testClient);
            const matchParticipants = JSON.parse((await testClient.HGET("match-participants", testMatchId)) as string);
            const activeSessionMatches = await testClient.HMGET("active-sessions", [extraUserSessionId, testSessionIds[0]]);
            const extraUserSession = await Match.getSession(extraUserId, testClient);
            const testUser1Session = await Match.getSession(testUserSessions[0].user_id, testClient);
            expect([matchParticipants, activeSessionMatches, extraUserSession, testUser1Session]).toEqual([null, [null, null], null, null]);
        });
    });

    describe("Testing The Behaviour of Setting New Sessions", () => {

        afterAll(async () => {
            await Match.deleteRedisMatch(testMatchId, testClient)
        })

        test("Cannot Set New Session if Match Does Not Exist", async () => {
            expect(async () => {
                await Match.setSession(extraUserSession, testClient)
            }).rejects.toThrow("Cannot set a new session: Match does not exist.")
        })

        test("New Sessions can Be Set While Number of Participants < max_participants", async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient)

            for (const session of testUserSessions) {
                await Match.setSession(session, testClient)
            }
            expect(JSON.parse(await testClient.HGET("match-participants", testMatchId) as string)).toEqual(testSessionIds)

            // should reject because now match is full
            expect(async () => {
                await Match.setSession(extraUserSession, testClient)
            }).rejects.toThrow("Cannot set a new session: Match is full.")
        })

    });

    describe("Testing the Behaviour of Match Lobby Occupancy (open and full states)", () => {

        beforeAll(async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient)
            for (const testSession of testUserSessions) {
                await Match.setSession(testSession, testClient)
            }
        })

        afterAll(async () => {
            await Match.deleteRedisMatch(testMatchId, testClient)
        })

        test("Can Correctly Get the Number of Participants in a Match", async () => {
            const numParticipants = await Match.getNumParticipants(testMatchId, testClient)
            expect(numParticipants).toBe(4)
        })

        test("Can Correctly Retrieve all Participant Sessions", async () => {
            const participants = await Match.getParticipants(testMatchId, testClient)
            expect(participants).toEqual(testUserSessions)
        })

        test("Match is full when the number of participants >= max_participants", async () => {
            const matchState = await Match.getState(testMatchId, testClient)
            expect(matchState).toEqual({
                current_state: "full",
                previous_state: "open"
            })
        })

        test("A user leaving would revert the match state back to open", async () => {
            await Match.deleteSession(testUserSessions[3].user_id, testClient)
            const matchState = await Match.getState(testMatchId, testClient)
            expect(matchState).toEqual({
                current_state: "open",
                previous_state: "full"
            })
        })

    })

    describe("Testing the Behaviour of Match Instances in the Lobby (open, full, and transition to submit)", () => {

        const matchInstances: Array<Match> = []

        beforeAll(async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient)
            for (const testSession of testUserSessions) {
                await Match.setSession(testSession, testClient)
            }
        })

        afterAll(async () => {
            await Match.deleteRedisMatch(testMatchId, testClient)
        })

        test("Match Instances Can Be Created for Users with Active Sessions", async () => {
            for (const userSession of testUserSessions) {
                const userId = userSession.user_id
                matchInstances.push(await Match.initMatchForUser(userId, testClient) as Match)
            }
            for (const matchInstance of matchInstances) {
                expect(matchInstance).toBeInstanceOf(Match)
            }
        })

        test("Match Instances Cannot Be Created Without an Active Session", async () => {
            const noSessionInstance = await Match.initMatchForUser(extraUserId, testClient)
            expect(noSessionInstance).toBe(null)
        })

        test("Getter Instance Methods Wrap Static Methods But Ties Responses to the Instance's Match ID", async () => {
            const firstUser = matchInstances[0]
            expect(await firstUser.getNumParticipants()).toBe(4)
            expect((await firstUser.getRedisMatch()).name).toEqual(testMatch.name)
            expect(await firstUser.getSession()).toEqual(testUserSessions[0])
            expect(await firstUser.getState()).toEqual({
                current_state: "full",
                previous_state: "open"
            })

            // leaveMatch() calls deleteSession() for this user and undefines all instance properties
            await firstUser.leaveMatch()
            expect(await Match.getNumParticipants(testMatchId, testClient)).toBe(3)
            expect(firstUser.matchId).toBe(undefined)
            expect(firstUser.userId).toBe(undefined)

            matchInstances.shift()
        })

        test("Users Can Ready But Match Will Not Move to Submit Unless it Is Full", async () => {
            for (const matchInstance of matchInstances) {
                await matchInstance.setReady()
            }
            const matchState = await matchInstances[0].getState()
            expect(matchState).toEqual({
                current_state: "open",
                previous_state: "full"
            })
        })

        test("Users Can Unready", async () => {
            for (const matchInstance of matchInstances) {
                await matchInstance.setUnready()
            }
            const participants = await matchInstances[0].getParticipants()
            for (const participant of participants) {
                expect(participant.ready).toBe(false)
            }
        })

        test("Match moves to submit when it is full and all users are ready", async () => {
            await Match.setSession(testUserSessions[0], testClient)
            matchInstances.unshift(await Match.initMatchForUser(testUserSessions[0].user_id, testClient) as Match)
            const matchState = await matchInstances[0].getState()
            expect(matchState).toEqual({
                current_state: "full",
                previous_state: "open"
            })
            for (const matchInstance of matchInstances) {
                await matchInstance.setReady()
            }
            const newMatchState = await Match.getState(testMatchId, testClient)
            expect(newMatchState).toEqual({
                current_state: "submit",
                previous_state: "full"
            })
        })

    })


});
