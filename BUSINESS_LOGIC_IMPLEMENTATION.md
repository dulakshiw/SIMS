# Business Logic Implementation Summary

## Overview

This document details the comprehensive business logic implementation for the SIMS (Smart Inventory Management System) including user role hierarchy, request workflows, and permission management.

---

## 1. User Role Hierarchy

### System Roles (Non-Staff)

1. **Admin** - System administrator with full access
2. **Registrar** - Approves inventory creation and account activations

### Staff Member Superclass (All other roles)

- **Staff Member** - Regular employee
- **Inventory In-Charge** - Manages inventory items and operations
- **Head of Department (HOD)** - Department-level oversight
- **Dean** - Faculty-level oversight

---

## 2. Permissions System

### File Structure

- **Location**: `src/utils/permissionUtils.js`
- **Constants**: `src/utils/constants.js`

### Key Permission Functions

```javascript
// Check specific permission
hasPermission(userRole, permissionName);

// Check multiple permissions
canManageInventoryItems(userRole);
canApproveInventory(userRole);
canManageTransfersAndDisposals(userRole);
canRequestItems(userRole);
isStaffMember(userRole);

// Role information
getRoleInfo(role);
getAssignableRoles(assignedByRole);

// Approval workflows
canApproveAccountCreation(userRole, context);
getNextAccountApprovalAuthority(currentStatus);
getInventoryViewingRules(userRole, userDepartment);
```

### Permission Categories

#### Inventory Management

- `add_items` - Add new items to inventory
- `update_items` - Modify item details
- `delete_items` - Remove items from inventory
- `manage_transfers` - Handle item transfers between inventories
- `manage_disposals` - Process item disposals
- `manage_repairs` - Manage item repairs

#### Approvals

- `approve_inventory` - Approve inventory creation
- `approve_inventory_requests` - Approve item requests
- `activate_accounts` - Activate user accounts

#### Viewing

- `view_all_data` - View all system data
- `view_inventory` - View inventory details
- `view_own_inventory` - View assigned inventory only
- `view_department_inventory` - View department inventory
- `view_faculty_inventory` - View faculty inventory
- `view_department_users` - View department users

#### Management

- `manage_users` - Manage user accounts
- `manage_departments` - Manage departments
- `manage_inventories` - Manage inventories
- `manage_department_staff` - Manage department staff

---

## 3. Request Workflows

### 3.1 New User Account Creation Workflow

**Current Implementation**: `src/Pages/Admin/UserManagement.jsx`

**Flow**:

```
User Requests Account
    ↓
System sets status: PENDING_DEPT_HEAD
    ↓
Department Head Reviews (needs approval)
    ↓
Status: APPROVED_BY_DEPT_HEAD
    ↓
Admin Reviews and Activates
    ↓
Status: APPROVED_BY_ADMIN
    ↓
User Account Activated
```

**Status States**:

- `PENDING_DEPT_HEAD` - Awaiting Department Head approval
- `APPROVED_BY_DEPT_HEAD` - Department Head approved, pending Admin
- `PENDING_ADMIN` - Awaiting Admin/Registrar activation
- `APPROVED_BY_ADMIN` - Account activated
- `REJECTED` - Request denied

**Features Implemented**:

- ✅ Create account request form
- ✅ "Pending Approvals" tab in User Management
- ✅ Approve/Reject account requests
- ✅ Auto-activate users when approved
- ✅ Status tracking and history

### 3.2 Inventory Creation Workflow

**Current Implementation**: `src/Pages/Admin/InventoryManagement.jsx`

**Flow**:

```
Staff Member Creates Inventory Request
    ↓
Status: PENDING_STAFF (HOD Review)
    ↓
Head of Department Reviews & Approves
    ↓
Status: APPROVED_BY_HOD
    ↓
Registrar Reviews & Approves
    ↓
Status: APPROVED_BY_REGISTRAR
    ↓
Inventory Created in System
```

**Status States**:

- `PENDING_STAFF` - Awaiting HOD review
- `APPROVED_BY_HOD` - HOD approved, pending Registrar
- `PENDING_REGISTRAR` - Awaiting Registrar approval
- `APPROVED_BY_REGISTRAR` - Approved and created
- `REJECTED` - Request denied

**Features Implemented**:

- ✅ "Creation Requests" tab in Inventory Management
- ✅ Display pending inventory creation requests
- ✅ Approve/Reject requests
- ✅ Status progression tracking
- ✅ Request details (requestor, date, reason)

### 3.3 Item Request Workflow

**Status**: To be implemented in `src/Pages/Inventory/Requests/`

**Planned Flow**:

```
Staff Member Requests Items
    ↓
Routed to Staff's Department HOD
    ↓
HOD Routes to Required Department's HOD
    ↓
Required Department HOD Approves
    ↓
Items Allocated/Transferred
```

**To Be Implemented**:

- Request creation form
- Multi-level approval routing
- Status tracking
- Automatic item allocation

---

## 4. Item Management

### Item Lifecycle with Remarks

When items are transferred or disposed, they:

1. **Remain in original inventory** with a tracking remark
2. **Appear in respective lists** (Transfers, Disposals, Repairs)
3. **Include status marker** with:
   - Action type (transferred, disposed, repaired)
   - Date of action
   - Destination or reason
   - Current status in original location

### Remark Types

