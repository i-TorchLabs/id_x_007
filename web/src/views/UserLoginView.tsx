"use client";

import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";
import { redirectToAdfsAuthorize } from "@/utils/sso";
import LanguageToggle from "@/i18n/LanguageToggle";

/**
 * 学生/朋辈顾问登录页（/user-login）：复刻 /admin-login 的页面要素，
 * 移除账号密码登录与管理员注册，仅保留 CUHK SSO 统一认证登录入口。
 */
export default function UserLoginView() {
  const t = useTranslations("login");

  return (
    <div className="relative overflow-hidden h-screen w-full bg-[#3e1c5c] bg-[url('/LOGIN-BG.png')] bg-cover bg-center bg-no-repeat">
      {/* 右上角语言切换 */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle variant="solid" iconOnly />
      </div>
      <div className="w-full h-full flex items-center justify-center">
        {/* 毛玻璃卡片：半透明底 + backdrop-blur，透出背景图 */}
        <div className="flex rounded-[10px] overflow-hidden bg-white/60 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
          <div className="hidden md:flex relative min-w-[400px] w-[400px] h-[540px] flex-col justify-center items-center bg-[#5b2a86]/60 text-white px-10">
            <div className="text-[40px] font-bold tracking-wide">{t("brand")}</div>
            <div className="mt-4 text-[18px] text-center leading-8">{t("brandSub")}</div>
            <div className="mt-8 w-16 border-t-2 border-white/60" />
            <div className="mt-8 text-sm text-white/70 text-center">{t("brandSlogan")}</div>
          </div>
          <div className="w-[620px] max-w-full h-[540px] flex justify-center flex-col items-center bg-white/40">
            <div className="mb-3 font-bold text-[28px] text-center px-6">{t("title")}</div>
            <div className="mb-4 font-normal text-[20px]">{t("loginTitle")}</div>
            <div className="w-3/5">
              {/* 学生与朋辈顾问走 CUHK ADFS 单点登录（授权码流） */}
              <Button fullWidth variant="primary" onPress={() => redirectToAdfsAuthorize("student")}>
                {t("ssoLogin")}
              </Button>
              <div className="mt-2 text-xs text-gray-500 text-center">{t("ssoTip")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
