import AuthGuard from "@/components/AuthGuard";
import AdminLayout from "@/components/pa/AdminLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // 管理后台对 admin 与（白名单内 SSO 登录的）advisor 开放；
    // 顾问管理模块（含权限管理页签）另有 admin 专属守卫（见 advisor-management/page.tsx）
    <AuthGuard roles={["admin", "advisor"]}>
      <AdminLayout>{children}</AdminLayout>
    </AuthGuard>
  );
}
