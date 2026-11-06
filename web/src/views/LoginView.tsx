"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, InputGroup, TextField, toast } from "@heroui/react";
import { loginApi, registerApi } from "@/api/user";
import { useUserStore, type UserState } from "@/context/UserContext";
import { redirectToAdfsAuthorize } from "@/utils/sso";
import LanguageToggle from "@/i18n/LanguageToggle";
import PasswordInput from "@/components/pa/PasswordInput";

/** 登录成功后按角色跳转 */
export const routeByRole = (role: string): string => {
  if (role === "admin") return "/f/007/admin/advisor-management";
  if (role === "advisor") return "/f/007/advisor/schedule";
  return "/f/007/user/advisors";
};

/** 后端 428/登录失败时携带的验证码载荷 */
interface CaptchaData {
  need_captcha?: string;
  captcha_id?: string;
  image_base64?: string;
}

export default function LoginView() {
  const t = useTranslations("login");
  // login：管理员/顾问账密登录；register：管理员注册（注册后待运维激活）
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // 注册附加字段
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  // 验证码（复刻 id_x_003 漏洞报告 #3）：仅登录链路，连续失败后触发
  const [needCaptcha, setNeedCaptcha] = useState(false);
  const [captchaId, setCaptchaId] = useState("");
  const [captchaImg, setCaptchaImg] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const router = useRouter();
  const userStore = useUserStore();

  /** 428/失败响应里带验证码则展示（仅登录链路） */
  const applyCaptcha = (d?: CaptchaData): boolean => {
    if (d?.need_captcha === "true" && d?.image_base64) {
      setNeedCaptcha(true);
      setCaptchaId(d.captcha_id || "");
      setCaptchaImg(d.image_base64);
      setCaptchaCode("");
      return true;
    }
    return false;
  };

  /** 切换登录/注册时清理模式专属状态（验证码一并重置） */
  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setNeedCaptcha(false);
    setCaptchaId("");
    setCaptchaImg("");
    setCaptchaCode("");
  };

  const onLogin = () => {
    setLoading(true);
    loginApi({
      username,
      password,
      captcha_id: captchaId,
      captcha_code: captchaCode,
    })
      .then((data) => {
        userStore
          .saveUser({
            ...data,
            username: data.username || username,
          } as UserState)
          .then(() => {
            router.push(routeByRole(data.role));
            setLoading(false);
          });
      })
      .catch((error) => {
        setLoading(false);
        applyCaptcha((error as { data?: CaptchaData })?.data);
        toast.danger((error as Error).message);
      });
  };

  const onRegister = () => {
    // 前端先行校验（后端同规则兜底）；邮箱即登录用户名
    if (!email.trim() || !password || !name.trim()) {
      toast.danger(t("validation.required"));
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      toast.danger(t("validation.emailInvalid"));
      return;
    }
    if (password.length < 6) {
      toast.danger(t("validation.passwordShort"));
      return;
    }
    if (password !== confirmPassword) {
      toast.danger(t("validation.passwordMismatch"));
      return;
    }
    setLoading(true);
    registerApi({ email: email.trim(), password, name })
      .then(() => {
        setLoading(false);
        // 注册成功但账号未激活：提示等待运维激活后再登录
        toast.success(t("registered"));
        // 切回登录并以邮箱预填用户名（邮箱即登录账号）
        setUsername(email.trim());
        switchMode("login");
      })
      .catch((error) => {
        setLoading(false);
        toast.danger((error as Error).message);
      });
  };

  const isRegister = mode === "register";

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
            <div className="mb-4 font-normal text-[20px]">
              {isRegister ? t("registerTitle") : t("loginTitle")}
            </div>
            <div className="w-3/5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (loading) return;
                  if (isRegister) onRegister();
                  else onLogin();
                }}
              >
                {!isRegister && (
                  <div className="w-full">
                    <TextField value={username} onChange={setUsername}>
                      <InputGroup>
                        <InputGroup.Prefix className="w-20">{t("user")}</InputGroup.Prefix>
                        <InputGroup.Input placeholder={t("userPlaceholder")} />
                      </InputGroup>
                    </TextField>
                  </div>
                )}
                {isRegister && (
                  <>
                    {/* 邮箱即登录用户名 */}
                    <div className="w-full">
                      <TextField value={email} onChange={setEmail} type="email">
                        <InputGroup>
                          <InputGroup.Prefix className="w-20">{t("email")}</InputGroup.Prefix>
                          <InputGroup.Input placeholder={t("emailPlaceholder")} />
                        </InputGroup>
                      </TextField>
                    </div>
                    <div className="mt-3 w-full">
                      <TextField value={name} onChange={setName}>
                        <InputGroup>
                          <InputGroup.Prefix className="w-20">{t("name")}</InputGroup.Prefix>
                          <InputGroup.Input placeholder={t("namePlaceholder")} />
                        </InputGroup>
                      </TextField>
                    </div>
                  </>
                )}
                <div className="mt-3 w-full">
                  <PasswordInput
                    label={t("password")}
                    value={password}
                    onChange={setPassword}
                    placeholder={t("passwordPlaceholder")}
                  />
                </div>
                {isRegister && (
                  <div className="mt-3 w-full">
                    <PasswordInput
                      label={t("confirm")}
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder={t("confirmPlaceholder")}
                    />
                  </div>
                )}
                {!isRegister && needCaptcha && (
                  <div className="mt-3 w-full">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <TextField value={captchaCode} onChange={setCaptchaCode}>
                          <InputGroup>
                            <InputGroup.Prefix className="w-20">{t("captcha")}</InputGroup.Prefix>
                            <InputGroup.Input placeholder={t("captchaPlaceholder")} maxLength={4} />
                          </InputGroup>
                        </TextField>
                      </div>
                      {/* 点击图片刷新验证码（重新提交一次换取新验证码） */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={captchaImg}
                        alt={t("captcha")}
                        title={t("captchaRefresh")}
                        onClick={() => {
                          setCaptchaCode("");
                          onLogin();
                        }}
                        className="h-[40px] w-[110px] cursor-pointer rounded border border-gray-300 bg-white"
                      />
                    </div>
                  </div>
                )}
                <div className="mt-4">
                  <Button variant="primary" fullWidth type="submit" isPending={loading}>
                    {isRegister ? t("register") : t("login")}
                  </Button>
                </div>
                {isRegister && (
                  <div className="mt-2 text-xs text-gray-500 text-center">{t("registerTip")}</div>
                )}
              </form>
              {/* 登录 / 注册切换（注册产出待激活的 admin 账号） */}
              <div className="mt-2 text-sm text-center">
                {isRegister ? (
                  <span className="text-gray-500">
                    {t("hasAccount")}{" "}
                    <button
                      type="button"
                      className="text-[#5b2a86] hover:underline"
                      onClick={() => switchMode("login")}
                    >
                      {t("signIn")}
                    </button>
                  </span>
                ) : (
                  <span className="text-gray-500">
                    {t("needAccount")}{" "}
                    <button
                      type="button"
                      className="text-[#5b2a86] hover:underline"
                      onClick={() => switchMode("register")}
                    >
                      {t("goRegister")}
                    </button>
                  </span>
                )}
              </div>
              {!isRegister && (
                <>
                  {/* 学生 / 顾问走 CUHK ADFS 单点登录（授权码流） */}
                  <div className="my-3 flex items-center gap-3 text-xs text-gray-400">
                    <div className="flex-1 border-t border-gray-300" />
                    {t("or")}
                    <div className="flex-1 border-t border-gray-300" />
                  </div>
                  <Button fullWidth variant="secondary" onPress={() => redirectToAdfsAuthorize()}>
                    {t("ssoLogin")}
                  </Button>
                  <div className="mt-2 text-xs text-gray-500 text-center">{t("ssoTip")}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
