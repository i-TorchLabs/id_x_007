"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoDocumentTextOutline,
  IoMailOutline,
  IoPeopleOutline,
  IoShieldCheckmarkOutline,
  IoStatsChartOutline,
} from "react-icons/io5";
import { useUserStore } from "@/context/UserContext";
import SideLayout, { type SideMenuItem } from "./SideLayout";

const BASE = "/f/007/admin";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("common.menuAdmin");
  const { state } = useUserStore();

  const menuItems: SideMenuItem[] = [
    { label: t("advisors"), key: "advisor-management", icon: IoPeopleOutline },
    { label: t("schedules"), key: "schedule-management", icon: IoCalendarOutline },
    { label: t("appointments"), key: "appointment-management", icon: IoDocumentTextOutline },
    { label: t("feedback"), key: "feedback-management", icon: IoChatbubbleEllipsesOutline },
    { label: t("stats"), key: "stats", icon: IoStatsChartOutline },
    { label: t("emailLogs"), key: "email-log", icon: IoMailOutline },
  ];
  // 权限管理（顾问 SSO 登录白名单）仅 admin 可见；advisor 不展示该入口，
  // 页面本身亦有 admin 专属 AuthGuard 兜底
  if (state.role === "admin") {
    menuItems.splice(1, 0, {
      label: t("permissions"),
      key: "permission-management",
      icon: IoShieldCheckmarkOutline,
    });
  }

  return (
    <SideLayout base={BASE} menuItems={menuItems}>
      {children}
    </SideLayout>
  );
}
