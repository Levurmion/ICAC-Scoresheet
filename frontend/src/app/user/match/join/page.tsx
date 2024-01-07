import SearchMatchList from "@/components/match/SearchMatchList";

export default function JoinMatchPage () {

    return (
        <>
            <h1 className="w-full font-extrabold">Join Match</h1>
            <p className="w-full">Match names should be exclusively alphanumeric with underscores or spaces.</p>
            <SearchMatchList />
        </>
    )
}