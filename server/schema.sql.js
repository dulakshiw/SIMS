export const createInventoryItemsTable = async (pool, tableName) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INT PRIMARY KEY AUTO_INCREMENT,
      inventory_id INT NULL,
      itemName VARCHAR(255) NOT NULL,
      itemCode VARCHAR(255) DEFAULT '',
      serialNo VARCHAR(255) DEFAULT '',
      serialNo2 VARCHAR(255) DEFAULT '',
      model VARCHAR(255) DEFAULT '',
      QRCode VARCHAR(255) DEFAULT '',
      QRCode2 VARCHAR(255) DEFAULT '',
      pageno VARCHAR(100) DEFAULT '',
      itemImage VARCHAR(255) DEFAULT '',
      value DECIMAL(12, 2) NULL,
      purchaseDate DATE NULL,
      ginNo VARCHAR(255) DEFAULT '',
      ginfile VARCHAR(255) DEFAULT '',
      poNo VARCHAR(255) DEFAULT '',
      supplier VARCHAR(255) DEFAULT '',
      funding VARCHAR(255) DEFAULT '',
      receivedfrom VARCHAR(255) DEFAULT '',
      warranty VARCHAR(255) DEFAULT '',
      location VARCHAR(255) DEFAULT '',
      remarks TEXT,
      qrcodeUrl TEXT,
      qrcode2Url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

export const createAccountRequestsTable = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_requests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      request_type VARCHAR(50) DEFAULT 'account_creation',
      requested_by_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      requested_role VARCHAR(50) NOT NULL,
      requested_department_id INT NULL,
      requested_password VARCHAR(255) NULL,
      requested_designation VARCHAR(255) NULL,
      requested_mobile_no VARCHAR(50) NULL,
      requested_off_ext VARCHAR(50) NULL,
      approval_status VARCHAR(50) DEFAULT 'pending_admin',
      requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      dept_head_approved_date TIMESTAMP NULL,
      dept_head_approved_by_id INT NULL,
      dean_approved_date TIMESTAMP NULL,
      dean_approved_by_id INT NULL,
      admin_approved_date TIMESTAMP NULL,
      admin_approved_by_id INT NULL,
      rejection_reason VARCHAR(500),
      rejection_date TIMESTAMP NULL,
      request_reason VARCHAR(500),
      user_id INT NULL,
      created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

export const createInventoryCreationRequestsTable = async (pool) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_creation_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        request_type VARCHAR(50) DEFAULT 'new_inventory_creation',
        name VARCHAR(255) NOT NULL,
        location VARCHAR(255) NULL,
        department_id INT NOT NULL,
        requested_by_id INT NOT NULL,
        incharge_user_id INT NULL,
        hod_user_id INT NULL,
        requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reason TEXT,
        approval_status VARCHAR(50) DEFAULT 'pending_hod',
        hod_approved_date TIMESTAMP NULL,
        hod_approved_by_id INT NULL,
        registrar_approved_date TIMESTAMP NULL,
        registrar_approved_by_id INT NULL,
        admin_approved_date TIMESTAMP NULL,
        admin_approved_by_id INT NULL,
        rejection_reason VARCHAR(500),
        rejection_date TIMESTAMP NULL,
        created_inventory_id INT NULL,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("inventory_creation_requests table ensured");
  } catch (error) {
    console.error("Error creating inventory_creation_requests table:", error.message);
  }
};

export const createItemRequestsTable = async (pool) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        priority VARCHAR(50) DEFAULT 'normal',
        specification TEXT NULL,
        reason TEXT NULL,
        requested_by_id INT NOT NULL,
        requested_inventory_id INT NULL,
        inventory_location VARCHAR(255) NULL,
        department_id INT NULL,
        inventory_department_id INT NULL,
        hod_user_id INT NULL,
        lab_hod_user_id INT NULL,
        approval_status VARCHAR(50) DEFAULT 'pending_requester_hod',
        requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        required_by_date DATE NULL,
        requester_hod_recommended_date TIMESTAMP NULL,
        requester_hod_recommended_by_id INT NULL,
        lab_hod_approved_date TIMESTAMP NULL,
        lab_hod_approved_by_id INT NULL,
        hod_approved_date TIMESTAMP NULL,
        hod_approved_by_id INT NULL,
        rejection_reason VARCHAR(500) NULL,
        rejection_date TIMESTAMP NULL
      )
    `);
    console.log("item_requests table ensured");
  } catch (error) {
    console.error("Error creating item_requests table:", error.message);
  }
};

const createWorkflowTable = (tableName, columns, label) => async (pool) => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`);
    console.log(`${label} table ensured`);
  } catch (error) {
    console.error(`Error creating ${label} table:`, error.message);
  }
};

