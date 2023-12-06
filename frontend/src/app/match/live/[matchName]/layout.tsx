import { ReactNode } from "react"
import { cookies } from "next/headers"
import axios from "axios"
import { redirect } from "next/navigation"
import { LiveMatch, LiveMatchRedisType } from "@/lib/types"

export default async function LiveMatchLayout ({ params, children }: { params: { matchName: string }, children: ReactNode }) {

    const matchName = decodeURIComponent(params.matchName)
    const requestCookieJar = cookies()
    const requestCookies = requestCookieJar.getAll()
    const requestCookiesString = requestCookies.map(cookie => {
        return `${cookie.name}=${cookie.value}`
    }).join('; ')

    // forward cookies in request to backend
    const verifiedTokenPayload = await axios.get(`${process.env.BACKEND_URL}/matches/token/validate`, {
        headers: {
            Cookie: requestCookiesString
        },
        validateStatus: status => status < 500
    }) as any

    const matchDetailsRes = await axios.get(`${process.env.BACKEND_URL}/matches/live/${verifiedTokenPayload.data.match_uuid}?by_id=true`, {
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            Cookie: requestCookiesString
        },
        validateStatus: status => status < 500
    })

    // if (matchDetailsRes.status > 200) {
    //     return redirect('/match/join')
    // }

    const {
        round,
        arrows_per_end,
        num_ends,
        created_at
    } = matchDetailsRes.data

    return (
        <>
            <h1 className="font-extrabold -mt-4 px-4 py-3 w-[100vw] text-responsive__xx-large bg-beige-900 text-white">{matchName}</h1>
            <h2 className="px-4 py-1 w-[100vw] text-responsive__large bg-beige-700 text-beige-100 flex flex-row gap-4">
                { round && <span className="font-bold">{ round }</span>}
                <span>
                    {num_ends}<span className="font-semibold"> ends of </span>{arrows_per_end}<span className="font-semibold"> arrows</span>
                </span>
            </h2>
            <section className="flex flex-col items-center w-full h-full pt-4">
                {children}
            </section>
        </>
    )

}