- `TRANSFERRED` - "Transferred to [Target Inventory] on [Date]"
- `DISPOSED` - "Disposed on [Date]"
- `REPAIRED` - "In repair since [Date]"

**Implementation Details**:

- Remark field stored with item record
- Items searchable in multiple lists
- Historical tracking maintained
- Status indicators show current location

**Example Data Structure**:

```javascript
{
  id: 1,
  name: "Laptop",
  originalInventory: "IT Equipment",
  currentStatus: "transferred",
  remark: "Transferred to Server Room on 2024-01-26",
  transferredTo: "Server Room",
  lastUpdated: "2024-01-26"
}
```

---

## 5. Department and Faculty Views

### Head of Department (HOD)

**Permissions**:

- View all inventory items in their department
- See item details, locations, quantities
- Initiate transfers within department
- Allocate items to staff requests
- Approve item requests from staff

**Features**:

- Department-scoped inventory view
- Request approval interface
- Staff allocation tools
- Inventory reporting

### Dean

**Permissions**:

- View all inventory across faculty
- See aggregated inventory data
- Approve high-level item requests
- View faculty-wide usage trends

**Features**:

- Faculty-level inventory dashboard
- Cross-department inventory comparison
- Usage analytics
- Request approval interface

### Inventory In-Charge

**Permissions**:

- View only assigned inventories
- Full control over assigned items
- Create transfers/disposals
- Manage item details

---

## 6. Implementation Status

### ✅ Completed

- User role hierarchy structure in constants
- Permission checking utility functions
- UserManagement page with:
  - New role structure display
  - Account approval workflow
  - Pending approvals tab
  - Role change functionality
  - User status toggle
- InventoryManagement page with:
  - Creation request tracking
  - Approval workflow tabs
  - Request approval/rejection
  - Status progression

### 🔄 In Progress

- Integration of permission checks across components
- Department-based visibility filtering

### ⏳ To Be Implemented

1. **Item Remark System**
   - Add remark field to item model
   - Create transfer/disposal remark logic
   - Display remarks in inventory views

2. **Item Request Workflows**
   - Create ItemRequest request component
   - Implement multi-level approval routing
   - Add request history and tracking

3. **Department/Faculty Views**
   - Add department filter to inventory views
   - Implement HOD-specific dashboard
   - Create Dean-level reporting views

4. **Access Control Integration**
   - Apply permission checks to components
   - Hide/show features based on role
   - Implement role-based navigation

5. **Audit Logging**
   - Log all account approvals
   - Track inventory modifications
   - Record request actions

6. **Backend Integration**
   - API endpoints for user management
   - Request approval APIs
   - Item tracking and remarks APIs

---

## 7. Testing Scenarios

### Account Creation Workflow Test

1. Create new user account request
2. Navigate to "Pending Approvals" tab
3. See account in list with "Pending HOD Approval" status
4. Approve account
5. Verify status changes to "Approved"
6. Verify user appears in active users list
7. Verify user status is "active"

### Inventory Creation Workflow Test

1. Create inventory creation request
2. Navigate to "Creation Requests" tab
3. See request with appropriate status
4. Approve request (moving through statuses)
5. Verify status progression
6. Test rejection flow

### Permission Checking Test

1. Check `hasPermission()` for various roles
2. Verify `canManageInventoryItems()` for inventory in-charge
3. Verify `isStaffMember()` returns correct values
4. Test `getInventoryViewingRules()` for HOD/Dean

---

## 8. Constants Reference

### Location

`src/utils/constants.js`

### Key Exports

```javascript
// Role definitions
ROLES = {
  ADMIN: "admin",
  REGISTRAR: "registrar",
  STAFF: "staff",
  INVENTORY_INCHARGE: "inventory_incharge",
  HEAD_OF_DEPARTMENT: "head_of_department",
  DEAN: "dean",
};

// Detailed role configuration
ROLE_HIERARCHY = {
  [role]: {
    label: string,
    description: string,
    superclass: string | null,
    permissions: [string],
  },
};

// Request status definitions
ACCOUNT_REQUEST_STATUS = {
  PENDING_DEPT_HEAD: "pending_dept_head",
  APPROVED_BY_DEPT_HEAD: "approved_by_dept_head",
  PENDING_ADMIN: "pending_admin",
  APPROVED_BY_ADMIN: "approved_by_admin",
  REJECTED: "rejected",
};

INVENTORY_REQUEST_STATUS = {
  PENDING_STAFF: "pending_staff",
  APPROVED_BY_HOD: "approved_by_hod",
  PENDING_REGISTRAR: "pending_registrar",
  APPROVED_BY_REGISTRAR: "approved_by_registrar",
  REJECTED: "rejected",
};

// Item action types
ITEM_REMARK_TYPE = {
  TRANSFERRED: "transferred",
  DISPOSED: "disposed",
  REPAIRED: "repaired",
};
```

---

## 9. File References

### Core Files

- User Management: `src/Pages/Admin/UserManagement.jsx`
- Inventory Management: `src/Pages/Admin/InventoryManagement.jsx`
- Department Management: `src/Pages/Admin/DepartmentManagement.jsx`
- Reports: `src/Pages/Admin/Reports.jsx`

### Utilities

- Permissions: `src/utils/permissionUtils.js`
- Constants: `src/utils/constants.js`

### Documentation

- Role Structure: `ROLES_AND_PERMISSIONS.md`
- Implementation Details: `BUSINESS_LOGIC_IMPLEMENTATION.md`
