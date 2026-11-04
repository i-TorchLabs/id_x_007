/** Schedule management strings (schedule namespace, shared by ScheduleView / ScheduleManagementView) */
export default {
  // Columns & form fields
  startTime: "Start Time",
  endTime: "End Time",
  quota: "Quota",
  bookedQuota: "Booked/Quota",
  state: "State",
  options: "Options",
  // Toolbar
  addSlot: "Add Slot",
  downloadTemplate: "Download Template",
  batchUpload: "Batch Upload",
  acceptingOn: "Accepting appointments",
  acceptingOff: "Not accepting",
  // Table
  tableLabel: "Slot list",
  tableAria: "data table",
  noData: "No data",
  // Row action buttons
  edit: "Edit",
  resume: "Resume",
  pause: "Pause",
  delete: "Delete",
  // Add / edit modal
  editSlotTitle: "Edit Slot",
  cancel: "Cancel",
  submit: "Submit",
  // Upload result modal
  uploadResult: "Upload Result",
  uploadSummary: "Success: {success}, Fail: {fail}",
  uploadRowError: "Row {row}: {reason}",
  close: "Close",
  // Delete confirm dialog
  confirmDelete: "Confirm Delete",
  deleteSlotRange: "Delete slot {start} ~ {end}?",
  deleteConstraint: "Slots with existing appointments cannot be deleted.",
  // Validation & toasts
  loadFail: "Fail to load data.",
  timeRequired: "Start time and end time are required.",
  endAfterStart: "End time must be later than start time.",
  quotaMinOne: "Quota must be at least 1.",
  saved: "Saved successfully.",
  saveFail: "Fail to save.",
  slotPaused: "Slot paused.",
  slotResumed: "Slot resumed.",
  stateFail: "Fail to update state.",
  deleted: "Deleted successfully.",
  deleteFail: "Fail to delete.",
  templateFail: "Fail to download template.",
  uploadFinished: "Upload finished (success: {success}, fail: {fail}).",
  uploadFail: "Fail to upload.",
  acceptingOnToast: "Now accepting new appointments.",
  acceptingOffToast: "New appointments suspended.",
  updateFail: "Fail to update.",
  // Admin delegation page (ScheduleManagementView)
  advisorLabel: "Advisor",
  advisorPlaceholder: "Select an advisor",
  selectAdvisorTip: "Select an advisor to manage the schedule.",
  advisorsFail: "Fail to load advisors.",
  // Student-view preview (admin delegation page, row action "Preview": opens the real student page in a new tab)
  preview: "Preview",
} as const;
