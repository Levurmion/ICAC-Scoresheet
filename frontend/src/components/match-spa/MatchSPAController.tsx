"use client";

import { MouseEvent, useEffect, useState } from "react";
import clientSocket from "@/lib/clientSocket";
import { SocketIORedisMatchState } from "@/lib/types";
import { MatchSPAControllerStates, MatchSPAPagesWithData } from "./MatchSPATypes";
import ConnectingPage from "./ConnectingPage";
import ErrorPage from "./ErrorPage";
import LobbyPage from "./LobbyPage";
import SubmitPage from "./SubmitPage";
import PausedModal from "./PausedModal";
import ConfirmationPage from "./ConfirmationPage";
import FinishedPage from "./FinishedPage";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { AnimatePresence, motion } from "framer-motion";
import MatchResults from "./components/MatchResults/MatchResults";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export default function MatchSPAController() {
    const [pageState, setPageState] = useState<MatchSPAControllerStates>({
        page: "connecting",
        data: null,
    });
    const [error, setError] = useState<string | null>(null);
    const [paused, setPaused] = useState<SocketIORedisMatchState | null>(null);
    const [viewScoresheet, setViewScoresheet] = useState(false);

    function matchIsRunning() {
        return pageState.page === "confirmation" || pageState.page === "resubmit" || pageState.page === "submit";
    }

    function renderMatchSPA() {
        if (error) {
            return <ErrorPage socket={clientSocket} error={error} />;
        }

        switch (pageState.page) {
            case "connecting":
                return <ConnectingPage socket={clientSocket} />;
            case "lobby":
                return <LobbyPage socket={clientSocket} data={pageState.data} />;
            case "submit":
                return <SubmitPage socket={clientSocket} data={pageState.data} />;
            case "resubmit":
                return <SubmitPage socket={clientSocket} data={pageState.data} resubmit={true} />;
            case "confirmation":
                return <ConfirmationPage socket={clientSocket} data={pageState.data} />;
            case "finished":
                return <FinishedPage socket={clientSocket} data={pageState.data} />;
        }
    }

    useEffect(() => {
        const onBrowserPopstate = () => {
            clientSocket.disconnect(); // forceful disconnect to trigger session expiry
        };

        const onBrowserRefresh = () => {
            clientSocket.disconnect(); // forceful disconnect to trigger session expiry
        };

        const onLobbyUpdate = (data: SocketIORedisMatchState) => {
            setPageState({
                page: "lobby",
                data,
            });
        };

        const onEndSubmit = (data: SocketIORedisMatchState) => {
            setPageState({
                page: "submit",
                data,
            });
        };

        const onEndConfirmation = (data: SocketIORedisMatchState) => {
            setPageState({
                page: "confirmation",
                data,
            });
        };

        const onConfirmationUpdate = (data: SocketIORedisMatchState) => {
            setPageState({
                page: "confirmation",
                data,
            });
        };

        const onEndReset = (data: SocketIORedisMatchState) => {
            setPageState((prevState) => {
                if (prevState.page === "confirmation") {
                    return {
                        page: "resubmit",
                        data: prevState.data,
                    };
                } else {
                    return {
                        page: "resubmit",
                        data,
                    };
                }
            });
        };

        const onMatchFinished = (data: SocketIORedisMatchState) => {
            setPageState({
                page: "finished",
                data,
            });
        };

        const onSaveUpdate = (data: SocketIORedisMatchState) => {
            setPageState({
                page: "finished",
                data,
            });
        };

        const onConnectError = (error: Error) => {
            setError(error.message);
        };

        const onConnect = () => {
            setError(null);
        };

        const onPause = (data: SocketIORedisMatchState) => {
            setPaused(data);
        };

        const onResume = (data: SocketIORedisMatchState) => {
            setPaused(null);
            const { current_state } = data;
            if (current_state == "submit" || current_state === "confirmation") {
                setPageState({
                    page: current_state,
                    data,
                });
            } else if (current_state === "finished" || current_state === "reported" || current_state === "saved" || current_state === "save error") {
                setPageState({
                    page: "finished",
                    data,
                });
            }
        };

        // Socket.IO event listeners
        clientSocket.on("connect_error", onConnectError);
        clientSocket.on("connect", onConnect);
        clientSocket.on("lobby-update", onLobbyUpdate);
        clientSocket.on("end-submit", onEndSubmit);
        clientSocket.on("end-confirmation", onEndConfirmation);
        clientSocket.on("confirmation-update", onConfirmationUpdate);
        clientSocket.on("end-reset", onEndReset);
        clientSocket.on("pause-match", onPause);
        clientSocket.on("resume-match", onResume);
        clientSocket.on("match-finished", onMatchFinished);
        clientSocket.on("save-update", onSaveUpdate);

        // Window event listeners
        window.addEventListener("popstate", onBrowserPopstate);
        window.addEventListener("beforeunload", onBrowserRefresh);

        clientSocket.connect();

        return () => {
            clientSocket.off("connect_error", onConnectError);
            clientSocket.off("connect", onConnect);
            clientSocket.off("lobby-update", onLobbyUpdate);
            clientSocket.off("end-submit", onEndSubmit);
            clientSocket.off("end-confirmation", onEndConfirmation);
            clientSocket.off("confirmation-update", onConfirmationUpdate);
            clientSocket.off("end-reset", onEndReset);
            clientSocket.off("pause-match", onPause);
            clientSocket.off("resume-match", onResume);
            clientSocket.off("match-finished", onMatchFinished);
            clientSocket.off("save-update", onSaveUpdate);
            window.removeEventListener("popstate", onBrowserPopstate);
            window.removeEventListener("beforeunload", onBrowserRefresh);
            clientSocket.disconnect();
        };
    }, []);

    useEffect(() => {
        if (viewScoresheet) {
            document.body.style.overflowY = "hidden";
        } else {
            document.body.style.overflowY = "";
        }
    }, [viewScoresheet]);

    return (
        <section className='w-full h-full flex flex-col'>
            <PausedModal socket={clientSocket} data={paused} />
            {matchIsRunning() && (
                <>
                    <nav className={`flex flex-row justify-center w-[100dvw] sm:w-[420px] -ms-4 -mt-4 ${viewScoresheet}`}>
                        <button
                            onClick={() => {
                                setViewScoresheet((prev) => !prev);
                            }}
                            className='flex items-center justify-center gap-1 w-full py-2 px-4 font-semibold bg-gray-600 text-white shadow-md text-responsive__x-large'>
                            <AssignmentIcon fontSize='inherit' /> Scoresheet
                        </button>
                    </nav>
                    <AnimatePresence>
                        {viewScoresheet && (
                            <ScoresheetModal
                                data={pageState.data as SocketIORedisMatchState}
                                closeModalCb={() => {
                                    setViewScoresheet(false);
                                }}
                            />
                        )}
                    </AnimatePresence>
                </>
            )}
            {renderMatchSPA()}
        </section>
    );
}

export function ScoresheetModal({ data, closeModalCb }: { data: SocketIORedisMatchState; closeModalCb: (e: MouseEvent<HTMLButtonElement>) => void }) {
    return (
        <motion.div
            key='scoresheet-modal'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='flex flex-col absolute z-40 top-0 left-0 w-full h-full sm:h-[100vh] p-4 sm:p-0 items-center justify-center bg-black/25'>
            <motion.div className='flex flex-col gap-2 w-full sm:w-[420px] h-[55dvh]'>
                <button onClick={closeModalCb} className='flex gap-1 items-center py-2 px-4 bg-red-600 w-fit font-semibold text-white rounded-md shadow-md'>
                    <VisibilityOffIcon /> Close
                </button>
                <MatchResults data={data} />
            </motion.div>
        </motion.div>
    );
}
