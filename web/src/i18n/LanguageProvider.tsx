"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";

import { en } from "./messages/en";
import { zh } from "./messages/zh";

export type Locale = "zh" | "en";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "zh",
  setLocale: () => {},
  toggleLocale: () => {},
});

const STORAGE_KEY = "locale";

/** 初始语言：localStorage > 浏览器语言 > 中文 */
function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "zh" || saved === "en") return saved;
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

/**
 * 客户端 i18n 上下文（next-intl 无路由模式）：
 * - 语言存 localStorage，切换即时生效，不改变 URL；
 * - 同步 <html lang>，便于读屏与浏览器翻译识别；
 * - 消息按命名空间静态合并打包（内网应用，体积可接受）。
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    setLocaleState(resolveInitialLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocaleState(next);
        localStorage.setItem(STORAGE_KEY, next);
      },
      toggleLocale: () => {
        const next = locale === "zh" ? "en" : "zh";
        setLocaleState(next);
        localStorage.setItem(STORAGE_KEY, next);
      },
    }),
    [locale]
  );

  const messages = locale === "zh" ? zh : en;

  return (
    <LanguageContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Shanghai">
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
