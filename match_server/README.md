# Match Server
The ICAC Scoresheet `match-server` is a dedicated service accessible through the `http://localhost:8001/match-server/` that serves realtime matches through Websockets. Under the hood, this service makes use of the **Socket.IO** library. Connections to the `match-server` are only permitted for authenticated clients with a valid `match_access_token` obtained from `/api/matches/{match_id}/reserve`. On first connection, this token is going to be exchanged for a server-side session on the `match-server`. This server-side session will remain valid until the user chooses to **voluntarily leave the match** OR **disconnects for more than 15 minutes**. Subsequent reconnections of the same user would not require a `match_access_token`. However, users will be automatically rejoined to the match determined by their currently active session regardless of whether the access token was present with the conneciton request.

<br>

## Match Lifecycle
A match can be in either one of the following states:
- open
- full
- submit
- confirmation
- finished
- reported
- saved
- paused
- stalled


### `OPEN`
All matches start as an **OPEN** match. A match is **OPEN** while the number of registered participants is less than the configured `max_participants`. As users join an **OPEN** match, the number of registered participants is going to be evaluated with every registration. When the number of participants hit the configured capacity, the match will transition to the **FULL** state.


### `FULL`
When the number of registered participants is equal to `max_participants`, a match will transititon to the **FULL** state. No more users can register when a match is **FULL**. However, users unregistering will revert the match back to an OPEN state.


### `SUBMIT`
When the following conditions are met:
- The match is **FULL**.
- All users are ready.

a **FULL** match will transition into the **SUBMIT** state. This signifies the start of a match from the lobby. Matches will wait until all participants have submitted their scores for the current end. After all scores have been received, a match would then move to the **CONFIRMATION** stage.


### `CONFIRMATION`
The **CONFIRMATION** state waits for users to confirm all results for the current end. Based on whether the scores were agreed upon, the **CONFIRMATION** state can lead to one of two outcomes:
- **All participants agreed** and the match moves on to the next end of the **SUBMIT** state.
- **One or more participants disagreed** and the match reverts back to the current **SUBMIT** state, repopulating the submission form for scores submitted for the current end.

Furthermore, if this was the final end, the match will transition to the **FINISHED** state.


### `FINISHED`
A match is **FINISHED** once all ends have been scored and confirmed by participants. A **FINISHED** match will initiate match cleanup procedures such as saving records to Supabase and confirming that these operations were successful.


### `REPORTED`
A **FINISHED** match will only allow one of the connected users to retrieve a match report. This match report contains all the information required about the match and its associated `Scoresheets` to Supabase. However, only one write operation should occur per match. Thus, a match will immediately transition to the `REPORTED` state after the first request to get the match report, after which all subsequent requests will be denied.

The Socket.IO instance that managed to obtain the report would then be responsible for saving the match to Supabase and broadcasting updates to all other clients in the room about the progress of this operation.


### `SAVED`
A match that has been successfully saved to Supabase will transition to the **SAVED** state. This indicates that it is safe to delete the match from Redis once all users have left the `match-server`.


### `PAUSED`
A match will be **PAUSED** if a user disconnects in the middle of a running match. A match will automatically unpause if ALL disconnected users reconnect to the `match-server`


### `STALLED`
A match can get **STALLED** for the following reasons:
- The match host decides to stall the match for any reason.
- A user left due to either session expiry or voluntary action in the middle of a running match.
- A fatal error has occurred:
  - match cannot be saved to Supabase
  - score records were found to be corrupt in the middle of a running match

Stalled matches can only be recovered by the host. Match state can be reset (removing all associated sessions) thus reverting it back to the **OPEN** state or terminated to the **FINISHED** state, saving all existing records to Supabase. More granular management features will be developed in the future.

<br>


## Server Events
The `match-server` publishes specific events to connected instances of the **Socket.IO Client** to notify live changes to the subscribed match state. Clients should listen to these events to receive information regarding the latest match states and update the UI accordingly. **ICAC Scoresheet** adopts a *server-authoritative model* whereby match state is exclusively calculated on the server. Thus, all server events are accompanied by a JSON payload that describes the entire match state with every message. While this definitely incurs a much greater network bandwidth overhead, it simplifies the design and implementation of both server and client-side applications. It also works particularly well with React's principle of **object immutability** for state updates.

