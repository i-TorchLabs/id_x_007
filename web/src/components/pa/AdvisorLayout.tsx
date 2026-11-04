"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { IoCalendarOutline, IoDocumentTextOutline } from "react-icons/io5";
import SideLayout, { type SideMenuItem } from "./SideLayout";

const BASE = "/f/007/advisor";

export default function AdvisorLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("common.menuAdvisor");

  const menuItems: SideMenuItem[] = [
    { label: t("mySchedule"), key: "schedule", icon: IoCalendarOutline },
    { label: t("myAppointments"), key: "appointments", icon: IoDocumentTextOutline },
  ];

  return (
    <SideLayout base={BASE} menuItems={menuItems}>
      {children}
    </SideLayout>
  );
}
