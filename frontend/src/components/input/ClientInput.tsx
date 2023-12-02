"use client";

import { HTMLInputTypeAttribute, InputHTMLAttributes, forwardRef } from "react";
import { useState } from "react";

interface ClientInputProps {
    placeholder: string;
    type: HTMLInputTypeAttribute;
    name: string;
}

const ClientInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
    const [value, setValue] = useState<string>("");

    return (
        <input
            ref={ref}
            {...props}
            onChange={(e) => {
                setValue(e.target.value);
            }}
            value={value}
            className='block w-full h-fit border-solid border-4 rounded-lg text-xl py-1.5 px-3 border-amber-900 placeholder:font-normal placeholder:text-xl placeholder:text-amber-900 font-semibold'
            autoComplete="on"
            suppressHydrationWarning></input>
    );
})

export default ClientInput
