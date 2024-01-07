"use client";

import { Arrow, SocketIORedisMatchState, UserSession } from "@/lib/types";
import * as Tabs from "@radix-ui/react-tabs";
import styles from "./MatchResults.module.scss";
import ArrowScore from "../ArrowScore";

function splitScoresIntoEnds(scores: Arrow[], arrowsPerEnd: number) {
    let ends: Arrow[][] = [];

    for (let i = 0; i < scores.length; i += arrowsPerEnd) {
        let end = scores.slice(i, i + arrowsPerEnd);
        ends.push(end);
    }

    return ends;
}

export default function MatchResults({ data }: { data: SocketIORedisMatchState }) {
    const archers = data.participants.filter((participant) => participant.role === "archer") as UserSession<"archer">[];
    const { arrows_per_end, num_ends } = data;

    return (
        <Tabs.Root className={styles.TabsRoot} defaultValue={archers[0].user_id}>
            <Tabs.List className={`${styles.TabsList} no-scrollbar`}>
                {archers.map((archer) => {
                    return (
                        <Tabs.Trigger key={archer.user_id} value={archer.user_id} className={styles.TabsTrigger}>
                            {archer.first_name} {archer.last_name}
                        </Tabs.Trigger>
                    );
                })}
            </Tabs.List>
            {archers.map((archer) => {
                const scores = archer.scores;
                const ends = splitScoresIntoEnds(scores, arrows_per_end);
                let runningTotal = 0;
                let golds = 0;
                return (
                    <Tabs.Content asChild key={`content:${archer.user_id}`} value={archer.user_id} className={styles.TabsContent}>
                        <>
                            <section className={`${styles.TabsContent} no-scrollbar`}>
                                <div className="flex w-full h-fit">
                                    <table className={styles.Scoresheet}>
                                        <thead>
                                            <tr>
                                                <th>End</th>
                                                <th>Scores</th>
                                                <th>ET</th>
                                                <th>RT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ends?.map((end, endIdx) => {
                                                const endTotal = end.reduce((prevScore, currArrow) => prevScore + (currArrow.score === "X" ? 10 : currArrow.score), 0);
                                                runningTotal += endTotal;
                                                return (
                                                    <tr key={`${archer.user_id}-${endIdx}`} className='w-full'>
                                                        <td>{endIdx + 1}</td>
                                                        <td className='w-fit grid grid-cols-3 grid-flow-row place-items-center mx-auto gap-1'>
                                                            {end.map((score, arrIdx) => {
                                                                if (score.score === "X" || score.score === 10) {
                                                                    golds += 1;
                                                                }
                                                                return (
                                                                    <div key={`${archer.user_id}-${endIdx}-${arrIdx}`} className='h-8 drop-shadow-md'>
                                                                        <ArrowScore score={score} />
                                                                    </div>
                                                                );
                                                            })}
                                                        </td>
                                                        <td>{endTotal}</td>
                                                        <td>{runningTotal}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className='flex w-full shrink-0 justify-center gap-4'>
                                    <p>
                                        <span className='font-bold'>Total Score:</span> {runningTotal}
                                    </p>
                                    <p>
                                        <span className="font-bold">Golds:</span> {golds}
                                    </p>
                                </div>
                            </section>
                            <div className="bg-white w-full h-2">

                            </div>
                        </>
                    </Tabs.Content>
                );
            })}
        </Tabs.Root>
    );
}
