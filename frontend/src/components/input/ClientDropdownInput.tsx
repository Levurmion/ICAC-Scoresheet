"use client";

import { MouseEvent, SelectHTMLAttributes, useState } from "react";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

interface ClientDropdownInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
    options: string[];
}

export default function ClientDropdownInput(props: ClientDropdownInputProps) {
    const [selection, setSelection] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    const handleOpenDropdown = (e: MouseEvent<HTMLDivElement>) => {
        setOpen((prev) => !prev);
    };

    const handleSelectDropdown = (e: MouseEvent<HTMLLIElement>) => {
        const selectedOption = e.currentTarget.getAttribute("data-option");
        setSelection(selectedOption);
        setOpen(false);
    };

    return (
        <div className='relative flex w-full h-fit'>
            <div
                className={`block w-full h-fit border-solid border shadow-sm rounded-lg py-1 px-1.5 text-responsive__large bg-white border-beige-950 ${
                    selection === null ? "text-beige-950" : "text-black font-semibold"
                }`}>
                {selection ?? props.placeholder}
            </div>
            <div
                onClick={handleOpenDropdown}
                className={`absolute grid place-items-center h-full aspect-square right-0 text-4xl text-beige-950 transition-all ${open ? "rotate-180" : "rotate-0"}`}>
                <ArrowDropDownIcon fontSize='inherit' />
            </div>
            <ul
                className={`absolute z-50 flex flex-col overflow-y-auto top-[110%] w-full shadow-sm text-responsive__medium bg-beige-800 text-white rounded-md transition-all ${
                    open ? "h-[20dvh] py-0.5" : "h-0"
                }`}>
                {props.options.map((option) => {
                    return (
                        <li key={option} data-option={option} onClick={handleSelectDropdown} className='px-2 py-0.5'>
                            {option}
                        </li>
                    );
                })}
            </ul>
            <select className='absolute opacity-0 h-0 w-0' {...props} value={selection ?? undefined}>
                <option>{props.placeholder}</option>
            </select>
        </div>
    );
}
