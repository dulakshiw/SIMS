# SIMS Routing & Navigation Setup - Complete Guide

## Overview

The SIMS (Smart Inventory Management System) routing has been fully configured with comprehensive route structure, layout system, and navigation components.

## 🎯 Routing Highlights

### Total Routes: 25+

- **Authentication**: 3 routes
- **Admin**: 3 routes
- **Inventory**: 11 routes
- **Disposals**: 4 routes
- **Transfers**: 2 routes
- **Requests**: 2 routes
- **Approvals**: 1 route
- **Other**: 2 routes (Staff, Incharge dashboards)

---

## 📋 Complete Route Tree

```
/                          → Login (No Layout)
/signup                    → Sign Up (No Layout)
/forgotPassword            → Forgot Password (No Layout)

/admin                     → Admin Module (AdminLayout)
  /dashboard               → Dashboard
  /users                   → User Management
  /reports                 → Reports & Analytics

/inventory                 → Inventory Module (MainLayout)
  /dashboard               → Dashboard
  /list                    → List View
  /add                     → Add New Item
  /transfers               → Transfer Module
    /list                  → Transfer List
    /:transferId           → Transfer Details
  /disposals               → Disposal Module
    /list                  → Disposal List
    /new                   → Create Disposal
    /:disposalId           → Disposal Details
    /reports               → Disposal Reports
  /requests                → Request Module
    /list                  → Request List
    /new                   → Create Request

/requests                  → Requests Module (MainLayout)
  /approval                → Request Approval Workflow

/staff                     → Staff Module (No Layout)
  /dashboard               → Staff Dashboard

/incharge                  → Incharge Module (No Layout)
  /dashboard               → Incharge Dashboard
```

---

## 🎨 Layout System

### Three Layout Types

#### 1. **MainLayout** (Inventory & Requests modules)

```jsx
<MainLayout variant="inventory">{children}</MainLayout>
```

**Features:**

- Header with "Hello, {username}" greeting
- Collapsible Sidebar with inventory navigation
- Main content area with max-width container
- Footer
- Smooth transitions on sidebar collapse
- Responsive design (lg breakpoint)

**Used by:**

- `/inventory/*`
- `/requests/*`

---

#### 2. **AdminLayout** (Admin module)

```jsx
<AdminLayout>{children}</AdminLayout>
```

**Features:**

- Header with "Hello, {username}" greeting
- Collapsible Sidebar with admin navigation
- Main content area with max-width container
- Footer
- Smooth transitions on sidebar collapse
- Same styling as MainLayout for consistency

**Used by:**

- `/admin/*`

---

#### 3. **AuthLayout** (Optional for login pages)

```jsx
<AuthLayout>{children}</AuthLayout>
```

**Features:**

- Centered card layout
- Gradient background
- No sidebar/header
- Branding section
- Perfect for auth forms

**Currently used by:** None (Login pages use existing structure)

---

## 🧭 Navigation Components

### Sidebar Component

**Location:** `src/Components/Layouts/Sidebar.jsx`

**Props:**

- `variant` - "admin" or "inventory"
- `onCollapseChange` - Callback for collapse state

**Features:**

- Collapsible toggle (w-64 → w-20)
- Active route highlighting
- Icon + label display
- Smooth transitions
- Logout button at bottom
- Fixed positioning

**Navigation Items:**

**Inventory Navigation:**

1. Dashboard → `/inventory/dashboard`
2. Items → `/inventory/list`
3. Add Item → `/inventory/add`
4. Transfers → `/inventory/transfers`
5. Disposals → `/inventory/disposals`
6. Requests → `/inventory/requests`

**Admin Navigation:**

1. Dashboard → `/admin/dashboard`
2. Users → `/admin/users`
3. Reports → `/admin/reports`

---

## 📊 Page Components

### Inventory Module Pages

#### Dashboard (`/inventory/dashboard`)

**Components Used:**

- Card, Button
  **Features:**
- KPI statistics
- Quick action buttons
- Recent activities
- Pending tasks
- System status

#### List View (`/inventory/list`)

**Components Used:**

- SearchBox, Table, Badge, Card
  **Features:**
- Searchable table
- Sortable columns
- Pagination
- Status filtering
- Row actions

#### Add Item (`/inventory/add`)

**Status:** Existing component, integrated into routes

---

### Disposal Module Pages (NEW)

#### Disposal List (`/inventory/disposals/list`)

**Components Used:**

- Table, Badge, Card, SearchBox, Button
  **Features:**
- List all disposals
- Filter by status
- Search functionality
- Bulk operations
- Status indicators

#### Create Disposal (`/inventory/disposals/new`)

**Components Used:**

- FormInput, Select, Button, Card, Tabs
  **Features:**
- Item selection
- Reason selection (Damage, Obsolete, Theft, Lost, End of Life)
- Condition assessment (Poor, Fair, Good)
- Depreciation calculation
- Salvage value input
- File attachments (with tab)
- Approval workflow setup

