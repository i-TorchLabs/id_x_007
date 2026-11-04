import { API_BASE_URL } from "@/utils/config";

/** 后端统一业务响应（data 为 JSON 字符串，需 JSON.parse 还原） */
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

/** 文件下载响应：以 base64 承载文件内容 */
export interface FileResponse {
  code: number;
  msg: string;
  fileName: string;
  fileBase64: string;
}

const ENDPOINT = API_BASE_URL || "/b/id_x_007/graphql";

/**
 * 会话失效处理（漏洞报告 #2 建议：用 session 对身份进行判断和控制）：
 * 后端返回 401（Token 无效/过期/被踢）时，清除本地会话并强制跳回登录页，
 * 避免用户停留在受保护页面但接口持续 401 的半登录状态。
 */
function handleSessionExpired(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("userInfo");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  // 避免在登录页重复跳转
  const path = window.location.pathname;
  if (!path.startsWith("/f/007/login")) {
    window.location.href = "/f/007/login";
  }
}

interface GraphQLPayload {
  data?: Record<string, any>;
  errors?: { message: string }[];
}

/**
 * GraphQL 请求底层实现：
 * - 自动从 localStorage 注入 Token 请求头（后端从 Header "Token" 读取）
 * - HTTP 状态非 200 或存在 errors 时抛错
 */
export async function graphqlRequest(
  query: string,
  variables?: Record<string, any>
): Promise<Record<string, any>> {
  const userInfo = JSON.parse(
    (typeof window !== "undefined" && localStorage.getItem("userInfo")) || "{}"
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=UTF-8",
  };
  if (userInfo.token) {
    headers["Token"] = userInfo.token;
  }
  let res: globalThis.Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error("服务器异常，请稍后重试…");
  }
  if (res.status !== 200) {
    throw new Error(res.status.toString());
  }
  const json = (await res.json()) as GraphQLPayload;
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message || "请求失败，未知异常");
  }
  return json.data ?? {};
}

/** data 为 JSON 字符串时解析为对象（契约约定），否则原样返回 */
export function parseData<T>(data: unknown): T {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }
  return data as T;
}

/**
 * 调用业务操作（ApiResponse）：code === 200 时 resolve 解析后的 data，否则抛出 msg
 */
export async function callApi<T = any>(
  field: string,
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const data = await graphqlRequest(query, variables);
  const resp = data[field] as ApiResponse<unknown>;
  if (resp.code === 200) {
    return parseData<T>(resp.data);
  }
  if (resp.code === 401) {
    handleSessionExpired();
  }
  throw new Error(resp.msg || "请求失败，未知异常");
}

/**
 * 调用文件下载操作（FileResponse）：code === 200 时 resolve 完整响应
 */
export async function callFileApi(
  field: string,
  query: string,
  variables?: Record<string, any>
): Promise<FileResponse> {
  const data = await graphqlRequest(query, variables);
  const resp = data[field] as FileResponse;
  if (resp.code === 200) {
    return resp;
  }
  if (resp.code === 401) {
    handleSessionExpired();
  }
  throw new Error(resp.msg || "请求失败，未知异常");
}
