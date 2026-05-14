import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import multer from "multer";
import { parse as csvParse } from "csv-parse/sync";

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

const corsOrigin = (origin, callback) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  if (origin === CLIENT_ORIGIN) {
    callback(null, true);
    return;
  }

  try {
    const url = new URL(origin);
    const isLocalDevHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";

    if (isLocalDevHost) {
      callback(null, true);
      return;
    }
  } catch {
    // Ignore malformed origins and reject below.
  }

  callback(new Error(`CORS blocked for origin: ${origin}`));
};

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// Ensure uploads directory exists
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedItemImageTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];

    if (file.fieldname === "itemImage") {
      if (allowedItemImageTypes.includes(file.mimetype) || file.mimetype.startsWith("image/")) {
        return cb(null, true);
      }
      return cb(new Error("Item Image must be a PDF or image file."));
    }

    if (file.fieldname === "ginfile") {
      if (file.mimetype === "application/pdf") {
        return cb(null, true);
      }
      return cb(new Error("GIN PDF must be a PDF file."));
    }

    cb(null, false);
  },
});

const itemColumns = [
  "inventory_id",
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
  inventory_id: Number(payload.inventoryId ?? payload.inventory_id ?? 0) > 0
    ? Number(payload.inventoryId ?? payload.inventory_id)
    : null,
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
    `
  );
};

const ensureInventoryItemsColumns = async () => {
  const [tableRows] = await pool.query("SHOW TABLES");
  const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));

  if (!tableNames.has(DB_ITEMS_TABLE)) {
    await createInventoryItemsTable();
  }

  const inventoryItemColumns = await getTableColumns(DB_ITEMS_TABLE);
  const expectedColumns = {
    inventory_id: "INT NULL",
    itemName: "VARCHAR(255) DEFAULT ''",
    itemCode: "VARCHAR(255) DEFAULT ''",
    serialNo: "VARCHAR(255) DEFAULT ''",
    serialNo2: "VARCHAR(255) DEFAULT ''",
    model: "VARCHAR(255) DEFAULT ''",
    QRCode: "VARCHAR(255) DEFAULT ''",
    QRCode2: "VARCHAR(255) DEFAULT ''",
    pageno: "VARCHAR(100) DEFAULT ''",
    itemImage: "VARCHAR(255) DEFAULT ''",
    value: "DECIMAL(12, 2) NULL",
    purchaseDate: "DATE NULL",
    ginNo: "VARCHAR(255) DEFAULT ''",
    ginfile: "VARCHAR(255) DEFAULT ''",
    poNo: "VARCHAR(255) DEFAULT ''",
    supplier: "VARCHAR(255) DEFAULT ''",
    funding: "VARCHAR(255) DEFAULT ''",
    receivedfrom: "VARCHAR(255) DEFAULT ''",
    warranty: "VARCHAR(255) DEFAULT ''",
    location: "VARCHAR(255) DEFAULT ''",
    remarks: "TEXT",
    qrcodeUrl: "TEXT",
    qrcode2Url: "TEXT",
  };

  for (const [column, definition] of Object.entries(expectedColumns)) {
    if (!inventoryItemColumns.has(column)) {
      await pool.query(`ALTER TABLE ${DB_ITEMS_TABLE} ADD COLUMN ${column} ${definition}`);
      inventoryItemColumns.add(column);
    }
  }

  return inventoryItemColumns;
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
    `
  );
};

const ensureAccountRequestsColumns = async () => {
  try {
    // Check if dept_head_approved_by_id column exists
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM account_requests LIKE 'dept_head_approved_by_id'"
    );
    if (columns.length === 0) {
      await pool.query(
        "ALTER TABLE account_requests ADD COLUMN dept_head_approved_by_id INT NULL"
      );
      console.log("Added dept_head_approved_by_id column to account_requests table");
    }
  } catch (error) {
    console.error("Error ensuring account_requests columns:", error.message);
  }
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
        approval_status VARCHAR(50) DEFAULT 'pending_staff',
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

const buildUserResponse = (user, options = {}) => ({
  id: user.id ?? user.user_id ?? null,
  name: user.name ?? user.full_name ?? "",
  email: user.email,
  role: normalizeUserRole(options.role ?? user.role ?? user.user_role),
  status: String(user.status ?? "").toLowerCase(),
  departmentId: user.department_id ?? null,
  departmentName: user.department_name ?? null,
  designation: user.designation ?? "",
  assignedInventoryCount: Number(options.assignedInventoryCount ?? user.assigned_inventory_count ?? 0),
});

const getInventoryAssignmentCounts = async () => {
  const [tableRows] = await pool.query("SHOW TABLES");
  const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));

  if (!tableNames.has("inventories")) {
    return new Map();
  }

  const inventoryColumns = await getTableColumns("inventories");
  const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

  if (!inventoryInchargeColumn) {
    return new Map();
  }

  const [rows] = await pool.execute(
    `
      SELECT ${inventoryInchargeColumn} AS user_id, COUNT(*) AS inventory_count
      FROM inventories
      WHERE ${inventoryInchargeColumn} IS NOT NULL
      GROUP BY ${inventoryInchargeColumn}
    `
  );

  return new Map(rows.map((row) => [Number(row.user_id), Number(row.inventory_count ?? 0)]));
};

const resolveEffectiveRole = (roleValue, assignedInventoryCount = 0) => {
  const normalizedRole = normalizeUserRole(roleValue);
  const normalizedInventoryCount = Number(assignedInventoryCount ?? 0);

  if (normalizedRole === "staff" && normalizedInventoryCount > 0) {
    return "inventory_incharge";
  }

  if (normalizedRole === "inventory_incharge" && normalizedInventoryCount <= 0) {
    return "staff";
  }

  return normalizedRole;
};

const getEffectiveUserRoleDetails = async (userId, roleValue, assignmentCounts = null) => {
  const normalizedUserId = Number(userId ?? 0);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return {
      assignedInventoryCount: 0,
      role: resolveEffectiveRole(roleValue, 0),
    };
  }

  const resolvedAssignmentCounts = assignmentCounts ?? await getInventoryAssignmentCounts();
  const assignedInventoryCount = Number(resolvedAssignmentCounts.get(normalizedUserId) ?? 0);

  return {
    assignedInventoryCount,
    role: resolveEffectiveRole(roleValue, assignedInventoryCount),
  };
};

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

const getDesignationIdColumn = (schema) =>
  schema.designationColumns.has("id")
    ? "id"
    : schema.designationColumns.has("designation_id")
      ? "designation_id"
      : null;

const getDesignationNameColumn = (schema) =>
  schema.designationColumns.has("name")
    ? "name"
    : schema.designationColumns.has("designation_name")
      ? "designation_name"
      : schema.designationColumns.has("designation")
        ? "designation"
        : null;

const resolveDesignationId = async (schema, designationValue) => {
  const normalizedDesignation = String(designationValue ?? "").trim();

  if (!normalizedDesignation || !schema.hasDesignationTable || !schema.userColumns.has("designation_id")) {
    return null;
  }

  const designationIdColumn = getDesignationIdColumn(schema);
  const designationNameColumn = getDesignationNameColumn(schema);

  if (!designationIdColumn || !designationNameColumn) {
    return null;
  }

  const [designationRows] = await pool.execute(
    `SELECT ${designationIdColumn} AS id FROM ${schema.designationTableName} WHERE LOWER(${designationNameColumn}) = ? LIMIT 1`,
    [normalizedDesignation.toLowerCase()]
  );

  if (designationRows[0]?.id) {
    return designationRows[0].id;
  }

  const [insertResult] = await pool.execute(
    `INSERT INTO ${schema.designationTableName} (${designationNameColumn}) VALUES (?)`,
    [normalizedDesignation]
  );

  if (insertResult?.insertId) {
    return insertResult.insertId;
  }

  const [newDesignationRows] = await pool.execute(
    `SELECT ${designationIdColumn} AS id FROM ${schema.designationTableName} WHERE LOWER(${designationNameColumn}) = ? LIMIT 1`,
    [normalizedDesignation.toLowerCase()]
  );

  return newDesignationRows[0]?.id ?? null;
};

const normalizeRoleForStorage = (roleValue) => normalizeUserRole(roleValue);

const getSignupStoredRole = (requestedRole) => {
  const normalizedRole = normalizeRoleForStorage(requestedRole);

  return normalizedRole === "admin" ? "admin" : "staff";
};

const getSignupStoredStatus = (schema, requestedRole) => {
  const normalizedRole = normalizeRoleForStorage(requestedRole);
  const isActive = normalizedRole === "admin";

  if (schema.hasUserRolesTable) {
    return isActive ? "Active" : "Inactive";
  }

  return isActive ? "active" : "inactive";
};

const resolveRoleId = async (roleValue) => {
  const [roleRows] = await pool.query("SELECT role_id, user_role FROM user_roles");
  const matchedRole = roleRows.find(
    (roleRow) => normalizeUserRole(roleRow.user_role) === normalizeRoleForStorage(roleValue)
  );
  return matchedRole?.role_id ?? null;
};

const updateStoredUserRole = async (schema, userId, roleValue) => {
  const normalizedRole = normalizeRoleForStorage(roleValue);
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0 || !normalizedRole) {
    return false;
  }

  const idColumnName = schema.userColumns.has("id") ? "id" : "user_id";

  if (schema.userColumns.has("role")) {
    await pool.execute(`UPDATE users SET role = ? WHERE ${idColumnName} = ?`, [normalizedRole, normalizedUserId]);
    return true;
  }

  if (schema.hasUserRolesTable) {
    const roleId = await resolveRoleId(normalizedRole);

    if (!roleId) {
      return false;
    }

    await pool.execute(`UPDATE users SET role_id = ? WHERE ${idColumnName} = ?`, [roleId, normalizedUserId]);
    return true;
  }

  return false;
};