export const createItemTransfersTable = createWorkflowTable(
  "item_transfers",
  `
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    from_inventory_id INT NOT NULL,
    to_inventory_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    reason TEXT NULL,
    notes TEXT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    approval_status VARCHAR(50) DEFAULT 'pending_hod',
    transfer_date DATE NULL,
    initiated_by_id INT NULL,
    source_hod_user_id INT NULL,
    destination_hod_user_id INT NULL,
    destination_hod_approved_date TIMESTAMP NULL,
    destination_hod_approved_by_id INT NULL,
    received_inventory_page_no VARCHAR(100) NULL,
    part_b_registrar_approved_date TIMESTAMP NULL,
    part_b_registrar_approved_by_id INT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    completed_date TIMESTAMP NULL
  `,
  "item_transfers"
);

export const createItemDisposalsTable = createWorkflowTable(
  "item_disposals",
  `
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    inventory_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    reason TEXT NULL,
    description TEXT NULL,
    \`condition\` VARCHAR(100) NULL,
    status VARCHAR(50) DEFAULT 'pending',
    approval_status VARCHAR(50) DEFAULT 'pending_hod',
    disposal_date DATE NULL,
    initiated_by_id INT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    completed_date TIMESTAMP NULL
  `,
  "item_disposals"
);

export const createItemRepairsTable = createWorkflowTable(
  "item_repairs",
  `
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    inventory_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    fault_description TEXT NULL,
    repair_notes TEXT NULL,
    status VARCHAR(50) DEFAULT 'submitted',
    approval_status VARCHAR(50) DEFAULT 'pending_hod',
    repair_date DATE NULL,
    initiated_by_id INT NULL,
    contact_person_user_id INT NULL,
    source_hod_user_id INT NULL,
    hod_approved_date TIMESTAMP NULL,
    hod_approved_by_id INT NULL,
    registrar_approved_date TIMESTAMP NULL,
    registrar_approved_by_id INT NULL,
    rejection_reason VARCHAR(500) NULL,
    repaired_by VARCHAR(255) NULL,
    repair_cost DECIMAL(10,2) NULL,
    received_date DATE NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    completed_date TIMESTAMP NULL
  `,
  "item_repairs"
);

export const createWarrantyClaimsTable = createWorkflowTable(
  "warranty_claims",
  `
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    inventory_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    fault_description TEXT NULL,
    claim_notes TEXT NULL,
    status VARCHAR(50) DEFAULT 'submitted',
    claim_date DATE NULL,
    initiated_by_id INT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_date TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    completed_date TIMESTAMP NULL
  `,
  "warranty_claims"
);

