'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getBrowserSupabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
}

const Ctx = createContext<AuthContext>({
  user: null, session: null, loading: true,
  signIn: async () => null, signOut: async () => {},
  signUp: async () => null, signInWithGoogle: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getBrowserSupabase();
    if (!db) { setLoading(false); return; }

    db.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = db.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const db = getBrowserSupabase();
    if (!db) return 'Supabase not configured';
    const { error } = await db.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signOut = async () => {
    const db = getBrowserSupabase();
    if (db) await db.auth.signOut();
  };

  const signUp = async (email: string, password: string): Promise<string | null> => {
    const db = getBrowserSupabase();
    if (!db) return 'Supabase not configured';
    const { error } = await db.auth.signUp({ email, password });
    return error?.message ?? null;
  };

  const signInWithGoogle = async (): Promise<string | null> => {
    const db = getBrowserSupabase();
    if (!db) return 'Supabase not configured';
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    return error?.message ?? null;
  };

  return (
    <Ctx.Provider value={{ user, session, loading, signIn, signOut, signUp, signInWithGoogle }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
