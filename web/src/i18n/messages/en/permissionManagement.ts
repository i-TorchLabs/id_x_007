/** Permission management page messages (permissionManagement namespace) */
export default {
  // Search bar
  keyword: "Email",
  keywordPlaceholder: "Search by email",
  search: "Search",
  add: "Add",
  // Table columns
  columns: {
    email: "Email",
    allow: "Allow Login",
    createTime: "Created At",
    updateTime: "Updated At",
    options: "Options",
  },
  allowListAria: "Consultant login allowlist",
  dataTableAria: "Data table",
  noData: "No data",
  hint: "Consultants must be on the allowlist with \"Allow\" checked to sign in via CUHK SSO; student logins are not restricted.",
  allowCheckboxAria: "Allow {email} to sign in",
  // Common buttons
  edit: "Edit",
  delete: "Delete",
  cancel: "Cancel",
  submit: "Submit",
  // Modal
  addTitle: "Add Allowlist Entry",
  editTitle: "Edit Allowlist Entry",
  fields: {
    email: "Email",
    allow: "Allow Login",
  },
  emailPlaceholder: "Consultant SSO email (e.g. advisor@cuhk.edu.cn)",
  // Delete confirm
  deleteConfirmTitle: "Confirm Deletion",
  deleteConfirmBody: "Remove {email} from the allowlist? The consultant will no longer be able to sign in via SSO.",
  // Toasts
  emailRequired: "Please enter the email.",
  saved: "Saved.",
  saveFail: "Failed to save.",
  deleted: "Deleted.",
  deleteFail: "Failed to delete.",
  loadFail: "Failed to load data.",
} as const;
