import { Request, Response } from "express"
import useSupabaseClient from "./supabase/useSupabaseClient"
import { UserSignInCredentials, UserSignUpCredentials } from "./types"

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

export function isValidAlphanumeric(string: string): boolean {
    const regex = /^[A-Za-z0-9_ ]+$/
    return regex.test(string)
}

export async function getUserId(context: { req: Request, res: Response }) {
    const supabase = useSupabaseClient(context)
    return (await supabase.auth.getUser()).data.user?.id ?? false
}