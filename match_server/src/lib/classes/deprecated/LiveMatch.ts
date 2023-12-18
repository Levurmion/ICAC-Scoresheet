import { RedisClientOptions, RedisClientType, createClient } from "redis";
import { EventEmitter } from "stream";
import * as types from "../../types";
import { RedisJSON } from "@redis/json/dist/commands";

export type LiveMatchInfoFields =
    | "name"
    | "round"
    | "max_participants"
    | "arrows_per_end"
    | "num_ends"
    | "host"
    | "created_at"
    | "current_end"
    | "current_state"
    | "previous_state";

export type ParticipantInfoFields = "session" | "first_name" | "last_name" | "university" | "role" | "connected" | "ready" | "ends_confirmed" | "scores";

export type LiveMatchInfoDtypes = {
    name: string;
    round: string;
    host: string;
    created_at: string;
    current_state: types.MatchState;
    previous_state: types.MatchState;
    max_participants: number;
    current_end: number;
    arrows_per_end: number;
    num_ends: number;
};

export type ParticipantInfoDtypes<R extends types.MatchRole = types.MatchRole> = {
    session: string;
    first_name: string;
    last_name: string;
    university: string;
    role: types.MatchRole;
    connected: boolean;
    ready: boolean;
    ends_confirmed: R extends "judge" ? undefined : boolean[];
    scores: R extends "judge" ? undefined : types.Arrow[];
};

export default class LiveMatch extends EventEmitter {
    readonly matchId: string;

    private redisClient: RedisClientType;

    constructor(matchId: string, redisClient: RedisClientType) {
        super();

        // initialize
        this.matchId = matchId;
        this.redisClient = redisClient;
    }

    // ========================= PUBLIC METHODS ==============================

    /**
     * @returns Javascript object representation of the Match.
     */
    public async getLiveMatch() {
        return await this.redisClient.json.GET(this.matchId);
    }

    /**
     * Retrieves information fields about the match from Redis.
     * @param fields The fields to be retrieved:
     * - name
     * - round
     * - max_participants
     * - arrows_per_end
     * - num_ends
     * - host
     * - created_at
     * - current_end
     * - current_state
     * - previous_state
     * @returns A `string` if only a single field was queried and an object of `{ field: value }` if multiple fields was queried. Returns `false` if there was an error.
     */
    public async getMatchInfoFields<F extends LiveMatchInfoFields>(...fields: F[]) {
        try {
            const fieldValues = await this.redisClient.json.GET(this.matchId, {
                path: fields,
            });

            if (fields.length === 1) {
                return fieldValues as LiveMatchInfoDtypes[F];
            } else {
                return fieldValues as { [field: string]: LiveMatchInfoDtypes[F] };
            }
        } catch (error: any) {
            console.log("LiveMatch.getMatchInfoFields() Error: ", error.message);
            return false;
        }
    }

    /**
     * Retrieves information fields about a user from Redis.
     * @param fields The fields to be retrieved:
     * - name
     * - first_name
     * - last_name
     * - university
     * - role
     * - connected
     * - ready
     * - ends_confirmed
     * - score
     * @returns A `string` if only a single field was queried and an object of `{ field: value }` if multiple fields was queried. Returns `false` if there was an error.
     */
    public async getParticipantFields<F extends ParticipantInfoFields>(userId: string, ...fields: F[]) {
        try {
            const participantFields = `["${fields.join('", "')}"]`;
            const fieldValues = (await this.redisClient.json.GET(this.matchId, {
                path: `$.participants.${userId}${participantFields}`,
            })) as unknown as Array<ParticipantInfoDtypes[F]>;

            if (fields.length === 1) {
                return fieldValues[0] as ParticipantInfoDtypes[F];
            } else {
                const fieldValuesAsObject = {} as { [field: string]: ParticipantInfoDtypes[F] };
                fields.forEach((field, idx) => (fieldValuesAsObject[field] = fieldValues[idx]));
                return fieldValuesAsObject;
            }
        } catch (error: any) {
            console.log("LiveMatch.getParticipantFields() Error: ", error.message);
            return false;
        }
    }

