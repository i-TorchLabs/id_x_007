/** 权限管理页文案（permissionManagement 命名空间） */
export default {
  // 搜索栏
  keyword: "邮箱",
  keywordPlaceholder: "按邮箱搜索",
  search: "搜索",
  add: "新增",
  // 列表表头
  columns: {
    email: "邮箱",
    allow: "允许登录",
    createTime: "创建时间",
    updateTime: "更新时间",
    options: "操作",
  },
  allowListAria: "顾问登录白名单",
  dataTableAria: "数据表格",
  noData: "暂无数据",
  hint: "顾问须在白名单中且勾选「允许」方可通过 CUHK SSO 登录；学生登录不受白名单限制。",
  allowCheckboxAria: "允许 {email} 登录",
  // 通用按钮
  edit: "编辑",
  delete: "删除",
  cancel: "取消",
  submit: "提交",
  // 弹窗
  addTitle: "新增白名单",
  editTitle: "编辑白名单",
  fields: {
    email: "邮箱",
    allow: "允许登录",
  },
  emailPlaceholder: "顾问 SSO 邮箱（如 advisor@cuhk.edu.cn）",
  // 删除确认
  deleteConfirmTitle: "确认删除",
  deleteConfirmBody: "确定将 {email} 从白名单中移除吗？移除后该顾问将无法通过 SSO 登录。",
  // 提示
  emailRequired: "请填写邮箱。",
  saved: "已保存。",
  saveFail: "保存失败。",
  deleted: "已删除。",
  deleteFail: "删除失败。",
  loadFail: "数据加载失败。",
} as const;
