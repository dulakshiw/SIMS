# SIMS API Endpoints Reference

## Overview

This document outlines the recommended API endpoint structure for the SIMS backend implementation.

---

## Authentication Endpoints

### POST /api/auth/login

**Purpose**: User login

```json
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "role": "staff",
    "department_id": 1,
    "status": "active"
  }
}
```

### POST /api/auth/logout

**Purpose**: User logout

### POST /api/auth/refresh-token

**Purpose**: Refresh JWT token

---

## User Management Endpoints

### GET /api/users

**Purpose**: Get all users with filtering
**Query Parameters**:

- `role` - Filter by role
- `department_id` - Filter by department
- `status` - Filter by status (active, inactive, pending_approval)
- `search` - Search by name or email
- `page` - Pagination
- `limit` - Results per page

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "role": "admin",
      "department_id": 1,
      "status": "active",
      "created_date": "2024-01-15T00:00:00Z",
      "last_login": "2024-01-26T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  }
}
```

### GET /api/users/:id

**Purpose**: Get specific user details

### POST /api/users

**Purpose**: Create new user (direct creation by admin only)

```json
Request:
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secure_password",
  "role": "staff",
  "department_id": 1
}
```

### PUT /api/users/:id

**Purpose**: Update user details

```json
Request:
{
  "name": "John Doe Updated",
  "role": "inventory_incharge",
  "department_id": 2
}
```

### PATCH /api/users/:id/status

**Purpose**: Toggle user status (active/inactive)

```json
Request:
{
  "status": "inactive"
}
```

### DELETE /api/users/:id

**Purpose**: Delete user (soft delete)

---

## Account Request Endpoints

### GET /api/account-requests

**Purpose**: Get all account requests with filtering
**Query Parameters**:

- `approval_status` - Filter by status
- `department_id` - Filter by department
- `search` - Search by name or email

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Frank Wilson",
      "email": "frank@example.com",
      "requested_role": "staff",
      "department_id": 1,
      "approval_status": "pending_dept_head",
      "requested_date": "2024-01-25T00:00:00Z",
      "dept_head_approved_by": null,
      "dept_head_approved_date": null
    }
  ]
}
```

### GET /api/account-requests/:id

**Purpose**: Get specific account request

### POST /api/account-requests

**Purpose**: Create new account request

```json
Request:
{
  "name": "Frank Wilson",
  "email": "frank@example.com",
  "requested_role": "staff",
  "department_id": 1
}
```

### POST /api/account-requests/:id/approve-dept-head

**Purpose**: Approve at department head level

```json
Request:
{
  "approved_by_id": 2
}

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "approval_status": "approved_by_dept_head",
    "dept_head_approved_date": "2024-01-26T00:00:00Z"
  }
}
```

### POST /api/account-requests/:id/approve-admin

**Purpose**: Approve at admin level and activate user

```json
Request:
{
  "approved_by_id": 1
}

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "approval_status": "approved_by_admin",
    "user_id": 6,
    "user": {
      "id": 6,
      "name": "Frank Wilson",
      "status": "active"
    }
  }
}
```

### POST /api/account-requests/:id/reject

**Purpose**: Reject account request

```json
Request:
{
  "rejection_reason": "Does not meet requirements"
}
```

---

## Department Endpoints

### GET /api/departments

**Purpose**: Get all departments
**Query Parameters**:

- `search` - Search by name or code
- `status` - Filter by status

### GET /api/departments/:id

**Purpose**: Get specific department

### POST /api/departments

**Purpose**: Create new department

```json
Request:
{
  "name": "Information Technology",
  "code": "IT",
  "head_id": 1,
  "faculty_id": 1,
  "description": "IT Department"
}
```

### PUT /api/departments/:id

**Purpose**: Update department

### PATCH /api/departments/:id/assign-users

**Purpose**: Assign users to department

```json
Request:
{
  "user_ids": [1, 2, 3]
}
```

### PATCH /api/departments/:id/assign-inventories

**Purpose**: Assign inventories to department

```json
Request:
{
  "inventory_ids": [1, 2]
}
```

---

## Inventory Endpoints

### GET /api/inventories

**Purpose**: Get all inventories
**Query Parameters**:

