# SIMS Routing Configuration

## Complete Route Map

### Authentication Routes (No Layout)

- `GET /` → Login Page
- `GET /signup` → Sign Up Page
- `GET /forgotPassword` → Forgot Password Page

### Admin Routes (AdminLayout)

- `GET /admin/dashboard` → Admin Dashboard
  - KPI cards, system overview, recent activities
- `GET /admin/users` → User Management
  - User list, create user modal, edit/delete actions
- `GET /admin/reports` → Reports & Analytics
  - System-wide analytics, charts, export options

### Inventory Routes (MainLayout)

#### Dashboard

- `GET /inventory/dashboard` → Inventory Dashboard
  - Overview, quick actions, stats, recent activities

#### Items Management

- `GET /inventory/list` → Inventory List View
  - Search, filter, sortable table with item actions
- `GET /inventory/add` → Add New Item
  - Item form (existing component)

#### Transfers

- `GET /inventory/transfers/list` → Transfer List
  - All transfers with status tracking
- `GET /inventory/transfers/:transferId` → Transfer Details
  - Transfer information, approval status, tracking

#### Disposals (New Feature)

- `GET /inventory/disposals/list` → Disposal List
  - All disposal requests with filters
- `GET /inventory/disposals/new` → Create Disposal
  - Form to submit new disposal with attachments
- `GET /inventory/disposals/:disposalId` → Disposal Details
  - Disposal info, approvals, timeline
- `GET /inventory/disposals/reports` → Disposal Reports
  - Analytics on disposals, charts, trends

#### Item Requests

- `GET /inventory/requests/list` → Request List
  - All item requests with status
- `GET /inventory/requests/new` → Create Request
  - Form to submit new item request

### Requests & Approvals Routes (MainLayout)

- `GET /requests/approval` → Request Approval Workflow
  - Request list sidebar, detail panel, approval workflow

### Staff Routes (Staff uses existing structure)

- `GET /staff/dashboard` → Staff Dashboard
  - Staff-specific view (existing component)

### Incharge Routes (Incharge uses existing structure)

- `GET /incharge/dashboard` → Incharge Dashboard
  - Inventory in-charge specific view (existing component)

---

## Layout Assignments

### MainLayout

Used for: Inventory, Requests

- Header with username greeting
- Collapsible Sidebar with navigation
- Main content area
- Footer
- Max width container

### AdminLayout

Used for: Admin pages

- Header with username greeting
- Collapsible Sidebar with admin nav items
- Main content area
- Footer
- Max width container

### AuthLayout

Available for: Login, SignUp, ForgotPassword (currently not wrapped)

- Centered card layout
- Background gradient
- No sidebar/header
- Branding section

---

## Navigation Configuration

### Inventory Navigation Items (INVENTORY_NAV_ITEMS)

1. Dashboard → `/inventory/dashboard`
2. Items → `/inventory/list`
3. Add Item → `/inventory/add`
4. Transfers → `/inventory/transfers`
5. Disposals → `/inventory/disposals`
6. Requests → `/inventory/requests`

### Admin Navigation Items (ADMIN_NAV_ITEMS)

1. Dashboard → `/admin/dashboard`
2. Users → `/admin/users`
3. Reports → `/admin/reports`

---

## Key Features by Page

### Inventory Dashboard

✓ Stats cards
✓ Quick action buttons
✓ Recent activities
✓ Pending tasks
✓ System status

### Inventory List

✓ Search functionality
✓ Sortable columns
✓ Pagination
✓ Filter options
✓ Row actions (edit, delete)

### Disposal Management

✓ List with status filtering
✓ Create disposal form with:

- Item selection
- Reason dropdown
- Condition assessment
- File attachments
  ✓ Disposal details with:
- Timeline
- Approval workflow
- Document viewer
  ✓ Reports with analytics

### Transfer Management

✓ Transfer list with tracking
✓ Transfer details with:

- Location info
- Approval status
- Gate pass download
- Timeline tracking

### User Management

✓ User list with search
✓ Create user modal
✓ Role assignment (Admin, Incharge, Staff)
✓ Department assignment
✓ Status tracking

### Request Management

✓ Request list with priority
✓ Create request form with:

- Item specs
- Quantity
- Budget
- Justification
  ✓ Request approval workflow

---

## Nested Route Structure

All routes are organized by feature:

```
/admin
  /dashboard
  /users
  /reports

/inventory
  /dashboard
  /list
  /add
  /transfers
    /list
    /:transferId
  /disposals
    /list
    /new
    /:disposalId
    /reports
  /requests
    /list
    /new

/requests
  /approval

/staff
  /dashboard

/incharge
  /dashboard
```

---

## URL Patterns Summary

| Feature   | Create                     | List                        | Details                    | Reports                        |
| --------- | -------------------------- | --------------------------- | -------------------------- | ------------------------------ |
| Inventory | `/inventory/add`           | `/inventory/list`           | N/A                        | N/A                            |
| Transfers | Inline                     | `/inventory/transfers/list` | `/inventory/transfers/:id` | N/A                            |
| Disposals | `/inventory/disposals/new` | `/inventory/disposals/list` | `/inventory/disposals/:id` | `/inventory/disposals/reports` |
| Requests  | `/inventory/requests/new`  | `/inventory/requests/list`  | N/A                        | N/A                            |
| Users     | Modal                      | `/admin/users`              | N/A                        | N/A                            |
| Approvals | N/A                        | N/A                         | `/requests/approval`       | N/A                            |

---

## Component Usage

### Header Component

- Shows "Hello, {username}"
- Used in: All layouts
- Location: `/src/Components/Header.jsx`

### Sidebar Component

- Shows navigation based on variant (admin/inventory)
- Collapsible on click
- Uses React Router Link for navigation
- Highlights active route

### UI Components Used

- Button - All pages with actions
- Card - Layout containers
- Badge - Status indicators
- Table - List views (Inventory, Users, Disposals, etc.)
- FormInput - All forms
- Select - Dropdown selections
- Modal - Create user modal
- Tabs - Disposal & Request details
- SearchBox - Search functionality

---

## Notes

- All routes use nested configuration for better organization
- Sidebar automatically highlights active routes
- MainLayout includes proper spacing with ml-64 for sidebar offset
- All new pages follow the established theme and component patterns
- Disposals feature fully integrated with 4 sub-routes
- Admin layout mirrors inventory layout for consistency
