import { createServerClient } from "@supabase/ssr";
import { Request, Response } from "express";
import { Database } from "../database.types";

export default function useSupabaseAdminClient (context: { req: Request, res: Response }) {

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ADMIN_KEY) {
        return createServerClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_ADMIN_KEY, {
            cookies: {
                get: (key) => {
                    const cookies = context.req.cookies;
                    const cookie = cookies[key] ?? "";
                    return decodeURIComponent(cookie);
                },
                set: (key, value, options) => {
                    if (!context.res) return;
                    context.res.cookie(key, encodeURIComponent(value), {
                        ...options,
                        sameSite: "Lax",
                        httpOnly: true,
                    });
                },
                remove: (key, options) => {
                    if (!context.res) return;
                    context.res.cookie(key, "", { ...options, httpOnly: true });
                },
            },
        });
    }

    throw new Error("SUPABASE_URL or SUPABASE_ADMIN_KEY environment variables uninitialized.");

}