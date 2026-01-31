# Database Schema Recommendations

## Overview

This document outlines recommended database schema for implementing the business logic described in BUSINESS_LOGIC_IMPLEMENTATION.md.

---

## Core Tables

### 1. users

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'registrar', 'staff', 'inventory_incharge', 'head_of_department', 'dean') NOT NULL,
  department_id INT,
  status ENUM('active', 'inactive', 'pending_approval') DEFAULT 'pending_approval',
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- Indexes
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_role ON users(role);
CREATE INDEX idx_department_id ON users(department_id);
CREATE INDEX idx_status ON users(status);
```

### 2. departments

```sql
CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  head_id INT,
  faculty_id INT,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (head_id) REFERENCES users(id),
  FOREIGN KEY (faculty_id) REFERENCES faculties(id)
);

-- Indexes
CREATE INDEX idx_code ON departments(code);
CREATE INDEX idx_head_id ON departments(head_id);
CREATE INDEX idx_faculty_id ON departments(faculty_id);
```

### 3. faculties

```sql
CREATE TABLE faculties (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  dean_id INT,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (dean_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_dean_id ON faculties(dean_id);
```

### 4. inventories

```sql
CREATE TABLE inventories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  department_id INT NOT NULL,
  incharge_id INT NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (incharge_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_department_id ON inventories(department_id);
CREATE INDEX idx_incharge_id ON inventories(incharge_id);
CREATE INDEX idx_status ON inventories(status);
```

### 5. inventory_items

```sql
CREATE TABLE inventory_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  inventory_id INT NOT NULL,
  quantity INT DEFAULT 1,
  unit VARCHAR(50),
  condition ENUM('good', 'fair', 'poor', 'damaged') DEFAULT 'good',
  status ENUM('available', 'in-use', 'maintenance', 'damaged', 'disposed') DEFAULT 'available',
  location VARCHAR(255),
  remark_type ENUM('transferred', 'disposed', 'repaired', NULL) DEFAULT NULL,
  remark_details VARCHAR(500),
  original_inventory_id INT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES inventories(id),
  FOREIGN KEY (original_inventory_id) REFERENCES inventories(id)
);

-- Indexes
CREATE INDEX idx_inventory_id ON inventory_items(inventory_id);
CREATE INDEX idx_original_inventory_id ON inventory_items(original_inventory_id);
CREATE INDEX idx_status ON inventory_items(status);
CREATE INDEX idx_remark_type ON inventory_items(remark_type);
```

---

## Request/Approval Tables

### 6. account_requests

```sql
CREATE TABLE account_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  requested_by_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  requested_role ENUM('staff', 'inventory_incharge', 'head_of_department', 'dean') NOT NULL,
  requested_department_id INT,
  approval_status ENUM('pending_dept_head', 'approved_by_dept_head', 'pending_admin', 'approved_by_admin', 'rejected') DEFAULT 'pending_dept_head',
  requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  dept_head_approved_date TIMESTAMP NULL,
  dept_head_approved_by_id INT,
  admin_approved_date TIMESTAMP NULL,
  admin_approved_by_id INT,
  rejection_reason VARCHAR(500),
  rejection_date TIMESTAMP NULL,
  user_id INT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (requested_department_id) REFERENCES departments(id),
  FOREIGN KEY (dept_head_approved_by_id) REFERENCES users(id),
  FOREIGN KEY (admin_approved_by_id) REFERENCES users(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_approval_status ON account_requests(approval_status);
CREATE INDEX idx_requested_department_id ON account_requests(requested_department_id);
CREATE INDEX idx_email ON account_requests(email);
```

### 7. inventory_creation_requests

```sql
CREATE TABLE inventory_creation_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  department_id INT NOT NULL,
  requested_by_id INT NOT NULL,
  requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  approval_status ENUM('pending_staff', 'approved_by_hod', 'pending_registrar', 'approved_by_registrar', 'rejected') DEFAULT 'pending_staff',
  hod_approved_date TIMESTAMP NULL,
  hod_approved_by_id INT,
  registrar_approved_date TIMESTAMP NULL,
  registrar_approved_by_id INT,
  rejection_reason VARCHAR(500),
  rejection_date TIMESTAMP NULL,
  created_inventory_id INT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (requested_by_id) REFERENCES users(id),
  FOREIGN KEY (hod_approved_by_id) REFERENCES users(id),
  FOREIGN KEY (registrar_approved_by_id) REFERENCES users(id),
  FOREIGN KEY (created_inventory_id) REFERENCES inventories(id)
);

-- Indexes
CREATE INDEX idx_approval_status ON inventory_creation_requests(approval_status);
CREATE INDEX idx_department_id ON inventory_creation_requests(department_id);
CREATE INDEX idx_requested_by_id ON inventory_creation_requests(requested_by_id);
```

### 8. item_requests

```sql
CREATE TABLE item_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  requested_by_id INT NOT NULL,
  requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  item_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  reason TEXT,
  required_by_date DATE,
  requested_from_inventory_id INT NOT NULL,
  approval_status ENUM('pending_dept_head', 'pending_requested_dept_hod', 'approved', 'rejected') DEFAULT 'pending_dept_head',
  dept_head_approved_date TIMESTAMP NULL,
  dept_head_approved_by_id INT,
  requested_dept_hod_approved_date TIMESTAMP NULL,
  requested_dept_hod_approved_by_id INT,
  rejection_reason VARCHAR(500),
  rejection_date TIMESTAMP NULL,
  allocated_inventory_id INT,
  allocated_quantity INT,
  allocated_date TIMESTAMP NULL,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (requested_by_id) REFERENCES users(id),
  FOREIGN KEY (requested_from_inventory_id) REFERENCES inventories(id),
  FOREIGN KEY (dept_head_approved_by_id) REFERENCES users(id),
  FOREIGN KEY (requested_dept_hod_approved_by_id) REFERENCES users(id),
  FOREIGN KEY (allocated_inventory_id) REFERENCES inventories(id)
);

-- Indexes
CREATE INDEX idx_approval_status ON item_requests(approval_status);
CREATE INDEX idx_requested_by_id ON item_requests(requested_by_id);
CREATE INDEX idx_requested_from_inventory_id ON item_requests(requested_from_inventory_id);
```

---

## Transaction Tables

### 9. item_transfers

```sql
CREATE TABLE item_transfers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  from_inventory_id INT NOT NULL,
  to_inventory_id INT NOT NULL,
  quantity INT NOT NULL,
  transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  initiated_by_id INT NOT NULL,
  reason TEXT,
  status ENUM('pending', 'in-transit', 'completed', 'cancelled') DEFAULT 'pending',
  completed_date TIMESTAMP NULL,
  notes VARCHAR(500),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id),
  FOREIGN KEY (from_inventory_id) REFERENCES inventories(id),
  FOREIGN KEY (to_inventory_id) REFERENCES inventories(id),
  FOREIGN KEY (initiated_by_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_item_id ON item_transfers(item_id);
CREATE INDEX idx_from_inventory_id ON item_transfers(from_inventory_id);
CREATE INDEX idx_to_inventory_id ON item_transfers(to_inventory_id);
CREATE INDEX idx_status ON item_transfers(status);
```

### 10. item_disposals

```sql
CREATE TABLE item_disposals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  inventory_id INT NOT NULL,
  quantity INT NOT NULL,
  disposal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  initiated_by_id INT NOT NULL,
  reason ENUM('damage', 'obsolete', 'theft', 'lost', 'end-of-life') NOT NULL,
  condition ENUM('poor', 'fair', 'good') NOT NULL,
  description TEXT,
  status ENUM('pending', 'approved', 'completed', 'rejected') DEFAULT 'pending',
  approved_date TIMESTAMP NULL,
  approved_by_id INT,
  notes VARCHAR(500),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id),
  FOREIGN KEY (inventory_id) REFERENCES inventories(id),
  FOREIGN KEY (initiated_by_id) REFERENCES users(id),
  FOREIGN KEY (approved_by_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_item_id ON item_disposals(item_id);
CREATE INDEX idx_inventory_id ON item_disposals(inventory_id);
CREATE INDEX idx_status ON item_disposals(status);
```

---

## Audit/Logging Table

### 11. audit_logs

```sql
CREATE TABLE audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_entity_type (entity_type),
  INDEX idx_timestamp (timestamp)
);
```

---

## Key Relationships

```
users
├── OWNS many account_requests (requested_by_id)
├── APPROVES many account_requests (dept_head_approved_by_id, admin_approved_by_id)
├── LEADS many departments (head_id in departments)
├── MANAGES many inventories (incharge_id in inventories)
├── BELONGS TO one department (department_id)
└── INITIATES many transfers/disposals