const updateStoredUserStatus = async (schema, userId, nextStatus) => {
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0 || !schema.userColumns.has("status")) {
    return;
  }

  const idColumnName = schema.userColumns.has("id") ? "id" : "user_id";
  await pool.execute(`UPDATE users SET status = ? WHERE ${idColumnName} = ?`, [nextStatus, normalizedUserId]);
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

const resolveDeanUserId = async (schema) => {
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
      WHERE LOWER(COALESCE(u.status, '')) = 'active'
      ORDER BY ${userIdColumn} ASC
    `
  );

  const matchedDean = rows.find((row) => normalizeUserRole(row.role) === "dean");
  return matchedDean?.id ?? null;
};

const findExistingRoleAccount = async (schema, roleValue, departmentId = null) => {
  const normalizedRole = normalizeRoleForStorage(roleValue);

  if (!normalizedRole) {
    return null;
  }

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
  const whereClauses = ["LOWER(COALESCE(u.status, '')) IN ('active', 'inactive')"];
  const params = [];

  if (normalizedRole === "head_of_department") {
    whereClauses.push("u.department_id <=> ?");
    params.push(departmentId ?? null);
  }

  const [rows] = await pool.execute(
    `
      SELECT ${userIdColumn} AS id, ${userNameColumn} AS name, u.email, u.department_id, ${roleSelection}
      FROM users u
      ${roleJoin}
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY ${userIdColumn} ASC
    `,
    params
  );

  return rows.find((row) => normalizeUserRole(row.role) === normalizedRole) ?? null;
};

const getPendingAccountStatusMessage = (approvalStatus, requestedRole) => {
  const normalizedStatus = String(approvalStatus || "").toLowerCase();
  const normalizedRole = normalizeRoleForStorage(requestedRole || "staff");

  const statusMessages = {
    pending_dept_head: `Your ${normalizedRole.replace(/_/g, " ")} request is waiting for HOD approval.`,
    pending_dean: `Your ${normalizedRole.replace(/_/g, " ")} request is waiting for dean approval.`,
    pending_admin: `Your ${normalizedRole.replace(/_/g, " ")} request is waiting for admin activation.`,
  };

  return statusMessages[normalizedStatus] || "Your account is not active yet. Please contact the administrator.";
};

const hasPendingRoleRequest = async (userId, requestedRole) => {
  const normalizedUserId = Number(userId);
  const normalizedRole = normalizeRoleForStorage(requestedRole);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0 || !normalizedRole) {
    return false;
  }

  const [rows] = await pool.execute(
    `
      SELECT id
      FROM account_requests
      WHERE user_id = ?
        AND LOWER(COALESCE(request_type, 'account_creation')) = 'account_creation'
        AND LOWER(COALESCE(requested_role, '')) = ?
        AND LOWER(COALESCE(approval_status, '')) NOT IN ('approved_by_admin', 'rejected')
      LIMIT 1
    `,
    [normalizedUserId, normalizedRole]
  );

  return rows.length > 0;
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
  const accountRequestColumns = await getTableColumns("account_requests");

  if (!accountRequestColumns.has("requested_password")) {
    await pool.query("ALTER TABLE account_requests ADD COLUMN requested_password VARCHAR(255) NULL AFTER requested_department_id");
    accountRequestColumns.add("requested_password");
  }

  if (!accountRequestColumns.has("requested_designation")) {
    await pool.query("ALTER TABLE account_requests ADD COLUMN requested_designation VARCHAR(255) NULL AFTER requested_password");
    accountRequestColumns.add("requested_designation");
  }

  if (!accountRequestColumns.has("requested_mobile_no")) {
    await pool.query("ALTER TABLE account_requests ADD COLUMN requested_mobile_no VARCHAR(50) NULL AFTER requested_designation");
    accountRequestColumns.add("requested_mobile_no");
  }

  if (!accountRequestColumns.has("requested_off_ext")) {
    await pool.query("ALTER TABLE account_requests ADD COLUMN requested_off_ext VARCHAR(50) NULL AFTER requested_mobile_no");
    accountRequestColumns.add("requested_off_ext");
  }

  if (!accountRequestColumns.has("dean_approved_date")) {
    await pool.query("ALTER TABLE account_requests ADD COLUMN dean_approved_date TIMESTAMP NULL AFTER dept_head_approved_by_id");
    accountRequestColumns.add("dean_approved_date");
  }

  if (!accountRequestColumns.has("dean_approved_by_id")) {
    await pool.query("ALTER TABLE account_requests ADD COLUMN dean_approved_by_id INT NULL AFTER dean_approved_date");
    accountRequestColumns.add("dean_approved_by_id");
  }

  return accountRequestColumns;
};

const ensureInventoryCreationRequestsTable = async () => {
  await createInventoryCreationRequestsTable();
  const inventoryRequestColumns = await getTableColumns("inventory_creation_requests");

  if (!inventoryRequestColumns.has("request_type")) {
    const afterClause = inventoryRequestColumns.has("id") ? "AFTER id" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN request_type VARCHAR(50) DEFAULT 'new_inventory_creation' ${afterClause}`);
    inventoryRequestColumns.add("request_type");
  }

  if (!inventoryRequestColumns.has("name")) {
    const afterClause = inventoryRequestColumns.has("request_type") ? "AFTER request_type" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN name VARCHAR(255) NULL ${afterClause}`);
    inventoryRequestColumns.add("name");
  }

  if (!inventoryRequestColumns.has("department_id")) {
    const afterClause = inventoryRequestColumns.has("name") ? "AFTER name" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN department_id INT NULL ${afterClause}`);
    inventoryRequestColumns.add("department_id");
  }

  if (!inventoryRequestColumns.has("requested_by_id")) {
    const afterClause = inventoryRequestColumns.has("department_id") ? "AFTER department_id" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN requested_by_id INT NULL ${afterClause}`);
    inventoryRequestColumns.add("requested_by_id");
  }

  if (!inventoryRequestColumns.has("approval_status")) {
    const afterClause = inventoryRequestColumns.has("reason") ? "AFTER reason" : inventoryRequestColumns.has("requested_date") ? "AFTER requested_date" : inventoryRequestColumns.has("requested_by_id") ? "AFTER requested_by_id" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN approval_status VARCHAR(50) DEFAULT 'pending_staff' ${afterClause}`);
    inventoryRequestColumns.add("approval_status");
  }

  if (!inventoryRequestColumns.has("location")) {
    const afterClause = inventoryRequestColumns.has("name") ? "AFTER name" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN location VARCHAR(255) NULL ${afterClause}`);
    inventoryRequestColumns.add("location");
  }

  if (!inventoryRequestColumns.has("incharge_user_id")) {
    const afterClause = inventoryRequestColumns.has("requested_by_id") ? "AFTER requested_by_id" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN incharge_user_id INT NULL ${afterClause}`);
    inventoryRequestColumns.add("incharge_user_id");
  }

  if (!inventoryRequestColumns.has("hod_user_id")) {
    const afterClause = inventoryRequestColumns.has("incharge_user_id") ? "AFTER incharge_user_id" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN hod_user_id INT NULL ${afterClause}`);
    inventoryRequestColumns.add("hod_user_id");
  }

  if (!inventoryRequestColumns.has("admin_approved_date")) {
    const afterClause = inventoryRequestColumns.has("registrar_approved_by_id") ? "AFTER registrar_approved_by_id" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN admin_approved_date TIMESTAMP NULL ${afterClause}`);
    inventoryRequestColumns.add("admin_approved_date");
  }

  if (!inventoryRequestColumns.has("admin_approved_by_id")) {
    const afterClause = inventoryRequestColumns.has("admin_approved_date") ? "AFTER admin_approved_date" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN admin_approved_by_id INT NULL ${afterClause}`);
    inventoryRequestColumns.add("admin_approved_by_id");
  }

  return inventoryRequestColumns;
};

const getOutstandingReturnSummary = async (userId) => {
  if (!Number.isInteger(userId) || userId <= 0) {
    return { count: 0, sampleItems: [] };
  }

  const [tableRows] = await pool.query("SHOW TABLES");
  const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));

  if (!tableNames.has("item_requests")) {
    return { count: 0, sampleItems: [] };
  }

  const itemRequestColumns = await getTableColumns("item_requests");

  if (!itemRequestColumns.has("requested_by_id")) {
    return { count: 0, sampleItems: [] };
  }

  const returnDateColumns = ["returned_date", "return_date", "returned_at", "actual_return_date"];
  const returnStatusColumns = ["return_status", "issue_status", "status"];
  const existingReturnDateColumns = returnDateColumns.filter((column) => itemRequestColumns.has(column));
  const existingReturnStatusColumns = returnStatusColumns.filter((column) => itemRequestColumns.has(column));

  const outstandingConditions = ["requested_by_id = ?"];
  const queryParams = [userId];

  if (itemRequestColumns.has("approval_status")) {
    outstandingConditions.push("LOWER(COALESCE(approval_status, '')) = 'approved'");
  }

  if (itemRequestColumns.has("allocated_date")) {
    outstandingConditions.push("allocated_date IS NOT NULL");
  } else if (itemRequestColumns.has("allocated_quantity")) {
    outstandingConditions.push("COALESCE(allocated_quantity, 0) > 0");
  } else if (itemRequestColumns.has("allocated_inventory_id")) {
    outstandingConditions.push("allocated_inventory_id IS NOT NULL");
  }

  if (existingReturnDateColumns.length > 0) {
    outstandingConditions.push(
      existingReturnDateColumns.map((column) => `${column} IS NULL`).join(" AND ")
    );
  }

  if (existingReturnStatusColumns.length > 0) {
    outstandingConditions.push(
      existingReturnStatusColumns
        .map((column) => `LOWER(COALESCE(${column}, '')) NOT IN ('returned', 'completed', 'closed')`)
        .join(" AND ")
    );
  }

  const itemNameSelection = itemRequestColumns.has("item_name") ? "item_name" : "CAST(id AS CHAR)";
  const orderingColumns = ["allocated_date", "created_date", "requested_date"].filter((column) =>
    itemRequestColumns.has(column)
  );
  const orderByClause = orderingColumns.length > 0
    ? `${orderingColumns.map((column) => `${column} DESC`).join(", ")}, id DESC`
    : "id DESC";
  const whereClause = outstandingConditions.join(" AND ");

  const [countRows] = await pool.execute(
    `
      SELECT COUNT(*) AS count
      FROM item_requests
      WHERE ${whereClause}
    `,
    queryParams
  );
  const [rows] = await pool.execute(
    `
      SELECT id, ${itemNameSelection} AS item_name
      FROM item_requests
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT 5
    `,
    queryParams
  );

  return {
    count: Number(countRows[0]?.count ?? 0),
    sampleItems: rows.map((row) => String(row.item_name ?? row.id ?? "Item")).filter(Boolean),
  };
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

const syncInventoryInchargeRole = async (userId, assignmentCounts = null) => {
  const normalizedUserId = Number(userId ?? 0);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return null;
  }

  const schema = await getAuthSchema();
  const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
  const roleSelection = schema.userColumns.has("role")
    ? "role"
    : schema.hasUserRolesTable
      ? "role_id"
      : null;

  if (!roleSelection) {
    return null;
  }

  const roleQuerySelection = schema.userColumns.has("role")
    ? "role AS role"
    : "role_id AS role";
  const [rows] = await pool.execute(
    `SELECT ${roleQuerySelection} FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
    [normalizedUserId]
  );

  if (rows.length === 0) {
    return null;
  }

  let currentRole = rows[0].role;
  if (!schema.userColumns.has("role") && schema.hasUserRolesTable) {
    const [roleRows] = await pool.execute("SELECT user_role FROM user_roles WHERE role_id = ? LIMIT 1", [currentRole]);
    currentRole = roleRows[0]?.user_role ?? null;
  }

  const roleDetails = await getEffectiveUserRoleDetails(normalizedUserId, currentRole, assignmentCounts);
  const nextRole = roleDetails.role;
  const normalizedCurrentRole = normalizeUserRole(currentRole);

  if (nextRole === normalizedCurrentRole) {
    return roleDetails;
  }

  if (schema.userColumns.has("role")) {
    await pool.execute(`UPDATE users SET role = ? WHERE ${userIdColumn} = ?`, [nextRole, normalizedUserId]);
  } else if (schema.hasUserRolesTable) {
    const nextRoleId = await resolveRoleId(nextRole);
    if (nextRoleId) {
      await pool.execute(`UPDATE users SET role_id = ? WHERE ${userIdColumn} = ?`, [nextRoleId, normalizedUserId]);
    }
  }

  return roleDetails;
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
  "/api/inventory-creation-requests",
  withDatabase(async (req, res) => {
    const inventoryRequestColumns = await ensureInventoryCreationRequestsTable();
    const schema = await getAuthSchema();
    const hodUserId = Number(req.query?.hodUserId ?? 0);
    const departmentIdFilter = Number(req.query?.departmentId ?? 0);
    const approvalStatusFilter = String(req.query?.approvalStatus ?? "").trim().toLowerCase();

    if (!inventoryRequestColumns.has("hod_user_id") || !Number.isInteger(hodUserId) || hodUserId <= 0) {
      return res.json({ success: true, requests: [] });
    }

    const departmentJoinIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
    const departmentNameColumn = schema.departmentColumns.has("name")
      ? "d.name"
      : schema.departmentColumns.has("department_name")
        ? "d.department_name"
        : "NULL";
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";

    const whereParts = ["icr.hod_user_id = ?"];
    const params = [hodUserId];

    if (Number.isInteger(departmentIdFilter) && departmentIdFilter > 0 && inventoryRequestColumns.has("department_id")) {
      whereParts.push("icr.department_id = ?");
      params.push(departmentIdFilter);
    }

    if (approvalStatusFilter && inventoryRequestColumns.has("approval_status")) {
      whereParts.push("LOWER(COALESCE(icr.approval_status, '')) = ?");
      params.push(approvalStatusFilter);
    }

    const requestedDateCol = inventoryRequestColumns.has("requested_date") ? "icr.requested_date" : "icr.created_date";
    const nameCol = inventoryRequestColumns.has("name") ? "icr.name" : "''";
    const locationCol = inventoryRequestColumns.has("location") ? "icr.location" : "NULL";
    const reasonCol = inventoryRequestColumns.has("reason") ? "icr.reason" : "NULL";
    const requestTypeCol = inventoryRequestColumns.has("request_type") ? "icr.request_type" : "'new_inventory_creation'";
    const statusCol = inventoryRequestColumns.has("approval_status") ? "icr.approval_status" : "'pending_staff'";
    const deptIdCol = inventoryRequestColumns.has("department_id") ? "icr.department_id" : "NULL";
    const requestedByCol = inventoryRequestColumns.has("requested_by_id") ? "icr.requested_by_id" : "NULL";
    const inchargeCol = inventoryRequestColumns.has("incharge_user_id") ? "icr.incharge_user_id" : "NULL";

    const departmentJoin = schema.hasDepartmentsTable && inventoryRequestColumns.has("department_id")
      ? `LEFT JOIN departments d ON d.${departmentJoinIdColumn} = icr.department_id`
      : "";
    const requesterJoin = inventoryRequestColumns.has("requested_by_id")
      ? `LEFT JOIN users rb ON rb.${userIdColumn} = icr.requested_by_id`
      : "";
    const inchargeJoin = inventoryRequestColumns.has("incharge_user_id")
      ? `LEFT JOIN users inch ON inch.${userIdColumn} = icr.incharge_user_id`
      : "";

    const departmentNameSelect =
      schema.hasDepartmentsTable && inventoryRequestColumns.has("department_id")
        ? `${departmentNameColumn} AS department_name`
        : "NULL AS department_name";

    const requestedByNameSelect = inventoryRequestColumns.has("requested_by_id")
      ? `rb.${userNameColumn} AS requested_by_name`
      : "NULL AS requested_by_name";
    const inchargeNameSelect = inventoryRequestColumns.has("incharge_user_id")
      ? `inch.${userNameColumn} AS incharge_name`
      : "NULL AS incharge_name";

    const [rows] = await pool.execute(
      `
        SELECT
          icr.id,
          ${nameCol} AS name,
          ${locationCol} AS location,
          ${deptIdCol} AS department_id,
          ${departmentNameSelect},
          ${requestedByCol} AS requested_by_id,
          ${inchargeCol} AS incharge_user_id,
          ${requestedByNameSelect},
          ${inchargeNameSelect},
          ${requestTypeCol} AS request_type,
          ${statusCol} AS approval_status,
          ${reasonCol} AS reason,
          ${requestedDateCol} AS requested_date
        FROM inventory_creation_requests icr
        ${departmentJoin}
        ${requesterJoin}
        ${inchargeJoin}
        WHERE ${whereParts.join(" AND ")}
        ORDER BY ${requestedDateCol} DESC, icr.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      requests: rows.map((row) => ({
        id: row.id,
        name: row.name || "",
        location: row.location || "",
        departmentId: row.department_id ?? null,
        department: row.department_name || "-",
        requestType: String(row.request_type || "new_inventory_creation").toLowerCase(),
        approvalStatus: String(row.approval_status || "pending_staff").toLowerCase(),
        requestedDate: row.requested_date ? new Date(row.requested_date).toISOString().split("T")[0] : "",
        requestedById: row.requested_by_id ?? null,
        requestedByName: row.requested_by_name || "-",
        inchargeUserId: row.incharge_user_id ?? null,
        inchargeName: row.incharge_name || "-",
        reason: row.reason || "",
      })),
    });
  })
);

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

    const lastLoginColumn = schema.userColumns.has("last_login") ? "u.last_login" : "NULL";

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
          ${createdDateColumn} AS created_date,
          ${lastLoginColumn} AS last_login
        FROM users u
        ${roleJoin}
        ${departmentJoin}
        ${designationJoin}
        ORDER BY ${createdDateColumn === "NULL" ? "u.email" : createdDateColumn} DESC
      `
    );

    const assignmentCounts = await getInventoryAssignmentCounts();
    const users = rows.map((row) => {
      const roleDetails = {
        assignedInventoryCount: Number(assignmentCounts.get(Number(row.id)) ?? 0),
      };
      roleDetails.role = resolveEffectiveRole(row.role, roleDetails.assignedInventoryCount);

      return {
      id: row.id,
      name: row.name,
      email: row.email,
        role: roleDetails.role,
      department: row.department_name ?? "-",
      designation: row.designation ?? "",
      status: String(row.status ?? "").toLowerCase(),
      mobileNo: row.mobile_no ?? "",
      officeExtNo: row.off_ext ?? "",
      assignedInventoryCount: roleDetails.assignedInventoryCount,
      createdDate: row.created_date ? new Date(row.created_date).toISOString().split("T")[0] : "",
      lastLogin: row.last_login ? new Date(row.last_login).toISOString() : null,
      };
    });

    return res.json({ success: true, users });
  })
);

