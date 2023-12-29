"use client";

import ClientInput from "../input/ClientInput";
import ClientButton from "../input/ClientButton";
import ClientPasswordInput from "../input/ClientPasswordInput";
import ClientDateInput from "../input/ClientDateInput";
import ClientDropdownInput from "../input/ClientDropdownInput";
import { FormEvent } from "react";
import { extractFormData } from "@/lib/utilities";
import axios from "axios";
import { useRouter } from "next/navigation";

const universities = ["Imperial College London"];

export default function SignUpForm() {
    const router = useRouter();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const formValues = extractFormData(e);
        try {
            const response = await axios.post(
                "/api/auth/sign-up/user",
                formValues,
                {
                    validateStatus: (status) => status < 500,
                }
            );

            if (response.status === 201) {
                router.push("/");
            } else if (response.status === 400) {
                alert("Request missing required fields!");
            } else if (response.status === 409) {
                alert("Email already exists");
            }
        } catch (err) {
            alert("backend systems error!");
        }
    };

    return (
        <form onSubmit={handleSubmit} className='h-[80dvh] w-full mt-auto flex flex-col gap-2' suppressHydrationWarning>
            <ClientInput type='text' placeholder='email' name='email' required />
            <ClientPasswordInput />
            <ClientInput type='text' placeholder='first name' name='first_name' required />
            <ClientInput type='text' placeholder='last name' name='last_name' required />
            <ClientDateInput type='date' placeholder='date of birth' name='date_of_birth' />
            <ClientDropdownInput placeholder='university' name='university' options={universities} />
            <ClientDropdownInput placeholder='gender' name='gender' options={["male", "female"]} />
            <ClientDropdownInput placeholder='disability' name='disability' options={["yes", "no"]} />

            <div className='mt-auto'>
                <ClientButton id='signup-button' type='submit'>
                    <span className='block text-responsive__large p-2 w-full font-semibold'>Sign Up</span>
                </ClientButton>
            </div>
        </form>
    );
}
