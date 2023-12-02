import SignOutButton from "@/components/auth/SignOutButton";
import ClientButton from "@/components/input/ClientButton";
import Link from "next/link";

export default async function UserPage() {
    return (
        <>
            <div className='w-full flex flex-col gap-2 mt-[30vh]'>
                <ClientButton>
                    <Link href='/match/join' className='block text-2xl p-2 w-full font-semibold'>
                        Join a Match
                    </Link>
                </ClientButton>
                <ClientButton>
                    <Link href='/match/host' className='block text-2xl p-2 w-full font-semibold'>
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
