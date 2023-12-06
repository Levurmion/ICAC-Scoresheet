"use client";

import { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";

interface ClientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    onClickHandler?: (e: MouseEvent<HTMLButtonElement>) => void;
    
}

export default function ClientButton(props: ClientButtonProps) {

    const {onClickHandler, ...buttonProps} = props

    return (
        <button {...buttonProps} onClick={props.onClickHandler} className='bg-beige-950 border border-solid border-black w-full h-fit text-white rounded-md shadow-md'>
            {buttonProps.children}
        </button>
    );
}
