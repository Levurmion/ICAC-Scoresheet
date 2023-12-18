import * as types from "../../types";
import { RedisClientType } from "redis";
import { User } from "@supabase/gotrue-js/src/lib/types";
import MatchParticipant from "./MatchParticipant";
import EventEmitter = require("events");

export type MatchStateUpdateEvents = "server:lobby-update" | "server:waiting-submit" | "server:confirmation-update" | "server:finished-update" | "server:paused" | "server:unpause"

export class LiveMatch extends EventEmitter {
    // read only attributes
    readonly id: string;
    readonly name: string;
    readonly round?: string;
    readonly max_participants: number;
    readonly arrows_per_end: number;
    readonly num_ends: number;
    readonly created_at: Date;
    readonly host: string;
    readonly whitelist?: {
        [user_id: string]: types.MatchRole;
    };

    // private attributes
    private current_end: number;
    private current_state: types.MatchState;
    private previous_state: types.MatchState;
    private submission_map?: {
        [scorer_id: string]: MatchParticipant;
    };
    private participants: {
        [user_id: string]: MatchParticipant;
    };

    // extend the emit() method event types
    emit<K extends MatchStateUpdateEvents>(eventName: K, payload?: any): boolean {
        return super.emit(eventName, payload);
    }
    on<K extends MatchStateUpdateEvents>(eventName: K, listener: (payload?: any) => void): this {
        return super.on(eventName, listener);
    }

    // ====================== CONSTRUCTOR ======================
    constructor(id: string, liveMatch: types.LiveMatch) {
        super();
        this.id = id;
        Object.assign(this, liveMatch);

        if (!liveMatch.current_state || !liveMatch.previous_state) {
            this.current_state = "open";
            this.previous_state = "open";
        }

        // initialize MatchParticipants into their class implementations
        if (Object.keys(liveMatch.participants).length > 0) {
            for (const [userId, participant] of Object.entries(liveMatch.participants)) {
                this.participants[userId] = new MatchParticipant(participant);
            }
        }
    }

    // static method to initialize Match object by fetching from Redis
    static async getLiveMatch(matchId: string, redisClient: RedisClientType) {
        const match = (await redisClient.json.get(matchId)) as unknown as types.LiveMatch;

        if (match === null) {
            return null;
        } else {
            // convert strings to their appropriate types
            match.arrows_per_end = Number(match.arrows_per_end);
            match.created_at = match.created_at;
            match.max_participants = Number(match.max_participants);
            match.num_ends = Number(match.num_ends);
            return new LiveMatch(matchId, match);
        }
    }

     // ====================== MATCH STATE UPDATE EVENT EMITTERS ======================
    private emitLobbyUpdate () {
        if (this.current_state === 'open' || this.current_state === 'full') {
            const participantIds = Object.keys(this.participants)
            const lobbyUpdatePayload = participantIds.map(id => {
                const participant = this.participants[id]
                return {
                    id,
                    first_name: participant.first_name,
                    last_name: participant.last_name,
                    university: participant.university,
                    ready: participant.ready,
                    connected: participant.connected
                }
            })
            this.emit('server:lobby-update', lobbyUpdatePayload)
        }
    }

    private emitMatchPaused (reason: string, data: any) {
        if (this.current_state === 'submit' || this.current_state === 'confirmation') {
            this.setMatchState("paused")
            this.emit('server:paused', {
                reason,
                data
            })
        }
    }

    private emitMatchUnpaused () {
        if (this.current_state === 'paused') {
            this.setMatchState(this.previous_state)
            this.emit('server:unpause')
        }
    }

    // ====================== INSTANCE METHODS ======================

    // LIFECYCLE METHODS ============================================

    /**
     * Changes the state of a match and saves the current state as previous state and emits
     * an event corresponding to the `newState`.
     * @param nextState The state to move the match to.
     */
    private setMatchState(nextState: types.MatchState): void {
        this.previous_state = this.current_state;
        this.current_state = nextState;
    }

    /**
     * Checks if the lobby is at capacity and updates the match state accordingly.
     */
    private updateLobbyCapacity(): void {
        if (this.getNumParticipants() >= this.max_participants) {
            this.setMatchState("full");
        } else if (this.getNumParticipants() < this.max_participants) {
            this.setMatchState("open");
        }
    }

    /**
     * If match is full and all participants are ready and connected, starts the match by moving into the `submit` state.
     */
    private checkAllParticipantsReady(): void {
        if (this.current_state === "full") {
            const participantIds = Object.keys(this.participants);
            const participantReadyStates = participantIds.map((id: string) => this.participants[id].ready);
            const participantConnectedStates = participantIds.map((id: string) => this.participants[id].connected);

            if (participantReadyStates.every((ready) => ready) && participantConnectedStates.every(connected => connected)) {
                this.setMatchState("submit");
            }
        }
    }

    /**
     * Retrieves the current match state.
     * @returns [current state, previous state]
     */
    public getMatchState(): [types.MatchState, types.MatchState] {
        return [this.current_state, this.previous_state];
    }

    // REDIS SYNCHRONIZATION METHODS ========================================================

    /**
     * Saves the current state of the match to Redis.
     * @param redisClient An initialized and connected instance of the Redis NodeJS client.
     * @returns **true** if the operation was successful and **false** otherwise.
     */
    public async save(redisClient: RedisClientType): Promise<boolean> {
        try {
            const matchCopy = JSON.parse(JSON.stringify(this))
            delete matchCopy.id
            await redisClient.json.SET(this.id, "$", matchCopy)
            return true
        } catch (err) {
            console.log(err)
            return false
        }
    }

