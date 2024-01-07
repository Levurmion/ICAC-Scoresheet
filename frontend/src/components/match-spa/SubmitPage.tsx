"use client";

import { Score, UserSession } from "@/lib/types";
import { SubmitPageProps } from "./MatchSPATypes";
import { MouseEvent, useEffect, useRef, useState } from "react";
import { useUserContext } from "@/lib/contexts/ServerToClientUserContextProvider";
import { ArrowScore } from "./components/ArrowScore";
import BackspaceIcon from "@mui/icons-material/Backspace";
import { PanInfo, motion } from "framer-motion";
import LoadingSpinner from "../svg-icons/LoadingSpinner";
import { SubmitSlider } from "./components/SubmitSlider";

export default function SubmitPage({ socket, data, resubmit }: SubmitPageProps) {

    const userContext = useUserContext();
    const userId = userContext?.id as string;

    const scores: Score[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 10, "X"];
    const { submission_map } = data;
    const sessionsMap = Object.fromEntries(
        data.participants.map((participant) => {
            return [`match-session:${participant.user_id}`, participant];
        })
    );

    // get participant user is submitting for
    const userToSubmitForSessionId = submission_map?.[userId] as string;
    const userToSubmitFor = sessionsMap[userToSubmitForSessionId] as UserSession<"archer">;

    // get participant submitting for user
    const [userSubmitterId, _] = Object.entries(submission_map as {}).filter(([submitterId, sessionId]) => sessionId === `match-session:${userId}`)[0];
    const userSubmitter = sessionsMap[`match-session:${userSubmitterId}`];

    let endArrows: Score[] | undefined = undefined

    if (resubmit) {
        const { current_end, arrows_per_end } = data
        const endArrowStart = (current_end * arrows_per_end) - arrows_per_end
        const endArrowFinish = current_end * arrows_per_end
        endArrows = userToSubmitFor.scores.slice(endArrowStart, endArrowFinish).map(arrow => arrow.score)
    }

    const [arrows, setArrows] = useState(endArrows ?? new Array(Number(data.arrows_per_end)).fill(null));
    const [allowSubmit, setAllowSubmit] = useState(resubmit === true ? true : false)
    const [submitting, setSubmitting] = useState(false)

    const handleSetArrow = (score: Score) => {
        const numNullArrows = arrows.filter((score) => score === null).length

        // means the end will be full now
        if (numNullArrows === 1) {
            setAllowSubmit(true)
        }

        if (numNullArrows > 0) {
            setArrows((prevArrows) => {
                const newArrows = [...prevArrows];
                const firstNullIdx = newArrows.findIndex((arrow) => arrow === null);
                newArrows[firstNullIdx] = score;
                newArrows.sort((scoreA, scoreB) => {
                    if (scoreA > scoreB || scoreA === "X") {
                        return -1;
                    } else {
                        return 1;
                    }
                });
                return newArrows;
            });
        }
    };

    const handleDeleteArrow = (idx: number) => {
        if (!submitting) {
            setAllowSubmit(false)
            setArrows((prevArrows) => {
                const newArrows = [...prevArrows];
                newArrows[idx] = null;
                newArrows.sort((scoreA, scoreB) => {
                    if (scoreA === null) {
                        return 1;
                    } else if (scoreB === null) {
                        return -1;
                    } else if (scoreA > scoreB || scoreA === "X") {
                        return -1;
                    } else {
                        return 1;
                    }
                });
                return newArrows;
            });
        }
    };

    const handleSubmit = () => {
        setSubmitting(true)
        socket.emit("user-submit", arrows, (reply: string) => {
            if (reply !== "OK") {
                alert(reply)
            }
        })
    }

    return (
        <div className='w-full h-full flex flex-col items-center gap-8 justify-between'>
            <p className='text-responsive__large font-semibold w-full sm:w-[420px] py-2 px-4 text-center rounded-full bg-beige-200 text-beige-900'>
                You are being scored by{" "}
                <span className='font-extrabold text-beige-950'>
                    {userSubmitter?.first_name} {userSubmitter?.last_name}
                </span>
            </p>

            <section className='flex flex-col w-full'>
                <h1 className='font-extrabold'>
                    End {data.current_end}/{data.num_ends}
                </h1>
            </section>

            <section className='flex flex-col justify-center grow gap-4'>
                <div className='flex flex-col w-full'>
                    <p className='text-responsive__x-large font-semibold text-slate-700'>You are scoring for</p>
                    <h2 className='font-extrabold text-slate-900'>
                        {userToSubmitFor.first_name} {userToSubmitFor.last_name}
                    </h2>
                </div>
                <div className='flex flex-row w-full gap-4 justify-center flex-wrap'>
                    {arrows.map((score, idx) => {
                        const color = (() => {
                            if (score === "X" || score === 10 || score === 9) {
                                return "bg-yellow-400 text-black";
                            } else if (score === 8 || score === 7) {
                                return "bg-red-600 text-white";
                            } else if (score === 6 || score === 5) {
                                return "bg-blue-500 text-white";
                            } else if (score === 4 || score === 3) {
                                return "bg-white text-black";
                            } else if (score === 2 || score === 1) {
                                return "bg-black text-white";
                            } else if (score === 0) {
                                return "bg-gray-300";
                            } else if (score === null) {
                                return "bg-gray-300";
                            }
                        })();

                        return (
                            <div key={`${idx}-${score}`} className='relative block w-fit h-24 drop-shadow-md'>
                                {score !== null ? (
                                    <button
                                        onClick={() => {
                                            handleDeleteArrow(idx);
                                        }}
                                        className={`absolute grid place-items-center h-7 w-7 right-0 text-base ${color} rounded-full`}>
                                        <BackspaceIcon fontSize='inherit' />
                                    </button>
                                ) : undefined}
                                <div className={`text-4xl h-20 w-fit`}>
                                    <ArrowScore score={score} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className='flex flex-col w-full gap-4'>
                <div className='grid grid-cols-3 grid-rows-4 w-full gap-1 place-items-center'>
                    {scores.map((score) => (
                        <ArrowNumkey
                            key={score}
                            score={score}
                            onClickCb={() => {
                                handleSetArrow(score);
                            }}
                        />
                    ))}
                </div>
                <SubmitSlider allowSubmit={allowSubmit} notifySubmit={handleSubmit} beforeSubmitText="Slide to Submit" afterSubmitText="Waiting for Others..." />
            </section>
        </div>
    );
}

export function ArrowNumkey({ score, onClickCb }: { score: Score; onClickCb?: (e: MouseEvent<HTMLButtonElement>) => void }) {
    let color: string = "";

    if (score === "X" || score === 10 || score === 9) {
        color = "bg-yellow-400 text-black";
    } else if (score === 8 || score === 7) {
        color = "bg-red-600 text-white";
    } else if (score === 6 || score === 5) {
        color = "bg-blue-500 text-white";
    } else if (score === 4 || score === 3) {
        color = "bg-white text-black";
    } else if (score === 2 || score === 1) {
        color = "bg-black text-white";
    } else if (score === 0) {
        color = "bg-gray-300 text-black";
    } else if (score === null) {
        color = "bg-gray-300 text-slate-700";
    }

    return (
        <button onClick={onClickCb} className={`w-full text-responsive__x-large font-semibold aspect-[5/2] rounded-md shadow-sm ${color}`}>
            {score === 0 ? "M" : score}
        </button>
    );
}