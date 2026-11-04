/** 统计概览页文案（stats 命名空间） */
export default {
  overview: "概览",
  exportAll: "导出全部预约",
  // 统计卡
  cards: {
    total: "预约总数",
    completed: "已完成",
    cancelled: "已取消",
    booked: "进行中（已预约）",
  },
  // 顾问咨询量排名表
  rankingTableAria: "顾问咨询量排名",
  dataTableAria: "数据表格",
  columns: {
    rank: "排名",
    advisor: "顾问",
    appointments: "预约数",
    completed: "已完成",
  },
  noData: "暂无数据",
  // 提示文案
  loadFail: "统计数据加载失败。",
  exportFail: "导出失败。",
} as const;
