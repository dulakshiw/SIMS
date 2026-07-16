// Color System
export const COLORS = {
  primary: "#0b3b5b",
  primaryLight: "#2e77c7",
  primaryDark: "#081f31",
  backgroundLight: "#f6f7f8",
  backgroundDark: "#111b21",
  textDark: "#0e161b",
  textLight: "#4f7a96",
  borderLight: "#d0dee6",
  borderLighter: "#e8eef3",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
};

// Status Colors
export const STATUS_COLORS = {
  pending: "#f59e0b",
  approved: "#10b981",
  rejected: "#ef4444",
  completed: "#06b6d4",
  draft: "#8b5cf6",
  "in-transit": "#3b82f6",
};

// Disposal Status
export const DISPOSAL_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  COMPLETED: "completed",
  REJECTED: "rejected",
};

// Disposal Reasons
export const DISPOSAL_REASONS = [
  { value: "damage", label: "Damage" },
  { value: "obsolete", label: "Obsolete" },
  { value: "theft", label: "Theft" },
  { value: "lost", label: "Lost" },
  { value: "end-of-life", label: "End of Life" },
  { value: "other", label: "Other" },
];

// Disposal Types
export const DISPOSAL_TYPES = [
  { value: "auction", label: "Auction" },
  { value: "donation", label: "Donation" },
  { value: "other", label: "Other" },
];

export const getDisposalOptionLabel = (options = [], value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  const match = options.find((entry) => String(entry.value).toLowerCase() === normalized);
  return match?.label || value || "";
};

// Condition Assessment
export const CONDITION_ASSESSMENT = [
  { value: "poor", label: "Poor" },
  { value: "fair", label: "Fair" },
  { value: "good", label: "Good" },
];

// Role Types and Hierarchy
export const ROLES = {
  ADMIN: "admin",
  REGISTRAR: "registrar",
  STAFF: "staff",
  INVENTORY_INCHARGE: "inventory_incharge",
  HEAD_OF_DEPARTMENT: "head_of_department",
  DEAN: "dean",
};

// Role Descriptions and Permissions
export const ROLE_HIERARCHY = {
  admin: {
    label: "System Administrator",
    description: "Full system access and control",
    superclass: null,
    permissions: ["manage_users", "manage_departments", "manage_inventories", "create_inventory", "approve_accounts", "view_all_data"],
  },
  registrar: {
    label: "Registrar",
    description: "Approves inventory creation, item transfers, and item disposals",
    superclass: null,
    permissions: ["approve_inventory", "approve_transfers", "approve_disposals", "view_approval_details"],
  },
  staff: {
    label: "Staff Member",
    description: "Regular staff member",
    superclass: "staff",
    permissions: [
      "request_items",
      "view_request_status",
      "view_issued_items",
      "view_own_inventory",
      "view_reports",
      "view_profile",
    ],
  },
  inventory_incharge: {
    label: "Inventory Officer",
    description: "Manages inventory items, transfers, and disposals",
    superclass: "staff",
    permissions: [
      "create_inventory",
      "add_items",
      "update_items",
      "delete_items",
      "manage_transfers",
      "manage_disposals",
      "manage_repairs",
      "view_inventory",
      "request_items",
      "request_inventory_creation",
      "view_request_status",
      "view_issued_items",
      "view_reports",
      "view_profile",
    ],
  },
  head_of_department: {
    label: "Head of Department (HOD)",
    description: "Approves requests and manages department inventory",
    superclass: "staff",
    permissions: [
      "approve_inventory_requests",
      "approve_item_requests",
      "view_department_inventory",
      "view_department_users",
      "manage_department_staff",
      "approve_staff_accounts",
      "request_items",
      "view_request_status",
      "view_issued_items",
      "view_reports",
      "view_profile",
    ],
  },
  dean: {
    label: "Dean",
    description: "Faculty-level oversight of all inventories",
    superclass: "staff",
    permissions: [
      "view_faculty_inventory",
      "view_faculty_users",
      "approve_item_requests",
      "approve_hod_accounts",
      "request_items",
      "view_request_status",
      "view_issued_items",
      "view_reports",
      "view_profile",
    ],
  },
};

// Account Creation Request Status
export const ACCOUNT_REQUEST_STATUS = {
  PENDING_DEPT_HEAD: "pending_dept_head",
  PENDING_DEAN: "pending_dean",
  APPROVED_BY_DEPT_HEAD: "approved_by_dept_head",
  REJECTED: "rejected",
};

export const ACCOUNT_REQUEST_STATUS_META = {
  pending_dept_head: { label: "Pending HOD Approval", variant: "warning" },
  pending_dean: { label: "Pending Dean Approval", variant: "warning" },
  pending_admin: { label: "Pending Admin Approval", variant: "info" },
  approved_by_dept_head: { label: "HOD Approved", variant: "info" },
  approved_by_admin: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "error" },
};

