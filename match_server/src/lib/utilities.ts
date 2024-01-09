import { Request, Response } from "express"
import useSupabaseClient from "./supabase/useSupabaseClient"
import { RedisMatch, UserSession, MatchTokenPayload, UserSignInCredentials, UserSignUpCredentials, MatchRole } from "./types"
import redisClient from "./redis/redisClient"
import 'dotenv/config'
import EventEmitter = require("events")
import { User } from '@supabase/gotrue-js/src/lib/types'
import { RedisJSON } from "@redis/json/dist/commands"
import { Socket } from "socket.io"

const jwt = require('jsonwebtoken')
const crypto = require('crypto')

export const userSignUp: UserSignUpCredentials = {
    email: "elberttimothy23@gmail.com",
    password: "password123",
    first_name: "Elbert",
    last_name: "Timothy",
    date_of_birth: new Date(),
    gender: "male"
}

export const userSignIn: UserSignInCredentials = {
    email: "elberttimothy23@gmail.com",
    password: "password123"
}

export const persistentUserSignIn: UserSignInCredentials = {
    email: "ignatiuselbert5@gmail.com",
    password: "password123"
}

export const testUsersSignIn: UserSignInCredentials[] = [
    {
        email: "testuser1@test.com",
        password: "password"
    },
    {
        email: "testuser2@test.com",
        password: "password"
    },
    {
        email: "testuser3@test.com",
        password: "password"
    }
]

export function isValidAlphanumeric(string: string): boolean {
    const regex = /^[A-Za-z0-9_ ]+$/
    return regex.test(string)
}

export async function getUserId(context: { req: Request, res: Response }) {
    const supabase = useSupabaseClient(context)
    return (await supabase.auth.getUser()).data.user?.id ?? false
}

export async function getRedisMatch(matchId: string) {
    const matchObject = await redisClient.json.GET(matchId)
    if (matchObject !== null) return matchObject as unknown as RedisMatch
    else return null
}

export async function setRedisMatchReservation(matchId: string, userId: string, expSeconds: number) {
    const reservationKey = `reservation:${matchId}:${userId}` 
    await redisClient.SET(reservationKey, 1)
    await redisClient.EXPIRE(reservationKey, expSeconds)
}

export async function getRedisMatchReservations(matchId: string): Promise<number> {
    const reservationPattern = `reservation:${matchId}*`
    // redis KEYS will run O(N), N = number of keys in database
    // however, this is fast enough for our use case
    // since we won't have that large of a userbase to start
    const matchReservations = await redisClient.KEYS(reservationPattern)
    return matchReservations.length
}

export function isValidDateString (string: string): boolean {
    const date = new Date(string);
    return date instanceof Date && !isNaN(date as any);
}

export function decodeJWT(accessToken: string) {
    if (!process.env.MATCH_TOKEN_SECRET) throw new Error('MATCH_TOKEN_SECRET is undefined')
    const decodedToken = jwt.verify(accessToken, process.env.MATCH_TOKEN_SECRET)
    return decodedToken as MatchTokenPayload
}

/**
 * @returns The session expiry time (in s) as set in the SESSION_EXPIRY environment variable (in minutes).
 */
export function getSessionExpirySeconds () {
    if (!process.env.SESSION_EXPIRY) {
        throw new Error('SESSION_EXPIRY is undefined')
    }
    return Number(process.env.SESSION_EXPIRY) * 60
}


// MATCH SERVER SESSION MANAGEMENT
export function createSessionId (authToken: User) {
    const userId = authToken.id
    return `match-session:${userId}`
}

export async function getSession (authToken: User) {
    const userSessionId = createSessionId(authToken)
    const userSession = await redisClient.json.GET(userSessionId) as unknown as UserSession
    return {
        sessionId: userSessionId,
        session: userSession
    }
}

/**
 * Sets a session in redis assuming `accessToken` signature has been verified.
 * @param authToken Supabase auth JWT `UserResponse.data.user`.
 * @param accessToken Authenticated access token.
 * @returns `null` if session could not be set and the `sessionId` if successful.
 */
export async function setSession (authToken: User, accessToken: MatchTokenPayload) {
    const userMetadata = authToken.user_metadata
    const authTokenUserId = authToken.id
    const accessTokenUserId = accessToken.user_uuid
    const { first_name, last_name, university } = userMetadata
    
    if (authTokenUserId === accessTokenUserId) {
        const userSessionId = createSessionId(authToken)
        const matchId = accessToken.match_uuid
        const sessionData: UserSession = {
            match_id: matchId,
            user_id: authTokenUserId,
            first_name,
            last_name,
            university,
            ready: false,
            connected: true,
            role: accessToken.role,
            scores: [],
            ends_confirmed: []
        }

        // create a HASHMAP mapping sessionId -> matchId
        await redisClient.HSET("matches-for-session", userSessionId, matchId)
        // save session as a JSON
        await redisClient.json.SET(userSessionId, "$", sessionData as unknown as RedisJSON)

        return userSessionId
    } else {
        return null
    }
}

export function saveDataIntoSocket (socket: Socket, matchId: string, userId: string, sessionId: string, role: MatchRole) {
    socket.data = {
        matchId,
        userId,
        sessionId,
        role
    }
}


// for testing event callbacks
export function waitForEvent (eventEmitter: EventEmitter, event: string) {
    return new Promise((resolve, reject) => {
        eventEmitter.once(event, payload => resolve(payload))
    })
}

export function delay (ms: number) {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(true)
        }, ms)
    })
}