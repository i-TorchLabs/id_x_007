import AuthGuard from "@/components/AuthGuard";
import AdvisorLayout from "@/components/pa/AdvisorLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // 顾问门户仅 advisor 可访问（admin 代管走 /admin，数据范围由后端绑定本人档案）
    <AuthGuard roles={["advisor"]}>
      <AdvisorLayout>{children}</AdvisorLayout>
    </AuthGuard>
  );
}
