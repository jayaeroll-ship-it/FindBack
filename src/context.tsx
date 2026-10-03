import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, setCsrf } from "./api";
import type { Config, User } from "./types";
const AppContext = createContext<{
  user: User | null;
  config: Config | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  configError: string;
}>({
  user: null,
  config: null,
  ready: false,
  setUser: () => {},
  configError: "",
});
export const useApp = () => useContext(AppContext);
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null),
    [config, setConfig] = useState<Config | null>(null),
    [ready, setReady] = useState(false),
    [configError, setConfigError] = useState("");
  const setUser = (value: User | null) => {
    setUserState(value);
    setCsrf(value?.csrf || "");
  };
  useEffect(() => {
    void Promise.all([
      api<{ user: User | null }>("/auth/session")
        .then(({ user }) => setUser(user))
        .catch(() => setUser(null)),
      api<Config>("/config")
        .then(setConfig)
        .catch(() =>
          setConfigError(
            "Cannot connect to FindBack. Start the API or try again later.",
          ),
        ),
    ]).finally(() => setReady(true));
  }, []);
  return (
    <AppContext.Provider value={{ user, config, ready, setUser, configError }}>
      {children}
    </AppContext.Provider>
  );
}
