import { Request, Response, Router } from "express";
import useSupabaseClient from "../../lib/supabase/useSupabaseClient";
import { MobileOtpType, EmailOtpType, VerifyOtpParams } from "@supabase/supabase-js";
import useSupabaseAdminClient from "../../lib/supabase/useSupabaseAdminClient";

const auth = Router()

// confirm sign in from email link
auth.get("/confirm", async (req, res) => {

    const token_hash = req.query.token_hash as string
    const type = req.query.type as MobileOtpType | EmailOtpType
    const next = req.query.next

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


// sign up user
auth.post('/sign-up/user', async (req, res, next) => {

    const { email, password, gender, date_of_birth, first_name, last_name } = req.body
    const supabase = useSupabaseClient({ req, res })

    // check that all required fields are present
    if ([email, password, gender, date_of_birth, first_name, last_name].some(item => item === undefined)) {
        res.sendStatus(400)
        return
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: 'localhost:8001/app/',
            data: {
                is_disabled: false,
                type: 'regular',
                ...req.body
            }
        }
    })

    if (!error) {
        res.sendStatus(201)
    }
    else if (error.status === 400 && error.message === 'User already registered') {
        res.sendStatus(409)
    }
    else {
        res.sendStatus(error.status!)
    }

})


// sign in user
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
    else if (error.status === 400 && error.message === 'Invalid login credentials') {
        res.sendStatus(401)
    }
    else {
        res.status(error.status!).send(error.message)
    }

})


// sign out user
auth.post('/sign-out', async (req, res) => {

    const supabase = useSupabaseClient({ req, res })

    const { error } = await supabase.auth.signOut()

    if (!error) {
        res.sendStatus(200)
    }
    else {
        res.status(error.status!).send(error.message)
    }

})


// delete user
auth.delete('/user', async (req, res) => {

    const supabase = useSupabaseClient({ req, res })
    const supabaseAdmin = useSupabaseAdminClient({ req, res })

    const { data: { user } } = await supabase.auth.getUser()

    if (user !== null) {
        await supabase.auth.signOut()
        const { data, error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
        
        if (!error) {
            res.sendStatus(200)
        }
        else {
            res.status(error.status!).send(error.message)
        }
    }
    else {
        res.sendStatus(401)
    }

})


export default auth