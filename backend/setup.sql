-- ============================================================
-- SIMS Database Setup
-- Run this file in MySQL Workbench or the MySQL CLI:
--   mysql -u root -p sims_db < setup.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS sims_db;
USE sims_db;

-- ============================================================
-- 1. CORE TABLES (create in dependency order)
-- ============================================================

CREATE TABLE IF NOT EXISTS faculties (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  dean_id INT,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE,
  code VARCHAR(50) NOT NULL UNIQUE,
  head_id INT,
  faculty_id INT,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id)
);

CREATE TABLE IF NOT EXISTS users (
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

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Back-fill FK columns now that users table exists
ALTER TABLE faculties
  ADD CONSTRAINT IF NOT EXISTS fk_faculties_dean
  FOREIGN KEY (dean_id) REFERENCES users(id);

ALTER TABLE departments
  ADD CONSTRAINT IF NOT EXISTS fk_departments_head
  FOREIGN KEY (head_id) REFERENCES users(id);

CREATE TABLE IF NOT EXISTS inventories (
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

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  inventory_id INT NOT NULL,
  quantity INT DEFAULT 1,
  unit VARCHAR(50),
  `condition` ENUM('good', 'fair', 'poor', 'damaged') DEFAULT 'good',
  status ENUM('available', 'in-use', 'maintenance', 'damaged', 'disposed') DEFAULT 'available',
  location VARCHAR(255),
  remark_type ENUM('transferred', 'disposed', 'repaired') DEFAULT NULL,
  remark_details VARCHAR(500),
  original_inventory_id INT,
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES inventories(id),
  FOREIGN KEY (original_inventory_id) REFERENCES inventories(id)
);

-- ============================================================
-- 2. REQUEST / APPROVAL TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS account_requests (
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

CREATE TABLE IF NOT EXISTS inventory_creation_requests (
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

CREATE TABLE IF NOT EXISTS item_requests (
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

-- ============================================================
-- 3. TRANSACTION TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS item_transfers (
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

CREATE TABLE IF NOT EXISTS item_disposals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL,
  inventory_id INT NOT NULL,
  quantity INT NOT NULL,
  disposal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  initiated_by_id INT NOT NULL,
  reason ENUM('damage', 'obsolete', 'theft', 'lost', 'end-of-life') NOT NULL,
  `condition` ENUM('poor', 'fair', 'good') NOT NULL,
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

CREATE TABLE IF NOT EXISTS audit_logs (
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
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- 4. SAMPLE DATA
-- NOTE: passwords below are plain text placeholders.
--       Replace with bcrypt hashes before going to production.
-- ============================================================

-- Faculty
INSERT INTO faculties (id, name, description) VALUES
  (1, 'Faculty of Information Technology', 'IT Faculty of University of Moratuwa')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Departments
INSERT INTO departments (id, name, code, faculty_id) VALUES
  (1, 'Computer Science & Engineering', 'CSE', 1),
  (2, 'Information Technology',          'IT',  1),
  (3, 'Software Engineering',            'SE',  1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Users (one per role)
INSERT INTO users (id, name, email, password, role, department_id, status) VALUES
  (1, 'Admin User',        'admin@sims.lk',    'admin123',    'admin',              NULL, 'active'),
  (2, 'Registrar User',    'reg@sims.lk',      'reg123',      'registrar',          NULL, 'active'),
  (3, 'HOD CSE',           'hod.cse@sims.lk',  'hod123',      'head_of_department', 1,    'active'),
  (4, 'Dean IT',           'dean@sims.lk',     'dean123',     'dean',               NULL, 'active'),
  (5, 'Inventory Incharge','incharge@sims.lk', 'inv123',      'inventory_incharge', 1,    'active'),
  (6, 'Staff Member',      'staff@sims.lk',    'staff123',    'staff',              1,    'active')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Link dean and department head
UPDATE faculties    SET dean_id = 4 WHERE id = 1;
UPDATE departments  SET head_id = 3 WHERE id = 1;

-- Inventories
INSERT INTO inventories (id, name, department_id, incharge_id, description) VALUES
  (1, 'CSE Main Lab Inventory',    1, 5, 'Main computer lab equipment'),
  (2, 'CSE Server Room Inventory', 1, 5, 'Server room hardware')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Inventory items
INSERT INTO inventory_items (name, inventory_id, quantity, unit, `condition`, status, location) VALUES
  ('Dell Optiplex 7090',   1, 30, 'units', 'good',    'available', 'Lab 101'),
  ('HP LaserJet Pro M404', 1,  3, 'units', 'good',    'available', 'Lab 101'),
  ('Cisco Switch 24-Port', 2,  2, 'units', 'good',    'in-use',    'Server Room'),
  ('APC UPS 1500VA',       2,  4, 'units', 'fair',    'available', 'Server Room'),
  ('Dell PowerEdge R740',  2,  1, 'units', 'good',    'in-use',    'Server Room');
