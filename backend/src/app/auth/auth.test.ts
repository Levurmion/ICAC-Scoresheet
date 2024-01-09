import { UserSignInCredentials, UserSignUpCredentials } from "../../lib/types"
import { userSignIn, userSignUp } from "../../lib/utilities"

const supertest = require('supertest')
const agent = supertest.agent

const userAgent = agent('http://localhost:80/api')

describe('Testing /auth Endpoints', () => {

    test("Sign Up User: POST /auth/sign-up/user", async () => {
        const res = await userAgent.post('/auth/sign-up/user').send(userSignUp)
        expect(res.statusCode).toEqual(201)
    })

    test("Sign Up User FAIL: POST /auth/sign-up/user", async () => {
        const res = await userAgent.post('/auth/sign-up/user').send(userSignUp)
        expect(res.statusCode).toEqual(409)
    })

    test("Sign In User: POST /auth/sign-in", async () => {
        const res = await userAgent.post('/auth/sign-in').send(userSignIn)
        expect(res.statusCode).toEqual(200)
    })

    test("Sign Out User: POST /auth/sign-out", async () => {
        const res = await userAgent.post('/auth/sign-out')
        expect(res.statusCode).toEqual(200)
    })

    test('Delete User FAIL: DELETE /auth/user', async () => {
        const res = await userAgent.delete('/auth/user')
        expect(res.statusCode).toEqual(401)
    })

    test("Sign In and Delete User", async () => {
        const resSignIn = await userAgent.post('/auth/sign-in').send(userSignIn)
        expect(resSignIn.statusCode).toEqual(200)
        const resDelete = await userAgent.delete('/auth/user').send()
        expect(resDelete.statusCode).toEqual(200)
    })

})