'use client'

import { LobbyUserDetails, MatchSPALobbyProps } from "./MatchSPAControllerTypes";
import ClientButton from "../input/ClientButton";
import { useOptimistic } from "react";
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { Socket } from "socket.io-client";
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { motion } from "framer-motion";
import { useUserContext } from "@/lib/contexts/ServerToClientUserContextProvider";

interface LobbyPageProps extends MatchSPALobbyProps {
    clientSocket: Socket
}

export default function LobbyPage ({ clientSocket, isOpen, registeredUsers }: LobbyPageProps ) {

    const [optimisticUserDetails, setOptimisticUserDetails] = useOptimistic(registeredUsers)
    const user = useUserContext()
    const userId = user?.id

    const handleReady = () => {
        console.log('readying...')
        clientSocket.emit('client:lobby-ready')
    }

    const handleUnready = () => {
        console.log('undreadying...')
        clientSocket.emit('client:lobby-unready')
    }

    return (
        <>
            <section className="flex flex-col w-full h-[55dvh] gap-2">
                <h2 className="font-semibold text-beige-950">Match Lobby</h2>
                <ScrollArea.Root className='w-full h-full grow basis-0 bg-beige-100 border border-beige-950 rounded-md overflow-y-scroll shadow-md'>
                    <ScrollArea.Viewport asChild className="w-full h-full">
                        {
                            registeredUsers?.map(user => {
                                return <RegisteredUser key={user.id} {...user} isCurrentUser={userId === user.id} />
                            })
                        }
                    </ScrollArea.Viewport>
                </ScrollArea.Root>
                <div className="flex flex-row w-full h-fit gap-2">
                    <ClientButton onClickHandler={handleUnready}>
                        <span className="block text-responsive__large p-2 font-semibold">Unready</span>
                    </ClientButton>
                    <ClientButton onClickHandler={handleReady}>
                        <span className="block text-responsive__large p-2 font-semibold">Ready</span>
                    </ClientButton>
                </div>
            </section>
        </>
    )
}

interface RegisteredUserProps extends LobbyUserDetails {
    isCurrentUser: boolean
}

export function RegisteredUser ({ first_name, last_name, university, ready, connected, isCurrentUser }: RegisteredUserProps) {

    return (
        <div className={`relative flex w-full h-fit py-1.5 px-2 justify-between items-center ${connected ? "" : "bg-slate-400"}`}>
            <div className="flex flex-col h-fit">
                <p className="text-responsive__xx-large font-semibold -mb-0.5">{isCurrentUser && <span>	&#128073;</span>} {first_name} {last_name}</p>
                <p className="text-responsive__medium italic text-beige-800">{university ?? "unaffiliated"}</p>
            </div>
            <div className="absolute right-0 h-full aspect-square grid place-items-center text-responsive__xxx-large">
                {
                    ready ? (
                        <motion.div key="readyIcon" initial={{opacity: 0.2}} animate={{opacity:1}} className="text-green-700">
                            <TaskAltIcon fontSize="inherit" />
                        </motion.div>
                    ) : (
                        <motion.div key="unreadyIcon" initial={{opacity: 0.2}} animate={{opacity:1}} className="text-red-700">
                            <RadioButtonUncheckedIcon fontSize="inherit" />
                        </motion.div>
                    )
                }
            </div>
        </div>
    )
}