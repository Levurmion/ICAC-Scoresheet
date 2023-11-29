import { LiveMatch, MatchState, PublicMatch, RestrictedMatch } from "./types";

export function isRestrictedMatch(match: LiveMatch): match is RestrictedMatch {
    return (match as RestrictedMatch).whitelist !== undefined
}

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