import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mysql from "mysql2/promise";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "sims_db";
const DB_ITEMS_TABLE = process.env.DB_ITEMS_TABLE || "inventory_items";
const AUTO_CREATE_TABLES = process.env.AUTO_CREATE_TABLES === "true";

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

let dbReady = false;

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));

const itemColumns = [
  "itemName",
  "itemCode",
  "serialNo",
  "serialNo2",
  "model",
  "QRCode",
  "QRCode2",
  "pageno",
  "itemImage",
  "value",
  "purchaseDate",
  "ginNo",
  "ginfile",
  "poNo",
  "supplier",
  "funding",
  "receivedfrom",
  "warranty",
  "location",
  "remarks",
  "qrcodeUrl",
  "qrcode2Url",
];

const normalizeItemPayload = (payload = {}) => ({
  itemName: payload.itemName ?? payload.itemname ?? "",
  itemCode: payload.itemCode ?? payload.itemcode ?? "",
  serialNo: payload.serialNo ?? payload.serialno ?? "",
  serialNo2: payload.serialNo2 ?? payload.serialno2 ?? "",
  model: payload.model ?? "",
  QRCode: payload.QRCode ?? payload.qrcode ?? "",
  QRCode2: payload.QRCode2 ?? payload.qrcode2 ?? "",
  pageno: payload.pageno ?? "",
  itemImage: payload.itemImage ?? payload.itemimage ?? "",
  value: payload.value ?? "",
  purchaseDate: payload.purchaseDate ?? payload.purchasedate ?? null,
  ginNo: payload.ginNo ?? payload.ginno ?? "",
  ginfile: payload.ginfile ?? "",
  poNo: payload.poNo ?? payload.pono ?? "",
  supplier: payload.supplier ?? "",
  funding: payload.funding ?? "",
  receivedfrom: payload.receivedfrom ?? payload.receivedFrom ?? "",
  warranty: payload.warranty ?? "",
  location: payload.location ?? "",
  remarks: payload.remarks ?? "",
  qrcodeUrl: payload.qrcodeUrl ?? payload.QRCodeUrl ?? "",
  qrcode2Url: payload.qrcode2Url ?? payload.QRCode2Url ?? "",
});

const buildInsertValues = (item) => itemColumns.map((column) => item[column]);

const createInventoryItemsTable = async () => {
  await pool.query(
    `
      CREATE TABLE IF NOT EXISTS ${DB_ITEMS_TABLE} (
        id INT PRIMARY KEY AUTO_INCREMENT,
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
    `
  );
};

const createAccountRequestsTable = async () => {
  await pool.query(
    `
      CREATE TABLE IF NOT EXISTS account_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        request_type VARCHAR(50) DEFAULT 'account_creation',
        requested_by_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        requested_role VARCHAR(50) NOT NULL,
        requested_department_id INT NULL,
        approval_status VARCHAR(50) DEFAULT 'pending_admin',
        requested_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        dept_head_approved_date TIMESTAMP NULL,
        dept_head_approved_by_id INT NULL,
        admin_approved_date TIMESTAMP NULL,
        admin_approved_by_id INT NULL,
        rejection_reason VARCHAR(500),
        rejection_date TIMESTAMP NULL,
        request_reason VARCHAR(500),
        user_id INT NULL,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `
  );
};

const createInventoryCreationRequestsTable = async () => {
  await pool.query(
    `
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
    `
  );
};

const validateRequiredFields = (item) => {
  if (!item.itemName?.trim()) {
    return "itemName is required";
  }
  return null;
};

let authSchema = null;

const normalizeUserRole = (roleValue) => {
  const normalizedRole = String(roleValue ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const roleAliases = {
    admin: "admin",
    registrar: "registrar",
    staff: "staff",
    staff_member: "staff",
    dean: "dean",
    head_of_the_department: "head_of_department",
    head_of_department: "head_of_department",
    inventory_incharge: "inventory_incharge",
    inventory_in_charge: "inventory_incharge",
  };

  return roleAliases[normalizedRole] || normalizedRole;
};

const getAuthSchema = async () => {
  if (authSchema) {
    return authSchema;
  }

  const [userColumnsRows] = await pool.query("SHOW COLUMNS FROM users");
  const [tableRows] = await pool.query("SHOW TABLES");
  const userColumns = new Set(userColumnsRows.map((column) => column.Field));
  const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));

  let departmentColumns = new Set();
  if (tableNames.has("departments")) {
    const [departmentColumnsRows] = await pool.query("SHOW COLUMNS FROM departments");
    departmentColumns = new Set(departmentColumnsRows.map((column) => column.Field));
  }

  const designationTableName = tableNames.has("designation")
    ? "designation"
    : tableNames.has("designations")
      ? "designations"
      : null;

  let designationColumns = new Set();
  if (designationTableName) {
    const [designationColumnsRows] = await pool.query(`SHOW COLUMNS FROM ${designationTableName}`);
    designationColumns = new Set(designationColumnsRows.map((column) => column.Field));
  }

  authSchema = {
    userColumns,
    departmentColumns,
    designationColumns,
    hasDepartmentsTable: tableNames.has("departments"),
    hasUserRolesTable: tableNames.has("user_roles"),
    hasDesignationTable: Boolean(designationTableName),
    designationTableName,
  };

  return authSchema;
};

const buildUserResponse = (user) => ({
  id: user.id ?? user.user_id ?? null,
  name: user.name ?? user.full_name ?? "",
  email: user.email,
  role: normalizeUserRole(user.role ?? user.user_role),
  status: String(user.status ?? "").toLowerCase(),
  departmentId: user.department_id ?? null,
  departmentName: user.department_name ?? null,
  designation: user.designation ?? "",
});

