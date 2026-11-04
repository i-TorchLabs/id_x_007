/** My appointments page strings (myAppointments namespace) */
export default {
  tableLabel: "My appointments",
  dataTableLabel: "data table",
  colApplyNo: "Apply No.",
  colAdvisor: "Advisor",
  colTime: "Time",
  colTopic: "Topic",
  colMode: "Mode",
  colState: "State",
  colCreateTime: "Created At",
  colActions: "Options",
  noData: "No data",
  cancel: "Cancel",
  confirmCancelTitle: "Confirm Cancel",
  confirmCancelBody:
    "Cancel appointment \"{applyNo}\" with {advisorName}? Appointments can only be cancelled at least 4 hours before the start time.",
  back: "Back",
  confirm: "Confirm",
  failToLoad: "Fail to load data.",
  cancelled: "Appointment cancelled.",
  failToCancel: "Fail to cancel.",
} as const;
