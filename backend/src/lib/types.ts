export interface UserSignInCredentials {
    email: string;
    password: string;
}

export interface UserSignUpCredentials extends UserSignInCredentials {
    first_name: string;
    last_name: string;
    gender: string;
    date_of_birth: Date;
    archery_gb_experience?: string;
    archery_gb_membership?: string;
    club?: string;
    disability?: string;
}

export type MatchState = "open" | "full" | "submit" | "waiting submit" | "confirmation" | "waiting confirmation" | "finished" | "paused"

export type MatchRole = "archer" | "judge"

export type Score = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | "X"

export type Arrow = {
    score: Score,
    previous_score: Score,
    judge_uuid: string | null
}

export type MatchTokenBody = {
    user_uuid: string,
    match_uuid: string,
    iat: Date,
    exp: Date,
    role: MatchRole,
    nonce: string
}

export type MatchParticipant<R extends MatchRole> = {
    ready: boolean,
    role: R,
    scores: R extends "judge" ? undefined : Arrow[],
    ends_confirmed?: boolean[];
}

export interface MatchParams {
    name: string;
    round?: string;
    num_archers: number;
    arrows_per_end: number;
    num_ends: number;
}

export interface PublicMatch extends MatchParams {
    created_at: Date;
    current_end: number;
    current_state: MatchState;
    previous_state: MatchState;
    host: string;
    participants: {
        [user_uuid: string]: MatchParticipant<MatchRole>
    };
}

export interface RestrictedMatch extends PublicMatch {
    whitelist: string[]
}

export type Match = RestrictedMatch | PublicMatch