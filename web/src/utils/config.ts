export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";
export const SUB_VERSION = process.env.NEXT_PUBLIC_SUB_VERSION ?? "/b/id_x_007/graphql";
export const API_BASE_URL = `${BASE_URL}${SUB_VERSION}`;

/** 外部站点（ADFS redirect_uri 等），NEXT_PUBLIC_SITE_URL 可覆盖 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sme-cloud.cuhk.edu.cn";

/** ADFS OAuth2 端点 */
export const ADFS_BASE_URL =
  process.env.NEXT_PUBLIC_ADFS_BASE_URL ?? "https://sts.cuhk.edu.cn/adfs/oauth2";
export const ADFS_AUTHORIZE_URL = `${ADFS_BASE_URL}/authorize`;
export const ADFS_LOGOUT_URL = `${ADFS_BASE_URL}/logout`;

/**
 * ADFS OAuth2 授权码授予流配置
 * - client_id 为公开标识（出现在浏览器跳转 URL 中）；默认空串，未配置时由
 *   utils/sso.ts 在发起跳转前 console.error + toast 提示；
 * - client_secret 仅服务端持有，严禁写入前端代码 / 环境变量；
 * - redirect_uri 必须与 ADFS 注册地址完全一致（https，区分大小写）；
 * - NEXT_PUBLIC_* 环境变量用于覆盖默认值（构建期内联）。
 */
export const ADFS_CLIENT_ID = process.env.NEXT_PUBLIC_ADFS_CLIENT_ID ?? "";
export const ADFS_REDIRECT_URI =
  process.env.NEXT_PUBLIC_ADFS_REDIRECT_URI ?? `${SITE_URL}/f/007/oauth2`;
export const ADFS_RESOURCE = process.env.NEXT_PUBLIC_ADFS_RESOURCE ?? SITE_URL;

/**
 * 开发模拟 SSO（NEXT_PUBLIC_SSO_MOCK=1 时启用）：
 * - 点击 SSO 按钮不跳 ADFS，而是本地直跳回调页，用 "mock.<用户名>" 授权码走通登录闭环；
 * - 需后端同时设置 PA_OAUTH_MOCK=1；生产环境严禁开启。
 */
export const SSO_MOCK_ENABLED = process.env.NEXT_PUBLIC_SSO_MOCK === "1";
export const SSO_MOCK_USER = process.env.NEXT_PUBLIC_SSO_MOCK_USER ?? "dev_student";