const getDesignationQueryParts = (schema, userAlias = "u", designationAlias = "dg") => {
  if (schema.userColumns.has("designation")) {
    return {
      designationSelection: `${userAlias}.designation AS designation`,
      designationJoin: "",
    };
  }

  if (!schema.hasDesignationTable || !schema.userColumns.has("designation_id")) {
    return {
      designationSelection: "NULL AS designation",
      designationJoin: "",
    };
  }

  const designationIdColumn = schema.designationColumns.has("id")
    ? "id"
    : schema.designationColumns.has("designation_id")
      ? "designation_id"
      : null;

  const designationNameColumn = schema.designationColumns.has("name")
    ? "name"
    : schema.designationColumns.has("designation_name")
      ? "designation_name"
      : schema.designationColumns.has("designation")
        ? "designation"
        : null;

  if (!designationIdColumn || !designationNameColumn) {
    return {
      designationSelection: "NULL AS designation",
      designationJoin: "",
    };
  }

  return {
    designationSelection: `${designationAlias}.${designationNameColumn} AS designation`,
    designationJoin: `LEFT JOIN ${schema.designationTableName} ${designationAlias} ON ${designationAlias}.${designationIdColumn} = ${userAlias}.designation_id`,
  };
};

const resolveDesignationId = async (schema, designationValue) => {
  const normalizedDesignation = String(designationValue ?? "").trim();

  if (!normalizedDesignation || !schema.hasDesignationTable || !schema.userColumns.has("designation_id")) {
    return null;
  }

  const designationIdColumn = schema.designationColumns.has("id")
    ? "id"
    : schema.designationColumns.has("designation_id")
      ? "designation_id"
      : null;

  const designationNameColumn = schema.designationColumns.has("name")
    ? "name"
    : schema.designationColumns.has("designation_name")
      ? "designation_name"
      : schema.designationColumns.has("designation")
        ? "designation"
        : null;

  if (!designationIdColumn || !designationNameColumn) {
    return null;
  }

  const [designationRows] = await pool.execute(
    `SELECT ${designationIdColumn} AS id FROM ${schema.designationTableName} WHERE LOWER(${designationNameColumn}) = ? LIMIT 1`,
    [normalizedDesignation.toLowerCase()]
  );

  return designationRows[0]?.id ?? null;
};

const normalizeRoleForStorage = (roleValue) => normalizeUserRole(roleValue);

const resolveRoleId = async (roleValue) => {
  const [roleRows] = await pool.query("SELECT role_id, user_role FROM user_roles");
  const matchedRole = roleRows.find(
    (roleRow) => normalizeUserRole(roleRow.user_role) === normalizeRoleForStorage(roleValue)
  );
  return matchedRole?.role_id ?? null;
};

const resolveDepartmentId = async (schema, departmentName) => {
  if (!schema.hasDepartmentsTable || !departmentName) {
    return null;
  }

  const departmentIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
  const departmentNameColumn = schema.departmentColumns.has("name") ? "name" : "department_name";

  const [departmentRows] = await pool.execute(
    `SELECT ${departmentIdColumn} AS id FROM departments WHERE LOWER(${departmentNameColumn}) = ? LIMIT 1`,
    [String(departmentName).trim().toLowerCase()]
  );

  return departmentRows[0]?.id ?? null;
};

const resolveDepartmentHeadUserId = async (schema, departmentId) => {
  if (!departmentId) {
    return null;
  }

  const userIdColumn = schema.userColumns.has("id") ? "u.id" : "u.user_id";
  const roleSelection = schema.userColumns.has("role")
    ? "u.role AS role"
    : schema.hasUserRolesTable
      ? "ur.user_role AS role"
      : "NULL AS role";
  const roleJoin = !schema.userColumns.has("role") && schema.hasUserRolesTable
    ? "LEFT JOIN user_roles ur ON ur.role_id = u.role_id"
    : "";

  const [rows] = await pool.execute(
    `
      SELECT ${userIdColumn} AS id, ${roleSelection}
      FROM users u
      ${roleJoin}
      WHERE u.department_id = ?
        AND LOWER(COALESCE(u.status, '')) = 'active'
      ORDER BY ${userIdColumn} ASC
    `,
    [departmentId]
  );

  const matchedHod = rows.find((row) => normalizeUserRole(row.role) === "head_of_department");
  return matchedHod?.id ?? null;
};

const getCountValue = async (sql) => {
  const [rows] = await pool.query(sql);
  return Number(rows[0]?.count ?? 0);
};

const getTableColumns = async (tableName) => {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
};

const ensureAccountRequestsTable = async () => {
  await createAccountRequestsTable();
  return getTableColumns("account_requests");
};

const ensureInventoryCreationRequestsTable = async () => {
  await createInventoryCreationRequestsTable();
  const inventoryRequestColumns = await getTableColumns("inventory_creation_requests");

  if (!inventoryRequestColumns.has("request_type")) {
    await pool.query("ALTER TABLE inventory_creation_requests ADD COLUMN request_type VARCHAR(50) DEFAULT 'new_inventory_creation' AFTER id");
    inventoryRequestColumns.add("request_type");
  }

  if (!inventoryRequestColumns.has("location")) {
    await pool.query("ALTER TABLE inventory_creation_requests ADD COLUMN location VARCHAR(255) NULL AFTER name");
    inventoryRequestColumns.add("location");
  }

  if (!inventoryRequestColumns.has("incharge_user_id")) {
    await pool.query("ALTER TABLE inventory_creation_requests ADD COLUMN incharge_user_id INT NULL AFTER requested_by_id");
    inventoryRequestColumns.add("incharge_user_id");
  }

  if (!inventoryRequestColumns.has("hod_user_id")) {
    await pool.query("ALTER TABLE inventory_creation_requests ADD COLUMN hod_user_id INT NULL AFTER incharge_user_id");
    inventoryRequestColumns.add("hod_user_id");
  }

  if (!inventoryRequestColumns.has("admin_approved_date")) {
    await pool.query("ALTER TABLE inventory_creation_requests ADD COLUMN admin_approved_date TIMESTAMP NULL AFTER registrar_approved_by_id");
    inventoryRequestColumns.add("admin_approved_date");
  }

  if (!inventoryRequestColumns.has("admin_approved_by_id")) {
    await pool.query("ALTER TABLE inventory_creation_requests ADD COLUMN admin_approved_by_id INT NULL AFTER admin_approved_date");
    inventoryRequestColumns.add("admin_approved_by_id");
  }

  return inventoryRequestColumns;
};

