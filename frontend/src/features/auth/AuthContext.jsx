import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  getSession,
  onAuthStateChange,
  setSession as persistSession,
  signOut as clearSession,
} from '../../services/authClient.js';
import { userService } from '../../services/userService.js';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const ensureUserProfile = async (user) => {
    if (!user) return;
    try {
      await userService.ensureProfile(user);
    } catch (error) {
      console.error('Erro ao garantir perfil do usuário:', error);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const session = await getSession();

        if (mounted && session) {
          console.log('[DEBUG] Sessão inicial encontrada:', session.user.email);
          setSession(session);

          await ensureUserProfile(session.user);
        }
      } catch (error) {
        console.error('[DEBUG] Erro checando sessão inicial:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    getInitialSession();

    const {
      data: { subscription },
    } = onAuthStateChange((event, session) => {
      console.log(`[DEBUG] Auth Event: ${event}`);

      if (mounted) {
        setSession(session);
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[DEBUG] Evento SIGNED_IN detectado. Disparando check...');
          ensureUserProfile(session.user);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setBackendSession = async (sessionData) => {
    if (sessionData) {
      const session = await persistSession(sessionData);
      setSession(session);
    }
  };

  const signOut = async () => {
    console.log('[DEBUG] Fazendo Logout...');
    await clearSession();
    setSession(null);
  };

  const value = {
    session,
    user: session?.user,
    loading,
    signOut,
    setBackendSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
