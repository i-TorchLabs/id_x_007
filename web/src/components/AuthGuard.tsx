"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuthGuardProps {
  children: React.ReactNode;
  /** 要求登录用户必须具备的角色（如 admin），不满足则跳转登录页 */
  role?: string;
  /** 允许的角色列表（如 ["admin", "advisor"]），与 role 二选一；同时提供时以 roles 为准 */
  roles?: string[];
  /** 无需登录即可访问的路径（如 SSO 回调页），精确匹配 usePathname() */
  publicPaths?: string[];
}

/**
 * 前端路由守卫（复刻 id_x_003 漏洞报告 #2 未授权访问修复）：
 * - 未登录（localStorage 无 token）直接跳转登录页，不渲染受保护内容；
 * - role/roles 指定时校验用户角色，防止学生 token 访问管理后台页面；
 * - 校验通过前不渲染 children，避免敏感页面内容被未授权用户看到。
 */
export default function AuthGuard({ children, role, roles, publicPaths = [] }: AuthGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (publicPaths.includes(window.location.pathname)) {
      setChecked(true);
      setAuthorized(true);
      return;
    }
    // 与 UserContext 保持一致：凭证存储在 localStorage 的 userInfo 中
    let userInfo: { token?: string; role?: string } | null = null;
    try {
      userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
    } catch {
      userInfo = null;
    }
    if (!userInfo?.token) {
      router.replace("/f/007/login");
      setChecked(true);
      return;
    }
    const allowed = roles ?? (role ? [role] : null);
    if (allowed && !allowed.includes(userInfo.role || "")) {
      router.replace("/f/007/login");
      setChecked(true);
      return;
    }
    setAuthorized(true);
    setChecked(true);
  }, [router, role, roles, publicPaths]);

  // 校验完成前不渲染任何内容，防止敏感信息闪现
  if (!checked || !authorized) return null;
  return <>{children}</>;
}
