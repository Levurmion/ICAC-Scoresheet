"use client";

import { useEffect } from "react";
import { PausedModalProps } from "./MatchSPATypes";
import { motion } from "framer-motion";
import ClientButton from "../input/ClientButton";
import { useRouter } from "next/navigation";

export default function PausedModal({ socket, data }: PausedModalProps) {
    const router = useRouter();

    const handleLeave = () => {
        socket.emit("user-leave", (reply: string) => {
            if (reply === "OK") {
                document.body.style.overflow = "";
                router.back();
            }
        });
    };

    useEffect(() => {
        if (data) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
    }, [data]);

    if (data) {
        return (
            <dialog className='fixed flex flex-col items-center justify-center w-full h-full top-0 rounded-lg z-50 bg-slate-600/20 backdrop-blur-sm'>
                <motion.main
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className='flex flex-col w-[80%] h-[80%] p-4 bg-beige-100 rounded-lg shadow-lg'>
                    <h1 className='font-extrabold text-red-700'>Match Paused</h1>
                    <div className='w-full mt-auto'>
                        <ClientButton onClickHandler={handleLeave}>
                            <p className='p-2 text-responsive__x-large font-semibold'>Leave Match</p>
                        </ClientButton>
                    </div>
                </motion.main>
            </dialog>
        );
    } else {
        return <></>;
    }
}