// Inventory Creation Request Status
export const INVENTORY_REQUEST_STATUS = {
  PENDING_HOD: "pending_hod",
  APPROVED_BY_HOD: "approved_by_hod",
  PENDING_REGISTRAR: "pending_registrar",
  APPROVED_BY_REGISTRAR: "approved_by_registrar",
  COMPLETED: "completed",
  PENDING_STAFF: "pending_hod",
  REJECTED: "rejected",
};

export const INVENTORY_REQUEST_TYPE = {
  ADD_EXISTING: "add_inventory",
  CREATE_NEW: "new_inventory_creation",
  CHANGE_INCHARGE: "change_incharge",
};

export const INVENTORY_REQUEST_STATUS_META = {
  pending_staff: { label: "Pending HOD review", variant: "warning" },
  pending_hod: { label: "Pending HOD review", variant: "warning" },
  approved_by_hod: { label: "HOD approved", variant: "info" },
  pending_registrar: { label: "With registrar", variant: "info" },
  approved_by_registrar: { label: "Registrar approved", variant: "info" },
  pending_writeoff: { label: "Awaiting write-off", variant: "info" },
  pending_admin: { label: "With administrator", variant: "info" },
  approved_by_admin: { label: "Approved", variant: "success" },
  completed: { label: "Completed", variant: "success" },
  "process completed": { label: "Completed", variant: "success" },
  rejected: { label: "Rejected", variant: "error" },
};

export const INVENTORY_REQUEST_TYPE_LABELS = {
  add_inventory: "Add to existing inventory",
  new_inventory_creation: "New inventory creation",
  change_incharge: "Change inventory officer",
};

export const ITEM_REQUEST_STATUS = {
  PENDING_REQUESTER_HOD: "pending_requester_hod",
  PENDING_LAB_HOD: "pending_lab_hod",
  APPROVED_TO_ISSUE: "approved_to_issue",
  /** @deprecated use APPROVED_TO_ISSUE */
  PENDING_ISSUE: "approved_to_issue",
  APPROVED: "approved",
  RETURNED: "returned",
  PENDING_HOD: "pending_hod",
  APPROVED_BY_HOD: "approved_by_hod",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
};

export const ITEM_REQUEST_STATUS_META = {
  pending_requester_hod: { label: "Pending HOD recommendation", variant: "warning" },
  pending_hod: { label: "Pending HOD recommendation", variant: "warning" },
  pending_lab_hod: { label: "With lab HOD", variant: "info" },
  approved_to_issue: { label: "Approved to issue", variant: "info" },
  pending_issue: { label: "Approved to issue", variant: "info" },
  approved: { label: "Issued", variant: "success" },
  returned: { label: "Returned", variant: "secondary" },
  approved_by_hod: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "error" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

export const ITEM_REQUEST_PENDING_REQUESTER_STATUSES = new Set([
  ITEM_REQUEST_STATUS.PENDING_REQUESTER_HOD,
  ITEM_REQUEST_STATUS.PENDING_HOD,
]);

// Item Transfer/Disposal Status
export const ITEM_REMARK_TYPE = {
  TRANSFERRED: "transferred",
  DISPOSED: "disposed",
  REPAIRED: "repaired",
};


// Item Status
export const ITEM_STATUS = [
  { value: "available", label: "Available", color: "success" },
  { value: "in-use", label: "In Use", color: "info" },
  { value: "issued", label: "Issued", color: "info" },
  { value: "returned", label: "Returned", color: "secondary" },
  { value: "Returned", label: "Returned", color: "secondary" },
  { value: "maintenance", label: "Maintenance", color: "warning" },
  { value: "damaged", label: "Damaged", color: "error" },
  { value: "disposed", label: "Disposed", color: "text-light" },
];

// Transfer Status
export const TRANSFER_STATUS = [
  { value: "pending", label: "Pending", color: "warning" },
  { value: "approved", label: "Approved", color: "success" },
  { value: "in-transit", label: "In Transit", color: "info" },
  { value: "completed", label: "Completed", color: "success" },
  { value: "rejected", label: "Rejected", color: "error" },
];

// Request Priority
export const REQUEST_PRIORITY = [
  { value: "low", label: "Low", color: "info" },
  { value: "normal", label: "Normal", color: "warning" },
  { value: "urgent", label: "Urgent", color: "error" },
];

// Date Format Options
export const DATE_FORMAT = "MMM dd, yyyy";
export const TIME_FORMAT = "HH:mm";
export const DATETIME_FORMAT = "MMM dd, yyyy HH:mm";

// Pagination
export const ITEMS_PER_PAGE = 10;
export const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

// Navigation Items
export const ADMIN_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/admin/dashboard", icon: "dashboard" },
  { id: 2, label: "Inventory", path: "/admin/inventory", icon: "inventory_2" },
  { id: 3, label: "Departments", path: "/admin/departments", icon: "business" },
  { id: 4, label: "Users", path: "/admin/users", icon: "people" },
  { id: 5, label: "Reports", path: "/admin/reports", icon: "assessment" },
  { id: 6, label: "Profile", path: "/admin/profile", icon: "person" },
];

