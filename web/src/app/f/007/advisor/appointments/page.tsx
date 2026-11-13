import AppointmentManagementView from "@/views/AppointmentManagementView";

/** C-2/C-3/C-4 我的预约：仅本人数据，含取消/完成/反馈/导出 */
export default function AdvisorAppointmentsPage() {
  return <AppointmentManagementView mode="advisor" />;
}
