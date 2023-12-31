"use client";

import { useState } from "react";
import ClientInput from "./ClientInput";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export default function ClientPasswordInput() {
    const [visible, setVisible] = useState(false);

    return (
        <div className='flex w-full h-fit relative'>
            <ClientInput type={visible ? "text" : "password"} minLength={8} placeholder='password' name='password' required />
            <div className='absolute h-full aspect-square right-0 grid place-items-center text-beige-950' onClick={() => setVisible((prev) => !prev)}>
                {visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
            </div>
        </div>
    );
}
