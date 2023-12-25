'use client'

import { Socket } from "socket.io-client"
import { ErrorPageProps } from "./MatchSPATypes"


export default function ErrorPage ({ socket, error }: ErrorPageProps) {

    return (
        <>
            <h1 className="font-extrabold">
                Connection Error!
            </h1>
            <p className="text-responsive__large font-medium text-red-600">
                {error}
            </p>
        </>
    )
}