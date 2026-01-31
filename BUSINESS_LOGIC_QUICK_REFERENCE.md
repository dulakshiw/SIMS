# SIMS Business Logic Quick Reference

## User Roles at a Glance

| Role                | Superclass | Can Add Items | Can Approve   | Can View Department | Can View Faculty |
| ------------------- | ---------- | ------------- | ------------- | ------------------- | ---------------- |
| Admin               | -          | N/A           | All           | All                 | All              |
| Registrar           | -          | N/A           | Inventory     | All                 | All              |
| Staff               | Staff      | ❌            | ❌            | Own Dept            | -                |
| Inventory In-Charge | Staff      | ✅            | ❌            | Assigned            | -                |
| HOD                 | Staff      | ❌            | ✅ Items      | ✅                  | -                |
| Dean                | Staff      | ❌            | ✅ High-level | -                   | ✅               |

---

## Permission Quick Check

### Who Can Do What?

**Add/Update/Delete Inventory Items**

- ✅ Inventory In-Charge (assigned inventory only)
- ✅ Admin
- ❌ Everyone else

**Approve Inventory Requests**

- ✅ HOD (department items)
- ✅ Registrar (final approval)
- ❌ Everyone else

**Approve Item Requests**

- ✅ HOD (department items)
- ✅ Dean (faculty-wide)
- ❌ Everyone else

**Request Items**

- ✅ All Staff Members (Staff, In-Charge, HOD, Dean)
- ❌ Admin, Registrar

**Approve Account Creation**

- ✅ HOD (department level)
- ✅ Admin (system level)
- ❌ Everyone else

---

## Request Approval Statuses

### Account Creation

```
PENDING_DEPT_HEAD → APPROVED_BY_DEPT_HEAD → PENDING_ADMIN → APPROVED_BY_ADMIN
                                                                    ↓
                                                            User Activated
```

### Inventory Creation

```
PENDING_STAFF → APPROVED_BY_HOD → PENDING_REGISTRAR → APPROVED_BY_REGISTRAR
                                                              ↓
                                                    Inventory Created
```

---

## Implementation Checklist

### ✅ Completed

- [x] Role hierarchy structure
- [x] Permission utility functions
- [x] User management with account approval workflow
- [x] Inventory management with creation request tracking
- [x] Department management with user/inventory assignment
- [x] Reports with multiple data views

### ⏳ To Do

- [ ] Item remark system for transfers/disposals
- [ ] Item request workflow implementation
- [ ] Department-based inventory view filtering
- [ ] HOD-specific inventory dashboard
- [ ] Dean-level reporting views
- [ ] Permission enforcement in UI components
- [ ] Backend API integration
- [ ] Audit logging system

---

## Code Examples

### Check Permission

```javascript
import { hasPermission } from "../utils/permissionUtils";

const canAddItems = hasPermission(userRole, "add_items");
if (!canAddItems) {
  // Hide add button or show permission denied
}
```

### Check Multiple Permissions

```javascript
import { canManageInventoryItems } from "../utils/permissionUtils";

if (canManageInventoryItems(userRole)) {
  // Show inventory management controls
}
```

### Get Role Information

```javascript
import { getRoleInfo, ROLE_HIERARCHY } from "../utils/constants";

const roleInfo = getRoleInfo(userRole);
console.log(roleInfo.label); // e.g., "Inventory In-Charge"
console.log(roleInfo.description); // e.g., "Manages inventory items..."
```

### Check if Staff Member

```javascript
import { isStaffMember } from "../utils/permissionUtils";

const isStaff = isStaffMember(userRole); // true for all except admin/registrar
```

---

## Constants Import

```javascript
import {
  ROLES,
  ROLE_HIERARCHY,
  ACCOUNT_REQUEST_STATUS,
  INVENTORY_REQUEST_STATUS,
  ITEM_REMARK_TYPE,
} from "../utils/constants";
```

### Using ROLES

```javascript
const isAdmin = userRole === ROLES.ADMIN;
const isIncharge = userRole === ROLES.INVENTORY_INCHARGE;
const isHOD = userRole === ROLES.HEAD_OF_DEPARTMENT;
```

### Using Status Enums

```javascript
if (request.approvalStatus === ACCOUNT_REQUEST_STATUS.PENDING_DEPT_HEAD) {
  // Waiting for HOD approval
}

if (
  inventory.approvalStatus === INVENTORY_REQUEST_STATUS.APPROVED_BY_REGISTRAR
) {
  // Can create the inventory
}
```

---

## Component Integration Examples

### In UserManagement Component

```javascript
import { ROLE_HIERARCHY, ACCOUNT_REQUEST_STATUS } from "../../utils/constants";

// Display role label
<Badge label={ROLE_HIERARCHY[user.role]?.label} />;

// Show status badge
const statusConfig = {
  [ACCOUNT_REQUEST_STATUS.PENDING_DEPT_HEAD]: {
    label: "Pending HOD",
    variant: "warning",
  },
  [ACCOUNT_REQUEST_STATUS.APPROVED_BY_DEPT_HEAD]: {
    label: "Pending Admin",
    variant: "info",
  },
  // ... more statuses
};
```

### In InventoryManagement Component

```javascript
import { INVENTORY_REQUEST_STATUS } from "../../utils/constants";

// Approval logic
const handleApproveRequest = (request) => {
  setRequests((prev) =>
    prev.map((r) =>
      r.id === request.id
        ? { ...r, approvalStatus: INVENTORY_REQUEST_STATUS.APPROVED_BY_HOD }
        : r,
    ),
  );
};
```

---

## Testing Commands

### Check Permission Utils

```javascript
import { hasPermission, isStaffMember } from "./utils/permissionUtils";

// Test
console.log(hasPermission("inventory_incharge", "add_items")); // true
console.log(hasPermission("staff", "add_items")); // false
console.log(isStaffMember("inventory_incharge")); // true
console.log(isStaffMember("admin")); // false
```

---

## Common Patterns

### Display Role-Based Content

```jsx
{
  canManageInventoryItems(userRole) && (
    <Button onClick={addItem}>Add New Item</Button>
  );
}
```

### Conditional Actions in Table

```jsx
const actions = [
  canApproveInventory(userRole) && {
    label: "Approve",
    onClick: handleApprove,
  },
  canManageInventoryItems(userRole) && {
    label: "Edit",
    onClick: handleEdit,
  },
].filter(Boolean);
```

### Role-Based Form Fields

```jsx
{
  userRole === ROLES.HEAD_OF_DEPARTMENT && (
    <FormInput label="Department" value={department} disabled />
  );
}
```

---

## Next Steps

1. **Implement Item Remarks**
   - Add `remark` field to item model
   - Create `ItemRemark` component
   - Update inventory list to show remarks

2. **Add Item Request Workflow**
   - Create request creation form
   - Implement approval routing
   - Add request tracking

3. **Enforce Permissions in UI**
   - Apply permission checks to all action buttons
   - Hide unauthorized features
   - Show permission denied messages

4. **Backend Integration**
   - Create API endpoints
   - Implement authentication/authorization
   - Add database models for requests/approvals

5. **Testing**
   - Create permission test suite
   - Test all workflows
   - Validate data consistency
