"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertDialog, Button } from "@heroui/react";
import {
  IoChevronBackOutline,
  IoChevronForwardOutline,
  IoExitOutline,
  IoHomeOutline,
} from "react-icons/io5";
import type { IconType } from "react-icons";
import { useUserStore } from "@/context/UserContext";
import LanguageToggle from "@/i18n/LanguageToggle";

export interface SideMenuItem {
  label: string;
  key: string;
  icon: IconType;
}

interface SideLayoutProps {
  children: ReactNode;
  /** 路由前缀（如 /f/007/admin） */
  base: string;
  menuItems: SideMenuItem[];
}

function LayoutSider({ base, menuItems }: { base: string; menuItems: SideMenuItem[] }) {
  const t = useTranslations("common");
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // 末级路径为菜单 key 时命中；停留在 base 时记为首页
  const lastSegment = pathname.split("/").filter(Boolean).pop() ?? "";
  const activeKey = menuItems.some((item) => item.key === lastSegment) ? lastSegment : "home";

  const isActive = (key: string) => activeKey === key;
  const homeClass = isActive("home") ? "text-[#5b2a86] bg-[#f5f0fa]" : "text-gray-700";

  return (
    <aside
      className="h-full flex flex-col border-r border-gray-200 bg-white transition-all duration-200"
      style={{ width: collapsed ? 64 : 200 }}
    >
      <nav className="flex-1 overflow-y-auto py-1">
        {collapsed ? (
          // 收起态：仅显示图标，hover 以 title 提示，点击跳转
          <div>
            <div
              onClick={() => router.push(base)}
              className={`flex items-center justify-center h-10 mx-2 rounded cursor-pointer hover:bg-gray-100 ${homeClass}`}
              title={t("home")}
              aria-label={t("home")}
              aria-current={isActive("home") ? "page" : undefined}
            >
              <IoHomeOutline size={22} className="shrink-0" />
            </div>
            {menuItems.map((item) => (
              <div
                key={item.key}
                onClick={() => router.push(`${base}/${item.key}`)}
                className={`flex items-center justify-center h-10 mx-2 rounded cursor-pointer hover:bg-gray-100 ${
                  isActive(item.key) ? "text-[#5b2a86] bg-[#f5f0fa]" : "text-gray-700"
                }`}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive(item.key) ? "page" : undefined}
              >
                <item.icon size={22} className="shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          // 展开态：图标 + 文案
          <div>
            <div
              onClick={() => router.push(base)}
              className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-gray-100 ${homeClass}`}
              title={t("home")}
              aria-current={isActive("home") ? "page" : undefined}
            >
              <IoHomeOutline size={22} className="shrink-0" />
              <span className={isActive("home") ? "font-bold" : ""}>{t("home")}</span>
            </div>
            {menuItems.map((item) => (
              <div
                key={item.key}
                onClick={() => router.push(`${base}/${item.key}`)}
                className={`flex items-center gap-2 pl-10 pr-4 py-2 cursor-pointer hover:bg-gray-100 ${
                  isActive(item.key) ? "text-[#5b2a86] bg-[#f5f0fa] font-bold" : "text-gray-700"
                }`}
                aria-current={isActive(item.key) ? "page" : undefined}
              >
                <item.icon size={22} className="shrink-0" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </nav>
      <div
        className="flex justify-center items-center h-12 border-t border-gray-200 cursor-pointer text-gray-600 hover:bg-gray-100"
        onClick={() => setCollapsed((v) => !v)}
      >
        {collapsed ? (
          <IoChevronForwardOutline size={20} />
        ) : (
          <IoChevronBackOutline size={20} />
        )}
      </div>
    </aside>
  );
}

/** 侧边栏布局骨架（admin / advisor 共用）：顶栏 + 侧边菜单 + 面包屑 + 语言切换 + 登出 */
export default function SideLayout({ children, base, menuItems }: SideLayoutProps) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useUserStore();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const breadcrumbTitleMap: Record<string, string> = Object.fromEntries(
    menuItems.map((item) => [item.key, item.label])
  );

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { title: string; path: string }[] = [{ title: t("home"), path: base }];
  const lastKey = segments[segments.length - 1];
  if (lastKey && breadcrumbTitleMap[lastKey]) {
    crumbs.push({ title: breadcrumbTitleMap[lastKey], path: pathname });
  }

  return (
    <div className="flex flex-col h-screen">
      {/* 顶部页眉:占满屏幕上方,展示系统名 + 右侧语言切换 */}
      <header className="flex items-center justify-between h-[60px] w-full shrink-0 bg-[#5b2a86] border-b border-gray-200 overflow-hidden">
        <span className="px-6 text-white font-bold text-lg">{t("appName")}</span>
        <div className="pr-5">
          <LanguageToggle variant="solid" />
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <LayoutSider base={base} menuItems={menuItems} />
        <div className="flex-1 flex flex-col h-full min-w-0">
          <div className="flex items-center justify-between h-[40px] pr-5 shrink-0">
            <div className="flex items-center px-2 gap-2 text-sm text-gray-600">
              {crumbs.map((item, index) => (
                <span key={index} className="flex items-center gap-2">
                  {index > 0 && <span className="text-gray-400">/</span>}
                  <span
                    className={item.path === pathname ? "text-[#5b2a86] font-bold" : "cursor-pointer hover:text-[#5b2a86]"}
                    onClick={() => {
                      if (item.path === pathname) return;
                      router.push(item.path);
                    }}
                  >
                    {item.title}
                  </span>
                </span>
              ))}
            </div>
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
          <div className="flex-1 overflow-y-auto p-2 bg-[#f0f2f5]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
