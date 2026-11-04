"use client";

import { useTranslations } from "next-intl";
import { IoLanguageOutline } from "react-icons/io5";
import { useLanguage } from "@/i18n/LanguageProvider";

/**
 * 右上角中/英切换按钮：
 * - 变体 "solid"（深色顶栏上，白字白边）与 "ghost"（浅色背景，紫字）；
 * - iconOnly 时仅显示图标（如登录页背景图右上角），其余场景图标+文字；
 * - aria-label 跟随当前语言，便于读屏。
 */
export default function LanguageToggle({
  variant = "ghost",
  iconOnly = false,
  className = "",
}: {
  variant?: "solid" | "ghost";
  iconOnly?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const { locale, toggleLocale } = useLanguage();

  const base =
    "flex items-center gap-1.5 px-2.5 h-8 rounded-md text-sm font-medium cursor-pointer select-none transition-colors";
  const style =
    variant === "solid"
      ? "text-white/90 border border-white/40 hover:bg-white/15 hover:text-white"
      : "text-[#5b2a86] border border-[#5b2a86]/40 hover:bg-[#f5f0fa]";

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={t("switchLanguage")}
      title={t("switchLanguage")}
      className={`${base} ${style} ${className}`}
    >
      <IoLanguageOutline size={iconOnly ? 18 : 16} />
      {!iconOnly && <span>{locale === "zh" ? "EN" : "中文"}</span>}
    </button>
  );
}
