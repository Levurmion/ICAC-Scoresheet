import { RedisJSON } from "@redis/json/dist/commands";
import { RedisClientType, createClient } from "redis";
import * as types from "../types";
import Match from "./Match";
import redisClient from "../redis/redisClient";
import { beforeEach, afterEach } from "@jest/globals";

// create new client because we are testing from outside the container
const testClient = createClient() as RedisClientType;
const testMatchId = "test-match-fake-id-001";
const testMatch: types.RedisMatch = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 4,
    arrows_per_end: 3,
    num_ends: 3,
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
        ends_confirmed: [],
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
        ends_confirmed: [],
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
        ends_confirmed: [],
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
        ends_confirmed: [],
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
    ends_confirmed: [],
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
            expect(async () => {
                await Match.setSession(extraUserSession, testClient);
            }).rejects.toThrow("Cannot set a new session: Session already exists.");
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
            await Match.deleteSession(extraUserId, testClient);
            const matchParticipantsSynced = JSON.parse((await testClient.HGET("match-participants", testMatchId)) as string);
            const activeSessionMatchesSynced = await testClient.HMGET("active-sessions", [extraUserSessionId, testSessionIds[0]]);
            expect(matchParticipantsSynced).toEqual([testSessionIds[0]]);
            expect(activeSessionMatchesSynced).toEqual([null, testMatchId]);
        });

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
            await Match.deleteRedisMatch(testMatchId, testClient);
        });

        test("Cannot Set New Session if Match Does Not Exist", async () => {
            expect(async () => {
                await Match.setSession(extraUserSession, testClient);
            }).rejects.toThrow("Cannot set a new session: Match does not exist.");
        });

        test("New Sessions can Be Set While Number of Participants < max_participants", async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient);

            for (const session of testUserSessions) {
                await Match.setSession(session, testClient);
            }
            expect(JSON.parse((await testClient.HGET("match-participants", testMatchId)) as string)).toEqual(testSessionIds);

            // should reject because now match is full
            expect(async () => {
                await Match.setSession(extraUserSession, testClient);
            }).rejects.toThrow("Cannot set a new session: Match is full.");
        });
    });

    describe("Testing the Behaviour of Match Lobby Occupancy (open and full states)", () => {
        beforeAll(async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient);
            for (const testSession of testUserSessions) {
                await Match.setSession(testSession, testClient);
            }
        });

        afterAll(async () => {
            await Match.deleteRedisMatch(testMatchId, testClient);
        });

        test("Can Correctly Get the Number of Participants in a Match", async () => {
            const numParticipants = await Match.getNumParticipants(testMatchId, testClient);
            expect(numParticipants).toBe(4);
        });

        test("Can Correctly Retrieve all Participant Sessions", async () => {
            const participants = await Match.getParticipants(testMatchId, testClient);
            expect(participants).toEqual(testUserSessions);
        });

        test("Match is full when the number of participants >= max_participants", async () => {
            const matchState = await Match.getState(testMatchId, testClient);
            expect(matchState).toEqual({
                current_state: "full",
                previous_state: "open",
            });
        });

        test("A user leaving would revert the match state back to open", async () => {
            await Match.deleteSession(testUserSessions[3].user_id, testClient);
            const matchState = await Match.getState(testMatchId, testClient);
            expect(matchState).toEqual({
                current_state: "open",
                previous_state: "full",
            });
        });
    });

    describe("Testing the Behaviour of Match Instances in the Lobby (open, full, and transition to submit)", () => {
        const matchInstances: Array<Match> = [];

        beforeAll(async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient);
            for (const testSession of testUserSessions) {
                await Match.setSession(testSession, testClient);
            }
        });

        afterAll(async () => {
            await Match.deleteRedisMatch(testMatchId, testClient);
        });

        test("Match Instances Can Be Created for Users with Active Sessions", async () => {
            for (const userSession of testUserSessions) {
                const userId = userSession.user_id;
                matchInstances.push((await Match.initMatchForUser(userId, testClient)) as Match);
            }
            for (const matchInstance of matchInstances) {
                expect(matchInstance).toBeInstanceOf(Match);
            }
        });

        test("Match Instances Cannot Be Created Without an Active Session", async () => {
            const noSessionInstance = await Match.initMatchForUser(extraUserId, testClient);
            expect(noSessionInstance).toBe(null);
        });

        test("Getter Instance Methods Wrap Static Methods But Ties Responses to the Instance's Match ID", async () => {
            const firstUser = matchInstances[0];
            expect(await firstUser.getNumParticipants()).toBe(4);
            expect((await firstUser.getRedisMatch()).name).toEqual(testMatch.name);
            expect(await firstUser.getSession()).toEqual(testUserSessions[0]);
            expect(await firstUser.getState()).toEqual({
                current_state: "full",
                previous_state: "open",
            });

            // leaveMatch() calls deleteSession() for this user and undefines all instance properties
            await firstUser.leaveMatch();
            expect(await Match.getNumParticipants(testMatchId, testClient)).toBe(3);
            expect(firstUser.matchId).toBe(undefined);
            expect(firstUser.userId).toBe(undefined);

            matchInstances.shift();
        });

        test("Users Can Ready But Match Will Not Move to Submit Unless it Is Full", async () => {
            for (const matchInstance of matchInstances) {
                await matchInstance.setReady();
            }
            const matchState = await matchInstances[0].getState();
            expect(matchState).toEqual({
                current_state: "open",
                previous_state: "full",
            });
        });

        test("Users Can Unready", async () => {
            for (const matchInstance of matchInstances) {
                await matchInstance.setUnready();
            }
            const participants = await matchInstances[0].getParticipants();
            for (const participant of participants) {
                expect(participant.ready).toBe(false);
            }
        });

        test("Match moves to submit when it is full and all users are ready", async () => {
            await Match.setSession(testUserSessions[0], testClient);
            matchInstances.unshift((await Match.initMatchForUser(testUserSessions[0].user_id, testClient)) as Match);
            const matchState = await matchInstances[0].getState();
            expect(matchState).toEqual({
                current_state: "full",
                previous_state: "open",
            });
            for (const matchInstance of matchInstances) {
                await matchInstance.setReady();
            }
            const newMatchState = await Match.getState(testMatchId, testClient);
            expect(newMatchState).toEqual({
                current_state: "submit",
                previous_state: "full",
            });
        });
    });

    describe("Testing the Behaviour of Match Setup", () => {
        const matchInstances: Array<Match> = [];
        const matchSubmissionMap = {
            "user-004": "match-session:user-001",
            "user-001": "match-session:user-002",
            "user-002": "match-session:user-003",
            "user-003": "match-session:user-004",
        };
        const firstUserSubmissionForm: types.EndSubmissionForm = {
            for: {
                id: "user-002",
                first_name: "Bob",
                last_name: "Smith",
                university: "Some University",
            },
            current_end: 1,
            arrows: [null, null, null],
        };
        const thirdUserSubmissionForm: types.EndSubmissionForm = {
            for: {
                id: "user-004",
                first_name: "Diana",
                last_name: "Prince",
                university: "Some University",
            },
            current_end: 1,
            arrows: [null, null, null],
        };

        // set up to submit stage
        beforeAll(async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient);
            for (const testSession of testUserSessions) {
                await Match.setSession(testSession, testClient);
                const matchInstance = (await Match.initMatchForUser(testSession.user_id, testClient)) as Match;
                await matchInstance.setReady();
                matchInstances.push(matchInstance);
            }
        });

        afterAll(async () => {
            await Match.deleteRedisMatch(testMatchId, testClient);
        });

        test("Match is In Submit Stage", async () => {
            const matchState = await Match.getState(testMatchId, testClient);
            expect(matchState).toEqual({
                current_state: "submit",
                previous_state: "full",
            });
        });

        test("A Disconnecting User Should Pause the Match", async () => {
            const firstUser = matchInstances[0];
            const secondUser = matchInstances[1];
            await firstUser.setDisconnect();
            await secondUser.setDisconnect();
            const matchState = await Match.getState(testMatchId, testClient);
            expect(matchState).toEqual({
                current_state: "paused",
                previous_state: "submit",
            });
            expect((await firstUser.getSession()).connected).toBe(false);
            expect((await secondUser.getSession()).connected).toBe(false);
        });

        test("When all disconnected users reconnect, the Match should unpause and revert to its previous state", async () => {
            const firstUser = matchInstances[0];
            const secondUser = matchInstances[1];
            await firstUser.setConnect();
            expect(await firstUser.getState()).toEqual({
                current_state: "paused",
                previous_state: "submit",
            });
            await secondUser.setConnect();
            expect(await secondUser.getState()).toEqual({
                current_state: "submit",
                previous_state: "paused",
            });
            expect((await firstUser.getSession()).connected).toBe(true);
            expect((await secondUser.getSession()).connected).toBe(true);
        });

        test("Submission Map Must Be Set Up Where Users DO NOT SUBMIT for themselves", async () => {
            const match = await Match.getRedisMatch(testMatchId, testClient);
            expect(match.submission_map).toEqual(matchSubmissionMap);
        });

        test("Users Can Get Submission Forms", async () => {
            const firstUser = matchInstances[0];
            const thirdUser = matchInstances[2];
            expect(await firstUser.getEndSubmissionForm()).toEqual(firstUserSubmissionForm);
            expect(await thirdUser.getEndSubmissionForm()).toEqual(thirdUserSubmissionForm);
        });
    });

    describe("Testing the Behaviour of End Submissions", () => {
        let matchInstances: Match[] = [];

        // set up to submit stage before each test
        beforeEach(async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient);
            for (const testSession of testUserSessions) {
                await Match.setSession(testSession, testClient);
                const matchInstance = (await Match.initMatchForUser(testSession.user_id, testClient)) as Match;
                await matchInstance.setReady();
                matchInstances.push(matchInstance);
            }
        });

        // reset after each test
        afterEach(async () => {
            matchInstances = [];
            await Match.deleteRedisMatch(testMatchId, testClient);
        });

        test("Users Can Submit Arrows", async () => {
            for (const user of matchInstances) {
                await user.submitEndArrows([9, 9, 10]);
            }
            const firstUser = matchInstances[0];
            const firstUserScores = await firstUser.getScores();
            expect(firstUserScores).toEqual([
                { score: 10, submitted_by: "user-004" },
                { score: 9, submitted_by: "user-004" },
                { score: 9, submitted_by: "user-004" },
            ]); // each end should be saved in descending order
        });

        test("Users Should Not Be Able to Submit More/Less Arrows Than What The Match Specifies Per End", async () => {
            const firstUser = matchInstances[0];
            expect(async () => {
                await firstUser.submitEndArrows([9, 9, 10, 10]);
            }).rejects.toThrow("End submission rejected: Number arrows submitted greater than arrows_per_end.");
            expect(async () => {
                await firstUser.submitEndArrows([9, 9]);
            }).rejects.toThrow("End submission rejected: Number arrows submitted less than arrows_per_end.");
        });

        test("Users Should Not Be Able to Submit Invalid Scores", async () => {
            const firstUser = matchInstances[0];
            expect(async () => {
                await firstUser.submitEndArrows([9, 9, 11] as any[]);
            }).rejects.toThrow("End submission rejected: Scores must be between 0-10 or an X.");
            expect(async () => {
                await firstUser.submitEndArrows([9, 9, "A"] as any[]);
            }).rejects.toThrow("End submission rejected: Scores must be between 0-10 or an X.");
        });

        test("Match Should Move To Confirmation Stage Once All Users Have Submitted Scores For This End", async () => {
            // only half of users submitted
            for (const user of matchInstances.slice(0, 2)) {
                await user.submitEndArrows([9, 9, 10]);
            }
            const firstUser = matchInstances[0];
            const matchState = await firstUser.getState();
            expect(matchState).toEqual({
                current_state: "submit",
                previous_state: "full",
            });
            // other half submits
            for (const user of matchInstances.slice(2, 4)) {
                await user.submitEndArrows([9, 9, 10]);
            }
            const confirmationMatchState = await firstUser.getState();
            expect(confirmationMatchState).toEqual({
                current_state: "confirmation",
                previous_state: "submit",
            });
        });
    });

    describe("Testing the Behaviour of End Confirmation", () => {
        let matchInstances: Match[] = [];
        const firstEndTotal: types.EndTotals = {
            current_end: 1,
            arrows_shot: 3,
            end_totals: [
                {
                    id: "user-001",
                    first_name: "Alice",
                    last_name: "Johnson",
                    university: "Some University",
                    running_total: 28,
                    end_total: 28,
                    end_arrows: [
                        { score: 10, submitted_by: "user-004" },
                        { score: 9, submitted_by: "user-004" },
                        { score: 9, submitted_by: "user-004" },
                    ],
                },
                {
                    id: "user-002",
                    first_name: "Bob",
                    last_name: "Smith",
                    university: "Some University",
                    running_total: 28,
                    end_total: 28,
                    end_arrows: [
                        { score: 10, submitted_by: "user-001" },
                        { score: 9, submitted_by: "user-001" },
                        { score: 9, submitted_by: "user-001" },
                    ],
                },
                {
                    id: "user-003",
                    first_name: "Charlie",
                    last_name: "Brown",
                    university: "Some University",
                    running_total: 28,
                    end_total: 28,
                    end_arrows: [
                        { score: 10, submitted_by: "user-002" },
                        { score: 9, submitted_by: "user-002" },
                        { score: 9, submitted_by: "user-002" },
                    ],
                },
                {
                    id: "user-004",
                    first_name: "Diana",
                    last_name: "Prince",
                    university: "Some University",
                    running_total: 28,
                    end_total: 28,
                    end_arrows: [
                        { score: 10, submitted_by: "user-003" },
                        { score: 9, submitted_by: "user-003" },
                        { score: 9, submitted_by: "user-003" },
                    ],
                },
            ],
        };
        const secondEndTotal: types.EndTotals = {
            current_end: 2,
            arrows_shot: 6,
            end_totals: [
                {
                    id: "user-001",
                    first_name: "Alice",
                    last_name: "Johnson",
                    university: "Some University",
                    running_total: 49,
                    end_total: 21,
                    end_arrows: [
                        { score: 8, submitted_by: "user-004" },
                        { score: 7, submitted_by: "user-004" },
                        { score: 6, submitted_by: "user-004" },
                    ],
                },
                {
                    id: "user-002",
                    first_name: "Bob",
                    last_name: "Smith",
                    university: "Some University",
                    running_total: 49,
                    end_total: 21,
                    end_arrows: [
                        { score: 8, submitted_by: "user-001" },
                        { score: 7, submitted_by: "user-001" },
                        { score: 6, submitted_by: "user-001" },
                    ],
                },
                {
                    id: "user-003",
                    first_name: "Charlie",
                    last_name: "Brown",
                    university: "Some University",
                    running_total: 49,
                    end_total: 21,
                    end_arrows: [
                        { score: 8, submitted_by: "user-002" },
                        { score: 7, submitted_by: "user-002" },
                        { score: 6, submitted_by: "user-002" },
                    ],
                },
                {
                    id: "user-004",
                    first_name: "Diana",
                    last_name: "Prince",
                    university: "Some University",
                    running_total: 49,
                    end_total: 21,
                    end_arrows: [
                        { score: 8, submitted_by: "user-003" },
                        { score: 7, submitted_by: "user-003" },
                        { score: 6, submitted_by: "user-003" },
                    ],
                },
            ],
        };
        const endResetResponse: types.EndResetResponse = {
            action: "reset",
            resetPayload: [
                {
                    receipient: "user-004",
                    for: {
                        id: "user-001",
                        first_name: "Alice",
                        last_name: "Johnson",
                        university: "Some University",
                    },
                    current_end: 1,
                    arrows: [
                        { score: 10, submitted_by: "user-004" },
                        { score: 9, submitted_by: "user-004" },
                        { score: 9, submitted_by: "user-004" },
                    ],
                },
                {
                    receipient: "user-001",
                    for: {
                        id: "user-002",
                        first_name: "Bob",
                        last_name: "Smith",
                        university: "Some University",
                    },
                    current_end: 1,
                    arrows: [
                        { score: 10, submitted_by: "user-001" },
                        { score: 9, submitted_by: "user-001" },
                        { score: 9, submitted_by: "user-001" },
                    ],
                },
                {
                    receipient: "user-002",
                    for: {
                        id: "user-003",
                        first_name: "Charlie",
                        last_name: "Brown",
                        university: "Some University",
                    },
                    current_end: 1,
                    arrows: [
                        { score: 10, submitted_by: "user-002" },
                        { score: 9, submitted_by: "user-002" },
                        { score: 9, submitted_by: "user-002" },
                    ],
                },
                {
                    receipient: "user-003",
                    for: {
                        id: "user-004",
                        first_name: "Diana",
                        last_name: "Prince",
                        university: "Some University",
                    },
                    current_end: 1,
                    arrows: [
                        { score: 10, submitted_by: "user-003" },
                        { score: 9, submitted_by: "user-003" },
                        { score: 9, submitted_by: "user-003" },
                    ],
                },
            ],
        };
        const secondEndResetResponse: types.EndResetResponse = {
            action: "reset",
            resetPayload: [
                {
                    receipient: "user-004",
                    for: {
                        id: "user-001",
                        first_name: "Alice",
                        last_name: "Johnson",
                        university: "Some University",
                    },
                    arrows: [
                        { score: 8, submitted_by: "user-004" },
                        { score: 7, submitted_by: "user-004" },
                        { score: 6, submitted_by: "user-004" },
                    ],
                    current_end: 2,
                },
                {
                    receipient: "user-001",
                    for: {
                        id: "user-002",
                        first_name: "Bob",
                        last_name: "Smith",
                        university: "Some University",
                    },
                    arrows: [
                        { score: 8, submitted_by: "user-001" },
                        { score: 7, submitted_by: "user-001" },
                        { score: 6, submitted_by: "user-001" },
                    ],
                    current_end: 2,
                },
                {
                    receipient: "user-002",
                    for: {
                        id: "user-003",
                        first_name: "Charlie",
                        last_name: "Brown",
                        university: "Some University",
                    },
                    arrows: [
                        { score: 8, submitted_by: "user-002" },
                        { score: 7, submitted_by: "user-002" },
                        { score: 6, submitted_by: "user-002" },
                    ],
                    current_end: 2,
                },
                {
                    receipient: "user-003",
                    for: {
                        id: "user-004",
                        first_name: "Diana",
                        last_name: "Prince",
                        university: "Some University",
                    },
                    arrows: [
                        { score: 8, submitted_by: "user-003" },
                        { score: 7, submitted_by: "user-003" },
                        { score: 6, submitted_by: "user-003" },
                    ],
                    current_end: 2,
                },
            ],
        };

        // set up to confirmation stage before each test
        beforeEach(async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient);
            for (const testSession of testUserSessions) {
                await Match.setSession(testSession, testClient);
                const matchInstance = (await Match.initMatchForUser(testSession.user_id, testClient)) as Match;
                await matchInstance.setReady();
                matchInstances.push(matchInstance);
            }
            for (const user of matchInstances) {
                await user.submitEndArrows([9, 9, 10]);
            }
        });

        // reset after each test
        afterEach(async () => {
            matchInstances = [];
            await Match.deleteRedisMatch(testMatchId, testClient);
        });

        test("Match is in confirmation stage", async () => {
            const matchState = await Match.getState(testMatchId, testClient);
            expect(matchState).toEqual({
                current_state: "confirmation",
                previous_state: "submit",
            });
        });

        test("Users Can Get Everyone's End Totals", async () => {
            for (const user of matchInstances) {
                const thisEndTotal = await user.getEndTotals();
                expect(thisEndTotal).toEqual(firstEndTotal);
            }
        });

        test("When All Users Confirm, Match Moves To Second End", async () => {
            // only half of users confirm
            for (const user of matchInstances.slice(0, 2)) {
                await user.confirmEnd();
            }
            const firstUser = matchInstances[0];
            const matchState = await firstUser.getState();
            expect(matchState).toEqual({
                current_state: "confirmation",
                previous_state: "submit",
            });
            // other half confirms
            for (const user of matchInstances.slice(2, 4)) {
                await user.confirmEnd();
            }
            const confirmationMatchState = await firstUser.getState();
            expect(confirmationMatchState).toEqual({
                current_state: "submit",
                previous_state: "confirmation",
            });
            const match = await firstUser.getRedisMatch();
            expect(match.current_end).toBe(2);
        });

        test("When One Of The Users Disagree, Match Gets Reset to the Start of This End", async () => {
            // only 3 of users confirm
            for (const user of matchInstances.slice(0, 3)) {
                const confirmAction = await user.confirmEnd();
                expect(confirmAction).toBe("waiting");
            }
            const lastUser = matchInstances[3];
            const lastUserConfirmAction = await lastUser.rejectEnd();
            expect(lastUserConfirmAction).toEqual(endResetResponse);

            // check that end did not progress
            const match = await lastUser.getRedisMatch();
            expect(match.current_end).toBe(1);

            // check that arrows were reset
            const participants = await lastUser.getParticipants();
            for (const participant of participants) {
                expect(participant.scores).toEqual([]);
            }
        });

        test("Reset Also Works After Second Submission", async () => {
            for (const user of matchInstances) {
                await user.confirmEnd();
            }
            for (const user of matchInstances) {
                await user.submitEndArrows([6, 7, 8]);
            }
            const thirdUser = matchInstances[2];
            const secondEndTotals = await thirdUser.getEndTotals();
            expect(secondEndTotals).toEqual(secondEndTotal);

            // reject confirmation again
            for (const user of matchInstances.slice(0, 2)) {
                await user.confirmEnd();
            }
            await thirdUser.rejectEnd();
            const lastUser = matchInstances[3];
            const secondEndRejectionResponse = await lastUser.confirmEnd();
            expect(secondEndRejectionResponse).toEqual(secondEndResetResponse)
        });


    });

    describe("Testing the Behaviour of A Finished Match", () => {
        let matchInstances: Match[] = []

        // set up to confirmation stage before each test
        beforeEach(async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient);
            for (const testSession of testUserSessions) {
                await Match.setSession(testSession, testClient);
                const matchInstance = (await Match.initMatchForUser(testSession.user_id, testClient)) as Match;
                await matchInstance.setReady();
                matchInstances.push(matchInstance);
            }
            // get it to the final end
            for (let end = 1; end <= 2; end ++) {
                // submit
                for (const user of matchInstances) {
                    await user.submitEndArrows([9, 9, 10]);
                }
                // confirm
                for (const user of matchInstances) {
                    await user.confirmEnd();
                }
            }
            // submit arrows for the 3rd end
            for (const user of matchInstances) {
                await user.submitEndArrows([9, 9, 10]);
            }
        });

        // reset after each test
        afterEach(async () => {
            matchInstances = [];
            await Match.deleteRedisMatch(testMatchId, testClient);
        });

        test("Match is in the final (3rd) end", async () => {
            // check end
            const match = await Match.getRedisMatch(testMatchId, testClient)
            expect(match.current_end).toBe(3)

            // check running total
            const firstUser = matchInstances[0]
            const scores = await firstUser.getScores()
            expect(Match.calculateArrowTotal(scores)).toBe(84)

            // check running total in EndTotals
            const { end_totals } = await firstUser.getEndTotals()
            const firstUserEndTotal = end_totals[0]
            expect(firstUserEndTotal.running_total).toBe(84)
        })

        test("Successful Confirmation of the Final End Moves the Match to the Finished State", async () => {
            // confirm
            for (const user of matchInstances) {
                await user.confirmEnd();
            }
            const firstUser = matchInstances[0]
            const matchState = await firstUser.getState()
            expect(matchState).toEqual({
                current_state: "finished",
                previous_state: "confirmation"
            })
        })

        test("Failed Confirmation of the Final End Moves the Match Maintains the Match in The Submit State", async () => {
            // reject
            for (const user of matchInstances) {
                await user.rejectEnd();
            }
            const firstUser = matchInstances[0]
            const matchState = await firstUser.getState()
            const match = await firstUser.getRedisMatch()
            expect(match.current_end).toBe(3)
            expect(matchState).toEqual({
                current_state: "submit",
                previous_state: "confirmation"
            })
        })
    })

    describe("Testing the Behaviour of Finished Matches", () => {

        let matchInstances: Match[] = []
        const expectedMatchReport = {
            host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
            name: "Test Match",
            scoresheets: [
                {
                    round: "Portsmouth",
                    user_id: "user-001",
                    arrows_shot: 9,
                    arrows_per_end: 3,
                    num_ends: 3,
                    scoresheet: [
                        { score: 10, submitted_by: "user-004" },
                        { score: 9, submitted_by: "user-004" },
                        { score: 9, submitted_by: "user-004" },
                        { score: 10, submitted_by: "user-004" },
                        { score: 9, submitted_by: "user-004" },
                        { score: 9, submitted_by: "user-004" },
                        { score: 10, submitted_by: "user-004" },
                        { score: 9, submitted_by: "user-004" },
                        { score: 9, submitted_by: "user-004" },
                    ]
                },
                {
                    round: "Portsmouth",
                    user_id: "user-002",
                    arrows_shot: 9,
                    arrows_per_end: 3,
                    num_ends: 3,
                    scoresheet: [
                        { score: 10, submitted_by: "user-001" },
                        { score: 9, submitted_by: "user-001" },
                        { score: 9, submitted_by: "user-001" },
                        { score: 10, submitted_by: "user-001" },
                        { score: 9, submitted_by: "user-001" },
                        { score: 9, submitted_by: "user-001" },
                        { score: 10, submitted_by: "user-001" },
                        { score: 9, submitted_by: "user-001" },
                        { score: 9, submitted_by: "user-001" },
                    ]
                },
                {
                    round: "Portsmouth",
                    user_id: "user-003",
                    arrows_shot: 9,
                    arrows_per_end: 3,
                    num_ends: 3,
                    scoresheet: [
                        { score: 10, submitted_by: "user-002" },
                        { score: 9, submitted_by: "user-002" },
                        { score: 9, submitted_by: "user-002" },
                        { score: 10, submitted_by: "user-002" },
                        { score: 9, submitted_by: "user-002" },
                        { score: 9, submitted_by: "user-002" },
                        { score: 10, submitted_by: "user-002" },
                        { score: 9, submitted_by: "user-002" },
                        { score: 9, submitted_by: "user-002" },
                    ]
                },
                {
                    round: "Portsmouth",
                    user_id: "user-004",
                    arrows_shot: 9,
                    arrows_per_end: 3,
                    num_ends: 3,
                    scoresheet: [
                        { score: 10, submitted_by: "user-003" },
                        { score: 9, submitted_by: "user-003" },
                        { score: 9, submitted_by: "user-003" },
                        { score: 10, submitted_by: "user-003" },
                        { score: 9, submitted_by: "user-003" },
                        { score: 9, submitted_by: "user-003" },
                        { score: 10, submitted_by: "user-003" },
                        { score: 9, submitted_by: "user-003" },
                        { score: 9, submitted_by: "user-003" },
                    ]
                }
            ]
        } as types.MatchReport

        // set up to confirmation stage before each test
        beforeEach(async () => {
            await Match.createRedisMatch(testMatchId, testMatch, testClient);
            for (const testSession of testUserSessions) {
                await Match.setSession(testSession, testClient);
                const matchInstance = (await Match.initMatchForUser(testSession.user_id, testClient)) as Match;
                await matchInstance.setReady();
                matchInstances.push(matchInstance);
            }
            // finish match
            for (let end = 1; end <= 3; end ++) {
                // submit
                for (const user of matchInstances) {
                    await user.submitEndArrows([9, 9, 10]);
                }
                // confirm
                for (const user of matchInstances) {
                    await user.confirmEnd();
                }
            }
        });

        // reset after each test
        afterEach(async () => {
            matchInstances = [];
            await Match.deleteRedisMatch(testMatchId, testClient);
        });

        test("Match is Finished", async () => {
            const matchState = await Match.getState(testMatchId, testClient)
            expect(matchState).toEqual({
                current_state: "finished",
                previous_state: "confirmation"
            })
        })

        test("Can Obtain Scoresheets After Match Finishes", async () => {
            const matchReport = await Match.getMatchReport(testMatchId, testClient)
            expect(matchReport).toMatchObject(expectedMatchReport)
        })

        test("Only One User can Retrieve the Match Report", async () => {
            const firstUser = matchInstances[0]
            const matchReports = []
            for (const user of matchInstances) {
                matchReports.push(await user.getMatchReport())
            }

            // make sure only one value is truthy
            const theOneMatchReport = matchReports.filter(matchReport => matchReport)
            expect(theOneMatchReport.length).toBe(1)
            expect(theOneMatchReport[0]).toMatchObject(expectedMatchReport)
        })
    })
});
