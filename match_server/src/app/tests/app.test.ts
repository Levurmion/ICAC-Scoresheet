import { RedisClientType, createClient } from "redis";
import { MatchTokenPayload, RedisMatch, SocketIORedisMatchState, UserSession } from "../../lib/types";
import Match from "../../lib/classes/Match";
import { resolve } from "path";
import {
    expectedUserAMatchState,
    expectedUserAReadyMatchState,
    expectedUserAUnreadyMatchState,
    expectedUserBDisconnectedMatchState,
    expectedUserBLeftMatchState,
    expectedUserBMatchState,
    expectedAllReadyMatchState,
    userASubmit_end1,
    confirmation_end1,
    endReset_end1,
    submitMatchState_end2,
    pausedMatchState,
    resumedMatchState,
    finishedMatchState,
    saveToSupabaseResponse,
} from "./fixtures";
import useSupabaseBasicClient from "../../lib/supabase/useSupabaseBasicClient";
const io = require("socket.io-client");
const dotenv = require('dotenv')

// TEST DATA
const testMatchId = "match:test-match-fake-id-001";
const testMatch: RedisMatch = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 0,
    current_state: "open",
    previous_state: "open",
    submission_map: {},
};
const testUserIdA = "57ab3332-c2fe-4233-9fcb-df1387de331e";
const testUserIdB = "b5708a67-5e10-4af6-94c5-80cbd8e8464d";

function createClientSocket(userId: string) {
    return io("http://localhost", {
        path: "/match-server/socket.io/",
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnection: true,
        autoConnect: false,
        auth: {
            devToken: {
                match_uuid: testMatchId,
                user_uuid: userId,
                role: "archer",
            } as MatchTokenPayload,
        },
    });
}

