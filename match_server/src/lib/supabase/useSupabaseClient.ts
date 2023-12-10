import { createServerClient } from "@supabase/ssr";
import { Request, Response } from "express";
import { Database } from "../database.types";

const cookie = require('cookie')

export default function useSupabaseClient(context: { req: Request }) {

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        return createServerClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            cookies: {
                get: (key) => {
                    const cookieJar = cookie.parse(context.req.headers.cookie);
                    const authCookie = cookieJar[key] ?? "";
                    return decodeURIComponent(authCookie);
                },
            },
        });
    }

    throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY environment variables uninitialized.");
}
