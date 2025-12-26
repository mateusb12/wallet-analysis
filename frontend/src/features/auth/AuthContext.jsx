import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../../services/supabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAndCreateUser = async (user) => {
    if (!user) {
      console.log('[DEBUG] checkAndCreateUser chamado sem usuário. Abortando.');
      return;
    }

    console.group('🔍 [DEBUG] Verificação de Usuário');
    console.log('1. User ID Auth:', user.id);
    console.log('2. Metadados (Google):', user.user_metadata);

    try {
      console.log('3. Buscando no banco public.users...');
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single();

      console.log('4. Resultado da busca:', { existingUser, fetchError });

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Erro crítico ao buscar usuário:', fetchError);
        console.groupEnd();
        return;
      }

      if (!existingUser) {
        console.log('5. Usuário NÃO encontrado no banco. Preparando INSERT...');

        const payload = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata.full_name || user.user_metadata.name,
          avatar_url: user.user_metadata.avatar_url,
        };
        console.log('6. Payload para envio:', payload);

        const { error: insertError } = await supabase.from('users').insert([payload]);

        if (insertError) {
          console.error('❌ ERRO NO INSERT:', insertError);
          console.error('DICA: Se o erro for 401/403, verifique as Policies (RLS) no Supabase!');
        } else {
          console.log('✅ SUCESSO! Usuário criado na tabela publica.');
        }
      } else {
        console.log('ℹ️ Usuário já existe no banco. Nenhuma ação necessária.');
      }
    } catch (err) {
      console.error('❌ EXCEÇÃO (Try/Catch):', err);
    } finally {
      console.groupEnd();
    }
  };

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (mounted && session) {
          console.log('[DEBUG] Sessão inicial encontrada:', session.user.email);
          setSession(session);

          checkAndCreateUser(session.user);
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[DEBUG] Auth Event: ${event}`);

      if (mounted) {
        setSession(session);
        setLoading(false);

        if (event === 'SIGNED_IN' && session?.user) {
          console.log('[DEBUG] Evento SIGNED_IN detectado. Disparando check...');
          checkAndCreateUser(session.user);
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
      const { error } = await supabase.auth.setSession({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
      });
      if (error) throw error;
      setSession(sessionData);
    }
  };

  const signOut = async () => {
    console.log('[DEBUG] Fazendo Logout...');
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