app.get(
  "/api/account-requests",
  withDatabase(async (req, res) => {
    const accountRequestColumns = await ensureAccountRequestsTable();
    const schema = await getAuthSchema();
    const requestTypeParam = String(req.query?.requestType ?? "account_creation").trim().toLowerCase();
    const typeList = requestTypeParam.split(",").map((t) => t.trim()).filter(Boolean);
    const requestTypes = typeList.length > 0 ? typeList : ["account_creation"];
    const requestedRoleFilter = String(req.query?.requestedRole ?? "").trim().toLowerCase();
    const statusFilter = String(req.query?.status ?? "").trim().toLowerCase();
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
      ? `LEFT JOIN departments d ON d.${schema.departmentColumns.has("id") ? "id" : "department_id"} = ar.requested_department_id`
      : "";
    const userJoin = accountRequestColumns.has("user_id")
      ? `LEFT JOIN users u ON u.${schema.userColumns.has("id") ? "id" : "user_id"} = ar.user_id`
      : "LEFT JOIN users u ON LOWER(u.email) = LOWER(ar.email)";
    const deptHeadJoin = accountRequestColumns.has("dept_head_approved_by_id")
      ? `LEFT JOIN users dh ON dh.${schema.userColumns.has("id") ? "id" : "user_id"} = ar.dept_head_approved_by_id`
      : "";
    const createdDateColumn = accountRequestColumns.has("created_date") ? "ar.created_date" : "ar.requested_date";
    let requestTypeCondition;
    const queryParams = [];
    if (accountRequestColumns.has("request_type")) {
      if (requestTypes.length === 1) {
        requestTypeCondition = "LOWER(COALESCE(ar.request_type, 'account_creation')) = ?";
        queryParams.push(requestTypes[0]);
      } else {
        requestTypeCondition = `LOWER(COALESCE(ar.request_type, 'account_creation')) IN (${requestTypes.map(() => "?").join(", ")})`;
        queryParams.push(...requestTypes);
      }
    } else {
      requestTypeCondition = "? = 'account_creation'";
      queryParams.push("account_creation");
    }
    const whereClauses = [requestTypeCondition];

    if (requestedRoleFilter && accountRequestColumns.has("requested_role")) {
      whereClauses.push("LOWER(COALESCE(ar.requested_role, '')) = ?");
      queryParams.push(requestedRoleFilter);
    }

    if (statusFilter && accountRequestColumns.has("approval_status")) {
      whereClauses.push("LOWER(COALESCE(ar.approval_status, '')) = ?");
      queryParams.push(statusFilter);
    }

    const [rows] = await pool.execute(
      `
        SELECT
          ar.id,
          ${accountRequestColumns.has("request_type") ? "ar.request_type" : "'account_creation'"} AS request_type,
          ${accountRequestColumns.has("requested_by_name") ? "ar.requested_by_name" : "NULL"} AS requested_by_name,
          ${accountRequestColumns.has("email") ? "ar.email" : "u.email"} AS email,
          ${accountRequestColumns.has("requested_role") ? "ar.requested_role" : "NULL"} AS requested_role,
          ${accountRequestColumns.has("approval_status") ? "ar.approval_status" : "'pending_dept_head'"} AS approval_status,
          ${accountRequestColumns.has("requested_date") ? "ar.requested_date" : createdDateColumn} AS requested_date,
          ${accountRequestColumns.has("requested_designation") ? "ar.requested_designation" : "NULL"} AS requested_designation,
          ${accountRequestColumns.has("requested_mobile_no") ? "ar.requested_mobile_no" : "NULL"} AS requested_mobile_no,
          ${accountRequestColumns.has("requested_off_ext") ? "ar.requested_off_ext" : "NULL"} AS requested_off_ext,
          ${accountRequestColumns.has("user_id") ? "ar.user_id" : "NULL"} AS user_id,
          ${userIdColumn} AS linked_user_id,
          ${userNameColumn} AS linked_user_name,
          ${roleSelection},
          ${departmentNameColumn} AS department_name,
          ${designationSelection},
          u.status,
          ${accountRequestColumns.has("dept_head_approved_by_id") ? `dh.${schema.userColumns.has("name") ? "name" : "full_name"}` : "NULL"} AS dept_head_approver_name
        FROM account_requests ar
        ${userJoin}
        ${roleJoin}
        ${departmentJoin}
        ${designationJoin}
        ${deptHeadJoin}
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY ${createdDateColumn} DESC, ar.id DESC
      `,
      queryParams
    );

    return res.json({
      success: true,
      requests: rows.map((row) => ({
        id: row.id,
        requestType: String(row.request_type || "account_creation").toLowerCase(),
        userId: row.user_id ?? row.linked_user_id ?? null,
        name: row.linked_user_name || row.requested_by_name || row.email,
        email: row.email || "",
        requestedRole: normalizeRoleForStorage(row.requested_role || "staff"),
        role: normalizeUserRole(row.role || "staff"),
        department: row.department_name || "-",
        designation: row.designation || row.requested_designation || "",
        mobileNo: row.requested_mobile_no || "",
        officeExtNo: row.requested_off_ext || "",
        approvalStatus: String(row.approval_status || "pending_dept_head").toLowerCase(),
        requestedDate: row.requested_date ? new Date(row.requested_date).toISOString().split("T")[0] : "",
        requestedByDeptHead: row.dept_head_approver_name || "-",
        userStatus: String(row.status || "inactive").toLowerCase(),
      })),
    });
  })
);

