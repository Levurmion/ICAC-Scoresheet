"use client"

import { Score } from "@/lib/types";
import { SubmitPageProps } from "./MatchSPATypes";

export default function SubmitPage ({ socket, data }: SubmitPageProps) {

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex flex-col gap-1">
                <h1 className="font-extrabold">
                    Submit
                </h1>
                <p className="text-responsive__xx-large font-bold">
                    End {data.current_end}
                </p>
            </div>
            

        </div>
    )
}

interface ArrowScoreProps {
    score: Score | null
}

export function ArrowScore ({ score }: ArrowScoreProps) {

    let color: string
    switch (score) {
        case "X" || 10 || 9:
            color = "bg-yellow-500 text-black"
            break
        case 8 || 7:
            color = "bg-red-700 text-white"
            break
        case 6 || 5:
            color = "bg-blue-500 text-white"
            break
        case 4 || 3:
            color = "bg-white text-black"
            break
        case 2 || 1:
            color = "bg-black text-white"
            break
        default:
            color = "bg-slate-500 text-black"
    }

    return (
        <div className={`rounded-full aspect-square h-20 grid place-items-center ${color}`}>
            {score}
        </div>
    )
}