export const REGISTRAR_NAV_ITEMS = [
  { id: "registrar-dashboard", type: "item", label: "Dashboard", path: "/admin/dashboard", icon: "dashboard" },
  { id: "registrar-approvals", type: "section", label: "Approvals" },
  {
    id: "registrar-inventory",
    type: "item",
    label: "Inventory Creation",
    path: "/admin/pending-tasks",
    icon: "inventory_2",
    nested: true,
    activeTab: "inventory-requests",
  },
  {
    id: "registrar-transfers",
    type: "item",
    label: "Item Transfers",
    path: "/admin/pending-tasks",
    icon: "compare_arrows",
    nested: true,
    activeTab: "transfer-requests",
  },
  {
    id: "registrar-disposals",
    type: "item",
    label: "Item Disposals",
    path: "/admin/pending-tasks",
    icon: "delete_sweep",
    nested: true,
    activeTab: "disposal-requests",
  },
  { id: "registrar-view-inventories", type: "section", label: "Inventories" },
  { id: "registrar-inventories-list", type: "item", label: "View Inventories", path: "/admin/inventory", icon: "inventory_2", nested: true },
  { id: "registrar-profile", type: "item", label: "Profile", path: "/admin/profile", icon: "person" },
];

export const INVENTORY_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/inventory/dashboard", icon: "home" },
  { id: "inventory-menu", type: "section", label: "Inventories", icon: "inventory_2" },
  { id: 2, type: "item", label: "Items", path: "/inventory/list", icon: "inventory", nested: true },
  { id: 3, type: "item", label: "Add Item", path: "/inventory/add", icon: "add_circle", nested: true },
  { id: 4, type: "item", label: "Transfers", path: "/inventory/transfers/list", icon: "compare_arrows", nested: true },
  { id: 5, type: "item", label: "Disposals", path: "/inventory/disposals/list", icon: "delete_sweep", nested: true },
  {
    id: "inventory-warranty-claims",
    type: "item",
    label: "Warranty Claims",
    path: "/inventory/repairs/warranty-claims/list",
    icon: "verified_user",
    nested: true,
  },
  {
    id: "inventory-repairs",
    type: "item",
    label: "Repairs",
    path: "/inventory/repairs/list",
    icon: "handyman",
    nested: true,
  },
  {
    id: 6,
    type: "item",
    label: "Inventory Requests",
    path: "/inventory/requests/list",
    icon: "request_quote",
    nested: true,
  },
  {
    id: "inventory-reports",
    type: "item",
    label: "Reports",
    path: "/inventory/reports",
    icon: "assessment",
    nested: true,
  },
  { id: 7, label: "Profile", path: "/profile", icon: "person" },
];

export const STAFF_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/staff/dashboard", icon: "dashboard" },
  { id: 2, label: "Request Items", path: "/inventory/requests/new/staff", icon: "add_circle" },
  { id: 3, label: "My Requests", path: "/requests/my/staff", icon: "fact_check" },
  { id: 4, label: "My Issued Items", path: "/inventory/list/staff", icon: "inventory_2" },
  { id: 5, label: "Reports", path: "/reports/staff", icon: "assessment" },
  { id: 6, label: "Profile", path: "/profile/staff", icon: "person" },
];

