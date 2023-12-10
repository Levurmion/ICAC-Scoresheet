import { Request, Response } from "express"
import useSupabaseClient from "./supabase/useSupabaseClient"
import { LiveMatch, MatchTokenPayload, UserSignInCredentials, UserSignUpCredentials } from "./types"
import redisClient from "./redis/redisClient"
import 'dotenv/config'
import EventEmitter = require("events")

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
    if (matchObject !== null) return matchObject as unknown as LiveMatch
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
 * We compute session ID server-side by hashing the client IP and user ID.
 * @param clientIp IPv4 address of the client.
 * @param userId authentication user ID of the client.
 * @returns SHA256 hash of the two strings.
 */
export function createMatchSessionId (clientIp: string, userId: string) {
    const toHash = clientIp + userId
    const sessionId = crypto.createHash('sha256').update(toHash).digest('hex')
    return sessionId
}

/**
 * @returns The session expiry time (in s) as set in the SESSION_EXPIRY environment variable (in minutes).
 */
export function getMatchSessionExpiry () {
    if (!process.env.SESSION_EXPIRY) {
        throw new Error('SESSION_EXPIRY is undefined')
    }
    return Number(process.env.SESSION_EXPIRY) * 60
}

export function waitForEvent (eventEmitter: EventEmitter, event: string) {
    return new Promise((resolve, reject) => {
        eventEmitter.once(event, payload => resolve(payload))
    })
}