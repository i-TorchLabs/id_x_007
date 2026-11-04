"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  IoCalendarOutline,
  IoChatbubbleEllipsesOutline,
  IoDocumentTextOutline,
  IoMailOutline,
  IoPeopleOutline,
  IoStatsChartOutline,
} from "react-icons/io5";
import SideLayout, { type SideMenuItem } from "./SideLayout";

const BASE = "/f/007/admin";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("common.menuAdmin");

  const menuItems: SideMenuItem[] = [
    { label: t("advisors"), key: "advisor-management", icon: IoPeopleOutline },
    { label: t("schedules"), key: "schedule-management", icon: IoCalendarOutline },
    { label: t("appointments"), key: "appointment-management", icon: IoDocumentTextOutline },
    { label: t("feedback"), key: "feedback-management", icon: IoChatbubbleEllipsesOutline },
    { label: t("stats"), key: "stats", icon: IoStatsChartOutline },
    { label: t("emailLogs"), key: "email-log", icon: IoMailOutline },
  ];

  return (
    <SideLayout base={BASE} menuItems={menuItems}>
      {children}
    </SideLayout>
  );
}
