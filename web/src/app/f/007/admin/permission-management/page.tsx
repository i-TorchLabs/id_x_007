import AuthGuard from "@/components/AuthGuard";
import PermissionManagementView from "@/views/PermissionManagementView";

export default function PermissionManagementPage() {
  return (
    // 权限管理（白名单维护）仅 admin：advisor 直达 URL 时弹回后台首页
    <AuthGuard roles={["admin"]} deniedRedirect="/f/007/admin/advisor-management">
      <PermissionManagementView />
    </AuthGuard>
  );
}