app.post(
  "/api/account-requests/:id/approve",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverRole = normalizeRoleForStorage(req.body?.approverRole || "admin");
    const approverUserId = Number(req.body?.approverUserId ?? 0);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid account request id is required." });
    }

    const accountRequestColumns = await ensureAccountRequestsTable();
    const schema = await getAuthSchema();
    const [requestRows] = await pool.execute(
      `
        SELECT id, request_type, requested_role, approval_status, user_id, requested_by_name, email, requested_department_id,
               ${accountRequestColumns.has("requested_password") ? "requested_password" : "NULL AS requested_password"},
               ${accountRequestColumns.has("requested_designation") ? "requested_designation" : "NULL AS requested_designation"},
               ${accountRequestColumns.has("requested_mobile_no") ? "requested_mobile_no" : "NULL AS requested_mobile_no"},
               ${accountRequestColumns.has("requested_off_ext") ? "requested_off_ext" : "NULL AS requested_off_ext"}
        FROM account_requests
        WHERE id = ?
        LIMIT 1
      `,
      [requestId]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({ success: false, message: "Account request not found." });
    }

    const request = requestRows[0];
    const requestType = String(request.request_type || "account_creation").toLowerCase();
    const allowedWorkflowRequestTypes = new Set(["account_creation", "deactivation"]);

    if (!allowedWorkflowRequestTypes.has(requestType)) {
      return res.status(400).json({ success: false, message: "Unsupported request type for this approval route." });
    }

    const currentStatus = String(request.approval_status || "pending_dept_head").toLowerCase();
    const targetUserId = Number(request.user_id ?? 0);

    if (approverRole === "admin") {
      if (currentStatus !== "pending_admin") {
        return res.status(409).json({ success: false, message: "This account request is not ready for admin approval." });
      }

      if (requestType === "deactivation") {
        const userToDeactivate = Number(request.user_id ?? 0);

        if (!Number.isInteger(userToDeactivate) || userToDeactivate <= 0) {
          return res.status(400).json({ success: false, message: "Deactivation request is missing the target user." });
        }

        await updateStoredUserStatus(
          schema,
          userToDeactivate,
          schema.hasUserRolesTable ? "Inactive" : "inactive"
        );

        const updateAssignments = [];
        const updateValues = [];

        if (accountRequestColumns.has("approval_status")) {
          updateAssignments.push("approval_status = ?");
          updateValues.push("approved_by_admin");
        }

        if (accountRequestColumns.has("admin_approved_date")) {
          updateAssignments.push("admin_approved_date = CURRENT_TIMESTAMP");
        }

        if (accountRequestColumns.has("admin_approved_by_id")) {
          updateAssignments.push("admin_approved_by_id = ?");
          updateValues.push(approverUserId > 0 ? approverUserId : null);
        }

        updateValues.push(requestId);
        await pool.execute(`UPDATE account_requests SET ${updateAssignments.join(", ")} WHERE id = ?`, updateValues);

        return res.json({
          success: true,
          message: "Deactivation approved and the user account has been deactivated.",
        });
      }

      const finalRole = normalizeRoleForStorage(request.requested_role || "staff");
      const appliedRole = ["head_of_department", "dean", "admin", "registrar"].includes(finalRole) ? finalRole : "staff";

      let resolvedUserId = targetUserId > 0 ? targetUserId : null;

      if (resolvedUserId) {
        await updateStoredUserRole(schema, resolvedUserId, appliedRole);
        await updateStoredUserStatus(schema, resolvedUserId, schema.hasUserRolesTable ? "Active" : "active");
      } else {
        const normalizedEmail = String(request.email || "").trim().toLowerCase();
        const [existingUserRows] = await pool.execute(
          "SELECT 1 FROM users WHERE LOWER(email) = ? LIMIT 1",
          [normalizedEmail]
        );

        if (existingUserRows.length > 0) {
          return res.status(409).json({ success: false, message: "A user account with this email already exists." });
        }

        const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
        const insertColumns = [userNameColumn, "email", "password", "department_id", "status"];
        const insertValues = [
          String(request.requested_by_name || request.email || "").trim(),
          normalizedEmail,
          String(request.requested_password || ""),
          request.requested_department_id ?? null,
          schema.hasUserRolesTable ? "Active" : "active",
        ];

        if (schema.userColumns.has("role")) {
          insertColumns.push("role");
          insertValues.push(appliedRole);
        } else if (schema.hasUserRolesTable) {
          const roleId = await resolveRoleId(appliedRole);

          if (!roleId) {
            return res.status(400).json({ success: false, message: "Unable to resolve the approved role for this account." });
          }

          insertColumns.push("role_id");
          insertValues.push(roleId);
        }

        const requestedDesignation = String(request.requested_designation || "").trim();
        const designationId = await resolveDesignationId(schema, requestedDesignation);
        if (requestedDesignation && schema.userColumns.has("designation_id") && designationId) {
          insertColumns.push("designation_id");
          insertValues.push(designationId);
        } else if (requestedDesignation && schema.userColumns.has("designation")) {
          insertColumns.push("designation");
          insertValues.push(requestedDesignation);
        }

        const mobileNo = Number(String(request.requested_mobile_no || "").trim());
        if (schema.userColumns.has("mobile_no") && !Number.isNaN(mobileNo) && mobileNo > 0) {
          insertColumns.push("mobile_no");
          insertValues.push(mobileNo);
        }

        const officeExtNo = Number(String(request.requested_off_ext || "").trim());
        if (schema.userColumns.has("off_ext") && !Number.isNaN(officeExtNo) && officeExtNo > 0) {
          insertColumns.push("off_ext");
          insertValues.push(officeExtNo);
        }

        const placeholders = insertColumns.map(() => "?").join(", ");
        const [insertResult] = await pool.execute(
          `INSERT INTO users (${insertColumns.join(", ")}) VALUES (${placeholders})`,
          insertValues
        );

        resolvedUserId = Number(insertResult.insertId);
      }

      const updateAssignments = [];
      const updateValues = [];

      if (accountRequestColumns.has("approval_status")) {
        updateAssignments.push("approval_status = ?");
        updateValues.push("approved_by_admin");
      }

      if (accountRequestColumns.has("admin_approved_date")) {
        updateAssignments.push("admin_approved_date = CURRENT_TIMESTAMP");
      }

      if (accountRequestColumns.has("admin_approved_by_id")) {
        updateAssignments.push("admin_approved_by_id = ?");
        updateValues.push(approverUserId > 0 ? approverUserId : null);
      }

      if (accountRequestColumns.has("user_id")) {
        updateAssignments.push("user_id = ?");
        updateValues.push(resolvedUserId);
      }

      updateValues.push(requestId);
      await pool.execute(`UPDATE account_requests SET ${updateAssignments.join(", ")} WHERE id = ?`, updateValues);

      return res.json({
        success: true,
        message: appliedRole === "staff"
          ? "Account approved and activated with staff access."
          : `Account approved and activated with ${appliedRole.replace(/_/g, " ")} access.`,
        user: {
          id: resolvedUserId,
          name: String(request.requested_by_name || request.email || "").trim(),
          email: String(request.email || "").trim().toLowerCase(),
          role: appliedRole,
          status: "active",
          departmentId: request.requested_department_id ?? null,
          designation: String(request.requested_designation || "").trim(),
        },
      });
    }

    if (approverRole === "dean") {
      if (currentStatus !== "pending_dean") {
        return res.status(409).json({ success: false, message: "This account request is not awaiting dean approval." });
      }

      const updateAssignments = [];
      const updateValues = [];

      if (accountRequestColumns.has("approval_status")) {
        updateAssignments.push("approval_status = ?");
        updateValues.push("pending_admin");
      }

      if (accountRequestColumns.has("dean_approved_date")) {
        updateAssignments.push("dean_approved_date = CURRENT_TIMESTAMP");
      }

      if (accountRequestColumns.has("dean_approved_by_id")) {
        updateAssignments.push("dean_approved_by_id = ?");
        updateValues.push(approverUserId > 0 ? approverUserId : null);
      }

      updateValues.push(requestId);
      await pool.execute(`UPDATE account_requests SET ${updateAssignments.join(", ")} WHERE id = ?`, updateValues);

      return res.json({
        success: true,
        message: "Account request approved by the dean and forwarded for admin activation.",
      });
    }

    if (currentStatus !== "pending_dept_head") {
      return res.status(409).json({ success: false, message: "This account request is not awaiting department-level approval." });
    }

    const updateAssignments = [];
    const updateValues = [];

    if (accountRequestColumns.has("approval_status")) {
      updateAssignments.push("approval_status = ?");
      updateValues.push("pending_admin");
    }

    if (accountRequestColumns.has("dept_head_approved_date")) {
      updateAssignments.push("dept_head_approved_date = CURRENT_TIMESTAMP");
    }

    if (accountRequestColumns.has("dept_head_approved_by_id")) {
      updateAssignments.push("dept_head_approved_by_id = ?");
      updateValues.push(approverUserId > 0 ? approverUserId : null);
    }

    updateValues.push(requestId);
    await pool.execute(`UPDATE account_requests SET ${updateAssignments.join(", ")} WHERE id = ?`, updateValues);

    return res.json({
      success: true,
      message: "Account request approved by the HOD and forwarded for admin activation.",
    });
  })
);

