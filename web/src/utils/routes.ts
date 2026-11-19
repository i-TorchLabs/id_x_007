/**
 * 登录态与落地页的集中定义：SSO 回调、路由守卫、会话失效三处共用，
 * 避免各页面各自硬编码登录页 / 首页路径导致口径不一致。
 */

/** 学生端首页：顾问广场（学生浏览顾问并预约） */
export const STUDENT_HOME = "/f/007/user/advisors";

/** 学生登录页（/user-login，仅 CUHK SSO 入口） */
export const STUDENT_LOGIN = "/f/007/user-login";

/** 管理后台登录页（/admin-login：管理员账密 + 顾问 SSO 入口） */
export const ADMIN_LOGIN = "/f/007/admin-login";

/** 学生端路由前缀 */
export const STUDENT_BASE = "/f/007/user";

/** 登录成功后按角色落地：admin -> 顾问管理；advisor -> 时段管理；其余 -> 学生预约页 */
export const routeByRole = (role: string): string => {
  if (role === "admin") return "/f/007/admin/advisor-management";
  if (role === "advisor") return "/f/007/admin/schedule-management";
  return STUDENT_HOME;
};

/** 未登录 / 会话失效时按当前所在端选择登录页（学生端回学生登录，其余回后台登录） */
export const loginPathFor = (pathname: string): string =>
  pathname.startsWith(STUDENT_BASE) ? STUDENT_LOGIN : ADMIN_LOGIN;
