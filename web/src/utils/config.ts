export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";
export const SUB_VERSION = process.env.NEXT_PUBLIC_SUB_VERSION ?? "/b/id_x_007/graphql";
export const API_BASE_URL = `${BASE_URL}${SUB_VERSION}`;

/** 外部站点（ADFS redirect_uri 等），NEXT_PUBLIC_SITE_URL 可覆盖 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://sme-ugo-appointment.cuhk.edu.cn";

/** ADFS OAuth2 端点 */
export const ADFS_BASE_URL =
  process.env.NEXT_PUBLIC_ADFS_BASE_URL || "https://sts.cuhk.edu.cn/adfs/oauth2";
export const ADFS_AUTHORIZE_URL = `${ADFS_BASE_URL}/authorize`;
export const ADFS_LOGOUT_URL = `${ADFS_BASE_URL}/logout`;

/**
 * ADFS OAuth2 授权码授予流配置
 * - client_id 为公开标识（出现在浏览器跳转 URL 中），默认值即本应用在 ADFS
 *   注册的标识，容器构建未注入 NEXT_PUBLIC_* 时仍可用；
 * - client_secret 仅服务端持有（pa_sso_settings 表），严禁写入前端代码 / 环境变量；
 * - redirect_uri 必须与 ADFS 注册地址、后端 pa_sso_settings.redirect_uri
 *   完全一致（https，区分大小写），否则 ADFS 报 MSIS9220；
 * - NEXT_PUBLIC_* 环境变量用于覆盖默认值（构建期内联）。
 */
export const ADFS_CLIENT_ID =
  process.env.NEXT_PUBLIC_ADFS_CLIENT_ID ||
  "2e8949a0-7fd4-4c7a-a380-c9e93c103067";
export const ADFS_REDIRECT_URI =
  process.env.NEXT_PUBLIC_ADFS_REDIRECT_URI ||
  `${SITE_URL}/f/007/user/oauth2`;
export const ADFS_RESOURCE = process.env.NEXT_PUBLIC_ADFS_RESOURCE || SITE_URL;
/**
 * ADFS 登出后回跳地址（回到登录页），需在 ADFS 依赖方信任中登记；
 * 未登记时 ADFS 会停留在登出提示页，不影响本系统本地登出。
 */
export const ADFS_POST_LOGOUT_REDIRECT_URI =
  process.env.NEXT_PUBLIC_ADFS_POST_LOGOUT_REDIRECT_URI ||
  `${SITE_URL}/f/007/login`;