const ensureInventoriesLocationColumn = async () => {
  const [tableRows] = await pool.query("SHOW TABLES");
  const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));

  if (!tableNames.has("inventories")) {
    return new Set();
  }

  const inventoryColumns = await getTableColumns("inventories");

  if (!inventoryColumns.has("location")) {
    await pool.query("ALTER TABLE inventories ADD COLUMN location VARCHAR(100) DEFAULT '' AFTER description");
    inventoryColumns.add("location");
  }

  return inventoryColumns;
};

const getInventoryIdColumn = (inventoryColumns) => {
  if (inventoryColumns.has("id")) {
    return "id";
  }

  if (inventoryColumns.has("inventory_id")) {
    return "inventory_id";
  }

  return null;
};

const getInventoryNameColumn = (inventoryColumns) => {
  if (inventoryColumns.has("name")) {
    return "name";
  }

  if (inventoryColumns.has("inventory_name")) {
    return "inventory_name";
  }

  return null;
};

const getInventoryInchargeColumn = (inventoryColumns) => {
  if (inventoryColumns.has("incharge_id")) {
    return "incharge_id";
  }

  if (inventoryColumns.has("incharge_user_id")) {
    return "incharge_user_id";
  }

  return null;
};

const getInventoryHodColumn = (inventoryColumns) => {
  if (inventoryColumns.has("hod_user_id")) {
    return "hod_user_id";
  }

  if (inventoryColumns.has("hod_id")) {
    return "hod_id";
  }

  return null;
};

