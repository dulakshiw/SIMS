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

// Role Types
export const ROLES = {
  ADMIN: "admin",
  STAFF: "staff",
  INCHARGE: "incharge",
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
  { id: 2, label: "Users", path: "/admin/users", icon: "people" },
  { id: 3, label: "Reports", path: "/admin/reports", icon: "assessment" },
];

export const INVENTORY_NAV_ITEMS = [
  { id: 1, label: "Dashboard", path: "/inventory/dashboard", icon: "home" },
  { id: 2, label: "Items", path: "/inventory/list", icon: "inventory_2" },
  { id: 3, label: "Add Item", path: "/inventory/add", icon: "add_circle" },
  { id: 4, label: "Transfers", path: "/inventory/transfers", icon: "compare_arrows" },
  { id: 5, label: "Disposals", path: "/inventory/disposals", icon: "delete_sweep" },
  { id: 6, label: "Requests", path: "/inventory/requests", icon: "request_quote" },
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
  MOCK_USER,
};
