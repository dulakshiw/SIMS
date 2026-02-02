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
];

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
    permissions: ["manage_users", "manage_departments", "manage_inventories", "approve_accounts", "view_all_data"],
  },
  registrar: {
    label: "Registrar",
    description: "Approves inventory creation and user account activations",
    superclass: null,
    permissions: ["approve_inventory", "activate_accounts", "view_all_data", "manage_departments"],
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
    label: "Inventory In-Charge",
    description: "Manages inventory items, transfers, and disposals",
    superclass: "staff",
    permissions: [
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
      "recommend_inventory_creation",
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
  APPROVED_BY_DEPT_HEAD: "approved_by_dept_head",
  PENDING_ADMIN: "pending_admin",
  APPROVED_BY_ADMIN: "approved_by_admin",
  REJECTED: "rejected",
};

// Inventory Creation Request Status
export const INVENTORY_REQUEST_STATUS = {
  PENDING_STAFF: "pending_staff",
  APPROVED_BY_HOD: "approved_by_hod",
  PENDING_REGISTRAR: "pending_registrar",
  APPROVED_BY_REGISTRAR: "approved_by_registrar",
  REJECTED: "rejected",
};

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
  { id: 2, label: "Inventory", path: "/admin/inventories", icon: "inventory_2" },
  { id: 3, label: "Departments", path: "/admin/departments", icon: "business" },
  { id: 4, label: "Users", path: "/admin/users", icon: "people" },
  { id: 5, label: "Reports", path: "/admin/reports", icon: "assessment" },
  { id: 6, label: "Profile", path: "/admin/profile", icon: "person" },
];

export const INVENTORY_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/inventory/dashboard", icon: "home" },
  { id: 2, label: "Items", path: "/inventory/list", icon: "inventory_2" },
  { id: 3, label: "Add Item", path: "/inventory/add", icon: "add_circle" },
  { id: 4, label: "Transfers", path: "/inventory/transfers/list", icon: "compare_arrows" },
  { id: 5, label: "Disposals", path: "/inventory/disposals/list", icon: "delete_sweep" },
  { id: 6, label: "Requests", path: "/inventory/requests/list", icon: "request_quote" },
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

export const HOD_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/hod/dashboard", icon: "dashboard" },
  { id: 2, label: "Request Items", path: "/inventory/requests/new/hod", icon: "add_circle" },
  { id: 3, label: "My Requests", path: "/requests/my/hod", icon: "fact_check" },
  { id: 4, label: "Requests by Staff", path: "/inventory/requests/list/hod", icon: "rule" },
  { id: 5, label: "Inventories", path: "/inventory/list/hod", icon: "inventory_2" },
  { id: 6, label: "Reports", path: "/reports/hod", icon: "assessment" },
  { id: 7, label: "Profile", path: "/profile/hod", icon: "person" },
];

export const DEAN_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/dean/dashboard", icon: "dashboard" },
  { id: 2, label: "Request Items", path: "/inventory/requests/new/dean", icon: "add_circle" },
  { id: 3, label: "My Requests", path: "/requests/my/dean", icon: "fact_check" },
  { id: 4, label: "Faculty Inventories", path: "/inventory/list/dean", icon: "inventory_2" },
  { id: 5, label: "Faculty Requests", path: "/inventory/requests/list/dean", icon: "rule" },
  { id: 6, label: "Approvals", path: "/requests/approval/dean", icon: "how_to_reg" },
  { id: 7, label: "Reports", path: "/reports/dean", icon: "assessment" },
  { id: 8, label: "Profile", path: "/profile/dean", icon: "person" },
];

export const INCHARGE_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/incharge/dashboard", icon: "dashboard" },
  { id: 2, label: "My Inventories", path: "/inventory/list/incharge", icon: "inventory_2" },
  { id: 3, label: "Add Item", path: "/inventory/add/incharge", icon: "add_circle" },
  { id: 4, label: "Transfers", path: "/inventory/transfers/list/incharge", icon: "compare_arrows" },
  { id: 5, label: "Disposals", path: "/inventory/disposals/list/incharge", icon: "delete_sweep" },
  { id: 6, label: "My Requests", path: "/requests/my/incharge", icon: "fact_check" },
  { id: 7, label: "Requests", path: "/inventory/requests/list/incharge", icon: "request_quote" },
  { id: 8, label: "Reports", path: "/reports/incharge", icon: "assessment" },
  { id: 9, label: "Profile", path: "/profile/incharge", icon: "person" },
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
  INVENTORY_NAV_ITEMS,
  STAFF_NAV_ITEMS,
  HOD_NAV_ITEMS,
  DEAN_NAV_ITEMS,
  INCHARGE_NAV_ITEMS,
  MOCK_USER,
};
