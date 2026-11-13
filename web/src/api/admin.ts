import { callApi, callFileApi, type FileResponse } from "./graphql";

/**
 * 管理后台 GraphQL API（顾问档案 / 预约总览 / 反馈 / 统计 / 邮件日志 / 邮件模板）
 * 说明:
 * - 字段名遵循 Strawberry 默认 camelCase 规则
 * - ApiResponse.data 为 JSON 字符串，由 callApi 统一解析
 * - 所有 ID 入参均为 Int；筛选/导出的 advisorId 传 0 表示全部
 * - 布尔语义字段（status/accepting/needFollowup）为 String "1"/"0"
 * - 响应中的时间字段为后端已格式化字符串，直接展示
 * - 排期代管（D-2）直接复用 api/advisor.ts 并传 advisorId
 */

/** advisorId 统一转 Int（空串/未传 -> 0 表示全部） */
const toAdvisorId = (v?: string | number): number => Number(v) || 0;

// ===== 顾问档案 =====

/** status/accepting 为 "1"/"0" */
export interface ManageAdvisor {
  advisorId: string;
  username: string;
  name: string;
  email: string;
  grade: string;
  major: string;
  direction: string;
  bio: string;
  photo: string;
  status: string;
  accepting: string;
  slotCount: string;
  appointmentCount: string;
}

export interface ManageAdvisorListRes {
  total: string;
  list: ManageAdvisor[];
}

export const manageAdvisorListApi = async (data: {
  page: number;
  pageSize: number;
  keyword?: string;
}) => {
  return await callApi<ManageAdvisorListRes>(
    "manageAdvisorList",
    `query ManageAdvisorList($data: ManageAdvisorListInput!) {
      manageAdvisorList(data: $data) { code msg data }
    }`,
    {
      data: {
        page: data.page,
        pageSize: data.pageSize,
        keyword: data.keyword ?? "",
      },
    }
  );
};

/** 顾问档案表单（photo 为 base64 data URL，可为空串） */
export interface ManageAdvisorFormValue {
  name: string;
  email: string;
  grade: string;
  major: string;
  direction: string;
  bio: string;
  photo: string;
}

export const manageAdvisorCreateApi = async (
  data: ManageAdvisorFormValue & { username: string }
) => {
  return await callApi(
    "manageAdvisorCreate",
    `mutation ManageAdvisorCreate($data: ManageAdvisorCreateInput!) {
      manageAdvisorCreate(data: $data) { code msg data }
    }`,
    { data: { ...data } }
  );
};

/** 更新顾问（status/accepting 传 "1"/"0"，空串表示不变） */
export const manageAdvisorUpdateApi = async (
  data: ManageAdvisorFormValue & { advisorId: string; status: boolean; accepting: boolean }
) => {
  return await callApi(
    "manageAdvisorUpdate",
    `mutation ManageAdvisorUpdate($data: ManageAdvisorUpdateInput!) {
      manageAdvisorUpdate(data: $data) { code msg data }
    }`,
    {
      data: {
        ...data,
        advisorId: toAdvisorId(data.advisorId),
        status: data.status ? "1" : "0",
        accepting: data.accepting ? "1" : "0",
      },
    }
  );
};

/** 删除顾问（有预约等关联数据时后端拒绝并返回 msg） */
export const manageAdvisorDeleteApi = async (advisorId: string) => {
  return await callApi(
    "manageAdvisorDelete",
    `mutation ManageAdvisorDelete($data: ManageAdvisorIdInput!) {
      manageAdvisorDelete(data: $data) { code msg data }
    }`,
    { data: { advisorId: toAdvisorId(advisorId) } }
  );
};

// ===== 权限管理（顾问 SSO 登录白名单） =====

/** allow 为 "1"/"0" */
export interface ManageAllow {
  allowId: string;
  email: string;
  allow: string;
  createTime: string;
  updateTime: string;
}

export interface ManageAllowListRes {
  total: string;
  list: ManageAllow[];
}

export const manageAllowListApi = async (data: {
  page: number;
  pageSize: number;
  keyword?: string;
}) => {
  return await callApi<ManageAllowListRes>(
    "manageAllowList",
    `query ManageAllowList($data: ManageAllowListInput!) {
      manageAllowList(data: $data) { code msg data }
    }`,
    {
      data: {
        page: data.page,
        pageSize: data.pageSize,
        keyword: data.keyword ?? "",
      },
    }
  );
};

export const manageAllowCreateApi = async (data: { email: string; allow: boolean }) => {
  return await callApi(
    "manageAllowCreate",
    `mutation ManageAllowCreate($data: ManageAllowCreateInput!) {
      manageAllowCreate(data: $data) { code msg data }
    }`,
    { data: { email: data.email, allow: data.allow ? "1" : "0" } }
  );
};

/** 更新白名单（email 空串表示不变；allow 传 "1"/"0"，空串表示不变） */
export const manageAllowUpdateApi = async (data: {
  allowId: string;
  email?: string;
  allow?: boolean;
}) => {
  return await callApi(
    "manageAllowUpdate",
    `mutation ManageAllowUpdate($data: ManageAllowUpdateInput!) {
      manageAllowUpdate(data: $data) { code msg data }
    }`,
    {
      data: {
        allowId: Number(data.allowId) || 0,
        email: data.email ?? "",
        allow: data.allow === undefined ? "" : data.allow ? "1" : "0",
      },
    }
  );
};

export const manageAllowDeleteApi = async (allowId: string) => {
  return await callApi(
    "manageAllowDelete",
    `mutation ManageAllowDelete($data: ManageAllowIdInput!) {
      manageAllowDelete(data: $data) { code msg data }
    }`,
    { data: { allowId: Number(allowId) || 0 } }
  );
};

