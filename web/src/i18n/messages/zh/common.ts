/** 通用文案：布局骨架 / 菜单 / 弹窗 / 分页 / 表单控件（common 命名空间） */
export default {
  appName: "UGO 朋辈顾问预约",
  home: "首页",
  logout: "退出登录",
  logoutConfirmTitle: "提示",
  logoutConfirmBody: "确定要退出登录吗？",
  cancel: "取消",
  confirm: "确认",
  switchLanguage: "切换语言",
  // 密码框可见性切换（PasswordInput）
  showPassword: "显示密码",
  hidePassword: "隐藏密码",
  // 管理端菜单（AdminLayout）
  menuAdmin: {
    advisors: "顾问管理",
    schedules: "时段管理",
    appointments: "预约管理",
    feedback: "反馈管理",
    stats: "数据统计",
    emailLogs: "邮件日志",
  },
  // 顾问端菜单（AdvisorLayout）
  menuAdvisor: {
    mySchedule: "我的时段",
    myAppointments: "我的预约",
  },
  // 学生端菜单（UserLayout）
  menuUser: {
    advisors: "顾问列表",
    myAppointments: "我的预约",
  },
  // 分页器（Paginator）
  paginator: {
    total: "共 {count} 条",
    page: "第 {page} / {totalPages} 页",
    prev: "上一页",
    next: "下一页",
  },
  // 通用操作
  actions: {
    search: "查询",
    reset: "重置",
    create: "新建",
    edit: "编辑",
    save: "保存",
    delete: "删除",
    submit: "提交",
    close: "关闭",
    back: "返回",
    view: "查看",
  },
  // 状态字段（StateChip 等）
  state: {
    enabled: "启用",
    disabled: "停用",
    all: "全部",
    booked: "已预约",
    completed: "已完成",
    cancelled: "已取消",
    paused: "已暂停",
    open: "开放中",
  },
} as const;
