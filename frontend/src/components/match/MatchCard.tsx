'use client'

import { motion } from "framer-motion";
import { LiveMatchRedisType } from "@/lib/types";
import { useState, useRef, ReactElement, ReactNode } from "react";
import { MatchStateBadge } from "./MatchStateBadge";

interface MatchCardProps {
    match: LiveMatchRedisType;
    children?: ReactElement<CardActionProps>
    selected?: boolean
}

export function MatchCard({ match, children, selected }: MatchCardProps) {
    const cardRef = useRef<HTMLLIElement>(null);
    const matchInfo = match.value;
    const selectedState = selected

    return (
        <motion.li
            initial={false}
            animate={false}
            exit={{ opacity: [1, 0, 0], height: 0, paddingBlock: 0, border: '0px'}}
            ref={cardRef}
            value={match.id}
            className={`relative w-full flex flex-col text-beige-950 pt-1.5 pb-2 px-2 border-b-[1px] border-beige-200 transition-colors ${selected ? "bg-beige-950" : ""}`}>
            <div className={`w-full flex items-center gap-2 text-responsive__medium whitespace-nowrap ${selected ? "text-white" : "text-beige-950"}`}>
                <h3 className='font-semibold'>{matchInfo.name}</h3>
            </div>
            <div className={`w-full flex gap-2 ${selected ? "text-beige-100" : "text-beige-900"} text-responsive__small`}>
                <MatchStateBadge matchState={matchInfo.current_state} />
                <span className='font-bold'>
                    {matchInfo.participants?.length}/{matchInfo.max_participants}
                </span>
                {matchInfo.round && <span className='font-bold'>{matchInfo.round}</span>}
                <span>{new Date(matchInfo.created_at).toDateString()}</span>
            </div>
            {children}
        </motion.li>
    );
}

interface CardActionProps {
    children: ReactNode
}

export function CardAction ({ children }: { children: ReactNode }) {

    return (
        <div className="absolute grid place-items-center h-full aspect-square top-0 right-0">
            {children}
        </div>
    )
}