departments
├── HAS many users (department_id in users)
├── HAS many inventories (department_id in inventories)
├── HAS many requests (department_id in requests)
└── BELONGS TO one faculty (faculty_id)

inventories
├── CONTAINS many inventory_items
├── HAS one incharge (user)
├── BELONGS TO one department
└── CAN RECEIVE transfers (to_inventory_id)

inventory_items
├── BELONGS TO one inventory
├── CAN HAVE remarks (transferred, disposed)
└── TRACKED IN transfers/disposals
```

---

## Sample Queries

### Get Pending Account Requests for HOD

```sql
SELECT ar.*
FROM account_requests ar
WHERE ar.approval_status = 'pending_dept_head'
  AND ar.requested_department_id = ?
ORDER BY ar.requested_date ASC;
```

### Get Department Inventory with Item Counts

```sql
SELECT
  i.id,
  i.name,
  d.name as department,
  u.name as incharge,
  COUNT(ii.id) as item_count
FROM inventories i
JOIN departments d ON i.department_id = d.id
JOIN users u ON i.incharge_id = u.id
LEFT JOIN inventory_items ii ON i.id = ii.inventory_id AND ii.status != 'disposed'
WHERE i.department_id = ?
GROUP BY i.id;
```

### Get Item with Transfer History

```sql
SELECT
  ii.*,
  it.to_inventory_id,
  it.transfer_date,
  i_to.name as transferred_to
