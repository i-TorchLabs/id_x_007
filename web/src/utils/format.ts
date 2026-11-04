import dayjs from "dayjs";

/** datetime-local 值（yyyy-MM-ddTHH:mm）-> 毫秒时间戳字符串；空值 -> 空串 */
export const localToMs = (v?: string): string => {
  if (!v) return "";
  return String(dayjs(String(v).replace("T", " ")).valueOf());
};

/** 毫秒时间戳字符串 -> datetime-local 值；无效值 -> 空串 */
export const msToLocal = (v?: string | number): string => {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n) || n <= 0) return "";
  return dayjs(n).format("YYYY-MM-DDTHH:mm");
};

/** 后端布尔字段兼容 true / "true" / "1" / "enabled" 等写法 */
export const isTrue = (v: unknown): boolean =>
  v === true || v === 1 || v === "true" || v === "1" || v === "enabled" || v === "yes";
