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
    scored_by: string,
    judge_uuid: string | null
}

export type MatchTokenPayload = {
    user_uuid: string,
    match_uuid: string,
    role: MatchRole,
}

export interface MatchParticipant<R extends MatchRole> {
    // first and last names to be derived from token
    first_name: string,
    last_name: string,
    ready: boolean,
    connected: boolean,
    role: R,
    scores: R extends "judge" ? undefined : Arrow[],
    ends_confirmed?: boolean[];
}

export interface MatchParams {
    name: string;
    round?: string;
    max_participants: number;
    arrows_per_end: number;
    num_ends: number;
}

export interface LiveMatch extends MatchParams {
    created_at: Date;
    current_end: number;
    current_state: MatchState;
    previous_state: MatchState;
    host: string;
    participants: {
        [user_uuid: string]: MatchParticipant<MatchRole>
    };
    whitelist?: {
        [user_id: string]: MatchRole
    };
    submission_map?: {
        [submitter_id: string]: MatchParticipant<"archer">
    }
}

export type LiveMatchRedisType = {
    id: string,
    value: LiveMatch
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