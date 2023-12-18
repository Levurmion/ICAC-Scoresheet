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

export type MatchState = "open" | "full" | "submit" | "confirmation" | "finished" | "paused"

export type MatchRole = "archer" | "judge"

export type Score = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | "X"

export type Arrow = {
    score: Score,
    previous_score: Score,
    submitted_by: string,
    judge_uuid: string | null
}

export type MatchTokenPayload = {
    user_uuid: string,
    match_uuid: string,
    role: MatchRole,
}

export interface UserSession<R extends MatchRole=MatchRole> {
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
    connected: boolean
}

export interface MatchParams {
    name: string;
    round?: string;
    max_participants: number;
    arrows_per_end: number;
    num_ends: number;
}

export interface RedisMatch extends MatchParams {
    created_at: string;
    current_end: number;
    host: string;
    submission_map?: {
        [submitter_id: string]: string // sessionId
    }
    whitelist?: {
        [user_id: string]: MatchRole
    }
    current_state: MatchState;
    previous_state: MatchState;
}

export type LiveMatchRedisType = {
    id: string,
    value: RedisMatch
}

export interface CompletedMatch {
    id: string;
    name: string;
    host: string;
    created_at: Date;
    finished_at: Date;
    competition?: string;
}

export interface Scoresheet {
    id: string;
    competition?: string;
    user_id: string;
    round?: string;
    arrows_shot: number;
    arrows_per_end: number;
    bow?: string;
    created_at: Date;
    match_id: string;
    scoresheet: Arrow[];
}