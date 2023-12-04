"use client";

import useSWR, { useSWRConfig } from "swr";
import axios from "axios";
import { LiveMatchRedisType, MatchState } from "@/lib/types";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { useEffect, useRef, useState } from "react";
import LoadingSpinner from "../svg-icons/LoadingSpinner";
import { AnimatePresence, motion } from "framer-motion";

export default function HostedMatchList() {
    const { data, isLoading, error, mutate } = useSWR("/api/matches/live/*?host_only=true", async (url) => {
        const res = await fetch(url, {cache: 'no-store', method: 'get'})
        if (res.status === 200) {
            return await res.json()
        } else if (res.status === 204) {
            return []
        }
    });

    const handleRequestDelete = async (matchId: string) => {
        try {
            const deleteMatchRes = await axios.delete(`/api/matches/${matchId}`);
            if (deleteMatchRes.status === 200) {
                mutate()
            }
        } catch (err) {
            alert(err);
        }
    };

    const renderHostedMatches = () => {
        console.log(data)
        if (isLoading) {
            return (
                <div className='grid place-items-center w-full h-full'>
                    <div className='h-10 w-10 opacity-50'>
                        <LoadingSpinner />
                    </div>
                </div>
            );
        } else if (data) {
            console.log(data)
            if (data.length <= 0) {
                return (
                    <div className='grid place-items-center p-4 w-full text-beige-100 font-semibold text-center text-responsive__medium h-full'>
                        you currently have no hosted live matches
                    </div>
                );
            } else if (data.length > 0) {
                return (
                    <motion.ul className='flex flex-col w-full h-fit' layout>
                        <AnimatePresence>
                            {data.map((match: LiveMatchRedisType) => {
                                return <HostedMatchCard key={match.id} match={match} requestDeleteCb={handleRequestDelete} />;
                            })}
                        </AnimatePresence>
                    </motion.ul>
                );
            }
        } else if (error) {
            return (
                <div className='grid place-items-center p-4 w-full text-beige-100 font-semibold text-center text-responsive__medium h-full'>Server Error!</div>
            );
        }
    };

    return (
        <ScrollArea.Root className='w-full h-full bg-beige-950 rounded-md overflow-y-scroll shadow-md'>
            <ScrollArea.Viewport asChild className='w-full h-full'>
                {renderHostedMatches()}
            </ScrollArea.Viewport>
        </ScrollArea.Root>
    );
}

interface HostedMatchCardProps {
    match: LiveMatchRedisType;
    requestDeleteCb: (matchId: string) => void;
}

export function HostedMatchCard({ match, requestDeleteCb }: HostedMatchCardProps) {
    const [requestDelete, setRequestDelete] = useState<boolean | "in progress">(false);
    const cardRef = useRef<HTMLLIElement>(null);
    const matchInfo = match.value;

    const handleBlur = () => {
        setRequestDelete(false);
    };

    const handleRequestDelete = () => {
        if (!requestDelete) {
            setRequestDelete(true);
        } else {
            requestDeleteCb(match.id);
            setRequestDelete("in progress");
        }
    };

    const renderDeleteButton = () => {
        switch (requestDelete) {
            case "in progress":
                return (
                    <div className='h-8 w-8 opacity-70'>
                        <LoadingSpinner />
                    </div>
                );
            case true:
                return <div className='font-semibold'>tap to confirm</div>;
            case false:
                return (
                    <div className='text-[200%]'>
                        <DeleteForeverIcon fontSize='inherit' />
                    </div>
                );
        }
    };

    return (
        <motion.li
            initial={false}
            animate={false}
            exit={{ opacity: [1, 0, 0], height: 0, paddingBlock: 0 }}
            ref={cardRef}
            value={match.id}
            className='relative w-full flex flex-col text-white py-2 px-3 border-b-[0.1rem] border-beige-900'>
            <div className='w-full flex items-center gap-2 text-responsive__medium pb-1'>
                <MatchStateBadge matchState={matchInfo.current_state} />
                <h3 className='font-semibold'>{matchInfo.name}</h3>
            </div>
            <div className='w-full flex gap-2 text-beige-200 text-responsive__small'>
                <span className='font-bold'>
                    {Object.keys(matchInfo.participants).length}/{matchInfo.max_participants}
                </span>
                <span className='font-bold'>{matchInfo.round ?? "-"}</span>
                <span>{new Date(matchInfo.created_at).toDateString()}</span>
            </div>
            <button
                className='absolute grid place-items-center right-0 top-0 bg-red-700 opacity-80 text-white text-responsive__small h-full aspect-square'
                onClick={handleRequestDelete}
                tabIndex={0}
                onBlur={handleBlur}>
                {renderDeleteButton()}
            </button>
        </motion.li>
    );
}

export function MatchStateBadge({ matchState }: { matchState: MatchState }) {
    switch (matchState) {
        case "open":
            return <span className='px-[0.75ex] align-middle rounded-full bg-green-400 text-green-800 opacity-85 text-[80%] font-semibold'>OPEN</span>;
        case "full":
            return <span className='px-[0.75ex] align-middle rounded-full bg-yellow-400 text-yellow-800 opacity-85 text-[80%] font-semibold'>FULL</span>;
        case "finished":
            return <span className='px-[0.75ex] align-middle rounded-full bg-red-400 text-red-800 opacity-85 text-[80%] font-semibold'>FINISHED</span>;
        case "paused":
            return <span className='px-[0.75ex] align-middle rounded-full bg-purple-400 text-purple-800 opacity-85 text-[80%] font-semibold'>PAUSED</span>;
        default:
            return (
                <span className='px-[0.75ex] align-middle rounded-full bg-sky-400 text-sky-800 opacity-85 text-[80%] font-semibold'>
                    {matchState.toUpperCase()}
                </span>
            );
    }
}