app.post(
  "/api/account-requests/:id/reject",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid account request id is required." });
    }

    const [requestRows] = await pool.execute(
      `SELECT id, request_type FROM account_requests WHERE id = ? LIMIT 1`,
      [requestId]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({ success: false, message: "Account request not found." });
    }

    const rejectRequestType = String(requestRows[0].request_type || "account_creation").toLowerCase();

    if (!["account_creation", "deactivation"].includes(rejectRequestType)) {
      return res.status(400).json({ success: false, message: "This rejection route does not support this request type." });
    }

    await pool.execute(
      `UPDATE account_requests SET approval_status = 'rejected', rejection_date = CURRENT_TIMESTAMP, rejection_reason = ? WHERE id = ?`,
      [String(req.body?.reason || "Rejected during approval workflow"), requestId]
    );

    return res.json({ success: true, message: "Request rejected." });
  })
);

app.patch(
  "/api/users/:id/role",
  withDatabase(async (req, res) => {
    const userId = Number(req.params.id);
    const nextRole = normalizeRoleForStorage(req.body?.role);
    const schema = await getAuthSchema();
    const allowedRoles = new Set(["staff", "head_of_department", "dean", "admin"]);
    const singletonRoles = new Set(["head_of_department", "dean", "registrar"]);

    if (!Number.isInteger(userId) || userId <= 0 || !nextRole) {
      return res.status(400).json({ success: false, message: "A valid user id and role are required." });
    }

    if (!allowedRoles.has(nextRole)) {
      return res.status(400).json({ success: false, message: "Inventory access is granted through inventory assignment, not manual role changes." });
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
    const [userRows] = await pool.execute(
      `
        SELECT ${roleSelection}
        FROM users u
        ${roleJoin}
        WHERE ${userIdColumn} = ?
        LIMIT 1
      `,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const currentRole = normalizeUserRole(userRows[0].role);

    if (singletonRoles.has(nextRole) || singletonRoles.has(currentRole)) {
      return res.status(409).json({
        success: false,
        message: "Dean, HOD, and registrar accounts are permanent designation accounts and cannot be changed through role updates.",
      });
    }

    const updated = await updateStoredUserRole(schema, userId, nextRole);

    if (!updated) {
      return res.status(400).json({ success: false, message: "Unable to update the requested role." });
    }

    return res.json({ success: true, message: "User role updated successfully." });
  })
);

app.patch(
  "/api/users/:id/status",
  withDatabase(async (req, res) => {
    const userId = Number(req.params.id);
    const nextStatus = String(req.body?.status || "").trim().toLowerCase();
    const schema = await getAuthSchema();

    if (!Number.isInteger(userId) || userId <= 0 || !["active", "inactive"].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: "A valid user id and status are required." });
    }

    if (nextStatus === "active") {
      const accountRequestColumns = await ensureAccountRequestsTable();
      const [requestRows] = await pool.execute(
        `
          SELECT approval_status
          FROM account_requests
          WHERE ${accountRequestColumns.has("user_id") ? "user_id = ?" : "1 = 0"}
            AND LOWER(COALESCE(request_type, 'account_creation')) = 'account_creation'
          ORDER BY ${accountRequestColumns.has("requested_date") ? "requested_date" : "id"} DESC, id DESC
          LIMIT 1
        `,
        [userId]
      );

      if (requestRows.length > 0) {
        const approvalStatus = String(requestRows[0].approval_status || "").toLowerCase();

        if (approvalStatus !== "approved_by_admin") {
          const statusMessages = {
            pending_dept_head: "This account is still waiting for HOD approval and cannot be activated yet.",
            pending_dean: "This account is still waiting for dean approval and cannot be activated yet.",
            pending_admin: "Use the account approval flow to activate this account after reviewing the request.",
            rejected: "This account request was rejected and cannot be activated.",
          };

          return res.status(409).json({
            success: false,
            message: statusMessages[approvalStatus] || "This account cannot be activated until the approval workflow is completed.",
          });
        }
      }
    }

    await updateStoredUserStatus(
      schema,
      userId,
      schema.hasUserRolesTable ? (nextStatus === "active" ? "Active" : "Inactive") : nextStatus
    );

    return res.json({ success: true, message: `User marked as ${nextStatus}.` });
  })
);

