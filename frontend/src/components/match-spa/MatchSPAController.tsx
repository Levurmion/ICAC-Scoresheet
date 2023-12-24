'use client'

import { useEffect, useState } from "react"
import clientSocket from "@/lib/clientSocket"

export default function MatchSPAController () {
    const [ pageState, setPageState ] = useState()

    useEffect(() => {

        clientSocket.connect()

    }, [])

    return (
        <section className="w-full h-full">

        </section>
    )
}