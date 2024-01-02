"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

export default function RejoinMatchButton() {
    const [sessionCountdown, setSessionCountdown] = useState<true | number>(0);

    useEffect(() => {
        (async () => {
            const sessionExistsRes = await fetch("/api/matches/session-exists", {
                cache: 'no-store'
            });
            if (sessionExistsRes.status === 200) {
                const { ttl } = await sessionExistsRes.json();

                if (ttl > 0) {
                    setSessionCountdown(ttl);
                } else {
                    setSessionCountdown(true);
                }
            } else if (sessionExistsRes.status === 404) {
                setSessionCountdown(0);
            }
        })();
    }, []);

    useEffect(() => {
        if (typeof sessionCountdown === "number" && sessionCountdown > 0) {
            setTimeout(() => setSessionCountdown((prevS) => (prevS as number) - 1), 1000);
        }
    }, [sessionCountdown]);

    // sessionCountdown is truthy for all values > 0
    return (
        <Link
            href='/user/match/live'
            className={`flex items-center gap-1 w-[100dvw] sm:w-[420px] -mt-4 px-4 bg-red-500 font-semibold text-white text-lg transition-all duration-500 overflow-hidden ${
                sessionCountdown ? "h-12 py-2" : "h-0 py-0"
            }`}>
            <ErrorOutlineIcon /> <span className='underline'>You have an active match</span>
            {
                typeof sessionCountdown === "number" && (
                    <span className='ms-auto'>{sessionCountdown} s</span>
                )
            }
        </Link>
    );
}