- `department_id` - Filter by department
- `status` - Filter by status
- `search` - Search by name

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Server Room",
      "department_id": 1,
      "incharge_id": 2,
      "status": "active",
      "item_count": 45,
      "created_date": "2024-01-10T00:00:00Z",
      "updated_date": "2024-01-25T00:00:00Z"
    }
  ]
}
```

### GET /api/inventories/:id

**Purpose**: Get specific inventory with items

### POST /api/inventories

**Purpose**: Create inventory (admin only, or creates request)

```json
Request:
{
  "name": "New Inventory",
  "department_id": 1,
  "incharge_id": 2,
  "description": "Description"
}
```

### PUT /api/inventories/:id

**Purpose**: Update inventory

### PATCH /api/inventories/:id/status

**Purpose**: Toggle inventory status

### DELETE /api/inventories/:id

**Purpose**: Delete inventory (soft delete)

---

## Inventory Creation Request Endpoints

### GET /api/inventory-requests

**Purpose**: Get all inventory creation requests
**Query Parameters**:

- `approval_status` - Filter by status
- `department_id` - Filter by department

### GET /api/inventory-requests/:id

**Purpose**: Get specific request

### POST /api/inventory-requests

**Purpose**: Create inventory request

```json
Request:
{
  "name": "Laboratory Equipment",
  "department_id": 3,
  "reason": "New lab setup"
}
```

### POST /api/inventory-requests/:id/approve-hod

**Purpose**: Approve at HOD level

```json
Request:
{
  "approved_by_id": 3
}
```

### POST /api/inventory-requests/:id/approve-registrar

**Purpose**: Approve at registrar level and create inventory

```json
Request:
{
  "approved_by_id": 10,
  "incharge_id": 2
}
```

### POST /api/inventory-requests/:id/reject

**Purpose**: Reject request

---

## Inventory Items Endpoints

### GET /api/inventories/:id/items

**Purpose**: Get items in specific inventory
**Query Parameters**:

- `status` - Filter by status
- `search` - Search by name

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Laptop",
      "quantity": 5,
      "status": "available",
      "condition": "good",
      "location": "Shelf A",
      "remark_type": null,
      "remark_details": null,
      "created_date": "2024-01-10T00:00:00Z"
    }
  ]
}
```

### GET /api/items/:id

**Purpose**: Get specific item with history

### POST /api/items

**Purpose**: Add new item (requires inventory in-charge role)

```json
Request:
{
  "inventory_id": 1,
  "name": "Desktop Computer",
  "quantity": 3,
  "unit": "pieces",
  "condition": "good",
  "location": "Room 101"
}
```

### PUT /api/items/:id

**Purpose**: Update item details

### DELETE /api/items/:id

**Purpose**: Delete item (soft delete)

---

## Item Transfer Endpoints

### POST /api/transfers

**Purpose**: Create item transfer request

```json
Request:
{
  "item_id": 1,
  "from_inventory_id": 1,
  "to_inventory_id": 2,
  "quantity": 2,
  "reason": "Department request"
}

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "status": "pending",
    "item": { "name": "Laptop" },
    "from_inventory": { "name": "Server Room" },
    "to_inventory": { "name": "IT Equipment" }
  }
}
```

### GET /api/transfers

**Purpose**: Get transfer history
**Query Parameters**:

- `status` - pending, in-transit, completed
- `inventory_id` - Filter by inventory

### GET /api/transfers/:id

**Purpose**: Get transfer details

### PATCH /api/transfers/:id/status

**Purpose**: Update transfer status

```json
Request:
{
  "status": "completed"
}
```

---

## Item Disposal Endpoints

### POST /api/disposals

**Purpose**: Create disposal request

```json
Request:
{
  "item_id": 1,
  "inventory_id": 1,
  "quantity": 1,
  "reason": "damage",
  "condition": "poor",
  "description": "Screen damaged"
}
```

### GET /api/disposals

**Purpose**: Get disposal history
**Query Parameters**:

- `status` - pending, approved, completed
- `reason` - Filter by reason

### PATCH /api/disposals/:id/approve

**Purpose**: Approve disposal

### PATCH /api/disposals/:id/reject

**Purpose**: Reject disposal

---

## Item Request Endpoints

### POST /api/item-requests

**Purpose**: Request items

```json
Request:
{
  "item_name": "Laptop",
  "quantity": 2,
  "reason": "Office use",
  "requested_from_inventory_id": 1,
  "required_by_date": "2024-02-15"
}
```

### GET /api/item-requests

**Purpose**: Get item requests with filtering
**Query Parameters**:

- `approval_status` - Filter by status
- `requested_by_id` - Filter by requester

### PATCH /api/item-requests/:id/approve-dept-head

**Purpose**: Approve at department head level

### PATCH /api/item-requests/:id/approve-requested-dept

**Purpose**: Approve at requested department level

