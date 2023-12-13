import { RedisJSON } from "@redis/json/dist/commands";
import { RedisClientType, createClient } from "redis";
import * as types from "../types";
import LiveMatch from "./LiveMatch";

describe("LiveMatch Testing Suite Implementing Redis PubSub", () => {
    // create new client because we are testing from outside the container
    const testClient = createClient() as RedisClientType;
    const testMatchId = "test-match-fake-id-001";
    const testMatch: types.LiveMatch = {
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
        participants: {},
    };
    const testUserIds = ["user-001", "user-002", "user-003", "user-004"];
    const testSessionIds = ["session-001", "session-002", "session-003", "session-004"];
    const testUsers: types.MatchParticipant<"archer">[] = [
        {
            first_name: "Alice",
            last_name: "Johnson",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: new Array(20).fill(false),
            connected: true,
            session: "session-001",
        },
        {
            first_name: "Bob",
            last_name: "Smith",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: new Array(20).fill(false),
            connected: true,
            session: "session-002",
        },
        {
            first_name: "Charlie",
            last_name: "Brown",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: new Array(20).fill(false),
            connected: true,
            session: "session-003",
        },
        {
            first_name: "Diana",
            last_name: "Prince",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: new Array(20).fill(false),
            connected: true,
            session: "session-004",
        },
    ];
    const extraUserId = "extra-user-001";
    const extraUserSession = "extra-session-001";
    const extraUser: types.MatchParticipant<"archer"> = {
        session: extraUserSession,
        first_name: "Ethan",
        last_name: "Hunt",
        ready: false,
        university: "Some University",
        role: "archer",
        scores: [],
        ends_confirmed: new Array(20).fill(false),
        connected: true,
    };
    const expMatchUsers: { [userId: string]: types.MatchParticipant<"archer"> } = {};
    let liveMatchInstance: LiveMatch;

    beforeAll(async () => {
        await testClient.connect();
        await testClient.json.SET(testMatchId, ".", testMatch as unknown as RedisJSON);
        // set sessions
        for (const sessionId of testSessionIds) {
            await testClient.SET(sessionId, testMatchId);
        }
    });

    afterAll(async () => {
        await testClient.json.DEL(testMatchId);
        // clear sessions
        for (const sessionId of testSessionIds) {
            await testClient.DEL(sessionId);
        }
        await testClient.disconnect();
    });

    test("test suite has set testMatch in Redis", async () => {
        const testMatchInRedis = await testClient.json.get(testMatchId);
        expect(testMatchInRedis).toMatchObject(testMatch);
    });

    test("LiveMatch can initialize and is linked to the correct JSON match", async () => {
        liveMatchInstance = new LiveMatch(testMatchId, testClient);
        expect(liveMatchInstance).toBeInstanceOf(LiveMatch);
        const liveMatchObject = await liveMatchInstance.getLiveMatch();
        expect(liveMatchObject).toMatchObject(testMatch);
    });

    test("LiveMatch can retrieve all string and number fields from Redis", async () => {
        const fields = await liveMatchInstance.getMatchInfoFields(
            "host",
            "created_at",
            "arrows_per_end",
            "num_ends",
            "max_participants",
            "name",
            "current_state",
            "previous_state",
            "current_end",
            "round"
        );
        const nameField = await liveMatchInstance.getMatchInfoFields("name");
        if (fields) {
            expect(testMatch).toMatchObject(fields);
            expect(nameField).toBe(testMatch.name);
        } else {
            throw new Error("fields do not match");
        }
    });

    test("LiveMatch can register new participants, retrieve, and remove them", async () => {
        await testClient.SET(extraUserSession, testMatchId)
        await liveMatchInstance.registerUser(extraUserId, extraUser);
        const retrievedUser = await liveMatchInstance.getUser(extraUserId);
        expect(retrievedUser).toMatchObject(extraUser);
        await liveMatchInstance.deleteUser(extraUserId);
        const retrievedNoUser = await liveMatchInstance.getUser(extraUserId);
        expect(retrievedNoUser).toBe(null);
    });

    test("LiveMatch can register new participants until number of participants === max_capacity", async () => {
        // fill up match
        for (let idx = 0; idx < testUsers.length; idx++) {
            const userId = testUserIds[idx];
            const user = testUsers[idx];
            const registerUser = await liveMatchInstance.registerUser(userId, user);
            expMatchUsers[userId] = user;
            expect(registerUser).toBe(true);
        }
        // try to add an extra one
        const extaUserRegister = await liveMatchInstance.registerUser(extraUserId, extraUser);
        expect(extaUserRegister).toBe(false);
    });

    test("LiveMatch can retrieve participant fields", async () => {
        const participantInfoFields = await liveMatchInstance.getParticipantFields(
            "user-001",
            "session",
            "first_name",
            "last_name",
            "university",
            "role",
            "connected",
            "ready",
            "ends_confirmed",
            "scores"
        );
        const firstNameField = await liveMatchInstance.getParticipantFields("user-001", "first_name");
        if (participantInfoFields) {
            expect(participantInfoFields).toEqual(expMatchUsers["user-001"])
            expect(firstNameField).toBe(expMatchUsers["user-001"]["first_name"]);
        } else {
            throw new Error("fields do not match");
        }
    });

    test("LiveMatch can return a list (array) of currently registered users", async () => {
        const expUserArray = Object.entries(expMatchUsers).map(([id, user]) => {
            return {
                id,
                user,
            };
        });
        const matchParticipants = await liveMatchInstance.getParticipants();
        expect(matchParticipants).toEqual(expUserArray);
    });

    test("LiveMatch can ready and unready registered users, returns false if user not registered", async () => {
        // ready user
        expMatchUsers["user-001"].ready = true;
        await liveMatchInstance.setReady("user-001");
        const user001Ready = await liveMatchInstance.getUser("user-001");
        expect(user001Ready).toEqual(expMatchUsers["user-001"]);

        // unready user
        expMatchUsers["user-001"].ready = false;
        await liveMatchInstance.setUnready("user-001");
        const user001Unready = await liveMatchInstance.getUser("user-001");
        expect(user001Unready).toEqual(expMatchUsers["user-001"]);

        // user does not exist
        const extraUserReady = await liveMatchInstance.setReady(extraUserId);
        const extraUserUnready = await liveMatchInstance.setUnready(extraUserId);
        expect(extraUserReady).toBe(false);
        expect(extraUserUnready).toBe(false);
    });

    test("LiveMatch can set user connected state to true and false, returns false if not registered", async () => {
        // ready user
        expMatchUsers["user-001"].connected = true;
        await liveMatchInstance.setConnected("user-001");
        const user001Connected = await liveMatchInstance.getUser("user-001");
        expect(user001Connected).toEqual(expMatchUsers["user-001"]);

        // unready user
        expMatchUsers["user-001"].connected = false;
        await liveMatchInstance.setDisconnected("user-001");
        const user001Disconnected = await liveMatchInstance.getUser("user-001");
        expect(user001Disconnected).toEqual(expMatchUsers["user-001"]);

        // user does not exist
        const extraUserConnected = await liveMatchInstance.setConnected(extraUserId);
        const extraUserDisconnected = await liveMatchInstance.setDisconnected(extraUserId);
        expect(extraUserConnected).toBe(false);
        expect(extraUserDisconnected).toBe(false);
    });

    test("LiveMatch can return its state", async () => {
        const matchState = await liveMatchInstance.getState();
        expect(matchState).toEqual({
            current_state: "full",
            previous_state: "open",
        });
    });

    test("LiveMatch switches back to open from full when one of the users leave and deletes session", async () => {
        await liveMatchInstance.deleteUser("user-004");
        delete expMatchUsers["user-004"]
        const matchState = await liveMatchInstance.getState();
        expect(matchState).toEqual({
            current_state: "open",
            previous_state: "full",
        });
        const user004session = await testClient.GET("session-004");
        expect(user004session).toBe(null);
    });

    test("LiveMatch will not let users without a session to register", async () => {
        const registerUserWithNoSession = await liveMatchInstance.registerUser(testUserIds[3], testUsers[3])
        expect(registerUserWithNoSession).toBe(false)
    })

    // test("LiveMatch will automatically delete user with no session", async () => {
    //     await testClient.DEL("session-003")
    //     const user003 = await liveMatchInstance.getUser("user-003")
    //     delete expMatchUsers["user-003"]
    //     expect(user003).toBe(null)
    //     await testClient.DEL("session-002")
    //     delete expMatchUsers["user-002"]
    //     const expUserArray = Object.entries(expMatchUsers).map(([id, user]) => {
    //         return {
    //             id,
    //             user,
    //         };
    //     });
    //     const participants = await liveMatchInstance.getParticipants()
    //     expect(expUserArray).toEqual(participants)
    // })

    test("LiveMatch switches to submit when number of users = max_capacity and all users are ready", async () => {
        await testClient.SET(testSessionIds[3], testMatchId)
        await liveMatchInstance.registerUser(testUserIds[3], testUsers[3]);
        for (const userId of testUserIds) {
            await liveMatchInstance.setReady(userId);
        }
        const matchState = await liveMatchInstance.getState();
        expect(matchState).toEqual({
            current_state: "submit",
            previous_state: "full",
        });
    });
});
