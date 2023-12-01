import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import supertest from "supertest";
import { persistentUserSignIn } from "../lib/utilities";
import "dotenv/config";
import { LiveMatchRedisType, MatchParams } from "../lib/types";
import { Response } from "superagent";
import { parse } from "cookie";

function waitFor(socket: ClientSocket, event: string) {
    return new Promise((resolve, reject) => {
        try {
            socket.once(event, (response: any) => {
                resolve(response);
            });
        } catch (error) {
            reject(error);
        }
    });
}

// to make sure we can actually catch the reply, we need to register the eventListener before emitting the event
function waitForReply(socket: ClientSocket, emittedEvent: string, emittedMsg: any, replyEvent: string) {
    const response = waitFor(socket, replyEvent);
    socket.emit(emittedEvent, emittedMsg);
    return response;
}

// extract cookies from response
function extractCookies(response: Response) {
    const cookiesFromServer = response.headers['set-cookie'] as unknown as string[]
    if (!cookiesFromServer || cookiesFromServer.length === 0) {
        return {}
    } else {
        const cookieJar: { [cookieName: string]: string } = {}
        for (const cookie of cookiesFromServer) {
            const cookieAttributes = cookie.split(';')
            const cookieValue = cookieAttributes[0].split("=")
            cookieJar[cookieValue[0]] = cookieValue[1]
        }
        return cookieJar
    }
}

describe("Handshake Testing Suite", () => {
    let socket: ClientSocket;
    let createdMatchId: string;
    const userAgent = supertest.agent("http://localhost:8001");
    const matchToCreate = {
        name: "Mighty_Match_1",
        max_participants: 2,
        num_ends: 20,
        arrows_per_end: 3
    } as MatchParams;

    beforeAll((done) => {
        socket = ioc("http://localhost:8001", {
            path: "/match-server/socket.io/",
        });
        done();
    });

    test("sign in, create, and reserve match", async () => {
        const signInRes = await userAgent.post("/api/auth/sign-in").send(persistentUserSignIn);
        expect(signInRes.statusCode).toBe(200);
        const createMatchRes = await userAgent.post("/api/matches").send(matchToCreate);
        expect(createMatchRes.statusCode).toBe(201)
        const createdMatch: LiveMatchRedisType = createMatchRes.body
        // save created match ID
        createdMatchId = createdMatch.id
        const reserveMatchRes = await userAgent.post(`/api/matches/${createdMatchId}/reserve`)
        expect(reserveMatchRes.statusCode).toBe(200)
        const cookies = extractCookies(reserveMatchRes)
        console.log(cookies)
    });

    test("expect echo", async () => {
        const msgToEcho = "Echo!";
        const echoedMsg = await waitForReply(socket, "echo", msgToEcho, "echo");
        expect(echoedMsg).toBe(msgToEcho);
    });

    afterAll(async () => {
        socket.disconnect();
        // cleanup - always delete the match that was created
        // keeps test suite idempotent
        await userAgent.delete(`/api/matches/${createdMatchId}`)
    });
});