const resolveUserId = async (userValue) => {
  const normalizedUserValue = String(userValue ?? "").trim();

  if (!normalizedUserValue) {
    return null;
  }

  const numericUserId = Number(normalizedUserValue);
  const schema = await getAuthSchema();
  const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
  const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";

  if (Number.isInteger(numericUserId) && numericUserId > 0) {
    const [userRows] = await pool.execute(
      `SELECT ${userIdColumn} AS id FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
      [numericUserId]
    );

    if (userRows[0]?.id) {
      return userRows[0].id;
    }
  }

  const [userRows] = await pool.execute(
    `SELECT ${userIdColumn} AS id FROM users WHERE LOWER(${userNameColumn}) = ? LIMIT 1`,
    [normalizedUserValue.toLowerCase()]
  );

  return userRows[0]?.id ?? null;
};

const withDatabase = (handler) => async (req, res) => {
  if (!dbReady) {
    return res.status(503).json({
      success: false,
      error: "Database is not ready. Check your MySQL connection settings.",
    });
  }

  try {
    return await handler(req, res);
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unexpected server error",
    });
  }
};

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({
      success: true,
      server: "ok",
      database: "ok",
      databaseName: DB_NAME,
      itemsTable: DB_ITEMS_TABLE,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      server: "ok",
      database: "error",
      error: error.message,
    });
  }
});

app.get(
  "/api/users",
  withDatabase(async (_req, res) => {
    const schema = await getAuthSchema();
    const userIdColumn = schema.userColumns.has("id") ? "u.id" : "u.user_id";
    const userNameColumn = schema.userColumns.has("name") ? "u.name" : "u.full_name";
    const roleSelection = schema.userColumns.has("role")
      ? "u.role AS role"
      : schema.hasUserRolesTable
        ? "ur.user_role AS role"
        : "NULL AS role";
    const roleJoin = !schema.userColumns.has("role") && schema.hasUserRolesTable
      ? "LEFT JOIN user_roles ur ON ur.role_id = u.role_id"
      : "";
    const departmentNameColumn = schema.departmentColumns.has("name")
      ? "d.name"
      : schema.departmentColumns.has("department_name")
        ? "d.department_name"
        : "NULL";
    const { designationSelection, designationJoin } = getDesignationQueryParts(schema);
    const departmentJoin = schema.hasDepartmentsTable
      ? `LEFT JOIN departments d ON d.${schema.departmentColumns.has("id") ? "id" : "department_id"} = u.department_id`
      : "";
    const createdDateColumn = schema.userColumns.has("created_date")
      ? "u.created_date"
      : schema.userColumns.has("created_at")
        ? "u.created_at"
        : "NULL";
    const mobileNoColumn = schema.userColumns.has("mobile_no") ? "u.mobile_no" : "NULL";
    const officeExtColumn = schema.userColumns.has("off_ext") ? "u.off_ext" : "NULL";

    const [rows] = await pool.execute(
      `
        SELECT
          ${userIdColumn} AS id,
          ${userNameColumn} AS name,
          u.email,
          ${roleSelection},
          u.status,
          u.department_id,
          ${departmentNameColumn} AS department_name,
          ${designationSelection},
          ${mobileNoColumn} AS mobile_no,
          ${officeExtColumn} AS off_ext,
          ${createdDateColumn} AS created_date
        FROM users u
        ${roleJoin}
        ${departmentJoin}
        ${designationJoin}
        ORDER BY ${createdDateColumn === "NULL" ? "u.email" : createdDateColumn} DESC
      `
    );

    const users = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: normalizeUserRole(row.role),
      department: row.department_name ?? "-",
      designation: row.designation ?? "",
      status: String(row.status ?? "").toLowerCase(),
      mobileNo: row.mobile_no ?? "",
      officeExtNo: row.off_ext ?? "",
      createdDate: row.created_date ? new Date(row.created_date).toISOString().split("T")[0] : "",
    }));

    return res.json({ success: true, users });
  })
);

app.get(
  "/api/departments",
  withDatabase(async (_req, res) => {
    const schema = await getAuthSchema();

    if (!schema.hasDepartmentsTable) {
      return res.json({ success: true, departments: [] });
    }

    const departmentIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
    const departmentNameColumn = schema.departmentColumns.has("name")
      ? "name"
      : schema.departmentColumns.has("department_name")
        ? "department_name"
        : null;
    const departmentStatusColumn = schema.departmentColumns.has("status") ? "status" : null;

    if (!departmentNameColumn) {
      return res.json({ success: true, departments: [] });
    }

    const [rows] = await pool.execute(
      `
        SELECT
          ${departmentIdColumn} AS id,
          ${departmentNameColumn} AS name,
          ${departmentStatusColumn ? `${departmentStatusColumn} AS status` : "NULL AS status"}
        FROM departments
        ORDER BY ${departmentNameColumn} ASC
      `
    );

    const departments = rows
      .filter((row) => !row.status || String(row.status).toLowerCase() === "active")
      .map((row) => ({
        id: row.id,
        name: row.name,
      }));

    return res.json({ success: true, departments });
  })
);

app.get(
  "/api/inventories",
  withDatabase(async (_req, res) => {
    const schema = await getAuthSchema();
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);
    const inventoryHodColumn = getInventoryHodColumn(inventoryColumns);

    if (inventoryColumns.size === 0 || !inventoryIdColumn || !inventoryNameColumn || !inventoryInchargeColumn) {
      return res.json({ success: true, inventories: [] });
    }

    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const itemsTableExists = tableNames.has(DB_ITEMS_TABLE);
    const itemsTableColumns = itemsTableExists ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const hasInventoryItemRelation = itemsTableColumns.has("inventory_id");
    const departmentIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
    const departmentNameColumn = schema.departmentColumns.has("name")
      ? "name"
      : schema.departmentColumns.has("department_name")
        ? "department_name"
        : null;
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const createdDateExpression = inventoryColumns.has("created_date")
      ? "i.created_date"
      : inventoryColumns.has("created_at")
        ? "i.created_at"
        : "NULL";
    const updatedDateExpression = inventoryColumns.has("updated_date")
      ? "i.updated_date"
      : inventoryColumns.has("updated_at")
        ? "i.updated_at"
        : createdDateExpression;
    const itemCountSelection = hasInventoryItemRelation ? "COALESCE(item_counts.item_count, 0) AS item_count" : "0 AS item_count";
    const itemCountJoin = hasInventoryItemRelation
      ? `
        LEFT JOIN (
          SELECT inventory_id, COUNT(*) AS item_count
          FROM ${DB_ITEMS_TABLE}
          GROUP BY inventory_id
        ) item_counts ON item_counts.inventory_id = i.${inventoryIdColumn}
      `
      : "";

    const [rows] = await pool.execute(
      `
        SELECT
          i.${inventoryIdColumn} AS id,
          i.${inventoryNameColumn} AS name,
          i.department_id,
          i.${inventoryInchargeColumn} AS incharge_id,
          ${inventoryColumns.has("description") ? "i.description" : "NULL"} AS description,
          ${inventoryColumns.has("location") ? "i.location" : "''"} AS location,
          ${inventoryColumns.has("status") ? "i.status" : "'active'"} AS status,
          ${createdDateExpression} AS created_date,
          ${updatedDateExpression} AS updated_date,
          ${departmentNameColumn ? `d.${departmentNameColumn}` : "NULL"} AS department_name,
          u.${userNameColumn} AS incharge_name,
          ${inventoryHodColumn ? `hod_u.${userNameColumn}` : "NULL"} AS hod_name,
          ${itemCountSelection}
        FROM inventories i
        LEFT JOIN departments d ON d.${departmentIdColumn} = i.department_id
        LEFT JOIN users u ON u.${userIdColumn} = i.${inventoryInchargeColumn}
        ${inventoryHodColumn ? `LEFT JOIN users hod_u ON hod_u.${userIdColumn} = i.${inventoryHodColumn}` : ""}
        ${itemCountJoin}
        ORDER BY ${updatedDateExpression} DESC, ${createdDateExpression} DESC, i.${inventoryIdColumn} DESC
      `
    );

    const inventories = rows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      department: row.department_name ?? "",
      departmentId: row.department_id ?? null,
      incharge: row.incharge_name ?? "",
      inchargeId: row.incharge_id ?? null,
      hod: row.hod_name ?? "-",
      description: row.description ?? "",
      location: row.location ?? "",
      status: String(row.status ?? "active").toLowerCase(),
      createdDate: row.created_date ? new Date(row.created_date).toISOString().split("T")[0] : "",
      lastUpdated: row.updated_date ? new Date(row.updated_date).toISOString().split("T")[0] : "",
      itemCount: Number(row.item_count ?? 0),
    }));

    return res.json({ success: true, inventories });
  })
);

app.post(
  "/api/inventories",
  withDatabase(async (req, res) => {
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const schema = await getAuthSchema();
    const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);
    const inventoryHodColumn = getInventoryHodColumn(inventoryColumns);
    const name = String(req.body?.name ?? "").trim();
    const departmentName = String(req.body?.department ?? req.body?.departmentName ?? "").trim();
    const inchargeValue = req.body?.inchargeId ?? req.body?.incharge;
    const hodUserId = Number(req.body?.hodUserId ?? 0);
    const description = String(req.body?.description ?? "").trim();
    const location = String(req.body?.location ?? "").trim();

    if (!inventoryNameColumn || !inventoryInchargeColumn) {
      return res.status(500).json({ success: false, error: "Inventory schema is missing required columns." });
    }

    if (!name || !departmentName || !inchargeValue || !location) {
      return res.status(400).json({
        success: false,
        error: "Name, department, in-charge person, and inventory location are required.",
      });
    }

    const departmentId = Number(req.body?.departmentId) > 0
      ? Number(req.body.departmentId)
      : await resolveDepartmentId(schema, departmentName);
    const inchargeId = await resolveUserId(inchargeValue);

    if (!departmentId) {
      return res.status(400).json({ success: false, error: "Selected department was not found." });
    }

    if (!inchargeId) {
      return res.status(400).json({ success: false, error: "Selected in-charge person was not found." });
    }

    const insertColumns = [inventoryNameColumn, "department_id", inventoryInchargeColumn];
    const insertValues = [name, departmentId, inchargeId];

    if (inventoryColumns.has("description")) {
      insertColumns.push("description");
      insertValues.push(description);
    }

    if (inventoryColumns.has("location")) {
      insertColumns.push("location");
      insertValues.push(location);
    }

    if (inventoryHodColumn && Number.isInteger(hodUserId) && hodUserId > 0) {
      insertColumns.push(inventoryHodColumn);
      insertValues.push(hodUserId);
    }

    const placeholders = insertColumns.map(() => "?").join(", ");
    const [result] = await pool.execute(
      `INSERT INTO inventories (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      insertValues
    );

    return res.status(201).json({
      success: true,
      inventory: {
        id: result.insertId,
        name,
        department: departmentName,
        departmentId,
        inchargeId,
        hodUserId: Number.isInteger(hodUserId) && hodUserId > 0 ? hodUserId : null,
        description,
        location,
      },
    });
  })
);

