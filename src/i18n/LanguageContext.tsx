import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getAppLanguage,
  setAppLanguage,
  type AppLanguage,
} from '../services/maintenanceManager';
import { getTranslations, type AppTranslations } from './translations';

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  t: AppTranslations;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'id',
  setLang: () => {},
  t: getTranslations('id'),
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(() => getAppLanguage());

  const setLang = useCallback((nextLang: AppLanguage) => {
    setAppLanguage(nextLang);
    setLangState(nextLang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  }, [lang]);

  const t = getTranslations(lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
