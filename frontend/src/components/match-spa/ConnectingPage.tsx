'use client'

import { Socket } from "socket.io-client";
import LoadingSpinner from "../svg-icons/LoadingSpinner";

export default function ConnectingPage ({ clientSocket }: { clientSocket: Socket }) {

    return (
        <>
            <div className="w-full h-fit my-auto flex flex-col items-center gap-4">
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