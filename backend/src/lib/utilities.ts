import { Request, Response } from "express"
import useSupabaseClient from "./supabase/useSupabaseClient"
import { RedisMatch, UserSignInCredentials, UserSignUpCredentials } from "./types"

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
    return (await supabase.auth.getUser()).data.user?.id ?? null
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