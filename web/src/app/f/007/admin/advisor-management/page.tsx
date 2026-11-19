"use client";

import AuthGuard from "@/components/AuthGuard";
import AdvisorManagementView from "@/views/AdvisorManagementView";

/**
 * 顾问管理（仅 admin）：顾问档案维护；SSO 登录白名单经档案编辑中的
 * 「SSO 登录许可」开关维护（后端白名单接口保留，独立「权限管理」页签已移除）；
 * advisor 直达 URL 时由 AuthGuard 弹回时段管理（advisor 的后台首页）。
 */
export default function AdvisorManagementPage() {
  return (
    <AuthGuard roles={["admin"]} deniedRedirect="/f/007/admin/schedule-management">
      <AdvisorManagementView />
    </AuthGuard>
  );
}
