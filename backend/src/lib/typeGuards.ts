import { Match, MatchState, PublicMatch, RestrictedMatch } from "./types";

export function isRestrictedMatch(match: Match): match is RestrictedMatch {
    return (match as RestrictedMatch).whitelist !== undefined
}

export function isValidLiveMatchState(state: string | string[]): boolean | undefined {
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
    if (typeof state === "string") return state in validMatchStates
    else if (Array.isArray(state)) return state.map(s => s in validMatchStates).every(b => b)
    return
}