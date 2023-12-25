import { ClientToServerEvents, MatchState, ServerToClientEvents, SocketIORedisMatchState, UserSession } from "@/lib/types";
import { Socket } from "socket.io-client";

export type MatchSPAPagesWithData = "paused" | "lobby" | "submit" | "confirmation" | "finished";
export type MatchSPAPagesWithoutData = "connecting" | "error"

export type MatchStateWithData = {
    page: MatchSPAPagesWithData,
    data: SocketIORedisMatchState,
    reply?: string
} 

export type MatchStateWithoutData = {
    page: MatchSPAPagesWithoutData,
    data: null,
    reply?: string
}

// discriminated union
export type MatchSPAControllerStates = MatchStateWithData | MatchStateWithoutData

export interface MatchSPAPageProps {
    socket: Socket<ServerToClientEvents, ClientToServerEvents>;
}

export interface ConnectingPageProps extends MatchSPAPageProps {}

export interface ErrorPageProps extends MatchSPAPageProps {
    error: string;
}

export interface PausedModalProps extends MatchSPAPageProps {
    data: SocketIORedisMatchState | null
}

export interface LobbyPageProps extends MatchSPAPageProps {
    data: SocketIORedisMatchState;
}

export interface SubmitPageProps extends MatchSPAPageProps {
    data: SocketIORedisMatchState;
}
