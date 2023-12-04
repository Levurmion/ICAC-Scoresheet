'use client'

import { ReactElement } from "react"

interface ScrollBoxProps {
    children: ReactElement<HTMLUListElement | HTMLOListElement>;
}

export default function ScrollBox ({ children }: ScrollBoxProps) {

    return (
        <div className="w-full h-full overflow-y-auto">
            { children }
        </div>
    )
}