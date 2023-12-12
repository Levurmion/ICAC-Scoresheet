"use client";

import useSocketIOClient from "@/lib/useSocketIOClient";
import { useEffect, useState } from "react";
import ClientInput from "../input/ClientInput";
import ClientButton from "../input/ClientButton";
import clientSocket from "@/lib/useSocketIOClient";
import { useRouter } from "next/navigation";
import { LobbyUserDetails, MatchSPAControllerStates, MatchSPALobbyProps, MatchSPAState, MatchSPAStateProps } from "./MatchSPAControllerTypes";
import ErrorPage from "./ErrorPage";
import ConnectingPage from "./ConnectingPage";
import LobbyPage from "./LobbyPage";
import { LiveMatch } from "@/lib/types";
import { useUserContext } from "@/lib/contexts/ServerToClientUserContextProvider";

export default function MatchSPAController() {
    const [matchSPAState, setMatchSPAState] = useState<MatchSPAControllerStates<MatchSPAState>>({ pageState: "connecting", pageProps: undefined });
    const [matchMetadata, setMatchMetadata] = useState<LiveMatch | null>(null);
    const router = useRouter();
    const userContext = useUserContext();

    const handleLeaveMatch = () => {
        if (matchSPAState.pageState === "connect error") {
            router.push("/user");
        } else {
            clientSocket.emit("client:leave");
        }
    };

    useEffect(() => {
        const onConnect = () => {
            clientSocket.emit("client:request-init", (matchData: { lobbyPayload: MatchSPALobbyProps; matchDetails: LiveMatch }) => {
                setMatchMetadata(matchData.matchDetails);
                setMatchSPAState({
                    pageState: "lobby",
                    // force initialize because "server:lobby-update" frequently not received on connect
                    pageProps: matchData.lobbyPayload,
                });
            });
        };

        const onConnectError = (error: any) => {
            setMatchSPAState({
                pageState: "connect error",
                pageProps: {
                    clientSocket,
                    errorMessage: error.message,
                },
            } as MatchSPAControllerStates<"connect error">);
        };

        const onDisconnect = (reason: any) => {
            if (reason === "io server disconnect") {
                router.push("/user");
            } else {
                alert(reason);
                setMatchSPAState({
                    pageState: "connecting",
                    pageProps: undefined,
                });
            }
        };

        const onLobbyUpdate = (payload: { registeredUsers: LobbyUserDetails[]; isOpen: boolean }) => {
            setMatchSPAState({
                pageState: "lobby", // "open" | "full" does the same thing
                pageProps: payload,
            } as MatchSPAControllerStates<"lobby">);
        };

        clientSocket.connect();

        clientSocket.on("connect", onConnect);
        clientSocket.on("connect_error", onConnectError);
        clientSocket.on("disconnect", onDisconnect);
        clientSocket.on("server:lobby-update", onLobbyUpdate);

        return () => {
            clientSocket.off("connect", onConnect);
            clientSocket.off("connect_error", onConnectError);
            clientSocket.off("disconnect", onDisconnect);
            clientSocket.off("server:lobby-update", onLobbyUpdate);
        };
    }, []);

    const renderMatchSPA = () => {
        switch (matchSPAState.pageState) {
            case "connecting":
                return <ConnectingPage clientSocket={clientSocket} />;
            case "connect error":
                return <ErrorPage clientSocket={clientSocket} {...(matchSPAState as MatchSPAControllerStates<"connect error">).pageProps} />;
            case "lobby":
                return <LobbyPage clientSocket={clientSocket} {...(matchSPAState as MatchSPAControllerStates<"lobby">).pageProps} />;
        }
    };

    const renderMatchHeaders = () => {
        if (matchSPAState.pageState !== "connect error" && matchSPAState.pageState !== "connecting" && matchMetadata !== null) {
            const { round, num_ends, arrows_per_end, name } = matchMetadata;

            return (
                <section className='w-full h-fit flex flex-col gap-2'>
                    <h1 className='font-bold text-black'>{name}</h1>
                    <div>
                        {round && <p className='font-bold text-black -mb-1 text-responsive__xx-large'>{matchMetadata?.round}</p>}
                        <p className='font-medium text-beige-900 text-responsive__xx-large'>
                            {num_ends} ends of {arrows_per_end} arrows
                        </p>
                    </div>
                </section>
            );
        }
    };

    useEffect(() => {
        console.log(matchSPAState);
    }, [matchSPAState]);

    return (
        <div className='w-full h-full flex flex-col gap-2 justify-between'>
            {renderMatchHeaders()}
            {renderMatchSPA()}
            <div className='w-full h-fit'>
                <ClientButton onClickHandler={handleLeaveMatch}>
                    <span className='block text-responsive__large p-2 font-semibold'>Leave Match</span>
                </ClientButton>
            </div>
        </div>
    );
}
