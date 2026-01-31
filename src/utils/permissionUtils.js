// Permission and Role Management Utilities
import { ROLE_HIERARCHY, ROLES } from "./constants";

/**
 * Check if a user has a specific permission
 * @param {string} userRole - The user's role
 * @param {string} permission - The permission to check
 * @returns {boolean} - True if user has permission
 */
export const hasPermission = (userRole, permission) => {
  const roleData = ROLE_HIERARCHY[userRole];
  return roleData && roleData.permissions.includes(permission);
};

/**
 * Check if user can manage inventory items
 * @param {string} userRole - The user's role
 * @returns {boolean} - True if user can add/update/delete items
 */
export const canManageInventoryItems = (userRole) => {
  return (
    hasPermission(userRole, "add_items") &&
    hasPermission(userRole, "update_items") &&
    hasPermission(userRole, "delete_items")
  );
};

/**
 * Check if user can approve inventory requests
 * @param {string} userRole - The user's role
 * @returns {boolean} - True if user can approve
 */
export const canApproveInventory = (userRole) => {
  return hasPermission(userRole, "approve_inventory_requests");
};

/**
 * Check if user can manage transfers and disposals
 * @param {string} userRole - The user's role
 * @returns {boolean} - True if user can manage
 */
export const canManageTransfersAndDisposals = (userRole) => {
  return (
    hasPermission(userRole, "manage_transfers") &&
    hasPermission(userRole, "manage_disposals")
  );
};

/**
 * Check if user is a staff member (all roles except admin and registrar)
 * @param {string} userRole - The user's role
 * @returns {boolean} - True if user is staff member
 */
export const isStaffMember = (userRole) => {
  return ROLE_HIERARCHY[userRole]?.superclass === "staff";
};

/**
 * Check if user can request items
 * @param {string} userRole - The user's role
 * @returns {boolean} - True if user can request items
 */
export const canRequestItems = (userRole) => {
  return hasPermission(userRole, "request_items");
};

/**
 * Get all available roles for assignment (excludes admin/registrar)
 * @param {string} assignedByRole - Role of person doing the assignment
 * @returns {array} - Array of assignable roles
 */
export const getAssignableRoles = (assignedByRole) => {
  // Only admin and registrar can assign roles
  if (assignedByRole !== ROLES.ADMIN && assignedByRole !== ROLES.REGISTRAR) {
    return [];
  }

  return Object.entries(ROLE_HIERARCHY)
    .filter(([key]) => key !== ROLES.ADMIN && key !== ROLES.REGISTRAR)
    .map(([key, value]) => ({
      value: key,
      label: value.label,
    }));
};

/**
 * Get role label and description
 * @param {string} role - The role key
 * @returns {object} - Role label and description
 */
export const getRoleInfo = (role) => {
  const roleData = ROLE_HIERARCHY[role];
  return roleData || { label: "Unknown", description: "Unknown role" };
};

/**
 * Check if user can approve account creation
 * @param {string} userRole - The user's role
 * @param {string} requestContext - Context of who is making the request (dept_head or admin)
 * @returns {boolean} - True if user can approve
 */
export const canApproveAccountCreation = (userRole, requestContext) => {
  if (requestContext === "dept_head") {
    return userRole === ROLES.HEAD_OF_DEPARTMENT;
  }
  if (requestContext === "admin") {
    return userRole === ROLES.ADMIN;
  }
  return false;
};

/**
 * Get next approval authority for account creation
 * @param {string} currentStatus - Current approval status
 * @returns {object} - Next authority and required role
 */
export const getNextAccountApprovalAuthority = (currentStatus) => {
  const authorities = {
    pending_dept_head: {
      authority: "Department Head",
      requiredRole: ROLES.HEAD_OF_DEPARTMENT,
      nextStatus: "approved_by_dept_head",
    },
    approved_by_dept_head: {
      authority: "System Administrator",
      requiredRole: ROLES.ADMIN,
      nextStatus: "approved_by_admin",
    },
  };
  return authorities[currentStatus] || null;
};

/**
 * Get department inventory viewers based on role
 * @param {string} userRole - The user's role
 * @param {string} userDepartment - The user's department
 * @returns {object} - Inventory viewing rules
 */
export const getInventoryViewingRules = (userRole, userDepartment) => {
  return {
    hod: userRole === ROLES.HEAD_OF_DEPARTMENT && {
      canViewDepartmentInventory: true,
      department: userDepartment,
    },
    dean: userRole === ROLES.DEAN && {
      canViewFacultyInventory: true,
      faculty: userDepartment, // Assuming faculty is stored in department
    },
    incharge: userRole === ROLES.INVENTORY_INCHARGE && {
      canViewAssignedInventory: true,
    },
  };
};
