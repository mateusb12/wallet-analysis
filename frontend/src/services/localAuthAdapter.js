const STORAGE_KEY = 'wallet-analysis-local-auth';
const listeners = new Set();

function readSession() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function notify(event, session) {
  listeners.forEach((callback) => callback(event, session));
}

export const localAuthAdapter = {
  async getSession() {
    return readSession();
  },

  onAuthStateChange(callback) {
    listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(callback),
        },
      },
    };
  },

  async setSession(session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    notify('SIGNED_IN', session);
    return session;
  },

  async signOut() {
    window.localStorage.removeItem(STORAGE_KEY);
    notify('SIGNED_OUT', null);
  },

  async signInWithGoogle() {
    throw new Error('Login com Google não está disponível no modo local');
  },
};
