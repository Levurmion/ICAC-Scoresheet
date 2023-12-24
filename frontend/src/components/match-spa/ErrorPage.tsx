'use client'

import { Socket } from "socket.io-client"
import { MatchSPAErrorProps } from "./depracated/MatchSPAControllerTypes"

interface ErrorPageProps extends MatchSPAErrorProps {
    clientSocket: Socket
}

export default function ErrorPage ({ clientSocket, errorMessage }: ErrorPageProps) {

    return (
        <>
            <h1 className="font-extrabold">
                Connection Error!
            </h1>
            <p className="text-responsive__large font-medium text-red-600">
                {errorMessage}
            </p>
        </>
    )
}