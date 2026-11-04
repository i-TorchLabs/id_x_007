"use client";

import { useTranslations } from "next-intl";
import { Chip } from "@heroui/react";

/** 预约状态 Chip：booked / completed / cancelled_student / cancelled_advisor */
export function AppointmentStateChip({ state }: { state: string }) {
  const t = useTranslations("common.state");
  if (state === "completed") return <Chip color="success">{t("completed")}</Chip>;
  if (state === "cancelled_student" || state === "cancelled_advisor")
    return <Chip color="danger">{t("cancelled")}</Chip>;
  return <Chip>{t("booked")}</Chip>;
}

/** 时段状态 Chip："1" 开放 / "0" 暂停 */
export function SlotStateChip({ state }: { state: string }) {
  const t = useTranslations("common.state");
  if (state === "0") return <Chip color="warning">{t("paused")}</Chip>;
  return <Chip color="success">{t("open")}</Chip>;
}
