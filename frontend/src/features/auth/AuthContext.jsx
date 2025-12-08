import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../../services/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (mounted && session) setSession(session);
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setBackendSession = async (sessionData) => {
    if (sessionData) {
      const { error } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
      });
      if (error) throw error;
      setSession(sessionData);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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
