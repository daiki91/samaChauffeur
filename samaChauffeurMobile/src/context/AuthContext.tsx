import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  getMe,
  hydrateAuthToken,
  login as apiLogin,
  logoutCall,
  registerUser,
  setAuthToken,
  setChauffeurAvailability,
} from '@/lib/api';
import { connectPresenceSocket } from '@/lib/socket';
import { clearTokens, getRefreshToken, saveTokens } from '@/lib/tokenStorage';
import type { AppMode, Chauffeur, Role, User } from '@/types';

type RegisterPayload = { username: string; phone: string; password: string; role: 'CLIENT' | 'CHAUFFEUR' };

type AuthContextValue = {
  user: User | null;
  chauffeur: Chauffeur | null;
  mode: AppMode;
  loading: boolean;
  isAuthenticated: boolean;
  canDriverMode: boolean;
  login: (phone: string, password: string) => Promise<Role>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  refreshChauffeurStatus: () => Promise<void>;
  setMode: (mode: AppMode) => void;
  updateChauffeur: (c: Chauffeur) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [chauffeur, setChauffeur] = useState<Chauffeur | null>(null);
  const [mode, setModeState] = useState<AppMode>('passenger');
  const [loading, setLoading] = useState(true);
  const presenceSocketRef = useRef<Socket | null>(null);

  const refreshMe = useCallback(async () => {
    const res = await getMe();
    setUser(res.data);
  }, []);

  // There is no dedicated "GET my chauffeur profile" endpoint on the backend — the
  // availability toggle endpoint returns the full chauffeur record (incl. is_verified),
  // so we use it with the current value as a safe, side-effect-free-ish way to sync status.
  const refreshChauffeurStatus = useCallback(async () => {
    try {
      const res = await setChauffeurAvailability(false);
      setChauffeur(res.data);
    } catch {
      // not a chauffeur yet, or request failed — ignore
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await hydrateAuthToken();
        if (token) {
          await refreshMe();
        }
      } catch {
        await clearTokens();
        setAuthToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMe]);

  useEffect(() => {
    if (user?.role === 'CHAUFFEUR') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync chauffeur status when role becomes CHAUFFEUR
      refreshChauffeurStatus();
    }
  }, [user?.role, refreshChauffeurStatus]);

  // Fire-and-forget presence heartbeat — no UI here, it just makes this user show up as
  // "online" to admins. Connects for any restored (app boot) or fresh (login) session.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const socket = await connectPresenceSocket();
      if (!socket || !active) return;
      presenceSocketRef.current = socket;
    })();
    return () => {
      active = false;
      presenceSocketRef.current?.disconnect();
      presenceSocketRef.current = null;
    };
  }, [user]);

  const login = useCallback(
    async (phone: string, password: string) => {
      const res = await apiLogin(phone, password);
      const { access, refresh, role } = res.data;
      await saveTokens(access, refresh);
      setAuthToken(access);
      await refreshMe();
      setModeState(role === 'CHAUFFEUR' ? 'passenger' : 'passenger');
      return role as Role;
    },
    [refreshMe],
  );

  const register = useCallback(async (payload: RegisterPayload) => {
    await registerUser(payload);
  }, []);

  const logout = useCallback(async () => {
    try {
      const refresh = await getRefreshToken();
      if (refresh) await logoutCall(refresh);
    } catch {
      // ignore network errors on logout
    }
    await clearTokens();
    setAuthToken(null);
    presenceSocketRef.current?.disconnect();
    presenceSocketRef.current = null;
    setUser(null);
    setChauffeur(null);
    setModeState('passenger');
  }, []);

  const setMode = useCallback((next: AppMode) => setModeState(next), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      chauffeur,
      mode,
      loading,
      isAuthenticated: !!user,
      canDriverMode: user?.role === 'CHAUFFEUR' && !!chauffeur?.is_verified,
      login,
      register,
      logout,
      refreshMe,
      refreshChauffeurStatus,
      setMode,
      updateChauffeur: setChauffeur,
    }),
    [user, chauffeur, mode, loading, login, register, logout, refreshMe, refreshChauffeurStatus, setMode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
