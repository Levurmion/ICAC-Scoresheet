'use client'

import useSocketIOClient from "@/lib/useSocketIoClient"
import { useEffect, useState } from "react"
import ClientInput from "../input/ClientInput"
import ClientButton from "../input/ClientButton"
import { Socket } from "socket.io-client"

const socket = useSocketIOClient()

export default function MatchSPAController () {
    const [isConnected, setIsConnected] = useState(false)
    const [count, setCount] = useState(0)
    const [message, setMessage] = useState<null | string>(null)
    const [newMessage, setNewMessage] = useState("no new messages")
    

    const handleSendMessage = () => {
        if (message) {
            socket.emit('msg', message)
            setMessage(null)
        }
    }

    useEffect(() => {

        socket.connect()

        const onConnect = () => {
            setIsConnected(true)
        }

        const onInterval = (count: number) => {
            setCount(count)
        }

        const onMessage = (message: string) => {
            console.log(message)
            setNewMessage(message)
        }

        socket.on('connect', onConnect)
        socket.on('interval', onInterval)
        socket.on('message', onMessage)

        return () => {
            socket.off('connect', onConnect)
            socket.off('interval', onInterval)
            socket.off('message', onMessage)
        }

    }, [])

    return (
        <div className="w-full h-full flex flex-col gap-2">
            <h1>{isConnected ? 'Connected': 'Disconnected'}</h1>
            <h2>{count}</h2>
            <h2>{newMessage}</h2>
            <ClientInput onChangeCb={(e) => {setMessage(e.target.value)}}/>
            <ClientButton onClickHandler={handleSendMessage}>
                <span className="block text-responsive__large p-2 font-semibold">Send Message</span>
            </ClientButton>
        </div>
    )
}