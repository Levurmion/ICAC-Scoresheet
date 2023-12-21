"use client";

import useSWR from "swr";
import axios from "axios";
import { LiveMatchRedisType, MatchState } from "@/lib/types";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { CardAction, MatchCard } from "./MatchCard";
import LoadingSpinner from "../svg-icons/LoadingSpinner";
import { AnimatePresence, motion } from "framer-motion";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { useEffect, useState } from "react";

export default function HostedMatchList() {
    const { data, isLoading, error, mutate } = useSWR("/api/matches/live/*?host_only=true", async (url) => {
        const res = await fetch(url, { cache: "no-store", method: "get" });
        if (res.status === 200) {
            return await res.json();
        } else if (res.status === 204) {
            return [];
        }
    }, {
        refreshInterval: 2000
    });

    const [requestDeleteMatch, setRequestDeleteMatch] = useState<Array<boolean | "in progress">>([]);

    useEffect(() => {
        if (data) {
            setRequestDeleteMatch(new Array(data.length).fill(false))
        } else {
            setRequestDeleteMatch([])
        }
    }, [data])

    const handleDelete = async (matchId: string) => {
        try {
            const deleteMatchRes = await axios.delete(`/api/matches/${matchId}`);
            if (deleteMatchRes.status === 200) {
                mutate();
            }
        } catch (err) {
            alert(err);
        }
    };

    const renderDeleteButton = (matchIdx: number) => {
        switch (requestDeleteMatch[matchIdx]) {
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

    const handleRequestDelete = (matchIdx: number) => {
        setRequestDeleteMatch((matchDeleteStates) => {
            const newMatchDeleteStates = [...matchDeleteStates];

            if (!newMatchDeleteStates[matchIdx]) {
                newMatchDeleteStates[matchIdx] = true;
            } else if (newMatchDeleteStates[matchIdx] === true) {
                newMatchDeleteStates[matchIdx] = "in progress";
                handleDelete(data[matchIdx].id);
            }

            return newMatchDeleteStates;
        });
    };

    const handleBlur = (matchIdx: number) => {
        setRequestDeleteMatch((matchDeleteStates) => {
            const newMatchDeleteStates = [...matchDeleteStates];
            newMatchDeleteStates[matchIdx] = false;
            return newMatchDeleteStates;
        });
    };

    const renderHostedMatches = () => {
        if (isLoading) {
            return (
                <div className='grid place-items-center w-full h-full'>
                    <div className='h-10 w-10 opacity-50'>
                        <LoadingSpinner />
                    </div>
                </div>
            );
        } else if (data) {
            if (data.length <= 0) {
                return (
                    <div className='grid place-items-center p-4 w-full text-beige-900 font-semibold text-center text-responsive__medium h-full'>
                        you currently have no hosted live matches
                    </div>
                );
            } else if (data.length > 0) {
                return (
                    <motion.ul className='flex flex-col w-full h-fit' layout>
                        <AnimatePresence>
                            {data.map((match: LiveMatchRedisType, idx: number) => {
                                return (
                                    <MatchCard key={match.id} match={match}>
                                        <CardAction>
                                            <button
                                                className='w-full h-full grid place-items-center bg-beige-900 text-white text-responsive__small'
                                                onClick={() => {
                                                    handleRequestDelete(idx);
                                                }}
                                                onBlur={() => {
                                                    handleBlur(idx);
                                                }}
                                                tabIndex={0}>
                                                {renderDeleteButton(idx)}
                                            </button>
                                        </CardAction>
                                    </MatchCard>
                                );
                            })}
                        </AnimatePresence>
                    </motion.ul>
                );
            }
        } else if (error) {
            return (
                <div className='grid place-items-center p-4 w-full text-beige-900 font-semibold text-center text-responsive__medium h-full'>Server Error!</div>
            );
        }
    };

    return (
        <ScrollArea.Root className='w-full h-full grow basis-0 bg-beige-100 border border-beige-950 rounded-md overflow-y-scroll shadow-md'>
            <ScrollArea.Viewport asChild className='w-full h-full'>
                {renderHostedMatches()}
            </ScrollArea.Viewport>
        </ScrollArea.Root>
    );
}