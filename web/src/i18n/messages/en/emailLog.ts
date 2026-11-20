/** Email log page strings (emailLog namespace) */
export default {
  filter: {
    mailType: "Mail Type",
    allTypes: "All Types",
    reset: "Reset",
  },
  // Mail log type chips (maps to backend mail_type)
  type: {
    bookedStudent: "Booking Confirmed",
    bookedAdvisor: "New Booking",
    reminder: "Day-before Reminder",
    cancelled: "Student Cancelled",
    cancelledAdvisor: "Cancelled by Consultant",
  },
  // Template dropdown labels (trigger timing in parentheses)
  templateType: {
    bookedStudent: "Booking Confirmed (to student, on booking)",
    bookedAdvisor: "New Booking (to consultant, on booking)",
    reminder: "Day-before Reminder (21:00 the day before, both)",
    cancelled: "Student Cancelled (to student, on cancellation)",
    cancelledAdvisor: "Cancelled by Consultant (to student, cc consultant)",
  },
  status: {
    sent: "Sent",
    failed: "Failed",
    skipped: "Skipped",
  },
  column: {
    recipient: "Recipient",
    type: "Type",
    subject: "Subject",
    status: "Status",
    error: "Error",
    time: "Time",
  },
  mailTemplates: "Mail Templates",
  noData: "No data",
  tableLabel: "Email log list",
  dataTableLabel: "data table",
  loadFail: "Fail to load data.",
  modal: {
    template: "Template",
    subject: "Subject",
    htmlContent: "HTML Content",
    availablePlaceholders: "Available placeholders: {placeholders}",
    lastUpdated: "Last updated: {time}",
    close: "Close",
    save: "Save",
  },
  toast: {
    loadTemplatesFail: "Fail to load templates.",
    subjectRequired: "Subject is required.",
    htmlRequired: "HTML content is required.",
    templateSaved: "Template saved.",
    saveTemplateFail: "Fail to save template.",
  },
} as const;
