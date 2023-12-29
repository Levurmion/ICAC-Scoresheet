import { createClient } from "@supabase/supabase-js";
import { Database } from "../database.types";
import "dotenv/config"

export default function useSupabaseBasicClient() {

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        return createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    }

    throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY environment variables uninitialized.");
}