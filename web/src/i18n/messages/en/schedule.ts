/** Schedule management strings (schedule namespace, shared by ScheduleView / ScheduleManagementView) */
export default {
  // Columns & form fields
  weekday: "Weekday",
  weekday1: "Monday",
  weekday2: "Tuesday",
  weekday3: "Wednesday",
  weekday4: "Thursday",
  weekday5: "Friday",
  weekday6: "Saturday",
  weekday7: "Sunday",
  startTime: "Start Time",
  endTime: "End Time",
  bookedState: "Booking",
  slotBooked: "Booked",
  slotAvailable: "Available",
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
  cancelSlot: "Cancel",
  // Cancel-slot dialog (booked students are cancelled one by one and notified by mail, cc the consultant; disabled within 4 hours of start)
  confirmCancelSlot: "Cancel This Slot",
  cancelSlotRange: "Cancel {weekday} {date} {start}-{end} for the upcoming occurrence?",
  cancelSlotNotify:
    "This slot has {count} booked student(s). They will be notified by email and the consultant will be cc'd.",
  cancelSlotNoBooking:
    "No student has booked this occurrence. Only the upcoming occurrence is cancelled; the weekly slot stays active.",
  cancelSlotReasonPlaceholder: "Cancel reason (optional, sent to students in the email)",
  back: "Back",
  slotCancelled: "Slot cancelled ({count} appointment(s) cancelled).",
  cancelSlotFail: "Fail to cancel the slot.",
  // Add / edit modal
  editSlotTitle: "Edit Slot",
  slotRange: "Slot",
  slotPlaceholder: "Select a slot",
  cancel: "Cancel",
  submit: "Submit",
  // Upload result modal
  uploadResult: "Upload Result",
  uploadSummary: "Success: {success}, Fail: {fail}",
  uploadRowError: "Row {row}: {reason}",
  close: "Close",
  // Delete confirm dialog
  confirmDelete: "Confirm Delete",
  deleteSlotRange: "Delete the {weekday} {start}-{end} weekly slot?",
  deleteConstraint: "Slots with existing appointments cannot be deleted.",
  // Validation & toasts
  loadFail: "Fail to load data.",
  slotRequired: "Please select a weekday and a slot.",
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
  advisorLabel: "Consultant",
  advisorPlaceholder: "Select an advisor",
  selectAdvisorTip: "Select an advisor to manage the schedule.",
  advisorsFail: "Fail to load advisors.",
  // Student-view preview (admin delegation page, row action "Preview": opens the real student page in a new tab)
  preview: "Preview",
} as const;
