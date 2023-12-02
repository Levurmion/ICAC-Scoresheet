"use client";
import { FormEvent, useState } from "react";
import ClientButton from "../input/ClientButton";
import ClientInput from "../input/ClientInput";
import axios from "axios";
import { useRouter } from "next/navigation";
import ClientPasswordInput from "../input/ClientPasswordInput";

export default function LogInForm() {

    const router = useRouter()
    const [ loginFailed, setLoginFailed ] = useState(false)

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const email = formData.get("email");
        const password = formData.get("password");
        try {
            await axios.post("/api/auth/sign-in", {
                email,
                password,
            });
            router.push('/user')
        } catch (err) {
            setLoginFailed(true)
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
                    <span className='block text-2xl p-2 w-full font-semibold'>Log In</span>
                </ClientButton>
            </div>
        </form>
    );
}
