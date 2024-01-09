import { Server, Socket } from "socket.io";
import { ClientToServerEvents, InterServerEvents, Score, ServerToClientEvents, SocketData } from "../types";
import { Archer } from "../classes/Archer";
import useSupabaseBasicClient from "../supabase/useSupabaseBasicClient";
import { RedisClientType } from "@redis/client";
import Match from "../classes/Match";
import { RedisDefaultModules } from "redis";

export default async function initArcherSocket(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
    archer: Archer,
    redisClient: RedisClientType<RedisDefaultModules>,
    userRedisClient: RedisClientType<RedisDefaultModules>
) {
    const { matchId } = archer;

    // broadcast current match state with the NEW PARTICIPANT to everyone in the room
    try {
        await archer.setConnect();

        const currentMatchState = await archer.getSocketIORedisMatchState();
        const { current_state, previous_state } = currentMatchState;
        if (current_state === "open" || current_state === "full") {
            io.to(matchId).emit("lobby-update", currentMatchState);
        } else if (current_state === "stalled" || current_state === "paused") {
            io.to(matchId).emit("pause-match", currentMatchState);
        } else if (
            previous_state === "paused" ||
            current_state === "finished" ||
            current_state === "reported" ||
            current_state === "saved" ||
            current_state === "save error"
        ) {
            io.to(matchId).emit("resume-match", currentMatchState);
        } else if (current_state === "submit") {
            io.to(matchId).emit("end-submit", currentMatchState);
        }
    } catch (error: any) {
        io.to(matchId).emit("lobby-update:error", error.message);
    }

    // SUBMISSION EVENTS
    socket.on("user-submit", async (scores: Score[], replyCb: (reply: string) => void) => {
        try {
            await archer.submitEndArrows(scores);
            replyCb("OK");

            // broadcast update to match room
            const currentMatchState = await archer.getSocketIORedisMatchState();
            const { current_state } = currentMatchState;
            if (current_state === "confirmation") {
                io.to(matchId).emit("end-confirmation", currentMatchState);
            }
        } catch (error: any) {
            replyCb(error.message);
        }
    });

    // CONFIRMATION EVENTS
    socket.on("user-confirm", async (replyCb: (reply: string) => void) => {
        try {
            const action = await archer.confirmEnd();
            replyCb("OK");

            const currentMatchState = await archer.getSocketIORedisMatchState();
            const { current_state } = currentMatchState;
            switch (action) {
                case "proceed":
                    if (current_state === "submit") {
                        io.to(matchId).emit("end-submit", currentMatchState);
                    } else if (current_state === "finished") {
                        io.to(matchId).emit("match-finished", currentMatchState);

                        // get report and save to Supabase
                        const matchReport = await archer.getMatchReport();

                        if (matchReport) {
                            try {
                                const supabase = useSupabaseBasicClient();

                                const { competition, host, name, started_at, finished_at, scoresheets } = matchReport;

                                // save match first
                                const writeMatch = await supabase
                                    .from("matches")
                                    .insert({
                                        competition,
                                        name,
                                        host,
                                        started_at,
                                        finished_at,
                                    })
                                    .select();

                                if (writeMatch.status >= 400) {
                                    await Match.setState(matchId, "save error", redisClient);
                                    throw new Error(writeMatch.error?.message);
                                }

                                const supabaseMatchId = writeMatch.data?.[0].id;
                                const scoresheetsWithMatchId = scoresheets.map((scoresheet) => {
                                    return { ...scoresheet, match_id: supabaseMatchId };
                                });

                                // now save scoresheets
                                const writeScoresheets = await supabase
                                    .from("scoresheets")
                                    .insert(scoresheetsWithMatchId as any)
                                    .select();

                                if (writeScoresheets.status >= 400) {
                                    await Match.setState(matchId, "save error", userRedisClient);
                                    throw new Error(writeScoresheets.error?.message);
                                }

                                const savedScoresheets = writeScoresheets.data;
                                await Match.setState(matchId, "saved", userRedisClient);
                                const currentMatchState = await Match.getSocketIORedisMatchState(matchId, userRedisClient);

                                if (savedScoresheets) {
                                    io.to(matchId).emit("save-update", currentMatchState);
                                }
                            } catch (error: any) {
                                await Match.setState(matchId, "save error", userRedisClient);
                                const currentMatchState = await Match.getSocketIORedisMatchState(matchId, userRedisClient);
                                io.to(matchId).emit("save-update", currentMatchState);
                            }
                        }
                    }
                    break;
                case "reject":
                    io.to(matchId).emit("end-reset", currentMatchState);
                    break;
                case "waiting":
                    io.to(matchId).emit("confirmation-update", currentMatchState);
                    break;
            }
        } catch (error: any) {
            replyCb(error.message);
        }
    });

    socket.on("user-reject", async (replyCb: (reply: string) => void) => {
        try {
            const action = await archer.rejectEnd();
            replyCb("OK");

            const currentMatchState = await archer.getSocketIORedisMatchState();
            if (action === "reject") {
                io.to(matchId).emit("end-reset", currentMatchState);
            } else if (action === "waiting") {
                io.to(matchId).emit("confirmation-update", currentMatchState);
            }
        } catch (error: any) {
            replyCb(error.message);
        }
    });
}