export const STAFF_INCHARGE_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/staff/dashboard", icon: "dashboard" },
  { id: 2, label: "Request Items", path: "/inventory/requests/new/staff", icon: "add_circle" },
  { id: 3, label: "My Requests", path: "/requests/my/staff", icon: "fact_check" },
  { id: 4, label: "My Issued Items", path: "/inventory/list/staff", icon: "inventory_2" },
  { id: "staff-incharge-inventories-menu", type: "section", label: "Inventories", icon: "inventory_2" },
  { id: 5, type: "item", label: "My Inventories", path: "/inventory/list/incharge", icon: "inventory", nested: true },
  { id: 6, type: "item", label: "Add Item", path: "/inventory/add/incharge", icon: "playlist_add", nested: true },
  { id: 7, type: "item", label: "Transfers", path: "/inventory/transfers/list/incharge", icon: "compare_arrows", nested: true },
  { id: 8, type: "item", label: "Disposals", path: "/inventory/disposals/list/incharge", icon: "delete_sweep", nested: true },
  {
    id: "staff-warranty-claims",
    type: "item",
    label: "Warranty Claims",
    path: "/inventory/repairs/warranty-claims/list/incharge",
    icon: "verified_user",
    nested: true,
  },
  {
    id: "staff-repairs",
    type: "item",
    label: "Repairs",
    path: "/inventory/repairs/list/incharge",
    icon: "handyman",
    nested: true,
  },
  {
    id: 9,
    type: "item",
    label: "Inventory Requests",
    path: "/inventory/requests/list/incharge",
    icon: "request_quote",
    nested: true,
  },
  { id: 10, label: "Reports", path: "/inventory/reports/incharge", icon: "assessment" },
  { id: 11, label: "Profile", path: "/profile/staff", icon: "person" },
];

export const HOD_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/hod/dashboard", icon: "dashboard" },
  { id: 2, label: "Pending Tasks", path: "/hod/pending-tasks", icon: "pending_actions" },
  {
    id: "hod-approval-history",
    label: "Approval History",
    path: "/hod/approval-history",
    icon: "history",
    activeTab: "forwarded",
  },
  { id: "hod-my-requests-menu", type: "section", label: "Item Requests", icon: "fact_check" },
  {
    id: "hod-request-items",
    type: "item",
    label: "Request Items",
    path: "/inventory/requests/new/hod",
    icon: "add_circle",
    nested: true,
  },
  {
    id: "hod-my-requests-track",
    type: "item",
    label: "My Requests",
    path: "/requests/my/hod",
    icon: "receipt_long",
    nested: true,
  },
  {
    id: "hod-my-issued-items",
    type: "item",
    label: "My Issued Items",
    path: "/inventory/list/hod",
    icon: "inventory_2",
    nested: true,
  },
  { id: "hod-inventories", label: "Inventories", path: "/hod/inventory", icon: "inventory_2" },
  { id: 6, label: "Requests by Staff", path: "/inventory/requests/list/hod", icon: "rule" },
  { id: 7, label: "Reports", path: "/reports/hod", icon: "assessment" },
  { id: 8, label: "Profile", path: "/profile/hod", icon: "person" },

];

export const DEAN_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/dean/dashboard", icon: "dashboard" },
   { id: "dean-my-requests-menu", type: "section", label: "My Requests", icon: "fact_check" },
  {
    id: "dean-request-items",
    type: "item",
    label: "Request Items",
    path: "/inventory/requests/new/dean",
    icon: "add_circle",
    nested: true,
  },
  {
    id: "dean-my-requests-track",
    type: "item",
    label: "My Requests",
    path: "/requests/my/dean",
    icon: "receipt_long",
    nested: true,
  },
   {
    id: "dean-my-issued-items",
    type: "item",
    label: "My Issued Items",
    path: "/inventory/list/dean",
    icon: "inventory_2",
    nested: true,
  },
  { id: 3, label: "All Inventory Items", path: "/dean/inventory", icon: "inventory_2" },
  { id: 4, label: "Pending Approvals", path: "/requests/approval/dean", icon: "how_to_reg" },
  { id: 5, label: "Reports", path: "/reports/dean", icon: "assessment" },
  { id: 6, label: "Profile", path: "/profile/dean", icon: "person" },
];

// Mock data structure
export const MOCK_USER = {
  id: 1,
  name: "John Doe",
  email: "john@example.com",
  role: ROLES.ADMIN,
  department: "IT",
  avatar: null,
};

export default {
  COLORS,
  STATUS_COLORS,
  DISPOSAL_STATUS,
  DISPOSAL_REASONS,
  CONDITION_ASSESSMENT,
  ROLES,
  ROLE_HIERARCHY,
  ACCOUNT_REQUEST_STATUS,
  ACCOUNT_REQUEST_STATUS_META,
  INVENTORY_REQUEST_STATUS,
  ITEM_REMARK_TYPE,
  ITEM_STATUS,
  TRANSFER_STATUS,
  REQUEST_PRIORITY,
  DATE_FORMAT,
  TIME_FORMAT,
  DATETIME_FORMAT,
  ITEMS_PER_PAGE,
  ITEMS_PER_PAGE_OPTIONS,
  ADMIN_NAV_ITEMS,
  REGISTRAR_NAV_ITEMS,
  INVENTORY_NAV_ITEMS,
  STAFF_NAV_ITEMS,
  STAFF_INCHARGE_NAV_ITEMS,
  HOD_NAV_ITEMS,
  DEAN_NAV_ITEMS,
  MOCK_USER,
};
