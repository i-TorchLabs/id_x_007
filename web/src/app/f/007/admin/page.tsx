"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { routeByRole } from "@/views/LoginView";

/** 后台首页：按角色落地默认模块（admin -> 顾问管理；advisor -> 时段管理） */
export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // 与 AuthGuard 保持一致：凭证存储在 localStorage 的 userInfo 中
    let role = "";
    try {
      role = JSON.parse(localStorage.getItem("userInfo") || "null")?.role || "";
    } catch {
      role = "";
    }
    router.replace(routeByRole(role || "advisor"));
  }, [router]);

  return null;
}
