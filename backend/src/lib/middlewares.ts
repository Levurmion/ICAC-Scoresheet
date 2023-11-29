import { NextFunction, Request, Response } from "express";
import useSupabaseClient from "./supabase/useSupabaseClient";

// authentication middleware
export async function authenticate(req: Request, res: Response, next: NextFunction) {
    const supabase = useSupabaseClient({ req, res });
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (user === null) {
        res.sendStatus(401);
        return;
    } else {
        next();
    }
}
