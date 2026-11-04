"use client";

import AuthGuard from "@/components/AuthGuard";
import UserLayout from "@/components/pa/UserLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // 学生端：登录即可访问（admin/advisor 亦可浏览）
    <AuthGuard>
      <UserLayout>{children}</UserLayout>
    </AuthGuard>
  );
}
