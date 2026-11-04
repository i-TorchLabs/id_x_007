"use client";

import AuthGuard from "@/components/AuthGuard";
import AdvisorLayout from "@/components/pa/AdvisorLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // 顾问工作台仅 advisor 可访问
    <AuthGuard roles={["advisor"]}>
      <AdvisorLayout>{children}</AdvisorLayout>
    </AuthGuard>
  );
}
