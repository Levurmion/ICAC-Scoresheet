'use client'

import { useRouter } from "next/navigation"
import { MouseEvent, useState } from "react"

export default function SignOutButton () {

    const [ signOutFailed, setSignOutFailed ] =  useState(false)

    const router = useRouter()

    const handleSignOut = async (e: MouseEvent<HTMLButtonElement>) => {
        const response = await fetch('/api/auth/sign-out', {
            method: 'GET',
        })

        if (response.status === 200) {
            router.push('/')
        }
        else if (response.status === 500) {
            setSignOutFailed(true)
        }
    }

    return (
        <>
            <button className="p-2 bg-slate-500 text-white w-fit" onClick={handleSignOut}>
                Sign Out
            </button>
            {signOutFailed && <p className="text-red-500">Sign out failed...</p>}
        </>
    )
}