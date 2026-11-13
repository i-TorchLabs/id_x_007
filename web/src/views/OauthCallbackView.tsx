"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AlertDialog, Button, Spinner } from "@heroui/react";
import { oauthLoginApi } from "@/api/user";
import { useUserStore, type UserState } from "@/context/UserContext";
import { OAUTH_PORTAL_KEY, OAUTH_STATE_KEY, setSsoLoginFlag } from "@/utils/sso";
import { routeByRole } from "@/views/LoginView";

/**
 * ADFS SSO 回调页：校验 state 防 CSRF -> 以授权码换取本系统会话 -> 按角色跳转。
 * 仅客户端解析 window.location.search，避免 useSearchParams 需 Suspense 包裹。
 */
export default function OauthCallbackView() {
  const t = useTranslations("oauth");
  const router = useRouter();
  const userStore = useUserStore();
  // 登录失败的错误消息（非空即失败）：以页面中央弹窗展示，不用右下角 toast
  const [errorMsg, setErrorMsg] = useState("");
  // 发起 SSO 的登录入口：失败时据此返回对应登录页（advisor -> /admin-login）
  const [portal, setPortal] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code) {
      setErrorMsg(t("missingCode"));
      return;
    }

    // CSRF 校验：state 必须与授权请求时生成并暂存的一致
    const savedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (!savedState || savedState !== state) {
      setErrorMsg(t("stateMismatch"));
      return;
    }
    sessionStorage.removeItem(OAUTH_STATE_KEY);

    // 发起入口回传后端：顾问入口（advisor）强制白名单校验，学生入口放行
    const ssoPortal = sessionStorage.getItem(OAUTH_PORTAL_KEY) ?? "";
    sessionStorage.removeItem(OAUTH_PORTAL_KEY);
    setPortal(ssoPortal);

    // state 已在上方完成 CSRF 校验，原样回传仅供服务端日志追溯
    oauthLoginApi(code, state ?? "", ssoPortal)
      .then((data) => {
        userStore
          .saveUser({ ...data } as UserState)
          .then(() => {
            // 标记本会话由 SSO 建立：登出时据此联动 ADFS 单点登出
            setSsoLoginFlag();
            router.replace(routeByRole(data.role));
          });
      })
      .catch((error) => {
        // 后端拒绝消息（如白名单校验失败）直接展示；无消息时用通用文案
        setErrorMsg((error as Error).message || t("failed"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToLogin = () =>
    router.replace(portal === "advisor" ? "/f/007/admin-login" : "/f/007/user-login");

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-[#f0f2f5]">
      {!errorMsg && (
        <>
          <Spinner aria-label={t("loading")} />
          <div className="text-gray-600">{t("signingIn")}</div>
        </>
      )}
      {/* 登录失败：页面中央弹窗展示错误消息；关闭即返回对应登录页 */}
      <AlertDialog isOpen={!!errorMsg} onOpenChange={(open) => !open && backToLogin()}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container placement="center">
            <AlertDialog.Dialog className="min-w-[360px]">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>{t("failedTitle")}</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>{errorMsg}</AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="primary" onPress={backToLogin}>
                  {t("backToLogin")}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  );
}