app.patch(
  "/api/users/:id/reappointment",
  withDatabase(async (req, res) => {
    const userId = Number(req.params.id);
    const nextPassword = String(req.body?.password ?? "");
    const mobileNoRaw = String(req.body?.mobileNo ?? "").trim();
    const schema = await getAuthSchema();
    const singletonRoles = new Set(["head_of_department", "dean", "registrar"]);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "A valid user id is required." });
    }

    if (!nextPassword && !mobileNoRaw) {
      return res.status(400).json({ success: false, message: "Provide a new password or mobile number to update this account." });
    }

    if (nextPassword && nextPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
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
    const [userRows] = await pool.execute(
      `
        SELECT ${userIdColumn} AS id, ${roleSelection}
        FROM users u
        ${roleJoin}
        WHERE ${userIdColumn} = ?
        LIMIT 1
      `,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const currentRole = normalizeUserRole(userRows[0].role);

    if (!singletonRoles.has(currentRole)) {
      return res.status(409).json({
        success: false,
        message: "Only dean, HOD, and registrar accounts support the re-appointment update flow.",
      });
    }

    const updateAssignments = [];
    const updateValues = [];

    if (nextPassword) {
      updateAssignments.push("password = ?");
      updateValues.push(nextPassword);
    }

    if (mobileNoRaw) {
      if (!schema.userColumns.has("mobile_no")) {
        return res.status(400).json({ success: false, message: "Mobile number updates are not supported by the current user schema." });
      }

      const normalizedMobileNo = Number(mobileNoRaw);
      if (Number.isNaN(normalizedMobileNo) || normalizedMobileNo <= 0) {
        return res.status(400).json({ success: false, message: "A valid mobile number is required." });
      }

      updateAssignments.push("mobile_no = ?");
      updateValues.push(normalizedMobileNo);
    }

    if (updateAssignments.length === 0) {
      return res.status(400).json({ success: false, message: "No supported fields were provided for update." });
    }

    updateValues.push(userId);
    await pool.execute(`UPDATE users SET ${updateAssignments.join(", ")} WHERE ${schema.userColumns.has("id") ? "id" : "user_id"} = ?`, updateValues);

    return res.json({
      success: true,
      message: `${currentRole.replace(/_/g, " ")} account updated successfully.`,
      updates: {
        mobileNo: mobileNoRaw || null,
        passwordUpdated: Boolean(nextPassword),
      },
    });
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
    const departmentNameColumn = schema.departmentColumns.has("name") ? "name" : "department_name";
    const departmentCodeColumn = schema.departmentColumns.has("code") ? "code" : null;
    const departmentHeadIdColumn = schema.departmentColumns.has("head_id") ? "head_id" : null;
    const departmentStatusColumn = schema.departmentColumns.has("status") ? "status" : null;
    const departmentCreatedDateColumn = schema.departmentColumns.has("created_date") ? "created_date" : null;
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";

    const headJoinClause = departmentHeadIdColumn
      ? `LEFT JOIN users u ON u.${userIdColumn} = d.${departmentHeadIdColumn}`
      : "LEFT JOIN users u ON 1 = 0";

    const [rows] = await pool.execute(
      `
        SELECT
          d.${departmentIdColumn} AS id,
          d.${departmentNameColumn} AS name,
          ${departmentCodeColumn ? `d.${departmentCodeColumn}` : "NULL"} AS code,
          ${departmentHeadIdColumn ? `d.${departmentHeadIdColumn}` : "NULL"} AS head_id,
          ${departmentStatusColumn ? `d.${departmentStatusColumn}` : "NULL"} AS status,
          ${departmentCreatedDateColumn ? `d.${departmentCreatedDateColumn}` : "NULL"} AS created_date,
          u.${userNameColumn} AS head_name
        FROM departments d
        ${headJoinClause}
        ORDER BY d.${departmentNameColumn} ASC
      `
    );

    const departments = rows
      .filter((row) => !row.status || String(row.status).toLowerCase() === "active")
      .map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code || "",
        head: row.head_name || "",
        status: row.status || "active",
        createdDate: row.created_date ? new Date(row.created_date).toISOString().split("T")[0] : "",
        userCount: 0, // TODO: Add user count
        inventoryCount: 0, // TODO: Add inventory count
      }));

    return res.json({ success: true, departments });
  })
);

app.get(
  "/api/designations",
  withDatabase(async (_req, res) => {
    const schema = await getAuthSchema();

    if (!schema.hasDesignationTable) {
      return res.json({ success: true, designations: [] });
    }

    const designationIdColumn = getDesignationIdColumn(schema);
    const designationNameColumn = getDesignationNameColumn(schema);

    if (!designationIdColumn || !designationNameColumn) {
      return res.json({ success: true, designations: [] });
    }

    const [rows] = await pool.execute(
      `SELECT ${designationIdColumn} AS id, ${designationNameColumn} AS name FROM ${schema.designationTableName} ORDER BY ${designationNameColumn} ASC`
    );

    const designations = rows.map((row) => ({
      id: row.id,
      name: row.name || "",
    }));

    return res.json({ success: true, designations });
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

    await syncInventoryInchargeRole(inchargeId);

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

    const [existingRows] = await pool.execute(
      `SELECT ${inventoryInchargeColumn} AS incharge_id FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
      [inventoryId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: "Inventory not found." });
    }

    const previousInchargeId = Number(existingRows[0]?.incharge_id ?? 0);

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

    const assignmentCounts = await getInventoryAssignmentCounts();
    await syncInventoryInchargeRole(inchargeId, assignmentCounts);

    if (previousInchargeId > 0 && previousInchargeId !== inchargeId) {
      await syncInventoryInchargeRole(previousInchargeId, assignmentCounts);
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
    let inactiveUsers = Math.max(totalUsers - activeUsers, 0);
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

    if (tableNames.has("account_requests")) {
      const blockedInactiveUsers = await getCountValue(
        "SELECT COUNT(DISTINCT user_id) AS count FROM account_requests WHERE user_id IS NOT NULL AND LOWER(COALESCE(request_type, 'account_creation')) = 'account_creation' AND LOWER(COALESCE(approval_status, '')) IN ('pending_dept_head', 'pending_dean', 'pending_admin', 'rejected')"
      );
      inactiveUsers = Math.max(inactiveUsers - blockedInactiveUsers, 0);
    }

    let pendingTasks = inactiveUsers;
    if (tableNames.has("account_requests")) {
      pendingTasks += await getCountValue(
        "SELECT COUNT(*) AS count FROM account_requests WHERE LOWER(COALESCE(request_type, 'account_creation')) = 'account_creation' AND LOWER(COALESCE(approval_status, '')) = 'pending_admin'"
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

    const accountRequestColumns = await ensureAccountRequestsTable();
    const [pendingRequestRows] = await pool.execute(
      `
        SELECT approval_status, requested_role, ${accountRequestColumns.has("requested_password") ? "requested_password" : "NULL AS requested_password"}
        FROM account_requests
        WHERE LOWER(COALESCE(email, '')) = ?
          AND LOWER(COALESCE(request_type, 'account_creation')) = 'account_creation'
          AND LOWER(COALESCE(approval_status, '')) NOT IN ('approved_by_admin', 'rejected')
        ORDER BY ${accountRequestColumns.has("requested_date") ? "requested_date" : "id"} DESC, id DESC
        LIMIT 1
      `,
      [email]
    );
    const pendingRequest = pendingRequestRows[0] || null;

    if (rows.length === 0 || rows[0].password !== password) {
      if (pendingRequest) {
        const pendingPassword = String(pendingRequest.requested_password || "");

        if (!pendingPassword || pendingPassword === password) {
          return res.status(403).json({
            success: false,
            error: getPendingAccountStatusMessage(pendingRequest.approval_status, pendingRequest.requested_role),
          });
        }
      }

      return res.status(401).json({
        success: false,
        error: "Invalid email or password.",
      });
    }

    const user = rows[0];

    if (String(user.status ?? "").toLowerCase() !== "active") {
      const [requestRows] = await pool.execute(
        `
          SELECT approval_status, requested_role
          FROM account_requests
          WHERE LOWER(COALESCE(email, '')) = ?
            AND LOWER(COALESCE(request_type, 'account_creation')) = 'account_creation'
            AND LOWER(COALESCE(approval_status, '')) NOT IN ('approved_by_admin', 'rejected')
          ORDER BY ${accountRequestColumns.has("requested_date") ? "requested_date" : "id"} DESC, id DESC
          LIMIT 1
        `,
        [email]
      );

      return res.status(403).json({
        success: false,
        error: getPendingAccountStatusMessage(requestRows[0]?.approval_status, requestRows[0]?.requested_role),
      });
    }

    if (schema.userColumns.has("last_login")) {
      const idColumnName = schema.userColumns.has("id") ? "id" : "user_id";
      await pool.execute(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE ${idColumnName} = ?`, [
        user.id,
      ]);
    }

    const roleDetails = await getEffectiveUserRoleDetails(user.id, user.role);

    return res.json({
      success: true,
      message: "Login successful! Redirecting...",
      user: buildUserResponse(user, roleDetails),
    });
  })
);

