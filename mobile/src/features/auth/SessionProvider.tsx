import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { api, apiErrorMessage } from '@/lib/api';
import { auth, type AuthSession, type Guardian } from '@/features/auth/services/auth';
import { sessionStorage, SessionStorageError } from '@/features/auth/sessionStorage';

type SessionState = {
  status: 'initializing' | 'signedOut' | 'authenticated';
  session: AuthSession | null;
  busy: boolean;
  error: string | null;
  canRetryRestore: boolean;
};

type SessionContextValue = SessionState & {
  guardian: Guardian | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retryRestore: () => Promise<void>;
  clearError: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const initialState: SessionState = {
  status: 'initializing',
  session: null,
  busy: true,
  error: null,
  canRetryRestore: false,
};

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SessionState>(initialState);
  const operationId = useRef(0);
  const activeToken = useRef<string | null>(null);

  const restore = useCallback(async () => {
    const operation = ++operationId.current;
    setState({ status: 'initializing', session: null, busy: true, error: null, canRetryRestore: false });

    try {
      const storedSession = await sessionStorage.get();
      if (operation !== operationId.current) return;

      if (!storedSession) {
        activeToken.current = null;
        api.setAccessToken(null);
        setState({ status: 'signedOut', session: null, busy: false, error: null, canRetryRestore: false });
        return;
      }

      if (storedSession.expiresAt <= Date.now()) {
        await sessionStorage.remove();
        if (operation !== operationId.current) return;
        activeToken.current = null;
        api.setAccessToken(null);
        setState({ status: 'signedOut', session: null, busy: false, error: null, canRetryRestore: false });
        return;
      }

      activeToken.current = storedSession.accessToken;
      api.setAccessToken(storedSession.accessToken);
      const guardian = await auth.me(storedSession.accessToken);
      if (operation !== operationId.current) return;

      const session = { ...storedSession, guardian };
      setState({ status: 'authenticated', session, busy: false, error: null, canRetryRestore: false });
    } catch (error) {
      if (operation !== operationId.current) return;
      setState({
        status: 'signedOut',
        session: null,
        busy: false,
        error: error instanceof SessionStorageError
          ? 'Não foi possível acessar a sessão segura. Tente novamente.'
          : apiErrorMessage(error),
        canRetryRestore: true,
      });
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(restore);
  }, [restore]);

  const invalidate = useCallback((token: string) => {
    if (activeToken.current !== token) return;

    const operation = ++operationId.current;
    activeToken.current = null;
    api.setAccessToken(null);
    setState({
      status: 'signedOut',
      session: null,
      busy: false,
      error: 'Sua sessão expirou. Entre novamente.',
      canRetryRestore: false,
    });
    void sessionStorage.remove().catch(() => {
      if (operation === operationId.current) {
        setState((current) => ({
          ...current,
          error: 'A sessão expirou, mas não foi possível removê-la do armazenamento seguro.',
        }));
      }
    });
  }, []);

  useEffect(() => {
    api.onUnauthorized(invalidate);
    return () => api.onUnauthorized(null);
  }, [invalidate]);

  const signIn = useCallback(async (email: string, password: string) => {
    const operation = ++operationId.current;
    activeToken.current = null;
    api.setAccessToken(null);
    setState({ status: 'signedOut', session: null, busy: true, error: null, canRetryRestore: false });

    try {
      const session = await auth.login(email, password);
      if (operation !== operationId.current) return;
      await sessionStorage.set(session);
      if (operation !== operationId.current) return;

      activeToken.current = session.accessToken;
      api.setAccessToken(session.accessToken);
      setState({ status: 'authenticated', session, busy: false, error: null, canRetryRestore: false });
    } catch (error) {
      if (operation !== operationId.current) return;
      setState({
        status: 'signedOut',
        session: null,
        busy: false,
        error: error instanceof SessionStorageError
          ? 'Não foi possível proteger a sessão neste dispositivo.'
          : apiErrorMessage(error),
        canRetryRestore: false,
      });
    }
  }, []);

  const signOut = useCallback(async () => {
    if (state.status !== 'authenticated' || !state.session) return;

    const operation = ++operationId.current;
    const session = state.session;
    activeToken.current = null;
    api.setAccessToken(null);
    setState({ status: 'authenticated', session, busy: true, error: null, canRetryRestore: false });

    try {
      await sessionStorage.remove();
      if (operation !== operationId.current) return;
      setState({ status: 'signedOut', session: null, busy: false, error: null, canRetryRestore: false });
    } catch {
      if (operation !== operationId.current) return;
      activeToken.current = session.accessToken;
      api.setAccessToken(session.accessToken);
      setState({
        status: 'authenticated',
        session,
        busy: false,
        error: 'Não foi possível encerrar a sessão no armazenamento seguro. Tente novamente.',
        canRetryRestore: false,
      });
    }
  }, [state.session, state.status]);

  const clearError = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
  }, []);

  useEffect(() => {
    if (state.status !== 'authenticated' || !state.session) return;

    const session = state.session;
    const expireIfNeeded = () => {
      if (Date.now() >= session.expiresAt) invalidate(session.accessToken);
    };
    const delay = session.expiresAt - Date.now();
    if (delay <= 0) {
      invalidate(session.accessToken);
      return;
    }

    const timeout = setTimeout(expireIfNeeded, delay);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') expireIfNeeded();
    });
    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [invalidate, state.session, state.status]);

  const value = useMemo<SessionContextValue>(() => ({
    ...state,
    guardian: state.session?.guardian ?? null,
    signIn,
    signOut,
    retryRestore: restore,
    clearError,
  }), [clearError, restore, signIn, signOut, state]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be wrapped in SessionProvider');
  return value;
}
