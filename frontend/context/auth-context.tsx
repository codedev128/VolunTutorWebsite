"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: "tutor" | "student";
}

export type TutorUser = AppUser;

interface StoredUser extends AppUser {
  password: string;
}

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  signUp: (name: string, email: string, password: string, role?: "tutor" | "student") => { ok: boolean; error?: string; user?: AppUser };
  signIn: (email: string, password: string) => { ok: boolean; error?: string; user?: AppUser };
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("vt_session");
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore
    }
    setIsLoading(false);
  }, []);

  function signUp(name: string, email: string, password: string, role: "tutor" | "student" = "tutor") {
    const users: StoredUser[] = JSON.parse(localStorage.getItem("vt_users") || "[]");
    if (users.find((u) => u.email === email)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    const newUser: AppUser = { id: Date.now().toString(), name, email, role };
    users.push({ ...newUser, password });
    localStorage.setItem("vt_users", JSON.stringify(users));
    localStorage.setItem("vt_session", JSON.stringify(newUser));
    setUser(newUser);
    return { ok: true, user: newUser };
  }

  function signIn(email: string, password: string) {
    const users: StoredUser[] = JSON.parse(localStorage.getItem("vt_users") || "[]");
    const found = users.find((u) => u.email === email && u.password === password);
    if (!found) return { ok: false, error: "Incorrect email or password." };
    if (localStorage.getItem(`vt_banned_${found.id}`)) {
      return { ok: false, error: "Your account has been suspended. Please contact support." };
    }
    const { password: _pw, ...session } = found;
    localStorage.setItem("vt_session", JSON.stringify(session));
    setUser(session);
    return { ok: true, user: session };
  }

  function signOut() {
    localStorage.removeItem("vt_session");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
