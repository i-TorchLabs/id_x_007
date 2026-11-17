/** Consultant management page strings (advisorManagement namespace) */
export default {
  // Tabs (consultant profiles / permission whitelist)
  tabs: {
    advisors: "Consultants",
    permissions: "Permission Management",
  },
  // Search bar
  keyword: "Keyword",
  keywordPlaceholder: "Name / email / major",
  search: "Search",
  add: "Add",
  // Consultant list columns
  columns: {
    name: "Name",
    email: "Email (login account)",
    grade: "Grade",
    major: "Major",
    direction: "Direction",
    status: "Status",
    accepting: "Accepting",
    slots: "Slots",
    appointments: "Appointments",
    options: "Options",
  },
  advisorListAria: "Consultant list",
  dataTableAria: "Data table",
  noData: "No data",
  // Status chips
  enabled: "Enabled",
  disabled: "Disabled",
  yes: "Yes",
  no: "No",
  // Common buttons
  edit: "Edit",
  delete: "Delete",
  cancel: "Cancel",
  submit: "Submit",
  // Add / edit modal
  editTitle: "Edit Consultant",
  addTitle: "Add Consultant",
  fields: {
    name: "Name",
    email: "Email (login account)",
    grade: "Grade",
    major: "Major",
    direction: "Direction",
    bio: "Bio",
    photo: "Photo",
    enabled: "Enabled",
    accepting: "Accepting",
    ssoAllow: "SSO Login Access",
  },
  ssoAllowHint: "When on, the consultant's email is added to the SSO login allowlist (synced with the Permissions tab); when off, SSO login is blocked. Enabled by default for new consultants.",
  bioPlaceholder: "Consultant introduction",
  uploadPhoto: "Upload (max 3MB)",
  photoAlt: "Preview",
  remove: "Remove",
  noPhoto: "No photo",
  // Delete confirmation
  deleteConfirmTitle: "Confirm Delete",
  deleteConfirmBody: "Delete advisor \"{name}\"? Consultants with existing appointments cannot be deleted.",
  // Toasts
  loadFail: "Fail to load data.",
  photoTooLarge: "Photo must be smaller than 3MB.",
  photoReadFail: "Fail to read photo.",
  emailRequired: "Please enter the email (login account, CUHK SSO email).",
  emailPlaceholder: "e.g. rayzha@cuhk.edu.cn (must match the consultant's SSO account)",
  nameRequired: "Name is required.",
  saved: "Saved successfully.",
  saveFail: "Fail to save.",
  deleted: "Deleted successfully.",
  deleteFail: "Fail to delete.",
} as const;
