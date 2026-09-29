import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore } from './api';
export type Role = 'ADMIN' | 'ANALYST' | 'STAFF';
export interface User { id: string; name: string; email: string; role: Role; hospitalId: number | null; hospitalName: string | null }
interface Ctx { user: User | null; loading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => void }
const AuthCtx = createContext<Ctx>(null!);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());
  const qc = useQueryClient();
  useEffect(() => {
    if (tokenStore.get()) api<User>('/auth/me').then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
    const off = () => { setUser(null); qc.clear(); };
    window.addEventListener('mc:logout', off); return () => window.removeEventListener('mc:logout', off);
  }, [qc]);
  const login = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } });
    tokenStore.set(r.token); setUser(r.user);
  };
  const logout = () => { tokenStore.clear(); setUser(null); qc.clear(); };
  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
export const can = (u: User | null, ...roles: Role[]) => !!u && roles.includes(u.role);
