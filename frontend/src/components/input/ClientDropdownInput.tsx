"use client";

import { FocusEvent, MouseEvent, SelectHTMLAttributes, useEffect, useRef, useState } from "react";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

interface ClientDropdownInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
    options: Array<string|undefined>;
}

export default function ClientDropdownInput(props: ClientDropdownInputProps) {
    const dropdownRef = useRef<null | HTMLDivElement>(null);
    const [selection, setSelection] = useState<string | undefined>(undefined);
    const [open, setOpen] = useState(false);

    const handleToggleDropdown = (e: MouseEvent<HTMLDivElement>) => {
        setOpen(prev => !prev)
    };

    const handleSelectDropdown = (e: MouseEvent<HTMLLIElement>) => {
        console.log('dropdown selected')
        const selectedOption = e.currentTarget.getAttribute("data-option");
        setSelection(selectedOption ?? undefined);
        setOpen(false);
    };

    const handleBlur = (e: FocusEvent) => {
        setOpen(false);
    };

    useEffect(() => {
        if (open) {
            dropdownRef.current?.focus();
        }
    }, [open]);

    return (
        <div className='relative flex w-full h-fit' onBlur={handleBlur} tabIndex={0} ref={dropdownRef}>
            <div
                className={`block w-full h-fit border-solid border shadow-sm rounded-md py-1 px-1.5 text-responsive__large bg-white border-beige-500 ${
                    selection === undefined ? "text-beige-950" : "text-black font-semibold"
                }`}>
                {selection ?? props.placeholder}
            </div>
            <div
                onClick={handleToggleDropdown}
                className={`absolute grid place-items-center h-full aspect-square right-0 text-4xl text-beige-950 transition-all hover:cursor-pointer ${
                    open ? "rotate-180" : "rotate-0"
                }`}>
                <ArrowDropDownIcon fontSize='inherit' />
            </div>
            <ul
                className={`absolute z-50 flex flex-col overflow-y-auto top-[110%] w-full shadow-md text-responsive__large bg-white text-beige-950 rounded-md focus:outline-none ${
                    open ? "max-h-[20vh] py-0.5" : "h-0"
                }`}>
                {props.options.map((option) => {
                    return (
                        <li key={option} data-option={option} onClick={handleSelectDropdown} className='px-2 py-0.5 hover:bg-beige-900 hover:text-white hover:cursor-pointer'>
                            {option}
                        </li>
                    );
                })}
            </ul>
            <select className='absolute opacity-0 h-0 w-0' {...props} value={selection}>
                {props.options.map((option) => {
                    return (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    );
                })}
            </select>
        </div>
    );
}
