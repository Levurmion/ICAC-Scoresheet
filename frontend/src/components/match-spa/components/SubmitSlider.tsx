"use client";

import { useRef, useState } from "react";
import { motion, PanInfo } from "framer-motion";
import LoadingSpinner from "@/components/svg-icons/LoadingSpinner";
import SendIcon from "@mui/icons-material/Send";

export function SubmitSlider({
    allowSubmit,
    notifySubmit,
    beforeSubmitText,
    afterSubmitText,
}: {
    allowSubmit: boolean;
    notifySubmit: () => void;
    beforeSubmitText: string;
    afterSubmitText: string;
}) {
    const [submitted, setSubmitted] = useState(false);

    const sliderRef = useRef<HTMLDivElement | null>(null);
    const thumbRef = useRef<HTMLDivElement | null>(null);

    const onDragEnd = (event: TouchEvent | PointerEvent, info: PanInfo) => {
        if (thumbRef.current && sliderRef.current) {
            const thumbRect = thumbRef.current.getBoundingClientRect();
            const sliderRect = sliderRef.current.getBoundingClientRect();
            if (info.point.x >= sliderRect.right - thumbRect.width / 2 && allowSubmit) {
                setSubmitted(true);
                notifySubmit();
            }
        }
    };

    return (
        <div className='relative flex items-center w-full h-12 p-1 justify-center rounded-full bg-beige-800 shadow-inner'>
            <p className={`text-xl absolute font-semibold text-beige-100 ${submitted ? "animate-pulse" : ""}`}>
                {submitted ? afterSubmitText : beforeSubmitText}
            </p>
            <div className={`flex w-full h-full ${submitted ? "justify-end" : ""}`} ref={sliderRef}>
                {submitted ? (
                    <div className='grid place-items-center text-3xl h-full aspect-square rounded-full shadow-md bg-beige-100 text-beige-800'>
                        <div className='h-8 w-8'>
                            <LoadingSpinner />
                        </div>
                    </div>
                ) : (
                    <motion.div
                        ref={thumbRef}
                        dragElastic={0.01}
                        dragSnapToOrigin
                        dragConstraints={sliderRef}
                        drag='x'
                        onDragEnd={onDragEnd}
                        className='grid place-items-center text-3xl h-full aspect-[5/4] rounded-full shadow-md bg-beige-100 text-beige-800'>
                        <SendIcon fontSize='inherit' />
                    </motion.div>
                )}
            </div>
        </div>
    );
}
