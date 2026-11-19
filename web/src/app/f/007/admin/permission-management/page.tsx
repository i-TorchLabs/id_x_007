import { redirect } from "next/navigation";

/** 权限管理页签已移除（白名单经顾问管理的「SSO 登录许可」开关维护），旧地址重定向保持兼容 */
export default function PermissionManagementPage() {
  redirect("/f/007/admin/advisor-management");
}