#### Server Events Payload
```typescript
// Server Events Payload is of Interface SocketIORedisMatchState
interface SocketIORedisMatchState extends RedisMatch {
    participants: UserSession[];
}

// other supporting types and interfaces
type MatchState = "open" | "full" | "submit" | "confirmation" | "finished" | "reported" | "paused" | "stalled" | "saved";

type MatchRole = "archer" | "judge";

type Score = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | "X";

type Arrow = {
    score: Score;
    previous_score?: Score;
    submitted_by: string;
    judge_id?: string;
};

interface UserSession<R extends MatchRole = MatchRole> {
    // first and last names to be derived from token
    match_id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    ready: boolean;
    university: string;
    role: R;
    scores: R extends "judge" ? undefined : Arrow[];
    ends_confirmed: R extends "judge" ? undefined : boolean[];
    connected: boolean;
}

interface MatchParams {
    name: string;
    round?: string;
    competition?: string;
    bow?: string | { [user_id: string]: string };
    whitelist?: {
        [user_id: string]: MatchRole;
    };
    max_participants: number;
    arrows_per_end: number;
    num_ends: number;
}

interface RedisMatch extends MatchParams {
    created_at: string;
    started_at?: string;
    current_end: number;
    host: string;
    submission_map?: {
        [submitter_id: string]: string; // sessionId
    };
    current_state: MatchState;
    previous_state: MatchState;
}
```

### `lobby-update`
Notifies a change in the match lobby state. This could be changes to:
- list of registered participants
- ready state of registered participants
- users disconnecting and reconnecting

> `lobby-update` can only be emitted by matches in the **OPEN** and **FULL** lifecycle states.


### `end-submit`
Notifies that the match is currently waiting for participants to submit their scores.

> `waiting-submit` can only be emitted by matches in the **SUBMIT** lifecycle state.


### `end-confirmation`
Notifies that all users have submitted and the match is currently waiting for participants to confirm the results of the current end.

> `end-confirmation` can only by emitted by matches in the **CONFIRMATION** lifecycle state.


### `end-reset`
Notifies that the confirmation request has been rejected due one or more users rejecting the results. The results of the current end will be deleted and users should be prompted to resubmit the current end.

> `end-reset` can only be emitted by matches right after a failed confirmation attempt. This will delete the results of the current end from Redis but the client should handle the event by repopulating the submission form with the results of the last end which should still be saved in memory.


### `confirmation-update`
Notifies that the confirmation state of a user has changed (either they accepted/rejected the current end). This event will be emitted for every **user-confirm**/**user-reject** event triggered by a connected participant.

> `confirmation-update` can only be emitted by matches in the **CONFIRMATION** lifecycle state.


### `match-finished`
Notifies that the match has now **FINISHED**. A match is finished when users have submitted and confirmed scores for every end.

> `match-finished` can only be emitted by matches in the **FINISHED** lifecycle state.

### `save-update`
Notifies clients of the progress in saving the **FINSIHED** match to Supabase.

> `save-update` can only be emitted by matches in the **REPORTED** lifecycle state.

### `pause-match`
Notifies that the match has been **PAUSED** or **STALLED**. The client should implement mechanisms to pause all unwanted user interactions until the event has been dealt with by hosts with the appropriate permissions or all disconnected users reconnect.

> `pause-match` can only be emitted by matches in the **SUBMIT** and **CONFIRMATION** lifecycle states.

### `resume-match`
Notifies that whatever paused the match has been dealt with. The match will be reverted back to its prior state and the client can resume normal client interaction.

> `resume-match` can only be emitted by matches in the **PAUSED** lifecycle state.

<br>

## Client (Archer) Events
The `match-server` listens to specific client events to receive realtime updates about the client to compute its state accordingly. The **Socket.IO Client** should emit these events to notify the server of specific user interactions. This section specifically focuses on events that can be emitted by archers.

> **About Joining Match Lobbies**
> 
> When users join a match lobby, the initial process of joining the room itself can already be directly processed server-side as a `lobby-update` event. Thus, no `user-join` event is explicitly required.

### `user-leave`
Notifies the server that a connected user wants to leave the match. If this occurs in the lobby, it will be gracefully handled by the server by removing the user's session and notifying all remaining clients about the event in a broadcast through a `lobby-update`. This event in a running match would send it to the **STALLED** state.

### `user-ready`
Notifies the server that a user is ready to start the match.

### `user-unready`
Notifies the server that a user is no longer ready to start the match.

### `user-submit`
Notifies the server that a user is submitting scores of the current end. The message for this event is simply an array of scores for the current end. Additionally, a reply callback should be provided for the server to notify the client of the status of the operation. The following conditions are enforced:
- Users must submit the same number of arrows per end as detailed in the match's `arrows_per_end` parameter.
- Users can only submit valid scores as detailed by the `Score` type.
- Users can only submit once per end.
- The current score record must not be corrupted (this is a fatal error and will stall the match).

#### payload
```typescript
type Score = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | "X"
type SubmitPayload = Score[]
```

### `user-confirm`
Notifies the server that a user confirms the results of the current end. A reply callback should be provided for the server to notify the client of the status of the operation.

### `user-reject`
Notifies the server that a user rejects the results of the current end. A reply callback should be provided for the server to notify the client of the status of the operation.



