app.put(
  "/api/inventories/:id",
  withDatabase(async (req, res) => {
    const inventoryId = Number(req.params.id);

    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid inventory id." });
    }

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);
    const inventoryHodColumn = getInventoryHodColumn(inventoryColumns);
    const schema = await getAuthSchema();
    if (!inventoryIdColumn || !inventoryNameColumn || !inventoryInchargeColumn) {
      return res.status(500).json({ success: false, error: "Inventory identifier column was not found." });
    }

    const name = String(req.body?.name ?? "").trim();
    const departmentName = String(req.body?.department ?? req.body?.departmentName ?? "").trim();
    const inchargeValue = req.body?.inchargeId ?? req.body?.incharge;
    const hodUserId = Number(req.body?.hodUserId ?? 0);
    const description = String(req.body?.description ?? "").trim();
    const location = String(req.body?.location ?? "").trim();

    if (!name || !departmentName || !inchargeValue || !location) {
      return res.status(400).json({
        success: false,
        error: "Name, department, in-charge person, and inventory location are required.",
      });
    }

    const departmentId = Number(req.body?.departmentId) > 0
      ? Number(req.body.departmentId)
      : await resolveDepartmentId(schema, departmentName);
    const inchargeId = await resolveUserId(inchargeValue);

    if (!departmentId) {
      return res.status(400).json({ success: false, error: "Selected department was not found." });
    }

    if (!inchargeId) {
      return res.status(400).json({ success: false, error: "Selected in-charge person was not found." });
    }

    const updateAssignments = [`${inventoryNameColumn} = ?`, "department_id = ?", `${inventoryInchargeColumn} = ?`];
    const updateValues = [name, departmentId, inchargeId];

    if (inventoryColumns.has("description")) {
      updateAssignments.push("description = ?");
      updateValues.push(description);
    }

    if (inventoryColumns.has("location")) {
      updateAssignments.push("location = ?");
      updateValues.push(location);
    }

    if (inventoryHodColumn) {
      updateAssignments.push(`${inventoryHodColumn} = ?`);
      updateValues.push(Number.isInteger(hodUserId) && hodUserId > 0 ? hodUserId : null);
    }

    updateValues.push(inventoryId);

    const [result] = await pool.execute(
      `UPDATE inventories SET ${updateAssignments.join(", ")} WHERE ${inventoryIdColumn} = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: "Inventory not found." });
    }

    return res.json({
      success: true,
      inventory: {
        id: inventoryId,
        name,
        department: departmentName,
        departmentId,
        inchargeId,
        hodUserId: Number.isInteger(hodUserId) && hodUserId > 0 ? hodUserId : null,
        description,
        location,
      },
    });
  })
);

app.get(
  "/api/dashboard/summary",
  withDatabase(async (_req, res) => {
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const itemsTableExists = tableNames.has(DB_ITEMS_TABLE);
    const inventoryItemColumns = itemsTableExists ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const hasItemStatus = inventoryItemColumns.has("status");

    const totalUsers = tableNames.has("users")
      ? await getCountValue("SELECT COUNT(*) AS count FROM users")
      : 0;
    const activeUsers = tableNames.has("users")
      ? await getCountValue("SELECT COUNT(*) AS count FROM users WHERE LOWER(COALESCE(status, '')) = 'active'")
      : 0;
    const inactiveUsers = Math.max(totalUsers - activeUsers, 0);
    const totalInventories = tableNames.has("inventories")
      ? await getCountValue("SELECT COUNT(*) AS count FROM inventories")
      : 0;
    const totalItems = itemsTableExists
      ? await getCountValue(`SELECT COUNT(*) AS count FROM ${DB_ITEMS_TABLE}`)
      : 0;
    const availableItems = itemsTableExists && hasItemStatus
      ? await getCountValue(
          `SELECT COUNT(*) AS count FROM ${DB_ITEMS_TABLE} WHERE LOWER(COALESCE(status, '')) = 'available'`
        )
      : 0;
    const inUseItems = itemsTableExists && hasItemStatus
      ? await getCountValue(
          `SELECT COUNT(*) AS count FROM ${DB_ITEMS_TABLE} WHERE LOWER(COALESCE(status, '')) IN ('in-use', 'issued')`
        )
      : 0;

    let pendingTasks = inactiveUsers;
    if (tableNames.has("account_requests")) {
      pendingTasks += await getCountValue(
        "SELECT COUNT(*) AS count FROM account_requests WHERE LOWER(COALESCE(approval_status, '')) NOT IN ('approved_by_admin', 'rejected')"
      );
    }
    if (tableNames.has("inventory_creation_requests")) {
      pendingTasks += await getCountValue(
        "SELECT COUNT(*) AS count FROM inventory_creation_requests WHERE LOWER(COALESCE(approval_status, '')) NOT IN ('approved_by_registrar', 'rejected')"
      );
    }

    const pendingRequests = tableNames.has("item_requests")
      ? await getCountValue(
          "SELECT COUNT(*) AS count FROM item_requests WHERE LOWER(COALESCE(approval_status, '')) LIKE 'pending%'"
        )
      : 0;

    return res.json({
      success: true,
      adminSummary: {
        totalUsers,
        activeUsers,
        inventories: totalInventories,
        pendingTasks,
        totalItems,
      },
      inventorySummary: {
        totalAssets: totalItems,
        available: availableItems,
        inUse: inUseItems,
        pendingRequests,
      },
    });
  })
);

app.post(
  "/api/auth/login",
  withDatabase(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required.",
      });
    }

    const schema = await getAuthSchema();
    const userIdColumn = schema.userColumns.has("id") ? "u.id" : "u.user_id";
    const userNameColumn = schema.userColumns.has("name") ? "u.name" : "u.full_name";
    const roleSelection = schema.userColumns.has("role")
      ? "u.role AS role"
      : schema.hasUserRolesTable
        ? "ur.user_role AS role"
        : "NULL AS role";
    const roleJoin = !schema.userColumns.has("role") && schema.hasUserRolesTable
      ? "LEFT JOIN user_roles ur ON ur.role_id = u.role_id"
      : "";
    const departmentNameColumn = schema.departmentColumns.has("name")
      ? "d.name"
      : schema.departmentColumns.has("department_name")
        ? "d.department_name"
        : "NULL";
    const { designationSelection, designationJoin } = getDesignationQueryParts(schema);
    const departmentJoin = schema.hasDepartmentsTable
      ? `LEFT JOIN departments d ON d.${schema.departmentColumns.has("id") ? "id" : "department_id"} = u.department_id`
      : "";

    const [rows] = await pool.execute(
      `
        SELECT
          ${userIdColumn} AS id,
          ${userNameColumn} AS name,
          u.email,
          u.password,
          ${roleSelection},
          u.status,
          u.department_id,
          ${departmentNameColumn} AS department_name,
          ${designationSelection}
        FROM users u
        ${roleJoin}
        ${departmentJoin}
        ${designationJoin}
        WHERE LOWER(u.email) = ?
        LIMIT 1
      `,
      [email]
    );

    if (rows.length === 0 || rows[0].password !== password) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password.",
      });
    }

    const user = rows[0];

    if (String(user.status ?? "").toLowerCase() !== "active") {
      return res.status(403).json({
        success: false,
        error: "Your account is not active yet. Please contact the administrator.",
      });
    }

    if (schema.userColumns.has("last_login")) {
      const idColumnName = schema.userColumns.has("id") ? "id" : "user_id";
      await pool.execute(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE ${idColumnName} = ?`, [
        user.id,
      ]);
    }

    return res.json({
      success: true,
      message: "Login successful! Redirecting...",
      user: buildUserResponse(user),
    });
  })
);

