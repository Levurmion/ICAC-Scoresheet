# Match Server
The ICAC Scoresheet `match-server` is a dedicated service accessible through the `http://localhost:8001/match-server/` that serves realtime matches through Websockets. Under the hood, this service makes use of the **Socket.IO** library. Connections to the `match-server` are only permitted for authenticated clients with a valid `match_access_token` obtained from `/api/matches/{match_id}/reserve`. On first connection, this token is going to be exchanged for a server-side session on the `match-server`. This server-side session will remain valid until the user chooses to **voluntarily leave the match** OR **disconnects for more than 15 minutes**.

## Match Lifecycle
A match can be in either one of the following states:
- open
- full
- submit
- confirmation
- finished
- paused

### lifecycle state #OPEN
All matches start as an #OPEN match. A match is #OPEN while the number of registered participants is less than the configured `max_participants`. As users join an #OPEN match, the number of registered participants is going to be evaluated with every registration. When the number of participants hit the configured capacity, the match will transition to the #FULL state.

### lifecycle state #FULL
When the number of registered participants is equal to `max_participants`, a match will transititon to the #FULL state. No more users can register when a match is #FULL. However, users unregistering will revert the match back to an #OPEN state.

### lifecycle state #SUBMIT
When the following conditions are met:
- The match is #FULL.
- All users are ready.

a #FULL match will transition into the #SUBMIT state. This signifies the start of a match from the lobby. Matches will wait until all participants have submitted their scores for the current end. After all scores have been received, a match would then move to the #CONFIRMATION stage.

### lifecycle state #CONFIRMATION
The #CONFIRMATION state waits for users to confirm all results for the current end. Based on whether the scores were agreed upon, the #CONFIRMATION state can lead to one of two outcomes:
- **All participants agreed** and the match moves on to the next end of the #SUBMIT state.
- **One or more participants disagreed** and the match reverts back to the current #SUBMIT state, repopulating the submission form for scores submitted for the current end.

Furthermore, if this was the final end, the match will transition to the #FINISHED state.

### lifecycle state #FINISHED
A match is #FINISHED once all ends have been scored and confirmed by participants. A #FINISHED match will initiate cleanup procedures like:
* saving all scores as `Scoresheets` in Supabase
* making sure that the `Scoresheet` can be retrieved from Supabase
* double-checking that scores in the `Scoresheets` match the Redis match records
* error handling

A #FINISHED match will only remove itself from Redis once all of the above have been completed to make sure that match data is not accidentally lost by network failures.

### match state #PAUSED
A match can be #PAUSED for several reasons:
- The match host decides to pause the match.
- A user disconnects/leaves in the middle of a running match.

The match host would then have full agency on whether to terminate the match (which takes it to the #FINISHED state) or reset the match (which takes it to the #OPEN state).


## Server Events
The `match-server` publishes specific events to connected instances **Socket.IO Client** to notify live changes to the subscribed match state. 

### server event #lobby-update
Notifies a change in the match lobby state. This could be changes to:
- list of registered participants
- ready state of registered participants

#lobby-update can only be emitted by matches in the #OPEN and #FULL states.
#### payload
```
[
  {
    first_name: string,
    last_name: string,
    ready: boolean
  },
  ...
]
```

### `server event` submit-stage
Notifies a lifecycle event.

