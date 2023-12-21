import SignOutButton from "@/components/auth/SignOutButton";
import ClientButton from "@/components/input/ClientButton";
import HostedMatchList from "@/components/match/HostedMatchList";
import Link from "next/link";
import { cookies } from "next/headers";
import useSupabaseServerClient from "../../../lib/useSupabaseServerClient";
import { UserMetadata } from "@supabase/supabase-js";

export default async function UserPage() {
    const cookieStore = cookies();
    const supabase = useSupabaseServerClient(cookieStore);
    const {
        data: { user },
    } = await supabase.auth.getUser();
    // assert type because this route is authenticated by middleware
    const { first_name, last_name } = user?.user_metadata as UserMetadata;

    return (
        <>
            <h1 className='w-full'>
                <span className='font-extrabold'>Welcome</span>{" "}
                <span>
                    {first_name} {last_name}!
                </span>
            </h1>
            <div className='w-full h-[50dvh] flex flex-col my-auto gap-2'>
                <div className='w-full h-full flex flex-col gap-1'>
                    <h2 className='font-semibold text-beige-950'>Hosted Matches</h2>
                    <HostedMatchList />
                </div>
                <div className='w-full h-fit flex gap-2'>
                    <ClientButton>
                        <Link href='/user/match/host' className='block text-responsive__large p-2 w-full font-semibold'>
                            Host a Match
                        </Link>
                    </ClientButton>
                    <ClientButton>
                        <Link href='/user/match/join' className='block text-responsive__large p-2 w-full font-semibold'>
                            Join a Match
                        </Link>
                    </ClientButton>
                </div>
            </div>
            <div className='w-full h-fit mt-auto'>
                <SignOutButton />
            </div>
        </>
    );
}
