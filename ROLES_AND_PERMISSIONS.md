# SIMS User Roles and Permissions System

## User Role Hierarchy

The system implements a comprehensive role-based access control (RBAC) system with the following roles:

### System-Level Roles

1. **Admin (System Administrator)**
   - Full system access and control
   - Manages all users and permissions
   - Approves final account activations
   - Overrides all system rules
   - Not a staff member superclass

2. **Registrar**
   - Approves inventory creation requests
   - Activates user accounts after HOD approval
   - Views all system data
   - Manages departments
   - Not a staff member superclass

### Staff Member Superclass

All staff members (except Admin and Registrar) fall under the "Staff Member" superclass. Individual roles within this superclass include:

#### 1. **Staff Member**

- **Permissions:**
  - Request items from inventory
  - View inventory availability
- **Restrictions:**
  - Cannot add/modify/delete inventory items
  - Cannot approve requests
- **Use Case:** Regular employees who request items as needed

#### 2. **Inventory In-Charge**

- **Permissions:**
  - Add new inventory items
  - Update item details
  - Delete items
  - Manage transfers (move items between inventories)
  - Manage disposals (remove items from system)
  - Manage repairs
  - View assigned inventory
  - Request items
- **Restrictions:**
  - Can only manage inventories assigned to them
  - Cannot approve inventory creation
- **Use Case:** Personnel responsible for inventory management and tracking

#### 3. **Head of Department (HOD)**

- **Permissions:**
  - Approve inventory creation requests from staff
  - Approve item requests within department
  - View all inventory in their department
  - View all department users
  - Manage department staff
  - Request items
- **Restrictions:**
  - Cannot add/modify items directly
  - Cannot approve requests from other departments
- **Use Case:** Department leaders overseeing departmental inventory

#### 4. **Dean**

- **Permissions:**
  - View all inventory of their faculty
  - View all faculty users
  - Approve item requests
  - Request items
- **Restrictions:**
  - Cannot add/modify items
  - Cannot manage transfers/disposals
- **Use Case:** Faculty-level oversight

---

## Request and Approval Workflows

### 1. New User Account Creation Workflow

```
User Creates Account Request
        ↓
Department Head Reviews & Approves
        ↓
Admin Reviews & Activates Account
        ↓
User Can Access System
```

**Status States:**

- `PENDING_DEPT_HEAD` - Waiting for Department Head approval
- `APPROVED_BY_DEPT_HEAD` - Approved by HOD, pending Admin
- `PENDING_ADMIN` - Waiting for Admin/Registrar activation
- `APPROVED_BY_ADMIN` - Approved and account activated
- `REJECTED` - Request denied

**Current Implementation:**

- New account requests go to Department Head first
- Once approved, request goes to Admin
- Admin activates the account (status changes to "active")

### 2. Inventory Creation Workflow

```
Staff Member Creates Inventory Request
        ↓
Head of Department Reviews & Approves
        ↓
Registrar Reviews & Approves
        ↓
Inventory Created in System
```

**Status States:**

- `PENDING_STAFF` - Initial request
- `APPROVED_BY_HOD` - HOD approved
- `PENDING_REGISTRAR` - Waiting for Registrar approval
- `APPROVED_BY_REGISTRAR` - Registrar approved, inventory created
- `REJECTED` - Request denied

### 3. Item Request Workflow

```
Staff Member Requests Items
        ↓
Department Head Routes to Requested Department
        ↓
Requested Department HOD Approves
        ↓
Items Allocated/Transferred
```

---

## Item Tracking and Remarks

When items are transferred or disposed:

1. **Items remain in original inventory** with a remark
2. **Remark types:**
   - `TRANSFERRED` - Item transferred to [Target Inventory]
   - `DISPOSED` - Item disposed on [Date]
   - `REPAIRED` - Item sent for repair on [Date]

3. **Items also appear in respective lists:**
   - Transferred items also in Transfers List
   - Disposed items also in Disposals List
   - Repaired items also in Repairs List

4. **Tracking includes:**
   - Original transfer/disposal date
   - Destination/reason
   - Current status marker

---

## Department and Faculty Visibility

### Head of Department (HOD) View

- Can view **all inventory items** in their department
- Can see item details (name, quantity, status, location)
- Can initiate transfers within department
- Can allocate items to staff requests

### Dean View

- Can view **all inventory items** in their faculty
- Can see aggregated inventory across departments
- Can view inventory usage trends
- Can approve high-level item requests

### Inventory In-Charge View

- Can only view **assigned inventory(ies)**
- Can manage items in assigned inventories
- Can create transfer/disposal requests

---

## Permission Utility Functions

The system includes `permissionUtils.js` with helper functions:

```javascript
// Check if user has permission
hasPermission(userRole, permissionName);

// Check if user can manage inventory items
canManageInventoryItems(userRole);

// Check if user can approve inventory
canApproveInventory(userRole);

// Check if user can manage transfers/disposals
canManageTransfersAndDisposals(userRole);

// Check if user is a staff member
isStaffMember(userRole);

// Check if user can request items
canRequestItems(userRole);

// Get role information
getRoleInfo(role);

// Get available roles for assignment
getAssignableRoles(assignedByRole);

// Check account approval permissions
canApproveAccountCreation(userRole, context);

// Get next approval authority
getNextAccountApprovalAuthority(currentStatus);

// Get inventory viewing rules
getInventoryViewingRules(userRole, userDepartment);
```

---

## Implementation Notes

### Current Status

- User Management page updated with new role structure
- Account approval workflow implemented
- Role-based permission checks available
- Mock data set up for testing

### To Be Implemented

1. Integrate permission checks in Inventory Management
2. Implement department-based visibility filters
3. Add item remark system for transfers/disposals
4. Implement request approval workflows in respective components
5. Add logging for account creation/approval actions
6. Integrate with backend API for user management

---

## Testing Scenarios

### Test User Accounts (Mock Data)

1. **Alice Johnson** - Admin (Full access)
2. **Bob Smith** - Inventory In-Charge (Can manage inventory)
3. **Carol White** - HOD (Can approve requests)
4. **David Brown** - Staff (Can only request items)
5. **Emma Davis** - Dean (Faculty oversight)

### Test Workflows

1. Create a new user account and follow approval chain
2. Test role change functionality
3. Test toggle user status (active/inactive)
4. Review pending account requests and approvals
