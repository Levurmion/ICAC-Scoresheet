"use client"

import { PausedModalProps } from "./MatchSPATypes";

export default function PausedModal ({ socket, data }: PausedModalProps) {

    if (data) {
        return (
            <dialog className="fixed flex flex-col p-4 w-[80%] h-[80%] left-[50%] top-[50%] -translate-x-[50%] -translate-y-[50%] rounded-lg">
                <h1 className="font-extrabold">Match Paused</h1>
            </dialog>
        )
    } else {
        return <></>
    }
}