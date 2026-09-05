import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  getSession,
  isCurrentUserAdmin,
  onAuthStateChange,
  signInWithPassword,
  signOut as signOutRepo,
} from "../services/authRepository";

interface AdminAuthState {
  loading: boolean;
  session: Session | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function refreshAdminFlag(s: Session | null) {
      if (!s) {
        if (active) setIsAdmin(false);
        return;
      }
      const admin = await isCurrentUserAdmin().catch(() => false);
      if (active) setIsAdmin(admin);
    }

    async function init() {
      const s = await getSession();
      if (!active) return;
      setSession(s);
      await refreshAdminFlag(s);
      if (active) setLoading(false);
    }
    init();

    const unsubscribe = onAuthStateChange((s) => {
      setSession(s);
      void refreshAdminFlag(s);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithPassword(email, password);
  }

  async function signOut() {
    await signOutRepo();
  }

  return (
    <AdminAuthContext.Provider value={{ loading, session, isAdmin, signIn, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth, AdminAuthProvider içinde kullanılmalı");
  return ctx;
}
