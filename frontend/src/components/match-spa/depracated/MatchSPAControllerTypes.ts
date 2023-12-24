import { MatchState } from "@/lib/types";
import { Socket } from "socket.io-client";


// USER DETAILS
export interface MatchSPAUserDetails {
    id: string;
    university: string;
    first_name: string;
    last_name: string;
    connected: boolean;
}

export interface LobbyUserDetails extends MatchSPAUserDetails {
    ready: boolean;
}

export interface SubmissionForm extends MatchSPAUserDetails {
    // id in SubmissionForm is the user someone is submitting for
    arrows: null[] | number[];
}

export interface ConfirmationForm extends MatchSPAUserDetails {
    arrows: number[];
    confirmation: "pending" | boolean;
}


// MATCH STATE AND PROPS
export type MatchSPAState = "lobby" | "submit" | "confirmation" | "finished" | "paused" | "connecting" | "connect error"

export interface MatchSPAControllerStates<S extends MatchSPAState> {
    pageState: S;
    pageProps: MatchSPAStateProps[S];
}

export type MatchSPAStateProps = {
    "lobby": MatchSPALobbyProps,
    "submit": MatchSPASubmitProps,
    "confirmation": MatchSPAConfirmationProps,
    "finished": MatchSPAFinishedProps,
    "connect error": MatchSPAErrorProps,
    "connecting": undefined,
    "paused": MatchSPAPausedProps
}

export interface MatchSPALobbyProps {
    isOpen: boolean;
    registeredUsers: LobbyUserDetails[];
}

export interface MatchSPASubmitProps {
    submissionForms: SubmissionForm[];
}

export interface MatchSPAConfirmationProps {
    confirmationForms: ConfirmationForm[];
}

export interface MatchSPAPausedProps {
    reason: string;
    data: any;
}

export interface MatchSPAFinishedProps {
    scoresSaved: "pending" | boolean;
    scoresValidated: "pending" | boolean;
    error?: string;
}

export interface MatchSPAErrorProps {
    errorMessage: string
}