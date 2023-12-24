import { MatchState, UserSession } from "@/lib/types";
import { Socket } from "socket.io-client";

export interface MatchSPAPageProps {
    socket: Socket
}

export interface ConnectingPageProps extends MatchSPAPageProps {
    
}

export interface LobbyPageProps extends MatchSPAPageProps {
    lobbyProps: UserSession[]
}