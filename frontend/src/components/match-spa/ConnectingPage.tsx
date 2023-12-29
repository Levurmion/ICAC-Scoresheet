'use client'

import { Socket } from "socket.io-client";
import LoadingSpinner from "../svg-icons/LoadingSpinner";
import { ConnectingPageProps } from "./MatchSPATypes";

export default function ConnectingPage ({ socket }: ConnectingPageProps) {

    return (
        <>
            <div className="w-full h-full my-auto flex flex-col items-center justify-center gap-4">
                <div className="h-16 w-16 opacity-80">
                    <LoadingSpinner />
                </div>
                <p className="text-responsive__large font-medium text-beige-950">
                    connecting to the match server...
                </p>
            </div>
        </>
    )
}