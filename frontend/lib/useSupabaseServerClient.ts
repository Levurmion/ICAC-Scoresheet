import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export default function useSupabaseServerClient (cookieStore: ReadonlyRequestCookies) {

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    get(name: string) {
                        const cookie = cookieStore.get(name)?.value
                        const decodedCookie = decodeURIComponent(cookie!)
                        return decodedCookie
                    }
                }
            })
    }

    throw new Error('NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are undefined.')

}