// ===== 预约总览 =====

export interface ManageAppointment {
  appointmentId: string;
  advisorId: string;
  applyNo: string;
  advisorName: string;
  studentName: string;
  studentNo: string;
  studentEmail: string;
  startTime: string;
  endTime: string;
  topic: string;
  content: string;
  mode: string;
  phone: string;
  wechat: string;
  meetingLink: string;
  state: string;
  cancelReason: string;
  cancelable: boolean;
  completable: boolean;
  hasFeedback: boolean;
  feedbackSummary: string;
  feedbackHandle: string;
  feedbackNeedFollowup: string;
  createTime: string;
}

export interface ManageAppointmentListRes {
  total: string;
  list: ManageAppointment[];
}

export const manageAppointmentListApi = async (data: {
  page: number;
  pageSize: number;
  advisorId?: string;
  date?: string;
  state?: string;
}) => {
  return await callApi<ManageAppointmentListRes>(
    "manageAppointmentList",
    `query ManageAppointmentList($data: ManageAppointmentListInput!) {
      manageAppointmentList(data: $data) { code msg data }
    }`,
    {
      data: {
        page: data.page,
        pageSize: data.pageSize,
        advisorId: toAdvisorId(data.advisorId),
        date: data.date ?? "",
        state: data.state ?? "",
      },
    }
  );
};

/** 导出预约（advisorId 传 0 表示全部；月份 YYYY-MM，空串表示全量） */
export const manageAppointmentExportApi = async (data: {
  advisorId?: string;
  month?: string;
}): Promise<FileResponse> => {
  return await callFileApi(
    "manageAppointmentExport",
    `query ManageAppointmentExport($data: ManageExportInput!) {
      manageAppointmentExport(data: $data) { code msg fileName fileBase64 }
    }`,
    { data: { advisorId: toAdvisorId(data.advisorId), month: data.month ?? "" } }
  );
};

// ===== 咨询反馈 =====

/** needFollowup 为 "1"/"0"；startTime/createTime 为格式化字符串 */
export interface ManageFeedback {
  feedbackId: string;
  appointmentId: string;
  applyNo: string;
  advisorName: string;
  studentName: string;
  studentNo: string;
  startTime: string;
  topic: string;
  summary: string;
  handle: string;
  needFollowup: string;
  createTime: string;
}

export interface ManageFeedbackListRes {
  total: string;
  list: ManageFeedback[];
}

export const manageFeedbackListApi = async (data: {
  page: number;
  pageSize: number;
  advisorId?: string;
  month?: string;
}) => {
  return await callApi<ManageFeedbackListRes>(
    "manageFeedbackList",
    `query ManageFeedbackList($data: ManageFeedbackListInput!) {
      manageFeedbackList(data: $data) { code msg data }
    }`,
    {
      data: {
        page: data.page,
        pageSize: data.pageSize,
        advisorId: toAdvisorId(data.advisorId),
        month: data.month ?? "",
      },
    }
  );
};

export const manageFeedbackExportApi = async (data: {
  advisorId?: string;
  month?: string;
}): Promise<FileResponse> => {
  return await callFileApi(
    "manageFeedbackExport",
    `query ManageFeedbackExport($data: ManageExportInput!) {
      manageFeedbackExport(data: $data) { code msg fileName fileBase64 }
    }`,
    { data: { advisorId: toAdvisorId(data.advisorId), month: data.month ?? "" } }
  );
};

// ===== 统计 =====

export interface ManageStatsRes {
  total: string;
  completed: string;
  cancelled: string;
  booked: string;
  ranking: { advisorName: string; count: string; completed: string }[];
}

export const manageStatsApi = async () => {
  return await callApi<ManageStatsRes>(
    "manageStats",
    `query ManageStats {
      manageStats { code msg data }
    }`
  );
};

// ===== 邮件日志 =====

/** mailType: booked / cancelled / reminder；status: sent / failed / skipped */
export interface ManageEmailLog {
  id: string;
  mailTo: string;
  mailType: string;
  subject: string;
  content: string;
  status: string;
  error: string;
  appointmentId: string;
  createTime: string;
}

export interface ManageEmailLogListRes {
  total: string;
  list: ManageEmailLog[];
}

export const manageEmailLogListApi = async (data: {
  page: number;
  pageSize: number;
  mailType?: string;
}) => {
  return await callApi<ManageEmailLogListRes>(
    "manageEmailLogList",
    `query ManageEmailLogList($data: ManageEmailLogListInput!) {
      manageEmailLogList(data: $data) { code msg data }
    }`,
    {
      data: {
        page: data.page,
        pageSize: data.pageSize,
        mailType: data.mailType ?? "",
      },
    }
  );
};

// ===== 邮件模板 =====

/** 固定三类：booked / cancelled / reminder */
export interface MailTemplate {
  mailType: string;
  subject: string;
  html: string;
  updateTime: string;
}

export const manageMailTemplateListApi = async () => {
  return await callApi<{ list: MailTemplate[] }>(
    "manageMailTemplateList",
    `query ManageMailTemplateList {
      manageMailTemplateList { code msg data }
    }`
  );
};

export const manageMailTemplateUpdateApi = async (data: {
  mailType: string;
  subject: string;
  html: string;
}) => {
  return await callApi(
    "manageMailTemplateUpdate",
    `mutation ManageMailTemplateUpdate($data: ManageMailTemplateUpdateInput!) {
      manageMailTemplateUpdate(data: $data) { code msg data }
    }`,
    { data: { ...data } }
  );
};
