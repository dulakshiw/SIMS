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

  authSchema = {
    userColumns,
    departmentColumns,
    hasDepartmentsTable: tableNames.has("departments"),
    hasUserRolesTable: tableNames.has("user_roles"),
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
});

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

const getCountValue = async (sql) => {
  const [rows] = await pool.query(sql);
  return Number(rows[0]?.count ?? 0);
};

const getTableColumns = async (tableName) => {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${tableName}`);
  return new Set(rows.map((row) => row.Field));
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
          ${mobileNoColumn} AS mobile_no,
          ${officeExtColumn} AS off_ext,
          ${createdDateColumn} AS created_date
        FROM users u
        ${roleJoin}
        ${departmentJoin}
        ORDER BY ${createdDateColumn === "NULL" ? "u.email" : createdDateColumn} DESC
      `
    );

    const users = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: normalizeUserRole(row.role),
      department: row.department_name ?? "-",
      status: String(row.status ?? "").toLowerCase(),
      mobileNo: row.mobile_no ?? "",
      officeExtNo: row.off_ext ?? "",
      createdDate: row.created_date ? new Date(row.created_date).toISOString().split("T")[0] : "",
    }));

    return res.json({ success: true, users });
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
          ${departmentNameColumn} AS department_name
        FROM users u
        ${roleJoin}
        ${departmentJoin}
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
          ${mobileNoColumn} AS mobile_no,
          ${officeExtColumn} AS off_ext
        FROM users u
        ${roleJoin}
        ${departmentJoin}
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

app.use((req, res) => {
  return res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

const startServer = async () => {
  try {
    await pool.query("SELECT 1");
    if (AUTO_CREATE_TABLES) {
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
