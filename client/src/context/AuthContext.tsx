import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { User } from '../lib/types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const bootstrapPending = useRef(true);

  useEffect(() => {
    // Remove credentials stored by versions of the app that used localStorage JWTs.
    localStorage.removeItem('techfix_token');
    localStorage.removeItem('techfix_user');
    let active = true;
    const onUnauthorized = () => { if (active && !bootstrapPending.current) { setUser(null); queryClient.clear(); } };
    window.addEventListener('techfix:unauthorized', onUnauthorized);
    api.get('/auth/me')
      .then((response) => { if (active && bootstrapPending.current) setUser(response.data.data as User); })
      .catch(() => { if (active && bootstrapPending.current) setUser(null); })
      .finally(() => { if (active) { bootstrapPending.current = false; setLoading(false); } });
    return () => { active = false; window.removeEventListener('techfix:unauthorized', onUnauthorized); };
  }, []);

  async function login(username: string, password: string) {
    bootstrapPending.current = false;
    queryClient.clear();
    const response = await api.post('/auth/login', { username, password });
    setUser(response.data.data.user as User);
  }
  async function logout() {
    bootstrapPending.current = false;
    queryClient.clear();
    try { await api.post('/auth/logout'); }
    finally { setUser(null); }
  }
  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
