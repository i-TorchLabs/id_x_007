/** Common strings: layout chrome / menus / dialogs / paginator / form controls (common namespace) */
export default {
  appName: "SME UGO",
  home: "Home",
  logout: "Logout",
  logoutConfirmTitle: "Tips",
  logoutConfirmBody: "Are you sure to exit?",
  cancel: "Cancel",
  confirm: "Confirm",
  switchLanguage: "Switch language",
  // Password input visibility toggle (PasswordInput)
  showPassword: "Show password",
  hidePassword: "Hide password",
  // Admin menu (AdminLayout)
  menuAdmin: {
    advisors: "Advisors",
    schedules: "Schedules",
    appointments: "Appointments",
    feedback: "Feedback",
    stats: "Stats",
    emailLogs: "Email Logs",
  },
  // Advisor menu (AdvisorLayout)
  menuAdvisor: {
    mySchedule: "My Schedule",
    myAppointments: "My Appointments",
  },
  // Student menu (UserLayout)
  menuUser: {
    advisors: "Advisors",
    myAppointments: "My Appointments",
  },
  // Paginator
  paginator: {
    total: "{count} items in total",
    page: "Page {page} of {totalPages}",
    prev: "Previous",
    next: "Next",
  },
  // Common actions
  actions: {
    search: "Search",
    reset: "Reset",
    create: "Create",
    edit: "Edit",
    save: "Save",
    delete: "Delete",
    submit: "Submit",
    close: "Close",
    back: "Back",
    view: "View",
  },
  // State fields (StateChip etc.)
  state: {
    enabled: "Enabled",
    disabled: "Disabled",
    all: "All",
    booked: "Booked",
    completed: "Completed",
    cancelled: "Cancelled",
    paused: "Paused",
    open: "Open",
  },
} as const;
