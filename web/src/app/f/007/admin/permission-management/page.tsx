import { redirect } from "next/navigation";

/** 权限管理已并入「顾问管理」页签（advisor-management），旧地址重定向保持兼容 */
export default function PermissionManagementPage() {
  redirect("/f/007/admin/advisor-management");
}