function waitFor(clientSocket: any, event: string) {
    return new Promise((resolve, reject) => {
        clientSocket.once(event, (message: any) => resolve(message));
    });
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===============================================================================================
// ======================================== TESTING SUITE ========================================
// ===============================================================================================
describe("Match Server Events Testing Suite", () => {
    let clientSocketA: any;
    let clientSocketB: any;
    const testClient = createClient() as RedisClientType;

    beforeAll(async () => {
        // connect Redis and create test Match
        await testClient.connect();
        await Match.createRedisMatch(testMatchId, testMatch, testClient);
        // connect Socket.IO client
        clientSocketA = createClientSocket(testUserIdA);
        clientSocketB = createClientSocket(testUserIdB);
    });

    afterAll(async () => {
        // delete test Match and disconnect Redis
        await Match.deleteRedisMatch(testMatchId, testClient);
        await testClient.disconnect();
        clientSocketA.disconnect();
        clientSocketB.disconnect();

        const supabase = useSupabaseBasicClient()
        
        // delete the scoresheets
        await supabase
            .from("scoresheets")
            .delete()
            .in("user_id", [testUserIdA, testUserIdB])

        // delete the match saved in supabase
        const delMatchResponse = await supabase
            .from("matches")
            .delete()
            .eq("host", testUserIdA)
    });

    describe("Testing Lobby Events", () => {
        test("New Match States Broadcasted When New User Connects", async () => {
            // only user A in match
            const userAMatchStatePromise = waitFor(clientSocketA, "lobby-update");
            clientSocketA.connect();
            const userAMatchState = await userAMatchStatePromise;
            expect(userAMatchState).toEqual(expectedUserAMatchState);

            // user B joins, check that user A listens to "lobby-update"
            const userALobbyUpdatePromise = waitFor(clientSocketA, "lobby-update");
            const userBLobbyUpdatePromise = waitFor(clientSocketB, "lobby-update");
            clientSocketB.connect();
            const lobbyUpdates = await Promise.all([userALobbyUpdatePromise, userBLobbyUpdatePromise]);
            const [userALobbyUpdate, userBLobbyUpdate] = lobbyUpdates;

            // make sure both the update and what was received by user B were the same
            expect(userALobbyUpdate).toEqual(expectedUserBMatchState);
            expect(userBLobbyUpdate).toEqual(expectedUserBMatchState);
        });

        test("user-leave", async () => {
            // user B leaves the match, check that user A received the "lobby-update" and user B receives a "disconnect" event
            const userBDisconnectPromise = waitFor(clientSocketB, "disconnect");
            const userALeavingUpdatePromise = waitFor(clientSocketA, "lobby-update");
            const userBLeaveMatchReply = await new Promise((resolve, reject) => {
                clientSocketB.emit("user-leave", (reply: string) => {
                    resolve(reply);
                });
            });
            const userALeavingUpdate = await userALeavingUpdatePromise;
            const userBDisconnectReason = await userBDisconnectPromise;

            // check that user B has been removed and that the disconnection reason is "io server disconnect"
            expect(userALeavingUpdate).toEqual(expectedUserBLeftMatchState);
            expect(userBLeaveMatchReply).toBe("OK");
            expect(userBDisconnectReason).toBe("io server disconnect");
        });

        test("User B Can Rejoin", async () => {
            // user B rejoins, check that user A listens to "lobby-update"
            const userALobbyUpdatePromise = waitFor(clientSocketA, "lobby-update");
            const userBLobbyUpdatePromise = waitFor(clientSocketB, "lobby-update");
            clientSocketB.connect();
            const lobbyUpdates = await Promise.all([userALobbyUpdatePromise, userBLobbyUpdatePromise]);
            const [userALobbyUpdate, userBLobbyUpdate] = lobbyUpdates;

            // make sure both the update and what was received by user B were the same
            expect(userALobbyUpdate).toEqual(expectedUserBMatchState);
            expect(userBLobbyUpdate).toEqual(expectedUserBMatchState);
        });

        test("Transport Close Disconnections/Reconnections Are Broadcasted", async () => {
            // user B loses connection
            const userADisconnectionUpdatePromise = waitFor(clientSocketA, "lobby-update");
            const userBReconnectionUpdatePromise = waitFor(clientSocketB, "lobby-update");
            clientSocketB.io.engine.close(); // will automatically attempt reconnection

            // check that userB disconnection was broadcasted to userA
            const userADisconnectionUpdate = await userADisconnectionUpdatePromise;
            const userBReconnectionUpdate = await userBReconnectionUpdatePromise;
            expect(userADisconnectionUpdate).toEqual(expectedUserBDisconnectedMatchState);
            
            
            // wait until userB is reconnected to receive "lobby-update"
            expect(userBReconnectionUpdate).toEqual(expectedUserBMatchState);
            
            // delay to ensure that reconnection occurred
            await delay(1000);
        });

        test("user-ready", async () => {
            // userA readies, check that both userA and userB receives update
            clientSocketA.emit("user-ready");
            const userAUpdatePromise_readyA = waitFor(clientSocketA, "lobby-update");
            const userBUpdatePromise_readyA = waitFor(clientSocketB, "lobby-update");
            const userReadyUpdates_readyA = await Promise.all([userAUpdatePromise_readyA, userBUpdatePromise_readyA]);
            const [userAUpdate_readyA, userBUpdate_readyA] = userReadyUpdates_readyA;
            expect(userAUpdate_readyA).toEqual(expectedUserAReadyMatchState);
            expect(userBUpdate_readyA).toEqual(expectedUserAReadyMatchState);
        });

        test("user-unready", async () => {
            // userA unreadies, check that both userA and userB receives update
            clientSocketA.emit("user-unready");
            const userAUpdatePromise_unreadyA = waitFor(clientSocketA, "lobby-update");
            const userBUpdatePromise_unreadyA = waitFor(clientSocketB, "lobby-update");
            const userReadyUpdates_unreadyA = await Promise.all([userAUpdatePromise_unreadyA, userBUpdatePromise_unreadyA]);
            const [userAUpdate_unreadyA, userBUpdate_unreadyA] = userReadyUpdates_unreadyA;
            expect(userAUpdate_unreadyA).toEqual(expectedUserAUnreadyMatchState);
            expect(userBUpdate_unreadyA).toEqual(expectedUserAUnreadyMatchState);
        });

        test("Match Moves to Submit State When All Users Ready", async () => {
            // userA readies, check that both userA and userB receives update
            clientSocketA.emit("user-ready");
            clientSocketB.emit("user-ready");
            const userAUpdatePromise_readyAll = waitFor(clientSocketA, "end-submit");
            const userBUpdatePromise_readyAll = waitFor(clientSocketB, "end-submit");
            const userReadyUpdates_readyAll = await Promise.all([userAUpdatePromise_readyAll, userBUpdatePromise_readyAll]);
            const [userAUpdate_readyAll, userBUpdate_readyAll] = userReadyUpdates_readyAll;

            // expect that match has moved to "submit" state
            // .toMatchObject to ignore "started_at" timestamp
            expect(userAUpdate_readyAll).toMatchObject(expectedAllReadyMatchState);
            expect(userBUpdate_readyAll).toMatchObject(expectedAllReadyMatchState);
        });
    });

    describe("Testing Running Match Events", () => {
        test("Match Is In The Submit State", async () => {
            const { current_state } = await Match.getState(testMatchId, testClient);
            expect(current_state).toBe("submit");
        });

        test("User Can Submit Arrows For Their Designated Users", async () => {
            // fails when the number of arrows is not the same as arrows_per_end
            const wrongNumArrowsSubmitReply = await new Promise((resolve, rejects) => {
                clientSocketA.emit("user-submit", [9, 9], (reply: string) => {
                    resolve(reply);
                });
            });
            expect(wrongNumArrowsSubmitReply).toBe("End submission rejected: Number arrows submitted less than arrows_per_end.");

            // OK if submission is correct
            const successSubmitReply = await new Promise((resolve, rejects) => {
                clientSocketA.emit("user-submit", [10, 10, 10], (reply: string) => {
                    resolve(reply);
                });
            });
            expect(successSubmitReply).toBe("OK");

            // cannot double submit
            const doubleSubmitReply = await new Promise((resolve, rejects) => {
                clientSocketA.emit("user-submit", [10, 10, 10], (reply: string) => {
                    resolve(reply);
                });
            });
            expect(doubleSubmitReply).toBe("End submission rejected: End already submitted.");

            // Scores were saved in Redis
            const currentMatchState = await Match.getSocketIORedisMatchState(testMatchId, testClient);
            expect(currentMatchState).toMatchObject(userASubmit_end1);
        });

        test("After All Users Submit, Match Moves to Confirmation State", async () => {
            const userBSubmitReply = await new Promise((resolve, rejects) => {
                clientSocketB.emit("user-submit", [10, 10, 10], (reply: string) => {
                    resolve(reply);
                });
            });
            expect(userBSubmitReply).toBe("OK");

            // all users should receive update to move to confirmation state
            const userConfirmationMatchStates = await Promise.all([waitFor(clientSocketA, "end-confirmation"), waitFor(clientSocketB, "end-confirmation")]);
            const [userAConfirmation_end1, userBConfirmation_end1] = userConfirmationMatchStates;
            expect(userAConfirmation_end1).toMatchObject(confirmation_end1);
            expect(userBConfirmation_end1).toMatchObject(confirmation_end1);
        });

        test("User Can Confirm the End", async () => {
            const userAConfirmationReply = await new Promise((resolve, rejects) => {
                clientSocketA.emit("user-confirm", (reply: string) => {
                    resolve(reply);
                });
            });
            expect(userAConfirmationReply).toBe("OK");

            // user cannot confirm twice
            const userARepeatConfirmationReply = await new Promise((resolve, rejects) => {
                clientSocketA.emit("user-confirm", (reply: string) => {
                    resolve(reply);
                });
            });
            expect(userARepeatConfirmationReply).toBe("End confirmation already decided.");
        });

        test("User Rejecting An End Will Reset The End", async () => {
            const userBRejectionReply = await new Promise((resolve, rejects) => {
                clientSocketB.emit("user-reject", (reply: string) => {
                    resolve(reply);
                });
            });
            expect(userBRejectionReply).toBe("OK");

            // check that the current end is deleted
            const endResetMatchState = await Promise.all([waitFor(clientSocketA, "end-reset"), waitFor(clientSocketB, "end-reset")]);
            const [userAEndReset, userBEndReset] = endResetMatchState;
            expect(userAEndReset).toMatchObject(endReset_end1);
            expect(userBEndReset).toMatchObject(endReset_end1);
        });

        test("All Users Confirming the End Will Progress It To The Next End", async () => {
            // userA submits
            const userASubmitReply = await new Promise((resolve, rejects) => {
                clientSocketA.emit("user-submit", [10, 10, 10], (reply: string) => {
                    resolve(reply);
                });
            });

            // userB submits
            const userBSubmitReply = await new Promise((resolve, rejects) => {
                clientSocketB.emit("user-submit", [10, 10, 10], (reply: string) => {
                    resolve(reply);
                });
            });

            // all users should receive update to move to confirmation state
            const userConfirmationMatchStates = await Promise.all([waitFor(clientSocketA, "end-confirmation"), waitFor(clientSocketB, "end-confirmation")]);
            const [userAConfirmation_end1, userBConfirmation_end1] = userConfirmationMatchStates;
            expect(userAConfirmation_end1).toMatchObject(confirmation_end1);
            expect(userBConfirmation_end1).toMatchObject(confirmation_end1);

            // userA confirms
            const userAConfirmationReply = await new Promise((resolve, rejects) => {
                clientSocketA.emit("user-confirm", (reply: string) => {
                    resolve(reply);
                });
            });
            expect(userAConfirmationReply).toBe("OK");

            // userB confirms
            const userBConfirmationReply = await new Promise((resolve, rejects) => {
                clientSocketB.emit("user-confirm", (reply: string) => {
                    resolve(reply);
                });
            });
            expect(userBConfirmationReply).toBe("OK");

            // all users should receive update to move to the next end
            const userSubmitMatchStates = await Promise.all([waitFor(clientSocketA, "end-submit"), waitFor(clientSocketB, "end-submit")]);
            const [userASubmit_end2, userBSubmit_end2] = userSubmitMatchStates;
            expect(userASubmit_end2).toMatchObject(submitMatchState_end2);
            expect(userBSubmit_end2).toMatchObject(submitMatchState_end2);
        });

        test("Transport Close Disconnections/Reconnections Will Pause and Resume A Running Match", async () => {
            // user B loses connection
            const userAPausedPromise = waitFor(clientSocketA, "pause-match");
            const userBResumedPromise = waitFor(clientSocketB, "resume-match");
            clientSocketB.io.engine.close(); // will automatically attempt reconnection

            const userAPaused = await userAPausedPromise;
            expect(userAPaused).toMatchObject(pausedMatchState);

            const userBResumed = await userBResumedPromise;
            expect(userBResumed).toMatchObject(resumedMatchState);

            // assert delay to ensure B is really reconnected
            await delay(1000);
        });

    });

    describe("Testing Finished Match Events", () => {

        test("Match Is Finished Once All Ends Have Been Submitted and Confirmed, Automatically Submits to Supabase", async () => {
            // take match to the final end
            for (let end = 2; end <= 3; end++) {
                // userA submits
                const userASubmitReply = await new Promise((resolve, rejects) => {
                    clientSocketA.emit("user-submit", [10, 10, 10], (reply: string) => {
                        resolve(reply);
                    });
                });
                expect(userASubmitReply).toBe("OK");

                // userB submits
                const userBSubmitReply = await new Promise((resolve, rejects) => {
                    clientSocketB.emit("user-submit", [10, 10, 10], (reply: string) => {
                        resolve(reply);
                    });
                });
                expect(userBSubmitReply).toBe("OK");

                // userA confirms
                const userAConfirmationReply = await new Promise((resolve, rejects) => {
                    clientSocketA.emit("user-confirm", (reply: string) => {
                        resolve(reply);
                    });
                });
                expect(userAConfirmationReply).toBe("OK");

                // userB confirms
                const userBConfirmationReply = await new Promise((resolve, rejects) => {
                    clientSocketB.emit("user-confirm", (reply: string) => {
                        resolve(reply);
                    });
                });
                expect(userBConfirmationReply).toBe("OK");
            }

            const [ userAFinishedState, userBFinishedState ] = await Promise.all([
                waitFor(clientSocketA, "match-finished"),
                waitFor(clientSocketB, "match-finished")
            ])
            expect(userAFinishedState).toMatchObject(finishedMatchState)
            expect(userBFinishedState).toMatchObject(finishedMatchState)

            // monitor saving to supabase
            const userA_savedToSupabasePromise = waitFor(clientSocketA, "save-update")
            const userB_savedToSupabasePromise = waitFor(clientSocketB, "save-update")
            const userA_savedToSupabase = await userA_savedToSupabasePromise
            const userB_savedToSupabase = await userB_savedToSupabasePromise
            expect(userA_savedToSupabase).toMatchObject(saveToSupabaseResponse)
            expect(userB_savedToSupabase).toMatchObject(saveToSupabaseResponse)

        });

        test("Match is In The Saved State", async () => {
            const { current_state } = await Match.getState(testMatchId, testClient)
            expect(current_state).toBe("saved")
        })
    })
});
