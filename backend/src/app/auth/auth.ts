import { Request, Response, Router } from "express";
import useSupabaseClient from "../../lib/useSupabaseClient";
import { MobileOtpType, EmailOtpType, VerifyOtpParams } from "@supabase/supabase-js";

const auth = Router()

// confirm sign up from email link
auth.get("/confirm", async (req, res) => {

    console.log('confirming with api!')

    const token_hash = req.query.token_hash as string
    const type = req.query.type as MobileOtpType | EmailOtpType

    const next = req.query.next
    console.log(next)

    if (token_hash && type) {
        const supabase = useSupabaseClient({ req, res })
        const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash,
        } as VerifyOtpParams)
        if (!error) {
            // redirect to home page
            res.redirect(303, `/app/`)
        }
    }

    // return the user to an error page with some instructions
    res.redirect(303, '/app/auth/auth-code-error')

})


// sign up
auth.post('/sign-up', async (req, res) => {

    const { email, password } = req.body

    console.log('sign up!')

    const supabase = useSupabaseClient({ req, res })

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: 'localhost:8001/app/'
        }
    })

    if (!error) {
        res.send('sign up!')
    }
    else {
        res.status(409).send('sign up failed')
    }

})


auth.post('/sign-in', async (req, res) => {

    const { email, password } = req.body
    const supabase = useSupabaseClient({ req, res })
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (!error) {
        res.sendStatus(200)
    } 
    else {
        res.sendStatus(401)
    }

})


auth.get('/sign-out', async (req, res) => {

    const supabase = useSupabaseClient({ req, res })

    const { error } = await supabase.auth.signOut()

    if (!error) {
        res.sendStatus(200)
    }
    else {
        res.sendStatus(500)
    }

})


export default auth