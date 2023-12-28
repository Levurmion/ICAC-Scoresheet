"use client"

import { Arrow, Score } from "@/lib/types";

export function ArrowScore({ score }: { score: Score | Arrow | null }) {

    const arrowScore = (() => {
        if (typeof score === "string" || typeof score === "number") {
            return score
        } else if (score?.submitted_by !== undefined) {
            return score.score
        } else if (score === null) {
            return null
        }
    })()

    let color: string = "";

    if (arrowScore === "X" || arrowScore === 10 || arrowScore === 9) {
        color = "bg-yellow-400 text-black";
    } else if (arrowScore === 8 || arrowScore === 7) {
        color = "bg-red-600 text-white";
    } else if (arrowScore === 6 || arrowScore === 5) {
        color = "bg-blue-500 text-white";
    } else if (arrowScore === 4 || arrowScore === 3) {
        color = "bg-white text-black";
    } else if (arrowScore === 2 || arrowScore === 1) {
        color = "bg-black text-white";
    } else if (arrowScore === 0) {
        color = "bg-gray-300 text-black";
    } else if (arrowScore === null) {
        color = "bg-gray-300 text-slate-700";
    }

    return (
        <div className={`rounded-full aspect-square h-full grid place-items-center font-bold ${color}`}>
            {arrowScore === null ? <span className='text-[50%]'>arrow</span> : arrowScore === 0 ? "M" : arrowScore}
        </div>
    );
}