'use client'

import { MouseEvent } from "react"
import { useRouter } from "next/navigation"
import ClientButton from "../input/ClientButton"
import axios from "axios"

export default function SignOutButton () {

    const router = useRouter()

    const handleSignOut = async (e: MouseEvent<HTMLButtonElement>) => {
        try {
            await axios.post('/api/auth/sign-out')
            router.push('/')
        } catch (err) {
            alert(err)
        }
    }

    return (
        <ClientButton className="mt-auto" onClickHandler={handleSignOut}>
            <span className="block text-responsive__large p-2 w-full font-semibold">Sign Out</span>
        </ClientButton>
    )
}