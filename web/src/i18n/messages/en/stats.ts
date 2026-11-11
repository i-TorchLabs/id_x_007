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
  // Consultant ranking table
  rankingTableAria: "Consultant ranking",
  dataTableAria: "Data table",
  columns: {
    rank: "Rank",
    advisor: "Consultant",
    appointments: "Appointments",
    completed: "Completed",
  },
  noData: "No data",
  // Toasts
  loadFail: "Fail to load stats.",
  exportFail: "Fail to export.",
} as const;
