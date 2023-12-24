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

export type MatchState = "open" | "full" | "submit" | "confirmation" | "finished" | "reported" | "paused"

export type MatchRole = "archer" | "judge"

export type Score = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | "X"

export type Arrow = {
    score: Score,
    previous_score?: Score,
    submitted_by: string,
    judge_id?: string
}

export type MatchTokenPayload = {
    user_uuid: string,
    match_uuid: string,
    role: MatchRole,
}

export interface LobbyUserDetails {
    user_id: string;
    first_name: string;
    last_name: string;
    university: string;
    ready: boolean;
    connected: boolean;
    role: string;
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
    competition?: string;
    bow?: string | { [user_id: string]: string };
    whitelist?: {
        [user_id: string]: MatchRole
    }
    max_participants: number;
    arrows_per_end: number;
    num_ends: number;
}

export interface RedisMatch extends MatchParams {
    created_at: string;
    started_at?: string;
    current_end: number;
    host: string;
    submission_map?: {
        [submitter_id: string]: string // sessionId
    }
    current_state: MatchState;
    previous_state: MatchState;
}

export interface EndSubmissionForm {
    for: {
        id: string;
        first_name: string;
        last_name: string;
        university: string;
    };
    current_end: number;
    arrows: Array<null | Arrow>
}

export interface UserEndTotal {
    id: string;
    first_name: string;
    last_name: string;
    university: string;
    end_arrows: Array<Arrow>;
    end_total: number;
    running_total: number;
}

export interface EndTotals {
    current_end: number;
    arrows_shot: number;
    end_totals: UserEndTotal[]
}

export interface EndResubmissionForm extends EndSubmissionForm {
    receipient: string;
    arrows: Arrow[]
}

export interface EndResetResponse {
    action: "reset";
    resetPayload: EndResubmissionForm[]
}
export type EndRejectionResponses = "waiting" | "reject"
export type EndConfirmationResponses = EndRejectionResponses | "proceed"

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

export interface MatchReport {
    host: string;
    name: string;
    started_at: string;
    finished_at: string;
    competition?: string;
    scoresheets: Scoresheet[]
}

export interface Scoresheet {
    // SQL relations
    id?: string;
    match_id?: string;
    // Scoresheet attributes
    round?: string;
    bow?: string;
    user_id: string;
    arrows_shot: number;
    arrows_per_end: number;
    num_ends: number;
    created_at: string;
    scoresheet: Arrow[];
}

// Socket.IO State
export interface SocketIORedisMatchState extends RedisMatch {
    participants: UserSession[]
}