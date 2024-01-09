import { RedisClientType, RedisDefaultModules, RedisFunctions, RedisScripts } from "redis";
import { RedisClientMultiCommandType } from "@redis/client/dist/lib/client/multi-command"
import Match from "./Match";
import { UserSession, MatchRole, MatchState } from "../types";

export default class Participant extends Match {
    readonly userId: string;
    readonly matchId: string;
    readonly sessionId: string;
    protected redisClient: RedisClientType;
    protected transaction: RedisClientMultiCommandType<RedisDefaultModules, RedisFunctions, RedisScripts>;

    constructor(sessionId: string, matchId: string, userId: string, redisClient: RedisClientType) {
        super();
        this.redisClient = redisClient;
        this.matchId = matchId;
        this.sessionId = sessionId;
        this.userId = userId;
        this.transaction = this.redisClient.multi()
    }

    // PARTICIPANT INITIALIZER
    static async initParticipant(userId: string, redisClient: RedisClientType) {
        const sessionExists = await Match.getSession(userId, redisClient);
        if (sessionExists) {
            const sessionId = Match.createUserSessionId(userId);
            const matchId = sessionExists.match_id;
            return new Participant(sessionId, matchId, userId, redisClient);
        } else {
            return null;
        }
    }

    // ======================= INSTANCE UTILITIES =======================

    public async exec() {
        const transactionResult = await this.transaction.exec()
        this.transaction = this.redisClient.multi() // immediately initialize another transaction block
        return transactionResult
    }

    protected async setState(nextState: MatchState) {
        await Match.setState(this.matchId, nextState, this.redisClient);
    }

    private async setupSubmissionMap() {
        const participants = await this.getParticipants<"archer">() as UserSession<"archer">[];
        const participantUserIds = participants.map((participant) => participant.user_id);
        const participantSessionIds = participants.map((participant) => Match.createUserSessionId(participant.user_id));

        // cyclic shift by 1 position
        const lastUserId = participantUserIds.pop() as string;
        participantUserIds.unshift(lastUserId);
        const submissionMap: { [userId: string]: string } = {};
        for (let idx = 0; idx < participantUserIds.length; idx++) {
            submissionMap[participantUserIds[idx]] = participantSessionIds[idx];
        }

        return submissionMap;
    }

    public async getRedisMatch() {
        return await Match.getRedisMatch(this.matchId, this.redisClient);
    }

    public async getSession() {
        return (await Match.getSession(this.userId, this.redisClient)) as UserSession<"archer">;
    }

    public async getNumParticipants(execute: boolean=true) {
        return await Match.getNumParticipants(this.matchId, this.redisClient);
    }

    public async getParticipants<R extends MatchRole>(execute: boolean=true, role?: R) {
        const participantSessionIds = await Match.getParticipantSessionIds(this.matchId, this.redisClient)

        if (execute) {
            const participants = await this.redisClient.json.MGET(participantSessionIds ?? ["return-null-key"], ".") as unknown as UserSession<R>[]
            if (role) {
                return participants.filter(participant => participant.role === role) as UserSession<R>[]
            } else {
                return participants
            }
        } else if (!execute) {
            this.transaction.json.MGET(participantSessionIds ?? ["return-null-key"], ".")
        }
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
            const participants = await this.getParticipants();
            const allParticipantsReady = participants?.every((participant) => participant.ready);
            const allUsersConnected = participants?.every(participant => participant.connected)

            if (allParticipantsReady && allUsersConnected) {
                await this.initializeMatch()
            }
        }
        // unwatch
        await this.redisClient.UNWATCH();
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
        await this.redisClient.MULTI().json.SET(this.sessionId, "$.connected", true).PERSIST(this.sessionId).EXEC();

        // check if everyone is connected
        await this.redisClient.WATCH(this.matchId);
        const participants = await this.getParticipants();
        const { current_state, previous_state } = await this.getState();
        const allParticipantsReady = participants?.every((participant) => participant.ready)
        const allParticipantsConnected = participants?.every((participant) => participant.connected)
        if (current_state === "paused" && allParticipantsConnected) {
            await this.setState(previous_state);
        } else if (current_state === "full" && allParticipantsReady && allParticipantsConnected) { // initialize if someone who was ready disconnected, and then reconnected
            await this.initializeMatch()
        }
        await this.redisClient.UNWATCH()
    }

    public async setDisconnect(expirySeconds: number) {
        // only trigger pause and start expiry if it is a running match or in the lobby
        const { current_state } = await this.getState();
        if (current_state === "save error") {
            await this.redisClient.json.SET(this.sessionId, "$.connected", false);
        } else if (current_state === "submit" || current_state === "confirmation" || current_state === "paused") {
            await this.redisClient.MULTI().json.SET(this.sessionId, "$.connected", false).expire(this.sessionId, expirySeconds).EXEC();
            await this.setState("paused");
        } else if (current_state === "open" || current_state === "full" || current_state === "stalled") {
            await this.redisClient.MULTI().json.SET(this.sessionId, "$.connected", false).expire(this.sessionId, expirySeconds).EXEC();
        }
    }


    public async initializeMatch () {
        const submissionMap = await this.setupSubmissionMap();
        await this.redisClient
            .MULTI()
            .json.SET(this.matchId, "$.started_at", new Date().toISOString())
            .json.SET(this.matchId, "$.submission_map", submissionMap)
            .json.SET(this.matchId, "$.current_state", "submit")
            .json.SET(this.matchId, "$.previous_state", "full")
            .json.NUMINCRBY(this.matchId, "$.current_end", 1)
            .EXEC();
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
}