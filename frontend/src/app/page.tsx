import ClientButton from "@/components/input/ClientButton";
import Image from "next/image";
import Link from "next/link";
import { MouseEvent } from "react";

export default function Home() {
    return (
        <main className='h-full flex flex-col items-center p-6'>
            <h1 className='mt-[30vh]'>
                <span className='font-extrabold'>ICAC</span> Scoresheet
            </h1>
            <div className='mt-auto w-full flex flex-col gap-3'>
                <ClientButton>
                    <Link href="/auth/log-in" className='block text-2xl p-2 w-full font-semibold'>
                        Log In
                    </Link>
                </ClientButton>
                <ClientButton>
                    <Link href="/auth/sign-up" className='block text-2xl p-2 w-full font-semibold'>
                        Sign Up
                    </Link>
                </ClientButton>
            </div>
        </main>
    );
}
