# Match Server
The ICAC Scoresheet `match-server` is a dedicated service accessible through the `http://localhost:8001/match-server/` that serves realtime matches through Websockets. Under the hood, this service makes use of the **Socket.IO** library. Connections to the `match-server` are only permitted for authenticated clients with a valid `match_access_token` obtained from `/api/matches/{match_id}/reserve`. On first connection, this token is going to be exchanged for a server-side session on the `match-server`. This server-side session will remain valid until the user chooses to **voluntarily leave the match** OR **disconnects for more than 15 minutes**.

<br>

## Match Lifecycle
A match can be in either one of the following states:
- open
- full
- submit
- confirmation
- finished
- paused


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
A match is **FINISHED** once all ends have been scored and confirmed by participants. A **FINISHED** match will initiate cleanup procedures like:
* saving all scores as `Scoresheets` in Supabase
* making sure that the `Scoresheet` can be retrieved from Supabase
* double-checking that scores in the `Scoresheets` match the Redis match records
* error handling

A **FINISHED** match will only remove itself from Redis once all of the above have been completed to make sure that match data is not accidentally lost by network failures.


### `PAUSED`
A match can be **PAUSED** for several reasons:
- The match host decides to pause the match.
- A user disconnects/leaves in the middle of a running match.

The match host would then have full agency on whether to terminate the match (which takes it to the **FINISHED** state) or reset the match (which takes it to the **OPEN** state).

<br>


## Server Events
The `match-server` publishes specific events to connected instances **Socket.IO Client** to notify live changes to the subscribed match state. The **Socket.IO** client should listen to these events to receive information regarding the latest match states and update the UI accordingly.

### `server:lobby-update`
Notifies a change in the match lobby state. This could be changes to:
- list of registered participants
- ready state of registered participants
- users disconnecting and reconnecting

> **server:lobby-update** can only be emitted by matches in the **OPEN** and **FULL** lifecycle states.

#### payload
```typescript
[
  {
    id: string,
    university: string,
    first_name: string,
    last_name: string,
    ready: boolean,
    connected: boolean
  },
  ...
]
```

### `server:waiting-submit`
Notifies that the match is currently waiting for participants to submit their scores. This event will be accompanied by a payload that specifies the details of the participant a user is scoring for. If this event was triggered by a failed **CONFIRMATION** state, the payload will additionally contain the scores of arrows from the last end to be displayed. The length of the `arrows` array represent the number of arrows that need to be submitted for the current end.

> **server:waiting-submit** can only be emitted by matches in the **SUBMIT** lifecycle state.

#### payload
```typescript
[
  {
    id: string,
    university: string,
    first_name: string,
    last_name: string,
    current_end: number,
    arrows: number[] | null[]
  },
  ...
]
```

### `server:confirmation-update`
Notifies that the match is currently waiting for participants to confirm their scores for the current end. This event will be emitted for every **confirmation** event triggered by a connected participant. The payload will consist of the current confirmation state and scores of every participant in the match.

> **server:confirmation-update** can only be emitted by matches in the **CONFIRMATION** lifecycle state.

#### payload
```typescript
[
  {
    id: string,
    university: string,
    first_name: string,
    last_name: string,
    current_end: number,
    arrows: number[],
    confirmed: "pending" | boolean
  },
  ...
]
```

### `server:finished-update`
Notifies that the match has **FINISHED**. The event is going to be emitted with every check that passed in the background with a payload detailing which cleanup procedure has completed. Errors will also be notified directly to every participant in the match.

> **server:finished-update** can only be emitted by matches in the **FINISHED** lifecycle state.

#### payload
```typescript
{
  scoresheets_saved: boolean,
  scoresheets_validated: boolean,
  error?: string
}
```

### `server:paused`
Notifies that the match has been **PAUSED**. The payload will contain a message explaining the reason for the event. The client should implement mechanisms to pause all client interactions until the event has been dealt with by users with the appropriate permissions. Typically, this will be emitted when:
- a user disconnects
- the match host pauses the match

> **server:paused** can only be emitted by matches in the **SUBMIT** and **CONFIRMATION** lifecycle states.

#### payload
```typescript
{
  reason: string,
  data: any
}
```

### `server:unpause`
Notifies that whatever paused the match has been dealt with. The match will be reverted back to its prior state and the client can resume normal client interaction.

> **server:unpause** can only be emitted by matches in the **PAUSED** lifecycle state.

<br>

## Client Events
The `match-server` listens to specific client events to receive realtime updates about the client to compute its state accordingly. The **Socket.IO Client** should emit these events to notify the server of specific user interactions.

### `client:lobby-ready`
Notifies the server that a participant requests to ready for a match. The user ID will be obtained from the `socket.data.id` attribute set on the client's corresponding server `socket` object on connection.

### `client:lobby-unready`
Notifies the server that a participant requests to unready for a match. The user ID will be obtained from the `socket.data.id` attribute set on the client's corresponding server `socket` object on connection.

### `client:leave`
Notifies the server that a participant requests to gracefully leave the match. This should be handled by removing the participant from the match and deleting their corresponding match session from Redis. Disconnection would then by handled by the server `socket` instance. The client should then listen to a `disconnect` event emitted by the server with the reason **`io server disconnect`** before routing out of the SPA. 

> `disconnect` events with other reasons should be treated as errors!

### `client:submit-end`
Submits the current end of arrows to the server. The payload should detail the `user_id` the scores were keyed for.

#### payload
```typescript
[
  {
    user_id: string,
    arrows: number[]
  },
  ...
]
```

### `client:confirm-end`
Notifies the server of the participant's decision on whether to **accept** or **reject** the scores of the current end.

#### payload
```typescript
{
  confirmation: boolean
}
```















