import Participant from "./Participant";
import Match from "./Match";
import { RedisClientMultiCommandType } from "@redis/client/dist/lib/client/multi-command"
import { RedisClientType, RedisDefaultModules, RedisFunctions, RedisScripts } from "redis";
import {
    Arrow,
    EndConfirmationResponses,
    EndRejectionResponses,
    EndSubmissionForm,
    EndTotals,
    MatchRole,
    MatchState,
    Score,
    UserEndTotal,
    UserSession,
} from "../types";

export class Archer extends Participant {
    readonly userId: string;
    readonly matchId: string;
    readonly sessionId: string;
    protected redisClient: RedisClientType;
    protected transaction: RedisClientMultiCommandType<RedisDefaultModules, RedisFunctions, RedisScripts>;

    constructor(sessionId: string, matchId: string, userId: string, redisClient: RedisClientType) {
        super(sessionId, matchId, userId, redisClient);
    }

    // ARCHER INITIALIZER
    static async initArcher(userId: string, redisClient: RedisClientType) {
        const sessionExists = await Match.getSession(userId, redisClient);
        if (sessionExists) {
            const sessionId = Match.createUserSessionId(userId);
            const matchId = sessionExists.match_id;
            return new Archer(sessionId, matchId, userId, redisClient);
        } else {
            return null;
        }
    }

    // RUNNING MATCH
    public async getEndSubmissionForm() {
        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "submit") {
            throw new Error("Match is not in the submit state.");
        }

        const matchInfo = await this.getRedisMatch();
        const sessionIdToSubmitFor = matchInfo.submission_map?.[this.userId] as string;
        const { current_end, arrows_per_end } = matchInfo;

        const userToSubmitFor = (await this.redisClient.json.GET(sessionIdToSubmitFor)) as unknown as UserSession<"archer">;
        const { scores } = userToSubmitFor;

        // We calculate this to determine whether it's a form for:
        // - a new end
        // - to reconfirm an end
        const scoreEndStart = current_end * arrows_per_end - arrows_per_end;
        const scoreEndFinish = current_end * arrows_per_end;
        const currentEndScores = scores.slice(scoreEndStart, scoreEndFinish);

        const submissionForm: EndSubmissionForm = {
            for: {
                id: userToSubmitFor.user_id,
                first_name: userToSubmitFor.first_name,
                last_name: userToSubmitFor.last_name,
                university: userToSubmitFor.university,
            },
            current_end,
            arrows: currentEndScores.length === 0 ? new Array(arrows_per_end).fill(null) : currentEndScores,
        };

