import { cookies } from "next/headers";
import useSupabaseServerClient from "../../../lib/useSupabaseServerClient";
import ClientText from "../../components/ClientText";
import { UserResponse } from "@supabase/supabase-js";
import SignOutButton from "@/components/SignOutButton";
import Link from "next/link";

export default async function User () {

    const cookieStore = cookies()

    const supabase = useSupabaseServerClient(cookieStore)
    const session = await supabase.auth.getSession()
    const { data: { user } } = await supabase.auth.getUser()

    console.log(user)

    if (user) {
        const { email, id } = user
        return (
            <main className="flex flex-col">
                <p>Welcome {email}!</p>
                <p>This is your user ID {id}!</p>
                <SignOutButton />
            </main>
        )
    } else {
        return (
            <main className="flex flex-col">
                <p>You're not signed in!</p>
                <Link href='/'>return home</Link>
            </main>
        )
    }

}