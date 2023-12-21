import { RedisClientType } from "redis";
import { Arrow, EndConfirmationResponses, EndRejectionResponses, EndResetResponse, EndResubmissionForm, EndSubmissionForm, EndTotals, MatchReport, MatchRole, MatchState, RedisMatch, Score, UserEndTotal, UserSession } from "../types";
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

    static async getParticipants<R extends MatchRole>(matchId: string, redisClient: RedisClientType) {
        const participantSessions = JSON.parse(await redisClient.HGET("match-participants", matchId) as string) as string[]
        if (participantSessions.length === 0) {
            return []
        }
        return await redisClient.json.MGET(participantSessions, ".") as unknown as UserSession<R>[]
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

    // FINISHED MATCHES
    static async getMatchReport (matchId: string, redisClient: RedisClientType) {

        const { current_state } = await Match.getState(matchId, redisClient)
        if (current_state !== "finished" && current_state !== "reported") {
            throw new Error("Cannot produce report for an unfinished match.")
        }

        const match = await Match.getRedisMatch(matchId, redisClient)
        const participants = (await Match.getParticipants(matchId, redisClient))
        .filter(participant => participant.role === "archer")

        // match fields
        const {
            name,
            host,
            started_at,
            competition
        } = match

        // scoresheet fields
        const {
            round,
            bow,
            arrows_per_end,
            num_ends,
        } = match

        const matchReport: MatchReport = {
            name,
            host,
            started_at: started_at as string,
            finished_at: new Date().toISOString(),
            competition,
            scoresheets: participants.map(participant => {
                
                const {
                    user_id,
                    scores
                } = participant as UserSession<"archer">

                const userBow = (() => {
                    switch (typeof bow) {
                        case "string":
                            return bow
                        case "object":
                            return bow[user_id]
                        case "undefined":
                            return undefined
                    }
                })()

                return {
                    user_id,
                    round,
                    bow: userBow,
                    arrows_per_end,
                    num_ends,
                    arrows_shot: scores.length,
                    created_at: new Date().toISOString(),
                    scoresheet: scores
                }
            })
        }

        return matchReport
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

    // UTILITIES
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

    static createUserSessionId (userId: string) {
        return `match-session:${userId}`
    }

    static calculateArrowTotal (arrows: Arrow[]) {
        return arrows.reduce((prevTotal: number, currentArrow) => {
            const currentArrowScore = typeof currentArrow.score === "number" ? currentArrow.score : 10
            return prevTotal + currentArrowScore
        }, 0)
    }

    static getEndArrows (arrows: Arrow[], currentEnd: number, arrowsPerEnd: number) {
        const endArrowStart = (currentEnd * arrowsPerEnd) - arrowsPerEnd
        const endArrowFinish = currentEnd * arrowsPerEnd
        return arrows.slice(endArrowStart, endArrowFinish)
    }

    // ======================= INSTANCE METHODS =======================
    public async getRedisMatch () {
        return await Match.getRedisMatch(this.matchId, this.redisClient)
    }

    public async getSession () {
        return await Match.getSession(this.userId, this.redisClient) as UserSession
    }

    public async getNumParticipants () {
        return await Match.getNumParticipants(this.matchId, this.redisClient)
    }

    public async getParticipants<R extends MatchRole>() {
        return await Match.getParticipants<R>(this.matchId, this.redisClient)
    }

    public async getParticipantSessionIds () {
        return JSON.parse(await this.redisClient.HGET("match-participants", this.matchId) as string) as string[]
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
        // verify state
        const { current_state } = await this.getState()
        if (current_state !== "open" && current_state !== "full") {
            throw new Error("Match is past the lobby (open/full states).")
        }

        await this.redisClient.json.SET(this.sessionId, "$.ready", true)
        const matchState = await this.getState()
        if (matchState.current_state === "full") {
            const participants = await this.getParticipants()
            if (participants.every(participant => participant.ready)) {
                await this.redisClient.json.SET(this.matchId, "$.started_at", new Date().toISOString())
                await this.setState("submit")
                await this.setupSubmissionMap()
                await this.nextEnd()
            }
        }
    }

    public async setUnready () {
        // verify state
        const { current_state } = await this.getState()
        if (current_state !== "open" && current_state !== "full") {
            throw new Error("Match is past the lobby (open/full states).")
        }

        await this.redisClient.json.SET(this.sessionId, "$.ready", false)
    }

    public async setConnect () {
        await this.redisClient.json.SET(this.sessionId, "$.connected", true)

        // check if everyone is connected
        const participants = await this.getParticipants()
        if (participants.every(participant => participant.connected)) {
            const { previous_state } = await this.getState()
            await this.setState(previous_state)
        }
    }

    public async setDisconnect () {
        await this.redisClient.json.SET(this.sessionId, "$.connected", false)

        // only trigger pause if it is a running match
        const { current_state } = await this.getState()
        if (current_state === "submit" || current_state === "confirmation") {
            await this.setState("paused")
        }
    }

    // RUNNING MATCH
    public async getEndSubmissionForm () {
        // verify state
        const { current_state } = await this.getState()
        if (current_state !== "submit") {
            throw new Error("Match is not in the submit state.")
        }

        const matchInfo = await this.getRedisMatch()
        const sessionIdToSubmitFor = matchInfo.submission_map?.[this.userId] as string
        const { current_end, arrows_per_end } = matchInfo

        const userToSubmitFor = await this.redisClient.json.GET(sessionIdToSubmitFor) as unknown as UserSession<"archer">
        const { scores } = userToSubmitFor

        // We calculate this to determine whether it's a form for:
        // - a new end
        // - to reconfirm an end
        const scoreEndStart = (current_end * arrows_per_end) - arrows_per_end
        const scoreEndFinish = current_end * arrows_per_end
        const currentEndScores = scores.slice(scoreEndStart, scoreEndFinish)

        const submissionForm: EndSubmissionForm = {
            for: {
                id: userToSubmitFor.user_id,
                first_name: userToSubmitFor.first_name,
                last_name: userToSubmitFor.last_name,
                university: userToSubmitFor.university
            },
            current_end,
            arrows: currentEndScores.length === 0 ? new Array(arrows_per_end).fill(null) : currentEndScores
        }

        return submissionForm
    }

    public async submitEndArrows (scores: Score[]) {
        // verify state
        const { current_state } = await this.getState()
        if (current_state !== "submit") {
            throw new Error("Match is not in the submit state.")
        }

        try {
            const endParams = await this.redisClient.json.GET(this.matchId, {
                path: ['$.["arrows_per_end", "current_end"]']
            }) as [number, number]
            const [ arrowsPerEnd, currentEnd ] = endParams

            // verify input length
            if (scores.length < arrowsPerEnd) {
                throw new Error("Number arrows submitted less than arrows_per_end")
            } else if (scores.length > arrowsPerEnd) {
                throw new Error("Number arrows submitted greater than arrows_per_end.")
            }

            // verify score values
            if (!scores.every(score => {
                if (typeof score === "number") {
                    return 0 <= score && score <= 10
                } else if (typeof score === "string") {
                    return score === "X"
                }
            })) {
                throw new Error("Scores must be between 0-10 or an X")
            }
    
            const endArrows: Arrow[] = scores.map(score => {
                return { score, submitted_by: this.userId }
            })
            endArrows.sort((a, b) => {
                if (a.score > b.score) {
                    return -1
                } else {
                    return 1
                }
            })
    
            // find session to submit for
            const submitForSessionId = await this.redisClient.json.GET(this.matchId, {
                path: [`.submission_map.${this.userId}`]
            }) as string
    
            // save arrow
            await this.redisClient.json.ARRAPPEND(submitForSessionId, "$.scores", ...endArrows)

            // check if all users have submitted
            const participants = await this.getParticipants()
            if (participants.every(participant => participant.scores?.length === arrowsPerEnd * currentEnd)) {
                await this.setState("confirmation")
            }
        } catch (error: any) {
            throw new Error(`End submission rejected: ${error.message}.`)
        }
    }

    public async getScores () {
        return await this.redisClient.json.GET(this.sessionId, {
            path: [".scores"]
        }) as Arrow[]
    }

    public async getEndTotals () {
        // verify state
        const { current_state } = await this.getState()
        if (current_state !== "confirmation") {
            throw new Error("Match is not in the confirmation state.")
        }

        const [ currentEnd, arrowsPerEnd ] = await this.redisClient.json.GET(this.matchId, {
            path: ['$.["current_end", "arrows_per_end"]']
        }) as [number, number]
        const participants = await this.getParticipants<"archer">()
        const userEndTotals: UserEndTotal[] = participants.map(participant => {
            const { user_id, first_name, last_name, university, scores } = participant

            const end_arrows = Match.getEndArrows(scores, currentEnd, arrowsPerEnd)
            const end_total = Match.calculateArrowTotal(end_arrows)
            const running_total = Match.calculateArrowTotal(scores)

            return {
                id: user_id,
                first_name,
                last_name,
                university,
                end_arrows,
                end_total,
                running_total
            }
        })
        return {
            current_end: currentEnd,
            arrows_shot: currentEnd * arrowsPerEnd,
            end_totals: userEndTotals
        } as EndTotals
    }

    public async confirmEnd (): Promise<EndConfirmationResponses | undefined> {
        // verify state
        const { current_state } = await this.getState()
        if (current_state !== "confirmation") {
            throw new Error("Match is not in the confirmation state.")
        }

        // append true to ends_confirmed array
        await this.redisClient.json.ARRAPPEND(this.sessionId, `$.ends_confirmed`, true)

        // get all participants, check if everyone has submitted
        const currentEnd = await this.redisClient.json.GET(this.matchId, {
            path: [".current_end"]
        }) as number
        const participants = await this.getParticipants<"archer">()

        // boolean switches
        const allUsersSubmitted = participants.every(participant => {
            return participant.ends_confirmed[currentEnd - 1] !== undefined
        })
        const someUsersReject = participants.some(participant => {
            return participant.ends_confirmed[currentEnd - 1] === false 
        })
        const allUsersConfirmed = participants.every(participant => {
            return participant.ends_confirmed[currentEnd - 1] === true
        })

        // all users submitted response, all of them accepts
        if (allUsersConfirmed) {
            const numEnds = await this.redisClient.json.GET(this.matchId, {
                path: [".num_ends"]
            }) as number

            // final end
            if (currentEnd === numEnds) {
                await this.setState("finished")
            } 
            // not final end, proceed to next end
            else {
                await this.redisClient.json.NUMINCRBY(this.matchId, "$.current_end", 1)
                await this.setState("submit")
            }

            return "proceed"
        }
        // all users submitted response, one of them rejects
        if (allUsersSubmitted && someUsersReject) {
            return await this.resetEnd()
        }
        // not all users have submitted their confirmation response for this end
        else {
            return "waiting"
        }
    }

    public async rejectEnd (): Promise<EndRejectionResponses | undefined> {
        // verify state
        const { current_state } = await this.getState()
        if (current_state !== "confirmation") {
            throw new Error("Match is not in the confirmation state.")
        }

        // append false to ends_confirmed array
        await this.redisClient.json.ARRAPPEND(this.sessionId, `$.ends_confirmed`, false)

         // get all participants, check if everyone has submitted
        const currentEnd = await this.redisClient.json.GET(this.matchId, {
            path: [".current_end"]
        }) as number
        const participants = await this.getParticipants<"archer">()

        // boolean switches
        const allUsersSubmitted = participants.every(participant => {
            return participant.ends_confirmed[currentEnd - 1] !== undefined
        })
        const someUsersReject = participants.some(participant => {
            return participant.ends_confirmed[currentEnd - 1] === false 
        })

        // all users submitted response, one of them rejects
        if (allUsersSubmitted && someUsersReject) {
            return await this.resetEnd()
        }

        // not all users have submitted their confirmation response for this end
        else {
            return "waiting"
        } 
    }

    // FINISHED MATCH
    public async getMatchReport () {
        const { current_state } = await this.getState()

        if (current_state === "finished") {
            const matchReport = await Match.getMatchReport(this.matchId, this.redisClient)
            await this.setState("reported")
            return matchReport
        } else if (current_state === "reported") {
            return false
        }
    }

    // PRIVATE UTILITIES
    private async setState (nextState: MatchState) {
        await Match.setState(this.matchId, nextState, this.redisClient)
    }

    private async setupSubmissionMap () {
        const participants = await this.getParticipants()
        const participantUserIds = participants.map(participant => participant.user_id)
        const participantSessionIds = participants.map(participant => Match.createUserSessionId(participant.user_id))

        // cyclic shift by 1 position
        const lastUserId = participantUserIds.pop() as string
        participantUserIds.unshift(lastUserId)
        const submissionMap: { [userId: string]: string } = {}
        for (let idx = 0; idx < participantUserIds.length; idx ++) {
            submissionMap[participantUserIds[idx]] = participantSessionIds[idx]
        }

        // save the submission map
        await this.redisClient.json.SET(this.matchId, "$.submission_map", submissionMap)
    }

    private async nextEnd () {
        await this.redisClient.json.NUMINCRBY(this.matchId, "$.current_end", 1)
    }

    private async resetEnd (): Promise<EndResetResponse | undefined> {
        const [ currentEnd, arrowsPerEnd ] = await this.redisClient.json.GET(this.matchId, {
            path: ['$.["current_end", "arrows_per_end"]']
        }) as [number, number]
        const participants = await this.getParticipants<"archer">()
        const submissionMap = await this.redisClient.json.GET(this.matchId, {
            path: [".submission_map"]
        }) as { [submitterId: string]: string }

        // construct EndResetResponse
        const endResubmissionForms: EndResubmissionForm[] = Object.entries(submissionMap).map(([submitterId, sessionId]) => {
            const participantId = sessionId.replace("match-session:", "")
            // get the session that this user was scoring for
            const session = participants.filter(participant => participant.user_id === participantId)[0]
            const { user_id, first_name, last_name, university, scores } = session
            const arrows = Match.getEndArrows(scores, currentEnd, arrowsPerEnd)

            return {
                receipient: submitterId,
                for: {
                    id: user_id,
                    first_name,
                    last_name,
                    university
                },
                arrows,
                current_end: currentEnd
            }
        })

        for (const [ _, sessionId ] of Object.entries(submissionMap)) {
            // reset arrows
            await this.redisClient.json.ARRTRIM(sessionId, "$.scores", -1, (currentEnd * arrowsPerEnd) - arrowsPerEnd)
            // reset confirmation
            await this.redisClient.json.ARRPOP(sessionId, "$.ends_confirmed")
        }

        // return to submit state
        await this.setState("submit")

        return {
            action: "reset",
            resetPayload: endResubmissionForms
        }

    }


}