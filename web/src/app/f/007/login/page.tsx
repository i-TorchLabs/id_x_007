import { redirect } from "next/navigation";

/** 旧登录路径兼容：ADFS 登出回跳等外部登记地址仍指向 /login 时平滑迁移 */
export default function LegacyLoginPage() {
  redirect("/f/007/admin-login");
}
