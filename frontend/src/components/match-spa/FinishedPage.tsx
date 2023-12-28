"use client";

import { FinishedPageProps } from "./MatchSPATypes";
import * as Tabs from "@radix-ui/react-tabs";
import styles from "./FinishedPage.module.scss";
import MatchResults from "./components/MatchResults/MatchResults";
import ClientButton from "../input/ClientButton";
import { useRouter } from "next/navigation";

export default function FinishedPage({ socket, data, saveProgress }: FinishedPageProps) {
    const router = useRouter()
    const isSaved = data.current_state === "saved";
    const handleLeave = () => {
        socket.emit("user-leave", (reply: string) => {
            if (reply === "OK") router.back()
        })
    }

    return (
        <div className='w-full h-full flex flex-col gap-2'>
            <h1 className='font-extrabold'>Match Completed</h1>
            <p>{saveProgress}</p>
            <div className='w-full mt-[5dvh]'>
                <MatchResults data={data} />
            </div>
            <div className='w-full'>
                <ClientButton onClickHandler={handleLeave}>
                    <p className='p-2 text-responsive__x-large font-semibold'>Leave Match</p>
                </ClientButton>
            </div>
        </div>
    );
}
