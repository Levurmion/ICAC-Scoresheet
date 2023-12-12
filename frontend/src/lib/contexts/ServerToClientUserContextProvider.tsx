"use client";

import { User } from "@supabase/supabase-js";
import { ReactNode, createContext, useContext, useState } from "react";

const UserContext = createContext<null | User>(null);

export const useUserContext = () => useContext(UserContext);

export default function ServerToClientUserContextProvider ({ children, value }: { children: ReactNode, value: User | null }) {

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