        return submissionForm;
    }

    public async submitEndArrows(scores: Score[]) {
        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "submit") {
            throw new Error("Match is not in the submit state");
        }

        try {
            const endParams = (await this.redisClient.json.GET(this.matchId, {
                path: ['$.["arrows_per_end", "current_end"]'],
            })) as [number, number];
            const [arrowsPerEnd, currentEnd] = endParams;

            // verify input length
            if (scores.length < arrowsPerEnd) {
                throw new Error("Number arrows submitted less than arrows_per_end");
            } else if (scores.length > arrowsPerEnd) {
                throw new Error("Number arrows submitted greater than arrows_per_end");
            }

            // verify score values
            if (
                !scores.every((score) => {
                    if (typeof score === "number") {
                        return 0 <= score && score <= 10;
                    } else if (typeof score === "string") {
                        return score === "X";
                    }
                })
            ) {
                throw new Error("Scores must be between 0-10 or an X");
            }

            // find session to submit for
            const submitForSessionId = (await this.redisClient.json.GET(this.matchId, {
                path: [`.submission_map.${this.userId}`],
            })) as string;

            // verify that user has not submitted for this end
            const numScoresSubmitted = (await this.redisClient.json.ARRLEN(submitForSessionId, "$.scores")) as number[];
            if (numScoresSubmitted[0] === currentEnd * arrowsPerEnd) {
                throw new Error("End already submitted");
            } else if (numScoresSubmitted[0] !== currentEnd * arrowsPerEnd - arrowsPerEnd) {
                throw new Error(`Corrupt record`);
            }

            const endArrows: Arrow[] = scores.map((score) => {
                return { score, submitted_by: this.userId };
            });
            endArrows.sort((a, b) => {
                if (a.score > b.score) {
                    return -1;
                } else {
                    return 1;
                }
            });

            // save arrow
            await this.redisClient.json.ARRAPPEND(submitForSessionId, "$.scores", ...endArrows);

            // check if all users have submitted
            const participants = await this.getParticipants();
            if (participants?.every((participant) => participant.scores?.length === arrowsPerEnd * currentEnd)) {
                await this.setState("confirmation");
            }
        } catch (error: any) {
            throw new Error(`End submission rejected: ${error.message}.`);
        }
    }

    public async getScores() {
        return (await this.redisClient.json.GET(this.sessionId, {
            path: [".scores"],
        })) as Arrow[];
    }

    public async getEndTotals() {
        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "confirmation") {
            throw new Error("Match is not in the confirmation state.");
        }

        const [currentEnd, arrowsPerEnd] = (await this.redisClient.json.GET(this.matchId, {
            path: ['$.["current_end", "arrows_per_end"]'],
        })) as [number, number];
        const participants = await this.getParticipants<"archer">();
        const archers: UserSession<"archer">[] | undefined = participants?.filter(participant => participant.role === "archer")
        const userEndTotals: UserEndTotal[] | undefined = archers?.map((participant) => {
            const { user_id, first_name, last_name, university, scores } = participant;

            const end_arrows = Match.getEndArrows(scores, currentEnd, arrowsPerEnd);
            const end_total = Match.calculateArrowTotal(end_arrows);
            const running_total = Match.calculateArrowTotal(scores);

            return {
                id: user_id,
                first_name,
                last_name,
                university,
                end_arrows,
                end_total,
                running_total,
            };
        });
        return {
            current_end: currentEnd,
            arrows_shot: currentEnd * arrowsPerEnd,
            end_totals: userEndTotals,
        } as EndTotals;
    }

    public async confirmEnd(): Promise<EndConfirmationResponses | undefined> {
        const currentEnd = (await this.redisClient.json.GET(this.matchId, {
            path: [".current_end"],
        })) as number;

        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "confirmation") {
            throw new Error("Match is not in the confirmation state.");
        }

        // verify that user has not decided this end
        const numEndsConfirmed = Number(await this.redisClient.json.ARRLEN(this.sessionId, "$.ends_confirmed"));
        if (numEndsConfirmed === currentEnd) {
            throw new Error("End confirmation already decided.");
        }

        // append true to ends_confirmed array
        // can cause race condition because if two users confirm at the same time, both can get
        // allArchersConfirmed === true after fetching participants
        this.transaction.json.ARRAPPEND(this.sessionId, `$.ends_confirmed`, true);
        await this.getParticipants(false)

        // get all archers, check if everyone has submitted
        const [_, participants] = await this.exec() as [string, UserSession[]];
        const archers = participants.filter(participant => participant.role === "archer") as UserSession<"archer">[]

        // boolean switches
        const allArchersSubmitted = archers?.every((archer) => {
            return archer.ends_confirmed[currentEnd - 1] !== undefined;
        });
        const someArchersReject = archers?.some((archer) => {
            return archer.ends_confirmed[currentEnd - 1] === false;
        });
        const allArchersConfirmed = archers?.every((archer) => {
            return archer.ends_confirmed[currentEnd - 1] === true;
        });

        // all users submitted response, all of them accepts
        // To prevent race condition, we must WATCH the matchId key to make sure that only the
        // first instance can modify it. The second instance, upon attempting the transaction,
        // would have realized that the key has been modified SINCE when it evaluated the
        // participants, suggesting that another instance has already handled the transaction.
        // This will kill the second transaction so current_end increment only occurs exactly once.
        await this.redisClient.WATCH(this.matchId);
        if (allArchersConfirmed) {
            const numEnds = (await this.redisClient.json.GET(this.matchId, {
                path: [".num_ends"],
            })) as number;

            const proceedTransaction = this.redisClient.MULTI();

            // final end
            if (Number(currentEnd) === Number(numEnds)) {
                await proceedTransaction.json.SET(this.matchId, "$.current_state", "finished").json.SET(this.matchId, "$.previous_state", current_state).exec();
            }
            // not final end, proceed to next end
            else {
                await proceedTransaction.json
                    .SET(this.matchId, "$.current_state", "submit")
                    .json.SET(this.matchId, "$.previous_state", current_state)
                    .json.NUMINCRBY(this.matchId, "$.current_end", 1)
                    .exec();
            }

            return "proceed";
        }
        // all users submitted response, one of them rejects
        if (allArchersSubmitted && someArchersReject) {
            await this.redisClient.UNWATCH();
            await this.setState("submit");
            await this.resetEnd();
            return "reject";
        }
        // not all users have submitted their confirmation response for this end
        else {
            await this.redisClient.UNWATCH();
            return "waiting";
        }
    }

    public async rejectEnd(): Promise<EndRejectionResponses | undefined> {
        const currentEnd = (await this.redisClient.json.GET(this.matchId, {
            path: [".current_end"],
        })) as number;

        // verify state
        const { current_state } = await this.getState();
        if (current_state !== "confirmation") {
            throw new Error("Match is not in the confirmation state.");
        }

        // verify that user has not decided this end
        const numEndsConfirmed = Number(await this.redisClient.json.ARRLEN(this.sessionId, "$.ends_confirmed"));
        if (numEndsConfirmed === currentEnd) {
            throw new Error("End confirmation already decided.");
        }

        // append false to ends_confirmed array
        this.transaction.json.ARRAPPEND(this.sessionId, `$.ends_confirmed`, false);
        await this.getParticipants(false)

        // get all participants, check if everyone has submitted
        const [_, participants] = await this.exec() as [string, UserSession[]];
        const archers = participants.filter(participant => participant.role === "archer") as UserSession<"archer">[]

        // boolean switches
        const allArchersSubmitted = archers?.every((archer) => {
            return archer.ends_confirmed[currentEnd - 1] !== undefined;
        });
        const someArchersReject = archers?.some((archer) => {
            return archer.ends_confirmed[currentEnd - 1] === false;
        });

        // all users submitted response, one of them rejects
        if (allArchersSubmitted && someArchersReject) {
            await this.setState("submit");
            await this.resetEnd();
            return "reject";
        }

        // not all users have submitted their confirmation response for this end
        else {
            return "waiting";
        }
    }

    // PRIVATE UTILITIES

    private async nextEnd(execute: boolean=true) {
        if (execute) {
            this.transaction.json.NUMINCRBY(this.matchId, "$.current_end", 1);
            return await this.exec()
        } else {
            return this.transaction.json.NUMINCRBY(this.matchId, "$.current_end", 1);
        }
    }

    private async resetEnd() {
        const [currentEnd, arrowsPerEnd] = (await this.redisClient.json.GET(this.matchId, {
            path: ['$.["current_end", "arrows_per_end"]'],
        })) as [number, number];
        const participants = await this.getParticipants<"archer">() as UserSession<"archer">[];

        for (const participant of participants) {
            const sessionId = Match.createUserSessionId(participant.user_id);
            const numEndsDecided = participant.ends_confirmed.length;
            const numSubmittedArrows = participant.scores.length;

            // reset arrows
            if (numSubmittedArrows === Number(arrowsPerEnd)) {
                // first end
                await this.redisClient.json.SET(sessionId, "$.scores", []);
            } else if (numSubmittedArrows > Number(arrowsPerEnd)) {
                await this.redisClient.json.ARRTRIM(sessionId, "$.scores", 0, currentEnd * arrowsPerEnd - arrowsPerEnd - 1);
            }

            // reset confirmation
            if (numEndsDecided === 1) {
                // first end
                await this.redisClient.json.SET(sessionId, "$.ends_confirmed", []);
            } else if (numEndsDecided === Number(currentEnd)) {
                // remove the last one
                await this.redisClient.json.ARRTRIM(sessionId, "$.ends_confirmed", 0, currentEnd - 2);
            } // do nothing otherwise
        }
    }
}
