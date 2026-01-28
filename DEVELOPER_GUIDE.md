# SIMS Quick Developer Reference

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Access Application

- Navigate to `http://localhost:5173`
- Default login (no validation yet)

---

## 📍 All Routes at a Glance

### Auth Routes (No Layout)

```
/                   Login
/signup             Sign Up
/forgotPassword     Forgot Password
```

### Admin Routes (AdminLayout)

```
/admin/dashboard    Dashboard
/admin/users        User Management
/admin/reports      Reports & Analytics
```

### Inventory Routes (MainLayout)

```
/inventory/dashboard            Dashboard
/inventory/list                 Item List
/inventory/add                  Add Item

/inventory/transfers/list       Transfers
/inventory/transfers/:id        Transfer Details

/inventory/disposals/list       Disposal List
/inventory/disposals/new        Create Disposal
/inventory/disposals/:id        Disposal Details
/inventory/disposals/reports    Disposal Reports

/inventory/requests/list        Request List
/inventory/requests/new         Create Request
```

### Request Approval Routes (MainLayout)

```
/requests/approval              Approval Workflow
```

### Other Routes

```
/staff/dashboard                Staff Dashboard
/incharge/dashboard             Incharge Dashboard
```

---

## 🎨 Component Usage Examples

### Using MainLayout

```jsx
import { MainLayout } from "../../Components/Layouts";

export default function MyPage() {
  return (
    <MainLayout variant="inventory">
      <h1>My Content</h1>
    </MainLayout>
  );
}
```

### Using AdminLayout

```jsx
import AdminLayout from "../../Components/Layouts/AdminLayout";

export default function AdminPage() {
  return (
    <AdminLayout>
      <h1>Admin Content</h1>
    </AdminLayout>
  );
}
```

### Using UI Components

```jsx
import { Button, Card, Table, Badge, FormInput, Select } from '../../Components/UI'

// Button
<Button variant="primary" icon="add_circle">Add</Button>

// Card
<Card title="Users" icon="people">
  Content here
</Card>

// Table
<Table columns={columns} data={data} actions={actions} />

// Badge
<Badge label="Pending" variant="warning" />

// FormInput
<FormInput label="Name" placeholder="Enter name" />

// Select
<Select label="Status" options={options} />
```

---

## 📁 Creating a New Page

### Step 1: Create Page File

```bash
src/Pages/YourModule/YourPage.jsx
```

### Step 2: Setup Page Component

```jsx
import MainLayout from "../../Components/Layouts/MainLayout";
import { Card, Button } from "../../Components/UI";

export default function YourPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Your Title</h1>
        <Card title="Card Title">Your content</Card>
      </div>
    </MainLayout>
  );
}
```

### Step 3: Add Route in main.jsx

```jsx
import YourPage from './Pages/YourModule/YourPage'

// In router config:
{
  path: "/your-path",
  element: <YourPage />
}
```

---

## 🎨 Theme Colors

### Primary Colors

```
#0b3b5b  - Primary
#2e77c7  - Light Primary
#081f31  - Dark Primary
```

### Semantic Colors

```
#10b981  - Success
#f59e0b  - Warning
#ef4444  - Error
#3b82f6  - Info
```

### Background

```
#f6f7f8  - Light Background
#111b21  - Dark Background
#e8eef3  - Light Border
```

### Usage in Tailwind

```jsx
className = "text-primary-800";
className = "bg-success";
className = "border-border-light";
```

---

## 🔧 Constants & Enums

### Navigation Items

```jsx
import { INVENTORY_NAV_ITEMS, ADMIN_NAV_ITEMS } from "../../utils/constants";
```

### Status Options

```jsx
import {
  ITEM_STATUS,
  TRANSFER_STATUS,
  DISPOSAL_STATUS,
  REQUEST_PRIORITY,
} from "../../utils/constants";
```

### Other Constants

```jsx
import {
  DISPOSAL_REASONS,
  CONDITION_ASSESSMENT,
  ROLES,
} from "../../utils/constants";
```

---

## 🛠 Helper Functions

### Date Formatting

```jsx
import {
  formatDate,
  formatDateTime,
  formatCurrency,
} from "../../utils/helpers";

formatDate(new Date()); // "15/01/2024"
formatDateTime(new Date()); // "15/01/2024 10:30 AM"
formatCurrency(1500); // "$1,500.00"
```

### Text Utilities

```jsx
import { capitalize, truncateText, getInitials } from "../../utils/helpers";

capitalize("hello"); // "Hello"
truncateText("Long text", 10); // "Long tex..."
getInitials("John Doe"); // "JD"
```

### Storage

```jsx
import { storage } from "../../utils/helpers";

storage.set("key", value); // Save to localStorage
storage.get("key"); // Get from localStorage
storage.remove("key"); // Remove from localStorage
storage.clear(); // Clear all
```

### Validation

```jsx
import { validation } from "../../utils/helpers";

validation.email(email); // Boolean
validation.phone(phone); // Boolean
validation.password(pwd); // Boolean (min 6)
validation.username(user); // Boolean (3-20 chars)
```

