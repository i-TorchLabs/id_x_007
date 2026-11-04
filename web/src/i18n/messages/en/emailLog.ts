/** Email log page strings (emailLog namespace) */
export default {
  filter: {
    mailType: "Mail Type",
    allTypes: "All Types",
  },
  type: {
    booked: "Booked",
    cancelled: "Cancelled",
    reminder: "Reminder",
  },
  templateType: {
    booked: "Booking Confirmation",
    cancelled: "Cancellation Notice",
    reminder: "Daily Reminder",
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
