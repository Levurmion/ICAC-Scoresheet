import { RedisClientType } from "redis";
import {
    Arrow,
    EndConfirmationResponses,
    EndRejectionResponses,
    EndResetResponse,
    EndResubmissionForm,
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
import { warn } from "console";
import { Json } from "../database.types";

export default class Match {
    readonly userId: string;
    readonly matchId: string;
    readonly sessionId: string;
    private redisClient: RedisClientType;

    constructor(sessionId: string, matchId: string, userId: string, redisClient: RedisClientType) {
        this.redisClient = redisClient;
        this.matchId = matchId;
        this.sessionId = sessionId;
        this.userId = userId;
    }

    // ======================= STATIC METHODS =======================

    // MATCH INITIALIZER
    static async initMatchForUser(userId: string, redisClient: RedisClientType) {
        const sessionExists = await Match.getSession(userId, redisClient);
        if (sessionExists) {
            const sessionId = Match.createUserSessionId(userId);
            const matchId = sessionExists.match_id;
            return new Match(sessionId, matchId, userId, redisClient);
        } else {
            return null;
        }
    }

    // SESSION CREATE, READ, DELETE OPERATIONS
    static async getSession(userId: string, redisClient: RedisClientType) {
        const sessionId = Match.createUserSessionId(userId);
        return (await redisClient.json.GET(sessionId)) as unknown as UserSession | null;
    }

    static async setSession(sessionPayload: UserSession, redisClient: RedisClientType) {
        try {
            const sessionId = Match.createUserSessionId(sessionPayload.user_id);
            const matchId = sessionPayload.match_id;

            const matchExists = await redisClient.json.GET(matchId);
            if (!matchExists) {
                throw new Error("Match does not exist");
            }

            const sessionExists = await redisClient.json.GET(sessionId);
            if (sessionExists) {
                throw new Error("Session already exists");
            }

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

        // do not allow deleting sessions when Match is finished/reported
        // important that session stays untouched because we are saving scores to database
        if (current_state === "finished" || current_state === "reported") {
            throw new Error(`Cannot delete session: Match is ${current_state}, saving scores to database.`);
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

        // if this was the last user or match is still in the lobby (full), always reset the match to "open"
        if (matchParticipants.length === 1 || current_state === "full") {
            if (current_state === "saved") {
                await Match.deleteRedisMatch(matchId, redisClient)
            } else {
                // reset end
                await redisClient.json.SET(matchId, "$.current_end", 0)
                await Match.setState(matchId, "open", redisClient);
            }
        } else if (current_state === "submit" || current_state === "confirmation") {
            await Match.setState(matchId, "paused", redisClient);
        }
    }

    // MATCH CREATE, READ, DELETE METHODS
    static async createRedisMatch(matchId: string, matchDetails: RedisMatch, redisClient: RedisClientType) {
        const {
            num_ends,
            arrows_per_end,
            current_end,
            max_participants,
            round
        } = matchDetails
        matchDetails.round = round?.length === 0 ? undefined : round
        matchDetails.num_ends = Number(num_ends)
        matchDetails.arrows_per_end = Number(arrows_per_end)
        matchDetails.current_end = Number(current_end)
        matchDetails.max_participants = Number(max_participants)
        await redisClient.HSET("match-participants", matchId, JSON.stringify([]));
        await redisClient.json.SET(matchId, "$", matchDetails as unknown as RedisJSON);
    }

    static async getRedisMatch(matchId: string, redisClient: RedisClientType) {
        return (await redisClient.json.GET(matchId)) as unknown as RedisMatch;
    }

    static async deleteRedisMatch(matchId: string, redisClient: RedisClientType) {
        const participants = JSON.parse((await redisClient.HGET("match-participants", matchId)) as string) as string[] | null;
        // if there are participants
        if (participants) {
            for (const sessionId of participants) {
                await redisClient.HDEL("active-sessions", sessionId);
                await redisClient.json.DEL(sessionId);
            }
        }
        await redisClient.HDEL("match-participants", matchId);
        await redisClient.json.DEL(matchId);
    }

    // GET SPECIFIC MATCH INFO
    static async getNumParticipants(matchId: string, redisClient: RedisClientType) {
        const participants = JSON.parse((await redisClient.HGET("match-participants", matchId)) as string) as string[];
        return participants.length;
    }

    static async getParticipants<R extends MatchRole>(matchId: string, redisClient: RedisClientType) {
        const participantSessions = JSON.parse((await redisClient.HGET("match-participants", matchId)) as string);
        if (participantSessions?.length === 0 || participantSessions === null) {
            return [];
        }
        return (await redisClient.json.MGET(participantSessions, ".")) as unknown as UserSession<R>[];
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
                } else if (current_state === "submit" || current_state === "confirmation") {
                    await Match.setState(matchId, "paused", redisClient);
                }

                // remove participant
                const matchParticipants = JSON.parse((await redisClient.HGET("match-participants", matchId)) as string) as string[];
                const newMatchParticipants = matchParticipants.filter((currSessionId) => currSessionId !== sessionId);
                await redisClient.HSET("match-participants", matchId, JSON.stringify(newMatchParticipants));

                // remove session from "active-sessions"
                await redisClient.HDEL("active-sessions", sessionId);

                // if match has been saved and this was the last user, delete from Redis
                if (matchParticipants.length === 1 && current_state === "saved") {
                    await Match.deleteRedisMatch(matchId, redisClient)
                // if this was the last user or match is still in the lobby (full), always reset the match to "open"
                } else if (matchParticipants.length === 1 || current_state === "full") {
                    await Match.setState(matchId, "open", redisClient);
                    await redisClient.json.SET(matchId, "$.current_end", 0)
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

    // ======================= INSTANCE METHODS =======================

    public async getRedisMatch() {
        return await Match.getRedisMatch(this.matchId, this.redisClient);
    }

    public async getSession() {
        return (await Match.getSession(this.userId, this.redisClient)) as UserSession;
    }

    public async getNumParticipants() {
        return await Match.getNumParticipants(this.matchId, this.redisClient);
    }

    public async getParticipants<R extends MatchRole>() {
        return await Match.getParticipants<R>(this.matchId, this.redisClient);
    }

    public async getParticipantSessionIds() {
        return JSON.parse((await this.redisClient.HGET("match-participants", this.matchId)) as string) as string[];
    }

    public async getState() {
        return await Match.getState(this.matchId, this.redisClient);
    }

    public async leaveMatch() {
        await Match.deleteSession(this.userId, this.redisClient);
        Object.assign(this, {
            userId: undefined,
            sessionId: undefined,
            matchId: undefined,
            redisClient: undefined,
        });
    }

    public async setReady() {
        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "open" && current_state !== "full") {
            throw new Error("Match is past the lobby (open/full states).");
        }
        // NEED TO PREVENT RACE CONDITION, perform this as a transaction that cancels
        // if any of the participant sessions were changed after setting user to ready: true.
        // TWO USERS can ready at the same time and and allParticipantsReady
        // could evaluate to TRUE in both instances if the second user manages to ready
        // right before the first evaluates allParticipantsReady => will call this.nextEnd() 2x
        await this.redisClient.WATCH(this.matchId);
        await this.redisClient.json.SET(this.sessionId, "$.ready", true);
        if (current_state === "full") {
            const participants = await this.getParticipants()
            const allParticipantsReady = participants.every((participant) => participant.ready);

            if (allParticipantsReady) {
                const submissionMap = await this.setupSubmissionMap()
                const startMatchTransaction = await this.redisClient.MULTI()
                .json.SET(this.matchId, "$.started_at", new Date().toISOString())
                .json.SET(this.matchId, "$.submission_map", submissionMap)
                .json.SET(this.matchId, "$.current_state", "submit")
                .json.SET(this.matchId, "$.previous_state", current_state)
                .json.NUMINCRBY(this.matchId, "$.current_end", 1).EXEC();
            }
        }
        // unwatch
        await this.redisClient.UNWATCH()
    }

    public async setUnready() {
        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "open" && current_state !== "full") {
            throw new Error("Match is past the lobby (open/full states).");
        }

        await this.redisClient.json.SET(this.sessionId, "$.ready", false);
    }

    public async setConnect() {
        await this.redisClient.json.SET(this.sessionId, "$.connected", true);

        // check if everyone is connected
        const participants = await this.getParticipants();
        const { current_state, previous_state } = await this.getState();
        if (current_state === "paused" && participants.every((participant) => participant.connected)) {
            await this.setState(previous_state);
        }
    }

    public async setDisconnect() {
        await this.redisClient.json.SET(this.sessionId, "$.connected", false);

        // only trigger pause if it is a running match
        const { current_state } = await this.getState();
        if (current_state === "submit" || current_state === "confirmation") {
            await this.setState("paused");
        }
    }

    // RUNNING MATCH
    public async getEndSubmissionForm() {
        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "submit") {
            throw new Error("Match is not in the submit state.");
        }

        const matchInfo = await this.getRedisMatch();
        const sessionIdToSubmitFor = matchInfo.submission_map?.[this.userId] as string;
        const { current_end, arrows_per_end } = matchInfo;

        const userToSubmitFor = (await this.redisClient.json.GET(sessionIdToSubmitFor)) as unknown as UserSession<"archer">;
        const { scores } = userToSubmitFor;

        // We calculate this to determine whether it's a form for:
        // - a new end
        // - to reconfirm an end
        const scoreEndStart = current_end * arrows_per_end - arrows_per_end;
        const scoreEndFinish = current_end * arrows_per_end;
        const currentEndScores = scores.slice(scoreEndStart, scoreEndFinish);

        const submissionForm: EndSubmissionForm = {
            for: {
                id: userToSubmitFor.user_id,
                first_name: userToSubmitFor.first_name,
                last_name: userToSubmitFor.last_name,
                university: userToSubmitFor.university,
            },
            current_end,
            arrows: currentEndScores.length === 0 ? new Array(arrows_per_end).fill(null) : currentEndScores,
        };

        return submissionForm;
    }

    public async submitEndArrows(scores: Score[]) {
        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "submit") {
            throw new Error("Match is not in the submit state.");
        }

        try {
            const endParams = (await this.redisClient.json.GET(this.matchId, {
                path: ['$.["arrows_per_end", "current_end"]'],
            })) as [number, number];
            const [arrowsPerEnd, currentEnd] = endParams;

            // verify input length
            if (scores.length < arrowsPerEnd) {
                throw new Error("Number arrows submitted less than arrows_per_end");
            } else if (scores.length > arrowsPerEnd) {
                throw new Error("Number arrows submitted greater than arrows_per_end.");
            }

            // verify score values
            if (
                !scores.every((score) => {
                    if (typeof score === "number") {
                        return 0 <= score && score <= 10;
                    } else if (typeof score === "string") {
                        return score === "X";
                    }
                })
            ) {
                throw new Error("Scores must be between 0-10 or an X");
            }

            // find session to submit for
            const submitForSessionId = (await this.redisClient.json.GET(this.matchId, {
                path: [`.submission_map.${this.userId}`],
            })) as string;

            // verify that user has not submitted for this end
            const numScoresSubmitted = await this.redisClient.json.ARRLEN(submitForSessionId, "$.scores") as number[]
            if (numScoresSubmitted[0] === currentEnd * arrowsPerEnd) {
                throw new Error("End already submitted")
            } else if (numScoresSubmitted[0] !== (currentEnd * arrowsPerEnd) - arrowsPerEnd) {
                throw new Error(`Corrupt record`)
            }

            const endArrows: Arrow[] = scores.map((score) => {
                return { score, submitted_by: this.userId };
            });
            endArrows.sort((a, b) => {
                if (a.score > b.score) {
                    return -1;
                } else {
                    return 1;
                }
            });

            // save arrow
            await this.redisClient.json.ARRAPPEND(submitForSessionId, "$.scores", ...endArrows);

            // check if all users have submitted
            const participants = await this.getParticipants();
            if (participants.every((participant) => participant.scores?.length === arrowsPerEnd * currentEnd)) {
                await this.setState("confirmation");
            }
        } catch (error: any) {
            throw new Error(`End submission rejected: ${error.message}.`);
        }
    }

    public async getScores() {
        return (await this.redisClient.json.GET(this.sessionId, {
            path: [".scores"],
        })) as Arrow[];
    }

    public async getEndTotals() {
        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "confirmation") {
            throw new Error("Match is not in the confirmation state.");
        }

        const [currentEnd, arrowsPerEnd] = (await this.redisClient.json.GET(this.matchId, {
            path: ['$.["current_end", "arrows_per_end"]'],
        })) as [number, number];
        const participants = await this.getParticipants<"archer">();
        const userEndTotals: UserEndTotal[] = participants.map((participant) => {
            const { user_id, first_name, last_name, university, scores } = participant;

            const end_arrows = Match.getEndArrows(scores, currentEnd, arrowsPerEnd);
            const end_total = Match.calculateArrowTotal(end_arrows);
            const running_total = Match.calculateArrowTotal(scores);

            return {
                id: user_id,
                first_name,
                last_name,
                university,
                end_arrows,
                end_total,
                running_total,
            };
        });
        return {
            current_end: currentEnd,
            arrows_shot: currentEnd * arrowsPerEnd,
            end_totals: userEndTotals,
        } as EndTotals;
    }

    public async confirmEnd(): Promise<EndConfirmationResponses | undefined> {
        const currentEnd = (await this.redisClient.json.GET(this.matchId, {
            path: [".current_end"],
        })) as number;

        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "confirmation") {
            throw new Error("Match is not in the confirmation state.");
        }

        // verify that user has not decided this end
        const numEndsConfirmed = Number(await this.redisClient.json.ARRLEN(this.sessionId, "$.ends_confirmed"))
        if (numEndsConfirmed === currentEnd) {
            throw new Error("End confirmation already decided.")
        }

        // append true to ends_confirmed array
        await this.redisClient.json.ARRAPPEND(this.sessionId, `$.ends_confirmed`, true);

        // get all participants, check if everyone has submitted
        const participants = await this.getParticipants<"archer">();

        // boolean switches
        const allUsersSubmitted = participants.every((participant) => {
            return participant.ends_confirmed[currentEnd - 1] !== undefined;
        });
        const someUsersReject = participants.some((participant) => {
            return participant.ends_confirmed[currentEnd - 1] === false;
        });
        const allUsersConfirmed = participants.every((participant) => {
            return participant.ends_confirmed[currentEnd - 1] === true;
        });

        // all users submitted response, all of them accepts
        if (allUsersConfirmed) {
            const numEnds = (await this.redisClient.json.GET(this.matchId, {
                path: [".num_ends"],
            })) as number;

            // final end
            if (Number(currentEnd) === Number(numEnds)) {
                await this.setState("finished");
            }
            // not final end, proceed to next end
            else {
                await this.nextEnd();
                await this.setState("submit");
            }

            return "proceed";
        }
        // all users submitted response, one of them rejects
        if (allUsersSubmitted && someUsersReject) {
            await this.setState("submit");
            await this.resetEnd();
            return "reject";
        }
        // not all users have submitted their confirmation response for this end
        else {
            return "waiting";
        }
    }

    public async rejectEnd(): Promise<EndRejectionResponses | undefined> {
        const currentEnd = (await this.redisClient.json.GET(this.matchId, {
            path: [".current_end"],
        })) as number;

        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "confirmation") {
            throw new Error("Match is not in the confirmation state.");
        }

        // verify that user has not decided this end
        const numEndsConfirmed = Number(await this.redisClient.json.ARRLEN(this.sessionId, "$.ends_confirmed"))
        if (numEndsConfirmed === currentEnd) {
            throw new Error("End confirmation already decided.")
        }

        // append false to ends_confirmed array
        await this.redisClient.json.ARRAPPEND(this.sessionId, `$.ends_confirmed`, false);

        // get all participants, check if everyone has submitted
        const participants = await this.getParticipants<"archer">();

        // boolean switches
        const allUsersSubmitted = participants.every((participant) => {
            return participant.ends_confirmed[currentEnd - 1] !== undefined;
        });
        const someUsersReject = participants.some((participant) => {
            return participant.ends_confirmed[currentEnd - 1] === false;
        });

        // all users submitted response, one of them rejects
        if (allUsersSubmitted && someUsersReject) {
            await this.setState("submit");
            await this.resetEnd();
            return "reject";
        }

        // not all users have submitted their confirmation response for this end
        else {
            return "waiting";
        }
    }

    // FINISHED MATCH
    public async getMatchReport() {
        const { current_state } = await this.getState();

        if (current_state === "finished") {
            const matchReport = await Match.getMatchReport(this.matchId, this.redisClient);
            await this.setState("reported");
            return matchReport;
        } else if (current_state === "reported") {
            return false;
        }
    }

    // SOCKET.IO UTILITIES
    public async getSocketIORedisMatchState() {
        return await Match.getSocketIORedisMatchState(this.matchId, this.redisClient);
    }

    // PRIVATE UTILITIES
    private async setState(nextState: MatchState) {
        await Match.setState(this.matchId, nextState, this.redisClient);
    }

    private async setupSubmissionMap() {
        const participants = await this.getParticipants();
        const participantUserIds = participants.map((participant) => participant.user_id);
        const participantSessionIds = participants.map((participant) => Match.createUserSessionId(participant.user_id));

        // cyclic shift by 1 position
        const lastUserId = participantUserIds.pop() as string;
        participantUserIds.unshift(lastUserId);
        const submissionMap: { [userId: string]: string } = {};
        for (let idx = 0; idx < participantUserIds.length; idx++) {
            submissionMap[participantUserIds[idx]] = participantSessionIds[idx];
        }

        return submissionMap

        // set the submission map
        // await this.redisClient.json.SET(this.matchId, "$.submission_map", submissionMap);
    }

    private async nextEnd() {
        await this.redisClient.json.NUMINCRBY(this.matchId, "$.current_end", 1);
    }

    private async resetEnd() {
        const [currentEnd, arrowsPerEnd] = (await this.redisClient.json.GET(this.matchId, {
            path: ['$.["current_end", "arrows_per_end"]'],
        })) as [number, number];
        const participants = await this.getParticipants<"archer">();
        const submissionMap = (await this.redisClient.json.GET(this.matchId, {
            path: [".submission_map"],
        })) as { [submitterId: string]: string };

        for (const [_, sessionId] of Object.entries(submissionMap)) {
            const numSubmittedArrows = Number(await this.redisClient.json.ARRLEN(sessionId, ".scores")) as number

            // reset arrows
            if (numSubmittedArrows === Number(arrowsPerEnd)) { // first end
                await this.redisClient.json.SET(sessionId, "$.scores", []);
            } else if (numSubmittedArrows > Number(arrowsPerEnd)) {
                await this.redisClient.json.ARRTRIM(sessionId, "$.scores", 0, ((currentEnd * arrowsPerEnd) - arrowsPerEnd) - 1)
            }
            // reset confirmation
            await this.redisClient.json.ARRPOP(sessionId, "$.ends_confirmed");
        }
    }
}