#### Disposal Details (`/inventory/disposals/:disposalId`)

**Components Used:**

- Card, Badge, Button, Tabs
  **Features:**
- Item information
- Status timeline
- Approval workflow
- Financial impact summary
- Attached documents
- Action buttons (Approve, Reject, Download)

#### Disposal Reports (`/inventory/disposals/reports`)

**Components Used:**

- Card, Button
  **Features:**
- KPI cards (Total, Pending, Completed, Value)
- Disposal trends chart
- Reason distribution
- Category breakdown
- Export functionality

---

### Transfers Module Pages

#### Transfer List (`/inventory/transfers/list`)

**Components Used:**

- Table, Badge, Card, SearchBox, Button
  **Features:**
- All transfers with status
- Location comparison
- Status tracking
- Quick actions

#### Transfer Details (`/inventory/transfers/:transferId`)

**Components Used:**

- Card, Badge, Button, Tabs
  **Features:**
- Transfer information
- Location details
- Approval status
- Gate pass download
- Timeline tracking

---

### Admin Module Pages

#### Admin Dashboard (`/admin/dashboard`)

**Components Used:**

- Card, Button
  **Features:**
- System overview
- User statistics
- Recent activities
- Quick summary

#### User Management (`/admin/users`)

**Components Used:**

- Table, Badge, Button, Modal, FormInput, SearchBox
  **Features:**
- User list with search
- Create user modal
- Role assignment (Admin, Staff, Incharge)
- Department assignment
- Edit/Delete actions

#### Reports (`/admin/reports`)

**Components Used:**

- Card, Button
  **Features:**
- KPI cards
- Asset distribution chart
- Request trends
- Monthly transfers
- User activity charts

---

### Request Module Pages

#### Request List (`/inventory/requests/list`)

**Components Used:**

- Table, Badge, Card, SearchBox, Button
  **Features:**
- All item requests
- Priority indicators
- Status tracking
- Quick actions

#### Create Request (`/inventory/requests/new`)

**Components Used:**

- FormInput, Select, Button, Card
  **Features:**
- Item name/description
- Quantity
- Priority selection
- Budget allocation
- Specifications
- Justification

#### Request Approval (`/requests/approval`)

**Components Used:**

- Card, Badge, Button, Tabs
  **Features:**
- Request list sidebar
- Detail panel
- Status badges
- Priority indicators
- Workflow tabs (Details, Approvals, History)
- Action buttons

---

## 🔗 Key Integration Points

### Header Component

**Location:** `src/Components/Header.jsx`
**Features:**

- Displays "Hello, {username}"
- Fetches username from localStorage
- Responsive design
- Used in all layouts

### Footer Component

**Location:** `src/Components/Footer.jsx`
**Features:**

- Copyright information
- Simple footer
- Included in all layouts

### Navigation Items Constants

**Location:** `src/utils/constants.js`
**Exports:**

- `INVENTORY_NAV_ITEMS` - 6 items
- `ADMIN_NAV_ITEMS` - 3 items
- Status constants
- Disposal reasons
- Condition assessments

---

## 🚀 Quick Start Routes

### For Inventory Users

1. Start at `/inventory/dashboard`
2. Navigate to `/inventory/list` to see items
3. Create item at `/inventory/add`
4. Manage transfers at `/inventory/transfers/list`
5. Dispose items at `/inventory/disposals/list`

### For Admins

1. Start at `/admin/dashboard`
2. Manage users at `/admin/users`
3. View analytics at `/admin/reports`

### For Request Approvers

1. Go to `/requests/approval`
2. Review requests in sidebar
3. Approve/Reject from detail panel

---

## 📱 Responsive Design

### Sidebar Behavior

- **Desktop (lg):** w-64 (expanded), ml-64 on content
- **Tablet (md):** w-64 (expanded)
- **Mobile:** Can collapse to w-20, ml-20 on content

### Layout Spacing

- Max content width: 7xl (80rem)
- Padding: 6 (24px) on all sides
- Gap spacing uses Tailwind scale

### Header Styling

- Height: 60px
- Sticky positioning
- Flex layout for content distribution
- Responsive font sizes

---

## 🔐 Authentication Handling

### Username Display

```javascript
// Header.jsx
const storedUsername = localStorage.getItem("username") || "User";
```

**Setup Steps:**

1. After login, store username: `localStorage.setItem("username", "John Doe")`
2. Header will automatically display it
3. Fallback to "User" if not found

---

## 🛠 Dependencies

### Required for Routing

- `react-router-dom` ✓ (Already installed: ^7.12.0)

### Required for Styling

- `tailwindcss` ✓ (Added: ^3.4.1)
- `postcss` ✓ (Added: ^8.4.32)
- `autoprefixer` ✓ (Added: ^10.4.17)

