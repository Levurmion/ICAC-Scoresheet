import { MatchState } from "@/lib/types";

export function MatchStateBadge({ matchState }: { matchState: MatchState }) {
    switch (matchState) {
        case "open":
            return <span className='px-[0.75ex] align-middle rounded-full bg-green-400 text-green-800 opacity-85 text-[80%] font-semibold'>OPEN</span>;
        case "full":
            return <span className='px-[0.75ex] align-middle rounded-full bg-yellow-400 text-yellow-800 opacity-85 text-[80%] font-semibold'>FULL</span>;
        case "finished":
            return <span className='px-[0.75ex] align-middle rounded-full bg-red-400 text-red-800 opacity-85 text-[80%] font-semibold'>FINISHED</span>;
        case "reported":
            return <span className='px-[0.75ex] align-middle rounded-full bg-red-400 text-red-800 opacity-85 text-[80%] font-semibold'>REPORTED</span>;
        case "paused":
            return <span className='px-[0.75ex] align-middle rounded-full bg-purple-400 text-purple-800 opacity-85 text-[80%] font-semibold'>PAUSED</span>;
        default:
            return (
                <span className='px-[0.75ex] align-middle rounded-full bg-sky-400 text-sky-800 opacity-85 text-[80%] font-semibold'>
                    {matchState.toUpperCase()}
                </span>
            );
    }
}