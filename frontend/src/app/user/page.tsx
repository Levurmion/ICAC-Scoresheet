import SignOutButton from "@/components/auth/SignOutButton";
import ClientButton from "@/components/input/ClientButton";
import HostedMatchList from "@/components/match/HostedMatchList";
import Link from "next/link";

export default async function UserPage() {

    return (
        <>
            <div className='w-full h-[50dvh] flex flex-col my-auto gap-2'>
                <div className="w-full h-full flex flex-col gap-1">
                    <h2 className="font-semibold text-beige-950">Hosted Matches</h2>
                    <HostedMatchList />
                </div>
                <div className="w-full h-fit flex gap-2">
                    <ClientButton>
                        <Link href='/match/host' className='block text-responsive__large p-2 w-full font-semibold'>
                            Host a Match
                        </Link>
                    </ClientButton>
                    <ClientButton>
                        <Link href='/match/join' className='block text-responsive__large p-2 w-full font-semibold'>
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
