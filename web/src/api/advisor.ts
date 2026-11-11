import { callApi, callFileApi, type FileResponse } from "./graphql";
import { localToMs } from "@/utils/format";

/**
 * 顾问排期与预约处理 GraphQL API（排期 / 预约处理 / 反馈）
 * 说明:
 * - 顾问不设登录入口，以下接口均由管理后台调用，advisorId 必须传真实顾问 ID
 * - startTime/endTime 入参为毫秒时间戳字符串（datetime-local 值在此统一转换）
 * - 响应中的时间展示字段为后端已格式化字符串，直接展示；编辑回填用 startTimeMs/endTimeMs
 * - 布尔语义入参（accepting/needFollowup/state）为 String "1"/"0"
 */

/** advisorId 统一转 Int（空串/未传 -> 0，后端会拒绝并要求指定顾问） */
const toAdvisorId = (v?: string | number): number => Number(v) || 0;

/** File -> base64（不含 dataURL 前缀），批量上传用 */
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });

// ===== 排期管理 =====

/** 本人时段行（state: "1" 开放 / "0" 暂停；startTime/endTime 为格式化字符串） */
export interface MySlot {
  slotId: string;
  startTime: string;
  endTime: string;
  startTimeMs: number;
  endTimeMs: number;
  booked: string;
  state: string;
}

/** data 顶层含 advisorId 与 accepting（"1"/"0"），C-1 接待开关初始值取自此处 */
export interface MySlotListRes {
  total: string;
  advisorId: string;
  accepting: string;
  list: MySlot[];
}

export const advisorMySlotListApi = async (data: {
  page: number;
  pageSize: number;
  advisorId?: string;
}) => {
  return await callApi<MySlotListRes>(
    "advisorMySlotList",
    `query AdvisorMySlotList($data: AdvisorPageInput!) {
      advisorMySlotList(data: $data) { code msg data }
    }`,
    {
      data: {
        page: data.page,
        pageSize: data.pageSize,
        advisorId: toAdvisorId(data.advisorId),
      },
    }
  );
};

/** 时段表单（start_time/end_time 为 datetime-local 值） */
export interface SlotFormValue {
  start_time: string;
  end_time: string;
}

export const advisorSlotCreateApi = async (data: SlotFormValue & { advisorId?: string }) => {
  return await callApi(
    "advisorSlotCreate",
    `mutation AdvisorSlotCreate($data: SlotCreateInput!) {
      advisorSlotCreate(data: $data) { code msg data }
    }`,
    {
      data: {
        startTime: localToMs(data.start_time),
        endTime: localToMs(data.end_time),
        advisorId: toAdvisorId(data.advisorId),
      },
    }
  );
};

export const advisorSlotUpdateApi = async (
  data: SlotFormValue & { slotId: string; advisorId?: string }
) => {
  return await callApi(
    "advisorSlotUpdate",
    `mutation AdvisorSlotUpdate($data: SlotUpdateInput!) {
      advisorSlotUpdate(data: $data) { code msg data }
    }`,
    {
      data: {
        slotId: Number(data.slotId) || 0,
        startTime: localToMs(data.start_time),
        endTime: localToMs(data.end_time),
        advisorId: toAdvisorId(data.advisorId),
      },
    }
  );
};

/** 删除时段（已有预约时后端拒绝并返回 msg） */
export const advisorSlotDeleteApi = async (slotId: string, advisorId?: string) => {
  return await callApi(
    "advisorSlotDelete",
    `mutation AdvisorSlotDelete($data: SlotIdInput!) {
      advisorSlotDelete(data: $data) { code msg data }
    }`,
    { data: { slotId: Number(slotId) || 0, advisorId: toAdvisorId(advisorId) } }
  );
};

/** 暂停/恢复时段（state: "1" 开放 / "0" 暂停） */
export const advisorSlotStateApi = async (slotId: string, state: string, advisorId?: string) => {
  return await callApi(
    "advisorSlotState",
    `mutation AdvisorSlotState($data: SlotStateInput!) {
      advisorSlotState(data: $data) { code msg data }
    }`,
    { data: { slotId: Number(slotId) || 0, state, advisorId: toAdvisorId(advisorId) } }
  );
};

/** 下载批量排期模板（Excel，base64） */
export const advisorSlotTemplateApi = async (): Promise<FileResponse> => {
  return await callFileApi(
    "advisorSlotTemplate",
    `query AdvisorSlotTemplate {
      advisorSlotTemplate { code msg fileName fileBase64 }
    }`
  );
};

/** 批量上传结果：errors 为逐行失败原因 */
export interface SlotBatchUploadRes {
  success?: number;
  fail?: number;
  errors?: { row: number; reason: string }[];
}

/** 批量上传排期（.xlsx，base64 传入） */
export const advisorSlotBatchUploadApi = async (file: File, advisorId?: string) => {
  const fileBase64 = await fileToBase64(file);
  return await callApi<SlotBatchUploadRes>(
    "advisorSlotBatchUpload",
    `mutation AdvisorSlotBatchUpload($data: SlotBatchUploadInput!) {
      advisorSlotBatchUpload(data: $data) { code msg data }
    }`,
    { data: { fileName: file.name, fileBase64, advisorId: toAdvisorId(advisorId) } }
  );
};

/** 「暂不接待」开关：accepting=false 时学生端不可发起新预约（入参为 "1"/"0"） */
export const advisorAcceptingSetApi = async (accepting: boolean, advisorId?: string) => {
  return await callApi(
    "advisorAcceptingSet",
    `mutation AdvisorAcceptingSet($data: AcceptingSetInput!) {
      advisorAcceptingSet(data: $data) { code msg data }
    }`,
    { data: { accepting: accepting ? "1" : "0", advisorId: toAdvisorId(advisorId) } }
  );
};

// ===== 预约管理 =====


/** 管理端代顾问取消预约（必填取消原因，邮件通知学生由后端处理） */
export const advisorAppointmentCancelApi = async (
  appointmentId: string,
  reason: string,
  advisorId?: string
) => {
  return await callApi(
    "advisorAppointmentCancel",
    `mutation AdvisorAppointmentCancel($data: AdvisorCancelInput!) {
      advisorAppointmentCancel(data: $data) { code msg data }
    }`,
    {
      data: {
        appointmentId: Number(appointmentId) || 0,
        reason,
        advisorId: toAdvisorId(advisorId),
      },
    }
  );
};

/** 管理端代顾问标记完成 */
export const advisorAppointmentCompleteApi = async (appointmentId: string, advisorId?: string) => {
  return await callApi(
    "advisorAppointmentComplete",
    `mutation AdvisorAppointmentComplete($data: AdvisorCompleteInput!) {
      advisorAppointmentComplete(data: $data) { code msg data }
    }`,
    { data: { appointmentId: Number(appointmentId) || 0, advisorId: toAdvisorId(advisorId) } }
  );
};

/** 咨询反馈（新增/更新均走此接口，管理端代填；needFollowup 入参为 "1"/"0"） */
export const feedbackSetApi = async (data: {
  appointmentId: string;
  summary: string;
  handle: string;
  needFollowup: boolean;
  advisorId?: string;
}) => {
  return await callApi(
    "feedbackSet",
    `mutation FeedbackSet($data: FeedbackSetInput!) {
      feedbackSet(data: $data) { code msg data }
    }`,
    {
      data: {
        appointmentId: Number(data.appointmentId) || 0,
        summary: data.summary,
        handle: data.handle,
        needFollowup: data.needFollowup ? "1" : "0",
        advisorId: toAdvisorId(data.advisorId),
      },
    }
  );
};
