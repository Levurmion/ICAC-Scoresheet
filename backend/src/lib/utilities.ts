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
