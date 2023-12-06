"use client";

import { InputHTMLAttributes, MouseEvent, Ref, useEffect, useRef } from "react";
import ClientInput, { ClientInputProps } from "./ClientInput";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

interface ClientNumberInput extends ClientInputProps {
    type?: undefined; // need to make sure people can't change the type
}

export default function ClientNumberInput(props: ClientNumberInput) {
    `
    ABOUT SYNTHETIC EVENTS IN REACT:

    Events in React are not handled by the native browser Javascript engine. They are handled by React's proprietary event handler attached to the root of the DOM. As such, synthetic events dispatched onto components need to be bubbled up to the root component for the event to be detected by React. This event would then be delegated by React to the element. React essentially acts as an EVENT BROKER. For this specific use case, onChange callbacks differ from vanilla Javascript change events as they do not get triggered by "change" events. In React, onChange callbacks are triggered instead by "input" events. This is only fired when an element loses focus and thus changing element values programmaticaly will not trigger said "input" events.
    `
    const numberInputRef = useRef<HTMLInputElement>(null);

    const handleIncrement = (e: MouseEvent<HTMLButtonElement>) => {
        numberInputRef.current?.stepUp(1);
        numberInputRef.current?.dispatchEvent(new Event("input", {bubbles: true}));
    };

    const handleDecrement = (e: MouseEvent<HTMLButtonElement>) => {
        numberInputRef.current?.stepDown(1);
        numberInputRef.current?.dispatchEvent(new Event("input", {bubbles: true}));
    };

    return (
        <div className='relative flex gap-0.5 w-full h-fit'>
            <button
                type='button'
                className='h-full aspect-square rounded-md bg-white shadow-sm border border-solid border-beige-950 text-beige-950'
                onClick={handleDecrement}>
                <RemoveIcon />
            </button>
            <ClientInput {...props} ref={numberInputRef} type='number' textAlignment='text-center' />
            <button
                type='button'
                className='h-full aspect-square rounded-md bg-white shadow-sm border border-solid border-beige-950 text-beige-950'
                onClick={handleIncrement}>
                <AddIcon />
            </button>
        </div>
    );
}
