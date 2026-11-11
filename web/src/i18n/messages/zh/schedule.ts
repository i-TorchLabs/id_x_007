/** 时段管理页文案（schedule 命名空间，ScheduleView / ScheduleManagementView 共用） */
export default {
  // 表头与表单字段
  startTime: "开始时间",
  endTime: "结束时间",
  bookedState: "预约情况",
  slotBooked: "已预约",
  slotAvailable: "未预约",
  state: "状态",
  options: "操作",
  // 工具栏
  addSlot: "新增时段",
  downloadTemplate: "下载模板",
  batchUpload: "批量上传",
  acceptingOn: "接待预约中",
  acceptingOff: "暂停接待",
  // 表格
  tableLabel: "时段列表",
  tableAria: "数据表格",
  noData: "暂无数据",
  // 行操作按钮
  edit: "编辑",
  resume: "恢复",
  pause: "暂停",
  delete: "删除",
  // 新增/编辑弹窗
  editSlotTitle: "编辑时段",
  cancel: "取消",
  submit: "提交",
  // 批量上传结果弹窗
  uploadResult: "上传结果",
  uploadSummary: "成功：{success}，失败：{fail}",
  uploadRowError: "第 {row} 行：{reason}",
  close: "关闭",
  // 删除确认弹窗
  confirmDelete: "确认删除",
  deleteSlotRange: "删除时段 {start} ~ {end}？",
  deleteConstraint: "已存在预约的时段无法删除。",
  // 校验与 toast 提示
  loadFail: "加载数据失败。",
  timeRequired: "开始时间和结束时间为必填项。",
  endAfterStart: "结束时间必须晚于开始时间。",
  saved: "保存成功。",
  saveFail: "保存失败。",
  slotPaused: "时段已暂停。",
  slotResumed: "时段已恢复。",
  stateFail: "状态更新失败。",
  deleted: "删除成功。",
  deleteFail: "删除失败。",
  templateFail: "模板下载失败。",
  uploadFinished: "上传完成（成功 {success}，失败 {fail}）。",
  uploadFail: "上传失败。",
  acceptingOnToast: "已开始接收新预约。",
  acceptingOffToast: "已暂停接收新预约。",
  updateFail: "更新失败。",
  // 管理端代管页（ScheduleManagementView）
  advisorLabel: "顾问",
  advisorPlaceholder: "请选择顾问",
  selectAdvisorTip: "请选择顾问以管理其排期。",
  advisorsFail: "顾问列表加载失败。",
  // 学生端预览（管理端代管页，行操作「预览」：新标签页打开真实学生端页面）
  preview: "预览",
} as const;
