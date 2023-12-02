import { ReactNode } from "react"

export default function AuthLayout ({ children }: { children: ReactNode }) {

    return (
        <main className='h-full w-full flex flex-col items-center p-6'>
            {children}
        </main>
    )
}