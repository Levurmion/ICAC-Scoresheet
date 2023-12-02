"use client";

import { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";

interface ClientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    onClickHandler?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export default function ClientButton(props: ClientButtonProps) {
    return (
        <button {...props} onClick={props.onClickHandler} className='bg-amber-900 w-full h-fit text-white rounded-md'>
            {props.children}
        </button>
    );
}
