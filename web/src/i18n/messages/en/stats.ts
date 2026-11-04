/** Stats overview page strings (stats namespace) */
export default {
  overview: "Overview",
  exportAll: "Export All Appointments",
  // Stat cards
  cards: {
    total: "Total Appointments",
    completed: "Completed",
    cancelled: "Cancelled",
    booked: "In Progress (Booked)",
  },
  // Advisor ranking table
  rankingTableAria: "Advisor ranking",
  dataTableAria: "Data table",
  columns: {
    rank: "Rank",
    advisor: "Advisor",
    appointments: "Appointments",
    completed: "Completed",
  },
  noData: "No data",
  // Toasts
  loadFail: "Fail to load stats.",
  exportFail: "Fail to export.",
} as const;
