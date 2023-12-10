'use client'

import useSocketIOClient from "@/lib/useSocketIOClient"
import { useEffect, useState } from "react"
import ClientInput from "../input/ClientInput"
import ClientButton from "../input/ClientButton"
import clientSocket from "@/lib/useSocketIOClient"
import { useRouter } from "next/navigation"

export default function MatchSPAController () {
    const [isConnected, setIsConnected] = useState(false)
    const [connectionError, setConnectionError] = useState(false)
    const router = useRouter()

    const handleLeaveMatch = () => {
        if (!isConnected) {
            router.push('/user')
        } else {
            clientSocket.emit('client:leave')
        }
    }

    const handleReady = () => {
        console.log('readying...')
        clientSocket.emit('client:lobby-ready')
    }

    const handleUnready = () => {
        console.log('undreadying...')
        clientSocket.emit('client:lobby-unready')
    }

    useEffect(() => {

        const onConnect = () => {
            setIsConnected(true)
            setConnectionError(false)
            clientSocket.emit('client:request-init', (matchData: any) => {
                console.log(matchData)
            })
        }

        const onConnectError = (error: any) => {
            console.log(error)
            setConnectionError(true)
        }

        const onDisconnect = (reason: any) => {
            setIsConnected(false)
            if (reason === 'io server disconnect') {
                router.push('/user')
            } else {
                alert(reason)
            }
        }

        const onLobbyUpdate = (payload: any) => {
            console.log(payload)
        }

        clientSocket.connect()

        clientSocket.on('connect', onConnect)
        clientSocket.on('connect_error', onConnectError)
        clientSocket.on('disconnect', onDisconnect)
        clientSocket.on('server:lobby-update', onLobbyUpdate)

        return () => {
            clientSocket.off('connect', onConnect)
            clientSocket.off('connect_error', onConnectError)
            clientSocket.off('disconnect', onDisconnect)
            clientSocket.off('server:lobby-update', onLobbyUpdate)
        }

    }, [])

    return (
        <div className="w-full h-full flex flex-col gap-2">
            <h1>{isConnected ? 'Connected': 'Disconnected'}</h1>
            {connectionError && <h2 className="text-red-500">Connection Error</h2>}
            <ClientButton onClickHandler={handleReady}>
                <span className="block text-responsive__large p-2 font-semibold">Ready</span>
            </ClientButton>
            <ClientButton onClickHandler={handleUnready}>
                <span className="block text-responsive__large p-2 font-semibold">Unready</span>
            </ClientButton>
            <ClientButton onClickHandler={handleLeaveMatch}>
                <span className="block text-responsive__large p-2 font-semibold">Leave Match</span>
            </ClientButton>
        </div>
    )
}