FROM inventory_items ii
LEFT JOIN item_transfers it ON ii.id = it.item_id AND it.status = 'completed'
LEFT JOIN inventories i_to ON it.to_inventory_id = i_to.id
WHERE ii.id = ?;
```

### Get User Login Statistics

```sql
SELECT
  u.name,
  u.email,
  u.role,
  COUNT(DISTINCT DATE(l.timestamp)) as login_days,
  MAX(l.timestamp) as last_login,
  MIN(l.timestamp) as first_login
FROM users u
LEFT JOIN login_logs l ON u.id = l.user_id
WHERE u.status = 'active'
GROUP BY u.id
ORDER BY l.timestamp DESC;
```

---

## Implementation Notes

1. **Use transactions** for multi-step approvals
2. **Add triggers** to auto-update `updated_date` fields
3. **Implement soft deletes** for audit trail (status instead of DELETE)
4. **Create views** for common reporting queries
5. **Add database constraints** to enforce business rules
6. **Use prepared statements** to prevent SQL injection
7. **Implement row-level security** for department-based access
8. **Regular backups** especially after request approvals

---

## Migration Path

1. Create base tables (users, departments, faculties, inventories, inventory_items)
2. Create request tables (account_requests, inventory_creation_requests)
3. Create transaction tables (item_transfers, item_disposals)
4. Create item_requests and audit_logs
5. Add constraints and indexes
6. Populate initial data
7. Test all workflows with actual data
