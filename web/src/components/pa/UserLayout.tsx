"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertDialog, Button } from "@heroui/react";
import { IoCalendarOutline, IoExitOutline, IoPeopleOutline } from "react-icons/io5";
import { useUserStore } from "@/context/UserContext";
import LanguageToggle from "@/i18n/LanguageToggle";

const BASE = "/f/007/user";

interface UserLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function UserLayout({ children, title }: UserLayoutProps) {
  const t = useTranslations("common");
  const { logout, state } = useUserStore();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = pathname.split("/").pop() ?? "";

  const navItems = [
    { label: t("menuUser.advisors"), key: "advisors", icon: IoPeopleOutline },
    { label: t("menuUser.myAppointments"), key: "record", icon: IoCalendarOutline },
  ];

  return (
    <div className="flex flex-col h-screen">
      <header className="flex justify-between items-center h-[60px] px-5 bg-[#5b2a86] border-b border-gray-200">
        <div className="flex items-center gap-8 h-full">
          <span className="font-bold text-white text-lg">{t("appName")}</span>
          <nav className="flex items-center gap-1 h-full">
            {navItems.map((item) => (
              <div
                key={item.key}
                onClick={() => router.push(`${BASE}/${item.key}`)}
                className={`flex items-center gap-1.5 h-full px-4 cursor-pointer text-white/80 hover:text-white border-b-2 ${
                  activeKey === item.key
                    ? "border-white text-white font-bold"
                    : "border-transparent"
                }`}
              >
                <item.icon size={18} className="shrink-0" />
                <span>{item.label}</span>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white text-sm">{title ?? state.name ?? ""}</span>
          <LanguageToggle variant="solid" />
          <AlertDialog isOpen={logoutOpen} onOpenChange={setLogoutOpen}>
            <AlertDialog.Trigger>
              <Button variant="primary" size="sm">
                <IoExitOutline size={18} />
                {t("logout")}
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Backdrop>
              <AlertDialog.Container placement="center">
                <AlertDialog.Dialog className="min-w-[360px]">
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="warning" />
                    <AlertDialog.Heading>{t("logoutConfirmTitle")}</AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>{t("logoutConfirmBody")}</AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button variant="ghost" onPress={() => setLogoutOpen(false)}>
                      {t("cancel")}
                    </Button>
                    <Button
                      variant="primary"
                      onPress={() => {
                        setLogoutOpen(false);
                        logout();
                      }}
                    >
                      {t("confirm")}
                    </Button>
                  </AlertDialog.Footer>
                </AlertDialog.Dialog>
              </AlertDialog.Container>
            </AlertDialog.Backdrop>
          </AlertDialog>
        </div>
      </header>
      <div className="overflow-y-auto p-2 bg-[#f0f2f5]" style={{ height: "calc(100vh - 60px)" }}>
        <div className="min-w-[600px] max-w-[1200px] m-auto">{children}</div>
      </div>
    </div>
  );
}