### Configuration Files Created

- `tailwind.config.js` - Theme customization
- `postcss.config.js` - PostCSS setup
- `src/index.css` - Tailwind directives

---

## 📝 File Structure Summary

```
src/
├── main.jsx                          ← Router configuration (UPDATED)
├── index.css                         ← Tailwind styles (NEW)
├── Components/
│   ├── Header.jsx                    ← Username greeting (UPDATED)
│   ├── Footer.jsx                    ← Footer component
│   ├── UI/                           ← Reusable components (NEW)
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Badge.jsx
│   │   ├── FormInput.jsx
│   │   ├── Table.jsx
│   │   ├── Modal.jsx
│   │   ├── Select.jsx
│   │   ├── SearchBox.jsx
│   │   ├── Tabs.jsx
│   │   └── index.js
│   └── Layouts/                      ← Layout components (NEW)
│       ├── MainLayout.jsx            ← Inventory/Requests
│       ├── AdminLayout.jsx           ← Admin pages
│       ├── AuthLayout.jsx            ← Auth pages (optional)
│       ├── Sidebar.jsx               ← Navigation sidebar
│       └── index.js
├── Pages/
│   ├── Login/                        ← Existing auth pages
│   ├── Admin/                        ← Admin pages (NEW + UPDATED)
│   │   ├── AdminDashboard.jsx        ← Updated with new layout
│   │   ├── UserManagement.jsx        ← NEW
│   │   └── Reports.jsx               ← NEW
│   ├── Inventory/                    ← Inventory pages (NEW + EXISTING)
│   │   ├── InventoryDashboard.jsx    ← NEW
│   │   ├── InventoryListView.jsx     ← NEW
│   │   ├── AddNewItem.jsx            ← Existing
│   │   ├── InchargeDashboard.jsx     ← Existing
│   │   ├── Disposals/                ← Disposal pages (NEW)
│   │   │   ├── DisposalList.jsx
│   │   │   ├── CreateDisposal.jsx
│   │   │   ├── DisposalDetails.jsx
│   │   │   └── DisposalReports.jsx
│   │   ├── Transfers/                ← Transfer pages (NEW)
│   │   │   ├── TransferList.jsx
│   │   │   └── TransferDetails.jsx
│   │   └── Requests/                 ← Request pages (NEW)
│   │       ├── RequestList.jsx
│   │       └── CreateRequest.jsx
│   ├── Requests/                     ← Approval pages (NEW)
│   │   └── ItemRequest.jsx
│   └── StaffMember/                  ← Staff pages (existing)
├── utils/                            ← Utilities (NEW)
│   ├── constants.js                  ← Colors, nav items
│   └── helpers.js                    ← Formatting helpers
└── Styles/                           ← Old CSS files

tailwind.config.js                    ← NEW
postcss.config.js                     ← NEW
ROUTES.md                             ← NEW (Route documentation)
```

---

## ✅ Setup Checklist

- [x] Routes configured in main.jsx
- [x] Layouts created (MainLayout, AdminLayout, AuthLayout)
- [x] Navigation sidebar with collapse
- [x] All page components created
- [x] UI components library (Button, Card, Table, etc.)
- [x] Utilities (constants, helpers)
- [x] Tailwind CSS configured
- [x] Header updated with username greeting
- [x] Footer included in layouts
- [x] Route documentation created
- [x] Dependencies added to package.json

---

## 🎯 Next Steps

1. **Install Dependencies:**

   ```bash
   npm install
   ```

2. **Start Development Server:**

   ```bash
   npm run dev
   ```

3. **Test Routes:**
   - Navigate to `http://localhost:5173`
   - Login and check `/inventory/dashboard`
   - Try sidebar navigation
   - Test different routes

4. **Integration:**
   - Connect to API endpoints
   - Add authentication logic
   - Implement data fetching
   - Add state management if needed

---

## 📞 Route Reference Quick Links

| Feature   | Create                     | List                        | Details                    | Reports                        |
| --------- | -------------------------- | --------------------------- | -------------------------- | ------------------------------ |
| Inventory | `/inventory/add`           | `/inventory/list`           | N/A                        | N/A                            |
| Transfers | Form inline                | `/inventory/transfers/list` | `/inventory/transfers/:id` | N/A                            |
| Disposals | `/inventory/disposals/new` | `/inventory/disposals/list` | `/inventory/disposals/:id` | `/inventory/disposals/reports` |
| Requests  | `/inventory/requests/new`  | `/inventory/requests/list`  | N/A                        | N/A                            |
| Users     | Modal                      | `/admin/users`              | N/A                        | N/A                            |
| Reports   | N/A                        | N/A                         | `/admin/reports`           | N/A                            |
| Approvals | N/A                        | N/A                         | `/requests/approval`       | N/A                            |

---

**Status:** ✅ Routing System Complete
**Date:** January 28, 2026
**Version:** 1.0
