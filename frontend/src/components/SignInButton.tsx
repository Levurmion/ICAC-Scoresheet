'use client'

import { useRouter } from "next/navigation"
import { MouseEvent, useState } from "react"

export default function SignInButton () {

    const [ loginFailed, setLoginFailed ] = useState<boolean>(false)

    const router = useRouter()

    const handleSignIn = async (e: MouseEvent<HTMLButtonElement>) => {
        const response = await fetch('/api/auth/sign-in', {
            method: 'POST',
            body: JSON.stringify({
                email: 'elberttimothy23@gmail.com',
                password: 'password123'
            }),
            headers: {
                "Content-Type": 'application/json'
            }
        })

        if (response.status === 200) {
            router.push('/user')
        } 
        else if (response.status === 401) {
            setLoginFailed(true)
        }
    }

    return (
        <>
            <button className="p-2 bg-slate-500 text-white" onClick={handleSignIn}>
                Sign In
            </button>
            {loginFailed && <p className="text-red-500">Login Failed! {":("} Check username and password!</p>}
        </>
    )
}