import { ReactNode } from "react";
import { cookies } from "next/headers";
import useSupabaseServerClient from "../../../lib/useSupabaseServerClient";
import { UserMetadata } from "@supabase/supabase-js";
import ServerToClientUserContextProvider from "@/lib/contexts/ServerToClientUserContextProvider";

export default async function UserLayout ({ children }: { children: ReactNode }) {

    const cookieStore = cookies()
    const supabase = useSupabaseServerClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    return (
        <ServerToClientUserContextProvider value={user}>
            {children}
        </ServerToClientUserContextProvider>
    )
}