export const ensureForeignKeyRelationships = async (pool, itemsTableName) => {
  const [tableRows] = await pool.query("SHOW TABLES");
  const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
  const relationships = [
    [itemsTableName, "inventory_id", "inventories", "id", `fk_${itemsTableName}_inventory`, "SET NULL"],
    ["account_requests", "requested_department_id", "departments", "id", "fk_account_requests_requested_department", "SET NULL"],
    ["account_requests", "user_id", "users", "id", "fk_account_requests_user", "SET NULL"],
    ["inventory_creation_requests", "department_id", "departments", "id", "fk_inventory_creation_requests_department", "SET NULL"],
    ["inventory_creation_requests", "requested_by_id", "users", "id", "fk_inventory_creation_requests_requested_by", "SET NULL"],
    ["inventory_creation_requests", "incharge_user_id", "users", "id", "fk_inventory_creation_requests_incharge_user", "SET NULL"],
    ["inventory_creation_requests", "hod_user_id", "users", "id", "fk_inventory_creation_requests_hod_user", "SET NULL"],
    ["inventory_creation_requests", "admin_approved_by_id", "users", "id", "fk_inventory_creation_requests_admin_approved_by", "SET NULL"],
    ["item_requests", "requested_by_id", "users", "id", "fk_item_requests_requested_by", "SET NULL"],
    ["item_requests", "requested_inventory_id", "inventories", "id", "fk_item_requests_requested_inventory", "SET NULL"],
    ["item_requests", "department_id", "departments", "id", "fk_item_requests_department", "SET NULL"],
    ["item_requests", "inventory_department_id", "departments", "id", "fk_item_requests_inventory_department", "SET NULL"],
    ["item_requests", "hod_user_id", "users", "id", "fk_item_requests_hod_user", "SET NULL"],
    ["item_requests", "lab_hod_user_id", "users", "id", "fk_item_requests_lab_hod_user", "SET NULL"],
    ["item_requests", "requester_hod_recommended_by_id", "users", "id", "fk_item_requests_requester_hod_recommended_by", "SET NULL"],
    ["item_requests", "lab_hod_approved_by_id", "users", "id", "fk_item_requests_lab_hod_approved_by", "SET NULL"],
    ["item_requests", "hod_approved_by_id", "users", "id", "fk_item_requests_hod_approved_by", "SET NULL"],
    ["item_transfers", "item_id", itemsTableName, "id", "fk_item_transfers_item", "CASCADE"],
    ["item_transfers", "from_inventory_id", "inventories", "id", "fk_item_transfers_from_inventory", "SET NULL"],
    ["item_transfers", "to_inventory_id", "inventories", "id", "fk_item_transfers_to_inventory", "SET NULL"],
    ["item_transfers", "initiated_by_id", "users", "id", "fk_item_transfers_initiated_by", "SET NULL"],
    ["item_disposals", "item_id", itemsTableName, "id", "fk_item_disposals_item", "CASCADE"],
    ["item_disposals", "inventory_id", "inventories", "id", "fk_item_disposals_inventory", "SET NULL"],
    ["item_disposals", "initiated_by_id", "users", "id", "fk_item_disposals_initiated_by", "SET NULL"],
    ["item_repairs", "item_id", itemsTableName, "id", "fk_item_repairs_item", "CASCADE"],
    ["item_repairs", "inventory_id", "inventories", "id", "fk_item_repairs_inventory", "SET NULL"],
    ["item_repairs", "initiated_by_id", "users", "id", "fk_item_repairs_initiated_by", "SET NULL"],
    ["password_reset_otps", "user_id", "users", "id", "fk_password_reset_otps_user", "SET NULL"],
    ["warranty_claims", "item_id", itemsTableName, "id", "fk_warranty_claims_item", "CASCADE"],
    ["warranty_claims", "inventory_id", "inventories", "id", "fk_warranty_claims_inventory", "SET NULL"],
    ["warranty_claims", "initiated_by_id", "users", "id", "fk_warranty_claims_initiated_by", "SET NULL"],
  ];

  for (const [table, column, referencedTable, referencedColumn, constraintName, onDelete] of relationships) {
    if (!tableNames.has(table) || !tableNames.has(referencedTable)) {
      continue;
    }

    try {
      const [columnRows] = await pool.query(`SHOW COLUMNS FROM ${table}`);
      if (!columnRows.some((columnRow) => columnRow.Field === column)) {
        continue;
      }

      const [existingRows] = await pool.query(
        `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
           AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [table, column]
      );
      if (existingRows.some((row) => row.CONSTRAINT_NAME === constraintName)) {
        continue;
      }

      const [invalidRows] = await pool.query(
        `SELECT COUNT(*) AS count FROM ${table}
         WHERE ${column} IS NOT NULL
           AND ${column} NOT IN (SELECT ${referencedColumn} FROM ${referencedTable})`
      );
      if (Number(invalidRows[0]?.count ?? 0) > 0) {
        continue;
      }

      await pool.query(
        `ALTER TABLE ${table} ADD CONSTRAINT ${constraintName}
         FOREIGN KEY (${column}) REFERENCES ${referencedTable}(${referencedColumn})
         ON DELETE ${onDelete} ON UPDATE CASCADE`
      );
    } catch (error) {
      console.warn(`[schema] Could not add foreign key ${constraintName}: ${error.message}`);
    }
  }
};