    /**
     * Synchronizes the current state of the match with Redis.
     * @param redisClient An initialized and connected instance of the Redis NodeJS client.
     * @returns **true** if the operation was successful and **false** otherwise.
     */
    public async sync(redisClient: RedisClientType): Promise<boolean> {
        try {
            const latestLiveMatch = await LiveMatch.getLiveMatch(this.id, redisClient)
            if (latestLiveMatch === null) {
                throw new Error('live match somehow does not exist')
            } else {
                // DO NOT PERFORM Object.assign() as this overwrites EventListeners!
                this.participants = latestLiveMatch.participants
                this.submission_map = latestLiveMatch.submission_map
                this.current_end = latestLiveMatch.current_end
                this.current_state = latestLiveMatch.current_state
                this.previous_state = latestLiveMatch.previous_state
                return true
            }
        } catch (err) {
            console.log(err)
            return false
        }
    }

    // LOBBY METHODS ==============================================

    /**
     * Method to register new user into the match. The method returns **true** if registration was successful and **false** otherwise.
     *
     * For a user to be registered, the following conditions must be met:
     *
     * - The current capacity (number of participants) must be less than the `max_capacity` of this match.
     * - The user must not already been registered.
     * - If the match has a `whitelist`, it implies a restricted match. Users must then additionally be in this `whitelist`.
     *
     * The following pieces of information for the parameters can be obtained from the users' authentication tokens.
     * @param userId The `id` of the user to be registered.
     * @param firstName The `first_name` for the user to be registered.
     * @param lastName The `last_name` of the user to be registered.
     * @returns `boolean`
     */
    public registerUser(userId: string, firstName: string, lastName: string, university: string): boolean {
        
        const newParticipant: types.MatchParticipant<types.MatchRole> = {
            first_name: firstName,
            last_name: lastName,
            university: university,
            ready: false,
            scores: [],
            ends_confirmed: new Array(this.num_ends).fill(false),
            role: "archer",
        };

        if (this.getNumParticipants() >= this.max_participants || this.participants[userId]) {
            return false;
        } else if (this.whitelist) {
            const role = this.whitelist[userId];
            newParticipant.role = role;

            if (role) {
                this.participants[userId] = new MatchParticipant(newParticipant);
                this.updateLobbyCapacity();
                this.emitLobbyUpdate()
                return true;
            } else {
                return false;
            }
        } else {
            this.participants[userId] = new MatchParticipant(newParticipant);
            this.updateLobbyCapacity();
            this.emitLobbyUpdate()
            return true;
        }
    }

    /**
     * Method to remove a currently registered user. Returns **true** if user was in the `participants` list and **flase** otherwise.
     * @param userId The `id` of the user to be removed from the match.
     */
    public removeUser(userId: string): boolean {
        if (this.participants[userId]) {
            delete this.participants[userId];
            this.updateLobbyCapacity();
            this.emitLobbyUpdate()
            return true;
        } else {
            return false;
        }
    }

    /**
     * Set a user to get **ready** for the match.
     * @param userId The `id` of the user to **ready** for the match.
     * @returns A deep copy of the current match's participants serializable properties or `null` if the user is not registered.
     */
    public setReady(userId: string): boolean {
        if (this.participants[userId]) {
            this.participants[userId].ready = true;
            this.checkAllParticipantsReady();
            this.emitLobbyUpdate()
            return true;
        } else {
            return false;
        }
    }

    /**
     * Set a user to **unready** from the match.
     * @param userId The `id` of the user to **unready** from the match.
     * @returns A deep copy of the current match's participants serializable properties or `null` if the user is not registered.
     */
    public setUnready(userId: string): boolean {
        if (this.participants[userId]) {
            this.participants[userId].ready = false;
            this.emitLobbyUpdate()
            return true;
        } else {
            return false;
        }
    }

    // PARTICIPANT METHODS ================================================================

    /**
     * Method to retrieve the current participants of this match. This returns a deep copy of the object to prevent modifying the private `participants` property.
     * @returns A deep copy of the current match's participants serializable properties.
     */
    public getParticipants(): { [userId: string]: types.MatchParticipant<types.MatchRole> } {
        return JSON.parse(JSON.stringify(this.participants));
    }

    /**
     * Get the number of currently registered participants.
     * @returns Number of currently registered match participants.
     */
    public getNumParticipants(): number {
        return Object.keys(this.participants).length;
    }

    /**
     * When a user disconnects, set their connected state to **false**.
     * @param userId The ID of the disconnected user.
     * @returns **true** if the operation succeeded and **false** otherwise.
     */
    public setDisconnected(userId: string): boolean {
        if (this.participants[userId]) {
            this.participants[userId].connected = false
            console.log(this.participants[userId])
            this.emitLobbyUpdate()
            this.emitMatchPaused('user disconnected', {
                ...this.participants[userId]
            })
            return true
        } else {
            return false
        }
    }

    /**
     * When a user reconnects, set their connected state to **true**.
     * @param userId The ID of the disconnected user.
     * @returns **true** if the operation succeeded and **false** otherwise.
     */
    public setConnected(userId: string): boolean {
        if (this.participants[userId]) {
            this.participants[userId].connected = true
            this.emitLobbyUpdate()
            this.emitMatchUnpaused()
            return true
        } else {
            return false
        }
    }
}
