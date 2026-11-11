"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { logoutApi } from "@/api/user";
import { isSsoLogin, redirectToAdfsLogout } from "@/utils/sso";

export interface UserState {
  username?: string;
  user_id: string;
  token: string; // Token
  role: string; // student / admin
  name?: string;
}

interface UserInfo {
  username: string;
  userId: string;
  role: string;
  token: string;
  name: string;
}

interface UserContextValue {
  state: UserInfo;
  saveUser: (userInfo: UserState) => Promise<UserState>;
  isTokenExpire: () => boolean;
  logout: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<UserInfo>({
    username: "",
    userId: "",
    role: "",
    token: "",
    name: "",
  });

  const saveUser = useCallback((userInfo: UserState) => {
    localStorage.setItem("userInfo", JSON.stringify(userInfo));
    return new Promise<UserState>((resolve) => {
      setState({
        username: userInfo.username || "unknown",
        userId: userInfo.user_id,
        role: userInfo.role || "student",
        token: userInfo.token,
        name: userInfo.name || "",
      });
      resolve(userInfo);
    });
  }, []);

  const isTokenExpire = useCallback(() => {
    return !state.token;
  }, [state.token]);

  // 启动时从 localStorage 恢复用户
  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
    if (userInfo?.token) {
      saveUser(userInfo);
    }
  }, [saveUser]);

  /** 通知后端使会话 key 失效；失败不阻塞本地登出（静默降级） */
  const invalidateServerSession = useCallback(() => {
    try {
      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
      if (userInfo?.user_id) {
        // 不 await：登出是尽力而为的通知，网络/后端异常不应卡住用户
        logoutApi(String(userInfo.user_id)).catch(() => undefined);
      }
    } catch {
      /* localStorage 数据损坏时直接跳过 */
    }
  }, []);

  /**
   * 登出：本地会话 + 服务端会话失效；
   * SSO 建立的会话额外跳转 ADFS 登出端点终止单点登录会话（防同一浏览器
   * 下一位使用者点 SSO 按钮直接以上一账号静默登录），完成后回跳登录页。
   */
  const logout = useCallback(() => {
    const ssoSession = isSsoLogin();
    invalidateServerSession();
    // localStorage.clear 已含 SSO 标记（SSO_LOGIN_FLAG）
    localStorage.clear();
    sessionStorage.clear();
    if (ssoSession) {
      redirectToAdfsLogout();
      return;
    }
    router.push("/f/007/login");
  }, [router, invalidateServerSession]);

  return (
    <UserContext.Provider value={{ state, saveUser, isTokenExpire, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserStore() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUserStore must be used within UserProvider");
  return ctx;
}
