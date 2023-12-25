'use client'

import { useEffect, useState } from "react"
import clientSocket from "@/lib/clientSocket"
import { SocketIORedisMatchState } from "@/lib/types"
import { MatchSPAControllerStates, MatchSPAPagesWithData } from "./MatchSPATypes"
import ConnectingPage from "./ConnectingPage"
import ErrorPage from "./ErrorPage"
import LobbyPage from "./LobbyPage"
import SubmitPage from "./SubmitPage"
import PausedModal from "./PausedModal"

export default function MatchSPAController () {
    const [ pageState, setPageState ] = useState<MatchSPAControllerStates>({
        page: "connecting",
        data: null
    })
    const [ error, setError ] = useState<string | null>(null)
    const [ paused, setPaused ] = useState<SocketIORedisMatchState | null>(null)

    function renderMatchSPA () {
        if (error) {
            return <ErrorPage socket={clientSocket} error={error}/>
        }

        switch (pageState.page) {
            case "connecting":
                return <ConnectingPage socket={clientSocket} />
            case "lobby":
                return <LobbyPage socket={clientSocket} data={pageState.data} />
            case "submit":
                return <SubmitPage socket={clientSocket} data={pageState.data} />
        }
    }

    useEffect(() => {

        const onBrowserPopstate = () => {
            console.log("navigating")
            clientSocket.disconnect() // forceful disconnect to trigger session expiry
        }

        const onBrowserRefresh = () => {
            console.log("refreshing")
            clientSocket.disconnect() // forceful disconnect to trigger session expiry
        }

        const onLobbyUpdate = (data: SocketIORedisMatchState) => {
            setPageState({
                page: "lobby",
                data
            })
        }

        const onEndSubmit = (data: SocketIORedisMatchState) => {
            setPageState({
                page: "submit",
                data
            })
        }

        const onPause = (data: SocketIORedisMatchState) => {
            setPaused(data)
        }

        const onResume = (data: SocketIORedisMatchState) => {
            setPaused(null)
            const { current_state } = data
            if (current_state == "submit" || current_state === "confirmation") {
                setPageState({
                    page: current_state,
                    data
                })
            }
        }

        // Socket.IO event listeners
        clientSocket.on("lobby-update", onLobbyUpdate)
        clientSocket.on("end-submit", onEndSubmit)
        clientSocket.on("pause-match", onPause)
        clientSocket.on("resume-match", onResume)

        // Window event listeners
        window.addEventListener("popstate", onBrowserPopstate)
        window.addEventListener("beforeunload", onBrowserRefresh)

        clientSocket.connect()

        return () => {
            clientSocket.off("lobby-update", onLobbyUpdate)
            clientSocket.off("end-submit", onEndSubmit)
            clientSocket.off("pause-match", onPause)
            clientSocket.off("resume-match", onResume)
            window.removeEventListener("popstate", onBrowserPopstate)
            window.removeEventListener("beforeunload", onBrowserRefresh)
            clientSocket.disconnect()
        }

    }, [])

    useEffect(() => {
        console.log(pageState)
    }, [pageState])

    useEffect(() => {
        console.log("paused", paused)
    }, [paused])

    return (
        <section className="w-full h-full">
            <PausedModal socket={clientSocket} data={paused}/>
            {renderMatchSPA()}
        </section>
    )
}