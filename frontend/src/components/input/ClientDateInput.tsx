"use client";

import { HTMLInputTypeAttribute, InputHTMLAttributes, useEffect, useRef, useState } from "react";
import ClientInput from "./ClientInput";

interface ClientDateInputProps extends InputHTMLAttributes<HTMLInputTypeAttribute> {
    type: 'date' | 'datetime-local' | 'time';
}

export default function ClientDateInput(props: ClientDateInputProps) {
    const [focused, setFocused] = useState(false);

    return (
        <div className='relative flex w-full h-fit'>
            <div className={`w-full h-fit z-10 ${focused ? "opacity-100" : "absolute opacity-0"}`}>
                <ClientInput
                    type={props.type}
                    name={props.name}
                    onClick={() => {
                        setFocused(true);
                    }}
                />
            </div>
            {!focused && (
                <div className='w-full h-fit border-solid shadow-sm border rounded-md py-1 px-2 bg-white border-beige-500 font-normal text-responsive__large text-beige-950'>
                    {props.placeholder}
                </div>
            )}
        </div>
    );
}
