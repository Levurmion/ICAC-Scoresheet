import { RedisClientType } from "redis";
import { MatchState, RedisMatch, UserSession } from "../types";
import redisClient from "../redis/redisClient";
import { RedisJSON } from "@redis/json/dist/commands";
import { warn } from "console";

export default class Match {
    readonly userId: string;
    readonly matchId: string;
    readonly sessionId: string;
    private redisClient: RedisClientType;

    constructor (sessionId: string, matchId: string, userId: string, redisClient: RedisClientType) {
        this.redisClient = redisClient;
        this.matchId = matchId;
        this.sessionId = sessionId;
        this.userId = userId
    }

    // ======================= STATIC METHODS =======================

    // MATCH INITIALIZER
    static async initMatchForUser (userId: string, redisClient: RedisClientType) {
        const sessionExists = await Match.getSession(userId, redisClient)
        if (sessionExists) {
            const sessionId = Match.createUserSessionId(userId)
            const matchId = sessionExists.match_id
            return new Match(sessionId, matchId, userId, redisClient)
        } else {
            return null
        }
    }

    // SESSION CREATE, READ, DELETE OPERATIONS
    static async getSession(userId: string, redisClient: RedisClientType) {
        const sessionId = Match.createUserSessionId(userId)
        return await redisClient.json.GET(sessionId) as unknown as UserSession | null
    }

    static async setSession (sessionPayload: UserSession, redisClient: RedisClientType) {
        try {
            const sessionId = Match.createUserSessionId(sessionPayload.user_id)
            const matchId = sessionPayload.match_id

            const matchExists = await redisClient.json.GET(matchId)
            if (!matchExists) {
                throw new Error('Match does not exist')
            }

            const sessionExists = await redisClient.json.GET(sessionId)
            if (sessionExists) {
                throw new Error('Session already exists')
            }

            const maxParticipants = await redisClient.json.GET(matchId, {
                path: ['.max_participants']
            }) as number
            const participants = JSON.parse(await redisClient.HGET("match-participants", matchId) as string) as string[]

            if (participants.length >= maxParticipants) {
                throw new Error('Match is full')
            }

            // save new session in  "match-participants"
            if (participants) {
                const newParticipants = [...participants, sessionId]
                const newParticipantsUnique = Array.from(new Set(newParticipants)) // make sure you can't double-register
                await redisClient.HSET("match-participants", matchId, JSON.stringify(newParticipantsUnique))
            } else {
                await redisClient.HSET("match-participants", matchId, JSON.stringify([sessionId]))
            }

            // save the matchId a session is associated with in "active-sessions"
            await redisClient.HSET("active-sessions", sessionId, matchId)
            await redisClient.json.SET(sessionId, "$", sessionPayload as unknown as RedisJSON)

            // update state to "full" if num participants === max_participants - 1
            if (participants.length === maxParticipants - 1) {
                await Match.setState(matchId, "full", redisClient)
            }

            return sessionId
        } catch (error: any) {
            throw new Error(`Cannot set a new session: ${error.message}.`)
        }
    }

    static async deleteSession (userId: string, redisClient: RedisClientType) {
        const sessionId = Match.createUserSessionId(userId)
        const matchId = await redisClient.HGET("active-sessions", sessionId) as string

        // remove participant
        const matchParticipants = JSON.parse(await redisClient.HGET("match-participants", matchId) as string) as string[]
        const newMatchParticipants = matchParticipants.filter(currSessionId => currSessionId !== sessionId)

        await redisClient.multi()
        .HSET("match-participants", matchId, JSON.stringify(newMatchParticipants))
        // remove session from "active-sessions"
        .HDEL("active-sessions", sessionId)
        // delete session
        .json.DEL(sessionId).exec()

        // removing participants can only ever lead to an open match
        await Match.setState(matchId, "open", redisClient)
    }

    // MATCH CREATE, READ, DELETE METHODS
    static async createRedisMatch (matchId: string, matchDetails: RedisMatch, redisClient: RedisClientType) {
        await redisClient.HSET("match-participants", matchId, JSON.stringify([]))
        await redisClient.json.SET(matchId, "$", matchDetails as unknown as RedisJSON)
    }

