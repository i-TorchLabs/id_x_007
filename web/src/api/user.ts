import { callApi, graphqlRequest, parseData, type ApiResponse } from "./graphql";
import { encryptLoginCredentials } from "@/utils/crypto";

/**
 * 学生端 + 认证 GraphQL API（咨询预约系统）
 * 说明:
 * - 字段名遵循 Strawberry 默认 camelCase 规则
 * - ApiResponse.data 为 JSON 字符串，由 callApi/parseData 统一解析
 * - 响应中的时间字段（startTime/endTime/createTime）为后端已格式化的
 *   "YYYY-MM-DD HH:MM" 字符串，前端直接展示，不再做时间戳转换
 * - 所有 ID 入参均为 Int
 */

/** 登录成功后的会话数据 */
export interface LoginData {
  user_id: string;
  token: string;
  role: string;
  name: string;
  username: string;
}

/** 账号密码登录（admin/advisor；student 会被后端拒绝并返回 msg）
 *  传输加密：用户名/密码先经后端 loginKey 公钥 RSA-OAEP(SHA-256) 加密，
 *  后端以内存私钥解密，明文不出现在网络载荷中。
 *  非 200 时抛出携带 data 的错误：触发验证码时含 need_captcha/captcha_id/image_base64。
 */
export const loginApi = async (data: {
  username: string;
  password: string;
  captcha_id?: string;
  captcha_code?: string;
}): Promise<LoginData> => {
  const encrypted = await encryptLoginCredentials(data.username, data.password);
  const res = await graphqlRequest(
    `mutation Login($data: LoginInput!) {
      login(data: $data) { code msg data }
    }`,
    {
      data: {
        username: encrypted.username,
        password: encrypted.password,
        encrypted: encrypted.encrypted,
        captchaId: data.captcha_id || "",
        captchaCode: data.captcha_code || "",
      },
    }
  );
  const resp = res.login as ApiResponse<unknown>;
  const d = parseData<Record<string, string>>(resp.data);
  if (resp.code === 200) {
    return d as unknown as LoginData;
  }
  // 非 200：抛出携带完整 data 的错误，页面据此判断是否展示验证码
  const err: any = new Error(resp.msg || "Login failed");
  err.code = resp.code;
  err.data = d || {};
  throw err;
};

/** 管理员注册（/login 页入口）。
 *  邮箱即登录用户名（后端落库 pa_user.username = email）；
 *  注册成功后账号为未激活状态（is_active=false），
 *  须运维人员登库将 pa_user.is_active 置为 TRUE 后方可登录。
 */
export const registerApi = async (data: {
  email: string;
  password: string;
  name: string;
}): Promise<string> => {
  const res = await graphqlRequest(
    `mutation Register($data: RegisterInput!) {
      register(data: $data) { code msg data }
    }`,
    {
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
      },
    }
  );
  const resp = res.register as ApiResponse<unknown>;
  if (resp.code === 200) return resp.msg || "Registered successfully";
  throw new Error(resp.msg || "Registration failed");
};

/** SSO 登录：ADFS 授权码换取本系统会话。
 *  oauthToken 为后端保留的旧隐式流字段（已废弃），固定传空串；
 *  state 仅用于前端 CSRF 校验，不回传后端。
 */
export const oauthLoginApi = async (code: string, state = "") => {
  return await callApi<LoginData>(
    "oauthLogin",
    `mutation OauthLogin($data: OauthInput!) {
      oauthLogin(data: $data) { code msg data }
    }`,
    { data: { code, state } }
  );
};

/**
 * 登出：使服务端会话 key 失效（userId 为 Int）。
 * 刻意绕过 callApi 的 401 会话失效处理——调用方紧跟着就会跳走，
 * 避免 handleSessionExpired 与路由跳转产生竞态。
 */
export const logoutApi = async (userId: string): Promise<void> => {
  const data = await graphqlRequest(
    `mutation Logout($data: LogoutInput!) {
      logout(data: $data) { code msg data }
    }`,
    { data: { userId: Number(userId) || 0 } }
  );
  const resp = data.logout as ApiResponse;
  if (resp.code !== 200) {
    throw new Error(resp.msg || "Logout failed");
  }
};

// ===== 顾问浏览 =====

/** 可约时段（startTime/endTime 为格式化字符串） */
export interface AdvisorSlot {
  slotId: string;
  startTime: string;
  endTime: string;
  booked: string;
}

/** 顾问卡片（photo 为 base64 data URL，可能为空；accepting 为 "1"/"0"） */
export interface AdvisorCard {
  advisorId: string;
  name: string;
  grade: string;
  major: string;
  direction: string;
  bio: string;
  photo: string;
  accepting: string;
  slots: AdvisorSlot[];
}

export interface AdvisorListRes {
  total: string;
  list: AdvisorCard[];
  majors: string[];
  directions: string[];
}

export const advisorListApi = async (data: {
  page: number;
  pageSize: number;
  major?: string;
  direction?: string;
}) => {
  return await callApi<AdvisorListRes>(
    "advisorList",
    `query AdvisorList($data: AdvisorListInput!) {
      advisorList(data: $data) { code msg data }
    }`,
    {
      data: {
        page: data.page,
        pageSize: data.pageSize,
        major: data.major ?? "",
        direction: data.direction ?? "",
      },
    }
  );
};

/** 某顾问全部可约时段（预约弹窗用） */
export const advisorSlotListApi = async (advisorId: string | number) => {
  return await callApi<{ advisorId: string; name: string; list: AdvisorSlot[] }>(
    "advisorSlotList",
    `query AdvisorSlotList($data: AdvisorIdInput!) {
      advisorSlotList(data: $data) { code msg data }
    }`,
    { data: { advisorId: Number(advisorId) || 0 } }
  );
};

// ===== 我的预约 =====

/** state: booked / completed / cancelled_student / cancelled_advisor */
export interface MyAppointment {
  appointmentId: string;
  applyNo: string;
  advisorName: string;
  startTime: string;
  endTime: string;
  topic: string;
  mode: string;
  state: string;
  cancelable: boolean;
  createTime: string;
}

export interface MyAppointmentListRes {
  total: string;
  list: MyAppointment[];
}

export const myAppointmentListApi = async (data: { page: number; pageSize: number }) => {
  return await callApi<MyAppointmentListRes>(
    "myAppointmentList",
    `query MyAppointmentList($data: PageInput!) {
      myAppointmentList(data: $data) { code msg data }
    }`,
    { data: { page: data.page, pageSize: data.pageSize } }
  );
};

/** 预约申请表单（mode: online / offline；online 时 wechat 必填、meetingLink 可选） */
export interface AppointmentCreateForm {
  slotId: string;
  topic: string;
  content: string;
  mode: string;
  phone: string;
  wechat: string;
  meetingLink: string;
}

export const studentAppointmentCreateApi = async (data: AppointmentCreateForm) => {
  return await callApi(
    "studentAppointmentCreate",
    `mutation StudentAppointmentCreate($data: AppointmentCreateInput!) {
      studentAppointmentCreate(data: $data) { code msg data }
    }`,
    { data: { ...data, slotId: Number(data.slotId) || 0 } }
  );
};

/** 取消我的预约（须填取消原因；开始前 4 小时内后端会拒绝） */
export const studentAppointmentCancelApi = async (
  appointmentId: string | number,
  reason: string
) => {
  return await callApi(
    "studentAppointmentCancel",
    `mutation StudentAppointmentCancel($data: AppointmentIdInput!) {
      studentAppointmentCancel(data: $data) { code msg data }
    }`,
    { data: { appointmentId: Number(appointmentId) || 0, reason } }
  );
};
