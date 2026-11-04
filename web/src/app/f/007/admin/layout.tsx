import AuthGuard from "@/components/AuthGuard";
import AdminLayout from "@/components/pa/AdminLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // 管理后台仅 admin 可访问
    <AuthGuard roles={["admin"]}>
      <AdminLayout>{children}</AdminLayout>
    </AuthGuard>
  );
}