    static async getRedisMatch (matchId: string, redisClient: RedisClientType) {
        return await redisClient.json.GET(matchId) as unknown as RedisMatch
    }

    static async deleteRedisMatch (matchId: string, redisClient: RedisClientType) {
        const participants = JSON.parse(await redisClient.HGET("match-participants", matchId) as string) as string[] | null
        // if there are participants
        if (participants) {
            for (const sessionId of participants) {
                await redisClient.HDEL("active-sessions", sessionId)
                await redisClient.json.DEL(sessionId)
            }
        }
        await redisClient.HDEL("match-participants", matchId)
        await redisClient.json.DEL(matchId)
    }

    // GET SPECIFIC MATCH INFO
    static async getNumParticipants (matchId: string, redisClient: RedisClientType) {
        const participants = JSON.parse(await redisClient.HGET("match-participants", matchId) as string) as string[]
        return participants.length
    }

    static async getParticipants (matchId: string, redisClient: RedisClientType) {
        const participantSessions = JSON.parse(await redisClient.HGET("match-participants", matchId) as string) as string[]
        return await redisClient.json.MGET(participantSessions, ".") as unknown as UserSession[]
    }

    static async getState (matchId: string, redisClient: RedisClientType) {
        const state = await redisClient.json.GET(matchId, {
            path: [ '$.["current_state", "previous_state"]' ]
        }) as MatchState[]
        return {
            current_state: state[0],
            previous_state: state[1]
        }
    }

    // REDIS SYNCHRONIZATION METHODS
    static async syncExpiredSession (sessionId: string, redisClient: RedisClientType) {
        const userSession = await redisClient.json.GET(sessionId)
        try {
            if (userSession) {
                throw new Error('Session still exists')
            } else {
                const matchId = await redisClient.HGET("active-sessions", sessionId) as string

                // remove participant
                const matchParticipants = JSON.parse(await redisClient.HGET("match-participants", matchId) as string) as string[]
                const newMatchParticipants = matchParticipants.filter(currSessionId => currSessionId !== sessionId)
                await redisClient.HSET("match-participants", matchId, JSON.stringify(newMatchParticipants))

                // remove session from "active-sessions"
                await redisClient.HDEL("active-sessions", sessionId)
            }
        } catch (error: any) {
            throw new Error(`Cannot sync expired session: ${error.message}.`)
        }
    }

    // PRIVATE UTILITIES
    private static async setState (matchId: string, nextState: MatchState, redisClient: RedisClientType) {
        const currentState = await redisClient.json.GET(matchId, {
            path: [ ".current_state" ]
        })
        // set the new state atomically
        if (nextState !== currentState) {
            await redisClient.multi()
            .json.SET(matchId, "$.current_state", nextState)
            .json.SET(matchId, "$.previous_state", currentState)
            .exec()
        }
    }

    private static createUserSessionId(userId: string) {
        return `match-session:${userId}`
    }

    // ======================= INSTANCE METHODS =======================
    public async getRedisMatch () {
        return await Match.getRedisMatch(this.matchId, this.redisClient)
    }

    public async getSession () {
        return await Match.getSession(this.userId, this.redisClient)
    }

    public async getNumParticipants () {
        return await Match.getNumParticipants(this.matchId, this.redisClient)
    }

    public async getParticipants () {
        return await Match.getParticipants(this.matchId, this.redisClient)
    }

    public async getState () {
        return await Match.getState(this.matchId, this.redisClient)
    }

    public async leaveMatch () {
        await Match.deleteSession(this.userId, this.redisClient)
        Object.assign(this, {
            userId: undefined,
            sessionId: undefined,
            matchId: undefined,
            redisClient: undefined
        })
    }

    public async setReady () {
        await this.redisClient.json.SET(this.sessionId, "$.ready", true)
        const matchState = await this.getState()
        if (matchState.current_state === "full") {
            const participants = await this.getParticipants()
            if (participants.every(participant => participant.ready)) {
                await this.setState("submit")
            }
        }
    }

    public async setUnready () {
        await this.redisClient.json.SET(this.sessionId, "$.ready", false)
    }

    // PRIVATE UTILITIES
    private async setState (nextState: MatchState) {
        await Match.setState(this.matchId, nextState, this.redisClient)
    }

}