import HostMatchForm from "@/components/match/HostMatchForm";

export default function HostMatchPage () {

    return (
        <>
            <h1 className="w-full font-extrabold">Host Match</h1>
            <p className="w-full my-2">Match names should be exclusively alphanumeric with underscores or spaces.</p>
            <HostMatchForm />
        </>
    )
}