app.post(
  "/api/auth/signup",
  withDatabase(async (req, res) => {
    const fullName = String(req.body?.fullName ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const role = normalizeRoleForStorage(req.body?.role);
    const department = String(req.body?.department ?? "").trim();
    const designation = String(req.body?.designation ?? "").trim();
    const mobileNoRaw = String(req.body?.mobileNo ?? "").trim();
    const officeExtNoRaw = String(req.body?.officeExtNo ?? "").trim();

    if (!fullName || !email || !password || !role || !department) {
      return res.status(400).json({
        success: false,
        error: "Full name, email, password, role, and department are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long.",
      });
    }

    const schema = await getAuthSchema();
    const [existingUserRows] = await pool.execute(
      "SELECT 1 FROM users WHERE LOWER(email) = ? LIMIT 1",
      [email]
    );

    if (existingUserRows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists.",
      });
    }

    const departmentId = await resolveDepartmentId(schema, department);
    if (schema.hasDepartmentsTable && !departmentId) {
      return res.status(400).json({
        success: false,
        error: "Invalid department selected.",
      });
    }

    const designationId = await resolveDesignationId(schema, designation);
    if (designation && schema.userColumns.has("designation_id") && !designationId) {
      return res.status(400).json({
        success: false,
        error: "Invalid designation selected.",
      });
    }

    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const statusValue = schema.hasUserRolesTable ? "Active" : "active";

    const insertColumns = [userNameColumn, "email", "password", "department_id", "status"];
    const insertValues = [fullName, email, password, departmentId, statusValue];

    if (schema.userColumns.has("role")) {
      insertColumns.push("role");
      insertValues.push(role);
    } else if (schema.hasUserRolesTable) {
      const roleId = await resolveRoleId(role);
      if (!roleId) {
        return res.status(400).json({
          success: false,
          error: "Invalid role selected.",
        });
      }
      insertColumns.push("role_id");
      insertValues.push(roleId);
    }

    if (designation && schema.userColumns.has("designation_id") && designationId) {
      insertColumns.push("designation_id");
      insertValues.push(designationId);
    } else if (designation && schema.userColumns.has("designation")) {
      insertColumns.push("designation");
      insertValues.push(designation);
    }

    if (schema.userColumns.has("mobile_no") && mobileNoRaw) {
      const mobileNo = Number(mobileNoRaw);
      if (!Number.isNaN(mobileNo)) {
        insertColumns.push("mobile_no");
        insertValues.push(mobileNo);
      }
    }

    if (schema.userColumns.has("off_ext") && officeExtNoRaw) {
      const officeExtNo = Number(officeExtNoRaw);
      if (!Number.isNaN(officeExtNo)) {
        insertColumns.push("off_ext");
        insertValues.push(officeExtNo);
      }
    }

    const placeholders = insertColumns.map(() => "?").join(", ");
    const [result] = await pool.execute(
      `INSERT INTO users (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      insertValues
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: {
        id: result.insertId,
        name: fullName,
        email,
        role,
        department,
        designation,
      },
    });
  })
);

app.post(
  "/api/items",
  withDatabase(async (req, res) => {
    const item = normalizeItemPayload(req.body);
    const validationError = validateRequiredFields(item);

    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const placeholders = itemColumns.map(() => "?").join(", ");
    const [result] = await pool.execute(
      `INSERT INTO ${DB_ITEMS_TABLE} (${itemColumns.join(", ")}) VALUES (${placeholders})`,
      buildInsertValues(item)
    );

    return res.status(201).json({
      success: true,
      item: { id: result.insertId, ...item },
    });
  })
);

app.post(
  "/api/items/bulk",
  withDatabase(async (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ success: false, error: "Expected an array of items" });
    }

    if (req.body.length === 0) {
      return res.status(400).json({ success: false, error: "No items were provided" });
    }

    const items = req.body.map(normalizeItemPayload);
    const invalidItem = items.find(validateRequiredFields);

    if (invalidItem) {
      return res.status(400).json({ success: false, error: validateRequiredFields(invalidItem) });
    }

    const placeholders = items
      .map(() => `(${itemColumns.map(() => "?").join(", ")})`)
      .join(", ");
    const values = items.flatMap(buildInsertValues);

    const [result] = await pool.execute(
      `INSERT INTO ${DB_ITEMS_TABLE} (${itemColumns.join(", ")}) VALUES ${placeholders}`,
      values
    );

    return res.status(201).json({
      success: true,
      createdCount: result.affectedRows,
    });
  })
);

app.get(
  "/api/items/:id",
  withDatabase(async (req, res) => {
    const itemId = Number(req.params.id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid item id" });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM ${DB_ITEMS_TABLE} WHERE id = ? LIMIT 1`,
      [itemId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Item not found" });
    }

    return res.json({ success: true, item: rows[0] });
  })
);

