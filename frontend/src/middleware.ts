import { NextRequest, NextResponse } from "next/server";
import useSupabaseServerClient from "../lib/useSupabaseServerClient";
import { cookies } from 'next/headers'

export async function middleware (req: NextRequest) {
    const cookieStore = cookies()
    const supabase = useSupabaseServerClient(cookieStore)
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        return NextResponse.redirect(new URL("/", req.url))
    }
}

export const config = {
    matcher: [
        '/user/:path*'
    ]
}