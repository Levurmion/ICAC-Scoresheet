import { ReactNode } from "react";

export default function AuthLayout ({ children }: { children: ReactNode }) {

    return (
        <div className="w-full h-full sm:w-[420px] flex flex-col">
            {children}
        </div>
    )
}