app.get(
  "/api/profile",
  withDatabase(async (req, res) => {
    const email = String(req.query?.email ?? "").trim().toLowerCase();
    const userId = Number(req.query?.userId ?? 0);

    if (!email && (!Number.isInteger(userId) || userId <= 0)) {
      return res.status(400).json({
        success: false,
        message: "A valid email or userId is required.",
      });
    }

    const schema = await getAuthSchema();
    const userIdColumn = schema.userColumns.has("id") ? "u.id" : "u.user_id";
    const userNameColumn = schema.userColumns.has("name") ? "u.name" : "u.full_name";
    const roleSelection = schema.userColumns.has("role")
      ? "u.role AS role"
      : schema.hasUserRolesTable
        ? "ur.user_role AS role"
        : "NULL AS role";
    const roleJoin = !schema.userColumns.has("role") && schema.hasUserRolesTable
      ? "LEFT JOIN user_roles ur ON ur.role_id = u.role_id"
      : "";
    const departmentNameColumn = schema.departmentColumns.has("name")
      ? "d.name"
      : schema.departmentColumns.has("department_name")
        ? "d.department_name"
        : "NULL";
    const { designationSelection, designationJoin } = getDesignationQueryParts(schema);
    const departmentJoin = schema.hasDepartmentsTable
      ? `LEFT JOIN departments d ON d.${schema.departmentColumns.has("id") ? "id" : "department_id"} = u.department_id`
      : "";
    const mobileNoColumn = schema.userColumns.has("mobile_no") ? "u.mobile_no" : "NULL";
    const officeExtColumn = schema.userColumns.has("off_ext") ? "u.off_ext" : "NULL";
    const whereClause = email ? "LOWER(u.email) = ?" : `${userIdColumn} = ?`;
    const whereValue = email || userId;

    const [rows] = await pool.execute(
      `
        SELECT
          ${userIdColumn} AS id,
          ${userNameColumn} AS name,
          u.email,
          ${roleSelection},
          u.status,
          u.department_id,
          ${departmentNameColumn} AS department_name,
          ${designationSelection},
          ${mobileNoColumn} AS mobile_no,
          ${officeExtColumn} AS off_ext
        FROM users u
        ${roleJoin}
        ${departmentJoin}
        ${designationJoin}
        WHERE ${whereClause}
        LIMIT 1
      `,
      [whereValue]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Profile not found.",
      });
    }

    const user = rows[0];
    return res.json({
      success: true,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: normalizeUserRole(user.role),
        status: String(user.status ?? "").toLowerCase(),
        department: user.department_name ?? "",
        departmentId: user.department_id ?? null,
        designation: user.designation ?? "",
        mobileNo: user.mobile_no ?? "",
        officeExtNo: user.off_ext ?? "",
      },
    });
  })
);

app.put(
  "/api/profile",
  withDatabase(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const userId = Number(req.body?.userId ?? 0);
    const currentPassword = String(req.body?.currentPassword ?? "");
    const nextPassword = String(req.body?.password ?? "");

    if (!email && (!Number.isInteger(userId) || userId <= 0)) {
      return res.status(400).json({
        success: false,
        message: "A valid email or userId is required.",
      });
    }

    if (!currentPassword || !nextPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    const schema = await getAuthSchema();
    const idColumnName = schema.userColumns.has("id") ? "id" : "user_id";
    const whereClause = email ? "LOWER(email) = ?" : `${idColumnName} = ?`;
    const whereValue = email || userId;

    const [rows] = await pool.execute(
      `SELECT ${idColumnName} AS id, password FROM users WHERE ${whereClause} LIMIT 1`,
      [whereValue]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Profile not found.",
      });
    }

    if (String(rows[0].password ?? "") !== currentPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    await pool.execute(`UPDATE users SET password = ? WHERE ${idColumnName} = ?`, [nextPassword, rows[0].id]);

    return res.json({
      success: true,
      message: "Profile updated successfully",
    });
  })
);

