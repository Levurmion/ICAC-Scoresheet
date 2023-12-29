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

export default function FinishedPage({ socket, data, saveProgress }: FinishedPageProps) {
    const router = useRouter()
    const handleLeave = () => {
        socket.emit("user-leave", (reply: string) => {
            if (reply === "OK") router.back()
        })
    }

    return (
        <div className='w-full h-full flex flex-col gap-4'>
            <h1 className='font-extrabold'>Match Completed</h1>
            {
                saveProgress === "pending" ? (
                    <span className="flex items-center p-1 pe-3 w-fit gap-2 rounded-full font-medium bg-green-200 text-green-800">
                        <div className="h-6 w-6">
                            <LoadingSpinner ringColor="text-green-400" highlightColor="fill-green-600"/>
                        </div> 
                        saving...
                    </span>
                ) : saveProgress === "OK" ? (
                    <span className="flex items-center py-1 px-3 w-fit gap-1 rounded-full font-medium bg-green-600 text-white">
                        <div className="grid place-items-center h-6 w-6">
                            <DoneAllIcon />
                        </div> 
                        saved
                    </span>
                ) : (
                    <span className="flex items-center py-1 ps-1 pe-3 w-fit gap-1 rounded-full font-medium bg-red-600 text-white">
                        <ErrorOutlineIcon />
                        {saveProgress}
                    </span>
                )
            }
            <div className='w-full mt-[5dvh]'>
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
