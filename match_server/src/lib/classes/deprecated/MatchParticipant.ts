import * as types from "../../types";

export default class MatchParticipant {
    readonly first_name: string;
    readonly last_name: string;
    readonly role: types.MatchRole;
    readonly university: string;

    // private attributes
    private scores: undefined | types.Arrow[];
    private ends_confirmed: undefined | boolean[];

    // public attributes
    public ready: boolean;
    public connected: boolean;

    constructor (participant: types.MatchParticipant<types.MatchRole>) {
        Object.assign(this, participant)
        if (!participant.connected) {
            this.connected = true
        }
        if (participant.ready === undefined) {
            this.ready = false
        }
    }
}