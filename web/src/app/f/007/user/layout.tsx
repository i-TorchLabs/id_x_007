"use client";

import { usePathname } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import UserLayout from "@/components/pa/UserLayout";

/** SSO 回调页：换票前尚无本系统会话，必须绕过登录守卫（否则被踢回登录页）与导航壳 */
const OAUTH_CALLBACK_PATH = "/f/007/user/oauth2";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === OAUTH_CALLBACK_PATH) {
    return <>{children}</>;
  }
  return (
    // 学生端：登录即可访问（admin/advisor 亦可浏览）
    <AuthGuard>
      <UserLayout>{children}</UserLayout>
    </AuthGuard>
  );
}
