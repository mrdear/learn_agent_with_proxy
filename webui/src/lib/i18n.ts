import { createContext, useContext } from "react";

export type Locale = "en-US" | "zh-CN";

export type LocalizedText = {
  "en-US": string;
  "zh-CN": string;
};

export type TranslationParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (english: string, chinese: string, params?: TranslationParams) => string;
  formatText: (text: LocalizedText, params?: TranslationParams) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
};

export const I18N_STORAGE_KEY = "learn-agent-locale";

export const I18nContext = createContext<I18nContextValue | null>(null);

export function localizedText(english: string, chinese: string): LocalizedText {
  return {
    "en-US": english,
    "zh-CN": chinese,
  };
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en-US" || value === "zh-CN";
}

export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key];
    return value === null || value === undefined ? match : String(value);
  });
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }

  return context;
}