    /**
     * Registers a user into `LiveMatch` for as long as the number of participants < `max_participants`.
     * @param userId
     * @param user The user to be registered as a `MatchParticipant`.
     * @returns **true** for a successful registration and **false** otherwise.
     */
    public async registerUser(userId: string, user: types.MatchParticipant<types.MatchRole>) {
        try {
            const maxParticipants = (await this.getMatchInfoFields("max_participants")) as number;
            const numParticipants = (await this.getNumParticipants()) as number;
            const sessionMatchId = await this.redisClient.GET(user.session)

            if (numParticipants < maxParticipants && sessionMatchId === this.matchId) {
                await this.redisClient.json.SET(this.matchId, `.participants.${userId}`, user as unknown as RedisJSON);
                if (numParticipants === maxParticipants - 1) {
                    await this.setState("full");
                }
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
            console.log("LiveMatch.registerUser() Error: ", error.message);
            return false;
        }
    }
    /**
     * Gets a registered user in the current `LiveMatch`.
     * @param userId
     * @returns The registered user as a `MatchParticipant`. `null` if the user is not registered.
     */
    public async getUser(userId: string) {
        try {
            const participant = await this.redisClient.json.GET(this.matchId, {
                path: [`.participants.${userId}`],
            });
            return participant;
        } catch (error: any) {
            console.log("LiveMatch.getUser() Error: ", error.message);
            return null;
        }
    }

    /**
     * Deletes a registered user from the current `LiveMatch`.
     * @param userId
     * @returns **true** if user was successfully deleted and **false** otherwise.
     */
    public async deleteUser(userId: string) {
        try {
            await this.removeUserSession(userId);
            await this.redisClient.json.DEL(this.matchId, `.participants.${userId}`);
            await this.setState("open");
            return true;
        } catch (error: any) {
            console.log("LiveMatch.deleteUser Error: ", error.message);
            return false;
        }
    }

    /**
     * Counts the number of participants currently registered in the `LiveMatch`.
     * @returns the number of participants currently registered in the `LiveMatch`.
     */
    public async getNumParticipants() {
        try {
            const numParticipants = await this.redisClient.json.OBJLEN(this.matchId, ".participants");
            return numParticipants as number;
        } catch (error: any) {
            console.log("LiveMatch.getNumParticipants() Error: ", error.message);
            return false;
        }
    }

    /**
     * Retrieve all currently registered users as an array of `MatchParticipant` objects.
     * @returns an array of currently registered users as `MatchParticipant` objects and **false** if the operation was unsuccessful.
     */
    public async getParticipants() {
        try {
            const participants = await this.redisClient.json.GET(this.matchId, {
                path: [".participants"],
            });
            if (Object.keys(participants as object).length === 0) {
                return [];
            } else {
                const participantList = Object.entries(participants as object).map(([id, user]) => {
                    return { id, user } as { id: string; user: types.MatchParticipant<types.MatchRole> };
                });
                return participantList;
            }
        } catch (error: any) {
            throw new Error(`LiveMatch.getParticipants() Error: ${error.message}`);
        }
    }

    /**
     * Set a user `ready` state to **true**
     * @param userId
     * @returns **true** if the operations was successful and **false** otherwise.
     */
    public async setReady(userId: string) {
        try {
            const setReady = await this.redisClient.json.SET(this.matchId, `.participants.${userId}.ready`, true);

            if (setReady === "OK") {
                await this.shouldMoveToSubmit();
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
            console.log("LiveMatch.setReady() Error: ", error.message);
            return false;
        }
    }

    /**
     * Set a user `ready` state to **false**
     * @param userId
     * @returns **true** if the operations was successful and **false** otherwise.
     */
    public async setUnready(userId: string) {
        try {
            const setUnready = await this.redisClient.json.SET(this.matchId, `.participants.${userId}.ready`, false);

            if (setUnready === "OK") {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
            console.log("LiveMatch.setUnready() Error: ", error.message);
            return false;
        }
    }

    /**
     * Set a user `connected` state to **true**
     * @param userId
     * @returns **true** if the operations was successful and **false** otherwise.
     */
    public async setConnected(userId: string) {
        try {
            const setConnected = await this.redisClient.json.SET(this.matchId, `.participants.${userId}.connected`, true);

            if (setConnected === "OK") {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
            console.log("LiveMatch.setConnected() Error: ", error.message);
            return false;
        }
    }

    /**
     * Set a user `connected` state to **false**
     * @param userId
     * @returns **true** if the operations was successful and **false** otherwise.
     */
    public async setDisconnected(userId: string) {
        try {
            const setDisconnected = await this.redisClient.json.SET(this.matchId, `.participants.${userId}.connected`, false);

            if (setDisconnected === "OK") {
                return true;
            } else {
                return false;
            }
        } catch (error: any) {
            console.log("LiveMatch.setDisconnected() Error: ", error.message);
            return false;
        }
    }

    // ========================= PRIVATE METHODS ==============================

    /**
     * Retrieve the current state of the `LiveMatch`.
     * @returns an object of `{ current_state: MatchState, previous_state: MatchState }`.
     */
    public async getState() {
        try {
            const matchState = await this.getMatchInfoFields("current_state", "previous_state");
            return matchState;
        } catch (error: any) {
            console.log("LiveMatch.getState() Error: ", error.message);
            return false;
        }
    }

    private async setState(nextState: types.MatchState) {
        try {
            const currentState = await this.getMatchInfoFields("current_state");
            await this.redisClient.json.SET(this.matchId, ".current_state", nextState);
            await this.redisClient.json.SET(this.matchId, ".previous_state", currentState);
            return true;
        } catch (error: any) {
            throw new Error(`LiveMatch.setState() Error: ${error.message}`);
        }
    }

    private async shouldMoveToSubmit() {
        try {
            const maxParticipants = (await this.getMatchInfoFields("max_participants")) as number;
            const numParticipants = (await this.getNumParticipants()) as number;
            if (numParticipants === maxParticipants) {
                const participants = await this.getParticipants();
                const allUsersReady = participants.every((participant) => participant.user.ready);
                if (allUsersReady) {
                    await this.setState("submit");
                }
            }
        } catch (error: any) {
            throw new Error(`LiveMatch.shouldMoveToSubmit() Error: ${error.message}`);
        }
    }

    private async removeUserSession(userId: string) {
        try {
            const userSession = (await this.getParticipantFields(userId, "session")) as string;
            const sessionMatchId = await this.redisClient.GET(userSession)
            if (sessionMatchId === this.matchId) {
                await this.redisClient.DEL(userSession);
            } else {
                throw new Error("session not found for this match");
            }
        } catch (error: any) {
            throw new Error(`LiveMatch.removeUserSession() Error: ${error.message}`);
        }
    }

    private async removeUserWithNoSession(userId: string) {
        try {
            const userSession = (await this.getParticipantFields(userId, "session")) as string
            if (userSession) {
                const sessionMatchId = await this.redisClient.GET(userSession)
                console.log(sessionMatchId)
                if (sessionMatchId !== this.matchId || sessionMatchId === null) {
                    await this.deleteUser(userId)
                }
            }
        } catch (error: any) {
            throw new Error(`LiveMatch.removeUserWithNoSession() Error: ${error.message}`);
        }
    }
}
