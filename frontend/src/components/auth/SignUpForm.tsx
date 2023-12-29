'use client'

import ClientInput from "../input/ClientInput"
import ClientButton from "../input/ClientButton"
import ClientPasswordInput from "../input/ClientPasswordInput"
import ClientDateInput from "../input/ClientDateInput"
import ClientDropdownInput from "../input/ClientDropdownInput"

const universities = [
    "Imperial College London",
    "University College London",
    "Queen Mary University of London",
    "Birbeck College",
    "University of Southampton",
    "University of Portsmouth",
    "University of Nottingham"
]

export default function SignUpForm () {

    return (
        <form className='h-[80dvh] w-full mt-auto flex flex-col gap-2' suppressHydrationWarning>
            <ClientInput type="text" placeholder="email" name='email' required/>
            <ClientPasswordInput />
            <ClientInput type="text" placeholder="first name" name='first_name' required/>
            <ClientInput type="text" placeholder="last name" name='last_name' required/>
            <ClientDateInput type='date' placeholder="date of birth" name="date_of_birth"/>
            <ClientDropdownInput placeholder="university" name="university" options={universities} />
            <ClientDropdownInput placeholder="gender" name="gender" options={["male", "female"]} />
            <ClientDropdownInput placeholder="disability" name="disability" options={["yes", "no"]} />

            <div className='mt-auto'>
                <ClientButton id="signup-button" type='submit'>
                    <span className='block text-responsive__large p-2 w-full font-semibold'>Sign Up</span>
                </ClientButton>
            </div>
        </form>
    )
}