app.post(
  "/api/auth/signup",
  withDatabase(async (req, res) => {
    const fullName = String(req.body?.fullName ?? "").trim();
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const adminRequest = req.body?.adminRequest === true || String(req.body?.adminRequest ?? "").toLowerCase() === "true";
    const createdByRole = normalizeRoleForStorage(req.body?.createdByRole || "");
    const requestedRoleInput = normalizeRoleForStorage(req.body?.role || "staff");
    const isAdminManagedSignup = createdByRole === "admin";
    const requestedRole = isAdminManagedSignup
      ? (adminRequest ? "admin" : requestedRoleInput || "staff")
      : "staff";
    const department = String(req.body?.department ?? "").trim();
    const designation = String(req.body?.designation ?? "").trim();
    const mobileNoRaw = String(req.body?.mobileNo ?? "").trim();
    const officeExtNoRaw = String(req.body?.officeExtNo ?? "").trim();
    const requiresDepartment = requestedRole !== "registrar";
    const requiresDesignation = requestedRole !== "registrar";

    if (!fullName || !email || !password || (requiresDepartment && !department)) {
      return res.status(400).json({
        success: false,
        error: requiresDepartment
          ? "Full name, email, password, and department are required."
          : "Full name, email, and password are required.",
      });
    }

    if (!isAdminManagedSignup && (adminRequest || requestedRoleInput !== "staff")) {
      return res.status(403).json({
        success: false,
        error: "Self-signup is only available for staff member accounts. Dean, HOD, registrar, and admin accounts must be created by admin.",
      });
    }

    if (!["staff", "head_of_department", "dean", "registrar", "admin"].includes(requestedRole)) {
      return res.status(400).json({ success: false, error: "Invalid account request type." });
    }

    if (requestedRole === "registrar" && createdByRole !== "admin") {
      return res.status(403).json({ success: false, error: "Registrar accounts can only be created by an administrator." });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long.",
      });
    }

    const schema = await getAuthSchema();
    const accountRequestColumns = await ensureAccountRequestsTable();
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

    const [existingRequestRows] = await pool.execute(
      `
        SELECT 1
        FROM account_requests
        WHERE LOWER(COALESCE(email, '')) = ?
          AND LOWER(COALESCE(request_type, 'account_creation')) = 'account_creation'
          AND LOWER(COALESCE(approval_status, '')) NOT IN ('approved_by_admin', 'rejected')
        LIMIT 1
      `,
      [email]
    );

    if (existingRequestRows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "An account request with this email is already pending approval.",
      });
    }

    const departmentId = requiresDepartment ? await resolveDepartmentId(schema, department) : null;
    if (requiresDepartment && schema.hasDepartmentsTable && !departmentId) {
      return res.status(400).json({
        success: false,
        error: "Invalid department selected.",
      });
    }

    const designationId = requiresDesignation ? await resolveDesignationId(schema, designation) : null;
    if (requiresDesignation && designation && schema.userColumns.has("designation_id") && !designationId) {
      return res.status(400).json({
        success: false,
        error: "Invalid designation selected.",
      });
    }

    const departmentHeadUserId = departmentId ? await resolveDepartmentHeadUserId(schema, departmentId) : null;
    const deanUserId = await resolveDeanUserId(schema);
    const isDirectAdminProvisionedRole = isAdminManagedSignup && ["head_of_department", "dean", "registrar", "admin"].includes(requestedRole);
    const requiresDeanApproval = isAdminManagedSignup && ["admin", "head_of_department", "registrar"].includes(requestedRole);

    if (["head_of_department", "dean", "registrar"].includes(requestedRole)) {
      const existingRoleAccount = await findExistingRoleAccount(schema, requestedRole, departmentId);

      if (existingRoleAccount) {
        return res.status(409).json({
          success: false,
          error: requestedRole === "head_of_department"
            ? "A Head of Department account already exists for the selected department. Reuse that account instead of creating a new one."
            : `A ${requestedRole.replace(/_/g, " ")} account already exists. Reuse that account instead of creating a new one.`,
        });
      }
    }

    if (!isDirectAdminProvisionedRole && !requiresDeanApproval && !departmentHeadUserId) {
      return res.status(409).json({
        success: false,
        error: "No active Head of Department is assigned to the selected department yet. Create the HOD account first.",
      });
    }

    if (requiresDeanApproval && !deanUserId && !isDirectAdminProvisionedRole) {
      return res.status(409).json({
        success: false,
        error: "No active dean account is available to approve this request. Create the dean account first.",
      });
    }

    if (isDirectAdminProvisionedRole) {
      const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
      const insertColumns = [userNameColumn, "email", "password", "department_id", "status"];
      const insertValues = [
        fullName,
        email,
        password,
        departmentId || null,
        schema.hasUserRolesTable ? "Active" : "active",
      ];

      if (schema.userColumns.has("role")) {
        insertColumns.push("role");
        insertValues.push(requestedRole);
      } else if (schema.hasUserRolesTable) {
        const roleId = await resolveRoleId(requestedRole);

        if (!roleId) {
          return res.status(400).json({ success: false, error: "Unable to resolve the requested role for this account." });
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

      const mobileNo = Number(mobileNoRaw);
      if (schema.userColumns.has("mobile_no") && !Number.isNaN(mobileNo) && mobileNo > 0) {
        insertColumns.push("mobile_no");
        insertValues.push(mobileNo);
      }

      const officeExtNo = Number(officeExtNoRaw);
      if (schema.userColumns.has("off_ext") && !Number.isNaN(officeExtNo) && officeExtNo > 0) {
        insertColumns.push("off_ext");
        insertValues.push(officeExtNo);
      }

      const placeholders = insertColumns.map(() => "?").join(", ");
      const [insertResult] = await pool.execute(
        `INSERT INTO users (${insertColumns.join(", ")}) VALUES (${placeholders})`,
        insertValues
      );

      return res.status(201).json({
        success: true,
        message: `${requestedRole.replace(/_/g, " ")} account created and activated successfully.`,
        user: {
          id: Number(insertResult.insertId),
          name: fullName,
          email,
          role: requestedRole,
          status: "active",
          department,
          departmentId: departmentId || null,
          designation,
          mobileNo: mobileNoRaw,
          officeExtNo: officeExtNoRaw,
        },
      });
    }

    {
      const requestInsertColumns = [];
      const requestInsertValues = [];

      if (accountRequestColumns.has("request_type")) {
        requestInsertColumns.push("request_type");
        requestInsertValues.push("account_creation");
      }

      if (accountRequestColumns.has("requested_by_name")) {
        requestInsertColumns.push("requested_by_name");
        requestInsertValues.push(fullName);
      }

      if (accountRequestColumns.has("email")) {
        requestInsertColumns.push("email");
        requestInsertValues.push(email);
      }

      if (accountRequestColumns.has("requested_role")) {
        requestInsertColumns.push("requested_role");
        requestInsertValues.push(requestedRole);
      }

      if (accountRequestColumns.has("requested_department_id")) {
        requestInsertColumns.push("requested_department_id");
        requestInsertValues.push(departmentId || null);
      }

      if (accountRequestColumns.has("requested_password")) {
        requestInsertColumns.push("requested_password");
        requestInsertValues.push(password);
      }

      if (accountRequestColumns.has("requested_designation")) {
        requestInsertColumns.push("requested_designation");
        requestInsertValues.push(designation || null);
      }

      if (accountRequestColumns.has("requested_mobile_no")) {
        requestInsertColumns.push("requested_mobile_no");
        requestInsertValues.push(mobileNoRaw || null);
      }

      if (accountRequestColumns.has("requested_off_ext")) {
        requestInsertColumns.push("requested_off_ext");
        requestInsertValues.push(officeExtNoRaw || null);
      }

      if (accountRequestColumns.has("approval_status")) {
        requestInsertColumns.push("approval_status");
        requestInsertValues.push(requiresDeanApproval ? "pending_dean" : "pending_dept_head");
      }

      if (accountRequestColumns.has("request_reason")) {
        requestInsertColumns.push("request_reason");
        requestInsertValues.push(`Signup requested with target role: ${requestedRole}`);
      }

      const requestPlaceholders = requestInsertColumns.map(() => "?").join(", ");
      const [requestResult] = await pool.execute(
        `INSERT INTO account_requests (${requestInsertColumns.join(", ")}) VALUES (${requestPlaceholders})`,
        requestInsertValues
      );

      return res.status(201).json({
        success: true,
        message: requestedRole === "admin"
          ? "Admin account request submitted successfully. Your account will stay pending until dean and admin approval."
          : requiresDeanApproval
            ? "Account request submitted successfully. Your account will stay pending until dean and admin approval."
            : "Staff account request submitted successfully. Your account will stay pending until HOD review and admin activation.",
        request: {
          id: requestResult.insertId,
          name: fullName,
          email,
          requestedRole,
          department,
          designation,
          approvalStatus: requiresDeanApproval ? "pending_dean" : "pending_dept_head",
          adminRequest,
        },
      });
    }
  })
);

