import { RedisClientType } from "redis";
import {
    Arrow,
    EndConfirmationResponses,
    EndRejectionResponses,
    EndSubmissionForm,
    EndTotals,
    LobbyUserDetails,
    MatchReport,
    MatchRole,
    MatchState,
    RedisMatch,
    Score,
    SocketIORedisMatchState,
    UserEndTotal,
    UserSession,
} from "../types";
import { RedisJSON } from "@redis/json/dist/commands";
import { Json } from "../database.types";

export default class Match {
    // ======================= CLASS ONLY CONTAINS STATIC METHODS =======================

    // SESSION CREATE, READ, DELETE OPERATIONS
    static async getSession(userId: string, redisClient: RedisClientType) {
        const sessionId = Match.createUserSessionId(userId);
        return (await redisClient.json.GET(sessionId)) as unknown as UserSession | null;
    }

    static async setSession(sessionPayload: UserSession, redisClient: RedisClientType) {
        try {
            const sessionId = Match.createUserSessionId(sessionPayload.user_id);
            const matchId = sessionPayload.match_id;

            // check if match exists
            const matchExists = await redisClient.json.GET(matchId);
            if (!matchExists) {
                throw new Error("Match does not exist");
            }

            // check if session exists
            const sessionExists = await redisClient.json.GET(sessionId);
            if (sessionExists) {
                throw new Error("Session already exists");
            }

            // check if match is at capacity
            const maxParticipants = (await redisClient.json.GET(matchId, {
                path: [".max_participants"],
            })) as number;
            const participants = JSON.parse((await redisClient.HGET("match-participants", matchId)) as string) as string[];

            if (participants.length >= maxParticipants) {
                throw new Error("Match is full");
            }

            // save new session in  "match-participants"
            if (participants) {
                const newParticipants = [...participants, sessionId];
                const newParticipantsUnique = Array.from(new Set(newParticipants)); // make sure you can't double-register
                await redisClient.HSET("match-participants", matchId, JSON.stringify(newParticipantsUnique));
            } else {
                await redisClient.HSET("match-participants", matchId, JSON.stringify([sessionId]));
            }

            // save the matchId a session is associated with in "active-sessions"
            await redisClient.HSET("active-sessions", sessionId, matchId);
            await redisClient.json.SET(sessionId, "$", sessionPayload as unknown as RedisJSON);

            // update state to "full" if num participants === max_participants - 1
            if (participants.length === maxParticipants - 1) {
                await Match.setState(matchId, "full", redisClient);
            }

            return sessionId;
        } catch (error: any) {
            throw new Error(`Cannot set a new session: ${error.message}.`);
        }
    }

    static async deleteSession(userId: string, redisClient: RedisClientType) {
        const sessionId = Match.createUserSessionId(userId);
        const matchId = (await redisClient.HGET("active-sessions", sessionId)) as string;
        const { current_state } = await Match.getState(matchId, redisClient);

        // do not allow deleting sessions when Match is finished/reported/save error
        // important that session stays untouched because we are saving scores to database
        if (current_state === "finished" || current_state === "reported") {
            throw new Error(`Cannot delete session: Match is currently saving scores to database.`);
        } else if (current_state === "save error") {
            throw new Error(`Saving scores to database error! Notify match host for futher instructions!`);
        }

        // remove participant
        const matchParticipants = JSON.parse((await redisClient.HGET("match-participants", matchId)) as string) as string[];
        const newMatchParticipants = matchParticipants.filter((currSessionId) => currSessionId !== sessionId);

        await redisClient
            .multi()
            .HSET("match-participants", matchId, JSON.stringify(newMatchParticipants))
            // remove session from "active-sessions"
            .HDEL("active-sessions", sessionId)
            // delete session
            .json.DEL(sessionId)
            .exec();

        // if this was the last user and match has been saved, delete match
        if (newMatchParticipants.length === 0 && current_state === "saved") {
            await Match.deleteRedisMatch(matchId, redisClient);
            // if match is paused, and someone leaves, stall
        } else if (current_state === "paused") {
            await Match.setState(matchId, "stalled", redisClient);
            // if this is still the lobby, always reset to open
        } else if (current_state === "open" || current_state === "full") {
            await Match.setState(matchId, "open", redisClient);
        }
    }

    // MATCH CREATE, READ, DELETE METHODS
    static async createRedisMatch(matchId: string, matchDetails: RedisMatch, redisClient: RedisClientType) {
        const { num_ends, arrows_per_end, current_end, max_participants, round } = matchDetails;
        matchDetails.round = round?.length === 0 ? undefined : round;
        matchDetails.num_ends = Number(num_ends);
        matchDetails.arrows_per_end = Number(arrows_per_end);
        matchDetails.current_end = Number(current_end);
        matchDetails.max_participants = Number(max_participants);
        await redisClient.HSET("match-participants", matchId, JSON.stringify([]));
        await redisClient.json.SET(matchId, "$", matchDetails as unknown as RedisJSON);
    }

    static async getRedisMatch(matchId: string, redisClient: RedisClientType) {
        return (await redisClient.json.GET(matchId)) as unknown as RedisMatch;
    }

    static async deleteRedisMatch(matchId: string, redisClient: RedisClientType) {
        const participants = JSON.parse((await redisClient.HGET("match-participants", matchId)) as string) as string[] | null;

        // intialize transaction
        const transaction = redisClient.multi();

        // queue operations
        // if there are participants
        if (participants) {
            for (const sessionId of participants) {
                transaction.HDEL("active-sessions", sessionId);
                transaction.json.DEL(sessionId);
            }
        }
        transaction.HDEL("match-participants", matchId);
        transaction.json.DEL(matchId);

        // execute
        await transaction.exec();
    }

