/** 邮件日志页文案（emailLog 命名空间） */
export default {
  filter: {
    mailType: "邮件类型",
    allTypes: "全部类型",
  },
  type: {
    booked: "预约成功",
    cancelled: "已取消",
    reminder: "提醒",
  },
  templateType: {
    booked: "预约确认",
    cancelled: "取消通知",
    reminder: "每日提醒",
  },
  status: {
    sent: "已发送",
    failed: "发送失败",
    skipped: "已跳过",
  },
  column: {
    recipient: "收件人",
    type: "类型",
    subject: "主题",
    status: "状态",
    error: "错误",
    time: "时间",
  },
  mailTemplates: "邮件模板",
  noData: "暂无数据",
  tableLabel: "邮件日志列表",
  dataTableLabel: "数据表格",
  loadFail: "数据加载失败。",
  modal: {
    template: "模板",
    subject: "主题",
    htmlContent: "HTML 内容",
    availablePlaceholders: "可用占位符：{placeholders}",
    lastUpdated: "最后更新：{time}",
    close: "关闭",
    save: "保存",
  },
  toast: {
    loadTemplatesFail: "模板加载失败。",
    subjectRequired: "请填写主题。",
    htmlRequired: "请填写 HTML 内容。",
    templateSaved: "模板已保存。",
    saveTemplateFail: "模板保存失败。",
  },
} as const;