app.post(
  "/api/account-requests/deactivation",
  withDatabase(async (req, res) => {
    const schema = await getAuthSchema();
    const accountRequestColumns = await ensureAccountRequestsTable();
    const userId = Number(req.body?.userId ?? 0);
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const name = String(req.body?.name ?? "").trim();
    const role = normalizeUserRole(req.body?.role ?? "staff");
    const departmentName = String(req.body?.department ?? "").trim();
    const requestReason = String(req.body?.reason ?? "").trim();

    if ((!Number.isInteger(userId) || userId <= 0) && !email) {
      return res.status(400).json({ success: false, message: "A valid user is required." });
    }

    const departmentId = await resolveDepartmentId(schema, departmentName);
    const departmentHeadUserId = await resolveDepartmentHeadUserId(schema, departmentId);
    const requestTypeValue = accountRequestColumns.has("request_type") ? "deactivation" : null;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: "A valid department is required for deactivation review." });
    }

    if (!departmentHeadUserId) {
      return res.status(400).json({ success: false, message: "No active Head of Department is assigned to your department." });
    }

    const [existingRows] = await pool.execute(
      `
        SELECT id
        FROM account_requests
        WHERE ${accountRequestColumns.has("user_id") ? "user_id = ?" : "LOWER(email) = ?"}
          AND LOWER(COALESCE(approval_status, '')) NOT IN ('approved_by_admin', 'rejected')
          ${requestTypeValue ? "AND LOWER(COALESCE(request_type, '')) = 'deactivation'" : ""}
        LIMIT 1
      `,
      [accountRequestColumns.has("user_id") ? userId : email]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "A pending deactivation request already exists for this account.",
      });
    }

    const insertColumns = [];
    const insertValues = [];

    if (accountRequestColumns.has("request_type")) {
      insertColumns.push("request_type");
      insertValues.push("deactivation");
    }

    if (accountRequestColumns.has("requested_by_name")) {
      insertColumns.push("requested_by_name");
      insertValues.push(name || email);
    }

    if (accountRequestColumns.has("email")) {
      insertColumns.push("email");
      insertValues.push(email);
    }

    if (accountRequestColumns.has("requested_role")) {
      insertColumns.push("requested_role");
      insertValues.push(role);
    }

    if (accountRequestColumns.has("requested_department_id")) {
      insertColumns.push("requested_department_id");
      insertValues.push(departmentId || null);
    }

    if (accountRequestColumns.has("approval_status")) {
      insertColumns.push("approval_status");
      insertValues.push("pending_dept_head");
    }

    if (accountRequestColumns.has("request_reason")) {
      insertColumns.push("request_reason");
      insertValues.push(requestReason || "Requested from profile page");
    }

    if (accountRequestColumns.has("user_id")) {
      insertColumns.push("user_id");
      insertValues.push(Number.isInteger(userId) && userId > 0 ? userId : null);
    }

    const placeholders = insertColumns.map(() => "?").join(", ");
    const [result] = await pool.execute(
      `INSERT INTO account_requests (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      insertValues
    );

    return res.status(201).json({
      success: true,
      message: "Deactivation request submitted to your Head of Department for review.",
      requestId: result.insertId,
      reviewerUserId: departmentHeadUserId,
    });
  })
);

app.post(
  "/api/inventory-creation-requests",
  withDatabase(async (req, res) => {
    const schema = await getAuthSchema();
    const inventoryRequestColumns = await ensureInventoryCreationRequestsTable();
    const requestedById = Number(req.body?.requestedById ?? 0);
    const requestType = String(req.body?.requestType ?? "new_inventory_creation").trim().toLowerCase();
    const name = String(req.body?.name ?? "").trim();
    const location = String(req.body?.location ?? "").trim();
    const departmentName = String(req.body?.department ?? req.body?.departmentName ?? "").trim();
    const inchargeUserId = Number(req.body?.inchargeId ?? 0);
    const hodUserId = Number(req.body?.hodUserId ?? 0);
    const reason = String(req.body?.description ?? req.body?.reason ?? "").trim();
    const normalizedRequestType = requestType === "add_inventory" ? "add_inventory" : "new_inventory_creation";

    if (!Number.isInteger(requestedById) || requestedById <= 0) {
      return res.status(400).json({ success: false, message: "A valid requesting user is required." });
    }

    if (!name || !location || !departmentName || !Number.isInteger(inchargeUserId) || inchargeUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Name, location, department, and in-charge person are required.",
      });
    }

    const departmentId = await resolveDepartmentId(schema, departmentName);

    if (!departmentId) {
      return res.status(400).json({ success: false, message: "Selected department was not found." });
    }

    const resolvedHodUserId = Number.isInteger(hodUserId) && hodUserId > 0
      ? hodUserId
      : await resolveDepartmentHeadUserId(schema, departmentId);

    if (!resolvedHodUserId) {
      return res.status(400).json({ success: false, message: "No active Head of Department is assigned to the selected department." });
    }

    const insertColumns = ["name", "department_id", "requested_by_id", "approval_status"];
    const insertValues = [name, departmentId, requestedById, "pending_hod"];

    if (inventoryRequestColumns.has("request_type")) {
      insertColumns.push("request_type");
      insertValues.push(normalizedRequestType);
    }

    if (inventoryRequestColumns.has("location")) {
      insertColumns.push("location");
      insertValues.push(location);
    }

    if (inventoryRequestColumns.has("incharge_user_id")) {
      insertColumns.push("incharge_user_id");
      insertValues.push(inchargeUserId);
    }

    if (inventoryRequestColumns.has("hod_user_id")) {
      insertColumns.push("hod_user_id");
      insertValues.push(resolvedHodUserId);
    }

    if (inventoryRequestColumns.has("reason")) {
      insertColumns.push("reason");
      insertValues.push(reason);
    }

    const placeholders = insertColumns.map(() => "?").join(", ");
    const [result] = await pool.execute(
      `INSERT INTO inventory_creation_requests (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      insertValues
    );

    return res.status(201).json({
      success: true,
      message: normalizedRequestType === "add_inventory"
        ? "Inventory addition request submitted to your Head of Department for approval. No further approval is required after HOD approval."
        : "New inventory creation request submitted for HOD review. After HOD approval, it will proceed to registrar and admin approval.",
      requestId: result.insertId,
      requestType: normalizedRequestType,
    });
  })
);

app.use((req, res) => {
  return res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

const startServer = async () => {
  try {
    await pool.query("SELECT 1");
    await ensureInventoriesLocationColumn();
    if (AUTO_CREATE_TABLES) {
      await createAccountRequestsTable();
      await createInventoryCreationRequestsTable();
      await createInventoryItemsTable();
    }
    dbReady = true;
    console.log(`MySQL connected to ${DB_NAME} on ${DB_HOST}:${DB_PORT}`);
    if (AUTO_CREATE_TABLES) {
      console.log(`Ensured table exists: ${DB_ITEMS_TABLE}`);
    }
  } catch (error) {
    dbReady = false;
    console.error("MySQL connection failed:", error.message);
    console.error("Update your .env file and restart the server.");
  }

  app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
  });
};

startServer();
