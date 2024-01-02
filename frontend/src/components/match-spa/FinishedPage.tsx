"use client";

import { FinishedPageProps } from "./MatchSPATypes";
import * as Tabs from "@radix-ui/react-tabs";
import styles from "./FinishedPage.module.scss";
import MatchResults from "./components/MatchResults/MatchResults";
import ClientButton from "../input/ClientButton";
import { useRouter } from "next/navigation";
import LoadingSpinner from "../svg-icons/LoadingSpinner";
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { MatchState, SocketIORedisMatchState } from "@/lib/types";

export default function FinishedPage({ socket, data }: FinishedPageProps) {
    const router = useRouter()
    const handleLeave = () => {
        socket.emit("user-leave", (reply: string) => {
            if (reply === "OK") {
                router.push('/user')
            } else {
                alert(reply)
            }
        })
    }
    const { current_state } = data

    return (
        <div className='w-full h-full flex flex-col gap-4'>
            <h1 className='font-extrabold'>Match Completed</h1>
            <SaveProgress currentState={current_state}/>
            <div className='w-full mt-[5dvh] h-[50dvh]'>
                <MatchResults data={data} />
            </div>
            <div className='w-full mt-auto'>
                <ClientButton onClickHandler={handleLeave}>
                    <p className='p-2 text-responsive__x-large font-semibold'>Leave Match</p>
                </ClientButton>
            </div>
        </div>
    );
}

export function SaveProgress ({ currentState }: { currentState: MatchState }) {

    if (currentState === "finished" || currentState === "reported") {
        return (
            <span className="flex items-center p-1 pe-3 w-fit gap-2 rounded-full font-medium bg-green-200 text-green-800">
                <div className="h-6 w-6">
                    <LoadingSpinner ringColor="text-green-400" highlightColor="fill-green-600"/>
                </div> 
                saving...
            </span>
        )
    } else if (currentState === "saved") {
        return (
            <span className="flex items-center py-1 px-3 w-fit gap-1 rounded-full font-medium bg-green-600 text-white">
                <div className="grid place-items-center h-6 w-6">
                    <DoneAllIcon />
                </div> 
                saved
            </span>
        )
    } else if (currentState === "save error") {
        return (
            <span className="flex items-center py-1 ps-1 pe-3 w-fit gap-1 rounded-full font-medium bg-red-600 text-white">
                <ErrorOutlineIcon />
                save error!
            </span>
        )
    }

}