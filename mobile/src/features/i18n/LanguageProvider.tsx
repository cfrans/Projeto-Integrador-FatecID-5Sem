import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';

import { deviceLanguage, localizeMessage, translate, type Language, type TranslationKey } from './translations';

export type { Language } from './translations';

const LANGUAGE_STORAGE_KEY = 'piplup-language-preference-v2';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  localize: (message: string) => string;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getDeviceLanguage(): Language {
  return deviceLanguage(getLocales()[0]?.languageTag ?? '');
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getDeviceLanguage);
  const manualPreference = useRef(false);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY)
      .then((storedLanguage) => {
        if (!active || manualPreference.current) return;
        if (storedLanguage === 'pt-BR' || storedLanguage === 'en' || storedLanguage === 'es') {
          manualPreference.current = true;
          setLanguageState(storedLanguage);
        }
      })
      .catch(() => undefined);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !manualPreference.current) {
        setLanguageState(getDeviceLanguage());
      }
    });

    return () => { active = false; subscription.remove(); };
  }, []);

  function setLanguage(nextLanguage: Language) {
    manualPreference.current = true;
    setLanguageState(nextLanguage);
    void SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, nextLanguage).catch(() => undefined);
  }

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, variables) => translate(language, key, variables),
      localize: (message) => localizeMessage(language, message),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