    // GET SPECIFIC MATCH INFO
    static async getNumParticipants(matchId: string, redisClient: RedisClientType) {
        const participants = await Match.getParticipantSessionIds(matchId, redisClient);
        return participants?.length ?? 0;
    }

    static async getParticipantSessionIds(matchId: string, redisClient: RedisClientType) {
        return JSON.parse((await redisClient.HGET("match-participants", matchId)) as string) as string[] | null
    }

    static async getParticipants<R extends MatchRole>(matchId: string, redisClient: RedisClientType) {
        const participantSessionIds = await Match.getParticipantSessionIds(matchId, redisClient);
        if (participantSessionIds?.length === 0 || participantSessionIds === null) {
            return [];
        }
        return (await redisClient.json.MGET(participantSessionIds, ".")) as unknown as UserSession<R>[];
    }

    static async getLobbyUserDetails(matchId: string, redisClient: RedisClientType): Promise<LobbyUserDetails[] | undefined> {
        const participants = await Match.getParticipants(matchId, redisClient);
        return participants.map((participant) => {
            const { match_id, scores, ends_confirmed, ...lobbyUserDetails } = participant;
            return lobbyUserDetails;
        });
    }

    static async getState(matchId: string, redisClient: RedisClientType) {
        const state = (await redisClient.json.GET(matchId, {
            path: ['$.["current_state", "previous_state"]'],
        })) as MatchState[];
        return {
            current_state: state[0],
            previous_state: state[1],
        };
    }

    // SOCKET.IO UTILITIES
    static async getSocketIORedisMatchState(matchId: string, redisClient: RedisClientType) {
        const redisMatch = await Match.getRedisMatch(matchId, redisClient);
        const participants = await this.getParticipants(matchId, redisClient);
        const currentMatchState: SocketIORedisMatchState = {
            ...redisMatch,
            participants,
        };
        return currentMatchState;
    }

    // FINISHED MATCHES
    static async getMatchReport(matchId: string, redisClient: RedisClientType) {
        const { current_state } = await Match.getState(matchId, redisClient);
        if (current_state !== "finished" && current_state !== "reported") {
            throw new Error("Cannot produce report for an unfinished match.");
        }

        const match = await Match.getRedisMatch(matchId, redisClient);
        const participants = (await Match.getParticipants(matchId, redisClient)).filter((participant) => participant.role === "archer");

        // match fields
        const { name, host, started_at, competition } = match;

        // scoresheet fields
        const { round, bow, arrows_per_end, num_ends } = match;

        const matchReport: MatchReport = {
            name,
            host,
            started_at: started_at as string,
            finished_at: new Date().toISOString(),
            competition,
            scoresheets: participants.map((participant) => {
                const { user_id, scores } = participant as UserSession<"archer">;

                const userBow = (() => {
                    switch (typeof bow) {
                        case "string":
                            return bow;
                        case "object":
                            return bow[user_id];
                        case "undefined":
                            return undefined;
                    }
                })();

                return {
                    user_id,
                    round,
                    bow: userBow,
                    arrows_per_end,
                    arrows_shot: scores.length,
                    created_at: new Date().toISOString(),
                    scoresheet: JSON.stringify(scores) as Json,
                };
            }),
        };

        return matchReport;
    }

    // REDIS SYNCHRONIZATION METHODS
    static async syncExpiredSession(sessionId: string, redisClient: RedisClientType) {
        const userSession = await redisClient.json.GET(sessionId);
        try {
            if (userSession) {
                throw new Error("Session still exists");
            } else {
                const matchId = (await redisClient.HGET("active-sessions", sessionId)) as string;
                // set to open or paused
                const { current_state } = await Match.getState(matchId, redisClient);
                if (current_state === "full") {
                    await Match.setState(matchId, "open", redisClient);
                } else if (current_state === "paused") {
                    await Match.setState(matchId, "stalled", redisClient);
                }

                // remove participant
                const matchParticipants = JSON.parse((await redisClient.HGET("match-participants", matchId)) as string) as string[];
                const newMatchParticipants = matchParticipants.filter((currSessionId) => currSessionId !== sessionId);
                await redisClient.HSET("match-participants", matchId, JSON.stringify(newMatchParticipants));

                // remove session from "active-sessions"
                await redisClient.HDEL("active-sessions", sessionId);

                // if match has been saved and this was the last user, delete from Redis
                if (matchParticipants.length === 1 && current_state === "saved") {
                    await Match.deleteRedisMatch(matchId, redisClient);
                }
            }
        } catch (error: any) {
            throw new Error(`Cannot sync expired session: ${error.message}.`);
        }
    }

    // UTILITIES
    static async setState(matchId: string, nextState: MatchState, redisClient: RedisClientType) {
        const currentState = await redisClient.json.GET(matchId, {
            path: [".current_state"],
        });
        // set the new state atomically
        if (nextState !== currentState) {
            await redisClient.multi().json.SET(matchId, "$.current_state", nextState).json.SET(matchId, "$.previous_state", currentState).exec();
        }
    }

    static createUserSessionId(userId: string) {
        return `match-session:${userId}`;
    }

    static calculateArrowTotal(arrows: Arrow[]) {
        return arrows.reduce((prevTotal: number, currentArrow) => {
            const currentArrowScore = typeof currentArrow.score === "number" ? currentArrow.score : 10;
            return prevTotal + currentArrowScore;
        }, 0);
    }

    static getEndArrows(arrows: Arrow[], currentEnd: number, arrowsPerEnd: number) {
        const endArrowStart = currentEnd * arrowsPerEnd - arrowsPerEnd;
        const endArrowFinish = currentEnd * arrowsPerEnd;
        return arrows.slice(endArrowStart, endArrowFinish);
    }
    
}