"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button, Spinner, toast } from "@heroui/react";
import { oauthLoginApi } from "@/api/user";
import { useUserStore, type UserState } from "@/context/UserContext";
import { OAUTH_STATE_KEY } from "@/utils/sso";
import { routeByRole } from "@/views/LoginView";

/**
 * ADFS SSO 回调页：校验 state 防 CSRF -> 以授权码换取本系统会话 -> 按角色跳转。
 * 仅客户端解析 window.location.search，避免 useSearchParams 需 Suspense 包裹。
 */
export default function OauthCallbackView() {
  const t = useTranslations("oauth");
  const router = useRouter();
  const userStore = useUserStore();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code) {
      toast.danger(t("missingCode"));
      setFailed(true);
      return;
    }

    // CSRF 校验：state 必须与授权请求时生成并暂存的一致
    const savedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (!savedState || savedState !== state) {
      toast.danger(t("stateMismatch"));
      setFailed(true);
      return;
    }
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    // oauthToken 已废弃，接口层固定传空串；state 仅用于前端 CSRF 校验
    oauthLoginApi(code)
      .then((data) => {
        userStore
          .saveUser({ ...data } as UserState)
          .then(() => {
            router.replace(routeByRole(data.role));
          });
      })
      .catch((error) => {
        toast.danger((error as Error).message);
        setFailed(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-[#f0f2f5]">
      {failed ? (
        <>
          <div className="text-gray-700">{t("failed")}</div>
          <Button variant="primary" onPress={() => router.replace("/f/007/login")}>
            {t("backToLogin")}
          </Button>
        </>
      ) : (
        <>
          <Spinner aria-label={t("loading")} />
          <div className="text-gray-600">{t("signingIn")}</div>
        </>
      )}
    </div>
  );
}
