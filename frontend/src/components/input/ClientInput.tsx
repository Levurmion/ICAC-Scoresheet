"use client";

import { ChangeEvent, HTMLInputTypeAttribute, InputHTMLAttributes, forwardRef } from "react";
import { useState, useEffect } from "react";

export interface ClientInputProps extends InputHTMLAttributes<HTMLInputElement> {
    textAlignment?: "text-center" | "text-left" | "text-right"
    onChangeCb?: (e: ChangeEvent<HTMLInputElement>) => void
}

const ClientInput = forwardRef<HTMLInputElement, ClientInputProps>((props, ref) => {
    const [value, setValue] = useState<any>('');
    const { textAlignment, onChangeCb, ...inputProps } = props

    return (
        <input
            ref={ref}
            {...inputProps}
            onChange={(e) => {
                setValue(e.target.value);
                if (onChangeCb) onChangeCb(e)
            }}
            value={value}
            className={`block w-full h-fit shadow-sm border-solid border rounded-md text-responsive__large py-1.5 px-3 border-beige-950 placeholder:font-normal placeholder:text-beige-950 font-semibold ${textAlignment}`}
            autoComplete="on"
            suppressHydrationWarning></input>
    );
})

export default ClientInput
