"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import ClientInput from "../input/ClientInput";
import ClientNumberInput from "../input/ClientNumberInput";
import ClientButton from "../input/ClientButton";
import useSWR, { SWRResponse } from "swr";
import { MatchParams } from "@/lib/types";
import axios, { AxiosError, AxiosResponse } from "axios";
import { extractFormData } from "@/lib/utilities";
import RotateRightRoundedIcon from "@mui/icons-material/RotateRightRounded";
import CheckIcon from "@mui/icons-material/Check";
import { error } from "console";
import LoadingSpinner from "../svg-icons/LoadingSpinner";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

function createMatch(matchParams: MatchParams | null) {
    return useSWR(
        ["/api/matches", matchParams],
        async ([path, reqBody]) => {
            if (reqBody === null) {
                return null;
            } else {
                const createMatchRes = await axios.post(path, reqBody, { validateStatus: (status) => status < 500 });
                return createMatchRes;
            }
        },
        {
            revalidateIfStale: false,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            shouldRetryOnError: false,
        }
    );
}

export default function HostMatchForm() {
    const [arrowsPerEnd, setArrowsPerEnd] = useState(0);
    const [numEnds, setNumEnds] = useState(0);
    const [createMatchParams, setCreateMatchParams] = useState<null | MatchParams>(null);
    const { data, isLoading, error } = createMatch(createMatchParams);
    const router = useRouter();

    const renderSubmitButton = () => {
        if (data?.status === 201) {
            return (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    onAnimationComplete={() => {
                        router.push("/user");
                    }}
                    className='flex w-full items-center justify-center opacity-0'>
                    <CheckIcon />
                    <span className='block text-responsive__large p-2 w-fit font-semibold'>Match Created</span>
                </motion.div>
            );
        } else if (data?.status === 409) {
            return <span className='block text-responsive__large p-2 w-full font-semibold'>Name Already Taken!</span>;
        } else if (isLoading && createMatchParams) {
            return (
                <div className='flex w-full items-center justify-center'>
                    <div className='h-6 w-6'>
                        <LoadingSpinner />
                    </div>
                    <span className='block text-responsive__large p-2 w-fit font-semibold'>Submitting Match</span>
                </div>
            );
        } else if (error) {
            return <span className='block text-responsive__large p-2 w-full font-semibold'>Systems Error!</span>;
        } else {
            return <span className='block text-responsive__large p-2 w-full font-semibold'>Create Match</span>;
        }
    };

    const handleArrowsPerEndChange = (e: ChangeEvent<HTMLInputElement>) => {
        setArrowsPerEnd(Number(e.target.value));
    };

    const handleNumEndsChange = (e: ChangeEvent<HTMLInputElement>) => {
        setNumEnds(Number(e.target.value));
    };

    const handleMatchNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        setCreateMatchParams(null);
    };

    const handleCreateMatchSubmit = (e: FormEvent) => {
        e.preventDefault();
        const matchParams = extractFormData(e) as unknown as MatchParams;
        setCreateMatchParams(matchParams);
    };

    return (
        <form onSubmit={handleCreateMatchSubmit} className='w-full mt-auto flex flex-col gap-2' suppressHydrationWarning>
            <ClientInput id="match-name-field" onChangeCb={handleMatchNameChange} type='text' placeholder='match name' name='name' pattern='^[A-Za-z0-9_ ]+$' required />
            <ClientInput id="round-name-field" type='text' placeholder='round (optional)' name='round' />
            <ClientNumberInput min={2} step={1} placeholder='number of participants' name='max_participants' required />
            <p className='mt-4'>
                <span className='font-extrabold'>total: </span>
                {arrowsPerEnd * numEnds} arrows
            </p>
            <ClientNumberInput onChangeCb={handleArrowsPerEndChange} min={1} step={1} placeholder='arrows per end' name='arrows_per_end' required />
            <ClientNumberInput onChangeCb={handleNumEndsChange} min={1} step={1} placeholder='number of ends' name='num_ends' required />
            <div className='mt-10 w-full h-fit'>
                <ClientButton type='submit'>{renderSubmitButton()}</ClientButton>
            </div>
        </form>
    );
}
