import { ReactNode } from "react";
import { cookies } from "next/headers";
import useSupabaseServerClient from "../../../lib/useSupabaseServerClient";
import { UserMetadata } from "@supabase/supabase-js";

export default async function UserLayout ({ children }: { children: ReactNode }) {

    const cookieStore = cookies()
    const supabase = useSupabaseServerClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()
    // assert type because this route is authenticated by middleware
    const { 
        first_name,
        last_name,
    } = user?.user_metadata as UserMetadata

    return (
        <>
            <h1 className="w-full">
                <span className="font-extrabold">
                    Welcome
                </span>
                {" "}
                <span>
                    {first_name} {last_name}!
                </span>
            </h1>
            {children}
        </>
    )
}