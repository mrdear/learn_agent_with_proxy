import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  I18N_STORAGE_KEY,
  I18nContext,
  interpolate,
  isLocale,
  type I18nContextValue,
  type Locale,
  type TranslationParams,
} from "@/lib/i18n";

function getInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en-US";
  }

  const storedLocale = window.localStorage.getItem(I18N_STORAGE_KEY);
  if (isLocale(storedLocale)) {
    return storedLocale;
  }

  const browserLocale = window.navigator.language;
  return browserLocale.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(I18N_STORAGE_KEY, nextLocale);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "zh-CN" ? "en-US" : "zh-CN");
  }, [locale, setLocale]);

  const t = useCallback(
    (english: string, chinese: string, params?: TranslationParams) =>
      interpolate(locale === "zh-CN" ? chinese : english, params),
    [locale]
  );

  const formatText = useCallback(
    (text: Parameters<I18nContextValue["formatText"]>[0], params?: TranslationParams) =>
      interpolate(text[locale], params),
    [locale]
  );

  const formatDate = useCallback(
    (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
      new Date(value).toLocaleString(locale, options),
    [locale]
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, toggleLocale, t, formatText, formatDate }),
    [formatDate, formatText, locale, setLocale, t, toggleLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