### PATCH /api/item-requests/:id/reject

**Purpose**: Reject request

---

## Reports Endpoints

### GET /api/reports/users

**Purpose**: Get user details report
**Query Parameters**:

- `department_id` - Filter by department
- `role` - Filter by role
- `format` - json, csv, pdf

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "role": "admin",
      "department": "IT",
      "status": "active",
      "join_date": "2024-01-15",
      "last_active": "2024-01-26T10:30:00Z"
    }
  ]
}
```

### GET /api/reports/user-logins

**Purpose**: Get user login report
**Query Parameters**:

- `start_date` - Filter from date
- `end_date` - Filter to date
- `user_id` - Filter by user

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Alice Johnson",
      "login_count": 142,
      "last_login": "2024-01-26T10:30:00Z",
      "total_login_hours": "256 hours",
      "login_dates": ["2024-01-26", "2024-01-25", ...]
    }
  ]
}
```

### GET /api/reports/inventories

**Purpose**: Get inventory details report
**Query Parameters**:

- `department_id` - Filter by department
- `status` - Filter by status

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Server Room",
      "department": "IT",
      "incharge": "Bob Smith",
      "item_count": 45,
      "created_date": "2024-01-10",
      "last_updated": "2024-01-26T10:30:00Z",
      "status": "active"
    }
  ]
}
```

---

## Faculty Endpoints

### GET /api/faculties

**Purpose**: Get all faculties

### GET /api/faculties/:id

**Purpose**: Get faculty with departments

### POST /api/faculties

**Purpose**: Create faculty

### PUT /api/faculties/:id

**Purpose**: Update faculty

---

## Permission & Role Endpoints

### GET /api/roles

**Purpose**: Get all available roles

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": "admin",
      "label": "System Administrator",
      "description": "Full system access",
      "superclass": null,
      "permissions": ["manage_users", "manage_inventories", ...]
    },
    {
      "id": "staff",
      "label": "Staff Member",
      "description": "Regular staff member",
      "superclass": "staff",
      "permissions": ["request_items", ...]
    }
  ]
}
```

### GET /api/roles/:roleId/permissions

**Purpose**: Get permissions for specific role

### GET /api/me/permissions

**Purpose**: Get current user's permissions

```json
Response:
{
  "success": true,
  "data": {
    "role": "inventory_incharge",
    "permissions": ["add_items", "update_items", "delete_items", ...],
    "canManageItems": true,
    "canApprove": false,
    "canTransfer": true
  }
}
```

---

## Audit Log Endpoints

### GET /api/audit-logs

**Purpose**: Get audit log entries
**Query Parameters**:

- `entity_type` - Filter by entity type (users, inventory, transfers, etc.)
- `action` - Filter by action (create, update, delete, approve)
- `user_id` - Filter by user
- `date_from` - From date
- `date_to` - To date

```json
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user": "Alice Johnson",
      "action": "approve",
      "entity_type": "account_request",
      "entity_id": 1,
      "old_values": {},
      "new_values": { "approval_status": "approved_by_admin" },
      "timestamp": "2024-01-26T10:30:00Z"
    }
  ]
}
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

---

## Common Error Codes

| Code                | HTTP | Description             |
| ------------------- | ---- | ----------------------- |
| INVALID_CREDENTIALS | 401  | Login failed            |
| UNAUTHORIZED        | 403  | Permission denied       |
| NOT_FOUND           | 404  | Resource not found      |
| VALIDATION_ERROR    | 400  | Input validation failed |
| CONFLICT            | 409  | Resource already exists |
| SERVER_ERROR        | 500  | Internal server error   |

---

## Rate Limiting

All endpoints support rate limiting:

- **Default**: 100 requests per minute per user
- **Authenticated**: 300 requests per minute
- **Admin**: 1000 requests per minute

Headers returned:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1643212800
```

---

## Pagination

List endpoints support pagination:

Query Parameters:

- `page` - Page number (default: 1)
- `limit` - Results per page (default: 10, max: 100)
- `sort` - Sort field (default: -created_date)

Response format:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 250,
    "pages": 25
  }
}
```

---

## Implementation Notes

1. **Authentication**: All endpoints except `/api/auth/*` require JWT token in Authorization header
2. **Validation**: Server-side validation required for all inputs
3. **Soft Deletes**: Use `deleted_at` field instead of hard deletes
4. **Timestamps**: Return ISO 8601 format timestamps
5. **Error Handling**: Consistent error response format
6. **CORS**: Enable for frontend domain
7. **Logging**: Log all state-changing operations
