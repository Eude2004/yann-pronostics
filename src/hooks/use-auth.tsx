import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  const rolesRequestId = useRef(0);

  const loadRoles = async (userId: string | null) => {
    const requestId = ++rolesRequestId.current;
    if (!userId) {
      if (rolesRequestId.current !== requestId) return;
      setRoles([]);
      setRolesChecked(true);
      return;
    }
    try {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (rolesRequestId.current !== requestId) return;
      if (error) {
        setRoles([]);
      } else {
        setRoles((data ?? []).map((r) => r.role));
      }
    } finally {
      if (rolesRequestId.current === requestId) {
        setRolesChecked(true);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);

      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setRolesChecked(false);
        window.setTimeout(() => {
          if (!mounted) return;
          void loadRoles(s?.user?.id ?? null);
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setSessionChecked(true);
      void loadRoles(data.session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      rolesRequestId.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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
