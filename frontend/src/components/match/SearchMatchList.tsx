"use client";

import { ChangeEvent, useState, useRef, useEffect } from "react";
import ClientInput from "../input/ClientInput";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import ClientButton from "../input/ClientButton";
import useSWR from "swr";
import { LiveMatchRedisType } from "@/lib/types";
import { CardAction, MatchCard } from "./MatchCard";
import LoadingSpinner from "../svg-icons/LoadingSpinner";
import RadioButtonUncheckedOutlinedIcon from "@mui/icons-material/RadioButtonUncheckedOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function SearchMatchList() {
    const [matchName, setMatchName] = useState<string>("");
    const [selectedMatchIdx, setSelectedMatchIdx] = useState<number | null>(null);
    const [requestingJoin, setRequestingJoin] = useState<boolean | 'success' | 'failed'>(false)
    const prevChangeInputValue = useRef<any>(null);
    const router = useRouter()

    const { data, isLoading, error, mutate } = useSWR(`/api/matches/live/${matchName}?state=open`, async (url) => {
        if (matchName.length >= 1) {
            const openMatches = await fetch(url, { method: "get", cache: "no-store" });

            if (openMatches.status === 200) {
                return (await openMatches.json()) as LiveMatchRedisType[];
            } else if (openMatches.status === 204) {
                return [] as LiveMatchRedisType[];
            }
        } else {
            return [] as LiveMatchRedisType[];
        }
    }, {
        refreshInterval: 2000
    });

    // event handlers
    const handleRequestJoinMatch = async () => {
        if (selectedMatchIdx !== null) {
            const selectedMatch = data?.[selectedMatchIdx]
            const matchIdToJoin = selectedMatch?.id
            setRequestingJoin(true)
            try {
                const joinMatchRes = await axios.post(`/api/matches/${matchIdToJoin}/reserve`, null, {
                    validateStatus: status => status < 500
                })
                
                if (joinMatchRes.status === 200) {
                    setRequestingJoin('success')
                    setTimeout(() => {
                        router.push("/user/match/live/")
                    }, 1000)
                } else if (joinMatchRes.status === 403) {
                    alert(joinMatchRes.data)
                    setRequestingJoin('failed')
                }
            } catch (err) {
                alert(err)
            }
        }
    }

    const handleMatchSelectionChange = (idx: number) => {
        setRequestingJoin(false)
        setSelectedMatchIdx(idx)
    }

    const handleReboundInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        clearTimeout(prevChangeInputValue.current);
        prevChangeInputValue.current = setTimeout(() => {
            setMatchName(e.target.value);
        }, 500);
    };

    // conditional renders
    const renderJoinMatchButton = () => {
        switch(requestingJoin) {
            case false:
                return 'Join Selected Match'
            case true:
                return (
                    <span className="w-full h-full flex justify-center items-center gap-2">
                        <div className="h-6 w-6">
                            <LoadingSpinner />
                        </div>
                        Reserving Match
                    </span>
                )
            case 'success':
                return 'Match Reserved!'
            case 'failed':
                return 'Cannot Reserve Match'
        }
    }

    const renderRetrievedMatches = () => {
        if (matchName.length < 1) {
            return (
                <div className='grid place-items-center p-4 w-full text-beige-900 font-semibold text-center text-responsive__medium h-full'>
                    search for an existing open match to join
                </div>
            );
        } else if (isLoading) {
            return (
                <div className='grid place-items-center w-full h-full'>
                    <div className='h-10 w-10 opacity-50'>
                        <LoadingSpinner />
                    </div>
                </div>
            );
        } else if (data) {
            if (data.length === 0) {
                return (
                    <div className='grid place-items-center p-4 w-full text-beige-900 font-semibold text-center text-responsive__medium h-full'>
                        no match found with the queried name
                    </div>
                );
            } else if (data.length >= 1) {
                return data?.map((match: LiveMatchRedisType, idx: number) => {
                    return (
                        <MatchCard key={match.id} match={match} selected={idx === selectedMatchIdx}>
                            <CardAction>
                                <button
                                    className={`grid place-items-center w-full h-full text-responsive__x-large ${
                                        selectedMatchIdx === idx ? "text-white" : "text-beige-900"
                                    }`}
                                    onClick={() => {handleMatchSelectionChange(idx)}}>
                                    {selectedMatchIdx === idx ? (
                                        <CheckCircleOutlineOutlinedIcon fontSize='inherit' />
                                    ) : (
                                        <RadioButtonUncheckedOutlinedIcon fontSize='inherit' />
                                    )}
                                </button>
                            </CardAction>
                        </MatchCard>
                    );
                });
            }
        } else if (error) {
            return (
                <div className='grid place-items-center p-4 w-full text-beige-900 font-semibold text-center text-responsive__medium h-full'>Server Error!</div>
            );
        }
    };

    // useEffects
    useEffect(() => {
        setSelectedMatchIdx(null);
    }, [data]);

    return (
        <div className='flex flex-col h-[70dvh] gap-2 w-full mt-auto'>
            <div className='flex flex-col gap-1'>
                <h2 className='font-semibold text-black'>Search by Match Name</h2>
                <ClientInput type='text' placeholder='match name' onChangeCb={handleReboundInputChange} />
            </div>

            <ScrollArea.Root className='w-full h-full bg-white rounded-md overflow-y-scroll shadow-md'>
                <ScrollArea.Viewport asChild className='w-full h-full'>
                    {renderRetrievedMatches()}
                </ScrollArea.Viewport>
            </ScrollArea.Root>

            <ClientButton onClickHandler={handleRequestJoinMatch}>
                <span className='block text-responsive__large p-2 w-full font-semibold'>
                    {renderJoinMatchButton()}
                </span>
            </ClientButton>
        </div>
    );
}
