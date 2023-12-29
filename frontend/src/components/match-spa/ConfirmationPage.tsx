"use client";

import { useUserContext } from "@/lib/contexts/ServerToClientUserContextProvider";
import { ConfirmationPageProps } from "./MatchSPATypes";
import { ArrowScore } from "./components/ArrowScore";
import { SubmitSlider } from "./components/SubmitSlider";
import { UserSession } from "@/lib/types";
import VerifiedIcon from "@mui/icons-material/Verified";
import DoNotDisturbAltOutlinedIcon from "@mui/icons-material/DoNotDisturbAltOutlined";
import PendingIcon from "@mui/icons-material/Pending";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import ClientButton from "../input/ClientButton";

export default function ConfirmationPage({ socket, data }: ConfirmationPageProps) {
    const { current_end, arrows_per_end } = data;
    const archers = data.participants.filter(
        (participant) => participant.scores !== undefined && participant.ends_confirmed !== undefined
    ) as UserSession<"archer">[];
    const userContext = useUserContext();
    const userId = userContext?.id;

    const handleConfirm = () => {
        socket.emit("user-confirm", (reply: string) => {
            console.log(reply);
        });
    };

    const handleReject = () => {
        socket.emit("user-reject", (reply: string) => {
            console.log(reply);
        });
    };

    return (
        <div className='w-full h-full flex flex-col gap-4'>
            <div className='w-full flex flex-col'>
                <h1 className='font-extrabold'>Confirm End {current_end}</h1>
                <p className='text-responsive__x-large'>If any of the participants rejects, the match will be asked to resubmit the current end.</p>
            </div>

            <section className='flex flex-col w-full gap-6 justify-center grow'>
                <ul className='flex flex-col py-1 gap-4'>
                    {archers.map((archer, idx) => (
                        <EndTotal
                            key={archer.user_id}
                            archer={archer}
                            currentEnd={current_end}
                            arrowsPerEnd={arrows_per_end}
                            isUser={archer.user_id === userId}
                        />
                    ))}
                </ul>
            </section>

            <section className='flex flex-row w-full gap-2'>
                <ClientButton onClickHandler={handleReject}>
                    <p className='flex text-responsive__xx-large font-semibold p-2 items-center justify-center gap-2'>
                        <DoNotDisturbAltOutlinedIcon fontSize='inherit' /> Reject
                    </p>
                </ClientButton>
                <ClientButton onClickHandler={handleConfirm}>
                    <p className='flex text-responsive__xx-large font-semibold p-2 items-center justify-center gap-2'>
                        <VerifiedIcon fontSize="inherit" /> Accept
                    </p>
                </ClientButton>
            </section>
        </div>
    );
}

export function EndTotal({
    archer,
    currentEnd,
    arrowsPerEnd,
    isUser,
}: {
    archer: UserSession<"archer">;
    currentEnd: number;
    arrowsPerEnd: number;
    isUser: boolean;
}) {
    const endArrowStart = currentEnd * arrowsPerEnd - arrowsPerEnd;
    const endArrowFinish = currentEnd * arrowsPerEnd;
    const endArrows = archer.scores.slice(endArrowStart, endArrowFinish);
    const runningTotal = archer.scores.reduce((prevScore, currScore) => prevScore + (currScore.score === "X" ? 10 : currScore.score), 0);
    const endTotal = endArrows.reduce((prevScore, currScore) => prevScore + (currScore.score === "X" ? 10 : currScore.score), 0);
    const endConfirmed = archer.ends_confirmed[currentEnd - 1];

    return (
        <li key={`${archer.user_id}-${endConfirmed}`} className='flex flex-row w-full h-fit items-center justify-between'>
            <div className='flex flex-col h-fit py-1 gap-1'>
                <div className='flex flex-col'>
                    <div className='flex text-responsive__xxx-large font-bold items-center'>
                        {endConfirmed === true ? (
                            <span className='text-green-700 pe-2 drop-shadow-sm flex'>
                                <VerifiedIcon fontSize='inherit' />
                            </span>
                        ) : endConfirmed === false ? (
                            <span className='text-red-600 pe-2 drop-shadow-sm flex'>
                                <DoNotDisturbAltOutlinedIcon fontSize='inherit' />
                            </span>
                        ) : null}
                        {archer.first_name} {archer.last_name}
                    </div>
                </div>
                <div className='flex flex-row w-full gap-2'>
                    {endArrows.map((score, arrowIdx) => {
                        return (
                            <div key={`arrow:${archer.user_id}-${arrowIdx}-${score.score}`} className='h-14 w-fit text-2xl drop-shadow-sm'>
                                <ArrowScore score={score} />
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className='ms-auto flex flex-col justify-end h-full'>
                <div className='text-2xl grid place-items-center h-16 aspect-square font-bold'>{endTotal}</div>
            </div>
        </li>
    );
}