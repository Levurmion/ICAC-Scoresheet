// LOBBY TESTCASES
export const expectedUserAMatchState = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 0,
    current_state: "open",
    previous_state: "open",
    submission_map: {},
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
    ],
};

export const expectedUserBMatchState = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 0,
    current_state: "full",
    previous_state: "open",
    submission_map: {},
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
    ],
};

export const expectedUserBLeftMatchState = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 0,
    current_state: "open",
    previous_state: "full",
    submission_map: {},
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
    ],
};

export const expectedUserAReadyMatchState = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 0,
    current_state: "full",
    previous_state: "open",
    submission_map: {},
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
    ],
};

export const expectedAllReadyMatchState = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 1,
    current_state: "submit",
    previous_state: "full",
    submission_map: { "test-user-B": "match-session:test-user-A", "test-user-A": "match-session:test-user-B" },
    // started_at: "2023-12-24T02:34:23.718Z",
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
    ],
};

export const expectedUserAUnreadyMatchState = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 0,
    current_state: "full",
    previous_state: "open",
    submission_map: {},
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
    ],
};

export const expectedUserBDisconnectedMatchState = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 0,
    current_state: "full",
    previous_state: "open",
    submission_map: {},
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: false,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: false,
        },
    ],
};

// RUNNING MATCH TESTCASES
export const userASubmit_end1 = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 1,
    current_state: "submit",
    previous_state: "full",
    submission_map: { "test-user-B": "match-session:test-user-A", "test-user-A": "match-session:test-user-B" },
    // started_at: "2023-12-24T11:00:36.795Z",
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
            ],
            ends_confirmed: [],
            connected: true,
        },
    ],
};

export const confirmation_end1 = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 1,
    current_state: "confirmation",
    previous_state: "submit",
    submission_map: { "test-user-B": "match-session:test-user-A", "test-user-A": "match-session:test-user-B" },
    // started_at: "2023-12-24T11:30:00.782Z",
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
            ],
            ends_confirmed: [],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
            ],
            ends_confirmed: [],
            connected: true,
        },
    ],
};

export const endReset_end1 = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 1,
    current_state: "submit",
    previous_state: "confirmation",
    submission_map: { "test-user-B": "match-session:test-user-A", "test-user-A": "match-session:test-user-B" },
    // started_at: "2023-12-24T14:18:06.471Z",
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [],
            ends_confirmed: [],
            connected: true,
        },
    ],
};

export const submitMatchState_end2 = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 2,
    current_state: "submit",
    previous_state: "confirmation",
    submission_map: { "test-user-B": "match-session:test-user-A", "test-user-A": "match-session:test-user-B" },
    // started_at: "2023-12-24T14:40:03.106Z",
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
            ],
            ends_confirmed: [true],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
            ],
            ends_confirmed: [true],
            connected: true,
        },
    ],
};

export const pausedMatchState = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 2,
    current_state: "paused",
    previous_state: "submit",
    submission_map: { "test-user-B": "match-session:test-user-A", "test-user-A": "match-session:test-user-B" },
    // started_at: "2023-12-24T15:01:12.652Z",
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
            ],
            ends_confirmed: [true],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
            ],
            ends_confirmed: [true],
            connected: false,
        },
    ],
};

export const resumedMatchState = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 2,
    current_state: "submit",
    previous_state: "paused",
    submission_map: { "test-user-B": "match-session:test-user-A", "test-user-A": "match-session:test-user-B" },
    // started_at: "2023-12-24T15:26:11.025Z",
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
            ],
            ends_confirmed: [true],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
            ],
            ends_confirmed: [true],
            connected: true,
        },
    ],
};

// FINISHED MATCH TESTCASES
export const finishedMatchState = {
    name: "Test Match",
    round: "Portsmouth",
    max_participants: 2,
    arrows_per_end: 3,
    num_ends: 3,
    host: "57ab3332-c2fe-4233-9fcb-df1387de331e",
    created_at: "2023-12-12T08:20:10.458Z",
    current_end: 3,
    current_state: "finished",
    previous_state: "confirmation",
    submission_map: { "test-user-B": "match-session:test-user-A", "test-user-A": "match-session:test-user-B" },
    // started_at: "2023-12-24T15:47:43.879Z",
    participants: [
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-A",
            first_name: "Test",
            last_name: "test-user-A",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" },
                { score: 10, submitted_by: "test-user-B" }
            ],
            ends_confirmed: [true, true, true],
            connected: true,
        },
        {
            match_id: "match:test-match-fake-id-001",
            user_id: "test-user-B",
            first_name: "Test",
            last_name: "test-user-B",
            ready: true,
            university: "Some University",
            role: "archer",
            scores: [
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" },
                { score: 10, submitted_by: "test-user-A" }
            ],
            ends_confirmed: [true, true, true],
            connected: true,
        },
    ],
};