---

## 📊 Table Component Guide

### Basic Table

```jsx
<Table
  columns={[
    { field: "name", label: "Name" },
    { field: "email", label: "Email" },
  ]}
  data={data}
  searchable={true}
  paginated={true}
/>
```

### With Custom Rendering

```jsx
<Table
  columns={[
    { field: "name", label: "Name" },
    {
      field: "status",
      label: "Status",
      render: (value) => <Badge label={value} variant={value} />,
    },
  ]}
  data={data}
/>
```

### With Actions

```jsx
<Table
  columns={columns}
  data={data}
  actions={[
    { label: "Edit", icon: "edit", onClick: (row) => console.log(row) },
    { label: "Delete", icon: "delete", onClick: (row) => console.log(row) },
  ]}
/>
```

---

## 📝 Form Input Guide

### Text Input

```jsx
<FormInput
  label="Username"
  name="username"
  placeholder="Enter username"
  required
/>
```

### With Validation

```jsx
<FormInput
  label="Email"
  type="email"
  error={errors.email}
  helpText="We'll never share your email"
/>
```

### Textarea

```jsx
<FormInput label="Description" type="textarea" rows={5} />
```

### With Icon

```jsx
<FormInput label="Search" icon="search" placeholder="Search items..." />
```

---

## 🔄 Modal Component Guide

```jsx
import { useState } from "react";
import { Modal, Button } from "../../Components/UI";

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="My Modal"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary">Save</Button>
          </div>
        }
      >
        Modal content here
      </Modal>
    </>
  );
}
```

---

## 📱 Responsive Classes

### Tailwind Breakpoints

```
sm:  640px   (Mobile)
md:  768px   (Tablet)
lg:  1024px  (Desktop)
xl:  1280px  (Large Desktop)
```

### Usage

```jsx
// Mobile: 1 col, Tablet: 2 cols, Desktop: 4 cols
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Items */}
</div>

// Hide on mobile, show on tablet+
<div className="hidden md:block">
  {/* Content */}
</div>
```

---

## 🔗 Navigation Examples

### Link to Route

```jsx
import { Link } from "react-router-dom";

<Link to="/inventory/list">Go to Inventory</Link>;
```

### Programmatic Navigation

```jsx
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();
navigate("/admin/dashboard");
```

### Route Parameters

```jsx
// Define route with param
{
  path: "inventory/disposals/:disposalId",
  element: <DisposalDetails />
}

// Use in component
import { useParams } from 'react-router-dom'
const { disposalId } = useParams()
```

---

## 📋 Common Page Structure

```jsx
import { MainLayout } from "../../Components/Layouts";
import { Card, Button, Table, SearchBox } from "../../Components/UI";

export default function MyPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-dark">Page Title</h1>
            <p className="text-text-light mt-2">Page description</p>
          </div>
          <Button icon="add_circle" variant="primary">
            Action
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card title="Stat" icon="icon">
            <p className="text-3xl font-bold text-primary-800">100</p>
          </Card>
        </div>

        {/* Search */}
        <SearchBox
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search..."
        />

        {/* Content */}
        <Card>
          <Table columns={columns} data={data} />
        </Card>
      </div>
    </MainLayout>
  );
}
```

---

## 🎯 Material Icons

Full list: https://fonts.google.com/icons

### Commonly Used

```
add_circle       add
edit             pencil
delete           trash
visibility       eye
search           magnifying_glass
check_circle     checkmark
schedule         clock
close            x
more_horiz       three dots
dashboard        home
inventory_2      boxes
compare_arrows   transfer
delete_sweep     disposal
request_quote    form
people           users
settings         gear
logout           exit
```

---

## 🐛 Debugging Tips

### Check Route

```jsx
import { useLocation } from "react-router-dom";
const location = useLocation();
console.log(location.pathname);
```

### Log Props

```jsx
console.log("Props:", { children, variant });
```

### Check State

```jsx
const [state, setState] = useState("initial");
console.log("State:", state);
```

### Inspect localStorage

```javascript
console.log(localStorage.getItem("username"));
```

---

## 📞 Support

### File Locations

- Routes: `src/main.jsx`
- Pages: `src/Pages/{Module}/`
- Components: `src/Components/UI/`, `src/Components/Layouts/`
- Styles: `src/index.css` (Tailwind)
- Utils: `src/utils/`

### Key Files

- `src/main.jsx` - Route configuration
- `src/utils/constants.js` - All enums
- `src/utils/helpers.js` - Utility functions
- `tailwind.config.js` - Theme configuration

---

## ✨ Tips & Tricks

1. **Spacing:** Use `space-y-6` for vertical spacing between elements
2. **Colors:** Use Tailwind's color names like `text-primary-800`, `bg-success`
3. **Icons:** Use Material Symbols Outlined: `<span className="material-symbols-outlined">icon_name</span>`
4. **Responsive:** Always use `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` pattern
5. **Transitions:** Add `transition-smooth` class for smooth effects
6. **Search:** Use SearchBox component with debounce built-in

---

**Happy Coding! 🎉**
