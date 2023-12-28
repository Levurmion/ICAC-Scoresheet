'use client'

import { MatchRole } from "@/lib/types";
import { LobbyPageProps } from "./MatchSPATypes";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SignalWifiStatusbarConnectedNoInternet4Icon from '@mui/icons-material/SignalWifiStatusbarConnectedNoInternet4';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ClientButton from "../input/ClientButton";
import { useEffect, useState, useRef } from "react";
import { useUserContext } from "@/lib/contexts/ServerToClientUserContextProvider";
import { useRouter } from "next/navigation";

export default function LobbyPage ({ socket, data }: LobbyPageProps) {

    const router = useRouter()
    const participantReadyStates = data.participants.map(participant => participant.ready)
    const userContext = useUserContext()
    const userIdx = useRef(data.participants.findIndex(participant => participant.user_id === userContext?.id))
    
    // SIMULATE OPTIMISTIC UPDATES
    const [optimisticReadyStates, setOptimisiticReadyStates] = useState(participantReadyStates)

    // synchronize state with prop change
    useEffect(() => {
        setOptimisiticReadyStates(data.participants.map(participant => participant.ready))
    }, [data])

    // EVENT HANDLERS
    const handleReady = () => {
        setOptimisiticReadyStates(prevReadyStates => {
            const newReadyStates = [...prevReadyStates]
            newReadyStates[userIdx.current] = true
            return newReadyStates
        })
        socket.emit("user-ready")
    }

    const handleUnready = () => {
        setOptimisiticReadyStates(prevReadyStates => {
            const newReadyStates = [...prevReadyStates]
            newReadyStates[userIdx.current] = false
            return newReadyStates
        })
        socket.emit("user-unready")
    }

    const handleLeaveMatch = () => {
        socket.emit("user-leave", (reply) => {
            if (reply === "OK") router.back()
        })
    }

    return (
        <div className="w-full h-full flex flex-col gap-14">
            <div className="w-full flex flex-col gap-1">
                <h1 className="font-extrabold">Match Lobby</h1>
                <div className="">
                    <p className="text-responsive__xx-large font-bold">
                        {data.name}
                    </p>
                    <p className="-mt-1 text-responsive__x-large font-medium text-beige-950">
                        {data.round !== undefined ? <span>{`${data.round}`}</span> : ""} &bull; {data.num_ends} ends of {data.arrows_per_end} arrows
                    </p>
                </div>
            </div>

            <div className="w-full flex flex-col gap-4">
                <h2 className="font-bold">Participants ({data.participants.length}/{data.max_participants})</h2>
                <ul className="w-full h-fit rounded-md">
                    {
                        data.participants.map((participant, idx) => {
                            const readyState = optimisticReadyStates[idx]
                            const { user_id } = participant
                            return <Participant key={user_id} {...participant} ready={readyState} isUser={user_id === userContext?.id}/>
                        })
                    }
                </ul>
                <div className="w-full flex gap-2">
                    <ClientButton onClickHandler={handleUnready}>
                        <p className="p-2 font-semibold">Unready</p>
                    </ClientButton>
                    <ClientButton onClickHandler={handleReady}>
                        <p className="p-2 font-semibold">Ready</p>
                    </ClientButton>
                </div>
            </div>
            
            <div className="w-full h-fit mt-auto">
                <ClientButton onClickHandler={handleLeaveMatch}>
                    <p className="p-2 font-semibold">Leave Match</p>
                </ClientButton>
            </div>
        </div>
    )
}

export interface ParticipantProps {
    user_id: string;
    first_name: string;
    last_name: string;
    university: string;
    ready: boolean;
    connected: boolean;
    role: MatchRole;
    isUser?: boolean;
}

export function Participant ({ user_id, first_name, last_name, university, ready, connected, role, isUser }: ParticipantProps) {

    const roleEmoji = role === "archer" ? <span>&#127993;</span> : <span>&#128203;</span>

    return (
        <li id={user_id} className="w-full h-fit flex items-center px-2 py-1 rounded-sm">
            {   
                isUser ? (
                    <div className="h-fit pe-3 text-responsive__xx-large">
                        &#128073;
                    </div>
                ) : connected ? (
                    <div className="h-fit pe-3 text-green-600 text-responsive__xx-large">
                        <CheckCircleIcon fontSize="inherit"/>
                    </div>
                ) : (
                    <div className="h-fit pe-3 text-red-700 text-responsive__xx-large animate-pulse">
                        <SignalWifiStatusbarConnectedNoInternet4Icon fontSize="inherit"/>
                    </div>
                )
            }
            <div className="flex-col grow">
                <p className="text-responsive__xx-large font-semibold text-beige-950">{roleEmoji} {first_name} {last_name}</p>
                <p className="text-responsive__medium -mt-1 italic text-beige-900">{university ?? "unaffiliated"}</p>
            </div>
            {
                ready ? (
                    <div className="h-fit pe-3 text-green-600 text-responsive__xx-large">
                        <ThumbUpIcon fontSize="inherit"/>
                    </div>
                ) : (
                    <div className="h-fit pe-3 text-beige-950 text-responsive__xx-large">
                        <ThumbDownIcon fontSize="inherit"/>
                    </div>
                )
            }
        </li>
    )
}