import { ReactNode } from "react";
import { cookies } from "next/headers";
import useSupabaseServerClient from "../../../lib/useSupabaseServerClient";
import ServerToClientUserContextProvider from "@/lib/contexts/ServerToClientUserContextProvider";

export default async function UserLayout ({ children }: { children: ReactNode }) {

    const cookieStore = cookies()
    const supabase = useSupabaseServerClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    return (
        <div className="w-full h-full sm:w-[420px] flex flex-col ">
            <ServerToClientUserContextProvider value={user}>
                {children}
            </ServerToClientUserContextProvider>
        </div>
    )
}