"use client";

import { useState } from "react";
import ClientInput from "./ClientInput";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export default function ClientPasswordInput() {
    const [visible, setVisible] = useState(false);

    return (
        <div className='flex w-full h-fit relative'>
            <ClientInput type={visible ? "text" : "password"} placeholder='password' name='password' required />
            <div className='absolute h-full aspect-square right-0 grid place-items-center text-amber-900' onClick={() => setVisible((prev) => !prev)}>
                {visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
            </div>
        </div>
    );
}
