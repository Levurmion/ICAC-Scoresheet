"use client";
import { FormEvent, useState } from "react";
import ClientButton from "../input/ClientButton";
import ClientInput from "../input/ClientInput";
import axios from "axios";
import { useRouter } from "next/navigation";
import ClientPasswordInput from "../input/ClientPasswordInput";
import { extractFormData } from "@/lib/utilities";

export default function LogInForm() {

    const router = useRouter()
    const [ loginFailed, setLoginFailed ] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const { email, password } = extractFormData(e)
        try {
            const response = await axios.post("/api/auth/sign-in", {
                email,
                password,
            }, {
                validateStatus: (status) => status < 500
            });

            if (response.status === 200) {
                router.push('/user')
            } else if (response.status === 401) {
                setLoginFailed(true)
            }
        } catch (err) {
            alert('backend systems error!')
        }
    };

    return (
        <form onSubmit={handleSubmit} className='h-[50dvh] w-full mt-auto flex flex-col gap-2' suppressHydrationWarning>
            <ClientInput type='text' placeholder='email' name='email' required pattern="[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$" />
            <ClientPasswordInput />
            {
                loginFailed && <p className="text-lg text-red-700">wrong email or password!</p>
            }
            <div className='mt-auto'>
                <ClientButton type='submit'>
                    <span className='block text-responsive__large p-2 w-full font-semibold'>Log In</span>
                </ClientButton>
            </div>
        </form>
    );
}
