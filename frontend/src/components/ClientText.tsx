'use client'

import { useState } from "react"
import { MouseEvent } from "react"

export default function ClientText () {

    const [text, setText] = useState('click to fetch text')

    const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
        const response = await fetch('/api/home').catch(err => console.log(err))
        const text = await (response as Response).text()
        setText(text)
    }

    return  (
        <>
            <p>{text}</p>
            <button className="bg-red-500 my-auto" onClick={handleClick}>
                fetch text
            </button>
        </>
    )

}