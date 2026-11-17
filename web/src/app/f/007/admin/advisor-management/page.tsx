"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import AuthGuard from "@/components/AuthGuard";
import AdvisorManagementView from "@/views/AdvisorManagementView";
import PermissionManagementView from "@/views/PermissionManagementView";

type TabKey = "advisors" | "permissions";

/**
 * 顾问管理（仅 admin）：顾问档案与权限管理（SSO 登录白名单）两个页签合一；
 * advisor 直达 URL 时由 AuthGuard 弹回时段管理（advisor 的后台首页）。
 */
export default function AdvisorManagementPage() {
  const t = useTranslations("advisorManagement");
  const [tab, setTab] = useState<TabKey>("advisors");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "advisors", label: t("tabs.advisors") },
    { key: "permissions", label: t("tabs.permissions") },
  ];

  return (
    <AuthGuard roles={["admin"]} deniedRedirect="/f/007/admin/schedule-management">
      <div className="bg-white px-5 mb-2 flex gap-6 border-b border-gray-200" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`py-3 text-sm border-b-2 -mb-px cursor-pointer ${
              tab === item.key
                ? "text-[#5b2a86] border-[#5b2a86] font-bold"
                : "text-gray-600 border-transparent hover:text-[#5b2a86]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === "advisors" ? <AdvisorManagementView /> : <PermissionManagementView />}
    </AuthGuard>
  );
}
