import { LiveMatch, MatchState } from "./types";

export function isValidLiveMatchState(state: any): state is MatchState {
    const validMatchStates = [
        "open", 
        "full", 
        "submit", 
        "waiting submit", 
        "confirmation", 
        "waiting confirmation", 
        "finished", 
        "paused"
    ]
    if (typeof state === "string") return validMatchStates.includes(state)
    else if (Array.isArray(state)) return state.map(s => validMatchStates.includes(s)).every(b => b)
    return false
}