// Accept multipart/form-data for single item creation (supports itemImage and ginfile uploads)
app.post(
  "/api/items",
  upload.fields([
    { name: "itemImage", maxCount: 1 },
    { name: "ginfile", maxCount: 1 },
  ]),
  withDatabase(async (req, res) => {
    await ensureInventoryItemsColumns();

    // Merge text fields from req.body
    const payload = { ...req.body };

    // Attach uploaded file paths if present
    if (req.files && req.files.itemImage && req.files.itemImage[0]) {
      payload.itemImage = `/uploads/${req.files.itemImage[0].filename}`;
    }

    if (req.files && req.files.ginfile && req.files.ginfile[0]) {
      payload.ginfile = `/uploads/${req.files.ginfile[0].filename}`;
    }

    const item = normalizeItemPayload(payload);
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
    await ensureInventoryItemsColumns();
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

// CSV bulk upload: accepts multipart/form-data with `file` field (CSV)
app.post(
  "/api/items/bulk-csv",
  upload.single("file"),
  withDatabase(async (req, res) => {
    await ensureInventoryItemsColumns();

    if (!req.file) {
      return res.status(400).json({ success: false, error: "CSV file is required in field 'file'" });
    }

    const csvBuffer = fs.readFileSync(path.join(UPLOAD_DIR, req.file.filename));
    let records = [];
    try {
      records = csvParse(String(csvBuffer), { columns: true, skip_empty_lines: true });
    } catch (err) {
      return res.status(400).json({ success: false, error: "Failed to parse CSV: " + err.message });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: "No records found in CSV" });
    }

    const items = records.map(normalizeItemPayload);
    const invalid = items.find(validateRequiredFields);
    if (invalid) {
      return res.status(400).json({ success: false, error: validateRequiredFields(invalid) });
    }

    const placeholders = items
      .map(() => `(${itemColumns.map(() => "?").join(", ")})`)
      .join(", ");
    const values = items.flatMap(buildInsertValues);

    const [result] = await pool.execute(
      `INSERT INTO ${DB_ITEMS_TABLE} (${itemColumns.join(", ")}) VALUES ${placeholders}`,
      values
    );

    return res.status(201).json({ success: true, createdCount: result.affectedRows });
  })
);

app.get(
  "/api/items",
  withDatabase(async (req, res) => {
    const inventoryItemColumns = await ensureInventoryItemsColumns();
      const inventoryId = Number(req.query?.inventoryId ?? 0);
    const ginNo = String(req.query?.ginNo ?? "").trim();
    const hasInventoryId = inventoryItemColumns.has("inventory_id");

    const whereClauses = [];
    const params = [];

    if (ginNo) {
      whereClauses.push("ginNo = ?");
      params.push(ginNo);
    }

    if (Number.isInteger(inventoryId) && inventoryId > 0 && hasInventoryId) {
      whereClauses.push("inventory_id = ?");
      params.push(inventoryId);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [rows] = await pool.execute(
      `SELECT * FROM ${DB_ITEMS_TABLE} ${whereClause} ORDER BY updated_at DESC, created_at DESC, id DESC`,
      params
    );

    return res.json({ success: true, items: rows });
  })
);

app.get(
  "/api/items/:id",
  withDatabase(async (req, res) => {
    await ensureInventoryItemsColumns();
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
    const roleDetails = await getEffectiveUserRoleDetails(user.id, user.role);
    const departmentHeadUserId = user.department_id ? await resolveDepartmentHeadUserId(schema, user.department_id) : null;

    return res.json({
      success: true,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleDetails.role,
        status: String(user.status ?? "").toLowerCase(),
        department: user.department_name ?? "",
        departmentId: user.department_id ?? null,
        designation: user.designation ?? "",
        mobileNo: user.mobile_no ?? "",
        officeExtNo: user.off_ext ?? "",
        assignedInventoryCount: roleDetails.assignedInventoryCount,
        hasDepartmentHod: Boolean(departmentHeadUserId),
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
    const mobileNo = req.body?.mobileNo !== undefined ? String(req.body.mobileNo).trim() : null;

    if (!email && (!Number.isInteger(userId) || userId <= 0)) {
      return res.status(400).json({
        success: false,
        message: "A valid email or userId is required.",
      });
    }

    const updatingPassword = Boolean(currentPassword || nextPassword);
    const updatingMobile = mobileNo !== null;

    if (!updatingPassword && !updatingMobile) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update. Provide a new password or mobile number.",
      });
    }

    if (updatingPassword && (!currentPassword || !nextPassword)) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required to update the password.",
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

    if (updatingPassword) {
      if (String(rows[0].password ?? "") !== currentPassword) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }
      await pool.execute(`UPDATE users SET password = ? WHERE ${idColumnName} = ?`, [nextPassword, rows[0].id]);
    }

    if (updatingMobile) {
      const mobileColumn = schema.userColumns.has("mobile_no") ? "mobile_no" : null;
      if (mobileColumn) {
        await pool.execute(`UPDATE users SET ${mobileColumn} = ? WHERE ${idColumnName} = ?`, [mobileNo || null, rows[0].id]);
      }
    }

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

    const outstandingReturns = await getOutstandingReturnSummary(userId);

    if (outstandingReturns.count > 0) {
      const itemLabel = outstandingReturns.count === 1 ? "item is" : "items are";
      const preview = outstandingReturns.sampleItems.length > 0
        ? ` Outstanding: ${outstandingReturns.sampleItems.join(", ")}${outstandingReturns.count > outstandingReturns.sampleItems.length ? ", ..." : ""}.`
        : "";

      return res.status(409).json({
        success: false,
        code: "OUTSTANDING_ITEM_RETURNS",
        message: `Your account cannot be deactivated because ${outstandingReturns.count} issued ${itemLabel} still pending return.${preview}`,
      });
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
  "/api/inventory-creation-requests/:id/approve-hod",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? 0);
    const inventoryRequestColumns = await ensureInventoryCreationRequestsTable();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid inventory creation request id is required." });
    }

    if (!Number.isInteger(approverUserId) || approverUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [rows] = await pool.execute("SELECT * FROM inventory_creation_requests WHERE id = ? LIMIT 1", [requestId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Inventory creation request not found." });
    }

    const inv = rows[0];
    const hodCol = inventoryRequestColumns.has("hod_user_id");
    const assignedHod = hodCol ? Number(inv.hod_user_id ?? 0) : 0;

    if (hodCol && assignedHod !== approverUserId) {
      return res.status(403).json({ success: false, message: "Only the assigned Head of Department can approve this request." });
    }

    const currentStatus = String(inv.approval_status || "pending_staff").toLowerCase();
    const hodPendingStatuses = new Set(["pending_staff", "pending_hod"]);

    if (!hodPendingStatuses.has(currentStatus)) {
      return res.status(409).json({ success: false, message: "This request is not awaiting HOD approval." });
    }

    const requestType = String(inv.request_type || "new_inventory_creation").toLowerCase();
    const nextStatus = requestType === "add_inventory" ? "approved_by_hod" : "pending_registrar";

    const updateParts = [];
    const updateValues = [];

    if (inventoryRequestColumns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push(nextStatus);
    }

    if (inventoryRequestColumns.has("hod_approved_date")) {
      updateParts.push("hod_approved_date = CURRENT_TIMESTAMP");
    }

    if (inventoryRequestColumns.has("hod_approved_by_id")) {
      updateParts.push("hod_approved_by_id = ?");
      updateValues.push(approverUserId);
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to update approval status." });
    }

    updateValues.push(requestId);
    await pool.execute(
      `UPDATE inventory_creation_requests SET ${updateParts.join(", ")} WHERE id = ?`,
      updateValues
    );

    return res.json({
      success: true,
      message:
        requestType === "add_inventory"
          ? "Inventory addition approved by the Head of Department."
          : "Inventory creation request approved by the Head of Department and forwarded to the registrar.",
      approvalStatus: nextStatus,
    });
  })
);

app.post(
  "/api/inventory-creation-requests/:id/reject",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? 0);
    const reason = String(req.body?.reason ?? "Rejected by Head of Department").trim();
    const inventoryRequestColumns = await ensureInventoryCreationRequestsTable();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid inventory creation request id is required." });
    }

    if (!Number.isInteger(approverUserId) || approverUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [rows] = await pool.execute("SELECT * FROM inventory_creation_requests WHERE id = ? LIMIT 1", [requestId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Inventory creation request not found." });
    }

    const inv = rows[0];
    const hodCol = inventoryRequestColumns.has("hod_user_id");
    const assignedHod = hodCol ? Number(inv.hod_user_id ?? 0) : 0;

    if (hodCol && assignedHod !== approverUserId) {
      return res.status(403).json({ success: false, message: "Only the assigned Head of Department can reject this request." });
    }

    const currentStatus = String(inv.approval_status || "pending_staff").toLowerCase();
    const hodPendingStatuses = new Set(["pending_staff", "pending_hod"]);

    if (!hodPendingStatuses.has(currentStatus)) {
      return res.status(409).json({ success: false, message: "This request is not awaiting HOD approval." });
    }

    const updateParts = [];
    const updateValues = [];

    if (inventoryRequestColumns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("rejected");
    }

    if (inventoryRequestColumns.has("rejection_reason")) {
      updateParts.push("rejection_reason = ?");
      updateValues.push(reason.slice(0, 500));
    }

    if (inventoryRequestColumns.has("rejection_date")) {
      updateParts.push("rejection_date = CURRENT_TIMESTAMP");
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to reject request." });
    }

    updateValues.push(requestId);
    await pool.execute(
      `UPDATE inventory_creation_requests SET ${updateParts.join(", ")} WHERE id = ?`,
      updateValues
    );

    return res.json({ success: true, message: "Inventory request rejected." });
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
    const insertValues = [name, departmentId, requestedById, "pending_staff"];

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
    await ensureInventoryItemsColumns();
    await ensureAccountRequestsColumns();
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
