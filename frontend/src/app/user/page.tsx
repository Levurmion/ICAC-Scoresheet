import SignOutButton from "@/components/auth/SignOutButton";
import ScrollBox from "@/components/containers/ScrollBox";
import ClientButton from "@/components/input/ClientButton";
import HostedMatchList from "@/components/match/HostedMatchList";
import Link from "next/link";

export default async function UserPage() {

    return (
        <>
            <div className='w-full h-[40dvh] flex flex-col pt-4 my-5'>
                <h2 className="font-semibold text-beige-950 pb-1">hosted matches</h2>
                <HostedMatchList />
            </div>
            <div className='w-full flex flex-col gap-2 mt-auto'>
                <ClientButton>
                    <Link href='/match/join' className='block text-responsive__large p-2 w-full font-semibold'>
                        Join a Match
                    </Link>
                </ClientButton>
                <ClientButton>
                    <Link href='/match/host' className='block text-responsive__large p-2 w-full font-semibold'>
                        Host a Match
                    </Link>
                </ClientButton>
            </div>
            <div className='w-full h-fit mt-auto'>
                <SignOutButton />
            </div>
        </>
    );
}
