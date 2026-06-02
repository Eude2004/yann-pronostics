import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: string[];
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [rolesChecked, setRolesChecked] = useState(false);

  const loadRoles = async (userId: string | null) => {
    if (!userId) {
      setRoles([]);
      setRolesChecked(true);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role));
    setRolesChecked(true);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setRolesChecked(false);
      // defer to avoid recursion
      setTimeout(() => loadRoles(s?.user?.id ?? null), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
      loadRoles(data.session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.location.assign("/");
    }
  };

  // loading = true until we've checked the session AND (if signed in) loaded the roles
  const loading = !sessionChecked || (!!session && !rolesChecked);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        isAdmin: roles.includes("admin"),
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const DEFAULT_AUTH: AuthContextValue = {
  session: null,
  user: null,
  roles: [],
  isAdmin: false,
  loading: true,
  signOut: async () => {},
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx ?? DEFAULT_AUTH;
}
