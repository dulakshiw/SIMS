import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import multer from "multer";
import { parse as csvParse } from "csv-parse/sync";
import { sendAccountActivationEmail, sendAccountDeactivationEmail, sendPasswordResetOtpEmail, isDevOtpFallbackEnabled } from "./emailService.js";
import { PASSWORD_REQUIREMENTS_MESSAGE, validatePassword } from "./passwordValidation.js";
import { hashPassword, hashPasswordForStorage, isPasswordHashed, verifyPassword } from "./passwordHashing.js";
import {
  consumePasswordResetOtp,
  ensurePasswordResetOtpsTable,
  issuePasswordResetOtp,
  PASSWORD_RESET_OTP_EXPIRY_MINUTES,
  verifyPasswordResetOtp,
} from "./passwordResetService.js";
import {
  ensureNotificationsTable,
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  notifyApprovalStage,
  notifyItemRequestReceived,
  syncWarrantyNotifications,
} from "./notificationService.js";
import {
  applyItemLocationContext,
  buildUsersByNameMap,
  deriveItemStatusFromLocation,
} from "../src/utils/itemLocationStatus.js";

dotenv.config();

const notifyAccountActivated = async ({ email, name }) => {
  try {
    await sendAccountActivationEmail({ email, name });
  } catch (error) {
    console.error("[email] Account activation notification failed:", error.message);
  }
};

const notifyAccountDeactivated = async ({ email, name }) => {
  try {
    await sendAccountDeactivationEmail({ email, name });
  } catch (error) {
    console.error("[email] Account deactivation notification failed:", error.message);
  }
};

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

app.use("/uploads", express.static(UPLOAD_DIR));

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
    const allowedItemImageTypes = ["image/png", "image/jpeg", "image/jpg"];
    const allowedItemImageExtensions = [".jpg", ".jpeg", ".png"];

    if (file.fieldname === "itemImage") {
      const ext = path.extname(file.originalname).toLowerCase();
      if (
        allowedItemImageTypes.includes(file.mimetype) ||
        allowedItemImageExtensions.includes(ext)
      ) {
        return cb(null, true);
      }
      return cb(new Error("Item image must be a JPG, JPEG, or PNG file."));
    }

    if (file.fieldname === "ginfile") {
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.mimetype === "application/pdf" || ext === ".pdf") {
        return cb(null, true);
      }
      return cb(new Error("GIN PDF must be a .pdf file."));
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
  "status",
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
  value:
    payload.value === "" || payload.value == null
      ? null
      : Number.isFinite(Number(payload.value))
        ? Number(payload.value)
        : null,
  purchaseDate:
    String(payload.purchaseDate ?? payload.purchasedate ?? "").trim() || null,
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

const computeItemQrPayload = (code, serial) => {
  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) {
    return "";
  }

  const normalizedSerial = String(serial || "").trim();
  if (normalizedSerial) {
    return `${normalizedCode}_${normalizedSerial}`;
  }

  return normalizedCode;
};

const buildItemQrScanUrl = (payload, receivedfrom = "") => {
  if (!payload) {
    return "";
  }

  const origin = String(process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const params = new URLSearchParams({ q: payload });
  if (receivedfrom) {
    params.set("incharge", receivedfrom);
  }

  return `${origin}/inventory/scan?${params.toString()}`;
};

const enrichItemQrFields = (item = {}) => {
  const next = { ...item };
  const code = String(next.itemCode || "").trim();
  const serial = String(next.serialNo || "").trim();
  const serial2 = String(next.serialNo2 || "").trim();
  const receivedfrom = String(next.receivedfrom || "").trim();

  if (!String(next.QRCode || "").trim() && code) {
    next.QRCode = computeItemQrPayload(code, serial);
  }

  if (!String(next.QRCode2 || "").trim() && code && serial2) {
    next.QRCode2 = computeItemQrPayload(code, serial2);
  }

  if (next.QRCode && !String(next.qrcodeUrl || "").trim()) {
    next.qrcodeUrl = buildItemQrScanUrl(next.QRCode, receivedfrom);
  }

  if (next.QRCode2 && !String(next.qrcode2Url || "").trim()) {
    next.qrcode2Url = buildItemQrScanUrl(next.QRCode2, receivedfrom);
  }

  return next;
};

const ITEM_DB_COLUMN_ALIASES = {
  inventory_id: ["inventory_id"],
  itemName: ["itemName", "item_name"],
  itemCode: ["itemCode", "item_code"],
  serialNo: ["serialNo", "serial_no"],
  serialNo2: ["serialNo2", "serial_no2"],
  model: ["model"],
  QRCode: ["QRCode", "qr_code", "qrcode"],
  QRCode2: ["QRCode2", "qr_code2", "qrcode2"],
  pageno: ["pageno", "page_no"],
  itemImage: ["itemImage", "item_image"],
  value: ["value"],
  purchaseDate: ["purchaseDate", "purchase_date"],
  ginNo: ["ginNo", "gin_no"],
  ginfile: ["ginfile", "gin_file"],
  poNo: ["poNo", "po_no"],
  supplier: ["supplier"],
  funding: ["funding"],
  receivedfrom: ["receivedfrom", "received_from"],
  warranty: ["warranty"],
  location: ["location"],
  status: ["status"],
  remarks: ["remarks"],
  qrcodeUrl: ["qrcodeUrl", "qrcode_url"],
  qrcode2Url: ["qrcode2Url", "qrcode2_url"],
};

const getItemInsertSpec = (dbColumns) => {
  const spec = [];
  for (const logicalKey of itemColumns) {
    const aliases = ITEM_DB_COLUMN_ALIASES[logicalKey] || [logicalKey];
    for (const alias of aliases) {
      if (dbColumns.has(alias)) {
        spec.push({ column: alias, logicalKey });
      }
    }
  }
  return spec;
};

const buildInsertValues = (item, insertSpec) =>
  insertSpec.map(({ logicalKey }) => {
    const value = item[logicalKey];
    if (value === "") {
      return null;
    }
    return value ?? null;
  });

const buildItemUpdateAssignments = (item, insertSpec) => {
  const assignments = [];
  const values = [];

  for (const { column, logicalKey } of insertSpec) {
    assignments.push(`${column} = ?`);
    const value = item[logicalKey];
    values.push(value === "" ? null : value ?? null);
  }

  return { assignments, values };
};

const applyItemUploadPayload = (req, payload = {}) => {
  const nextPayload = { ...payload };

  if (req.files && req.files.itemImage && req.files.itemImage[0]) {
    nextPayload.itemImage = `/uploads/${req.files.itemImage[0].filename}`;
  } else if (
    typeof req.body.existingItemImage === "string" &&
    req.body.existingItemImage.trim().startsWith("/uploads/")
  ) {
    nextPayload.itemImage = req.body.existingItemImage.trim();
  }

  if (req.files && req.files.ginfile && req.files.ginfile[0]) {
    nextPayload.ginfile = `/uploads/${req.files.ginfile[0].filename}`;
  } else if (
    typeof req.body.existingGinfile === "string" &&
    req.body.existingGinfile.trim().startsWith("/uploads/")
  ) {
    nextPayload.ginfile = req.body.existingGinfile.trim();
  }

  return nextPayload;
};

const resolveDbColumn = (dbColumns, aliases) =>
  aliases.find((alias) => dbColumns.has(alias)) || null;

const getItemIdColumn = (dbColumns) => resolveDbColumn(dbColumns, ["id", "item_id"]) || "item_id";

const getItemsOrderClause = (dbColumns) => {
  const idColumn = getItemIdColumn(dbColumns);
  if (dbColumns.has("updated_at")) {
    return `updated_at DESC, ${idColumn} DESC`;
  }
  if (dbColumns.has("created_at")) {
    return `created_at DESC, ${idColumn} DESC`;
  }
  return `${idColumn} DESC`;
};

const normalizeItemRow = (row = {}) => ({
  ...row,
  id: row.id ?? row.item_id,
  inventory_id: row.inventory_id ?? null,
  inventoryName: row.inventoryName ?? row.inventory_name ?? "",
  itemName: row.itemName ?? row.item_name ?? "",
  itemCode: row.itemCode ?? row.item_code ?? "",
  serialNo: row.serialNo ?? row.serial_no ?? "",
  serialNo2: row.serialNo2 ?? row.serial_no2 ?? "",
  model: row.model ?? "",
  QRCode: row.QRCode ?? row.qr_code ?? row.qrcode ?? "",
  QRCode2: row.QRCode2 ?? row.qr_code2 ?? row.qrcode2 ?? "",
  location: row.location ?? "",
  status: row.status ?? "",
  ginNo: row.ginNo ?? row.gin_no ?? "",
  poNo: row.poNo ?? row.po_no ?? "",
  brand: row.brand ?? row.manufacturer ?? "",
  ginfile: row.ginfile ?? row.gin_file ?? "",
  value: row.value ?? null,
  purchaseDate: (() => {
    const resolved = resolveItemPurchaseDateFromRow(row);
    return resolved ? resolved.toISOString() : null;
  })(),
  warranty: row.warranty ?? "",
  supplier: row.supplier ?? "",
  funding: row.funding ?? "",
  updated_at: row.updated_at ?? null,
  created_at: row.created_at ?? null,
});

const findExistingGinFileByGinNo = async (ginNo) => {
  const normalized = String(ginNo || "").trim();
  if (!normalized) {
    return "";
  }

  const dbColumns = await ensureInventoryItemsColumns();
  const ginNoColumn = resolveDbColumn(dbColumns, ["ginNo", "gin_no"]);
  const ginfileColumn = resolveDbColumn(dbColumns, ["ginfile", "gin_file"]);
  if (!ginNoColumn || !ginfileColumn) {
    return "";
  }

  const orderClause = getItemsOrderClause(dbColumns);
  const [rows] = await pool.execute(
    `SELECT ${ginfileColumn} AS ginfile FROM ${DB_ITEMS_TABLE}
     WHERE LOWER(TRIM(${ginNoColumn})) = LOWER(?)
       AND ${ginfileColumn} IS NOT NULL
       AND TRIM(${ginfileColumn}) <> ''
     ORDER BY ${orderClause}
     LIMIT 1`,
    [normalized]
  );

  return String(rows[0]?.ginfile || "").trim();
};

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

const ensureForeignKeyRelationships = async () => {
  const [tableRows] = await pool.query("SHOW TABLES");
  const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));

  const relationships = [
    {
      table: DB_ITEMS_TABLE,
      column: "inventory_id",
      referencedTable: "inventories",
      referencedColumn: "id",
      constraintName: `fk_${DB_ITEMS_TABLE}_inventory`,
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "account_requests",
      column: "requested_department_id",
      referencedTable: "departments",
      referencedColumn: "id",
      constraintName: "fk_account_requests_requested_department",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "account_requests",
      column: "user_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_account_requests_user",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "inventory_creation_requests",
      column: "department_id",
      referencedTable: "departments",
      referencedColumn: "id",
      constraintName: "fk_inventory_creation_requests_department",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "inventory_creation_requests",
      column: "requested_by_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_inventory_creation_requests_requested_by",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "inventory_creation_requests",
      column: "incharge_user_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_inventory_creation_requests_incharge_user",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "inventory_creation_requests",
      column: "hod_user_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_inventory_creation_requests_hod_user",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "inventory_creation_requests",
      column: "admin_approved_by_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_inventory_creation_requests_admin_approved_by",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_requests",
      column: "requested_by_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_item_requests_requested_by",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_requests",
      column: "requested_inventory_id",
      referencedTable: "inventories",
      referencedColumn: "id",
      constraintName: "fk_item_requests_requested_inventory",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_requests",
      column: "department_id",
      referencedTable: "departments",
      referencedColumn: "id",
      constraintName: "fk_item_requests_department",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_requests",
      column: "inventory_department_id",
      referencedTable: "departments",
      referencedColumn: "id",
      constraintName: "fk_item_requests_inventory_department",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_requests",
      column: "hod_user_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_item_requests_hod_user",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_requests",
      column: "lab_hod_user_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_item_requests_lab_hod_user",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_requests",
      column: "requester_hod_recommended_by_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_item_requests_requester_hod_recommended_by",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_requests",
      column: "lab_hod_approved_by_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_item_requests_lab_hod_approved_by",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_requests",
      column: "hod_approved_by_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_item_requests_hod_approved_by",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_transfers",
      column: "item_id",
      referencedTable: DB_ITEMS_TABLE,
      referencedColumn: "id",
      constraintName: "fk_item_transfers_item",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    {
      table: "item_transfers",
      column: "from_inventory_id",
      referencedTable: "inventories",
      referencedColumn: "id",
      constraintName: "fk_item_transfers_from_inventory",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_transfers",
      column: "to_inventory_id",
      referencedTable: "inventories",
      referencedColumn: "id",
      constraintName: "fk_item_transfers_to_inventory",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_transfers",
      column: "initiated_by_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_item_transfers_initiated_by",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_disposals",
      column: "item_id",
      referencedTable: DB_ITEMS_TABLE,
      referencedColumn: "id",
      constraintName: "fk_item_disposals_item",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    {
      table: "item_disposals",
      column: "inventory_id",
      referencedTable: "inventories",
      referencedColumn: "id",
      constraintName: "fk_item_disposals_inventory",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_disposals",
      column: "initiated_by_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_item_disposals_initiated_by",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_repairs",
      column: "item_id",
      referencedTable: DB_ITEMS_TABLE,
      referencedColumn: "id",
      constraintName: "fk_item_repairs_item",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    {
      table: "item_repairs",
      column: "inventory_id",
      referencedTable: "inventories",
      referencedColumn: "id",
      constraintName: "fk_item_repairs_inventory",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "item_repairs",
      column: "initiated_by_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_item_repairs_initiated_by",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "password_reset_otps",
      column: "user_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_password_reset_otps_user",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "warranty_claims",
      column: "item_id",
      referencedTable: DB_ITEMS_TABLE,
      referencedColumn: "id",
      constraintName: "fk_warranty_claims_item",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    {
      table: "warranty_claims",
      column: "inventory_id",
      referencedTable: "inventories",
      referencedColumn: "id",
      constraintName: "fk_warranty_claims_inventory",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    {
      table: "warranty_claims",
      column: "initiated_by_id",
      referencedTable: "users",
      referencedColumn: "id",
      constraintName: "fk_warranty_claims_initiated_by",
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  ];

  for (const relationship of relationships) {
    if (!tableNames.has(relationship.table)) {
      continue;
    }

    if (!tableNames.has(relationship.referencedTable)) {
      console.log(
        `[schema] Skipping foreign key ${relationship.constraintName}: referenced table ${relationship.referencedTable} not found.`
      );
      continue;
    }

    try {
      const [columnRows] = await pool.query(`SHOW COLUMNS FROM ${relationship.table}`);
      const columnNames = new Set(columnRows.map((column) => column.Field));

      if (!columnNames.has(relationship.column)) {
        continue;
      }

      const [existingFkRows] = await pool.query(
        `SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
           AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [relationship.table, relationship.column]
      );
      const alreadyHasConstraint = existingFkRows.some((row) => row.CONSTRAINT_NAME === relationship.constraintName);

      if (alreadyHasConstraint) {
        continue;
      }

      const [invalidRows] = await pool.query(
        `SELECT COUNT(*) AS count
         FROM ${relationship.table}
         WHERE ${relationship.column} IS NOT NULL
           AND ${relationship.column} NOT IN (SELECT ${relationship.referencedColumn} FROM ${relationship.referencedTable})`
      );

      if (Number(invalidRows[0]?.count ?? 0) > 0) {
        console.log(
          `[schema] Skipping foreign key ${relationship.constraintName}: existing values do not reference ${relationship.referencedTable}.${relationship.referencedColumn}`
        );
        continue;
      }

      await pool.query(
        `ALTER TABLE ${relationship.table}
         ADD CONSTRAINT ${relationship.constraintName}
         FOREIGN KEY (${relationship.column})
         REFERENCES ${relationship.referencedTable}(${relationship.referencedColumn})
         ON DELETE ${relationship.onDelete}
         ON UPDATE ${relationship.onUpdate}`
      );
      console.log(`[schema] Added foreign key ${relationship.constraintName} on ${relationship.table}.${relationship.column}`);
    } catch (error) {
      console.warn(`[schema] Could not add foreign key ${relationship.constraintName}: ${error.message}`);
    }
  }
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

  if (inventoryItemColumns.has("status")) {
    const [statusColumnRows] = await pool.query(
      `SHOW COLUMNS FROM ${DB_ITEMS_TABLE} WHERE Field = 'status'`
    );
    const statusType = String(statusColumnRows[0]?.Type || "").toLowerCase();

    if (statusType.startsWith("enum")) {
      await pool.query(`
        UPDATE ${DB_ITEMS_TABLE}
        SET status = 'in-use'
        WHERE LOWER(COALESCE(status, '')) = 'issued'
      `);
      await pool.query(
        `ALTER TABLE ${DB_ITEMS_TABLE} MODIFY COLUMN status VARCHAR(50) DEFAULT 'available'`
      );
      console.log(`Migrated ${DB_ITEMS_TABLE}.status from ENUM to VARCHAR(50)`);
    }
  } else {
    await pool.query(
      `ALTER TABLE ${DB_ITEMS_TABLE} ADD COLUMN status VARCHAR(50) DEFAULT 'available'`
    );
    inventoryItemColumns.add("status");
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
  try {
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
    console.log("inventory_creation_requests table ensured");
  } catch (error) {
    console.error("Error creating inventory_creation_requests table:", error.message);
  }
};

const createItemRequestsTable = async () => {
  try {
    await pool.query(
      `
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
      `
    );
    console.log("item_requests table ensured");
  } catch (error) {
    console.error("Error creating item_requests table:", error.message);
  }
};

const validateRequiredFields = (item) => {
  if (!item.itemName?.trim()) {
    return "itemName is required";
  }
  return null;
};

const normalizeIdentifierValue = (value) => String(value ?? "").trim();

const buildItemIdentifierExcludeClause = (dbColumns, excludeItemId) => {
  const idColumn = getItemIdColumn(dbColumns);
  const normalizedExcludeId = Number(excludeItemId ?? 0);

  if (!idColumn || !Number.isInteger(normalizedExcludeId) || normalizedExcludeId <= 0) {
    return { clause: "", params: [] };
  }

  return { clause: ` AND ${idColumn} <> ?`, params: [normalizedExcludeId] };
};

const getAllDbColumnsForLogicalKey = (dbColumns, logicalKey) => {
  const aliases = ITEM_DB_COLUMN_ALIASES[logicalKey] || [logicalKey];
  return aliases.filter((alias) => dbColumns.has(alias));
};

const findExistingItemByIdentifierMatch = async (dbColumns, logicalKeys, value, excludeItemId = 0) => {
  const normalizedValue = normalizeIdentifierValue(value);

  if (!normalizedValue) {
    return null;
  }

  const keyList = Array.isArray(logicalKeys) ? logicalKeys : [logicalKeys];
  const usableColumns = [
    ...new Set(keyList.flatMap((logicalKey) => getAllDbColumnsForLogicalKey(dbColumns, logicalKey))),
  ];

  if (usableColumns.length === 0) {
    return null;
  }

  const { clause: excludeClause, params: excludeParams } = buildItemIdentifierExcludeClause(
    dbColumns,
    excludeItemId
  );
  const matchConditions = usableColumns.map((column) => `LOWER(TRIM(${column})) = LOWER(?)`);
  const matchParams = usableColumns.map(() => normalizedValue);

  const [rows] = await pool.execute(
    `SELECT ${getItemIdColumn(dbColumns)} AS id FROM ${DB_ITEMS_TABLE} WHERE (${matchConditions.join(" OR ")})${excludeClause} LIMIT 1`,
    [...matchParams, ...excludeParams]
  );

  return rows[0] ?? null;
};

const validateItemIdentifiers = async (dbColumns, identifiers = {}) => {
  const conflicts = {};
  const itemCode = normalizeIdentifierValue(identifiers.itemCode);
  const serialNo = normalizeIdentifierValue(identifiers.serialNo);
  const serialNo2 = normalizeIdentifierValue(identifiers.serialNo2);
  const excludeItemId = Number(identifiers.excludeItemId ?? 0);

  if (serialNo && serialNo2 && serialNo.toLowerCase() === serialNo2.toLowerCase()) 
  {
    conflicts.serialNo2 = "Serial Number 2 must be different from Serial Number.";
  }

  if (itemCode) {
    const existingCode = await findExistingItemByIdentifierMatch(
      dbColumns,
      ["itemCode"],
      itemCode,
      excludeItemId
    );

    if (existingCode) {      
      conflicts.itemCode = "This item code is already registered in the system.";
    }
    
  }

  if (serialNo) {
    const existingSerial = await findExistingItemByIdentifierMatch(
      dbColumns,
      ["serialNo", "serialNo2"],
      serialNo,
      excludeItemId
    );

    if (existingSerial) {
      conflicts.serialNo = "This serial number is already registered in the system.";
    }
  }
  

  if (serialNo2) {
    const existingSerial2 = await findExistingItemByIdentifierMatch(
      dbColumns,
      ["serialNo", "serialNo2"],
      serialNo2,
      excludeItemId
    );

    if (existingSerial2) {
      conflicts.serialNo2 = "This serial number is already registered in the system.";
    }
  }


  return {
    valid: Object.keys(conflicts).length === 0,
    conflicts,
  };
};

const formatItemIdentifierValidationError = (conflicts = {}) => {
  const messages = Object.values(conflicts).filter(Boolean);

  if (messages.length === 0) {
    return "Item identifiers must be unique.";
  }

  return messages.join(" ");
};

const buildItemNameKeywordFilter = (dbColumns, searchText = "") => {
  const trimmedSearch = String(searchText || "").trim();

  if (!trimmedSearch) {
    return { clause: "", params: [] };
  }

  const nameColumns = getAllDbColumnsForLogicalKey(dbColumns, "itemName");

  if (nameColumns.length === 0) {
    return { clause: "", params: [] };
  }

  const keywordSet = new Set();
  trimmedSearch
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((keyword) => {
      keywordSet.add(keyword);
      if (keyword.length > 3 && keyword.endsWith("s")) {
        keywordSet.add(keyword.slice(0, -1));
      } else if (keyword.length > 2) {
        keywordSet.add(`${keyword}s`);
      }
    });

  const matchClauses = [];
  const params = [];

  const appendNameMatch = (needle) => {
    const columnMatches = nameColumns.map((column) => `LOWER(COALESCE(${column}, '')) LIKE LOWER(?)`);
    matchClauses.push(`(${columnMatches.join(" OR ")})`);
    nameColumns.forEach(() => params.push(`%${needle}%`));
  };

  appendNameMatch(trimmedSearch);
  keywordSet.forEach((keyword) => appendNameMatch(keyword));

  return {
    clause: `(${matchClauses.join(" OR ")})`,
    params,
  };
};

const searchItemNames = async (dbColumns, query = "", limit = 10) => {
  const nameColumns = getAllDbColumnsForLogicalKey(dbColumns, "itemName");
  const nameColumn = nameColumns[0];

  if (!nameColumn) {
    return [];
  }

  const trimmedQuery = String(query || "").trim();

  if (!trimmedQuery) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const [rows] = await pool.execute(
    `SELECT DISTINCT TRIM(${nameColumn}) AS name
     FROM ${DB_ITEMS_TABLE}
     WHERE TRIM(${nameColumn}) <> '' AND LOWER(TRIM(${nameColumn})) LIKE LOWER(?)
     ORDER BY name ASC
     LIMIT ?`,
    [`${trimmedQuery}%`, safeLimit]
  );

  return rows.map((row) => String(row.name || "").trim()).filter(Boolean);
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
    system_administrator: "admin",
    system_admin: "admin",
    administrator: "admin",
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

const getUserPrimaryKeyColumn = (schema) => {
  if (schema.userColumns.has("user_id")) {
    return "user_id";
  }

  if (schema.userColumns.has("id")) {
    return "id";
  }

  return "user_id";
};

const getQualifiedUserIdColumn = (schema, alias) => {
  const column = getUserPrimaryKeyColumn(schema);
  return alias ? `${alias}.${column}` : column;
};

const getUserNameColumn = (schema) => {
  if (schema.userColumns.has("name")) {
    return "name";
  }

  if (schema.userColumns.has("full_name")) {
    return "full_name";
  }

  return "full_name";
};

const getQualifiedUserNameColumn = (schema, alias) => {
  const column = getUserNameColumn(schema);
  return alias ? `${alias}.${column}` : column;
};

const getInventoryRequestPrimaryKeyColumn = (columns) => {
  if (columns.has("inv_req_id")) {
    return "inv_req_id";
  }

  if (columns.has("id")) {
    return "id";
  }

  return "inv_req_id";
};

const getQualifiedInventoryRequestIdColumn = (columns, alias = "icr") =>
  `${alias}.${getInventoryRequestPrimaryKeyColumn(columns)}`;

const INVENTORY_APPROVAL_STATUS_TO_DB = {
  pending_staff: "pending_hod",
  pending_hod: "pending_hod",
  pending_registrar: "pending_registrar",
  pending_admin: "pending_admin",
  rejected: "rejected",
  approved_by_admin: "process completed",
  completed: "process completed",
  "process completed": "process completed",
};

const INVENTORY_APPROVAL_STATUS_FROM_DB = {
  "process completed": "approved_by_admin",
};

const VALID_DB_INVENTORY_APPROVAL_STATUSES = new Set([
  "pending_hod",
  "pending_registrar",
  "pending_admin",
  "rejected",
  "process completed",
]);

const toDbInventoryApprovalStatus = (status) => {
  const normalized = String(status || "").toLowerCase().trim();
  const mapped = INVENTORY_APPROVAL_STATUS_TO_DB[normalized] || normalized;
  return VALID_DB_INVENTORY_APPROVAL_STATUSES.has(mapped) ? mapped : "pending_hod";
};

const fromDbInventoryApprovalStatus = (status) => {
  const normalized = String(status || "").toLowerCase().trim();
  return INVENTORY_APPROVAL_STATUS_FROM_DB[normalized] || normalized;
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

const getInventoryLocationMapByIncharge = async () => {
  const [tableRows] = await pool.query("SHOW TABLES");
  const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));

  if (!tableNames.has("inventories")) {
    return new Map();
  }

  const inventoryColumns = await getTableColumns("inventories");
  const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

  if (!inventoryInchargeColumn || !inventoryColumns.has("location")) {
    return new Map();
  }

  const [rows] = await pool.execute(
    `
      SELECT ${inventoryInchargeColumn} AS user_id, TRIM(location) AS location
      FROM inventories
      WHERE ${inventoryInchargeColumn} IS NOT NULL
        AND TRIM(COALESCE(location, '')) <> ''
      ORDER BY location ASC
    `
  );

  const locationMap = new Map();
  rows.forEach((row) => {
    const userId = Number(row.user_id);
    const location = String(row.location || "").trim();
    if (!Number.isInteger(userId) || userId <= 0 || !location) {
      return;
    }

    const existing = locationMap.get(userId) || [];
    if (!existing.includes(location)) {
      existing.push(location);
      locationMap.set(userId, existing);
    }
  });

  return locationMap;
};

const resolveUserLocation = (locationMap, userId, userRowLocation = "") => {
  const fromUserColumn = String(userRowLocation ?? "").trim();
  if (fromUserColumn) {
    return fromUserColumn;
  }

  return (locationMap.get(Number(userId)) || []).join(", ");
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

const isAdminRole = (roleValue) => normalizeUserRole(roleValue) === "admin";

const ADMIN_ROLE_LITERALS = ["admin", "system administrator", "system_administrator", "system admin", "administrator"];

const getAdminRoleInListSql = () =>
  ADMIN_ROLE_LITERALS.map((role) => `'${role.replace(/'/g, "''")}'`).join(", ");

const getAdminUserIds = async (schema) => {
  const userIdColumn = getUserPrimaryKeyColumn(schema);
  const roleInList = getAdminRoleInListSql();

  if (schema.userColumns.has("role")) {
    const [rows] = await pool.execute(
      `SELECT ${userIdColumn} AS user_id FROM users WHERE LOWER(TRIM(COALESCE(role, ''))) IN (${roleInList})`
    );
    return rows.map((row) => Number(row.user_id)).filter((id) => Number.isInteger(id) && id > 0);
  }

  if (schema.userColumns.has("role_id")) {
    const [tableRows] = await pool.query("SHOW TABLES LIKE 'user_roles'");
    if (tableRows.length > 0) {
      const [rows] = await pool.execute(
        `
          SELECT u.${userIdColumn} AS user_id
          FROM users u
          INNER JOIN user_roles ur ON ur.role_id = u.role_id
          WHERE LOWER(TRIM(COALESCE(ur.user_role, ''))) IN (${roleInList})
        `
      );
      return rows.map((row) => Number(row.user_id)).filter((id) => Number.isInteger(id) && id > 0);
    }
  }

  return [];
};

const buildRequesterIsAdminSql = (schema) => {
  const inList = getAdminRoleInListSql();

  if (schema.userColumns.has("role")) {
    return `LOWER(TRIM(COALESCE(rb.role, ''))) IN (${inList})`;
  }

  if (schema.userColumns.has("role_id")) {
    return `LOWER(TRIM(COALESCE(rbur.user_role, ''))) IN (${inList})`;
  }

  return "0 = 1";
};

const usesUserRolesForRequester = (schema) =>
  schema.userColumns.has("role_id") && !schema.userColumns.has("role");

const resolveRequestingUserRole = async (schema, userId) => {
  const normalizedUserId = Number(userId ?? 0);

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return null;
  }

  const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
  const roleSelection = schema.userColumns.has("role")
    ? "role AS role"
    : schema.hasUserRolesTable
      ? "role_id AS role_id"
      : null;

  if (!roleSelection) {
    return null;
  }

  const [rows] = await pool.execute(
    `SELECT ${roleSelection} FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
    [normalizedUserId]
  );

  if (rows.length === 0) {
    return null;
  }

  if (schema.userColumns.has("role")) {
    return normalizeUserRole(rows[0].role);
  }

  const [roleRows] = await pool.execute(
    "SELECT user_role FROM user_roles WHERE role_id = ? LIMIT 1",
    [rows[0].role_id]
  );

  return normalizeUserRole(roleRows[0]?.user_role ?? null);
};

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

const resolveDepartmentId = async (schema, departmentInput) => {
  if (!schema.hasDepartmentsTable || departmentInput == null || departmentInput === "") {
    return null;
  }

  const departmentIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
  const departmentNameColumn = schema.departmentColumns.has("name") ? "name" : "department_name";
  const departmentCodeColumn = schema.departmentColumns.has("code") ? "code" : null;
  const normalizedInput = String(departmentInput).trim();

  if (!normalizedInput) {
    return null;
  }

  const numericId = Number(normalizedInput);
  if (Number.isInteger(numericId) && numericId > 0) {
    const [idRows] = await pool.execute(
      `SELECT ${departmentIdColumn} AS id FROM departments WHERE ${departmentIdColumn} = ? LIMIT 1`,
      [numericId]
    );

    if (idRows[0]?.id) {
      return idRows[0].id;
    }
  }

  const [departmentRows] = await pool.execute(
    `SELECT ${departmentIdColumn} AS id FROM departments WHERE LOWER(${departmentNameColumn}) = ? LIMIT 1`,
    [normalizedInput.toLowerCase()]
  );

  if (departmentRows[0]?.id) {
    return departmentRows[0].id;
  }

  if (departmentCodeColumn) {
    const [codeRows] = await pool.execute(
      `SELECT ${departmentIdColumn} AS id FROM departments WHERE LOWER(${departmentCodeColumn}) = ? LIMIT 1`,
      [normalizedInput.toLowerCase()]
    );

    return codeRows[0]?.id ?? null;
  }

  return null;
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

const addAccountRequestColumnIfMissing = async (columns, columnName, definition, preferredAfterColumn = null) => {
  if (columns.has(columnName)) {
    return;
  }

  const afterColumn = preferredAfterColumn && columns.has(preferredAfterColumn)
    ? preferredAfterColumn
    : null;
  const afterClause = afterColumn ? ` AFTER ${afterColumn}` : "";

  await pool.query(
    `ALTER TABLE account_requests ADD COLUMN ${columnName} ${definition}${afterClause}`
  );
  columns.add(columnName);
};

const ensureAccountRequestsTable = async () => {
  await createAccountRequestsTable();
  const accountRequestColumns = await getTableColumns("account_requests");

  await addAccountRequestColumnIfMissing(
    accountRequestColumns,
    "requested_password",
    "VARCHAR(255) NULL",
    "requested_department_id"
  );
  await addAccountRequestColumnIfMissing(
    accountRequestColumns,
    "requested_designation",
    "VARCHAR(255) NULL",
    "requested_password"
  );
  await addAccountRequestColumnIfMissing(
    accountRequestColumns,
    "requested_mobile_no",
    "VARCHAR(50) NULL",
    "requested_designation"
  );
  await addAccountRequestColumnIfMissing(
    accountRequestColumns,
    "requested_off_ext",
    "VARCHAR(50) NULL",
    "requested_mobile_no"
  );
  await addAccountRequestColumnIfMissing(
    accountRequestColumns,
    "dept_head_approved_by_id",
    "INT NULL",
    "dept_head_approved_date"
  );
  await addAccountRequestColumnIfMissing(
    accountRequestColumns,
    "dean_approved_date",
    "TIMESTAMP NULL",
    "dept_head_approved_by_id"
  );
  await addAccountRequestColumnIfMissing(
    accountRequestColumns,
    "dean_approved_by_id",
    "INT NULL",
    "dean_approved_date"
  );
  await addAccountRequestColumnIfMissing(
    accountRequestColumns,
    "request_reason",
    "VARCHAR(500) NULL",
    accountRequestColumns.has("rejection_date") ? "rejection_date" : "rejection_reason"
  );
  await addAccountRequestColumnIfMissing(
    accountRequestColumns,
    "submitted_by_role",
    "VARCHAR(50) NULL",
    accountRequestColumns.has("request_reason") ? "request_reason" : "user_id"
  );

  return accountRequestColumns;
};

const ensureInventoryCreationRequestsTable = async () => {
  await createInventoryCreationRequestsTable();
  const inventoryRequestColumns = await getTableColumns("inventory_creation_requests");

  if (!inventoryRequestColumns.has("request_type")) {
    const afterClause = getInventoryRequestPrimaryKeyColumn(inventoryRequestColumns)
      ? `AFTER ${getInventoryRequestPrimaryKeyColumn(inventoryRequestColumns)}`
      : "";
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
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN approval_status VARCHAR(50) DEFAULT 'pending_hod' ${afterClause}`);
    inventoryRequestColumns.add("approval_status");
  } else {
    const [approvalStatusColumnRows] = await pool.query(
      "SHOW COLUMNS FROM inventory_creation_requests WHERE Field = 'approval_status'"
    );
    const approvalStatusType = String(approvalStatusColumnRows[0]?.Type || "").toLowerCase();

    if (approvalStatusType.startsWith("enum")) {
      await pool.query(
        "ALTER TABLE inventory_creation_requests MODIFY COLUMN approval_status VARCHAR(50) NOT NULL DEFAULT 'pending_hod'"
      );
      console.log("Migrated inventory_creation_requests.approval_status from ENUM to VARCHAR(50)");
    }
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

  if (!inventoryRequestColumns.has("submitted_by_role")) {
    const afterClause = inventoryRequestColumns.has("requested_by_id") ? "AFTER requested_by_id" : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN submitted_by_role VARCHAR(50) NULL ${afterClause}`);
    inventoryRequestColumns.add("submitted_by_role");
  }

  if (!inventoryRequestColumns.has("target_inventory_id")) {
    const afterClause = inventoryRequestColumns.has("created_inventory_id")
      ? "AFTER created_inventory_id"
      : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN target_inventory_id INT NULL ${afterClause}`);
    inventoryRequestColumns.add("target_inventory_id");
  }

  if (!inventoryRequestColumns.has("previous_incharge_user_id")) {
    const afterClause = inventoryRequestColumns.has("incharge_user_id")
      ? "AFTER incharge_user_id"
      : "";
    await pool.query(`ALTER TABLE inventory_creation_requests ADD COLUMN previous_incharge_user_id INT NULL ${afterClause}`);
    inventoryRequestColumns.add("previous_incharge_user_id");
  }

  if (inventoryRequestColumns.has("submitted_by_role") && inventoryRequestColumns.has("requested_by_id")) {
    const schema = await getAuthSchema();
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const requesterAdminMatch = buildRequesterIsAdminSql(schema).replace(/\brb\./g, "u.").replace(/\brbur\./g, "ur.");

    if (requesterAdminMatch !== "0 = 1") {
      const roleJoin = !schema.userColumns.has("role") && schema.hasUserRolesTable
        ? "LEFT JOIN user_roles ur ON ur.role_id = u.role_id"
        : "";

      await pool.query(
        `
          UPDATE inventory_creation_requests icr
          INNER JOIN users u ON u.${userIdColumn} = icr.requested_by_id
          ${roleJoin}
          SET icr.submitted_by_role = 'admin'
          WHERE icr.submitted_by_role IS NULL
            AND ${requesterAdminMatch}
        `
      );
    }
  }

  return inventoryRequestColumns;
};

const addWorkflowColumnIfMissing = async (tableName, columns, columnName, definition) => {
  if (columns.has(columnName)) {
    return;
  }

  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  columns.add(columnName);
};

const formatIssueDateLabel = (value) => {
  if (!value) {
    return new Date().toISOString().split("T")[0];
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).split("T")[0];
  }

  return date.toISOString().split("T")[0];
};

const buildIssueRemark = (requestId, issuedDate) =>
  `Item request ID: REQ-${requestId} | Issued date: ${formatIssueDateLabel(issuedDate)}`;

const applyIssuedItemSideEffects = async ({
  requestId,
  inventoryItemId,
  requesterName,
  issuedDate,
  inventoryItem = null,
}) => {
  const inventoryItemColumns = await ensureInventoryItemsColumns();
  const itemIdColumn = getItemIdColumn(inventoryItemColumns);

  if (!Number.isInteger(inventoryItemId) || inventoryItemId <= 0) {
    return false;
  }

  let itemRow = inventoryItem;
  if (!itemRow) {
    const [itemRows] = await pool.execute(
      `SELECT * FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} = ? LIMIT 1`,
      [inventoryItemId]
    );

    if (itemRows.length === 0) {
      return false;
    }

    itemRow = itemRows[0];
  }

  const itemUpdateParts = [];
  const itemUpdateValues = [];
  const trimmedRequesterName = String(requesterName || "").trim();

  if (inventoryItemColumns.has("status")) {
    itemUpdateParts.push("status = ?");
    itemUpdateValues.push("in-use");
  }

  if (inventoryItemColumns.has("location") && trimmedRequesterName) {
    itemUpdateParts.push("location = ?");
    itemUpdateValues.push(trimmedRequesterName);
  }

  if (inventoryItemColumns.has("remarks")) {
    const issueRemark = buildIssueRemark(requestId, issuedDate);
    const existingRemarks = String(itemRow.remarks || "").trim();
    const reqTag = `REQ-${requestId}`;
    const updatedRemarks = existingRemarks.includes(reqTag)
      ? existingRemarks
      : existingRemarks
        ? `${existingRemarks}\n${issueRemark}`
        : issueRemark;
    itemUpdateParts.push("remarks = ?");
    itemUpdateValues.push(updatedRemarks);
  }

  if (itemUpdateParts.length === 0) {
    return false;
  }

  itemUpdateValues.push(inventoryItemId);
  await pool.execute(
    `UPDATE ${DB_ITEMS_TABLE} SET ${itemUpdateParts.join(", ")} WHERE ${itemIdColumn} = ?`,
    itemUpdateValues
  );
  return true;
};

const backfillIssuedInventoryItemDetails = async (itemRequestColumns) => {
  if (
    !itemRequestColumns.has("approval_status")
    || !itemRequestColumns.has("allocated_inventory_item_id")
    || !itemRequestColumns.has("requested_by_id")
  ) {
    return;
  }

  const schema = await getAuthSchema();
  const userIdColumn = getUserPrimaryKeyColumn(schema);
  const userNameColumn = getUserNameColumn(schema);

  if (!userNameColumn) {
    return;
  }

  const returnedFilter = itemRequestColumns.has("returned_date")
    ? "AND ir.returned_date IS NULL"
    : "";

  const [issuedRows] = await pool.query(`
    SELECT
      ir.id,
      ir.issued_date,
      ir.allocated_inventory_item_id,
      u.${userNameColumn} AS requester_name
    FROM item_requests ir
    INNER JOIN users u ON u.${userIdColumn} = ir.requested_by_id
    WHERE LOWER(COALESCE(ir.approval_status, '')) = 'approved'
      AND ir.allocated_inventory_item_id IS NOT NULL
      ${returnedFilter}
  `);

  for (const row of issuedRows) {
    const inventoryItemId = Number(row.allocated_inventory_item_id ?? 0);
    const requesterName = String(row.requester_name || "").trim();

    if (!Number.isInteger(inventoryItemId) || inventoryItemId <= 0 || !requesterName) {
      continue;
    }

    await applyIssuedItemSideEffects({
      requestId: row.id,
      inventoryItemId,
      requesterName,
      issuedDate: row.issued_date,
    });
  }
};

const ensureItemRequestsTable = async () => {
  await createItemRequestsTable();
  const itemRequestColumns = await getTableColumns("item_requests");

  const columnDefinitions = [
    ["item_name", "VARCHAR(255) NOT NULL"],
    ["quantity", "INT NOT NULL DEFAULT 1"],
    ["priority", "VARCHAR(50) DEFAULT 'normal'"],
    ["specification", "TEXT NULL"],
    ["reason", "TEXT NULL"],
    ["requested_by_id", "INT NOT NULL"],
    ["requested_inventory_id", "INT NULL"],
    ["inventory_location", "VARCHAR(255) NULL"],
    ["department_id", "INT NULL"],
    ["inventory_department_id", "INT NULL"],
    ["hod_user_id", "INT NULL"],
    ["lab_hod_user_id", "INT NULL"],
    ["approval_status", "VARCHAR(50) DEFAULT 'pending_requester_hod'"],
    ["requested_date", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"],
    ["required_by_date", "DATE NULL"],
    ["requester_hod_recommended_date", "TIMESTAMP NULL"],
    ["requester_hod_recommended_by_id", "INT NULL"],
    ["lab_hod_approved_date", "TIMESTAMP NULL"],
    ["lab_hod_approved_by_id", "INT NULL"],
    ["hod_approved_date", "TIMESTAMP NULL"],
    ["hod_approved_by_id", "INT NULL"],
    ["rejection_reason", "VARCHAR(500) NULL"],
    ["rejection_date", "TIMESTAMP NULL"],
    ["inventory_officer_user_id", "INT NULL"],
    ["issued_date", "TIMESTAMP NULL"],
    ["issued_by_id", "INT NULL"],
    ["allocated_inventory_id", "INT NULL"],
    ["allocated_quantity", "INT NULL"],
    ["allocated_date", "TIMESTAMP NULL"],
    ["allocated_inventory_item_id", "INT NULL"],
    ["returned_date", "TIMESTAMP NULL"],
    ["returned_by_id", "INT NULL"],
  ];

  for (const [columnName, definition] of columnDefinitions) {
    await addWorkflowColumnIfMissing("item_requests", itemRequestColumns, columnName, definition);
  }

  if (itemRequestColumns.has("approval_status")) {
    const [approvalStatusColumnRows] = await pool.query(
      "SHOW COLUMNS FROM item_requests WHERE Field = 'approval_status'"
    );
    const approvalStatusType = String(approvalStatusColumnRows[0]?.Type || "").toLowerCase();

    if (approvalStatusType.startsWith("enum")) {
      await pool.query(
        "ALTER TABLE item_requests MODIFY COLUMN approval_status VARCHAR(50) NOT NULL DEFAULT 'pending_requester_hod'"
      );
      console.log("Migrated item_requests.approval_status from ENUM to VARCHAR(50)");
    }

    await pool.query(`
      UPDATE item_requests
      SET approval_status = 'pending_requester_hod'
      WHERE LOWER(COALESCE(approval_status, '')) = 'pending_hod'
    `);

    await pool.query(`
      UPDATE item_requests
      SET approval_status = 'approved_to_issue'
      WHERE LOWER(COALESCE(approval_status, '')) = 'pending_issue'
    `);
  }

  if (
    itemRequestColumns.has("requested_inventory_id") &&
    itemRequestColumns.has("inventory_officer_user_id") &&
    itemRequestColumns.has("approval_status")
  ) {
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

    if (inventoryIdColumn && inventoryInchargeColumn) {
      const notIssuedParts = [];
      if (itemRequestColumns.has("issued_date")) {
        notIssuedParts.push("ir.issued_date IS NULL");
      }
      if (itemRequestColumns.has("allocated_inventory_item_id")) {
        notIssuedParts.push("ir.allocated_inventory_item_id IS NULL");
      }
      const notIssuedClause = notIssuedParts.length > 0
        ? `AND (${notIssuedParts.join(" AND ")})`
        : "";

      await pool.query(`
        UPDATE item_requests ir
        INNER JOIN inventories i ON i.${inventoryIdColumn} = ir.requested_inventory_id
        SET ir.approval_status = 'approved_to_issue',
            ir.inventory_officer_user_id = i.${inventoryInchargeColumn}
        WHERE LOWER(COALESCE(ir.approval_status, '')) = 'approved'
          AND (ir.inventory_officer_user_id IS NULL OR ir.inventory_officer_user_id = 0)
          AND i.${inventoryInchargeColumn} IS NOT NULL
          ${notIssuedClause}
      `);
    }
  }

  if (
    itemRequestColumns.has("requested_inventory_id") &&
    itemRequestColumns.has("inventory_department_id") &&
    itemRequestColumns.has("lab_hod_user_id")
  ) {
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);

    if (inventoryIdColumn && inventoryColumns.has("department_id")) {
      await pool.query(`
        UPDATE item_requests ir
        INNER JOIN inventories i ON i.${inventoryIdColumn} = ir.requested_inventory_id
        SET ir.inventory_department_id = i.department_id
        WHERE ir.inventory_department_id IS NULL
          AND i.department_id IS NOT NULL
      `);
    }

    const schema = await getAuthSchema();
    const [rowsMissingLabHod] = await pool.query(`
      SELECT id, inventory_department_id
      FROM item_requests
      WHERE lab_hod_user_id IS NULL
        AND inventory_department_id IS NOT NULL
    `);

    for (const row of rowsMissingLabHod) {
      const labHodUserId = await resolveDepartmentHeadUserId(schema, Number(row.inventory_department_id ?? 0));
      if (labHodUserId) {
        await pool.execute("UPDATE item_requests SET lab_hod_user_id = ? WHERE id = ?", [labHodUserId, row.id]);
      }
    }
  }

  await backfillIssuedInventoryItemDetails(itemRequestColumns);

  return itemRequestColumns;
};

const formatItemRequestDate = (value) => {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().split("T")[0];
};

const mapItemRequestRow = (row, extras = {}) => ({
  id: row.id,
  itemName: row.item_name ?? row.itemName ?? "",
  quantity: Number(row.quantity ?? 0),
  priority: String(row.priority || "normal").toLowerCase(),
  specification: row.specification || "",
  reason: row.reason || "",
  requestedInventoryId: row.requested_inventory_id ?? row.requested_from_inventory_id ?? null,
  inventoryLocation: row.inventory_location || extras.inventoryLocation || "",
  inventoryName: extras.inventoryName || row.inventory_name || "",
  departmentId: row.department_id ?? null,
  departmentName: extras.departmentName || row.department_name || "",
  inventoryDepartmentId: row.inventory_department_id ?? null,
  inventoryDepartmentName: extras.inventoryDepartmentName || row.inventory_department_name || "",
  requestedById: row.requested_by_id ?? null,
  requestedByName: extras.requestedByName || row.requested_by_name || "",
  hodUserId: row.hod_user_id ?? null,
  labHodUserId: row.lab_hod_user_id ?? null,
  inventoryOfficerUserId: row.inventory_officer_user_id ?? null,
  approvalStatus: String(row.approval_status || "pending_requester_hod").trim().toLowerCase(),
  requestedDate: formatItemRequestDate(row.requested_date),
  requiredByDate: formatItemRequestDate(row.required_by_date),
  requesterHodRecommendedDate: formatItemRequestDate(row.requester_hod_recommended_date),
  labHodApprovedDate: formatItemRequestDate(row.lab_hod_approved_date),
  hodApprovedDate: formatItemRequestDate(row.lab_hod_approved_date || row.hod_approved_date),
  issuedDate: formatItemRequestDate(row.issued_date),
  allocatedDate: formatItemRequestDate(row.allocated_date),
  allocatedQuantity: Number(row.allocated_quantity ?? 0) || null,
  allocatedInventoryId: row.allocated_inventory_id ?? null,
  allocatedInventoryItemId: row.allocated_inventory_item_id ?? null,
  returnedDate: formatItemRequestDate(row.returned_date),
  rejectionDate: formatItemRequestDate(row.rejection_date),
  rejectionReason: row.rejection_reason || "",
  allocatedItem: row.allocated_item_record_name || row.allocated_item_name
    ? {
      id: row.allocated_inventory_item_id ?? null,
      itemName: row.allocated_item_record_name ?? row.allocated_item_name ?? "",
      itemCode: row.allocated_item_code ?? "",
      serialNo: row.allocated_item_serial_no ?? "",
      model: row.allocated_item_model ?? "",
      ginNo: row.allocated_item_gin_no ?? "",
      status: row.allocated_item_status ?? "",
      location: row.allocated_item_location ?? "",
      remarks: row.allocated_item_remarks ?? "",
    }
    : null,
});

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

const buildInventoryAliasNameSelect = (alias, inventoryColumns, outputColumn) => {
  const nameColumn = getInventoryNameColumn(inventoryColumns);

  if (!nameColumn) {
    return `'-' AS ${outputColumn}`;
  }

  return `${alias}.${nameColumn} AS ${outputColumn}`;
};

const buildInventoryAliasJoin = (alias, inventoryColumns, foreignKeyExpr) => {
  const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);

  if (!inventoryIdColumn) {
    return "";
  }

  return `LEFT JOIN inventories ${alias} ON ${alias}.${inventoryIdColumn} = ${foreignKeyExpr}`;
};

const buildInventoryTransferJoin = (alias, inventoryColumns, transferForeignKeyColumn) =>
  buildInventoryAliasJoin(alias, inventoryColumns, `it.${transferForeignKeyColumn}`);

const buildItemAliasJoin = (itemColumns, foreignKeyExpr, alias = "ii") => {
  if (!itemColumns || itemColumns.size === 0) {
    return "";
  }

  const itemIdColumn = getItemIdColumn(itemColumns);
  return `LEFT JOIN ${DB_ITEMS_TABLE} ${alias} ON ${alias}.${itemIdColumn} = ${foreignKeyExpr}`;
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
    const requestTypeFilter = String(req.query?.requestType ?? "").trim().toLowerCase();
    const adminQueue = String(req.query?.adminQueue ?? "").trim().toLowerCase() === "true";
    const inchargeUserId = Number(req.query?.inchargeUserId ?? 0);
    const requestedByUserId = Number(req.query?.requestedByUserId ?? req.query?.userId ?? 0);
    const pendingOnly = String(req.query?.pendingOnly ?? "").trim().toLowerCase() === "true";
    const hasHodFilter = Number.isInteger(hodUserId) && hodUserId > 0 && inventoryRequestColumns.has("hod_user_id");
    const hasInchargeFilter =
      Number.isInteger(inchargeUserId) &&
      inchargeUserId > 0 &&
      inventoryRequestColumns.has("incharge_user_id");
    const hasRequestedByFilter =
      Number.isInteger(requestedByUserId) &&
      requestedByUserId > 0 &&
      inventoryRequestColumns.has("requested_by_id");

    if (
      !hasHodFilter &&
      !approvalStatusFilter &&
      !requestTypeFilter &&
      !adminQueue &&
      !hasInchargeFilter &&
      !hasRequestedByFilter
    ) {
      return res.json({ success: true, requests: [] });
    }

    const departmentJoinIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
    const departmentNameColumn = schema.departmentColumns.has("name")
      ? "d.name"
      : schema.departmentColumns.has("department_name")
        ? "d.department_name"
        : "NULL";
    const userIdColumn = getUserPrimaryKeyColumn(schema);
    const userNameColumn = getUserNameColumn(schema);
    const inventoryRequestIdColumn = getQualifiedInventoryRequestIdColumn(inventoryRequestColumns, "icr");

    const whereParts = [];
    const params = [];

    if (hasHodFilter) {
      whereParts.push("icr.hod_user_id = ?");
      params.push(hodUserId);
    }

    if (Number.isInteger(departmentIdFilter) && departmentIdFilter > 0 && inventoryRequestColumns.has("department_id")) {
      whereParts.push("icr.department_id = ?");
      params.push(departmentIdFilter);
    }

    if (approvalStatusFilter && inventoryRequestColumns.has("approval_status")) {
      whereParts.push("LOWER(COALESCE(icr.approval_status, '')) = ?");
      params.push(toDbInventoryApprovalStatus(approvalStatusFilter));
    }

    if (requestTypeFilter && inventoryRequestColumns.has("request_type")) {
      whereParts.push("LOWER(COALESCE(icr.request_type, '')) = ?");
      params.push(requestTypeFilter);
    }

    if (hasInchargeFilter || hasRequestedByFilter) {
      const staffIdentityParts = [];

      if (hasInchargeFilter) {
        staffIdentityParts.push("icr.incharge_user_id = ?");
        params.push(inchargeUserId);
      }

      if (hasRequestedByFilter) {
        staffIdentityParts.push("icr.requested_by_id = ?");
        params.push(requestedByUserId);
      }

      whereParts.push(
        staffIdentityParts.length > 1
          ? `(${staffIdentityParts.join(" OR ")})`
          : staffIdentityParts[0]
      );

      if (pendingOnly) {
        if (inventoryRequestColumns.has("created_inventory_id")) {
          whereParts.push("(icr.created_inventory_id IS NULL OR icr.created_inventory_id = 0)");
        }
        if (inventoryRequestColumns.has("approval_status")) {
          whereParts.push("LOWER(COALESCE(icr.approval_status, '')) NOT IN ('rejected')");
        }
      }
    }

    if (adminQueue && inventoryRequestColumns.has("approval_status")) {
      const inProgressStatuses = ["pending_hod", "pending_staff", "pending_registrar", "approved_by_hod"];
      const inProgressPlaceholders = inProgressStatuses.map(() => "?").join(", ");
      const inProgressDbStatuses = inProgressStatuses.map((status) => toDbInventoryApprovalStatus(status));
      const adminUserIds = await getAdminUserIds(schema);
      const adminIdentityParts = [];

      if (inventoryRequestColumns.has("submitted_by_role")) {
        adminIdentityParts.push("LOWER(COALESCE(icr.submitted_by_role, '')) = 'admin'");
      }

      if (adminUserIds.length > 0 && inventoryRequestColumns.has("requested_by_id")) {
        adminIdentityParts.push(
          `icr.requested_by_id IN (${adminUserIds.map(() => "?").join(", ")})`
        );
      }

      const adminIdentityMatch = adminIdentityParts.length > 0
        ? `(${adminIdentityParts.join(" OR ")})`
        : "0 = 1";

      whereParts.push(
        `(
          LOWER(COALESCE(icr.approval_status, '')) = ?
          OR (
            ${adminIdentityMatch}
            AND LOWER(COALESCE(icr.approval_status, '')) IN (${inProgressPlaceholders})
          )
        )`
      );
      params.push(
        toDbInventoryApprovalStatus("pending_admin"),
        ...adminUserIds,
        ...inProgressDbStatuses
      );
    }

    const requestedDateCol = inventoryRequestColumns.has("requested_date") ? "icr.requested_date" : "icr.created_date";
    const nameCol = inventoryRequestColumns.has("name") ? "icr.name" : "''";
    const locationCol = inventoryRequestColumns.has("location") ? "icr.location" : "NULL";
    const reasonCol = inventoryRequestColumns.has("reason") ? "icr.reason" : "NULL";
    const requestTypeCol = inventoryRequestColumns.has("request_type") ? "icr.request_type" : "'new_inventory_creation'";
    const statusCol = inventoryRequestColumns.has("approval_status") ? "icr.approval_status" : "'pending_hod'";
    const submittedByRoleCol = inventoryRequestColumns.has("submitted_by_role")
      ? "icr.submitted_by_role"
      : "NULL AS submitted_by_role";
    const deptIdCol = inventoryRequestColumns.has("department_id") ? "icr.department_id" : "NULL";
    const requestedByCol = inventoryRequestColumns.has("requested_by_id") ? "icr.requested_by_id" : "NULL";
    const inchargeCol = inventoryRequestColumns.has("incharge_user_id") ? "icr.incharge_user_id" : "NULL";
    const hodUserIdCol = inventoryRequestColumns.has("hod_user_id") ? "icr.hod_user_id" : "NULL";

    const departmentJoin = schema.hasDepartmentsTable && inventoryRequestColumns.has("department_id")
      ? `LEFT JOIN departments d ON d.${departmentJoinIdColumn} = icr.department_id`
      : "";
    const requesterJoin = inventoryRequestColumns.has("requested_by_id")
      ? `LEFT JOIN users rb ON rb.${userIdColumn} = icr.requested_by_id`
      : "";
    const requesterRoleJoin = usesUserRolesForRequester(schema)
      ? "LEFT JOIN user_roles rbur ON rbur.role_id = rb.role_id"
      : "";
    const requesterRoleSelection = schema.userColumns.has("role")
      ? "rb.role AS requester_role"
      : usesUserRolesForRequester(schema)
        ? "rbur.user_role AS requester_role"
        : "NULL AS requester_role";
    const inchargeJoin = inventoryRequestColumns.has("incharge_user_id")
      ? `LEFT JOIN users inch ON inch.${userIdColumn} = icr.incharge_user_id`
      : "";
    const previousInchargeJoin = inventoryRequestColumns.has("previous_incharge_user_id")
      ? `LEFT JOIN users prev_inch ON prev_inch.${userIdColumn} = icr.previous_incharge_user_id`
      : "";
    const hodApproverJoin = inventoryRequestColumns.has("hod_approved_by_id")
      ? `LEFT JOIN users hod ON hod.${userIdColumn} = icr.hod_approved_by_id`
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
    const previousInchargeUserIdSelect = inventoryRequestColumns.has("previous_incharge_user_id")
      ? "icr.previous_incharge_user_id"
      : "NULL AS previous_incharge_user_id";
    const previousInchargeNameSelect = inventoryRequestColumns.has("previous_incharge_user_id")
      ? `prev_inch.${userNameColumn} AS previous_incharge_name`
      : "NULL AS previous_incharge_name";
    const targetInventoryIdSelect = inventoryRequestColumns.has("target_inventory_id")
      ? "icr.target_inventory_id"
      : "NULL AS target_inventory_id";
    const hodApprovedBySelect = inventoryRequestColumns.has("hod_approved_by_id")
      ? `hod.${userNameColumn} AS hod_approved_by_name`
      : "NULL AS hod_approved_by_name";
    const hodApprovedDateSelect = inventoryRequestColumns.has("hod_approved_date")
      ? "icr.hod_approved_date"
      : "NULL AS hod_approved_date";
    const createdInventoryIdSelect = inventoryRequestColumns.has("created_inventory_id")
      ? "icr.created_inventory_id"
      : "NULL AS created_inventory_id";

    const [rows] = await pool.execute(
      `
        SELECT
          ${inventoryRequestIdColumn} AS id,
          ${nameCol} AS name,
          ${locationCol} AS location,
          ${deptIdCol} AS department_id,
          ${departmentNameSelect},
          ${requestedByCol} AS requested_by_id,
          ${inchargeCol} AS incharge_user_id,
          ${previousInchargeUserIdSelect},
          ${hodUserIdCol} AS hod_user_id,
          ${requestedByNameSelect},
          ${inchargeNameSelect},
          ${previousInchargeNameSelect},
          ${targetInventoryIdSelect},
          ${hodApprovedBySelect},
          ${hodApprovedDateSelect},
          ${createdInventoryIdSelect},
          ${requestTypeCol} AS request_type,
          ${statusCol} AS approval_status,
          ${reasonCol} AS reason,
          ${requestedDateCol} AS requested_date,
          ${requesterRoleSelection},
          ${submittedByRoleCol}
        FROM inventory_creation_requests icr
        ${departmentJoin}
        ${requesterJoin}
        ${requesterRoleJoin}
        ${inchargeJoin}
        ${previousInchargeJoin}
        ${hodApproverJoin}
        WHERE ${whereParts.join(" AND ")}
        ORDER BY ${requestedDateCol} DESC, ${inventoryRequestIdColumn} DESC
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
        approvalStatus: fromDbInventoryApprovalStatus(row.approval_status || "pending_hod"),
        requestedDate: row.requested_date ? new Date(row.requested_date).toISOString().split("T")[0] : "",
        requestedById: row.requested_by_id ?? null,
        requestedByName: row.requested_by_name || "-",
        inchargeUserId: row.incharge_user_id ?? null,
        inchargeName: row.incharge_name || "-",
        previousInchargeUserId: row.previous_incharge_user_id ?? null,
        previousInchargeName: row.previous_incharge_name || "-",
        targetInventoryId: row.target_inventory_id ?? null,
        hodUserId: row.hod_user_id ?? null,
        hodApprovedBy: row.hod_approved_by_name || "-",
        hodApprovedDate: row.hod_approved_date
          ? new Date(row.hod_approved_date).toISOString().split("T")[0]
          : "",
        createdInventoryId: row.created_inventory_id ?? null,
        reason: row.reason || "",
        submittedByRole: normalizeUserRole(row.submitted_by_role || row.requester_role || ""),
        isAdminSubmitted: isAdminRole(row.submitted_by_role || row.requester_role || ""),
        canAdminAct: fromDbInventoryApprovalStatus(row.approval_status || "pending_hod") === "pending_admin",
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
    const userLocationColumn = schema.userColumns.has("location") ? "u.location" : "NULL";

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
          ${userLocationColumn} AS user_location,
          ${createdDateColumn} AS created_date,
          ${lastLoginColumn} AS last_login
        FROM users u
        ${roleJoin}
        ${departmentJoin}
        ${designationJoin}
        ORDER BY ${createdDateColumn === "NULL" ? "u.email" : createdDateColumn} DESC
      `
    );

    const [assignmentCounts, inventoryLocationMap] = await Promise.all([
      getInventoryAssignmentCounts(),
      getInventoryLocationMapByIncharge(),
    ]);
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
      location: resolveUserLocation(inventoryLocationMap, row.id, row.user_location),
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
    const adminQueue = String(req.query?.adminQueue ?? "").trim().toLowerCase() === "true";
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

    if (adminQueue && accountRequestColumns.has("approval_status")) {
      const submittedByRoleClause = accountRequestColumns.has("submitted_by_role")
        ? "LOWER(COALESCE(ar.submitted_by_role, '')) = 'admin'"
        : "0 = 1";
      whereClauses.push(
        `(
          LOWER(COALESCE(ar.approval_status, '')) = 'pending_admin'
          OR (
            ${submittedByRoleClause}
            AND LOWER(COALESCE(ar.approval_status, '')) IN ('pending_dept_head', 'pending_dean')
          )
        )`
      );
    }

    const submittedByRoleSelect = accountRequestColumns.has("submitted_by_role")
      ? "ar.submitted_by_role"
      : "NULL AS submitted_by_role";

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
          ${accountRequestColumns.has("dept_head_approved_by_id") ? `dh.${schema.userColumns.has("name") ? "name" : "full_name"}` : "NULL"} AS dept_head_approver_name,
          ${submittedByRoleSelect}
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
        submittedByRole: normalizeUserRole(row.submitted_by_role || ""),
        canAdminAct: String(row.approval_status || "pending_dept_head").toLowerCase() === "pending_admin",
      })),
    });
  })
);

const buildAccountRequestCompletionUpdates = ({
  accountRequestColumns,
  approverUserId,
  approverRole,
  resolvedUserId = null,
}) => {
  const updateAssignments = [];
  const updateValues = [];

  if (accountRequestColumns.has("approval_status")) {
    updateAssignments.push("approval_status = ?");
    updateValues.push("approved_by_admin");
  }

  if (approverRole === "head_of_department") {
    if (accountRequestColumns.has("dept_head_approved_date")) {
      updateAssignments.push("dept_head_approved_date = CURRENT_TIMESTAMP");
    }

    if (accountRequestColumns.has("dept_head_approved_by_id")) {
      updateAssignments.push("dept_head_approved_by_id = ?");
      updateValues.push(approverUserId > 0 ? approverUserId : null);
    }
  } else if (approverRole === "dean") {
    if (accountRequestColumns.has("dean_approved_date")) {
      updateAssignments.push("dean_approved_date = CURRENT_TIMESTAMP");
    }

    if (accountRequestColumns.has("dean_approved_by_id")) {
      updateAssignments.push("dean_approved_by_id = ?");
      updateValues.push(approverUserId > 0 ? approverUserId : null);
    }
  } else if (approverRole === "admin") {
    if (accountRequestColumns.has("admin_approved_date")) {
      updateAssignments.push("admin_approved_date = CURRENT_TIMESTAMP");
    }

    if (accountRequestColumns.has("admin_approved_by_id")) {
      updateAssignments.push("admin_approved_by_id = ?");
      updateValues.push(approverUserId > 0 ? approverUserId : null);
    }
  }

  if (accountRequestColumns.has("user_id") && resolvedUserId) {
    updateAssignments.push("user_id = ?");
    updateValues.push(resolvedUserId);
  }

  return { updateAssignments, updateValues };
};

const finalizeAccountRequestApproval = async ({
  request,
  requestId,
  requestType,
  schema,
  accountRequestColumns,
  approverUserId,
  approverRole,
}) => {
  const targetUserId = Number(request.user_id ?? 0);

  if (requestType === "deactivation") {
    const userToDeactivate = Number(request.user_id ?? 0);

    if (!Number.isInteger(userToDeactivate) || userToDeactivate <= 0) {
      return { status: 400, body: { success: false, message: "Deactivation request is missing the target user." } };
    }

    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const [deactivatedUserRows] = await pool.execute(
      `SELECT email, ${userNameColumn} AS name FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
      [userToDeactivate]
    );

    await updateStoredUserStatus(
      schema,
      userToDeactivate,
      schema.hasUserRolesTable ? "Inactive" : "inactive"
    );

    const { updateAssignments, updateValues } = buildAccountRequestCompletionUpdates({
      accountRequestColumns,
      approverUserId,
      approverRole,
    });

    updateValues.push(requestId);
    await pool.execute(`UPDATE account_requests SET ${updateAssignments.join(", ")} WHERE id = ?`, updateValues);

    if (deactivatedUserRows[0]?.email) {
      await notifyAccountDeactivated({
        email: deactivatedUserRows[0].email,
        name: deactivatedUserRows[0].name,
      });
    }

    return {
      status: 200,
      body: { success: true, message: "Deactivation approved and the user account has been deactivated." },
    };
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
      return { status: 409, body: { success: false, message: "A user account with this email already exists." } };
    }

    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const insertColumns = [userNameColumn, "email", "password", "department_id", "status"];
    const insertValues = [
      String(request.requested_by_name || request.email || "").trim(),
      normalizedEmail,
      await hashPasswordForStorage(String(request.requested_password || "")),
      request.requested_department_id ?? null,
      schema.hasUserRolesTable ? "Active" : "active",
    ];

    if (schema.userColumns.has("role")) {
      insertColumns.push("role");
      insertValues.push(appliedRole);
    } else if (schema.hasUserRolesTable) {
      const roleId = await resolveRoleId(appliedRole);

      if (!roleId) {
        return { status: 400, body: { success: false, message: "Unable to resolve the approved role for this account." } };
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

  const { updateAssignments, updateValues } = buildAccountRequestCompletionUpdates({
    accountRequestColumns,
    approverUserId,
    approverRole,
    resolvedUserId,
  });

  updateValues.push(requestId);
  await pool.execute(`UPDATE account_requests SET ${updateAssignments.join(", ")} WHERE id = ?`, updateValues);

  const activatedEmail = String(request.email || "").trim().toLowerCase();
  const activatedName = String(request.requested_by_name || request.email || "").trim();
  await notifyAccountActivated({ email: activatedEmail, name: activatedName });

  return {
    status: 200,
    body: {
      success: true,
      message: appliedRole === "staff"
        ? "Account approved and activated with staff access."
        : `Account approved and activated with ${appliedRole.replace(/_/g, " ")} access.`,
      user: {
        id: resolvedUserId,
        name: activatedName,
        email: activatedEmail,
        role: appliedRole,
        status: "active",
        departmentId: request.requested_department_id ?? null,
        designation: String(request.requested_designation || "").trim(),
      },
    },
  };
};

app.post(
  "/api/account-requests/:id/approve",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverRole = normalizeRoleForStorage(req.body?.approverRole || "head_of_department");
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

    if (approverRole === "admin") {
      if (currentStatus !== "pending_admin") {
        return res.status(409).json({ success: false, message: "This account request is not ready for admin approval." });
      }

      const result = await finalizeAccountRequestApproval({
        request,
        requestId,
        requestType,
        schema,
        accountRequestColumns,
        approverUserId,
        approverRole: "admin",
      });

      return res.status(result.status).json(result.body);
    }

    if (approverRole === "dean") {
      if (currentStatus !== "pending_dean") {
        return res.status(409).json({ success: false, message: "This account request is not awaiting dean approval." });
      }

      const result = await finalizeAccountRequestApproval({
        request,
        requestId,
        requestType,
        schema,
        accountRequestColumns,
        approverUserId,
        approverRole: "dean",
      });

      return res.status(result.status).json(result.body);
    }

    if (currentStatus !== "pending_dept_head") {
      return res.status(409).json({ success: false, message: "This account request is not awaiting department-level approval." });
    }

    const result = await finalizeAccountRequestApproval({
      request,
      requestId,
      requestType,
      schema,
      accountRequestColumns,
      approverUserId,
      approverRole: "head_of_department",
    });

    return res.status(result.status).json(result.body);
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
            rejected: "This account request was rejected and cannot be activated.",
          };

          return res.status(409).json({
            success: false,
            message: statusMessages[approvalStatus] || "This account cannot be activated until the approval workflow is completed.",
          });
        }
      }
    }

    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const [userRows] = await pool.execute(
      `SELECT email, ${userNameColumn} AS name FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
      [userId]
    );

    await updateStoredUserStatus(
      schema,
      userId,
      schema.hasUserRolesTable ? (nextStatus === "active" ? "Active" : "Inactive") : nextStatus
    );

    if (nextStatus === "active" && userRows[0]?.email) {
      await notifyAccountActivated({
        email: userRows[0].email,
        name: userRows[0].name,
      });
    }

    if (nextStatus === "inactive" && userRows[0]?.email) {
      await notifyAccountDeactivated({
        email: userRows[0].email,
        name: userRows[0].name,
      });
    }

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

    if (nextPassword) {
      const passwordCheck = validatePassword(nextPassword);
      if (!passwordCheck.valid) {
        return res.status(400).json({ success: false, message: passwordCheck.message });
      }
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
      updateValues.push(await hashPassword(nextPassword));
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

app.patch(
  "/api/users/:id/password",
  withDatabase(async (req, res) => {
    const userId = Number(req.params.id);
    const nextPassword = String(req.body?.password ?? "");
    const schema = await getAuthSchema();

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "A valid user id is required." });
    }

    const passwordCheck = validatePassword(nextPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message || PASSWORD_REQUIREMENTS_MESSAGE,
      });
    }

    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const [userRows] = await pool.execute(
      `SELECT ${userNameColumn} AS name FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    await pool.execute(`UPDATE users SET password = ? WHERE ${userIdColumn} = ?`, [
      await hashPassword(nextPassword),
      userId,
    ]);

    return res.json({
      success: true,
      message: `Password reset successfully for ${userRows[0].name || "the user"}.`,
    });
  })
);

app.get(
  "/api/departments",
  withDatabase(async (req, res) => {
    const schema = await getAuthSchema();

    if (!schema.hasDepartmentsTable) {
      return res.json({ success: true, departments: [] });
    }

    const includeInactive =
      String(req.query?.includeInactive ?? req.query?.management ?? "").toLowerCase() === "true";
    const departmentIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
    const departmentNameColumn = schema.departmentColumns.has("name") ? "name" : "department_name";
    const departmentCodeColumn = schema.departmentColumns.has("code")
      ? "code"
      : schema.departmentColumns.has("department_code")
        ? "department_code"
        : null;
    const departmentHeadIdColumn = schema.departmentColumns.has("head_id") ? "head_id" : null;
    const departmentStatusColumn = schema.departmentColumns.has("status") ? "status" : null;
    const departmentCreatedDateColumn = schema.departmentColumns.has("created_date")
      ? "created_date"
      : schema.departmentColumns.has("created_at")
        ? "created_at"
        : null;
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const userRoleColumn = schema.userColumns.has("role") ? "role" : null;
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const hasUsersDepartmentId = schema.userColumns.has("department_id");
    const hasInventoriesDepartmentId = inventoryColumns.has("department_id") && inventoryIdColumn;

    const headJoinClause = departmentHeadIdColumn
      ? `LEFT JOIN users u ON u.${userIdColumn} = d.${departmentHeadIdColumn}`
      : "LEFT JOIN users u ON 1 = 0";

    const hodByDepartmentSelection =
      hasUsersDepartmentId && userRoleColumn
        ? `(
            SELECT hod.${userNameColumn}
            FROM users hod
            WHERE hod.department_id = d.${departmentIdColumn}
              AND LOWER(COALESCE(hod.status, '')) = 'active'
              AND LOWER(REPLACE(COALESCE(hod.${userRoleColumn}, ''), ' ', '_')) IN ('head_of_department', 'head_of_the_department')
            ORDER BY hod.${userIdColumn} ASC
            LIMIT 1
          )`
        : "NULL";

    const headNameSelection =
      departmentHeadIdColumn || hasUsersDepartmentId
        ? `COALESCE(u.${userNameColumn}, ${hodByDepartmentSelection})`
        : "NULL";

    const userCountSelection = hasUsersDepartmentId
      ? `(SELECT COUNT(*) FROM users usr WHERE usr.department_id = d.${departmentIdColumn}) AS user_count`
      : "0 AS user_count";
    const inventoryCountSelection = hasInventoriesDepartmentId
      ? `(SELECT COUNT(*) FROM inventories inv WHERE inv.department_id = d.${departmentIdColumn}) AS inventory_count`
      : "0 AS inventory_count";

    const [rows] = await pool.execute(
      `
        SELECT
          d.${departmentIdColumn} AS id,
          d.${departmentNameColumn} AS name,
          ${departmentCodeColumn ? `d.${departmentCodeColumn}` : "NULL"} AS code,
          ${departmentHeadIdColumn ? `d.${departmentHeadIdColumn}` : "NULL"} AS head_id,
          ${departmentStatusColumn ? `d.${departmentStatusColumn}` : "NULL"} AS status,
          ${departmentCreatedDateColumn ? `d.${departmentCreatedDateColumn}` : "NULL"} AS created_date,
          ${headNameSelection} AS head_name,
          ${userCountSelection},
          ${inventoryCountSelection}
        FROM departments d
        ${headJoinClause}
        ORDER BY d.${departmentNameColumn} ASC
      `
    );

    const formatDepartmentCreatedDate = (value) => {
      if (!value) return "";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return String(value).split("T")[0] || "";
      }
      return parsed.toISOString().split("T")[0];
    };

    const departments = rows
      .filter((row) =>
        includeInactive ? true : !row.status || String(row.status).toLowerCase() === "active"
      )
      .map((row) => ({
        id: row.id,
        name: row.name,
        code: String(row.code ?? "").trim(),
        head: String(row.head_name ?? "").trim(),
        headId: row.head_id ?? null,
        status: String(row.status || "active").toLowerCase(),
        createdDate: formatDepartmentCreatedDate(row.created_date),
        userCount: Number(row.user_count ?? 0),
        inventoryCount: Number(row.inventory_count ?? 0),
      }));

    return res.json({ success: true, departments });
  })
);

app.patch(
  "/api/departments/:id/status",
  withDatabase(async (req, res) => {
    const departmentId = Number(req.params.id);
    const nextStatus = String(req.body?.status || "").trim().toLowerCase();
    const schema = await getAuthSchema();

    if (!schema.hasDepartmentsTable) {
      return res.status(400).json({ success: false, message: "Departments are not supported by the current schema." });
    }

    if (!Number.isInteger(departmentId) || departmentId <= 0 || !["active", "inactive"].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: "A valid department id and status are required." });
    }

    const departmentIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
    const departmentNameColumn = schema.departmentColumns.has("name") ? "name" : "department_name";
    const departmentStatusColumn = schema.departmentColumns.has("status") ? "status" : null;

    if (!departmentStatusColumn) {
      return res.status(400).json({ success: false, message: "Department status updates are not supported by the current schema." });
    }

    const [rows] = await pool.execute(
      `SELECT ${departmentNameColumn} AS name FROM departments WHERE ${departmentIdColumn} = ? LIMIT 1`,
      [departmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Department not found." });
    }

    await pool.execute(
      `UPDATE departments SET ${departmentStatusColumn} = ? WHERE ${departmentIdColumn} = ?`,
      [nextStatus, departmentId]
    );

    return res.json({
      success: true,
      message: `Department "${rows[0].name}" marked as ${nextStatus}.`,
    });
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

const normalizeReportNameKey = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const fetchUsersByNameMap = async () => {
  const schema = await getAuthSchema();
  const userIdColumn = schema.userColumns.has("id") ? "u.id" : "u.user_id";
  const userNameColumn = schema.userColumns.has("name") ? "u.name" : "u.full_name";

  const [rows] = await pool.execute(
    `SELECT ${userIdColumn} AS id, ${userNameColumn} AS name FROM users u`
  );

  return buildUsersByNameMap(rows);
};

const applyLocationDerivedItemStatus = async (item, existingStatus = "") => {
  const usersByName = await fetchUsersByNameMap();
  return {
    ...item,
    status: deriveItemStatusFromLocation(item.location, usersByName, existingStatus),
  };
};

const parseReportItemValue = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatReportCurrency = (value) =>
  parseReportItemValue(value).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatReportDate = (value) => {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).split("T")[0] || "";
  }

  return date.toISOString().split("T")[0];
};

app.get(
  "/api/inventory-officer/reports",
  withDatabase(async (req, res) => {
    const inventoryOfficerUserId = Number(
      req.query?.inventoryOfficerUserId ?? req.query?.inventory_officer_user_id ?? 0
    );

    if (!Number.isInteger(inventoryOfficerUserId) || inventoryOfficerUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid inventory officer user id is required.",
      });
    }

    const schema = await getAuthSchema();
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);
    const inventoryHodColumn = getInventoryHodColumn(inventoryColumns);

    if (!inventoryIdColumn || !inventoryNameColumn || !inventoryInchargeColumn) {
      return res.status(500).json({
        success: false,
        message: "Inventory schema is missing required columns.",
      });
    }

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

    const [inventoryRows] = await pool.execute(
      `
        SELECT
          i.${inventoryIdColumn} AS id,
          i.${inventoryNameColumn} AS name,
          i.department_id,
          ${inventoryColumns.has("description") ? "i.description" : "NULL"} AS description,
          ${inventoryColumns.has("location") ? "i.location" : "''"} AS location,
          ${inventoryColumns.has("status") ? "i.status" : "'active'"} AS status,
          ${createdDateExpression} AS created_date,
          ${departmentNameColumn ? `d.${departmentNameColumn}` : "NULL"} AS department_name,
          u.${userNameColumn} AS incharge_name,
          ${inventoryHodColumn ? `hod_u.${userNameColumn}` : "NULL"} AS hod_name
        FROM inventories i
        LEFT JOIN departments d ON d.${departmentIdColumn} = i.department_id
        LEFT JOIN users u ON u.${userIdColumn} = i.${inventoryInchargeColumn}
        ${inventoryHodColumn ? `LEFT JOIN users hod_u ON hod_u.${userIdColumn} = i.${inventoryHodColumn}` : ""}
        WHERE i.${inventoryInchargeColumn} = ?
        ORDER BY i.${inventoryNameColumn} ASC
      `,
      [inventoryOfficerUserId]
    );

    const assignedInventories = inventoryRows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      department: row.department_name ?? "",
      location: row.location ?? "",
      incharge: row.incharge_name ?? "",
      hod: row.hod_name ?? "—",
      description: row.description ?? "",
      status: String(row.status ?? "active").toLowerCase(),
      createdDate: row.created_date ? new Date(row.created_date).toISOString().split("T")[0] : "",
      itemCount: 0,
      totalValue: 0,
    }));

    const inventoryIds = assignedInventories.map((entry) => Number(entry.id)).filter((id) => id > 0);
    const inventoryMap = new Map(assignedInventories.map((entry) => [Number(entry.id), entry]));

    const itemColumns = await ensureInventoryItemsColumns();
    const itemIdColumn = getItemIdColumn(itemColumns);
    const itemNameColumn = resolveDbColumn(itemColumns, ["itemName", "item_name", "name"]) || "itemName";
    const itemCodeColumn = resolveDbColumn(itemColumns, ["itemCode", "item_code"]);
    const serialNoColumn = resolveDbColumn(itemColumns, ["serialNo", "serial_no"]);
    const valueColumn = resolveDbColumn(itemColumns, ["value"]);
    const statusColumn = itemColumns.has("status") ? "status" : null;
    const locationColumn = itemColumns.has("location") ? "location" : null;

    let itemRows = [];
    if (inventoryIds.length > 0 && itemColumns.has("inventory_id")) {
      const placeholders = inventoryIds.map(() => "?").join(", ");
      const selectParts = [
        `${itemIdColumn} AS id`,
        "inventory_id",
        `${itemNameColumn} AS item_name`,
      ];
      if (itemCodeColumn) selectParts.push(`${itemCodeColumn} AS item_code`);
      if (serialNoColumn) selectParts.push(`${serialNoColumn} AS serial_no`);
      if (valueColumn) selectParts.push(`${valueColumn} AS value`);
      if (statusColumn) selectParts.push(`${statusColumn} AS status`);
      if (locationColumn) selectParts.push(`${locationColumn} AS location`);

      const [rows] = await pool.execute(
        `SELECT ${selectParts.join(", ")} FROM ${DB_ITEMS_TABLE} WHERE inventory_id IN (${placeholders})`,
        inventoryIds
      );
      itemRows = rows;
    }

    const { designationSelection, designationJoin } = getDesignationQueryParts(schema);
    const departmentNameSelect = schema.departmentColumns.has("name")
      ? "d.name"
      : schema.departmentColumns.has("department_name")
        ? "d.department_name"
        : "NULL";
    const [userRows] = await pool.execute(
      `
        SELECT
          u.${userIdColumn} AS id,
          u.${userNameColumn} AS name,
          ${departmentNameSelect} AS department_name,
          ${designationSelection}
        FROM users u
        ${schema.hasDepartmentsTable ? `LEFT JOIN departments d ON d.${departmentIdColumn} = u.department_id` : ""}
        ${designationJoin}
      `
    );

    const usersByName = new Map();
    userRows.forEach((user) => {
      const key = normalizeReportNameKey(user.name);
      if (key) {
        usersByName.set(key, user);
      }
    });

    const assetsByInventoryMap = new Map();
    const assetsByCategoryMap = new Map();
    const issuedItems = [];
    let totalAssets = 0;
    let totalValue = 0;

    itemRows.forEach((item) => {
      const inventoryId = Number(item.inventory_id ?? 0);
      const inventory = inventoryMap.get(inventoryId);
      const itemValue = parseReportItemValue(item.value);
      const category = String(item.item_name || "Uncategorized").trim() || "Uncategorized";
      const categoryKey = category.toLowerCase();
      const status = String(item.status || "").trim().toLowerCase();
      const location = String(item.location || "").trim();
      const locationKey = normalizeReportNameKey(location);
      const matchedUser = locationKey ? usersByName.get(locationKey) : null;

      totalAssets += 1;
      totalValue += itemValue;

      if (inventory) {
        inventory.itemCount += 1;
        inventory.totalValue += itemValue;

        const inventorySummary = assetsByInventoryMap.get(inventoryId) || {
          inventoryId,
          inventoryName: inventory.name,
          location: inventory.location,
          department: inventory.department,
          itemCount: 0,
          totalValue: 0,
        };
        inventorySummary.itemCount += 1;
        inventorySummary.totalValue += itemValue;
        assetsByInventoryMap.set(inventoryId, inventorySummary);
      }

      const categorySummary = assetsByCategoryMap.get(categoryKey) || {
        category,
        itemCount: 0,
        totalValue: 0,
      };
      categorySummary.itemCount += 1;
      categorySummary.totalValue += itemValue;
      assetsByCategoryMap.set(categoryKey, categorySummary);

      const isIssuedToStaff = status === "in-use" || Boolean(matchedUser);
      if (isIssuedToStaff && location) {
        issuedItems.push({
          itemId: item.id,
          itemName: category,
          itemCode: item.item_code || "",
          serialNo: item.serial_no || "",
          inventoryId,
          inventoryName: inventory?.name || "",
          inventoryLocation: inventory?.location || "",
          staffName: matchedUser?.name || location,
          department: matchedUser?.department_name || "—",
          designation: matchedUser?.designation || "—",
          status: item.status || "—",
          value: formatReportCurrency(itemValue),
          location,
        });
      }
    });

    const inventories = assignedInventories.map((entry) => ({
      ...entry,
      totalValue: formatReportCurrency(entry.totalValue),
      itemCount: entry.itemCount,
    }));

    const assetsByInventory = [...assetsByInventoryMap.values()]
      .map((entry) => ({
        ...entry,
        totalValue: formatReportCurrency(entry.totalValue),
      }))
      .sort((left, right) => left.inventoryName.localeCompare(right.inventoryName));

    const assetsByCategory = [...assetsByCategoryMap.values()]
      .map((entry) => ({
        category: entry.category,
        itemCount: entry.itemCount,
        totalValue: formatReportCurrency(entry.totalValue),
        label: `${entry.category} - ${entry.itemCount}`,
      }))
      .sort((left, right) => right.itemCount - left.itemCount || left.category.localeCompare(right.category));

    issuedItems.sort((left, right) =>
      left.staffName.localeCompare(right.staffName, undefined, { sensitivity: "base" })
      || left.itemName.localeCompare(right.itemName, undefined, { sensitivity: "base" })
    );

    return res.json({
      success: true,
      reports: {
        summary: {
          totalInventories: inventories.length,
          totalAssets,
          totalValue: formatReportCurrency(totalValue),
          issuedToStaffCount: issuedItems.length,
        },
        inventories,
        assetsByInventory,
        issuedItems,
        assetsByCategory,
      },
    });
  })
);

app.get(
  "/api/hod/reports",
  withDatabase(async (req, res) => {
    const hodUserId = Number(req.query?.hodUserId ?? req.query?.hod_user_id ?? 0);

    if (!Number.isInteger(hodUserId) || hodUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid head of department user id is required.",
      });
    }

    const schema = await getAuthSchema();
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const userRoleColumn = schema.userColumns.has("role") ? "role" : null;
    const departmentIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
    const departmentNameColumn = schema.departmentColumns.has("name")
      ? "name"
      : schema.departmentColumns.has("department_name")
        ? "department_name"
        : null;

    const [hodRows] = await pool.execute(
      `
        SELECT
          u.${userIdColumn} AS id,
          u.department_id,
          ${departmentNameColumn ? `d.${departmentNameColumn}` : "NULL"} AS department_name
        FROM users u
        ${schema.hasDepartmentsTable ? `LEFT JOIN departments d ON d.${departmentIdColumn} = u.department_id` : ""}
        WHERE u.${userIdColumn} = ?
        LIMIT 1
      `,
      [hodUserId]
    );

    const hodRow = hodRows[0];
    const departmentId = Number(hodRow?.department_id ?? 0);

    if (!hodRow || !Number.isInteger(departmentId) || departmentId <= 0) {
      return res.status(404).json({
        success: false,
        message: "Unable to resolve the department for this head of department.",
      });
    }

    const departmentName = hodRow.department_name ?? "";
    const { designationSelection, designationJoin } = getDesignationQueryParts(schema);
    const roleSelection = userRoleColumn
      ? `u.${userRoleColumn} AS role`
      : schema.hasUserRolesTable
        ? "ur.user_role AS role"
        : "NULL AS role";
    const roleJoin = !userRoleColumn && schema.hasUserRolesTable
      ? "LEFT JOIN user_roles ur ON ur.role_id = u.role_id"
      : "";

    const [departmentUserRows] = await pool.execute(
      `
        SELECT
          u.${userIdColumn} AS id,
          u.${userNameColumn} AS name,
          u.email,
          ${roleSelection},
          ${designationSelection},
          ${schema.userColumns.has("status") ? "u.status" : "'active'"} AS status
        FROM users u
        ${roleJoin}
        ${designationJoin}
        WHERE u.department_id = ?
        ORDER BY u.${userNameColumn} ASC
      `,
      [departmentId]
    );

    const departmentUsers = departmentUserRows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      email: row.email ?? "",
      role: normalizeUserRole(row.role),
      designation: row.designation ?? "",
      status: String(row.status ?? "active").toLowerCase(),
    }));

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);
    const inventoryHodColumn = getInventoryHodColumn(inventoryColumns);

    if (!inventoryIdColumn || !inventoryNameColumn || !inventoryInchargeColumn) {
      return res.status(500).json({
        success: false,
        message: "Inventory schema is missing required columns.",
      });
    }

    const createdDateExpression = inventoryColumns.has("created_date")
      ? "i.created_date"
      : inventoryColumns.has("created_at")
        ? "i.created_at"
        : "NULL";

    const [inventoryRows] = await pool.execute(
      `
        SELECT
          i.${inventoryIdColumn} AS id,
          i.${inventoryNameColumn} AS name,
          i.department_id,
          ${inventoryColumns.has("description") ? "i.description" : "NULL"} AS description,
          ${inventoryColumns.has("location") ? "i.location" : "''"} AS location,
          ${inventoryColumns.has("status") ? "i.status" : "'active'"} AS status,
          ${createdDateExpression} AS created_date,
          ${departmentNameColumn ? `d.${departmentNameColumn}` : "NULL"} AS department_name,
          u.${userNameColumn} AS incharge_name,
          ${inventoryHodColumn ? `hod_u.${userNameColumn}` : "NULL"} AS hod_name
        FROM inventories i
        LEFT JOIN departments d ON d.${departmentIdColumn} = i.department_id
        LEFT JOIN users u ON u.${userIdColumn} = i.${inventoryInchargeColumn}
        ${inventoryHodColumn ? `LEFT JOIN users hod_u ON hod_u.${userIdColumn} = i.${inventoryHodColumn}` : ""}
        WHERE i.department_id = ?
        ORDER BY i.${inventoryNameColumn} ASC
      `,
      [departmentId]
    );

    const departmentInventories = inventoryRows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      department: row.department_name ?? departmentName,
      location: row.location ?? "",
      incharge: row.incharge_name ?? "",
      hod: row.hod_name ?? "—",
      description: row.description ?? "",
      status: String(row.status ?? "active").toLowerCase(),
      createdDate: row.created_date ? new Date(row.created_date).toISOString().split("T")[0] : "",
      itemCount: 0,
      totalValue: 0,
    }));

    const inventoryIds = departmentInventories.map((entry) => Number(entry.id)).filter((id) => id > 0);
    const inventoryMap = new Map(departmentInventories.map((entry) => [Number(entry.id), entry]));

    const itemColumns = await ensureInventoryItemsColumns();
    const itemIdColumn = getItemIdColumn(itemColumns);
    const itemNameColumn = resolveDbColumn(itemColumns, ["itemName", "item_name", "name"]) || "itemName";
    const itemCodeColumn = resolveDbColumn(itemColumns, ["itemCode", "item_code"]);
    const serialNoColumn = resolveDbColumn(itemColumns, ["serialNo", "serial_no"]);
    const valueColumn = resolveDbColumn(itemColumns, ["value"]);
    const statusColumn = itemColumns.has("status") ? "status" : null;
    const locationColumn = itemColumns.has("location") ? "location" : null;
    const createdAtColumn = resolveDbColumn(itemColumns, ["created_at", "createdAt", "created_date"]);
    const updatedAtColumn = resolveDbColumn(itemColumns, ["updated_at", "updatedAt", "updated_date"]);
    const purchaseDateColumn = resolveDbColumn(itemColumns, ["purchaseDate", "purchase_date"]);

    let itemRows = [];
    if (inventoryIds.length > 0 && itemColumns.has("inventory_id")) {
      const placeholders = inventoryIds.map(() => "?").join(", ");
      const selectParts = [
        `${itemIdColumn} AS id`,
        "inventory_id",
        `${itemNameColumn} AS item_name`,
      ];
      if (itemCodeColumn) selectParts.push(`${itemCodeColumn} AS item_code`);
      if (serialNoColumn) selectParts.push(`${serialNoColumn} AS serial_no`);
      if (valueColumn) selectParts.push(`${valueColumn} AS value`);
      if (statusColumn) selectParts.push(`${statusColumn} AS status`);
      if (locationColumn) selectParts.push(`${locationColumn} AS location`);
      if (createdAtColumn) selectParts.push(`${createdAtColumn} AS created_at`);
      if (updatedAtColumn) selectParts.push(`${updatedAtColumn} AS updated_at`);
      if (purchaseDateColumn) selectParts.push(`${purchaseDateColumn} AS purchase_date`);

      const [rows] = await pool.execute(
        `SELECT ${selectParts.join(", ")} FROM ${DB_ITEMS_TABLE} WHERE inventory_id IN (${placeholders})`,
        inventoryIds
      );
      itemRows = rows;
    }

    const issuedRequestByItemId = new Map();
    const itemRequestColumns = await getTableColumns("item_requests");
    if (itemRows.length > 0 && itemRequestColumns.has("allocated_inventory_item_id")) {
      const itemIds = itemRows.map((row) => Number(row.id)).filter((id) => id > 0);
      if (itemIds.length > 0) {
        const requestPlaceholders = itemIds.map(() => "?").join(", ");
        const issuedDateSelect = itemRequestColumns.has("issued_date") ? "ir.issued_date" : "NULL AS issued_date";
        const returnedDateSelect = itemRequestColumns.has("returned_date") ? "ir.returned_date" : "NULL AS returned_date";
        const orderByClause = itemRequestColumns.has("issued_date")
          ? "ORDER BY ir.issued_date DESC, ir.id DESC"
          : "ORDER BY ir.id DESC";
        const [requestRows] = await pool.execute(
          `
            SELECT
              ir.allocated_inventory_item_id,
              ${issuedDateSelect},
              ${returnedDateSelect}
            FROM item_requests ir
            WHERE ir.allocated_inventory_item_id IN (${requestPlaceholders})
            ${orderByClause}
          `,
          itemIds
        );

        requestRows.forEach((row) => {
          const itemId = Number(row.allocated_inventory_item_id ?? 0);
          if (itemId > 0 && !issuedRequestByItemId.has(itemId)) {
            issuedRequestByItemId.set(itemId, row);
          }
        });
      }
    }

    const usersByName = new Map();
    departmentUserRows.forEach((user) => {
      const key = normalizeReportNameKey(user.name);
      if (key) {
        usersByName.set(key, user);
      }
    });

    const assets = [];
    const issuedItems = [];
    let totalAssets = 0;
    let totalValue = 0;

    itemRows.forEach((item) => {
      const inventoryId = Number(item.inventory_id ?? 0);
      const inventory = inventoryMap.get(inventoryId);
      const itemValue = parseReportItemValue(item.value);
      const itemName = String(item.item_name || "Uncategorized").trim() || "Uncategorized";
      const status = String(item.status || "").trim().toLowerCase();
      const location = String(item.location || "").trim();
      const locationKey = normalizeReportNameKey(location);
      const matchedUser = locationKey ? usersByName.get(locationKey) : null;

      totalAssets += 1;
      totalValue += itemValue;

      if (inventory) {
        inventory.itemCount += 1;
        inventory.totalValue += itemValue;
      }

      const createdDate = formatReportDate(item.created_at);
      const updatedDate = formatReportDate(item.updated_at);
      const purchaseDate = formatReportDate(item.purchase_date);
      const assetDate = updatedDate || createdDate || purchaseDate;
      const issuedRequest = issuedRequestByItemId.get(Number(item.id));
      const issuedDate = formatReportDate(issuedRequest?.issued_date);
      const returnedDate = formatReportDate(issuedRequest?.returned_date);

      assets.push({
        itemId: item.id,
        itemName,
        itemCode: item.item_code || "",
        serialNo: item.serial_no || "",
        inventoryId,
        inventoryName: inventory?.name || "",
        inventoryLocation: inventory?.location || "",
        location,
        status: item.status || "—",
        value: formatReportCurrency(itemValue),
        createdDate,
        updatedDate,
        purchaseDate,
        date: assetDate,
      });

      const isIssuedToStaff = status === "in-use" || Boolean(matchedUser);
      if (isIssuedToStaff && location) {
        issuedItems.push({
          itemId: item.id,
          itemName,
          itemCode: item.item_code || "",
          serialNo: item.serial_no || "",
          inventoryId,
          inventoryName: inventory?.name || "",
          inventoryLocation: inventory?.location || "",
          staffName: matchedUser?.name || location,
          department: departmentName || "—",
          designation: matchedUser?.designation || "—",
          status: item.status || "—",
          value: formatReportCurrency(itemValue),
          location,
          issuedDate,
          returnedDate,
          date: issuedDate || assetDate,
        });
      }
    });

    const inventories = departmentInventories.map((entry) => ({
      ...entry,
      totalValue: formatReportCurrency(entry.totalValue),
      itemCount: entry.itemCount,
    }));

    assets.sort((left, right) =>
      left.inventoryName.localeCompare(right.inventoryName, undefined, { sensitivity: "base" })
      || left.itemName.localeCompare(right.itemName, undefined, { sensitivity: "base" })
    );

    issuedItems.sort((left, right) =>
      left.staffName.localeCompare(right.staffName, undefined, { sensitivity: "base" })
      || left.itemName.localeCompare(right.itemName, undefined, { sensitivity: "base" })
    );

    return res.json({
      success: true,
      departmentName,
      reports: {
        summary: {
          totalUsers: departmentUsers.length,
          totalInventories: inventories.length,
          totalAssets,
          totalValue: formatReportCurrency(totalValue),
          issuedToStaffCount: issuedItems.length,
        },
        departmentUsers,
        inventories,
        assets,
        issuedItems,
      },
    });
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

const getAdminPendingTasksCount = async () => 0;

const getRecentDashboardActivities = async (tableNames, limit = 10) => {
  const activities = [];
  const schema = await getAuthSchema();
  const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
  const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
  const departmentNameColumn = schema.departmentColumns.has("name")
    ? "d.name"
    : schema.departmentColumns.has("department_name")
      ? "d.department_name"
      : null;

  const pushActivity = (entry) => {
    if (!entry?.message || !entry?.timestamp) {
      return;
    }

    activities.push({
      id: entry.id,
      message: entry.message,
      timestamp: new Date(entry.timestamp).toISOString(),
      type: entry.type || "system",
      category: entry.category || entry.type || "system",
      entityId: entry.entityId ?? null,
      link: entry.link || null,
      tab: entry.tab || null,
    });
  };

  const resolveAccountActivityNavigation = (approvalStatus) => {
    const normalizedStatus = String(approvalStatus || "").toLowerCase();

    if (normalizedStatus === "pending_admin") {
      return { link: "/admin/users" };
    }

    return { link: "/admin/users" };
  };

  const resolveInventoryRequestNavigation = () => ({ link: "/admin/inventory" });

  if (tableNames.has("audit_logs")) {
    const [auditRows] = await pool.query(
      `
        SELECT
          al.id,
          al.action,
          al.entity_type,
          al.timestamp,
          u.${userNameColumn} AS user_name
        FROM audit_logs al
        LEFT JOIN users u ON u.${userIdColumn} = al.user_id
        ORDER BY al.timestamp DESC
        LIMIT ?
      `,
      [limit]
    );

    auditRows.forEach((row) => {
      const actor = row.user_name ? ` by ${row.user_name}` : "";
      pushActivity({
        id: `audit-${row.id}`,
        message: `${String(row.action || "Updated").replace(/_/g, " ")} ${row.entity_type || "record"}${actor}`,
        timestamp: row.timestamp,
        type: "audit",
      });
    });
  }

  if (tableNames.has("account_requests")) {
    const accountRequestColumns = await getTableColumns("account_requests");
    const requestedDateColumn = accountRequestColumns.has("requested_date") ? "ar.requested_date" : "ar.created_date";
    const departmentJoin = schema.hasDepartmentsTable && departmentNameColumn
      ? `LEFT JOIN departments d ON d.${schema.departmentColumns.has("id") ? "id" : "department_id"} = ar.requested_department_id`
      : "";
    const departmentSelect = departmentNameColumn ? `${departmentNameColumn} AS department_name` : "NULL AS department_name";

    const [accountRows] = await pool.query(
      `
        SELECT
          ar.id,
          ${accountRequestColumns.has("request_type") ? "ar.request_type" : "'account_creation'"} AS request_type,
          ${accountRequestColumns.has("requested_by_name") ? "ar.requested_by_name" : "NULL"} AS requested_by_name,
          ${accountRequestColumns.has("email") ? "ar.email" : "NULL"} AS email,
          ${accountRequestColumns.has("approval_status") ? "ar.approval_status" : "'pending_dept_head'"} AS approval_status,
          ${requestedDateColumn} AS activity_date,
          ${departmentSelect}
        FROM account_requests ar
        ${departmentJoin}
        ORDER BY ${requestedDateColumn} DESC, ar.id DESC
        LIMIT ?
      `,
      [limit]
    );

    accountRows.forEach((row) => {
      const personName = row.requested_by_name || row.email || "User";
      const requestType = String(row.request_type || "account_creation").toLowerCase();
      const approvalStatus = String(row.approval_status || "").toLowerCase();
      let message = `Account request submitted - ${personName}`;

      if (requestType === "deactivation") {
        if (approvalStatus === "approved_by_admin") {
          message = `Account deactivation completed - ${personName}`;
        } else if (approvalStatus === "rejected") {
          message = `Account deactivation rejected - ${personName}`;
        } else {
          message = `Account deactivation requested - ${personName}`;
        }
      } else if (approvalStatus === "approved_by_admin") {
        message = `New user registered - ${personName}`;
      } else if (approvalStatus === "rejected") {
        message = `Account request rejected - ${personName}`;
      } else if (approvalStatus === "pending_admin") {
        message = `Account request awaiting admin approval - ${personName}`;
      }

      const accountNavigation = resolveAccountActivityNavigation(approvalStatus);

      pushActivity({
        id: `account-request-${row.id}`,
        message,
        timestamp: row.activity_date,
        type: "user",
        category: "account_request",
        entityId: row.id,
        link: accountNavigation.link,
        tab: accountNavigation.tab,
      });
    });
  }

  if (tableNames.has("users")) {
    const userIdColumn = getUserPrimaryKeyColumn(schema);
    const userNameColumn = schema.userColumns.has("name") ? "u.name" : "u.full_name";
    const createdDateColumn = schema.userColumns.has("created_date")
      ? "u.created_date"
      : schema.userColumns.has("created_at")
        ? "u.created_at"
        : null;

    if (createdDateColumn) {
      const departmentJoin = schema.hasDepartmentsTable && departmentNameColumn
        ? `LEFT JOIN departments d ON d.${schema.departmentColumns.has("id") ? "id" : "department_id"} = u.department_id`
        : "";
      const departmentSelect = departmentNameColumn ? `${departmentNameColumn} AS department_name` : "NULL AS department_name";

      const [userRows] = await pool.query(
        `
          SELECT
            u.${userIdColumn} AS id,
            ${userNameColumn} AS name,
            u.email,
            u.status,
            ${createdDateColumn} AS activity_date,
            ${departmentSelect}
          FROM users u
          ${departmentJoin}
          WHERE ${createdDateColumn} IS NOT NULL
          ORDER BY ${createdDateColumn} DESC, u.${userIdColumn} DESC
          LIMIT ?
        `,
        [limit]
      );

      userRows.forEach((row) => {
        const personName = row.name || row.email || "User";
        const status = String(row.status || "").toLowerCase();

        pushActivity({
          id: `user-${row.id}`,
          message:
            status === "active"
              ? `New user registered - ${personName}`
              : `User account created (inactive) - ${personName}`,
          timestamp: row.activity_date,
          type: "user",
          category: "user",
          entityId: row.id,
          link: "/admin/users",
        });
      });
    }
  }

  if (tableNames.has("inventory_creation_requests")) {
    const inventoryRequestColumns = await getTableColumns("inventory_creation_requests");
    const inventoryRequestIdColumn = getInventoryRequestPrimaryKeyColumn(inventoryRequestColumns);
    const requestedDateColumn = inventoryRequestColumns.has("requested_date")
      ? "icr.requested_date"
      : "icr.created_date";
    const departmentJoin = schema.hasDepartmentsTable && departmentNameColumn
      ? `LEFT JOIN departments d ON d.${schema.departmentColumns.has("id") ? "id" : "department_id"} = icr.department_id`
      : "";
    const departmentSelect = departmentNameColumn ? `${departmentNameColumn} AS department_name` : "NULL AS department_name";

    const [inventoryRequestRows] = await pool.query(
      `
        SELECT
          icr.${inventoryRequestIdColumn} AS id,
          icr.name,
          icr.approval_status,
          ${inventoryRequestColumns.has("request_type") ? "icr.request_type" : "'new_inventory_creation'"} AS request_type,
          ${requestedDateColumn} AS activity_date,
          ${departmentSelect}
        FROM inventory_creation_requests icr
        ${departmentJoin}
        ORDER BY ${requestedDateColumn} DESC, icr.${inventoryRequestIdColumn} DESC
        LIMIT ?
      `,
      [limit]
    );

    inventoryRequestRows.forEach((row) => {
      const inventoryName = row.name || "Inventory";
      const approvalStatus = String(row.approval_status || "").toLowerCase();
      const requestType = String(row.request_type || "new_inventory_creation").toLowerCase();
      let message = `Inventory request submitted - ${inventoryName}`;

      if (approvalStatus === "process completed" || approvalStatus === "approved_by_admin") {
        message =
          requestType === "activate_existing_inventory"
            ? `Inventory activated - ${inventoryName}`
            : `New inventory created - ${inventoryName}`;
      } else if (approvalStatus === "rejected") {
        message = `Inventory request rejected - ${inventoryName}`;
      } else if (approvalStatus === "pending_admin") {
        message = `Inventory request awaiting admin approval - ${inventoryName}`;
      }

      const inventoryNavigation = resolveInventoryRequestNavigation();

      pushActivity({
        id: `inventory-request-${row.id}`,
        message,
        timestamp: row.activity_date,
        type: "inventory",
        category: "inventory_request",
        entityId: row.id,
        link: inventoryNavigation.link,
        tab: inventoryNavigation.tab,
      });
    });
  }

  if (tableNames.has("item_transfers")) {
    const itemTransferColumns = await getTableColumns("item_transfers");
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const itemNameColumn = itemColumns.has("itemName")
      ? "ii.itemName"
      : itemColumns.has("item_name")
        ? "ii.item_name"
        : itemColumns.has("name")
          ? "ii.name"
          : "CAST(ii.id AS CHAR)";
    const fromInventoryNameSelect = buildInventoryAliasNameSelect("fi", inventoryColumns, "from_inventory_name");
    const toInventoryNameSelect = buildInventoryAliasNameSelect("ti", inventoryColumns, "to_inventory_name");
    const fromInventoryJoin = buildInventoryTransferJoin("fi", inventoryColumns, "from_inventory_id");
    const toInventoryJoin = buildInventoryTransferJoin("ti", inventoryColumns, "to_inventory_id");
    const activityDateColumn = itemTransferColumns.has("completed_date")
      ? "COALESCE(it.completed_date, it.transfer_date, it.created_date)"
      : itemTransferColumns.has("transfer_date")
        ? "it.transfer_date"
        : "it.created_date";

    const [transferRows] = await pool.query(
      `
        SELECT
          it.id,
          ${itemNameColumn} AS item_name,
          ${fromInventoryNameSelect},
          ${toInventoryNameSelect},
          it.status,
          ${activityDateColumn} AS activity_date
        FROM item_transfers it
        ${buildItemAliasJoin(itemColumns, "it.item_id")}
        ${fromInventoryJoin}
        ${toInventoryJoin}
        ORDER BY ${activityDateColumn} DESC, it.id DESC
        LIMIT ?
      `,
      [limit]
    );

    transferRows.forEach((row) => {
      const status = String(row.status || "").toLowerCase();
      const fromName = row.from_inventory_name || "source inventory";
      const toName = row.to_inventory_name || "destination inventory";
      const itemLabel = row.item_name ? `${row.item_name} - ` : "";
      const message =
        status === "completed"
          ? `Item transfer completed - ${itemLabel}${fromName} to ${toName}`
          : `Item transfer ${status || "updated"} - ${itemLabel}${fromName} to ${toName}`;

      pushActivity({
        id: `transfer-${row.id}`,
        message,
        timestamp: row.activity_date,
        type: "transfer",
        category: "transfer",
        entityId: row.id,
        link: "/admin/inventory",
      });
    });
  }

  if (tableNames.has("item_disposals")) {
    const itemDisposalColumns = await getTableColumns("item_disposals");
    const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const itemNameColumn = itemColumns.has("itemName")
      ? "ii.itemName"
      : itemColumns.has("item_name")
        ? "ii.item_name"
        : itemColumns.has("name")
          ? "ii.name"
          : "CAST(ii.id AS CHAR)";
    const activityDateColumn = itemDisposalColumns.has("approved_date")
      ? "COALESCE(idp.approved_date, idp.disposal_date, idp.created_date)"
      : itemDisposalColumns.has("disposal_date")
        ? "idp.disposal_date"
        : "idp.created_date";

    const disposalInventoryColumns = await ensureInventoriesLocationColumn();
    const disposalInventoryNameSelect = buildInventoryAliasNameSelect("inv", disposalInventoryColumns, "inventory_name");
    const disposalInventoryJoin = buildInventoryAliasJoin("inv", disposalInventoryColumns, "idp.inventory_id");

    const [disposalRows] = await pool.query(
      `
        SELECT
          idp.id,
          ${itemNameColumn} AS item_name,
          ${disposalInventoryNameSelect},
          idp.status,
          ${activityDateColumn} AS activity_date
        FROM item_disposals idp
        ${buildItemAliasJoin(itemColumns, "idp.item_id")}
        ${disposalInventoryJoin}
        ORDER BY ${activityDateColumn} DESC, idp.id DESC
        LIMIT ?
      `,
      [limit]
    );

    disposalRows.forEach((row) => {
      const status = String(row.status || "").toLowerCase();
      const inventoryName = row.inventory_name || "inventory";
      const itemLabel = row.item_name ? `${row.item_name} - ` : "";
      const message =
        status === "completed"
          ? `Disposal process completed - ${itemLabel}${inventoryName}`
          : `Disposal ${status || "updated"} - ${itemLabel}${inventoryName}`;

      pushActivity({
        id: `disposal-${row.id}`,
        message,
        timestamp: row.activity_date,
        type: "disposal",
        category: "disposal",
        entityId: row.id,
        link: "/admin/inventory",
      });
    });
  }

  const uniqueActivities = [];
  const seenActivityKeys = new Set();

  activities
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .forEach((activity) => {
      const dedupeKey = `${activity.category}:${activity.entityId || activity.message}`;
      if (seenActivityKeys.has(dedupeKey)) {
        return;
      }

      seenActivityKeys.add(dedupeKey);
      uniqueActivities.push(activity);
    });

  return uniqueActivities.slice(0, limit);
};

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

    const pendingTasks = await getAdminPendingTasksCount();
    const recentActivities = await getRecentDashboardActivities(tableNames, 5);

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
      recentActivities,
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
    const passwordValid =
      rows.length > 0 ? await verifyPassword(password, rows[0].password) : false;

    if (rows.length === 0 || !passwordValid) {
      if (pendingRequest) {
        const pendingPassword = String(pendingRequest.requested_password || "");
        const pendingPasswordValid =
          !pendingPassword || (await verifyPassword(password, pendingPassword));

        if (pendingPasswordValid) {
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

    if (!isPasswordHashed(user.password)) {
      const idColumnName = schema.userColumns.has("id") ? "id" : "user_id";
      await pool.execute(`UPDATE users SET password = ? WHERE ${idColumnName} = ?`, [
        await hashPassword(password),
        user.id,
      ]);
    }

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

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        success: false,
        error: passwordCheck.message || PASSWORD_REQUIREMENTS_MESSAGE,
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
        await hashPassword(password),
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

      await notifyAccountActivated({ email, name: fullName });

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
        requestInsertValues.push(await hashPassword(password));
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

      if (accountRequestColumns.has("submitted_by_role") && isAdminManagedSignup) {
        requestInsertColumns.push("submitted_by_role");
        requestInsertValues.push("admin");
      }

      if (accountRequestColumns.has("request_reason")) {
        requestInsertColumns.push("request_reason");
        requestInsertValues.push(
          isAdminManagedSignup
            ? `Administrator submitted account request for ${requestedRole.replace(/_/g, " ")}.`
            : `Signup requested with target role: ${requestedRole}`
        );
      }

      const requestPlaceholders = requestInsertColumns.map(() => "?").join(", ");
      const [requestResult] = await pool.execute(
        `INSERT INTO account_requests (${requestInsertColumns.join(", ")}) VALUES (${requestPlaceholders})`,
        requestInsertValues
      );

      return res.status(201).json({
        success: true,
        message: requestedRole === "admin"
          ? "Admin account request submitted successfully. Your account will stay pending until dean approval."
          : requiresDeanApproval
            ? "Account request submitted successfully. Your account will stay pending until dean approval."
            : isAdminManagedSignup
              ? "Account request submitted for HOD review. It is listed under User Management → Pending Approvals."
              : "Staff account request submitted successfully. Your account will stay pending until HOD approval.",
        request: {
          id: requestResult.insertId,
          name: fullName,
          email,
          requestedRole,
          department,
          designation,
          approvalStatus: requiresDeanApproval ? "pending_dean" : "pending_dept_head",
          submittedByRole: isAdminManagedSignup ? "admin" : "",
          adminRequest,
        },
      });
    }
  })
);

app.post(
  "/api/auth/forgot-password",
  withDatabase(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const genericMessage =
      "If an account exists with that email, a verification code has been sent.";

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required." });
    }

    const schema = await getAuthSchema();
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const [rows] = await pool.execute(
      `SELECT ${userIdColumn} AS id, email, ${userNameColumn} AS name, status FROM users WHERE LOWER(email) = ? LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        message: genericMessage,
        expiresInSeconds: PASSWORD_RESET_OTP_EXPIRY_MINUTES * 60,
      });
    }

    const user = rows[0];
    const userStatus = String(user.status ?? "").toLowerCase();

    if (userStatus !== "active") {
      return res.json({
        success: true,
        message: genericMessage,
        expiresInSeconds: PASSWORD_RESET_OTP_EXPIRY_MINUTES * 60,
      });
    }

    const { otp } = await issuePasswordResetOtp(pool, email);
    const emailResult = await sendPasswordResetOtpEmail({
      email,
      name: user.name,
      otp,
      expiresMinutes: PASSWORD_RESET_OTP_EXPIRY_MINUTES,
    });

    if (!emailResult.sent && emailResult.reason === "smtp_not_configured" && isDevOtpFallbackEnabled()) {
      console.warn(`[email] DEV MODE: Password reset OTP for ${email}: ${otp}`);
      return res.json({
        success: true,
        message: "Email is not configured. Use the development verification code shown below.",
        expiresInSeconds: PASSWORD_RESET_OTP_EXPIRY_MINUTES * 60,
        devMode: true,
        devOtp: otp,
      });
    }

    if (!emailResult.sent && emailResult.reason === "smtp_not_configured") {
      return res.status(503).json({
        success: false,
        error: "Email service is not configured. Please contact your system administrator.",
      });
    }

    if (!emailResult.sent) {
      return res.status(500).json({
        success: false,
        error: "Unable to send the verification email right now. Please try again later.",
      });
    }

    return res.json({
      success: true,
      message: genericMessage,
      expiresInSeconds: PASSWORD_RESET_OTP_EXPIRY_MINUTES * 60,
    });
  })
);

app.post(
  "/api/auth/verify-reset-otp",
  withDatabase(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const otp = String(req.body?.otp ?? "").trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: "Email and verification code are required." });
    }

    const verification = await verifyPasswordResetOtp(pool, email, otp);

    if (!verification.valid) {
      const errorMessages = {
        expired: "This verification code has expired. Please request a new one.",
        invalid_otp: "Invalid verification code.",
        already_used: "This verification code has already been used.",
        not_found: "Invalid verification code.",
      };

      return res.status(400).json({
        success: false,
        error: errorMessages[verification.reason] || "Invalid verification code.",
      });
    }

    return res.json({ success: true, message: "Verification code accepted." });
  })
);

app.post(
  "/api/auth/reset-password",
  withDatabase(async (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const otp = String(req.body?.otp ?? "").trim();
    const password = String(req.body?.password ?? "");

    if (!email || !otp || !password) {
      return res.status(400).json({
        success: false,
        error: "Email, verification code, and new password are required.",
      });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        success: false,
        error: passwordCheck.message || PASSWORD_REQUIREMENTS_MESSAGE,
      });
    }

    const otpVerification = await consumePasswordResetOtp(pool, email, otp);
    if (!otpVerification.valid) {
      const errorMessages = {
        expired: "This verification code has expired. Please request a new one.",
        invalid_otp: "Invalid verification code.",
        already_used: "This verification code has already been used.",
        not_found: "Invalid verification code.",
      };

      return res.status(400).json({
        success: false,
        error: errorMessages[otpVerification.reason] || "Invalid verification code.",
      });
    }

    const schema = await getAuthSchema();
    const idColumnName = schema.userColumns.has("id") ? "id" : "user_id";
    const [rows] = await pool.execute(
      `SELECT ${idColumnName} AS id FROM users WHERE LOWER(email) = ? LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Account not found." });
    }

    await pool.execute(`UPDATE users SET password = ? WHERE ${idColumnName} = ?`, [
      await hashPassword(password),
      rows[0].id,
    ]);

    return res.json({
      success: true,
      message: "Password reset successfully. You can now sign in with your new password.",
    });
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

    const payload = applyItemUploadPayload(req, { ...req.body });
    let item = enrichItemQrFields(normalizeItemPayload(payload));

    if (!String(item.ginfile || "").trim() && String(item.ginNo || "").trim()) {
      item.ginfile = await findExistingGinFileByGinNo(item.ginNo);
    }
    const validationError = validateRequiredFields(item);

    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const dbColumns = await ensureInventoryItemsColumns();
    if (dbColumns.has("status")) {
      item = await applyLocationDerivedItemStatus(item);
    }
    const identifierValidation = await validateItemIdentifiers(dbColumns, item);

    if (!identifierValidation.valid) {
      return res.status(409).json({
        success: false,
        error: formatItemIdentifierValidationError(identifierValidation.conflicts),
        conflicts: identifierValidation.conflicts,
      });
    }

    const insertSpec = getItemInsertSpec(dbColumns);
    const insertColumns = insertSpec.map((entry) => entry.column);
    const placeholders = insertSpec.map(() => "?").join(", ");
    const [result] = await pool.execute(
      `INSERT INTO ${DB_ITEMS_TABLE} (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      buildInsertValues(item, insertSpec)
    );

    return res.status(201).json({
      success: true,
      item: { id: result.insertId, ...item },
    });
  })
);

app.put(
  "/api/items/:id",
  upload.fields([
    { name: "itemImage", maxCount: 1 },
    { name: "ginfile", maxCount: 1 },
  ]),
  withDatabase(async (req, res) => {
    await ensureInventoryItemsColumns();
    const itemId = Number(req.params.id);
    const dbColumns = await ensureInventoryItemsColumns();
    const idColumn = getItemIdColumn(dbColumns);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid item id" });
    }

    const [existingRows] = await pool.execute(
      `SELECT * FROM ${DB_ITEMS_TABLE} WHERE ${idColumn} = ? LIMIT 1`,
      [itemId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: "Item not found" });
    }

    const payload = applyItemUploadPayload(req, { ...req.body });
    let item = enrichItemQrFields(normalizeItemPayload(payload));

    if (!String(item.ginfile || "").trim() && String(item.ginNo || "").trim()) {
      item.ginfile = await findExistingGinFileByGinNo(item.ginNo);
    }

    const validationError = validateRequiredFields(item);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    if (dbColumns.has("status")) {
      const existingStatus = existingRows[0]?.status ?? "";
      item = await applyLocationDerivedItemStatus(item, existingStatus);
    }

    const identifierValidation = await validateItemIdentifiers(dbColumns, {
      ...item,
      excludeItemId: itemId,
    });

    if (!identifierValidation.valid) {
      return res.status(409).json({
        success: false,
        error: formatItemIdentifierValidationError(identifierValidation.conflicts),
        conflicts: identifierValidation.conflicts,
      });
    }

    const insertSpec = getItemInsertSpec(dbColumns);
    const { assignments, values } = buildItemUpdateAssignments(item, insertSpec);
    values.push(itemId);

    await pool.execute(
      `UPDATE ${DB_ITEMS_TABLE} SET ${assignments.join(", ")} WHERE ${idColumn} = ?`,
      values
    );

    return res.json({
      success: true,
      item: normalizeItemRow({ ...existingRows[0], ...item, [idColumn]: itemId, id: itemId }),
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

    const items = req.body.map((entry) => enrichItemQrFields(normalizeItemPayload(entry)));
    const invalidItem = items.find(validateRequiredFields);

    if (invalidItem) {
      return res.status(400).json({ success: false, error: validateRequiredFields(invalidItem) });
    }

    const dbColumns = await ensureInventoryItemsColumns();
    const usersByName = dbColumns.has("status") ? await fetchUsersByNameMap() : new Map();
    const normalizedItems = dbColumns.has("status")
      ? items.map((entry) => ({
        ...entry,
        status: deriveItemStatusFromLocation(entry.location, usersByName),
      }))
      : items;

    for (let index = 0; index < items.length; index += 1) {
      const identifierValidation = await validateItemIdentifiers(dbColumns, items[index]);

      if (!identifierValidation.valid) {
        return res.status(409).json({
          success: false,
          error: `Row ${index + 1}: ${formatItemIdentifierValidationError(identifierValidation.conflicts)}`,
          conflicts: identifierValidation.conflicts,
          rowIndex: index,
        });
      }
    }

    const insertSpec = getItemInsertSpec(dbColumns);
    const insertColumns = insertSpec.map((entry) => entry.column);
    const rowPlaceholder = `(${insertSpec.map(() => "?").join(", ")})`;
    const placeholders = normalizedItems.map(() => rowPlaceholder).join(", ");
    const values = normalizedItems.flatMap((item) => buildInsertValues(item, insertSpec));

    const [result] = await pool.execute(
      `INSERT INTO ${DB_ITEMS_TABLE} (${insertColumns.join(", ")}) VALUES ${placeholders}`,
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

    const items = records.map((entry) => enrichItemQrFields(normalizeItemPayload(entry)));
    const invalid = items.find(validateRequiredFields);
    if (invalid) {
      return res.status(400).json({ success: false, error: validateRequiredFields(invalid) });
    }

    const dbColumns = await ensureInventoryItemsColumns();
    const usersByName = dbColumns.has("status") ? await fetchUsersByNameMap() : new Map();
    const normalizedItems = dbColumns.has("status")
      ? items.map((entry) => ({
        ...entry,
        status: deriveItemStatusFromLocation(entry.location, usersByName),
      }))
      : items;

    for (let index = 0; index < items.length; index += 1) {
      const identifierValidation = await validateItemIdentifiers(dbColumns, items[index]);

      if (!identifierValidation.valid) {
        return res.status(409).json({
          success: false,
          error: `Row ${index + 1}: ${formatItemIdentifierValidationError(identifierValidation.conflicts)}`,
          conflicts: identifierValidation.conflicts,
          rowIndex: index,
        });
      }
    }

    const insertSpec = getItemInsertSpec(dbColumns);
    const insertColumns = insertSpec.map((entry) => entry.column);
    const rowPlaceholder = `(${insertSpec.map(() => "?").join(", ")})`;
    const placeholders = normalizedItems.map(() => rowPlaceholder).join(", ");
    const values = normalizedItems.flatMap((item) => buildInsertValues(item, insertSpec));

    const [result] = await pool.execute(
      `INSERT INTO ${DB_ITEMS_TABLE} (${insertColumns.join(", ")}) VALUES ${placeholders}`,
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
    const issuedToUserId = Number(req.query?.issuedToUserId ?? 0);
    const ginNo = String(req.query?.ginNo ?? "").trim();
    const searchText = String(req.query?.search ?? req.query?.q ?? "").trim();
    const hasInventoryId = inventoryItemColumns.has("inventory_id");

    const whereClauses = [];
    const params = [];

    const ginNoColumn = resolveDbColumn(inventoryItemColumns, ["ginNo", "gin_no"]);
    if (ginNo && ginNoColumn) {
      whereClauses.push(`LOWER(TRIM(${ginNoColumn})) = LOWER(?)`);
      params.push(ginNo);
    }

    if (Number.isInteger(inventoryId) && inventoryId > 0 && hasInventoryId) {
      whereClauses.push("inventory_id = ?");
      params.push(inventoryId);
    }

    const nameKeywordFilter = buildItemNameKeywordFilter(inventoryItemColumns, searchText);
    if (nameKeywordFilter.clause) {
      whereClauses.push(nameKeywordFilter.clause);
      params.push(...nameKeywordFilter.params);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const orderClause = getItemsOrderClause(inventoryItemColumns);

    const [rows] = await pool.execute(
      `SELECT * FROM ${DB_ITEMS_TABLE} ${whereClause} ORDER BY ${orderClause}`,
      params
    );

    let items = rows.map(normalizeItemRow);

    if (Number.isInteger(inventoryId) && inventoryId > 0 && hasInventoryId) {
      const itemIds = items.map((item) => Number(item.id)).filter((id) => Number.isInteger(id) && id > 0);
      const [transferLockMap, disposalLockMap, repairLockMap, warrantyClaimLockMap] = await Promise.all([
        getTransferLockMapForInventory(inventoryId, itemIds),
        getDisposalLockMapForInventory(inventoryId, itemIds),
        getRepairLockMapForInventory(inventoryId, itemIds),
        getWarrantyClaimLockMapForInventory(inventoryId, itemIds),
      ]);

      items = items.map((item) => {
        const itemId = Number(item.id);
        const transferLock = transferLockMap.get(itemId);
        const disposalLock = disposalLockMap.get(itemId);
        const repairLock = repairLockMap.get(itemId);
        const warrantyClaimLock = warrantyClaimLockMap.get(itemId);

        return {
          ...item,
          transferLocked: Boolean(transferLock),
          transferLockReason: transferLock?.transferLockReason || "",
          transferId: transferLock?.transferId ?? null,
          disposalLocked: Boolean(disposalLock),
          disposalLockReason: disposalLock?.disposalLockReason || "",
          disposalId: disposalLock?.disposalId ?? null,
          repairLocked: Boolean(repairLock),
          repairLockReason: repairLock?.repairLockReason || "",
          repairId: repairLock?.repairId ?? null,
          warrantyClaimLocked: Boolean(warrantyClaimLock),
          warrantyClaimLockReason: warrantyClaimLock?.warrantyClaimLockReason || "",
          warrantyClaimId: warrantyClaimLock?.warrantyClaimId ?? null,
        };
      });
    }

    const usersByName = await fetchUsersByNameMap();
    items = items.map((item) => applyItemLocationContext(item, usersByName));

    if (Number.isInteger(issuedToUserId) && issuedToUserId > 0) {
      items = items.filter((item) => Number(item.issuedToUserId) === issuedToUserId);
    }

    return res.json({ success: true, items });
  })
);

app.get(
  "/api/items/names",
  withDatabase(async (req, res) => {
    const inventoryItemColumns = await ensureInventoryItemsColumns();
    const names = await searchItemNames(
      inventoryItemColumns,
      req.query?.q ?? req.query?.search ?? "",
      req.query?.limit
    );

    return res.json({ success: true, names });
  })
);

app.get(
  "/api/items/:id",
  withDatabase(async (req, res) => {
    const inventoryItemColumns = await ensureInventoryItemsColumns();
    const itemId = Number(req.params.id);
    const idColumn = getItemIdColumn(inventoryItemColumns);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid item id" });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM ${DB_ITEMS_TABLE} WHERE ${idColumn} = ? LIMIT 1`,
      [itemId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "Item not found" });
    }

    const item = normalizeItemRow(rows[0]);
    const inventoryIdValue = Number(item.inventory_id ?? 0);

    if (inventoryIdValue > 0) {
      const inventoryColumns = await ensureInventoriesLocationColumn();
      const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
      const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);

      if (inventoryIdColumn && inventoryNameColumn) {
        const [inventoryRows] = await pool.execute(
          `SELECT ${inventoryNameColumn} AS name FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
          [inventoryIdValue]
        );
        if (inventoryRows[0]?.name) {
          item.inventoryName = inventoryRows[0].name;
        }
      }
    }

    return res.json({ success: true, item });
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

    if (updatingPassword) {
      const passwordCheck = validatePassword(nextPassword);
      if (!passwordCheck.valid) {
        return res.status(400).json({
          success: false,
          message: passwordCheck.message || PASSWORD_REQUIREMENTS_MESSAGE,
        });
      }
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
      const currentPasswordValid = await verifyPassword(currentPassword, rows[0].password);
      if (!currentPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect.",
        });
      }
      await pool.execute(`UPDATE users SET password = ? WHERE ${idColumnName} = ?`, [
        await hashPassword(nextPassword),
        rows[0].id,
      ]);
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

const finalizeInventoryCreationRequest = async ({
  inv,
  requestId,
  requestType,
  inventoryRequestColumns,
  inventoryRequestIdColumn,
  inventoryColumns,
  approverUserId,
  approverRole,
}) => {
  const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);
  const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);
  const inventoryHodColumn = getInventoryHodColumn(inventoryColumns);

  if (!inventoryNameColumn || !inventoryInchargeColumn) {
    return { status: 500, body: { success: false, message: "Inventory schema is missing required columns." } };
  }

  const name = String(inv.name ?? "").trim();
  const location = String(inv.location ?? "").trim();
  const departmentId = Number(inv.department_id ?? 0);
  const inchargeId = Number(inv.incharge_user_id ?? 0);
  const hodUserId = Number(inv.hod_user_id ?? 0);
  const previousInchargeId = Number(inv.previous_incharge_user_id ?? 0);
  const targetInventoryId = Number(inv.target_inventory_id ?? 0);
  const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);

  if (!name || !location || !Number.isInteger(departmentId) || departmentId <= 0) {
    return { status: 400, body: { success: false, message: "Request is missing required inventory details." } };
  }

  if (!Number.isInteger(inchargeId) || inchargeId <= 0) {
    return { status: 400, body: { success: false, message: "Request is missing a valid in-charge person." } };
  }

  let resultingInventoryId = null;

  if (requestType === "change_incharge") {
    if (!inventoryIdColumn || !Number.isInteger(targetInventoryId) || targetInventoryId <= 0) {
      return { status: 400, body: { success: false, message: "Request is missing a valid target inventory." } };
    }

    const [existingInventoryRows] = await pool.execute(
      `SELECT ${inventoryInchargeColumn} AS incharge_id FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
      [targetInventoryId]
    );

    if (existingInventoryRows.length === 0) {
      return { status: 404, body: { success: false, message: "Target inventory was not found." } };
    }

    const currentInchargeOnRecord = Number(existingInventoryRows[0]?.incharge_id ?? 0);

    if (previousInchargeId > 0 && currentInchargeOnRecord !== previousInchargeId) {
      return {
        status: 409,
        body: {
          success: false,
          message: "This inventory already has a different officer assigned. The reassignment request is out of date.",
        },
      };
    }

    const updateAssignments = [`${inventoryInchargeColumn} = ?`];
    const updateValues = [inchargeId];

    if (inventoryHodColumn && Number.isInteger(hodUserId) && hodUserId > 0) {
      updateAssignments.push(`${inventoryHodColumn} = ?`);
      updateValues.push(hodUserId);
    }

    updateValues.push(targetInventoryId);

    await pool.execute(
      `UPDATE inventories SET ${updateAssignments.join(", ")} WHERE ${inventoryIdColumn} = ?`,
      updateValues
    );

    const assignmentCounts = await getInventoryAssignmentCounts();
    await syncInventoryInchargeRole(inchargeId, assignmentCounts);

    const priorInchargeId = previousInchargeId > 0 ? previousInchargeId : currentInchargeOnRecord;

    if (priorInchargeId > 0 && priorInchargeId !== inchargeId) {
      await syncInventoryInchargeRole(priorInchargeId, assignmentCounts);
    }

    resultingInventoryId = targetInventoryId;
  } else {
    const insertColumns = [inventoryNameColumn, "department_id", inventoryInchargeColumn, "location"];
    const insertValues = [name, departmentId, inchargeId, location];

    if (inventoryHodColumn && Number.isInteger(hodUserId) && hodUserId > 0) {
      insertColumns.push(inventoryHodColumn);
      insertValues.push(hodUserId);
    }

    const placeholders = insertColumns.map(() => "?").join(", ");
    const [inventoryResult] = await pool.execute(
      `INSERT INTO inventories (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      insertValues
    );

    await syncInventoryInchargeRole(inchargeId);
    resultingInventoryId = inventoryResult.insertId;
  }

  const updateParts = [];
  const updateValues = [];

  if (inventoryRequestColumns.has("approval_status")) {
    updateParts.push("approval_status = ?");
    updateValues.push(toDbInventoryApprovalStatus("approved_by_admin"));
  }

  if (approverRole === "head_of_department") {
    if (inventoryRequestColumns.has("hod_approved_date")) {
      updateParts.push("hod_approved_date = CURRENT_TIMESTAMP");
    }

    if (inventoryRequestColumns.has("hod_approved_by_id")) {
      updateParts.push("hod_approved_by_id = ?");
      updateValues.push(approverUserId);
    }
  } else if (approverRole === "registrar") {
    if (inventoryRequestColumns.has("registrar_approved_date")) {
      updateParts.push("registrar_approved_date = CURRENT_TIMESTAMP");
    }

    if (inventoryRequestColumns.has("registrar_approved_by_id") && Number.isInteger(approverUserId) && approverUserId > 0) {
      updateParts.push("registrar_approved_by_id = ?");
      updateValues.push(approverUserId);
    }
  } else if (approverRole === "admin") {
    if (inventoryRequestColumns.has("admin_approved_date")) {
      updateParts.push("admin_approved_date = CURRENT_TIMESTAMP");
    }

    if (inventoryRequestColumns.has("admin_approved_by_id") && Number.isInteger(approverUserId) && approverUserId > 0) {
      updateParts.push("admin_approved_by_id = ?");
      updateValues.push(approverUserId);
    }
  }

  if (inventoryRequestColumns.has("created_inventory_id") && resultingInventoryId) {
    updateParts.push("created_inventory_id = ?");
    updateValues.push(resultingInventoryId);
  }

  if (updateParts.length === 0) {
    return { status: 500, body: { success: false, message: "Unable to update approval status." } };
  }

  updateValues.push(requestId);
  await pool.execute(
    `UPDATE inventory_creation_requests SET ${updateParts.join(", ")} WHERE ${inventoryRequestIdColumn} = ?`,
    updateValues
  );

  if (approverRole === "registrar") {
    await notifyApprovalStage(pool, {
      userIds: [inv.requested_by_id],
      workflow: "inventory_creation",
      stage: "registrar",
      entityId: requestId,
      entityLabel: inv.name || `Request #${requestId}`,
      link: "/requests/inventory/staff",
    });
  }

  return {
    status: 200,
    body: {
      success: true,
      message:
        requestType === "change_incharge"
          ? "Inventory officer updated. The previous officer no longer has access; the new officer can manage this inventory."
          : requestType === "add_inventory"
            ? "Existing inventory activated in the system."
            : "Inventory created and request approved.",
      approvalStatus: "approved_by_admin",
      inventoryId: resultingInventoryId,
    },
  };
};

app.post(
  "/api/inventory-creation-requests/:id/approve-hod",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? 0);
    const inventoryRequestColumns = await ensureInventoryCreationRequestsTable();
    const inventoryRequestIdColumn = getInventoryRequestPrimaryKeyColumn(inventoryRequestColumns);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid inventory creation request id is required." });
    }

    if (!Number.isInteger(approverUserId) || approverUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM inventory_creation_requests WHERE ${inventoryRequestIdColumn} = ? LIMIT 1`,
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Inventory creation request not found." });
    }

    const inv = rows[0];
    const hodCol = inventoryRequestColumns.has("hod_user_id");
    const assignedHod = hodCol ? Number(inv.hod_user_id ?? 0) : 0;

    if (hodCol && assignedHod !== approverUserId) {
      return res.status(403).json({ success: false, message: "Only the assigned Head of Department can approve this request." });
    }

    const currentStatus = fromDbInventoryApprovalStatus(inv.approval_status || "pending_hod");
    const hodPendingStatuses = new Set(["pending_hod", "pending_staff"]);

    if (!hodPendingStatuses.has(currentStatus)) {
      return res.status(409).json({ success: false, message: "This request is not awaiting HOD approval." });
    }

    const requestType = String(inv.request_type || "new_inventory_creation").toLowerCase();

    if (requestType === "add_inventory" || requestType === "change_incharge") {
      const inventoryColumns = await ensureInventoriesLocationColumn();
      const result = await finalizeInventoryCreationRequest({
        inv,
        requestId,
        requestType,
        inventoryRequestColumns,
        inventoryRequestIdColumn,
        inventoryColumns,
        approverUserId,
        approverRole: "head_of_department",
      });

      return res.status(result.status).json(result.body);
    }

    const nextStatus = "pending_registrar";

    const updateParts = [];
    const updateValues = [];

    if (inventoryRequestColumns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push(toDbInventoryApprovalStatus(nextStatus));
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
      `UPDATE inventory_creation_requests SET ${updateParts.join(", ")} WHERE ${inventoryRequestIdColumn} = ?`,
      updateValues
    );

    await notifyApprovalStage(pool, {
      userIds: [inv.requested_by_id],
      workflow: "inventory_creation",
      stage: "hod",
      entityId: requestId,
      entityLabel: inv.name || `Request #${requestId}`,
      link: "/requests/inventory/staff",
    });

    return res.json({
      success: true,
      message: "Inventory creation request approved by the Head of Department and forwarded to the registrar.",
      approvalStatus: nextStatus,
    });
  })
);

app.post(
  "/api/inventory-creation-requests/:id/approve-admin",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? 0);
    const inventoryRequestColumns = await ensureInventoryCreationRequestsTable();
    const inventoryRequestIdColumn = getInventoryRequestPrimaryKeyColumn(inventoryRequestColumns);
    const inventoryColumns = await ensureInventoriesLocationColumn();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid inventory creation request id is required." });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM inventory_creation_requests WHERE ${inventoryRequestIdColumn} = ? LIMIT 1`,
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Inventory creation request not found." });
    }

    const inv = rows[0];
    const currentStatus = fromDbInventoryApprovalStatus(inv.approval_status || "");
    const requestType = String(inv.request_type || "new_inventory_creation").toLowerCase();

    if (currentStatus !== "pending_admin") {
      return res.status(409).json({ success: false, message: "This request is not awaiting admin approval." });
    }

    const result = await finalizeInventoryCreationRequest({
      inv,
      requestId,
      requestType,
      inventoryRequestColumns,
      inventoryRequestIdColumn,
      inventoryColumns,
      approverUserId,
      approverRole: "admin",
    });

    return res.status(result.status).json(result.body);
  })
);

app.post(
  "/api/inventory-creation-requests/:id/approve-registrar",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? 0);
    const inventoryRequestColumns = await ensureInventoryCreationRequestsTable();
    const inventoryRequestIdColumn = getInventoryRequestPrimaryKeyColumn(inventoryRequestColumns);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid inventory creation request id is required." });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM inventory_creation_requests WHERE ${inventoryRequestIdColumn} = ? LIMIT 1`,
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Inventory creation request not found." });
    }

    const inv = rows[0];
    const currentStatus = String(inv.approval_status || "").toLowerCase();
    const requestType = String(inv.request_type || "new_inventory_creation").toLowerCase();

    if (currentStatus !== "pending_registrar") {
      return res.status(409).json({ success: false, message: "This request is not awaiting registrar approval." });
    }

    if (requestType !== "new_inventory_creation") {
      return res.status(400).json({
        success: false,
        message: "Only new inventory creation requests require registrar approval.",
      });
    }

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const result = await finalizeInventoryCreationRequest({
      inv,
      requestId,
      requestType,
      inventoryRequestColumns,
      inventoryRequestIdColumn,
      inventoryColumns,
      approverUserId,
      approverRole: "registrar",
    });

    return res.status(result.status).json(result.body);
  })
);

app.post(
  "/api/inventory-creation-requests/:id/reject",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? 0);
    const approverRole = normalizeRoleForStorage(req.body?.approverRole || "head_of_department");
    const reason = String(
      req.body?.reason ?? (
        approverRole === "admin"
          ? "Rejected by Administrator"
          : approverRole === "registrar"
            ? "Rejected by Registrar"
            : "Rejected by Head of Department"
      )
    ).trim();
    const inventoryRequestColumns = await ensureInventoryCreationRequestsTable();
    const inventoryRequestIdColumn = getInventoryRequestPrimaryKeyColumn(inventoryRequestColumns);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid inventory creation request id is required." });
    }

    if (!["admin", "registrar"].includes(approverRole) && (!Number.isInteger(approverUserId) || approverUserId <= 0)) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM inventory_creation_requests WHERE ${inventoryRequestIdColumn} = ? LIMIT 1`,
      [requestId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Inventory creation request not found." });
    }

    const inv = rows[0];
    const currentStatus = fromDbInventoryApprovalStatus(inv.approval_status || "pending_hod");

    if (approverRole === "admin") {
      if (currentStatus !== "pending_admin") {
        return res.status(409).json({ success: false, message: "This request is not awaiting admin approval." });
      }
    } else if (approverRole === "registrar") {
      if (currentStatus !== "pending_registrar") {
        return res.status(409).json({ success: false, message: "This request is not awaiting registrar approval." });
      }
    } else {
      const hodCol = inventoryRequestColumns.has("hod_user_id");
      const assignedHod = hodCol ? Number(inv.hod_user_id ?? 0) : 0;

      if (hodCol && assignedHod !== approverUserId) {
        return res.status(403).json({ success: false, message: "Only the assigned Head of Department can reject this request." });
      }

      const hodPendingStatuses = new Set(["pending_hod", "pending_staff"]);

      if (!hodPendingStatuses.has(currentStatus)) {
        return res.status(409).json({ success: false, message: "This request is not awaiting HOD approval." });
      }
    }

    const updateParts = [];
    const updateValues = [];

    if (inventoryRequestColumns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push(toDbInventoryApprovalStatus("rejected"));
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
      `UPDATE inventory_creation_requests SET ${updateParts.join(", ")} WHERE ${inventoryRequestIdColumn} = ?`,
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
    const inchargeUserId = Number(req.body?.inchargeId ?? req.body?.inchargeUserId ?? 0);
    const hodUserId = Number(req.body?.hodUserId ?? 0);
    const reason = String(req.body?.description ?? req.body?.reason ?? "").trim();
    const targetInventoryId = Number(req.body?.targetInventoryId ?? req.body?.inventoryId ?? 0);
    const normalizedRequestType = requestType === "change_incharge"
      ? "change_incharge"
      : requestType === "add_inventory"
        ? "add_inventory"
        : "new_inventory_creation";

    if (!Number.isInteger(requestedById) || requestedById <= 0) {
      return res.status(400).json({ success: false, message: "A valid requesting user is required." });
    }

    let resolvedName = name;
    let resolvedLocation = location;
    let resolvedDepartmentName = departmentName;
    let resolvedDepartmentId = null;
    let resolvedInchargeUserId = inchargeUserId;
    let previousInchargeUserId = null;

    if (normalizedRequestType === "change_incharge") {
      if (!Number.isInteger(targetInventoryId) || targetInventoryId <= 0) {
        return res.status(400).json({ success: false, message: "A valid inventory id is required." });
      }

      if (!Number.isInteger(inchargeUserId) || inchargeUserId <= 0) {
        return res.status(400).json({ success: false, message: "A proposed inventory officer is required." });
      }

      if (!reason) {
        return res.status(400).json({ success: false, message: "A reason for changing the inventory officer is required." });
      }

      if (inchargeUserId === requestedById) {
        return res.status(400).json({ success: false, message: "The new inventory officer must be different from the current officer." });
      }

      const inventoryColumns = await ensureInventoriesLocationColumn();
      const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
      const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);
      const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

      if (!inventoryIdColumn || !inventoryNameColumn || !inventoryInchargeColumn) {
        return res.status(500).json({ success: false, message: "Inventory schema is missing required columns." });
      }

      const [inventoryRows] = await pool.execute(
        `
          SELECT
            i.${inventoryIdColumn} AS inventory_id,
            i.${inventoryNameColumn} AS inventory_name,
            i.${inventoryInchargeColumn} AS incharge_id,
            i.department_id,
            ${inventoryColumns.has("location") ? "i.location" : "NULL AS location"}
          FROM inventories i
          WHERE i.${inventoryIdColumn} = ?
          LIMIT 1
        `,
        [targetInventoryId]
      );

      if (inventoryRows.length === 0) {
        return res.status(404).json({ success: false, message: "Inventory was not found." });
      }

      const inventoryRow = inventoryRows[0];
      const currentInchargeId = Number(inventoryRow.incharge_id ?? 0);

      if (currentInchargeId !== requestedById) {
        return res.status(403).json({
          success: false,
          message: "Only the current inventory officer can request a change of officer.",
        });
      }

      resolvedDepartmentId = Number(inventoryRow.department_id ?? 0);
      resolvedName = String(inventoryRow.inventory_name ?? "").trim() || name;
      resolvedLocation = String(inventoryRow.location ?? "").trim() || location;
      previousInchargeUserId = currentInchargeId;
      resolvedInchargeUserId = inchargeUserId;

      if (schema.hasDepartmentsTable && resolvedDepartmentId > 0) {
        const departmentJoinIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
        const departmentNameColumn = schema.departmentColumns.has("name")
          ? "name"
          : schema.departmentColumns.has("department_name")
            ? "department_name"
            : null;

        if (departmentNameColumn) {
          const [departmentRows] = await pool.execute(
            `SELECT ${departmentNameColumn} AS department_name FROM departments WHERE ${departmentJoinIdColumn} = ? LIMIT 1`,
            [resolvedDepartmentId]
          );
          resolvedDepartmentName = String(departmentRows[0]?.department_name ?? "").trim() || departmentName;
        }
      }

      const inventoryRequestColumns = await ensureInventoryCreationRequestsTable();
      const inventoryRequestIdColumn = getInventoryRequestPrimaryKeyColumn(inventoryRequestColumns);
      const pendingStatuses = ["pending_hod", "pending_staff", "pending_registrar", "pending_admin", "approved_by_hod"];

      if (inventoryRequestColumns.has("request_type") && inventoryRequestColumns.has("target_inventory_id")) {
        const pendingPlaceholders = pendingStatuses.map(() => "?").join(", ");
        const [pendingRows] = await pool.execute(
          `
            SELECT ${inventoryRequestIdColumn} AS id
            FROM inventory_creation_requests
            WHERE target_inventory_id = ?
              AND LOWER(COALESCE(request_type, '')) = 'change_incharge'
              AND LOWER(COALESCE(approval_status, '')) IN (${pendingPlaceholders})
            LIMIT 1
          `,
          [targetInventoryId, ...pendingStatuses.map((status) => toDbInventoryApprovalStatus(status))]
        );

        if (pendingRows.length > 0) {
          return res.status(409).json({
            success: false,
            message: "A change of inventory officer is already pending approval for this inventory.",
          });
        }
      }
    } else if (!name || !location || !departmentName || !Number.isInteger(inchargeUserId) || inchargeUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Name, location, department, and in-charge person are required.",
      });
    }

    const departmentId = resolvedDepartmentId || await resolveDepartmentId(schema, resolvedDepartmentName || departmentName);

    if (!departmentId) {
      return res.status(400).json({ success: false, message: "Selected department was not found." });
    }

    const resolvedHodUserId = Number.isInteger(hodUserId) && hodUserId > 0
      ? hodUserId
      : await resolveDepartmentHeadUserId(schema, departmentId);

    if (!resolvedHodUserId) {
      return res.status(400).json({ success: false, message: "No active Head of Department is assigned to the selected department." });
    }

    const requesterRole = await resolveRequestingUserRole(schema, requestedById);
    const insertColumns = ["name", "department_id", "requested_by_id", "approval_status"];
    const insertValues = [
      resolvedName || name,
      departmentId,
      requestedById,
      toDbInventoryApprovalStatus("pending_hod"),
    ];

    if (inventoryRequestColumns.has("request_type")) {
      insertColumns.push("request_type");
      insertValues.push(normalizedRequestType);
    }

    if (inventoryRequestColumns.has("location")) {
      insertColumns.push("location");
      insertValues.push(resolvedLocation || location);
    }

    if (inventoryRequestColumns.has("incharge_user_id")) {
      insertColumns.push("incharge_user_id");
      insertValues.push(resolvedInchargeUserId);
    }

    if (inventoryRequestColumns.has("previous_incharge_user_id") && Number.isInteger(previousInchargeUserId) && previousInchargeUserId > 0) {
      insertColumns.push("previous_incharge_user_id");
      insertValues.push(previousInchargeUserId);
    }

    if (inventoryRequestColumns.has("target_inventory_id") && Number.isInteger(targetInventoryId) && targetInventoryId > 0) {
      insertColumns.push("target_inventory_id");
      insertValues.push(targetInventoryId);
    }

    if (inventoryRequestColumns.has("hod_user_id")) {
      insertColumns.push("hod_user_id");
      insertValues.push(resolvedHodUserId);
    }

    if (inventoryRequestColumns.has("reason")) {
      insertColumns.push("reason");
      insertValues.push(reason);
    }

    if (inventoryRequestColumns.has("submitted_by_role") && requesterRole) {
      insertColumns.push("submitted_by_role");
      insertValues.push(isAdminRole(requesterRole) ? "admin" : normalizeRoleForStorage(requesterRole));
    }

    const placeholders = insertColumns.map(() => "?").join(", ");
    const [result] = await pool.execute(
      `INSERT INTO inventory_creation_requests (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      insertValues
    );

    const isAdminSubmitted = requesterRole === "admin";

    return res.status(201).json({
      success: true,
      message: normalizedRequestType === "change_incharge"
        ? "Inventory officer change request submitted to your Head of Department for approval."
        : isAdminSubmitted
          ? "Inventory request submitted for HOD review. It is listed under Inventory Management → Creation Requests; approve or reject will be available after required approvals."
          : normalizedRequestType === "add_inventory"
            ? "Inventory addition request submitted to your Head of Department for approval."
            : "New inventory creation request submitted for HOD review. After HOD approval, it will proceed to registrar approval.",
      requestId: result.insertId,
      requestType: normalizedRequestType,
      approvalStatus: "pending_hod",
      submittedByRole: requesterRole || "",
    });
  })
);

const createItemTransfersTable = async () => {
  try {
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS item_transfers (
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
          created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_date TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
          completed_date TIMESTAMP NULL
        )
      `
    );
    console.log("item_transfers table ensured");
  } catch (error) {
    console.error("Error creating item_transfers table:", error.message);
  }
};

const createItemDisposalsTable = async () => {
  try {
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS item_disposals (
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
        )
      `
    );
    console.log("item_disposals table ensured");
  } catch (error) {
    console.error("Error creating item_disposals table:", error.message);
  }
};

const createItemRepairsTable = async () => {
  try {
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS item_repairs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          item_id INT NOT NULL,
          inventory_id INT NOT NULL,
          quantity INT NOT NULL DEFAULT 1,
          fault_description TEXT NULL,
          repair_notes TEXT NULL,
          status VARCHAR(50) DEFAULT 'submitted',
          repair_date DATE NULL,
          initiated_by_id INT NULL,
          created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_date TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
          completed_date TIMESTAMP NULL
        )
      `
    );
    console.log("item_repairs table ensured");
  } catch (error) {
    console.error("Error creating item_repairs table:", error.message);
  }
};

const createWarrantyClaimsTable = async () => {
  try {
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS warranty_claims (
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
        )
      `
    );
    console.log("warranty_claims table ensured");
  } catch (error) {
    console.error("Error creating warranty_claims table:", error.message);
  }
};

const ensureItemTransfersWorkflow = async () => {
  try {
    await createItemTransfersTable();
    const [tables] = await pool.query("SHOW TABLES LIKE 'item_transfers'");
    if (tables.length === 0) {
      return null;
    }

    const columns = await getTableColumns("item_transfers");
    await addWorkflowColumnIfMissing("item_transfers", columns, "approval_status", "VARCHAR(50) NULL");
    await addWorkflowColumnIfMissing("item_transfers", columns, "registrar_approved_date", "TIMESTAMP NULL");
    await addWorkflowColumnIfMissing("item_transfers", columns, "registrar_approved_by_id", "INT NULL");
    await addWorkflowColumnIfMissing("item_transfers", columns, "hod_approved_date", "TIMESTAMP NULL");
    await addWorkflowColumnIfMissing("item_transfers", columns, "hod_approved_by_id", "INT NULL");
    await addWorkflowColumnIfMissing("item_transfers", columns, "rejection_reason", "VARCHAR(500) NULL");
    await addWorkflowColumnIfMissing("item_transfers", columns, "source_hod_user_id", "INT NULL");

    if (!columns.has("source_hod_user_id")) {
      columns.add("source_hod_user_id");
    }

    await pool.query(`
      UPDATE item_transfers
      SET approval_status = 'pending_hod'
      WHERE LOWER(COALESCE(approval_status, '')) = 'pending_registrar'
        AND hod_approved_date IS NULL
        AND LOWER(COALESCE(status, '')) NOT IN ('completed', 'rejected', 'cancelled')
    `);

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryHodColumn = getInventoryHodColumn(inventoryColumns);

    if (inventoryIdColumn && inventoryHodColumn) {
      await pool.query(`
        UPDATE item_transfers it
        INNER JOIN inventories inv ON inv.${inventoryIdColumn} = it.from_inventory_id
        SET it.source_hod_user_id = inv.${inventoryHodColumn}
        WHERE it.source_hod_user_id IS NULL
          AND inv.${inventoryHodColumn} IS NOT NULL
      `);
    }

    const schema = await getAuthSchema();
    const [transfersNeedingHodRows] = await pool.query(`
      SELECT DISTINCT from_inventory_id
      FROM item_transfers
      WHERE source_hod_user_id IS NULL
        AND from_inventory_id IS NOT NULL
    `);

    for (const row of transfersNeedingHodRows) {
      const resolvedHodUserId = await resolveSourceInventoryHodUserId(
        Number(row.from_inventory_id),
        inventoryColumns,
        schema
      );

      if (resolvedHodUserId) {
        await pool.execute(
          "UPDATE item_transfers SET source_hod_user_id = ? WHERE from_inventory_id = ? AND source_hod_user_id IS NULL",
          [resolvedHodUserId, row.from_inventory_id]
        );
      }
    }

    return columns;
  } catch (error) {
    console.error("Error ensuring item_transfers workflow columns:", error.message);
    return null;
  }
};

const ensureItemDisposalsWorkflow = async () => {
  try {
    await createItemDisposalsTable();
    const [tables] = await pool.query("SHOW TABLES LIKE 'item_disposals'");
    if (tables.length === 0) {
      return null;
    }

    const columns = await getTableColumns("item_disposals");
    await addWorkflowColumnIfMissing("item_disposals", columns, "approval_status", "VARCHAR(50) NULL");
    await addWorkflowColumnIfMissing("item_disposals", columns, "registrar_approved_date", "TIMESTAMP NULL");
    await addWorkflowColumnIfMissing("item_disposals", columns, "registrar_approved_by_id", "INT NULL");
    await addWorkflowColumnIfMissing("item_disposals", columns, "hod_approved_date", "TIMESTAMP NULL");
    await addWorkflowColumnIfMissing("item_disposals", columns, "hod_approved_by_id", "INT NULL");
    await addWorkflowColumnIfMissing("item_disposals", columns, "rejection_reason", "VARCHAR(500) NULL");
    await addWorkflowColumnIfMissing("item_disposals", columns, "source_hod_user_id", "INT NULL");
    await addWorkflowColumnIfMissing("item_disposals", columns, "disposal_type", "VARCHAR(50) NULL");
    await addWorkflowColumnIfMissing("item_disposals", columns, "disposal_type_details", "TEXT NULL");
    await addWorkflowColumnIfMissing("item_disposals", columns, "reason_other_details", "TEXT NULL");

    if (!columns.has("source_hod_user_id")) {
      columns.add("source_hod_user_id");
    }

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryHodColumn = getInventoryHodColumn(inventoryColumns);

    if (inventoryIdColumn && inventoryHodColumn) {
      await pool.query(`
        UPDATE item_disposals idp
        INNER JOIN inventories inv ON inv.${inventoryIdColumn} = idp.inventory_id
        SET idp.source_hod_user_id = inv.${inventoryHodColumn}
        WHERE idp.source_hod_user_id IS NULL
          AND inv.${inventoryHodColumn} IS NOT NULL
      `);
    }

    if (columns.has("approval_status")) {
      await pool.query(`
        UPDATE item_disposals
        SET approval_status = 'pending_writeoff'
        WHERE LOWER(COALESCE(approval_status, '')) = 'pending_admin'
          AND LOWER(COALESCE(status, '')) NOT IN ('completed', 'rejected', 'cancelled')
      `);
    }

    return columns;
  } catch (error) {
    console.error("Error ensuring item_disposals workflow columns:", error.message);
    return null;
  }
};

const ensureItemRepairsWorkflow = async () => {
  try {
    await createItemRepairsTable();
    const [tables] = await pool.query("SHOW TABLES LIKE 'item_repairs'");
    if (tables.length === 0) {
      return null;
    }

    const columns = await getTableColumns("item_repairs");
    await addWorkflowColumnIfMissing("item_repairs", columns, "contact_person_user_id", "INT NULL");
    return columns;
  } catch (error) {
    console.error("Error ensuring item_repairs workflow columns:", error.message);
    return null;
  }
};

const ensureWarrantyClaimsWorkflow = async () => {
  try {
    await createWarrantyClaimsTable();
    const [tables] = await pool.query("SHOW TABLES LIKE 'warranty_claims'");
    if (tables.length === 0) {
      return null;
    }

    const columns = await getTableColumns("warranty_claims");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "item_id", "INT NULL");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "inventory_id", "INT NULL");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "quantity", "INT NOT NULL DEFAULT 1");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "fault_description", "TEXT NULL");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "claim_notes", "TEXT NULL");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "status", "VARCHAR(50) DEFAULT 'submitted'");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "claim_date", "DATE NULL");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "initiated_by_id", "INT NULL");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "created_date", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "updated_date", "TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP");
    await addWorkflowColumnIfMissing("warranty_claims", columns, "completed_date", "TIMESTAMP NULL");

    if (!columns.has("item_id") && columns.has("inventory_item_id")) {
      await pool.query("ALTER TABLE warranty_claims ADD COLUMN item_id INT NULL");
      columns.add("item_id");
      await pool.query(
        "UPDATE warranty_claims SET item_id = inventory_item_id WHERE item_id IS NULL AND inventory_item_id IS NOT NULL"
      );
    }

    if (!columns.has("id")) {
      await addWorkflowColumnIfMissing("warranty_claims", columns, "id", "INT NULL");
      if (columns.has("claim_id")) {
        await pool.query(
          "UPDATE warranty_claims SET id = claim_id WHERE id IS NULL AND claim_id IS NOT NULL"
        );
      }
    }

    return columns;
  } catch (error) {
    console.error("Error ensuring warranty_claims workflow columns:", error.message);
    return null;
  }
};

const getWarrantyClaimItemIdColumn = (claimColumns) => {
  if (claimColumns?.has("item_id")) {
    return "item_id";
  }

  if (claimColumns?.has("inventory_item_id")) {
    return "inventory_item_id";
  }

  return null;
};

const getWarrantyClaimIdColumn = (claimColumns) => {
  if (claimColumns?.has("id")) {
    return "id";
  }

  if (claimColumns?.has("claim_id")) {
    return "claim_id";
  }

  if (claimColumns?.has("warranty_claim_id")) {
    return "warranty_claim_id";
  }

  return null;
};

const getWarrantyClaimInventoryIdColumn = (claimColumns) => {
  if (claimColumns?.has("inventory_id")) {
    return "inventory_id";
  }

  return null;
};

const isWarrantyClaimSchemaQueryable = (claimColumns) =>
  Boolean(
    getWarrantyClaimIdColumn(claimColumns)
    && getWarrantyClaimItemIdColumn(claimColumns)
    && getWarrantyClaimInventoryIdColumn(claimColumns)
    && claimColumns?.has("status")
  );

const parseWarrantyMonths = (warranty = "") => {
  const legacyMap = {
    "1year": "1 Year",
    "2years": "2 Years",
    "3years": "3 Years",
    "5years": "5 Years",
  };
  const normalized = String(warranty || "").trim();
  const mapped = legacyMap[normalized.toLowerCase()] || normalized;
  const match = mapped.toLowerCase().match(/(\d+)\s*(month|year|yr|yrs|years?)/);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return match[2].startsWith("month") ? amount : amount * 12;
};

const resolveItemPurchaseDateFromRow = (row = {}) => {
  const candidates = [
    row.purchaseDate,
    row.purchase_date,
    row.purchased_date,
    row.purchasedate,
    row.created_at,
    row.createdAt,
  ];

  for (const candidate of candidates) {
    if (candidate == null || candidate === "") {
      continue;
    }

    const parsed = candidate instanceof Date ? candidate : new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

const isItemInWarrantyPeriod = (purchaseDateOrItem, warranty, referenceDate = new Date()) => {
  const months = parseWarrantyMonths(warranty);
  if (!months) {
    return false;
  }

  const purchaseDate = purchaseDateOrItem instanceof Date
    ? purchaseDateOrItem
    : typeof purchaseDateOrItem === "object" && purchaseDateOrItem !== null
      ? resolveItemPurchaseDateFromRow(purchaseDateOrItem)
      : purchaseDateOrItem;

  if (!purchaseDate) {
    return false;
  }

  const start = purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate);
  if (Number.isNaN(start.getTime())) {
    return false;
  }

  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + months);
  return referenceDate <= expiry;
};

const buildActiveRepairLockCondition = (tableAlias) =>
  `LOWER(COALESCE(${tableAlias}.status, '')) NOT IN ('completed', 'cancelled')`;

const resolveRepairStatus = (row = {}) => String(row.status || "submitted").trim().toLowerCase();

const resolveTransferDisposalApprovalStatus = (row, columns) => {
  if (columns?.has("approval_status") && row.approval_status) {
    return String(row.approval_status).trim().toLowerCase();
  }

  const legacyStatus = String(row.status || "pending").trim().toLowerCase();
  if (legacyStatus === "pending") {
    return "pending_hod";
  }

  return legacyStatus;
};

const buildActiveTransferLockCondition = (tableAlias, transferColumns) => {
  const pendingParts = [
    `LOWER(COALESCE(${tableAlias}.status, '')) NOT IN ('completed', 'rejected', 'cancelled')`,
  ];

  if (transferColumns.has("approval_status")) {
    pendingParts.push(
      `(${tableAlias}.approval_status IS NULL OR LOWER(COALESCE(${tableAlias}.approval_status, '')) NOT IN ('rejected', 'cancelled', 'completed'))`
    );
  }

  return `(LOWER(COALESCE(${tableAlias}.status, '')) = 'completed' OR (${pendingParts.join(" AND ")}))`;
};

const getTransferLockMapForInventory = async (inventoryId, itemIds = []) => {
  const transferColumns = await ensureItemTransfersWorkflow();
  if (!transferColumns || !Number.isInteger(inventoryId) || inventoryId <= 0) {
    return new Map();
  }

  const lockCondition = buildActiveTransferLockCondition("it", transferColumns);
  const params = [inventoryId];
  let itemFilter = "";

  if (itemIds.length > 0) {
    itemFilter = ` AND it.item_id IN (${itemIds.map(() => "?").join(", ")})`;
    params.push(...itemIds);
  }

  const [rows] = await pool.execute(
    `
      SELECT
        it.item_id,
        it.id AS transfer_id,
        it.status,
        ${transferColumns.has("approval_status") ? "it.approval_status" : "NULL AS approval_status"}
      FROM item_transfers it
      WHERE it.from_inventory_id = ?
        AND ${lockCondition}
        ${itemFilter}
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(it.status, '')) NOT IN ('completed', 'rejected', 'cancelled') THEN 0
          ELSE 1
        END,
        it.id DESC
    `,
    params
  );

  const lockMap = new Map();

  rows.forEach((row) => {
    const itemId = Number(row.item_id);
    if (!itemId || lockMap.has(itemId)) {
      return;
    }

    const statusKey = String(row.status || "").toLowerCase();
    const approvalKey = String(row.approval_status || "").toLowerCase();
    const isPending =
      !["completed", "rejected", "cancelled"].includes(statusKey)
      && (!row.approval_status || !["rejected", "cancelled", "completed"].includes(approvalKey));

    lockMap.set(itemId, {
      transferId: row.transfer_id,
      transferLockReason: isPending ? "pending" : "completed",
      transferLocked: true,
    });
  });

  return lockMap;
};

const getDisposalLockMapForInventory = async (inventoryId, itemIds = []) => {
  const disposalColumns = await ensureItemDisposalsWorkflow();
  if (!disposalColumns || !Number.isInteger(inventoryId) || inventoryId <= 0) {
    return new Map();
  }

  const lockCondition = buildActiveTransferLockCondition("idp", disposalColumns);
  const params = [inventoryId];
  let itemFilter = "";

  if (itemIds.length > 0) {
    itemFilter = ` AND idp.item_id IN (${itemIds.map(() => "?").join(", ")})`;
    params.push(...itemIds);
  }

  const [rows] = await pool.execute(
    `
      SELECT
        idp.item_id,
        idp.id AS disposal_id,
        idp.status,
        ${disposalColumns.has("approval_status") ? "idp.approval_status" : "NULL AS approval_status"}
      FROM item_disposals idp
      WHERE idp.inventory_id = ?
        AND ${lockCondition}
        ${itemFilter}
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(idp.status, '')) NOT IN ('completed', 'rejected', 'cancelled') THEN 0
          ELSE 1
        END,
        idp.id DESC
    `,
    params
  );

  const lockMap = new Map();

  rows.forEach((row) => {
    const itemId = Number(row.item_id);
    if (!itemId || lockMap.has(itemId)) {
      return;
    }

    const statusKey = String(row.status || "").toLowerCase();
    const approvalKey = String(row.approval_status || "").toLowerCase();
    const isPending =
      !["completed", "rejected", "cancelled"].includes(statusKey)
      && (!row.approval_status || !["rejected", "cancelled", "completed"].includes(approvalKey));

    lockMap.set(itemId, {
      disposalId: row.disposal_id,
      disposalLockReason: isPending ? "pending" : "completed",
      disposalLocked: true,
    });
  });

  return lockMap;
};

const getRepairLockMapForInventory = async (inventoryId, itemIds = []) => {
  const repairColumns = await ensureItemRepairsWorkflow();
  if (!repairColumns || !Number.isInteger(inventoryId) || inventoryId <= 0) {
    return new Map();
  }

  const lockCondition = buildActiveRepairLockCondition("ir");
  const params = [inventoryId];
  let itemFilter = "";

  if (itemIds.length > 0) {
    itemFilter = ` AND ir.item_id IN (${itemIds.map(() => "?").join(", ")})`;
    params.push(...itemIds);
  }

  const [rows] = await pool.execute(
    `
      SELECT ir.item_id, ir.id AS repair_id, ir.status
      FROM item_repairs ir
      WHERE ir.inventory_id = ?
        AND ${lockCondition}
        ${itemFilter}
      ORDER BY ir.id DESC
    `,
    params
  );

  const lockMap = new Map();
  rows.forEach((row) => {
    const itemId = Number(row.item_id);
    if (!itemId || lockMap.has(itemId)) {
      return;
    }
    const statusKey = String(row.status || "").toLowerCase();
    const isPending = !["completed", "cancelled"].includes(statusKey);
    lockMap.set(itemId, {
      repairId: row.repair_id,
      repairLockReason: isPending ? "pending" : "completed",
      repairLocked: true,
    });
  });

  return lockMap;
};

const getWarrantyClaimLockMapForInventory = async (inventoryId, itemIds = []) => {
  const claimColumns = await ensureWarrantyClaimsWorkflow();
  const claimItemIdColumn = getWarrantyClaimItemIdColumn(claimColumns);
  const claimIdColumn = getWarrantyClaimIdColumn(claimColumns);
  const claimInventoryIdColumn = getWarrantyClaimInventoryIdColumn(claimColumns);

  if (
    !isWarrantyClaimSchemaQueryable(claimColumns)
    || !Number.isInteger(inventoryId)
    || inventoryId <= 0
  ) {
    return new Map();
  }

  const lockCondition = buildActiveRepairLockCondition("wc");
  const params = [inventoryId];
  let itemFilter = "";

  if (itemIds.length > 0) {
    itemFilter = ` AND wc.${claimItemIdColumn} IN (${itemIds.map(() => "?").join(", ")})`;
    params.push(...itemIds);
  }

  const [rows] = await pool.execute(
    `
      SELECT wc.${claimItemIdColumn} AS item_id, wc.${claimIdColumn} AS claim_id, wc.status
      FROM warranty_claims wc
      WHERE wc.${claimInventoryIdColumn} = ?
        AND ${lockCondition}
        ${itemFilter}
      ORDER BY wc.${claimIdColumn} DESC
    `,
    params
  );

  const lockMap = new Map();
  rows.forEach((row) => {
    const itemId = Number(row.item_id);
    if (!itemId || lockMap.has(itemId)) {
      return;
    }
    const statusKey = String(row.status || "").toLowerCase();
    const isPending = !["completed", "cancelled"].includes(statusKey);
    lockMap.set(itemId, {
      warrantyClaimId: row.claim_id,
      warrantyClaimLockReason: isPending ? "pending" : "completed",
      warrantyClaimLocked: true,
    });
  });

  return lockMap;
};

const buildTransferBatchMatchParts = (columns, transferAlias = "it") => {
  const batchMatchParts = [
    `${transferAlias}.from_inventory_id = anchor.from_inventory_id`,
    `${transferAlias}.to_inventory_id = anchor.to_inventory_id`,
    `COALESCE(${transferAlias}.reason, '') = COALESCE(anchor.reason, '')`,
  ];

  if (columns.has("initiated_by_id")) {
    batchMatchParts.push(
      `((anchor.initiated_by_id IS NULL AND ${transferAlias}.initiated_by_id IS NULL) OR ${transferAlias}.initiated_by_id = anchor.initiated_by_id)`
    );
  }

  if (columns.has("transfer_date")) {
    batchMatchParts.push(
      `((anchor.transfer_date IS NULL AND ${transferAlias}.transfer_date IS NULL) OR DATE(${transferAlias}.transfer_date) = DATE(anchor.transfer_date))`
    );
  }

  return batchMatchParts;
};

const fetchTransferBatchLineIds = async (transferId, columns) => {
  const batchMatchParts = buildTransferBatchMatchParts(columns);
  const [lineRows] = await pool.execute(
    `
      SELECT it.id
      FROM item_transfers anchor
      INNER JOIN item_transfers it ON ${batchMatchParts.join(" AND ")}
      WHERE anchor.id = ?
      ORDER BY it.id ASC
    `,
    [transferId]
  );

  return lineRows.map((row) => row.id).filter(Boolean);
};

const buildDisposalBatchMatchParts = (columns, disposalAlias = "idp") => {
  const batchMatchParts = [
    `${disposalAlias}.inventory_id = anchor.inventory_id`,
    `COALESCE(${disposalAlias}.reason, '') = COALESCE(anchor.reason, '')`,
    `COALESCE(${disposalAlias}.description, '') = COALESCE(anchor.description, '')`,
    `COALESCE(${disposalAlias}.\`condition\`, '') = COALESCE(anchor.\`condition\`, '')`,
  ];

  if (columns.has("initiated_by_id")) {
    batchMatchParts.push(
      `((anchor.initiated_by_id IS NULL AND ${disposalAlias}.initiated_by_id IS NULL) OR ${disposalAlias}.initiated_by_id = anchor.initiated_by_id)`
    );
  }

  if (columns.has("disposal_date")) {
    batchMatchParts.push(
      `((anchor.disposal_date IS NULL AND ${disposalAlias}.disposal_date IS NULL) OR DATE(${disposalAlias}.disposal_date) = DATE(anchor.disposal_date))`
    );
  }

  if (columns.has("disposal_type")) {
    batchMatchParts.push(
      `COALESCE(${disposalAlias}.disposal_type, '') = COALESCE(anchor.disposal_type, '')`
    );
  }

  if (columns.has("disposal_type_details")) {
    batchMatchParts.push(
      `COALESCE(${disposalAlias}.disposal_type_details, '') = COALESCE(anchor.disposal_type_details, '')`
    );
  }

  if (columns.has("reason_other_details")) {
    batchMatchParts.push(
      `COALESCE(${disposalAlias}.reason_other_details, '') = COALESCE(anchor.reason_other_details, '')`
    );
  }

  return batchMatchParts;
};

const fetchDisposalBatchLineIds = async (disposalId, columns) => {
  const batchMatchParts = buildDisposalBatchMatchParts(columns);
  const [lineRows] = await pool.execute(
    `
      SELECT idp.id
      FROM item_disposals anchor
      INNER JOIN item_disposals idp ON ${batchMatchParts.join(" AND ")}
      WHERE anchor.id = ?
      ORDER BY idp.id ASC
    `,
    [disposalId]
  );

  return lineRows.map((row) => row.id).filter(Boolean);
};

const resolveSourceInventoryHodUserId = async (fromInventoryId, inventoryColumns, schema) => {
  const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
  const inventoryHodColumn = getInventoryHodColumn(inventoryColumns);

  if (!inventoryIdColumn || !fromInventoryId) {
    return null;
  }

  const hodSelect = inventoryHodColumn ? `i.${inventoryHodColumn} AS hod_user_id` : "NULL AS hod_user_id";
  const [rows] = await pool.execute(
    `
      SELECT i.department_id, ${hodSelect}
      FROM inventories i
      WHERE i.${inventoryIdColumn} = ?
      LIMIT 1
    `,
    [fromInventoryId]
  );

  if (rows.length === 0) {
    return null;
  }

  const assignedHod = Number(rows[0]?.hod_user_id ?? 0);
  if (Number.isInteger(assignedHod) && assignedHod > 0) {
    return assignedHod;
  }

  const departmentId = Number(rows[0]?.department_id ?? 0);
  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return null;
  }

  return resolveDepartmentHeadUserId(schema, departmentId);
};

const canUserManageTransferBeforeHod = (transferRow, userId, sourceInchargeId) => {
  const actorId = Number(userId ?? 0);
  if (!Number.isInteger(actorId) || actorId <= 0) {
    return false;
  }

  const initiatorId = Number(transferRow?.initiated_by_id ?? 0);
  const inchargeId = Number(sourceInchargeId ?? 0);

  return actorId === initiatorId || (inchargeId > 0 && actorId === inchargeId);
};

const buildItemNameExpression = (itemColumns) => {
  if (itemColumns.has("itemName")) {
    return "ii.itemName";
  }
  if (itemColumns.has("item_name")) {
    return "ii.item_name";
  }
  if (itemColumns.has("name")) {
    return "ii.name";
  }
  return `CAST(ii.${getItemIdColumn(itemColumns)} AS CHAR)`;
};

const buildProcessedAtExpression = (tableAlias, columns, preferredDateColumns = []) => {
  const candidates = [
    ...preferredDateColumns,
    "rejection_date",
    "registrar_approved_date",
    "updated_date",
    "created_date",
    "requested_date",
    "transfer_date",
    "disposal_date",
  ];

  const parts = [];
  candidates.forEach((columnName) => {
    if (columns?.has(columnName) && !parts.includes(`${tableAlias}.${columnName}`)) {
      parts.push(`${tableAlias}.${columnName}`);
    }
  });

  if (parts.length === 0) {
    return "CURRENT_TIMESTAMP";
  }

  return `COALESCE(${parts.join(", ")})`;
};

app.get(
  "/api/item-requests",
  withDatabase(async (req, res) => {
    const itemRequestColumns = await ensureItemRequestsTable();
    const schema = await getAuthSchema();
    const requestedById = Number(req.query?.requestedById ?? req.query?.requested_by_id ?? 0);
    const hodUserId = Number(req.query?.hodUserId ?? req.query?.hod_user_id ?? 0);
    const requesterHodUserId = Number(
      req.query?.requesterHodUserId ?? req.query?.requester_hod_user_id ?? 0
    );
    const labHodUserId = Number(req.query?.labHodUserId ?? 0);
    const inventoryOfficerUserId = Number(
      req.query?.inventoryOfficerUserId ?? req.query?.inventory_officer_user_id ?? 0
    );
    const requesterScope = String(req.query?.requesterScope ?? "all").trim().toLowerCase();
    const approvalStatus = String(req.query?.approvalStatus ?? req.query?.approval_status ?? "").trim().toLowerCase();
    const departmentIdFilter = Number(req.query?.departmentId ?? 0);

    const hasRequestedByFilter =
      Number.isInteger(requestedById) && requestedById > 0 && itemRequestColumns.has("requested_by_id");
    const hasHodFilter =
      Number.isInteger(hodUserId) && hodUserId > 0 && itemRequestColumns.has("hod_user_id");
    const hasRequesterHodFilter =
      Number.isInteger(requesterHodUserId) && requesterHodUserId > 0 && itemRequestColumns.has("hod_user_id");
    const hasLabHodFilter =
      Number.isInteger(labHodUserId) && labHodUserId > 0 && itemRequestColumns.has("lab_hod_user_id");
    const hasInventoryOfficerFilter =
      Number.isInteger(inventoryOfficerUserId)
      && inventoryOfficerUserId > 0
      && itemRequestColumns.has("inventory_officer_user_id");
    const inventoryOfficerScope = String(
      req.query?.inventoryOfficerScope ?? req.query?.scope ?? "pending_issue"
    ).trim().toLowerCase();

    if (
      !hasRequestedByFilter &&
      !hasHodFilter &&
      !hasRequesterHodFilter &&
      !hasLabHodFilter &&
      !hasInventoryOfficerFilter &&
      !approvalStatus &&
      !departmentIdFilter
    ) {
      return res.json({ success: true, requests: [] });
    }

    const userIdColumn = getUserPrimaryKeyColumn(schema);
    const userNameColumn = getUserNameColumn(schema);
    const departmentJoinIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
    const departmentNameColumn = schema.departmentColumns.has("name")
      ? "d.name"
      : schema.departmentColumns.has("department_name")
        ? "d.department_name"
        : "NULL";
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);
    const inventoryJoin = inventoryIdColumn
      ? `LEFT JOIN inventories inv ON inv.${inventoryIdColumn} = ir.requested_inventory_id`
      : "";
    const inventoryNameSelect = inventoryNameColumn ? `inv.${inventoryNameColumn} AS inventory_name` : "NULL AS inventory_name";
    const inventoryLocationSelect = inventoryColumns.has("location")
      ? "COALESCE(ir.inventory_location, inv.location) AS inventory_location"
      : "ir.inventory_location AS inventory_location";
    const departmentJoin = schema.hasDepartmentsTable && itemRequestColumns.has("department_id")
      ? `LEFT JOIN departments d ON d.${departmentJoinIdColumn} = ir.department_id`
      : "";
    const inventoryDepartmentJoin = schema.hasDepartmentsTable && itemRequestColumns.has("inventory_department_id")
      ? `LEFT JOIN departments inv_d ON inv_d.${departmentJoinIdColumn} = ir.inventory_department_id`
      : "";
    const inventoryDepartmentNameSelect = schema.hasDepartmentsTable && itemRequestColumns.has("inventory_department_id")
      ? (
        schema.departmentColumns.has("name")
          ? "inv_d.name AS inventory_department_name"
          : schema.departmentColumns.has("department_name")
            ? "inv_d.department_name AS inventory_department_name"
            : "NULL AS inventory_department_name"
      )
      : "NULL AS inventory_department_name";
    const requesterJoin = itemRequestColumns.has("requested_by_id")
      ? `LEFT JOIN users rb ON rb.${userIdColumn} = ir.requested_by_id`
      : "";

    const whereParts = [];
    const params = [];

    if (hasRequestedByFilter) {
      whereParts.push("ir.requested_by_id = ?");
      params.push(requestedById);

      if (requesterScope === "issued") {
        if (itemRequestColumns.has("approval_status")) {
          whereParts.push(`LOWER(COALESCE(ir.approval_status, '')) IN ('approved', 'returned')`);
        }
        if (itemRequestColumns.has("allocated_inventory_item_id")) {
          whereParts.push("ir.allocated_inventory_item_id IS NOT NULL");
        }
      }
    }

    if (hasHodFilter) {
      whereParts.push("ir.hod_user_id = ?");
      params.push(hodUserId);
    }

    if (hasRequesterHodFilter) {
      whereParts.push("ir.hod_user_id = ?");
      params.push(requesterHodUserId);
      if (itemRequestColumns.has("approval_status")) {
        whereParts.push("LOWER(COALESCE(ir.approval_status, '')) IN ('pending_requester_hod', 'pending_hod')");
      }
    }

    if (hasLabHodFilter) {
      whereParts.push("ir.lab_hod_user_id = ?");
      params.push(labHodUserId);
      if (itemRequestColumns.has("approval_status")) {
        whereParts.push("LOWER(COALESCE(ir.approval_status, '')) = 'pending_lab_hod'");
      }
    }

    if (hasInventoryOfficerFilter) {
      const inventoryColumns = await ensureInventoriesLocationColumn();
      const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
      const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

      if (
        inventoryIdColumn
        && inventoryInchargeColumn
        && itemRequestColumns.has("requested_inventory_id")
      ) {
        whereParts.push(`(
          ir.inventory_officer_user_id = ?
          OR ir.requested_inventory_id IN (
            SELECT inv.${inventoryIdColumn}
            FROM inventories inv
            WHERE inv.${inventoryInchargeColumn} = ?
          )
        )`);
        params.push(inventoryOfficerUserId, inventoryOfficerUserId);
      } else {
        whereParts.push("ir.inventory_officer_user_id = ?");
        params.push(inventoryOfficerUserId);
      }

      if (inventoryOfficerScope === "issued") {
        if (itemRequestColumns.has("approval_status")) {
          whereParts.push(`LOWER(COALESCE(ir.approval_status, '')) NOT IN ('approved_to_issue', 'pending_issue')`);
        }
      } else if (inventoryOfficerScope === "all") {
        // Include every request linked to this inventory officer.
      } else {
        if (itemRequestColumns.has("approval_status")) {
          whereParts.push(`LOWER(COALESCE(ir.approval_status, '')) IN ('approved_to_issue', 'pending_issue')`);
        }

        if (itemRequestColumns.has("issued_date")) {
          whereParts.push("ir.issued_date IS NULL");
        } else if (itemRequestColumns.has("allocated_inventory_item_id")) {
          whereParts.push("ir.allocated_inventory_item_id IS NULL");
        }
      }
    }

    if (approvalStatus && itemRequestColumns.has("approval_status") && !hasRequesterHodFilter && !hasLabHodFilter && !hasInventoryOfficerFilter) {
      whereParts.push("LOWER(COALESCE(ir.approval_status, '')) = ?");
      params.push(approvalStatus);
    }

    if (Number.isInteger(departmentIdFilter) && departmentIdFilter > 0 && itemRequestColumns.has("department_id")) {
      whereParts.push("ir.department_id = ?");
      params.push(departmentIdFilter);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const requestedDateCol = itemRequestColumns.has("requested_date") ? "ir.requested_date" : "ir.id";
    const includeAllocatedItemJoin =
      hasRequestedByFilter
      && itemRequestColumns.has("allocated_inventory_item_id");
    const inventoryItemColumns = includeAllocatedItemJoin
      ? await ensureInventoryItemsColumns()
      : null;
    const allocatedItemIdColumn = inventoryItemColumns
      ? getItemIdColumn(inventoryItemColumns)
      : null;
    const allocatedItemNameColumn = inventoryItemColumns
      ? resolveDbColumn(inventoryItemColumns, ["item_name", "itemName"])
      : null;
    const allocatedItemCodeColumn = inventoryItemColumns
      ? resolveDbColumn(inventoryItemColumns, ["item_code", "itemCode"])
      : null;
    const allocatedItemSerialColumn = inventoryItemColumns
      ? resolveDbColumn(inventoryItemColumns, ["serial_no", "serialNo"])
      : null;
    const allocatedItemJoin = includeAllocatedItemJoin && allocatedItemIdColumn
      ? `LEFT JOIN ${DB_ITEMS_TABLE} ai ON ai.${allocatedItemIdColumn} = ir.allocated_inventory_item_id`
      : "";
    const allocatedItemSelect = includeAllocatedItemJoin && allocatedItemNameColumn
      ? `,
          ai.${allocatedItemNameColumn} AS allocated_item_record_name,
          ${allocatedItemCodeColumn ? `ai.${allocatedItemCodeColumn} AS allocated_item_code` : "NULL AS allocated_item_code"},
          ${allocatedItemSerialColumn ? `ai.${allocatedItemSerialColumn} AS allocated_item_serial_no` : "NULL AS allocated_item_serial_no"},
          ${inventoryItemColumns.has("model") ? "ai.model AS allocated_item_model" : "NULL AS allocated_item_model"},
          ${resolveDbColumn(inventoryItemColumns, ["gin_no", "ginNo"]) ? `ai.${resolveDbColumn(inventoryItemColumns, ["gin_no", "ginNo"])} AS allocated_item_gin_no` : "NULL AS allocated_item_gin_no"},
          ${inventoryItemColumns.has("status") ? "ai.status AS allocated_item_status" : "NULL AS allocated_item_status"},
          ${inventoryItemColumns.has("location") ? "ai.location AS allocated_item_location" : "NULL AS allocated_item_location"},
          ${inventoryItemColumns.has("remarks") ? "ai.remarks AS allocated_item_remarks" : "NULL AS allocated_item_remarks"}`
      : "";

    const [rows] = await pool.execute(
      `
        SELECT
          ir.*,
          ${inventoryLocationSelect},
          ${inventoryNameSelect},
          ${departmentJoin ? `${departmentNameColumn} AS department_name` : "NULL AS department_name"},
          ${inventoryDepartmentNameSelect},
          ${requesterJoin ? `rb.${userNameColumn} AS requested_by_name` : "NULL AS requested_by_name"}
          ${allocatedItemSelect}
        FROM item_requests ir
        ${inventoryJoin}
        ${departmentJoin}
        ${inventoryDepartmentJoin}
        ${requesterJoin}
        ${allocatedItemJoin}
        ${whereClause}
        ORDER BY ${requestedDateCol} DESC, ir.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      requests: rows.map((row) => mapItemRequestRow(row)),
    });
  })
);

app.post(
  "/api/item-requests",
  withDatabase(async (req, res) => {
    const itemRequestColumns = await ensureItemRequestsTable();
    const schema = await getAuthSchema();
    const requestedById = Number(req.body?.requestedById ?? req.body?.requested_by_id ?? 0);
    const requestedInventoryId = Number(
      req.body?.requestedInventoryId ?? req.body?.requested_from_inventory_id ?? 0
    );
    const itemName = String(req.body?.itemName ?? req.body?.item_name ?? "").trim();
    const quantity = Number(req.body?.quantity ?? 0);
    const priority = String(req.body?.priority ?? "normal").trim().toLowerCase() || "normal";
    const specification = String(req.body?.specification ?? "").trim();
    const reason = String(req.body?.reason ?? req.body?.justification ?? "").trim();
    const requiredByDate = String(req.body?.requiredByDate ?? req.body?.required_by_date ?? "").trim();

    if (!Number.isInteger(requestedById) || requestedById <= 0) {
      return res.status(400).json({ success: false, message: "A valid requesting user is required." });
    }

    if (!Number.isInteger(requestedInventoryId) || requestedInventoryId <= 0) {
      return res.status(400).json({ success: false, message: "Please select an inventory location." });
    }

    if (!itemName) {
      return res.status(400).json({ success: false, message: "Item name is required." });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than zero." });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: "Justification is required." });
    }

    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const [userRows] = await pool.execute(
      `SELECT ${userIdColumn} AS id, department_id FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
      [requestedById]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: "Requesting user was not found." });
    }

    const departmentId = Number(userRows[0]?.department_id ?? 0) || null;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: "Your profile must have a department assigned before submitting requests." });
    }

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);

    if (!inventoryIdColumn) {
      return res.status(500).json({ success: false, message: "Inventory schema is missing a primary key column." });
    }

    const [inventoryRows] = await pool.execute(
      `
        SELECT
          i.${inventoryIdColumn} AS inventory_id,
          ${inventoryNameColumn ? `i.${inventoryNameColumn} AS inventory_name` : "NULL AS inventory_name"},
          ${inventoryColumns.has("location") ? "i.location" : "NULL AS location"},
          ${inventoryColumns.has("department_id") ? "i.department_id" : "NULL AS department_id"}
        FROM inventories i
        WHERE i.${inventoryIdColumn} = ?
        LIMIT 1
      `,
      [requestedInventoryId]
    );

    if (inventoryRows.length === 0) {
      return res.status(404).json({ success: false, message: "Selected inventory was not found." });
    }

    const inventoryRow = inventoryRows[0];
    const inventoryLocation = String(inventoryRow.location ?? "").trim();

    if (!inventoryLocation) {
      return res.status(400).json({ success: false, message: "Selected inventory does not have a location name." });
    }

    const hodUserId = await resolveDepartmentHeadUserId(schema, departmentId);

    if (!hodUserId) {
      return res.status(400).json({ success: false, message: "No active Head of Department is assigned to your department." });
    }

    const inventoryDepartmentId = Number(inventoryRow.department_id ?? 0) || null;

    if (!inventoryDepartmentId) {
      return res.status(400).json({ success: false, message: "Selected inventory is not linked to a department." });
    }

    const labHodUserId = await resolveDepartmentHeadUserId(schema, inventoryDepartmentId);

    if (!labHodUserId) {
      return res.status(400).json({
        success: false,
        message: "No active Head of Department is assigned to the selected lab's department.",
      });
    }

    const insertColumns = ["item_name", "quantity", "requested_by_id", "requested_inventory_id", "approval_status"];
    const insertValues = [itemName, quantity, requestedById, requestedInventoryId, "pending_requester_hod"];

    if (itemRequestColumns.has("priority")) {
      insertColumns.push("priority");
      insertValues.push(priority);
    }

    if (itemRequestColumns.has("specification")) {
      insertColumns.push("specification");
      insertValues.push(specification || null);
    }

    if (itemRequestColumns.has("reason")) {
      insertColumns.push("reason");
      insertValues.push(reason);
    }

    if (itemRequestColumns.has("inventory_location")) {
      insertColumns.push("inventory_location");
      insertValues.push(inventoryLocation);
    }

    if (itemRequestColumns.has("department_id")) {
      insertColumns.push("department_id");
      insertValues.push(departmentId);
    }

    if (itemRequestColumns.has("inventory_department_id")) {
      insertColumns.push("inventory_department_id");
      insertValues.push(inventoryDepartmentId);
    }

    if (itemRequestColumns.has("hod_user_id")) {
      insertColumns.push("hod_user_id");
      insertValues.push(hodUserId);
    }

    if (itemRequestColumns.has("lab_hod_user_id")) {
      insertColumns.push("lab_hod_user_id");
      insertValues.push(labHodUserId);
    }

    if (itemRequestColumns.has("required_by_date") && requiredByDate) {
      insertColumns.push("required_by_date");
      insertValues.push(requiredByDate);
    }

    const placeholders = insertColumns.map(() => "?").join(", ");
    const [insertResult] = await pool.execute(
      `INSERT INTO item_requests (${insertColumns.join(", ")}) VALUES (${placeholders})`,
      insertValues
    );

    return res.status(201).json({
      success: true,
      message: "Item request submitted and forwarded to your Head of Department for recommendation.",
      requestId: insertResult.insertId,
      approvalStatus: "pending_requester_hod",
      inventoryLocation,
      inventoryName: inventoryRow.inventory_name || "",
    });
  })
);

app.post(
  "/api/item-requests/:id/approve-dept-head",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? req.body?.approver_user_id ?? 0);
    const itemRequestColumns = await ensureItemRequestsTable();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid item request id is required." });
    }

    if (!Number.isInteger(approverUserId) || approverUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [rows] = await pool.execute("SELECT * FROM item_requests WHERE id = ? LIMIT 1", [requestId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Item request not found." });
    }

    const itemRequest = rows[0];
    const assignedHod = itemRequestColumns.has("hod_user_id") ? Number(itemRequest.hod_user_id ?? 0) : 0;

    if (itemRequestColumns.has("hod_user_id") && assignedHod !== approverUserId) {
      return res.status(403).json({
        success: false,
        message: "Only the requester's Head of Department can recommend this request.",
      });
    }

    const currentStatus = String(itemRequest.approval_status || "pending_requester_hod").trim().toLowerCase();
    const recommendableStatuses = new Set(["pending_requester_hod", "pending_hod"]);

    if (!recommendableStatuses.has(currentStatus)) {
      return res.status(409).json({ success: false, message: "This request is not awaiting HOD recommendation." });
    }

    const labHodUserId = itemRequestColumns.has("lab_hod_user_id")
      ? Number(itemRequest.lab_hod_user_id ?? 0)
      : 0;

    if (!labHodUserId) {
      return res.status(409).json({
        success: false,
        message: "This request is missing the assigned lab Head of Department.",
      });
    }

    const updateParts = [];
    const updateValues = [];

    if (itemRequestColumns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("pending_lab_hod");
    }

    if (itemRequestColumns.has("requester_hod_recommended_date")) {
      updateParts.push("requester_hod_recommended_date = CURRENT_TIMESTAMP");
    } else if (itemRequestColumns.has("hod_approved_date")) {
      updateParts.push("hod_approved_date = CURRENT_TIMESTAMP");
    }

    if (itemRequestColumns.has("requester_hod_recommended_by_id")) {
      updateParts.push("requester_hod_recommended_by_id = ?");
      updateValues.push(approverUserId);
    } else if (itemRequestColumns.has("hod_approved_by_id")) {
      updateParts.push("hod_approved_by_id = ?");
      updateValues.push(approverUserId);
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to update recommendation status." });
    }

    updateValues.push(requestId);
    await pool.execute(`UPDATE item_requests SET ${updateParts.join(", ")} WHERE id = ?`, updateValues);

    return res.json({
      success: true,
      message: "Item request recommended and forwarded to the lab Head of Department.",
      approvalStatus: "pending_lab_hod",
    });
  })
);

app.post(
  "/api/item-requests/:id/approve-lab-hod",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? req.body?.approver_user_id ?? 0);
    const itemRequestColumns = await ensureItemRequestsTable();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid item request id is required." });
    }

    if (!Number.isInteger(approverUserId) || approverUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [rows] = await pool.execute("SELECT * FROM item_requests WHERE id = ? LIMIT 1", [requestId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Item request not found." });
    }

    const itemRequest = rows[0];
    const assignedLabHod = itemRequestColumns.has("lab_hod_user_id")
      ? Number(itemRequest.lab_hod_user_id ?? 0)
      : 0;

    if (itemRequestColumns.has("lab_hod_user_id") && assignedLabHod !== approverUserId) {
      return res.status(403).json({
        success: false,
        message: "Only the lab Head of Department can approve this request.",
      });
    }

    const currentStatus = String(itemRequest.approval_status || "").trim().toLowerCase();

    if (currentStatus !== "pending_lab_hod") {
      return res.status(409).json({ success: false, message: "This request is not awaiting lab HOD approval." });
    }

    const requestedInventoryId = Number(itemRequest.requested_inventory_id ?? 0);
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);
    let inventoryOfficerUserId = 0;

    if (
      inventoryIdColumn
      && inventoryInchargeColumn
      && Number.isInteger(requestedInventoryId)
      && requestedInventoryId > 0
    ) {
      const [inventoryRows] = await pool.execute(
        `SELECT ${inventoryInchargeColumn} AS incharge_id FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
        [requestedInventoryId]
      );
      inventoryOfficerUserId = Number(inventoryRows[0]?.incharge_id ?? 0);
    }

    if (!inventoryOfficerUserId) {
      return res.status(409).json({
        success: false,
        message: "The selected lab inventory has no assigned inventory officer. Assign an officer before approving.",
      });
    }

    const updateParts = [];
    const updateValues = [];

    if (itemRequestColumns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("approved_to_issue");
    }

    if (itemRequestColumns.has("inventory_officer_user_id")) {
      updateParts.push("inventory_officer_user_id = ?");
      updateValues.push(inventoryOfficerUserId);
    }

    if (itemRequestColumns.has("lab_hod_approved_date")) {
      updateParts.push("lab_hod_approved_date = CURRENT_TIMESTAMP");
    } else if (itemRequestColumns.has("hod_approved_date")) {
      updateParts.push("hod_approved_date = CURRENT_TIMESTAMP");
    }

    if (itemRequestColumns.has("lab_hod_approved_by_id")) {
      updateParts.push("lab_hod_approved_by_id = ?");
      updateValues.push(approverUserId);
    } else if (itemRequestColumns.has("hod_approved_by_id")) {
      updateParts.push("hod_approved_by_id = ?");
      updateValues.push(approverUserId);
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to update approval status." });
    }

    updateValues.push(requestId);
    await pool.execute(`UPDATE item_requests SET ${updateParts.join(", ")} WHERE id = ?`, updateValues);

    const schema = await getAuthSchema();
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);
    const requestedById = Number(itemRequest.requested_by_id ?? 0);
    let requesterName = "";

    if (requestedById > 0) {
      const [requesterRows] = await pool.execute(
        `SELECT ${userNameColumn} AS name FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
        [requestedById]
      );
      requesterName = String(requesterRows[0]?.name || "").trim();
    }

    let inventoryName = String(itemRequest.inventory_location || "").trim();
    if (!inventoryName && requestedInventoryId > 0 && inventoryIdColumn && inventoryNameColumn) {
      const [inventoryNameRows] = await pool.execute(
        `SELECT ${inventoryNameColumn} AS inventory_name FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
        [requestedInventoryId]
      );
      inventoryName = String(inventoryNameRows[0]?.inventory_name || "").trim();
    }

    await notifyItemRequestReceived(pool, {
      inventoryOfficerUserId,
      requestId,
      itemName: itemRequest.item_name,
      quantity: itemRequest.quantity,
      requesterName,
      inventoryName,
    });

    return res.json({
      success: true,
      message: "Item request approved and forwarded to the lab inventory officer for issuing.",
      approvalStatus: "approved_to_issue",
      inventoryOfficerUserId,
    });
  })
);

app.post(
  "/api/item-requests/:id/issue",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const issuerUserId = Number(req.body?.issuerUserId ?? req.body?.issuer_user_id ?? 0);
    const inventoryItemId = Number(req.body?.inventoryItemId ?? req.body?.inventory_item_id ?? 0);
    const itemRequestColumns = await ensureItemRequestsTable();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid item request id is required." });
    }

    if (!Number.isInteger(issuerUserId) || issuerUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid inventory officer user id is required." });
    }

    if (!Number.isInteger(inventoryItemId) || inventoryItemId <= 0) {
      return res.status(400).json({ success: false, message: "Select an inventory item to issue." });
    }

    const [rows] = await pool.execute("SELECT * FROM item_requests WHERE id = ? LIMIT 1", [requestId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Item request not found." });
    }

    const itemRequest = rows[0];
    const assignedOfficer = itemRequestColumns.has("inventory_officer_user_id")
      ? Number(itemRequest.inventory_officer_user_id ?? 0)
      : 0;
    const currentStatus = String(itemRequest.approval_status || "").trim().toLowerCase();
    const issueableStatuses = new Set(["approved_to_issue", "pending_issue"]);

    if (!issueableStatuses.has(currentStatus)) {
      return res.status(409).json({ success: false, message: "This request is not approved to issue." });
    }

    if (itemRequestColumns.has("inventory_officer_user_id") && assignedOfficer !== issuerUserId) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned lab inventory officer can issue this request.",
      });
    }

    const requestedInventoryId = Number(itemRequest.requested_inventory_id ?? 0);
    const requestedQuantity = Number(itemRequest.quantity ?? 0);
    const inventoryItemColumns = await ensureInventoryItemsColumns();
    const itemIdColumn = getItemIdColumn(inventoryItemColumns);
    const [inventoryItemRows] = await pool.execute(
      `SELECT * FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} = ? LIMIT 1`,
      [inventoryItemId]
    );

    if (inventoryItemRows.length === 0) {
      return res.status(404).json({ success: false, message: "Selected inventory item was not found." });
    }

    const inventoryItem = inventoryItemRows[0];
    const itemInventoryId = Number(inventoryItem.inventory_id ?? 0);

    if (
      Number.isInteger(requestedInventoryId)
      && requestedInventoryId > 0
      && itemInventoryId !== requestedInventoryId
    ) {
      return res.status(409).json({
        success: false,
        message: "Selected item does not belong to the requested lab inventory.",
      });
    }

    const updateParts = [];
    const updateValues = [];

    if (itemRequestColumns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("approved");
    }

    if (itemRequestColumns.has("issued_date")) {
      updateParts.push("issued_date = CURRENT_TIMESTAMP");
    }

    if (itemRequestColumns.has("issued_by_id")) {
      updateParts.push("issued_by_id = ?");
      updateValues.push(issuerUserId);
    }

    if (itemRequestColumns.has("allocated_inventory_id") && itemInventoryId > 0) {
      updateParts.push("allocated_inventory_id = ?");
      updateValues.push(itemInventoryId);
    } else if (
      itemRequestColumns.has("allocated_inventory_id")
      && Number.isInteger(requestedInventoryId)
      && requestedInventoryId > 0
    ) {
      updateParts.push("allocated_inventory_id = ?");
      updateValues.push(requestedInventoryId);
    }

    if (itemRequestColumns.has("allocated_inventory_item_id")) {
      updateParts.push("allocated_inventory_item_id = ?");
      updateValues.push(inventoryItemId);
    }

    if (itemRequestColumns.has("allocated_quantity") && Number.isInteger(requestedQuantity) && requestedQuantity > 0) {
      updateParts.push("allocated_quantity = ?");
      updateValues.push(requestedQuantity);
    }

    if (itemRequestColumns.has("allocated_date")) {
      updateParts.push("allocated_date = CURRENT_TIMESTAMP");
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to update issue status." });
    }

    updateValues.push(requestId);
    await pool.execute(`UPDATE item_requests SET ${updateParts.join(", ")} WHERE id = ?`, updateValues);

    const schema = await getAuthSchema();
    const userIdColumn = getUserPrimaryKeyColumn(schema);
    const userNameColumn = getUserNameColumn(schema);
    const requestedById = Number(itemRequest.requested_by_id ?? 0);
    let requesterName = "";

    if (Number.isInteger(requestedById) && requestedById > 0 && userNameColumn) {
      const [userRows] = await pool.execute(
        `SELECT ${userNameColumn} AS name FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
        [requestedById]
      );
      requesterName = String(userRows[0]?.name || "").trim();
    }

    await applyIssuedItemSideEffects({
      requestId,
      inventoryItemId,
      requesterName,
      issuedDate: itemRequest.issued_date || new Date(),
      inventoryItem,
    });

    return res.json({
      success: true,
      message: requesterName
        ? `Item issued to ${requesterName}. Location updated to the staff member name.`
        : "Item issued to the requester.",
      approvalStatus: "approved",
      inventoryItemId,
      location: requesterName || null,
    });
  })
);

app.post(
  "/api/item-requests/:id/return",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const returnerUserId = Number(req.body?.returnerUserId ?? req.body?.returner_user_id ?? 0);
    const itemRequestColumns = await ensureItemRequestsTable();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid item request id is required." });
    }

    if (!Number.isInteger(returnerUserId) || returnerUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid inventory officer user id is required." });
    }

    const [rows] = await pool.execute("SELECT * FROM item_requests WHERE id = ? LIMIT 1", [requestId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Item request not found." });
    }

    const itemRequest = rows[0];
    const assignedOfficer = itemRequestColumns.has("inventory_officer_user_id")
      ? Number(itemRequest.inventory_officer_user_id ?? 0)
      : 0;
    const currentStatus = String(itemRequest.approval_status || "").trim().toLowerCase();
    const inventoryItemId = Number(itemRequest.allocated_inventory_item_id ?? 0);

    if (currentStatus !== "approved") {
      return res.status(409).json({ success: false, message: "Only issued item requests can be returned." });
    }

    if (itemRequestColumns.has("returned_date") && itemRequest.returned_date) {
      return res.status(409).json({ success: false, message: "This item has already been returned." });
    }

    if (itemRequestColumns.has("inventory_officer_user_id") && assignedOfficer !== returnerUserId) {
      return res.status(403).json({
        success: false,
        message: "Only the assigned lab inventory officer can return this item.",
      });
    }

    if (!Number.isInteger(inventoryItemId) || inventoryItemId <= 0) {
      return res.status(409).json({ success: false, message: "This request has no linked inventory item to return." });
    }

    const inventoryItemColumns = await ensureInventoryItemsColumns();
    const itemIdColumn = getItemIdColumn(inventoryItemColumns);
    const [inventoryItemRows] = await pool.execute(
      `SELECT * FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} = ? LIMIT 1`,
      [inventoryItemId]
    );

    if (inventoryItemRows.length === 0) {
      return res.status(404).json({ success: false, message: "Linked inventory item was not found." });
    }

    const inventoryItem = inventoryItemRows[0];
    const requestUpdateParts = [];
    const requestUpdateValues = [];

    if (itemRequestColumns.has("approval_status")) {
      requestUpdateParts.push("approval_status = ?");
      requestUpdateValues.push("returned");
    }

    if (itemRequestColumns.has("returned_date")) {
      requestUpdateParts.push("returned_date = CURRENT_TIMESTAMP");
    }

    if (itemRequestColumns.has("returned_by_id")) {
      requestUpdateParts.push("returned_by_id = ?");
      requestUpdateValues.push(returnerUserId);
    }

    if (requestUpdateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to update return status." });
    }

    requestUpdateValues.push(requestId);
    await pool.execute(
      `UPDATE item_requests SET ${requestUpdateParts.join(", ")} WHERE id = ?`,
      requestUpdateValues
    );

    const itemUpdateParts = [];
    const itemUpdateValues = [];

    if (inventoryItemColumns.has("location")) {
      itemUpdateParts.push("location = ?");
      itemUpdateValues.push("Stores");
    }

    if (inventoryItemColumns.has("status")) {
      itemUpdateParts.push("status = ?");
      itemUpdateValues.push("Returned");
    }

    if (inventoryItemColumns.has("remarks")) {
      const returnedDateLabel = new Date().toISOString().split("T")[0];
      const returnRemark = `Returned on ${returnedDateLabel} | Item request ID: REQ-${requestId}`;
      const existingRemarks = String(inventoryItem.remarks || "").trim();
      const updatedRemarks = existingRemarks ? `${existingRemarks}\n${returnRemark}` : returnRemark;
      itemUpdateParts.push("remarks = ?");
      itemUpdateValues.push(updatedRemarks);
    }

    if (itemUpdateParts.length > 0) {
      itemUpdateValues.push(inventoryItemId);
      await pool.execute(
        `UPDATE ${DB_ITEMS_TABLE} SET ${itemUpdateParts.join(", ")} WHERE ${itemIdColumn} = ?`,
        itemUpdateValues
      );
    }

    return res.json({
      success: true,
      message: "Item returned to Stores.",
      approvalStatus: "returned",
      inventoryItemId,
    });
  })
);

app.post(
  "/api/item-requests/:id/reject",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? req.body?.approver_user_id ?? 0);
    const reason = String(req.body?.reason ?? "Rejected by Head of Department").trim();
    const itemRequestColumns = await ensureItemRequestsTable();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid item request id is required." });
    }

    if (!Number.isInteger(approverUserId) || approverUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [rows] = await pool.execute("SELECT * FROM item_requests WHERE id = ? LIMIT 1", [requestId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Item request not found." });
    }

    const itemRequest = rows[0];
    const assignedRequesterHod = itemRequestColumns.has("hod_user_id") ? Number(itemRequest.hod_user_id ?? 0) : 0;
    const assignedLabHod = itemRequestColumns.has("lab_hod_user_id") ? Number(itemRequest.lab_hod_user_id ?? 0) : 0;
    const currentStatus = String(itemRequest.approval_status || "pending_requester_hod").trim().toLowerCase();
    const recommendableStatuses = new Set(["pending_requester_hod", "pending_hod"]);

    if (recommendableStatuses.has(currentStatus)) {
      if (itemRequestColumns.has("hod_user_id") && assignedRequesterHod !== approverUserId) {
        return res.status(403).json({
          success: false,
          message: "Only the requester's Head of Department can reject this request.",
        });
      }
    } else if (currentStatus === "pending_lab_hod") {
      if (itemRequestColumns.has("lab_hod_user_id") && assignedLabHod !== approverUserId) {
        return res.status(403).json({
          success: false,
          message: "Only the lab Head of Department can reject this request.",
        });
      }
    } else {
      return res.status(409).json({ success: false, message: "This request is no longer awaiting HOD action." });
    }

    const updateParts = [];
    const updateValues = [];

    if (itemRequestColumns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("rejected");
    }

    if (itemRequestColumns.has("rejection_reason")) {
      updateParts.push("rejection_reason = ?");
      updateValues.push(reason);
    }

    if (itemRequestColumns.has("rejection_date")) {
      updateParts.push("rejection_date = CURRENT_TIMESTAMP");
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to update rejection status." });
    }

    updateValues.push(requestId);
    await pool.execute(`UPDATE item_requests SET ${updateParts.join(", ")} WHERE id = ?`, updateValues);

    return res.json({
      success: true,
      message: "Item request rejected.",
      approvalStatus: "rejected",
    });
  })
);

app.post(
  "/api/item-requests/:id/cancel",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const requestedById = Number(req.body?.requestedById ?? req.body?.requested_by_id ?? 0);
    const itemRequestColumns = await ensureItemRequestsTable();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid item request id is required." });
    }

    if (!Number.isInteger(requestedById) || requestedById <= 0) {
      return res.status(400).json({ success: false, message: "A valid requesting user id is required." });
    }

    const [rows] = await pool.execute("SELECT * FROM item_requests WHERE id = ? LIMIT 1", [requestId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Item request not found." });
    }

    const itemRequest = rows[0];
    const requesterId = Number(itemRequest.requested_by_id ?? 0);

    if (requesterId !== requestedById) {
      return res.status(403).json({ success: false, message: "Only the requester can cancel this item request." });
    }

    const currentStatus = String(itemRequest.approval_status || "pending_requester_hod").trim().toLowerCase();
    const cancellableStatuses = new Set(["pending_requester_hod", "pending_hod"]);

    if (!cancellableStatuses.has(currentStatus)) {
      return res.status(409).json({
        success: false,
        message: "Only requests awaiting HOD recommendation can be cancelled.",
      });
    }

    const updateParts = [];
    const updateValues = [];

    if (itemRequestColumns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("cancelled");
    }

    if (itemRequestColumns.has("rejection_date")) {
      updateParts.push("rejection_date = CURRENT_TIMESTAMP");
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to cancel this request." });
    }

    updateValues.push(requestId);
    await pool.execute(`UPDATE item_requests SET ${updateParts.join(", ")} WHERE id = ?`, updateValues);

    return res.json({
      success: true,
      message: "Item request cancelled.",
      approvalStatus: "cancelled",
    });
  })
);

app.get(
  "/api/item-transfers",
  withDatabase(async (req, res) => {
    const columns = await ensureItemTransfersWorkflow();
    if (!columns) {
      return res.json({ success: true, transfers: [] });
    }

    const schema = await getAuthSchema();
    const approvalStatus = String(req.query.approvalStatus || "").trim().toLowerCase();
    const inventoryOfficerUserId = Number(
      req.query?.inventoryOfficerUserId ?? req.query?.inventory_officer_user_id ?? 0
    );
    const transferScope = String(req.query?.transferScope ?? "all").trim().toLowerCase();
    const sourceHodUserId = Number(req.query?.sourceHodUserId ?? req.query?.hodUserId ?? 0);
    const hasSourceHodFilter = Number.isInteger(sourceHodUserId) && sourceHodUserId > 0;
    const hasInventoryOfficerFilter =
      Number.isInteger(inventoryOfficerUserId) && inventoryOfficerUserId > 0;
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const itemNameExpr = buildItemNameExpression(itemColumns);
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const itemJoin = tableNames.has(DB_ITEMS_TABLE)
      ? buildItemAliasJoin(itemColumns, "it.item_id")
      : "";
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const fromInventoryNameSelect = buildInventoryAliasNameSelect("fi", inventoryColumns, "from_inventory_name");
    const toInventoryNameSelect = buildInventoryAliasNameSelect("ti", inventoryColumns, "to_inventory_name");
    const fromInventoryJoin = buildInventoryTransferJoin("fi", inventoryColumns, "from_inventory_id");
    const toInventoryJoin = buildInventoryTransferJoin("ti", inventoryColumns, "to_inventory_id");
    const params = [];
    const whereParts = [];

    if (hasSourceHodFilter && columns.has("source_hod_user_id")) {
      whereParts.push("it.source_hod_user_id = ?");
      params.push(sourceHodUserId);
      whereParts.push("LOWER(COALESCE(it.approval_status, '')) IN ('pending_hod', 'pending_staff')");
      whereParts.push("LOWER(COALESCE(it.status, '')) NOT IN ('completed', 'rejected', 'cancelled')");
    }

    if (hasInventoryOfficerFilter) {
      const inventoryColumns = await ensureInventoriesLocationColumn();
      const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
      const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

      if (inventoryIdColumn && inventoryInchargeColumn) {
        const officerInventorySubquery = `(SELECT inv.${inventoryIdColumn} FROM inventories inv WHERE inv.${inventoryInchargeColumn} = ?)`;

        if (transferScope === "pending") {
          whereParts.push(
            `(it.from_inventory_id IN ${officerInventorySubquery} OR it.to_inventory_id IN ${officerInventorySubquery})`
          );
          params.push(inventoryOfficerUserId, inventoryOfficerUserId);
          whereParts.push("LOWER(COALESCE(it.status, '')) NOT IN ('completed', 'rejected', 'cancelled')");
          if (columns.has("approval_status")) {
            whereParts.push(
              "(it.approval_status IS NULL OR LOWER(COALESCE(it.approval_status, '')) NOT IN ('rejected', 'cancelled', 'completed'))"
            );
          }
        } else if (transferScope === "transferred") {
          whereParts.push(`it.from_inventory_id IN ${officerInventorySubquery}`);
          params.push(inventoryOfficerUserId);
          whereParts.push("LOWER(COALESCE(it.status, '')) = 'completed'");
        } else if (transferScope === "received") {
          whereParts.push(`it.to_inventory_id IN ${officerInventorySubquery}`);
          params.push(inventoryOfficerUserId);
          whereParts.push("LOWER(COALESCE(it.status, '')) = 'completed'");
        } else {
          whereParts.push(
            `(it.from_inventory_id IN ${officerInventorySubquery} OR it.to_inventory_id IN ${officerInventorySubquery})`
          );
          params.push(inventoryOfficerUserId, inventoryOfficerUserId);
        }
      }
    }

    if (approvalStatus && !hasInventoryOfficerFilter && !hasSourceHodFilter) {
      if (columns.has("approval_status") && approvalStatus === "pending_registrar") {
        whereParts.push(
          `(LOWER(COALESCE(it.approval_status, '')) = ? OR (it.approval_status IS NULL AND LOWER(COALESCE(it.status, '')) = 'pending'))`
        );
        params.push(approvalStatus);
      } else if (columns.has("approval_status")) {
        whereParts.push("LOWER(COALESCE(it.approval_status, '')) = ?");
        params.push(approvalStatus);
      } else {
        whereParts.push("LOWER(COALESCE(it.status, '')) = ?");
        params.push(approvalStatus === "pending_registrar" ? "pending" : approvalStatus);
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const transferDateCol = columns.has("transfer_date") ? "it.transfer_date" : "it.created_date";
    const itemNameSelect = tableNames.has(DB_ITEMS_TABLE) ? `${itemNameExpr} AS item_name` : "CAST(it.item_id AS CHAR) AS item_name";

    const [rows] = await pool.execute(
      `
        SELECT
          it.id,
          it.item_id,
          it.from_inventory_id,
          it.to_inventory_id,
          ${itemNameSelect},
          ${fromInventoryNameSelect},
          ${toInventoryNameSelect},
          it.quantity,
          it.reason,
          it.notes,
          it.status,
          ${columns.has("approval_status") ? "it.approval_status" : "NULL AS approval_status"},
          ${transferDateCol} AS transfer_date,
          ${columns.has("completed_date") ? "it.completed_date" : "NULL AS completed_date"},
          ${columns.has("hod_approved_date") ? "it.hod_approved_date" : "NULL AS hod_approved_date"},
          ${columns.has("initiated_by_id") ? "it.initiated_by_id" : "NULL AS initiated_by_id"},
          initiator.${userNameColumn} AS initiated_by_name
        FROM item_transfers it
        ${itemJoin}
        ${fromInventoryJoin}
        ${toInventoryJoin}
        LEFT JOIN users initiator ON initiator.${userIdColumn} = it.initiated_by_id
        ${whereClause}
        ORDER BY ${transferDateCol} DESC, it.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      transfers: rows.map((row) => ({
        id: row.id,
        itemId: row.item_id,
        itemName: row.item_name || `Item #${row.item_id}`,
        fromInventoryId: row.from_inventory_id ?? null,
        toInventoryId: row.to_inventory_id ?? null,
        fromInventory: row.from_inventory_name || "-",
        toInventory: row.to_inventory_name || "-",
        quantity: row.quantity ?? 1,
        reason: row.reason || row.notes || "",
        status: row.status || "pending",
        approvalStatus: resolveTransferDisposalApprovalStatus(row, columns),
        transferDate: row.transfer_date ? new Date(row.transfer_date).toISOString().split("T")[0] : "",
        completedDate: row.completed_date
          ? new Date(row.completed_date).toISOString().split("T")[0]
          : "",
        hodApprovedDate: row.hod_approved_date
          ? new Date(row.hod_approved_date).toISOString().split("T")[0]
          : "",
        initiatedById: row.initiated_by_id ?? null,
        initiatedBy: row.initiated_by_name || "-",
      })),
    });
  })
);

const mapInventoryPartyDetails = (row = {}) => ({
  id: row.id ?? row.inventory_id ?? null,
  name: row.name ?? row.inventory_name ?? "",
  location: row.location ?? "",
  department: row.department_name ?? row.department ?? "",
  incharge: row.incharge_name ?? row.incharge ?? "",
  inchargeId: row.incharge_id ?? null,
});

const fetchInventoryPartyDetails = async (inventoryId, inventoryColumns, schema) => {
  const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
  const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);
  const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

  if (!inventoryIdColumn || !inventoryNameColumn || !inventoryInchargeColumn) {
    return null;
  }

  const departmentIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
  const departmentNameColumn = schema.departmentColumns.has("name")
    ? "name"
    : schema.departmentColumns.has("department_name")
      ? "department_name"
      : null;
  const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
  const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";

  const [rows] = await pool.execute(
    `
      SELECT
        i.${inventoryIdColumn} AS id,
        i.${inventoryNameColumn} AS name,
        ${inventoryColumns.has("location") ? "i.location" : "''"} AS location,
        ${departmentNameColumn ? `d.${departmentNameColumn}` : "NULL"} AS department_name,
        u.${userNameColumn} AS incharge_name,
        i.${inventoryInchargeColumn} AS incharge_id
      FROM inventories i
      LEFT JOIN departments d ON d.${departmentIdColumn} = i.department_id
      LEFT JOIN users u ON u.${userIdColumn} = i.${inventoryInchargeColumn}
      WHERE i.${inventoryIdColumn} = ?
      LIMIT 1
    `,
    [inventoryId]
  );

  if (rows.length === 0) {
    return null;
  }

  return mapInventoryPartyDetails(rows[0]);
};

app.get(
  "/api/item-transfers/:id",
  withDatabase(async (req, res) => {
    const transferId = Number(req.params.id);
    const columns = await ensureItemTransfersWorkflow();

    if (!columns) {
      return res.status(404).json({ success: false, message: "Item transfers are not available." });
    }

    if (!Number.isInteger(transferId) || transferId <= 0) {
      return res.status(400).json({ success: false, message: "A valid transfer id is required." });
    }

    const schema = await getAuthSchema();
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const itemIdColumn = itemColumns.size > 0 ? getItemIdColumn(itemColumns) : null;
    const transferDateCol = columns.has("transfer_date") ? "transfer_date" : "created_date";
    const userNameColumn = getUserNameColumn(schema);
    const userIdColumn = getUserPrimaryKeyColumn(schema);
    const { designationSelection, designationJoin } = getDesignationQueryParts(schema, "initiator", "initiator_dg");
    const sourceHodJoin = columns.has("source_hod_user_id")
      ? `LEFT JOIN users source_hod ON source_hod.${userIdColumn} = it.source_hod_user_id`
      : "";
    const hodApprovedJoin = columns.has("hod_approved_by_id")
      ? `LEFT JOIN users hod ON hod.${userIdColumn} = it.hod_approved_by_id`
      : "";
    const registrarApprovedJoin = columns.has("registrar_approved_by_id")
      ? `LEFT JOIN users registrar ON registrar.${userIdColumn} = it.registrar_approved_by_id`
      : "";
    const hodApprovedBySelect = columns.has("hod_approved_by_id") && columns.has("source_hod_user_id")
      ? `COALESCE(hod.${userNameColumn}, source_hod.${userNameColumn}) AS hod_approved_by_name`
      : columns.has("hod_approved_by_id")
        ? `hod.${userNameColumn} AS hod_approved_by_name`
        : columns.has("source_hod_user_id")
          ? `source_hod.${userNameColumn} AS hod_approved_by_name`
          : "NULL AS hod_approved_by_name";
    const registrarApprovedBySelect = columns.has("registrar_approved_by_id")
      ? `registrar.${userNameColumn} AS registrar_approved_by_name`
      : "NULL AS registrar_approved_by_name";

    const [anchorRows] = await pool.execute(
      `
        SELECT
          it.id,
          it.item_id,
          it.from_inventory_id,
          it.to_inventory_id,
          it.quantity,
          it.reason,
          it.notes,
          it.status,
          ${columns.has("approval_status") ? "it.approval_status" : "NULL AS approval_status"},
          it.${transferDateCol} AS transfer_date,
          ${columns.has("completed_date") ? "it.completed_date" : "NULL AS completed_date"},
          ${columns.has("hod_approved_date") ? "it.hod_approved_date" : "NULL AS hod_approved_date"},
          ${columns.has("registrar_approved_date") ? "it.registrar_approved_date" : "NULL AS registrar_approved_date"},
          ${columns.has("initiated_by_id") ? "it.initiated_by_id" : "NULL AS initiated_by_id"},
          initiator.${userNameColumn} AS initiated_by_name,
          ${designationSelection},
          ${hodApprovedBySelect},
          ${registrarApprovedBySelect}
        FROM item_transfers it
        LEFT JOIN users initiator ON initiator.${userIdColumn} = it.initiated_by_id
        ${designationJoin}
        ${sourceHodJoin}
        ${hodApprovedJoin}
        ${registrarApprovedJoin}
        WHERE it.id = ?
        LIMIT 1
      `,
      [transferId]
    );

    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Transfer request was not found." });
    }

    const anchor = anchorRows[0];
    const batchMatchParts = [
      "it.from_inventory_id = anchor.from_inventory_id",
      "it.to_inventory_id = anchor.to_inventory_id",
      "COALESCE(it.reason, '') = COALESCE(anchor.reason, '')",
    ];

    if (columns.has("initiated_by_id")) {
      batchMatchParts.push(
        "((anchor.initiated_by_id IS NULL AND it.initiated_by_id IS NULL) OR it.initiated_by_id = anchor.initiated_by_id)"
      );
    }

    if (columns.has("transfer_date")) {
      batchMatchParts.push(
        "((anchor.transfer_date IS NULL AND it.transfer_date IS NULL) OR DATE(it.transfer_date) = DATE(anchor.transfer_date))"
      );
    }

    const [lineRows] = await pool.execute(
      `
        SELECT
          it.id,
          it.item_id,
          it.quantity,
          it.status,
          ${columns.has("approval_status") ? "it.approval_status" : "NULL AS approval_status"}
        FROM item_transfers anchor
        INNER JOIN item_transfers it ON ${batchMatchParts.join(" AND ")}
        WHERE anchor.id = ?
        ORDER BY it.id ASC
      `,
      [transferId]
    );

    const itemIds = [...new Set(lineRows.map((row) => row.item_id).filter(Boolean))];
    const itemMap = new Map();

    if (itemIds.length > 0 && itemIdColumn && tableNames.has(DB_ITEMS_TABLE)) {
      const placeholders = itemIds.map(() => "?").join(", ");
      const [itemRows] = await pool.execute(
        `SELECT * FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} IN (${placeholders})`,
        itemIds
      );

      itemRows.forEach((row) => {
        const normalized = normalizeItemRow(row);
        itemMap.set(Number(normalized.id), normalized);
      });
    }

    const formItems = [];
    const lineItems = lineRows.map((row) => {
      const itemDetail = itemMap.get(Number(row.item_id)) || null;
      const quantity = Number(row.quantity) || 1;

      if (itemDetail) {
        for (let index = 0; index < quantity; index += 1) {
          formItems.push({
            id: itemDetail.id,
            itemName: itemDetail.itemName || itemDetail.item_name || "",
            itemCode: itemDetail.itemCode || itemDetail.item_code || "",
            serialNo: itemDetail.serialNo || itemDetail.serial_no || "",
            model: itemDetail.model || "",
            brand: itemDetail.brand || itemDetail.manufacturer || "",
            value: itemDetail.value ?? "",
            ginNo: itemDetail.ginNo || itemDetail.gin_no || "",
            poNo: itemDetail.poNo || itemDetail.po_no || "",
            pageno: itemDetail.pageno || itemDetail.page_no || itemDetail.pageNo || "",
          });
        }
      }

      return {
        transferLineId: row.id,
        itemId: row.item_id,
        itemName: itemDetail?.itemName || itemDetail?.item_name || `Item #${row.item_id}`,
        quantity,
        status: row.status || "pending",
        approvalStatus: resolveTransferDisposalApprovalStatus(row, columns),
      };
    });

    const fromInventoryId = Number(anchor.from_inventory_id ?? 0);
    const toInventoryId = Number(anchor.to_inventory_id ?? 0);
    const [sourceInventory, destinationInventory] = await Promise.all([
      fetchInventoryPartyDetails(fromInventoryId, inventoryColumns, schema),
      fetchInventoryPartyDetails(toInventoryId, inventoryColumns, schema),
    ]);

    return res.json({
      success: true,
      transfer: {
        id: anchor.id,
        transferIds: lineRows.map((row) => row.id),
        fromInventoryId,
        toInventoryId,
        fromInventory: sourceInventory?.name || "-",
        toInventory: destinationInventory?.name || "-",
        reason: anchor.reason || anchor.notes || "",
        status: anchor.status || "pending",
        approvalStatus: resolveTransferDisposalApprovalStatus(anchor, columns),
        transferDate: anchor.transfer_date
          ? new Date(anchor.transfer_date).toISOString().split("T")[0]
          : "",
        completedDate: anchor.completed_date
          ? new Date(anchor.completed_date).toISOString().split("T")[0]
          : "",
        hodApprovedDate: anchor.hod_approved_date
          ? new Date(anchor.hod_approved_date).toISOString().split("T")[0]
          : "",
        hodApprovedBy: anchor.hod_approved_by_name || "",
        hodDepartmentName: sourceInventory?.department || "",
        registrarApprovedDate: anchor.registrar_approved_date
          ? new Date(anchor.registrar_approved_date).toISOString().split("T")[0]
          : "",
        registrarApprovedBy: anchor.registrar_approved_by_name || "",
        initiatedById: anchor.initiated_by_id ?? null,
        initiatedBy: anchor.initiated_by_name || "-",
        issuedByName: anchor.initiated_by_name || sourceInventory?.incharge || "-",
        issuedByPost: anchor.designation || "Inventory Officer",
        sourceInventory,
        destinationInventory,
        items: lineItems,
        formItems,
      },
    });
  })
);

app.post(
  "/api/item-transfers",
  withDatabase(async (req, res) => {
    const columns = await ensureItemTransfersWorkflow();
    if (!columns) {
      return res.status(500).json({ success: false, message: "Item transfers table is not available." });
    }

    const initiatedById = Number(req.body?.initiatedById ?? req.body?.initiated_by_id ?? 0);
    const fromInventoryId = Number(req.body?.fromInventoryId ?? req.body?.from_inventory_id ?? 0);
    const toInventoryId = Number(req.body?.toInventoryId ?? req.body?.to_inventory_id ?? 0);
    const reason = String(req.body?.reason ?? "").trim();
    const transferDate = String(req.body?.transferDate ?? req.body?.transfer_date ?? "").trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!Number.isInteger(initiatedById) || initiatedById <= 0) {
      return res.status(400).json({ success: false, message: "A valid initiating user is required." });
    }

    if (!Number.isInteger(fromInventoryId) || fromInventoryId <= 0) {
      return res.status(400).json({ success: false, message: "Please select a source inventory." });
    }

    if (!Number.isInteger(toInventoryId) || toInventoryId <= 0) {
      return res.status(400).json({ success: false, message: "Please select a destination inventory." });
    }

    if (fromInventoryId === toInventoryId) {
      return res.status(400).json({ success: false, message: "Destination inventory must differ from the source inventory." });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: "Transfer reason is required." });
    }

    if (!transferDate) {
      return res.status(400).json({ success: false, message: "Transfer date is required." });
    }

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: "Select at least one item to transfer." });
    }

    const requestedItemIds = items
      .map((entry) => Number(entry?.itemId ?? entry?.item_id ?? 0))
      .filter((itemId) => Number.isInteger(itemId) && itemId > 0);

    const transferLockMap = await getTransferLockMapForInventory(fromInventoryId, requestedItemIds);
    const disposalLockMap = await getDisposalLockMapForInventory(fromInventoryId, requestedItemIds);
    const lockedTransferItemId = requestedItemIds.find((itemId) => transferLockMap.has(itemId));

    if (lockedTransferItemId) {
      const lock = transferLockMap.get(lockedTransferItemId);
      const lockLabel = lock?.transferLockReason === "completed" ? "a completed transfer" : "a pending transfer";
      return res.status(409).json({
        success: false,
        message: `Item #${lockedTransferItemId} is already included in ${lockLabel} and cannot be transferred again.`,
      });
    }

    const lockedDisposalItemId = requestedItemIds.find((itemId) => disposalLockMap.has(itemId));

    if (lockedDisposalItemId) {
      const lock = disposalLockMap.get(lockedDisposalItemId);
      const lockLabel = lock?.disposalLockReason === "completed" ? "a completed disposal" : "a pending disposal";
      return res.status(409).json({
        success: false,
        message: `Item #${lockedDisposalItemId} is already included in ${lockLabel} and cannot be transferred.`,
      });
    }

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);
    const inventoryNameColumn = getInventoryNameColumn(inventoryColumns);

    if (!inventoryIdColumn || !inventoryInchargeColumn) {
      return res.status(500).json({ success: false, message: "Inventory schema is missing required columns." });
    }

    const [fromInventoryRows] = await pool.execute(
      `
        SELECT
          i.${inventoryIdColumn} AS inventory_id,
          i.${inventoryInchargeColumn} AS incharge_id,
          ${inventoryNameColumn ? `i.${inventoryNameColumn} AS inventory_name` : "NULL AS inventory_name"}
        FROM inventories i
        WHERE i.${inventoryIdColumn} = ?
        LIMIT 1
      `,
      [fromInventoryId]
    );

    if (fromInventoryRows.length === 0) {
      return res.status(404).json({ success: false, message: "Source inventory was not found." });
    }

    const schema = await getAuthSchema();
    const sourceHodUserId = await resolveSourceInventoryHodUserId(fromInventoryId, inventoryColumns, schema);

    if (String(fromInventoryRows[0]?.incharge_id ?? "") !== String(initiatedById)) {
      return res.status(403).json({
        success: false,
        message: "You can only initiate transfers from inventories assigned to you.",
      });
    }

    const [toInventoryRows] = await pool.execute(
      `SELECT ${inventoryIdColumn} AS inventory_id FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
      [toInventoryId]
    );

    if (toInventoryRows.length === 0) {
      return res.status(404).json({ success: false, message: "Destination inventory was not found." });
    }

    const itemColumns = await ensureInventoryItemsColumns();
    const itemIdColumn = getItemIdColumn(itemColumns);
    const itemInventoryColumn = itemColumns.has("inventory_id") ? "inventory_id" : null;

    if (!itemIdColumn || !itemInventoryColumn) {
      return res.status(500).json({ success: false, message: "Inventory item schema is missing required columns." });
    }

    const createdTransfers = [];

    for (const entry of items) {
      const itemId = Number(entry?.itemId ?? entry?.item_id ?? 0);
      const quantity = Number(entry?.quantity ?? 1);

      if (!Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json({ success: false, message: "Each transfer entry must include a valid item id." });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: "Each transfer entry must include a quantity greater than zero." });
      }

      const [itemRows] = await pool.execute(
        `SELECT ${itemIdColumn} AS id, ${itemInventoryColumn} AS inventory_id FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} = ? LIMIT 1`,
        [itemId]
      );

      if (itemRows.length === 0) {
        return res.status(404).json({ success: false, message: `Item #${itemId} was not found.` });
      }

      if (Number(itemRows[0]?.inventory_id ?? 0) !== fromInventoryId) {
        return res.status(400).json({
          success: false,
          message: `Item #${itemId} does not belong to the selected source inventory.`,
        });
      }

      const insertColumns = ["item_id", "from_inventory_id", "to_inventory_id", "quantity", "reason"];
      const insertValues = [itemId, fromInventoryId, toInventoryId, quantity, reason];

      if (columns.has("notes")) {
        insertColumns.push("notes");
        insertValues.push(reason);
      }

      if (columns.has("status")) {
        insertColumns.push("status");
        insertValues.push("pending");
      }

      if (columns.has("approval_status")) {
        insertColumns.push("approval_status");
        insertValues.push("pending_hod");
      }

      if (columns.has("transfer_date")) {
        insertColumns.push("transfer_date");
        insertValues.push(transferDate);
      }

      if (columns.has("initiated_by_id")) {
        insertColumns.push("initiated_by_id");
        insertValues.push(initiatedById);
      }

      if (columns.has("source_hod_user_id") && Number.isInteger(sourceHodUserId) && sourceHodUserId > 0) {
        insertColumns.push("source_hod_user_id");
        insertValues.push(sourceHodUserId);
      }

      if (columns.has("created_date")) {
        insertColumns.push("created_date");
        insertValues.push(new Date());
      }

      const placeholders = insertColumns.map(() => "?").join(", ");
      const [result] = await pool.execute(
        `INSERT INTO item_transfers (${insertColumns.join(", ")}) VALUES (${placeholders})`,
        insertValues
      );

      createdTransfers.push({
        id: result.insertId,
        itemId,
        quantity,
      });
    }

    return res.status(201).json({
      success: true,
      message: `${createdTransfers.length} item transfer request${createdTransfers.length === 1 ? "" : "s"} submitted for HOD approval.`,
      transfers: createdTransfers,
    });
  })
);

app.post(
  "/api/item-transfers/:id/cancel",
  withDatabase(async (req, res) => {
    const transferId = Number(req.params.id);
    const initiatedById = Number(req.body?.initiatedById ?? req.body?.initiated_by_id ?? 0);
    const columns = await ensureItemTransfersWorkflow();

    if (!columns) {
      return res.status(404).json({ success: false, message: "Item transfers are not available." });
    }

    if (!Number.isInteger(transferId) || transferId <= 0) {
      return res.status(400).json({ success: false, message: "A valid transfer id is required." });
    }

    if (!Number.isInteger(initiatedById) || initiatedById <= 0) {
      return res.status(400).json({ success: false, message: "A valid initiating user id is required." });
    }

    const [anchorRows] = await pool.execute(
      "SELECT * FROM item_transfers WHERE id = ? LIMIT 1",
      [transferId]
    );

    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Transfer request was not found." });
    }

    const anchor = anchorRows[0];
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);
    let sourceInchargeId = 0;

    if (inventoryIdColumn && inventoryInchargeColumn) {
      const [sourceInventoryRows] = await pool.execute(
        `SELECT ${inventoryInchargeColumn} AS incharge_id FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
        [Number(anchor.from_inventory_id ?? 0)]
      );
      sourceInchargeId = Number(sourceInventoryRows[0]?.incharge_id ?? 0);
    }

    if (!canUserManageTransferBeforeHod(anchor, initiatedById, sourceInchargeId)) {
      return res.status(403).json({
        success: false,
        message: "Only the submitting inventory officer can cancel this transfer.",
      });
    }

    const currentApprovalStatus = resolveTransferDisposalApprovalStatus(anchor, columns);
    const cancellableStatuses = new Set(["pending_hod", "pending_staff"]);

    if (!cancellableStatuses.has(currentApprovalStatus)) {
      return res.status(409).json({
        success: false,
        message: "Only transfers awaiting HOD recommendation can be cancelled.",
      });
    }

    const lineIds = await fetchTransferBatchLineIds(transferId, columns);
    if (lineIds.length === 0) {
      return res.status(404).json({ success: false, message: "Transfer request was not found." });
    }

    const updateParts = [];
    const updateValues = [];

    if (columns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("cancelled");
    }

    if (columns.has("status")) {
      updateParts.push("status = ?");
      updateValues.push("cancelled");
    }

    if (columns.has("rejection_reason")) {
      updateParts.push("rejection_reason = ?");
      updateValues.push("Cancelled by submitting officer before HOD recommendation.");
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to cancel this transfer request." });
    }

    const placeholders = lineIds.map(() => "?").join(", ");
    await pool.execute(
      `UPDATE item_transfers SET ${updateParts.join(", ")} WHERE id IN (${placeholders})`,
      [...updateValues, ...lineIds]
    );

    return res.json({
      success: true,
      message: "Transfer request cancelled.",
      approvalStatus: "cancelled",
      cancelledTransferIds: lineIds,
    });
  })
);

app.post(
  "/api/item-transfers/:id/approve-hod",
  withDatabase(async (req, res) => {
    const transferId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? req.body?.approver_user_id ?? 0);
    const columns = await ensureItemTransfersWorkflow();

    if (!columns) {
      return res.status(404).json({ success: false, message: "Item transfers are not available." });
    }

    if (!Number.isInteger(transferId) || transferId <= 0) {
      return res.status(400).json({ success: false, message: "A valid transfer id is required." });
    }

    if (!Number.isInteger(approverUserId) || approverUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [anchorRows] = await pool.execute(
      "SELECT * FROM item_transfers WHERE id = ? LIMIT 1",
      [transferId]
    );

    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Transfer request was not found." });
    }

    const anchor = anchorRows[0];
    const currentApprovalStatus = resolveTransferDisposalApprovalStatus(anchor, columns);
    const hodPendingStatuses = new Set(["pending_hod", "pending_staff"]);

    if (!hodPendingStatuses.has(currentApprovalStatus)) {
      return res.status(409).json({ success: false, message: "This transfer is not awaiting HOD recommendation." });
    }

    const assignedHod = columns.has("source_hod_user_id") ? Number(anchor.source_hod_user_id ?? 0) : 0;
    if (assignedHod > 0 && assignedHod !== approverUserId) {
      return res.status(403).json({ success: false, message: "Only the assigned Head of Department can recommend this transfer." });
    }

    const lineIds = await fetchTransferBatchLineIds(transferId, columns);
    if (lineIds.length === 0) {
      return res.status(404).json({ success: false, message: "Transfer request was not found." });
    }

    const updateParts = [];
    const updateValues = [];

    if (columns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("pending_registrar");
    }

    if (columns.has("hod_approved_date")) {
      updateParts.push("hod_approved_date = CURRENT_TIMESTAMP");
    }

    if (columns.has("hod_approved_by_id")) {
      updateParts.push("hod_approved_by_id = ?");
      updateValues.push(approverUserId);
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to update transfer approval status." });
    }

    const placeholders = lineIds.map(() => "?").join(", ");
    await pool.execute(
      `UPDATE item_transfers SET ${updateParts.join(", ")} WHERE id IN (${placeholders})`,
      [...updateValues, ...lineIds]
    );

    await notifyApprovalStage(pool, {
      userIds: [anchor.initiated_by_id],
      workflow: "transfer",
      stage: "hod",
      entityId: transferId,
      entityLabel: anchor.transfer_reference || anchor.reference_no || `Transfer #${transferId}`,
      link: `/inventory/transfers/${transferId}`,
    });

    return res.json({
      success: true,
      message: "Transfer recommended by Head of Department and forwarded to the registrar.",
      approvalStatus: "pending_registrar",
      transferIds: lineIds,
    });
  })
);

app.post(
  "/api/item-transfers/:id/reject-hod",
  withDatabase(async (req, res) => {
    const transferId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? req.body?.approver_user_id ?? 0);
    const reason = String(req.body?.reason || "Rejected by Head of Department").trim();
    const columns = await ensureItemTransfersWorkflow();

    if (!columns) {
      return res.status(404).json({ success: false, message: "Item transfers are not available." });
    }

    if (!Number.isInteger(transferId) || transferId <= 0) {
      return res.status(400).json({ success: false, message: "A valid transfer id is required." });
    }

    if (!Number.isInteger(approverUserId) || approverUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [anchorRows] = await pool.execute(
      "SELECT * FROM item_transfers WHERE id = ? LIMIT 1",
      [transferId]
    );

    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Transfer request was not found." });
    }

    const anchor = anchorRows[0];
    const currentApprovalStatus = resolveTransferDisposalApprovalStatus(anchor, columns);
    const hodPendingStatuses = new Set(["pending_hod", "pending_staff"]);

    if (!hodPendingStatuses.has(currentApprovalStatus)) {
      return res.status(409).json({ success: false, message: "This transfer is not awaiting HOD recommendation." });
    }

    const assignedHod = columns.has("source_hod_user_id") ? Number(anchor.source_hod_user_id ?? 0) : 0;
    if (assignedHod > 0 && assignedHod !== approverUserId) {
      return res.status(403).json({ success: false, message: "Only the assigned Head of Department can reject this transfer." });
    }

    const lineIds = await fetchTransferBatchLineIds(transferId, columns);
    if (lineIds.length === 0) {
      return res.status(404).json({ success: false, message: "Transfer request was not found." });
    }

    const updateParts = [];
    const updateValues = [];

    if (columns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("rejected");
    }

    if (columns.has("status")) {
      updateParts.push("status = ?");
      updateValues.push("rejected");
    }

    if (columns.has("rejection_reason")) {
      updateParts.push("rejection_reason = ?");
      updateValues.push(reason);
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to reject this transfer request." });
    }

    const placeholders = lineIds.map(() => "?").join(", ");
    await pool.execute(
      `UPDATE item_transfers SET ${updateParts.join(", ")} WHERE id IN (${placeholders})`,
      [...updateValues, ...lineIds]
    );

    return res.json({
      success: true,
      message: "Transfer request rejected by Head of Department.",
      approvalStatus: "rejected",
      transferIds: lineIds,
    });
  })
);

app.post(
  "/api/item-disposals",
  withDatabase(async (req, res) => {
    const columns = await ensureItemDisposalsWorkflow();
    if (!columns) {
      return res.status(500).json({ success: false, message: "Item disposals table is not available." });
    }

    const initiatedById = Number(req.body?.initiatedById ?? req.body?.initiated_by_id ?? 0);
    const inventoryId = Number(req.body?.inventoryId ?? req.body?.inventory_id ?? 0);
    const reason = String(req.body?.reason ?? "").trim();
    const reasonOtherDetails = String(req.body?.reasonOtherDetails ?? req.body?.reason_other_details ?? "").trim();
    const disposalType = String(req.body?.disposalType ?? req.body?.disposal_type ?? "").trim().toLowerCase();
    const disposalTypeDetails = String(req.body?.disposalTypeDetails ?? req.body?.disposal_type_details ?? "").trim();
    const condition = String(req.body?.condition ?? "").trim();
    const description = String(req.body?.description ?? "").trim();
    const disposalDate = String(req.body?.disposalDate ?? req.body?.disposal_date ?? "").trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!Number.isInteger(initiatedById) || initiatedById <= 0) {
      return res.status(400).json({ success: false, message: "A valid initiating user is required." });
    }

    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return res.status(400).json({ success: false, message: "Please select an inventory." });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: "Disposal reason is required." });
    }

    if (reason === "other" && !reasonOtherDetails) {
      return res.status(400).json({ success: false, message: "Please describe the disposal reason." });
    }

    if (!disposalType) {
      return res.status(400).json({ success: false, message: "Disposal type is required." });
    }

    const allowedDisposalTypes = new Set(["auction", "donation", "other"]);
    if (!allowedDisposalTypes.has(disposalType)) {
      return res.status(400).json({ success: false, message: "A valid disposal type is required." });
    }

    if (disposalType === "other" && !disposalTypeDetails) {
      return res.status(400).json({ success: false, message: "Please describe the disposal type." });
    }

    if (!condition) {
      return res.status(400).json({ success: false, message: "Condition assessment is required." });
    }

    if (!disposalDate) {
      return res.status(400).json({ success: false, message: "Disposal date is required." });
    }

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: "Select at least one item to dispose." });
    }

    const requestedItemIds = items
      .map((entry) => Number(entry?.itemId ?? entry?.item_id ?? 0))
      .filter((itemId) => Number.isInteger(itemId) && itemId > 0);

    const [transferLockMap, disposalLockMap] = await Promise.all([
      getTransferLockMapForInventory(inventoryId, requestedItemIds),
      getDisposalLockMapForInventory(inventoryId, requestedItemIds),
    ]);

    const lockedTransferItemId = requestedItemIds.find((itemId) => transferLockMap.has(itemId));
    if (lockedTransferItemId) {
      const lock = transferLockMap.get(lockedTransferItemId);
      const lockLabel = lock?.transferLockReason === "completed" ? "a completed transfer" : "a pending transfer";
      return res.status(409).json({
        success: false,
        message: `Item #${lockedTransferItemId} is already included in ${lockLabel} and cannot be disposed.`,
      });
    }

    const lockedDisposalItemId = requestedItemIds.find((itemId) => disposalLockMap.has(itemId));
    if (lockedDisposalItemId) {
      const lock = disposalLockMap.get(lockedDisposalItemId);
      const lockLabel = lock?.disposalLockReason === "completed" ? "a completed disposal" : "a pending disposal";
      return res.status(409).json({
        success: false,
        message: `Item #${lockedDisposalItemId} is already included in ${lockLabel} and cannot be disposed again.`,
      });
    }

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

    if (!inventoryIdColumn || !inventoryInchargeColumn) {
      return res.status(500).json({ success: false, message: "Inventory schema is missing required columns." });
    }

    const [inventoryRows] = await pool.execute(
      `
        SELECT ${inventoryIdColumn} AS inventory_id, ${inventoryInchargeColumn} AS incharge_id
        FROM inventories
        WHERE ${inventoryIdColumn} = ?
        LIMIT 1
      `,
      [inventoryId]
    );

    if (inventoryRows.length === 0) {
      return res.status(404).json({ success: false, message: "Inventory was not found." });
    }

    if (String(inventoryRows[0]?.incharge_id ?? "") !== String(initiatedById)) {
      return res.status(403).json({
        success: false,
        message: "You can only initiate disposals from inventories assigned to you.",
      });
    }

    const schema = await getAuthSchema();
    const sourceHodUserId = await resolveSourceInventoryHodUserId(inventoryId, inventoryColumns, schema);

    const itemColumns = await ensureInventoryItemsColumns();
    const itemIdColumn = getItemIdColumn(itemColumns);
    const itemInventoryColumn = itemColumns.has("inventory_id") ? "inventory_id" : null;

    if (!itemIdColumn || !itemInventoryColumn) {
      return res.status(500).json({ success: false, message: "Inventory item schema is missing required columns." });
    }

    const createdDisposals = [];

    for (const entry of items) {
      const itemId = Number(entry?.itemId ?? entry?.item_id ?? 0);
      const quantity = Number(entry?.quantity ?? 1);

      if (!Number.isInteger(itemId) || itemId <= 0) {
        return res.status(400).json({ success: false, message: "Each disposal entry must include a valid item id." });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: "Each disposal entry must include a quantity greater than zero." });
      }

      const [itemRows] = await pool.execute(
        `SELECT ${itemIdColumn} AS id, ${itemInventoryColumn} AS inventory_id FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} = ? LIMIT 1`,
        [itemId]
      );

      if (itemRows.length === 0) {
        return res.status(404).json({ success: false, message: `Item #${itemId} was not found.` });
      }

      if (Number(itemRows[0]?.inventory_id ?? 0) !== inventoryId) {
        return res.status(400).json({
          success: false,
          message: `Item #${itemId} does not belong to the selected inventory.`,
        });
      }

      const insertColumns = ["item_id", "inventory_id", "quantity", "reason"];
      const insertValues = [itemId, inventoryId, quantity, reason];

      if (columns.has("description")) {
        insertColumns.push("description");
        insertValues.push(description);
      }

      if (columns.has("condition")) {
        insertColumns.push("`condition`");
        insertValues.push(condition);
      }

      if (columns.has("disposal_type")) {
        insertColumns.push("disposal_type");
        insertValues.push(disposalType);
      }

      if (columns.has("disposal_type_details")) {
        insertColumns.push("disposal_type_details");
        insertValues.push(disposalType === "other" ? disposalTypeDetails : "");
      }

      if (columns.has("reason_other_details")) {
        insertColumns.push("reason_other_details");
        insertValues.push(reason === "other" ? reasonOtherDetails : "");
      }

      if (columns.has("status")) {
        insertColumns.push("status");
        insertValues.push("pending");
      }

      if (columns.has("approval_status")) {
        insertColumns.push("approval_status");
        insertValues.push("pending_hod");
      }

      if (columns.has("disposal_date")) {
        insertColumns.push("disposal_date");
        insertValues.push(disposalDate);
      }

      if (columns.has("initiated_by_id")) {
        insertColumns.push("initiated_by_id");
        insertValues.push(initiatedById);
      }

      if (columns.has("source_hod_user_id") && Number.isInteger(sourceHodUserId) && sourceHodUserId > 0) {
        insertColumns.push("source_hod_user_id");
        insertValues.push(sourceHodUserId);
      }

      if (columns.has("created_date")) {
        insertColumns.push("created_date");
        insertValues.push(new Date());
      }

      const placeholders = insertColumns.map(() => "?").join(", ");
      const [result] = await pool.execute(
        `INSERT INTO item_disposals (${insertColumns.join(", ")}) VALUES (${placeholders})`,
        insertValues
      );

      createdDisposals.push({
        id: result.insertId,
        itemId,
        quantity,
      });
    }

    return res.status(201).json({
      success: true,
      message: `${createdDisposals.length} item disposal request${createdDisposals.length === 1 ? "" : "s"} submitted for HOD approval.`,
      disposals: createdDisposals,
    });
  })
);

app.get(
  "/api/item-disposals/:id",
  withDatabase(async (req, res) => {
    const disposalId = Number(req.params.id);
    const columns = await ensureItemDisposalsWorkflow();

    if (!columns) {
      return res.status(404).json({ success: false, message: "Item disposals are not available." });
    }

    if (!Number.isInteger(disposalId) || disposalId <= 0) {
      return res.status(400).json({ success: false, message: "A valid disposal id is required." });
    }

    const schema = await getAuthSchema();
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const itemIdColumn = itemColumns.size > 0 ? getItemIdColumn(itemColumns) : null;
    const disposalDateCol = columns.has("disposal_date") ? "disposal_date" : "created_date";
    const userNameColumn = getUserNameColumn(schema);
    const userIdColumn = getUserPrimaryKeyColumn(schema);

    const [anchorRows] = await pool.execute(
      `
        SELECT
          idp.id,
          idp.item_id,
          idp.inventory_id,
          idp.quantity,
          idp.reason,
          idp.description,
          ${columns.has("disposal_type") ? "idp.disposal_type" : "NULL AS disposal_type"},
          ${columns.has("disposal_type_details") ? "idp.disposal_type_details" : "NULL AS disposal_type_details"},
          ${columns.has("reason_other_details") ? "idp.reason_other_details" : "NULL AS reason_other_details"},
          idp.\`condition\` AS item_condition,
          idp.status,
          ${columns.has("approval_status") ? "idp.approval_status" : "NULL AS approval_status"},
          idp.${disposalDateCol} AS disposal_date,
          ${columns.has("hod_approved_date") ? "idp.hod_approved_date" : "NULL AS hod_approved_date"},
          ${columns.has("registrar_approved_date") ? "idp.registrar_approved_date" : "NULL AS registrar_approved_date"},
          ${columns.has("initiated_by_id") ? "idp.initiated_by_id" : "NULL AS initiated_by_id"},
          initiator.${userNameColumn} AS initiated_by_name
        FROM item_disposals idp
        LEFT JOIN users initiator ON initiator.${userIdColumn} = idp.initiated_by_id
        WHERE idp.id = ?
        LIMIT 1
      `,
      [disposalId]
    );

    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Disposal request was not found." });
    }

    const anchor = anchorRows[0];
    const batchMatchParts = buildDisposalBatchMatchParts(columns);

    const [lineRows] = await pool.execute(
      `
        SELECT
          idp.id,
          idp.item_id,
          idp.quantity,
          idp.status,
          ${columns.has("approval_status") ? "idp.approval_status" : "NULL AS approval_status"}
        FROM item_disposals anchor
        INNER JOIN item_disposals idp ON ${batchMatchParts.join(" AND ")}
        WHERE anchor.id = ?
        ORDER BY idp.id ASC
      `,
      [disposalId]
    );

    const itemIds = [...new Set(lineRows.map((row) => row.item_id).filter(Boolean))];
    const itemMap = new Map();

    if (itemIds.length > 0 && itemIdColumn && tableNames.has(DB_ITEMS_TABLE)) {
      const placeholders = itemIds.map(() => "?").join(", ");
      const [itemRows] = await pool.execute(
        `SELECT * FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} IN (${placeholders})`,
        itemIds
      );

      itemRows.forEach((row) => {
        const normalized = normalizeItemRow(row);
        itemMap.set(Number(normalized.id), normalized);
      });
    }

    const formItems = [];
    const lineItems = lineRows.map((row) => {
      const itemDetail = itemMap.get(Number(row.item_id)) || null;
      const quantity = Number(row.quantity) || 1;

      if (itemDetail) {
        for (let index = 0; index < quantity; index += 1) {
          formItems.push({
            id: itemDetail.id,
            itemName: itemDetail.itemName || itemDetail.item_name || "",
            itemCode: itemDetail.itemCode || itemDetail.item_code || "",
            serialNo: itemDetail.serialNo || itemDetail.serial_no || "",
            model: itemDetail.model || "",
            brand: itemDetail.brand || itemDetail.manufacturer || "",
            value: itemDetail.value ?? "",
            ginNo: itemDetail.ginNo || itemDetail.gin_no || "",
            poNo: itemDetail.poNo || itemDetail.po_no || "",
            pageno: itemDetail.pageno || itemDetail.page_no || itemDetail.pageNo || "",
            purchaseDate: itemDetail.purchaseDate || itemDetail.purchase_date || "",
            funding: itemDetail.funding || "",
            fundingOther: itemDetail.fundingOther || itemDetail.funding_other || "",
          });
        }
      }

      return {
        disposalLineId: row.id,
        itemId: row.item_id,
        itemName: itemDetail?.itemName || itemDetail?.item_name || `Item #${row.item_id}`,
        quantity,
        status: row.status || "pending",
        approvalStatus: resolveTransferDisposalApprovalStatus(row, columns),
      };
    });

    const inventoryId = Number(anchor.inventory_id ?? 0);
    const sourceInventory = await fetchInventoryPartyDetails(inventoryId, inventoryColumns, schema);

    return res.json({
      success: true,
      disposal: {
        id: anchor.id,
        disposalIds: lineRows.map((row) => row.id),
        inventoryId,
        inventory: sourceInventory?.name || "-",
        reason: anchor.reason || "",
        reasonOtherDetails: anchor.reason_other_details || "",
        disposalType: anchor.disposal_type || "",
        disposalTypeDetails: anchor.disposal_type_details || "",
        condition: anchor.item_condition || "",
        description: anchor.description || "",
        status: anchor.status || "pending",
        approvalStatus: resolveTransferDisposalApprovalStatus(anchor, columns),
        disposalDate: anchor.disposal_date
          ? new Date(anchor.disposal_date).toISOString().split("T")[0]
          : "",
        hodApprovedDate: anchor.hod_approved_date
          ? new Date(anchor.hod_approved_date).toISOString().split("T")[0]
          : "",
        registrarApprovedDate: anchor.registrar_approved_date
          ? new Date(anchor.registrar_approved_date).toISOString().split("T")[0]
          : "",
        initiatedById: anchor.initiated_by_id ?? null,
        initiatedBy: anchor.initiated_by_name || "-",
        sourceInventory,
        items: lineItems,
        formItems,
      },
    });
  })
);

app.get(
  "/api/item-disposals",
  withDatabase(async (req, res) => {
    const columns = await ensureItemDisposalsWorkflow();
    if (!columns) {
      return res.json({ success: true, disposals: [] });
    }

    const schema = await getAuthSchema();
    const approvalStatus = String(req.query.approvalStatus || "").trim().toLowerCase();
    const inventoryOfficerUserId = Number(
      req.query?.inventoryOfficerUserId ?? req.query?.inventory_officer_user_id ?? 0
    );
    const disposalScope = String(req.query?.disposalScope ?? "all").trim().toLowerCase();
    const sourceHodUserId = Number(req.query?.sourceHodUserId ?? req.query?.hodUserId ?? 0);
    const hasSourceHodFilter = Number.isInteger(sourceHodUserId) && sourceHodUserId > 0;
    const hasInventoryOfficerFilter =
      Number.isInteger(inventoryOfficerUserId) && inventoryOfficerUserId > 0;
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const itemNameExpr = buildItemNameExpression(itemColumns);
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const itemJoin = tableNames.has(DB_ITEMS_TABLE)
      ? buildItemAliasJoin(itemColumns, "idp.item_id")
      : "";
    const params = [];
    const whereParts = [];

    if (hasSourceHodFilter && columns.has("source_hod_user_id")) {
      whereParts.push("idp.source_hod_user_id = ?");
      params.push(sourceHodUserId);
      whereParts.push("LOWER(COALESCE(idp.approval_status, '')) IN ('pending_hod', 'pending_staff')");
      whereParts.push("LOWER(COALESCE(idp.status, '')) NOT IN ('completed', 'rejected', 'cancelled')");
    }

    if (hasInventoryOfficerFilter) {
      const inventoryColumns = await ensureInventoriesLocationColumn();
      const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
      const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

      if (inventoryIdColumn && inventoryInchargeColumn) {
        const officerInventorySubquery = `(SELECT inv.${inventoryIdColumn} FROM inventories inv WHERE inv.${inventoryInchargeColumn} = ?)`;
        whereParts.push(`idp.inventory_id IN ${officerInventorySubquery}`);
        params.push(inventoryOfficerUserId);

        if (disposalScope === "pending") {
          whereParts.push("LOWER(COALESCE(idp.status, '')) NOT IN ('completed', 'rejected', 'cancelled')");
          if (columns.has("approval_status")) {
            whereParts.push(
              "LOWER(COALESCE(idp.approval_status, '')) IN ('pending_hod', 'pending_staff', 'pending_registrar')"
            );
          }
        } else if (disposalScope === "approved") {
          if (columns.has("approval_status")) {
            whereParts.push(
              "LOWER(COALESCE(idp.approval_status, '')) IN ('pending_writeoff', 'pending_admin')"
            );
          } else {
            whereParts.push("LOWER(COALESCE(idp.status, '')) = 'approved'");
          }
          whereParts.push("LOWER(COALESCE(idp.status, '')) NOT IN ('completed', 'rejected', 'cancelled')");
        } else if (disposalScope === "completed") {
          whereParts.push("LOWER(COALESCE(idp.status, '')) = 'completed'");
        }
      }
    }

    if (approvalStatus && !hasInventoryOfficerFilter && !hasSourceHodFilter) {
      if (columns.has("approval_status") && approvalStatus === "pending_registrar") {
        whereParts.push(
          `(LOWER(COALESCE(idp.approval_status, '')) = ? OR (idp.approval_status IS NULL AND LOWER(COALESCE(idp.status, '')) = 'pending'))`
        );
        params.push(approvalStatus);
      } else if (columns.has("approval_status")) {
        whereParts.push("LOWER(COALESCE(idp.approval_status, '')) = ?");
        params.push(approvalStatus);
      } else {
        whereParts.push("LOWER(COALESCE(idp.status, '')) = ?");
        params.push(approvalStatus === "pending_registrar" ? "pending" : approvalStatus);
      }
    }

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryNameSelect = buildInventoryAliasNameSelect("inv", inventoryColumns, "inventory_name");
    const inventoryJoin = buildInventoryAliasJoin("inv", inventoryColumns, "idp.inventory_id");
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const disposalDateCol = columns.has("disposal_date") ? "idp.disposal_date" : "idp.created_date";
    const itemNameSelect = tableNames.has(DB_ITEMS_TABLE) ? `${itemNameExpr} AS item_name` : "CAST(idp.item_id AS CHAR) AS item_name";
    const itemValueColumn = itemColumns.size > 0 ? resolveDbColumn(itemColumns, ["value"]) : null;
    const itemValueSelect = itemValueColumn ? `ii.${itemValueColumn} AS item_value` : "NULL AS item_value";

    const [rows] = await pool.execute(
      `
        SELECT
          idp.id,
          idp.item_id,
          ${itemNameSelect},
          ${itemValueSelect},
          ${inventoryNameSelect},
          idp.quantity,
          idp.reason,
          idp.description,
          ${columns.has("disposal_type") ? "idp.disposal_type" : "NULL AS disposal_type"},
          ${columns.has("disposal_type_details") ? "idp.disposal_type_details" : "NULL AS disposal_type_details"},
          ${columns.has("reason_other_details") ? "idp.reason_other_details" : "NULL AS reason_other_details"},
          idp.\`condition\` AS item_condition,
          idp.status,
          ${columns.has("approval_status") ? "idp.approval_status" : "NULL AS approval_status"},
          ${disposalDateCol} AS disposal_date,
          ${columns.has("hod_approved_date") ? "idp.hod_approved_date" : "NULL AS hod_approved_date"},
          initiator.${userNameColumn} AS initiated_by_name
        FROM item_disposals idp
        ${itemJoin}
        ${inventoryJoin}
        LEFT JOIN users initiator ON initiator.${userIdColumn} = idp.initiated_by_id
        ${whereClause}
        ORDER BY ${disposalDateCol} DESC, idp.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      disposals: rows.map((row) => ({
        id: row.id,
        itemId: row.item_id,
        itemName: row.item_name || `Item #${row.item_id}`,
        inventory: row.inventory_name || "-",
        quantity: row.quantity ?? 1,
        itemValue: row.item_value ?? null,
        reason: row.reason || "",
        reasonOtherDetails: row.reason_other_details || "",
        disposalType: row.disposal_type || "",
        disposalTypeDetails: row.disposal_type_details || "",
        condition: row.item_condition || "",
        description: row.description || "",
        status: row.status || "pending",
        approvalStatus: resolveTransferDisposalApprovalStatus(row, columns),
        disposalDate: row.disposal_date ? new Date(row.disposal_date).toISOString().split("T")[0] : "",
        hodApprovedDate: row.hod_approved_date
          ? new Date(row.hod_approved_date).toISOString().split("T")[0]
          : "",
        initiatedBy: row.initiated_by_name || "-",
      })),
    });
  })
);

const approveTransferDisposalByRegistrar = async ({
  tableName,
  ensureColumns,
  requestId,
  approverUserId,
  nextOperationalStatus,
  nextApprovalStatus = "pending_admin",
  successMessage = "Request approved by the registrar and forwarded to the administrator.",
}) => {
  const columns = await ensureColumns();
  if (!columns) {
    return { status: 404, body: { success: false, message: `${tableName} records are not available.` } };
  }

  const [rows] = await pool.execute(`SELECT * FROM ${tableName} WHERE id = ? LIMIT 1`, [requestId]);
  if (rows.length === 0) {
    return { status: 404, body: { success: false, message: "Request not found." } };
  }

  const record = rows[0];
  const currentApprovalStatus = resolveTransferDisposalApprovalStatus(record, columns);
  if (currentApprovalStatus !== "pending_registrar") {
    return {
      status: 409,
      body: { success: false, message: "This request is not awaiting registrar approval." },
    };
  }

  const updateParts = [];
  const updateValues = [];

  if (columns.has("approval_status")) {
    updateParts.push("approval_status = ?");
    updateValues.push(nextApprovalStatus);
  }

  if (columns.has("status") && nextOperationalStatus) {
    updateParts.push("status = ?");
    updateValues.push(nextOperationalStatus);
  }

  if (columns.has("registrar_approved_date")) {
    updateParts.push("registrar_approved_date = CURRENT_TIMESTAMP");
  }

  if (columns.has("registrar_approved_by_id") && Number.isInteger(approverUserId) && approverUserId > 0) {
    updateParts.push("registrar_approved_by_id = ?");
    updateValues.push(approverUserId);
  }

  if (updateParts.length === 0) {
    return { status: 500, body: { success: false, message: "Unable to update approval status." } };
  }

  updateValues.push(requestId);
  await pool.execute(`UPDATE ${tableName} SET ${updateParts.join(", ")} WHERE id = ?`, updateValues);

  const workflow = tableName === "item_disposals" ? "disposal" : "transfer";
  const detailPath = tableName === "item_disposals"
    ? `/inventory/disposals/${requestId}`
    : `/inventory/transfers/${requestId}`;

  await notifyApprovalStage(pool, {
    userIds: [record.initiated_by_id],
    workflow,
    stage: "registrar",
    entityId: requestId,
    entityLabel: record.transfer_reference || record.reference_no || record.disposal_reference || `${workflow} #${requestId}`,
    link: detailPath,
  });

  return {
    status: 200,
    body: {
      success: true,
      message: successMessage,
      approvalStatus: nextApprovalStatus,
    },
  };
};

const rejectTransferDisposalByRegistrar = async ({
  tableName,
  ensureColumns,
  requestId,
  reason,
  rejectedStatus,
}) => {
  const columns = await ensureColumns();
  if (!columns) {
    return { status: 404, body: { success: false, message: `${tableName} records are not available.` } };
  }

  const [rows] = await pool.execute(`SELECT * FROM ${tableName} WHERE id = ? LIMIT 1`, [requestId]);
  if (rows.length === 0) {
    return { status: 404, body: { success: false, message: "Request not found." } };
  }

  const record = rows[0];
  const currentApprovalStatus = resolveTransferDisposalApprovalStatus(record, columns);
  if (currentApprovalStatus !== "pending_registrar") {
    return {
      status: 409,
      body: { success: false, message: "This request is not awaiting registrar approval." },
    };
  }

  const updateParts = [];
  const updateValues = [];

  if (columns.has("approval_status")) {
    updateParts.push("approval_status = ?");
    updateValues.push("rejected");
  }

  if (columns.has("status")) {
    updateParts.push("status = ?");
    updateValues.push(rejectedStatus);
  }

  if (columns.has("rejection_reason")) {
    updateParts.push("rejection_reason = ?");
    updateValues.push(reason);
  }

  if (updateParts.length === 0) {
    return { status: 500, body: { success: false, message: "Unable to reject this request." } };
  }

  updateValues.push(requestId);
  await pool.execute(`UPDATE ${tableName} SET ${updateParts.join(", ")} WHERE id = ?`, updateValues);

  return {
    status: 200,
    body: {
      success: true,
      message: "Request rejected by the registrar.",
      approvalStatus: "rejected",
    },
  };
};

app.post(
  "/api/item-transfers/:id/approve-registrar",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? 0);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid transfer id is required." });
    }

    const result = await approveTransferDisposalByRegistrar({
      tableName: "item_transfers",
      ensureColumns: ensureItemTransfersWorkflow,
      requestId,
      approverUserId,
      nextOperationalStatus: "pending",
    });

    return res.status(result.status).json(result.body);
  })
);

app.post(
  "/api/item-transfers/:id/reject",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverRole = normalizeRoleForStorage(req.body?.approverRole || "registrar");
    const reason = String(req.body?.reason || "Rejected by Registrar").trim();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid transfer id is required." });
    }

    if (approverRole !== "registrar") {
      return res.status(400).json({ success: false, message: "Only registrar rejection is supported for transfers." });
    }

    const result = await rejectTransferDisposalByRegistrar({
      tableName: "item_transfers",
      ensureColumns: ensureItemTransfersWorkflow,
      requestId,
      reason,
      rejectedStatus: "cancelled",
    });

    return res.status(result.status).json(result.body);
  })
);

app.post(
  "/api/item-disposals/:id/approve-registrar",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? 0);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid disposal id is required." });
    }

    const result = await approveTransferDisposalByRegistrar({
      tableName: "item_disposals",
      ensureColumns: ensureItemDisposalsWorkflow,
      requestId,
      approverUserId,
      nextOperationalStatus: "approved",
      nextApprovalStatus: "pending_writeoff",
      successMessage:
        "Disposal approved by the registrar. Items remain in inventory until written off after auction processing.",
    });

    return res.status(result.status).json(result.body);
  })
);

app.post(
  "/api/item-disposals/:id/approve-hod",
  withDatabase(async (req, res) => {
    const disposalId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? req.body?.approver_user_id ?? 0);
    const columns = await ensureItemDisposalsWorkflow();

    if (!columns) {
      return res.status(404).json({ success: false, message: "Item disposals are not available." });
    }

    if (!Number.isInteger(disposalId) || disposalId <= 0) {
      return res.status(400).json({ success: false, message: "A valid disposal id is required." });
    }

    if (!Number.isInteger(approverUserId) || approverUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [anchorRows] = await pool.execute(
      "SELECT * FROM item_disposals WHERE id = ? LIMIT 1",
      [disposalId]
    );

    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Disposal request was not found." });
    }

    const anchor = anchorRows[0];
    const currentApprovalStatus = resolveTransferDisposalApprovalStatus(anchor, columns);
    const hodPendingStatuses = new Set(["pending_hod", "pending_staff"]);

    if (!hodPendingStatuses.has(currentApprovalStatus)) {
      return res.status(409).json({ success: false, message: "This disposal is not awaiting HOD recommendation." });
    }

    const assignedHod = columns.has("source_hod_user_id") ? Number(anchor.source_hod_user_id ?? 0) : 0;
    if (assignedHod > 0 && assignedHod !== approverUserId) {
      return res.status(403).json({ success: false, message: "Only the assigned Head of Department can recommend this disposal." });
    }

    const lineIds = await fetchDisposalBatchLineIds(disposalId, columns);
    if (lineIds.length === 0) {
      return res.status(404).json({ success: false, message: "Disposal request was not found." });
    }

    const updateParts = [];
    const updateValues = [];

    if (columns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("pending_registrar");
    }

    if (columns.has("hod_approved_date")) {
      updateParts.push("hod_approved_date = CURRENT_TIMESTAMP");
    }

    if (columns.has("hod_approved_by_id")) {
      updateParts.push("hod_approved_by_id = ?");
      updateValues.push(approverUserId);
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to update disposal approval status." });
    }

    const placeholders = lineIds.map(() => "?").join(", ");
    await pool.execute(
      `UPDATE item_disposals SET ${updateParts.join(", ")} WHERE id IN (${placeholders})`,
      [...updateValues, ...lineIds]
    );

    await notifyApprovalStage(pool, {
      userIds: [anchor.initiated_by_id],
      workflow: "disposal",
      stage: "hod",
      entityId: disposalId,
      entityLabel: anchor.disposal_reference || anchor.reference_no || `Disposal #${disposalId}`,
      link: `/inventory/disposals/${disposalId}`,
    });

    return res.json({
      success: true,
      message: "Disposal recommended by Head of Department and forwarded to the registrar.",
      approvalStatus: "pending_registrar",
      disposalIds: lineIds,
    });
  })
);

app.post(
  "/api/item-disposals/:id/reject-hod",
  withDatabase(async (req, res) => {
    const disposalId = Number(req.params.id);
    const approverUserId = Number(req.body?.approverUserId ?? req.body?.approver_user_id ?? 0);
    const reason = String(req.body?.reason || "Rejected by Head of Department").trim();
    const columns = await ensureItemDisposalsWorkflow();

    if (!columns) {
      return res.status(404).json({ success: false, message: "Item disposals are not available." });
    }

    if (!Number.isInteger(disposalId) || disposalId <= 0) {
      return res.status(400).json({ success: false, message: "A valid disposal id is required." });
    }

    if (!Number.isInteger(approverUserId) || approverUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid approver user id is required." });
    }

    const [anchorRows] = await pool.execute(
      "SELECT * FROM item_disposals WHERE id = ? LIMIT 1",
      [disposalId]
    );

    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Disposal request was not found." });
    }

    const anchor = anchorRows[0];
    const currentApprovalStatus = resolveTransferDisposalApprovalStatus(anchor, columns);
    const hodPendingStatuses = new Set(["pending_hod", "pending_staff"]);

    if (!hodPendingStatuses.has(currentApprovalStatus)) {
      return res.status(409).json({ success: false, message: "This disposal is not awaiting HOD recommendation." });
    }

    const assignedHod = columns.has("source_hod_user_id") ? Number(anchor.source_hod_user_id ?? 0) : 0;
    if (assignedHod > 0 && assignedHod !== approverUserId) {
      return res.status(403).json({ success: false, message: "Only the assigned Head of Department can reject this disposal." });
    }

    const lineIds = await fetchDisposalBatchLineIds(disposalId, columns);
    if (lineIds.length === 0) {
      return res.status(404).json({ success: false, message: "Disposal request was not found." });
    }

    const updateParts = [];
    const updateValues = [];

    if (columns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("rejected");
    }

    if (columns.has("status")) {
      updateParts.push("status = ?");
      updateValues.push("rejected");
    }

    if (columns.has("rejection_reason")) {
      updateParts.push("rejection_reason = ?");
      updateValues.push(reason);
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to reject this disposal request." });
    }

    const placeholders = lineIds.map(() => "?").join(", ");
    await pool.execute(
      `UPDATE item_disposals SET ${updateParts.join(", ")} WHERE id IN (${placeholders})`,
      [...updateValues, ...lineIds]
    );

    return res.json({
      success: true,
      message: "Disposal request rejected by Head of Department.",
      approvalStatus: "rejected",
      disposalIds: lineIds,
    });
  })
);

app.post(
  "/api/item-disposals/:id/write-off",
  withDatabase(async (req, res) => {
    const disposalId = Number(req.params.id);
    const officerUserId = Number(req.body?.officerUserId ?? req.body?.officer_user_id ?? req.body?.writtenOffById ?? 0);
    const columns = await ensureItemDisposalsWorkflow();

    if (!columns) {
      return res.status(404).json({ success: false, message: "Item disposals are not available." });
    }

    if (!Number.isInteger(disposalId) || disposalId <= 0) {
      return res.status(400).json({ success: false, message: "A valid disposal id is required." });
    }

    if (!Number.isInteger(officerUserId) || officerUserId <= 0) {
      return res.status(400).json({ success: false, message: "A valid inventory officer user id is required." });
    }

    const [anchorRows] = await pool.execute(
      "SELECT * FROM item_disposals WHERE id = ? LIMIT 1",
      [disposalId]
    );

    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Disposal request was not found." });
    }

    const anchor = anchorRows[0];
    const currentApprovalStatus = resolveTransferDisposalApprovalStatus(anchor, columns);
    const writeOffEligibleStatuses = new Set(["pending_writeoff", "pending_admin"]);

    if (!writeOffEligibleStatuses.has(currentApprovalStatus)) {
      return res.status(409).json({
        success: false,
        message: "This disposal is not approved for write-off yet.",
      });
    }

    const inventoryId = Number(anchor.inventory_id ?? 0);
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

    if (inventoryIdColumn && inventoryInchargeColumn) {
      const [inventoryRows] = await pool.execute(
        `SELECT ${inventoryInchargeColumn} AS incharge_id FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
        [inventoryId]
      );
      const inchargeId = Number(inventoryRows[0]?.incharge_id ?? 0);

      if (inchargeId > 0 && inchargeId !== officerUserId) {
        return res.status(403).json({
          success: false,
          message: "Only the inventory officer in charge can write off items for this disposal.",
        });
      }
    }

    const lineIds = await fetchDisposalBatchLineIds(disposalId, columns);
    if (lineIds.length === 0) {
      return res.status(404).json({ success: false, message: "Disposal request was not found." });
    }

    const [lineRows] = await pool.execute(
      `SELECT item_id FROM item_disposals WHERE id IN (${lineIds.map(() => "?").join(", ")})`,
      lineIds
    );
    const itemIds = [...new Set(lineRows.map((row) => Number(row.item_id)).filter((id) => id > 0))];

    const updateParts = [];
    const updateValues = [];

    if (columns.has("approval_status")) {
      updateParts.push("approval_status = ?");
      updateValues.push("completed");
    }

    if (columns.has("status")) {
      updateParts.push("status = ?");
      updateValues.push("completed");
    }

    if (columns.has("completed_date")) {
      updateParts.push("completed_date = CURRENT_TIMESTAMP");
    }

    if (updateParts.length === 0) {
      return res.status(500).json({ success: false, message: "Unable to complete this disposal write-off." });
    }

    const placeholders = lineIds.map(() => "?").join(", ");
    await pool.execute(
      `UPDATE item_disposals SET ${updateParts.join(", ")} WHERE id IN (${placeholders})`,
      [...updateValues, ...lineIds]
    );

    const itemColumns = await ensureInventoryItemsColumns();
    const itemIdColumn = getItemIdColumn(itemColumns);

    if (itemIdColumn && itemIds.length > 0) {
      const itemPlaceholders = itemIds.map(() => "?").join(", ");
      const itemUpdateParts = [];
      const itemUpdateValues = [];

      if (itemColumns.has("status")) {
        itemUpdateParts.push("status = ?");
        itemUpdateValues.push("disposed");
      }

      if (itemColumns.has("remarks")) {
        itemUpdateParts.push(
          `remarks = TRIM(CONCAT(COALESCE(remarks, ''), CASE WHEN COALESCE(remarks, '') = '' THEN '' ELSE '\\n' END, ?))`
        );
        itemUpdateValues.push(`Written off via disposal #${disposalId}.`);
      }

      if (itemUpdateParts.length > 0) {
        await pool.execute(
          `UPDATE ${DB_ITEMS_TABLE} SET ${itemUpdateParts.join(", ")} WHERE ${itemIdColumn} IN (${itemPlaceholders})`,
          [...itemUpdateValues, ...itemIds]
        );
      }
    }

    return res.json({
      success: true,
      message: "Item(s) written off and removed from active inventory.",
      approvalStatus: "completed",
      disposalIds: lineIds,
      writtenOffItemIds: itemIds,
    });
  })
);

app.post(
  "/api/item-disposals/:id/reject",
  withDatabase(async (req, res) => {
    const requestId = Number(req.params.id);
    const approverRole = normalizeRoleForStorage(req.body?.approverRole || "registrar");
    const reason = String(req.body?.reason || "Rejected by Registrar").trim();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: "A valid disposal id is required." });
    }

    if (approverRole !== "registrar") {
      return res.status(400).json({ success: false, message: "Only registrar rejection is supported for disposals." });
    }

    const result = await rejectTransferDisposalByRegistrar({
      tableName: "item_disposals",
      ensureColumns: ensureItemDisposalsWorkflow,
      requestId,
      reason,
      rejectedStatus: "rejected",
    });

    return res.status(result.status).json(result.body);
  })
);

const buildRepairBatchMatchParts = (columns, alias = "ir") => {
  const parts = [
    `${alias}.inventory_id = anchor.inventory_id`,
    `COALESCE(${alias}.fault_description, '') = COALESCE(anchor.fault_description, '')`,
  ];

  if (columns.has("initiated_by_id")) {
    parts.push(
      `((anchor.initiated_by_id IS NULL AND ${alias}.initiated_by_id IS NULL) OR ${alias}.initiated_by_id = anchor.initiated_by_id)`
    );
  }

  if (columns.has("repair_date")) {
    parts.push(
      `((anchor.repair_date IS NULL AND ${alias}.repair_date IS NULL) OR DATE(${alias}.repair_date) = DATE(anchor.repair_date))`
    );
  }

  return parts;
};

const fetchRepairBatchLineIds = async (repairId, columns) => {
  const batchMatchParts = buildRepairBatchMatchParts(columns);
  const [lineRows] = await pool.execute(
    `
      SELECT ir.id
      FROM item_repairs anchor
      INNER JOIN item_repairs ir ON ${batchMatchParts.join(" AND ")}
      WHERE anchor.id = ?
      ORDER BY ir.id ASC
    `,
    [repairId]
  );

  return lineRows.map((row) => row.id).filter(Boolean);
};

const buildWarrantyClaimBatchMatchParts = (columns, alias = "wc") => {
  const parts = [
    `${alias}.inventory_id = anchor.inventory_id`,
    `COALESCE(${alias}.fault_description, '') = COALESCE(anchor.fault_description, '')`,
  ];

  if (columns.has("initiated_by_id")) {
    parts.push(
      `((anchor.initiated_by_id IS NULL AND ${alias}.initiated_by_id IS NULL) OR ${alias}.initiated_by_id = anchor.initiated_by_id)`
    );
  }

  if (columns.has("claim_date")) {
    parts.push(
      `((anchor.claim_date IS NULL AND ${alias}.claim_date IS NULL) OR DATE(${alias}.claim_date) = DATE(anchor.claim_date))`
    );
  }

  return parts;
};

const validateInventoryOfficerForInventory = async (inventoryId, initiatedById) => {
  const inventoryColumns = await ensureInventoriesLocationColumn();
  const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
  const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

  if (!inventoryIdColumn || !inventoryInchargeColumn) {
    return { ok: false, status: 500, message: "Inventory schema is missing required columns." };
  }

  const [inventoryRows] = await pool.execute(
    `SELECT ${inventoryIdColumn} AS inventory_id, ${inventoryInchargeColumn} AS incharge_id FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
    [inventoryId]
  );

  if (inventoryRows.length === 0) {
    return { ok: false, status: 404, message: "Inventory was not found." };
  }

  if (String(inventoryRows[0]?.incharge_id ?? "") !== String(initiatedById)) {
    return {
      ok: false,
      status: 403,
      message: "You can only initiate requests from inventories assigned to you.",
    };
  }

  return { ok: true, inventoryColumns };
};

app.get(
  "/api/item-repairs",
  withDatabase(async (req, res) => {
    const columns = await ensureItemRepairsWorkflow();
    if (!columns) {
      return res.json({ success: true, repairs: [] });
    }

    const schema = await getAuthSchema();
    const inventoryOfficerUserId = Number(
      req.query?.inventoryOfficerUserId ?? req.query?.inventory_officer_user_id ?? 0
    );
    const repairScope = String(req.query?.repairScope ?? "all").trim().toLowerCase();
    const hasInventoryOfficerFilter = Number.isInteger(inventoryOfficerUserId) && inventoryOfficerUserId > 0;
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const itemNameExpr = buildItemNameExpression(itemColumns);
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const itemJoin = tableNames.has(DB_ITEMS_TABLE) ? buildItemAliasJoin(itemColumns, "ir.item_id") : "";
    const params = [];
    const whereParts = [];

    if (hasInventoryOfficerFilter) {
      const inventoryColumns = await ensureInventoriesLocationColumn();
      const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
      const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

      if (inventoryIdColumn && inventoryInchargeColumn) {
        const officerInventorySubquery = `(SELECT inv.${inventoryIdColumn} FROM inventories inv WHERE inv.${inventoryInchargeColumn} = ?)`;
        whereParts.push(`ir.inventory_id IN ${officerInventorySubquery}`);
        params.push(inventoryOfficerUserId);

        if (repairScope === "pending") {
          whereParts.push("LOWER(COALESCE(ir.status, '')) NOT IN ('completed', 'cancelled')");
        } else if (repairScope === "completed") {
          whereParts.push("LOWER(COALESCE(ir.status, '')) = 'completed'");
        }
      }
    }

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryNameSelect = buildInventoryAliasNameSelect("inv", inventoryColumns, "inventory_name");
    const inventoryJoin = buildInventoryAliasJoin("inv", inventoryColumns, "ir.inventory_id");
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const repairDateCol = columns.has("repair_date") ? "ir.repair_date" : "ir.created_date";
    const itemNameSelect = tableNames.has(DB_ITEMS_TABLE) ? `${itemNameExpr} AS item_name` : "CAST(ir.item_id AS CHAR) AS item_name";

    const [rows] = await pool.execute(
      `
        SELECT
          ir.id,
          ir.item_id,
          ${itemNameSelect},
          ${inventoryNameSelect},
          ir.quantity,
          ir.fault_description,
          ${columns.has("repair_notes") ? "ir.repair_notes" : "NULL AS repair_notes"},
          ir.status,
          ${repairDateCol} AS repair_date,
          initiator.${userNameColumn} AS initiated_by_name
        FROM item_repairs ir
        ${itemJoin}
        ${inventoryJoin}
        LEFT JOIN users initiator ON initiator.${userIdColumn} = ir.initiated_by_id
        ${whereClause}
        ORDER BY ${repairDateCol} DESC, ir.id DESC
      `,
      params
    );

    return res.json({
      success: true,
      repairs: rows.map((row) => ({
        id: row.id,
        itemId: row.item_id,
        itemName: row.item_name || `Item #${row.item_id}`,
        inventory: row.inventory_name || "-",
        quantity: row.quantity ?? 1,
        faultDescription: row.fault_description || "",
        repairNotes: row.repair_notes || "",
        status: row.status || "submitted",
        repairDate: row.repair_date ? new Date(row.repair_date).toISOString().split("T")[0] : "",
        initiatedBy: row.initiated_by_name || "-",
      })),
    });
  })
);

app.get(
  "/api/item-repairs/:id",
  withDatabase(async (req, res) => {
    const repairId = Number(req.params.id);
    const columns = await ensureItemRepairsWorkflow();
    if (!columns || !Number.isInteger(repairId) || repairId <= 0) {
      return res.status(404).json({ success: false, message: "Repair request was not found." });
    }

    const schema = await getAuthSchema();
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const itemIdColumn = itemColumns.size > 0 ? getItemIdColumn(itemColumns) : null;
    const userNameColumn = getUserNameColumn(schema);
    const userIdColumn = getUserPrimaryKeyColumn(schema);
    const repairDateCol = columns.has("repair_date") ? "repair_date" : "created_date";
    const mobileNoColumn = schema.userColumns.has("mobile_no") ? "mobile_no" : null;
    const officeExtColumn = schema.userColumns.has("off_ext") ? "off_ext" : null;

    const [anchorRows] = await pool.execute(
      `
        SELECT
          ir.id,
          ir.item_id,
          ir.inventory_id,
          ir.quantity,
          ir.fault_description,
          ${columns.has("repair_notes") ? "ir.repair_notes" : "NULL AS repair_notes"},
          ${columns.has("contact_person_user_id") ? "ir.contact_person_user_id" : "NULL AS contact_person_user_id"},
          ir.status,
          ir.${repairDateCol} AS repair_date,
          ${columns.has("initiated_by_id") ? "ir.initiated_by_id" : "NULL AS initiated_by_id"},
          initiator.${userNameColumn} AS initiated_by_name,
          ${mobileNoColumn ? `initiator.${mobileNoColumn}` : "NULL"} AS initiated_by_mobile,
          ${officeExtColumn ? `initiator.${officeExtColumn}` : "NULL"} AS initiated_by_extension,
          ${columns.has("contact_person_user_id") ? `contact.${userNameColumn} AS contact_person_name` : "NULL AS contact_person_name"},
          ${columns.has("contact_person_user_id") && officeExtColumn ? `contact.${officeExtColumn} AS contact_person_extension` : "NULL AS contact_person_extension"}
        FROM item_repairs ir
        LEFT JOIN users initiator ON initiator.${userIdColumn} = ir.initiated_by_id
        ${columns.has("contact_person_user_id") ? `LEFT JOIN users contact ON contact.${userIdColumn} = ir.contact_person_user_id` : ""}
        WHERE ir.id = ?
        LIMIT 1
      `,
      [repairId]
    );

    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Repair request was not found." });
    }

    const anchor = anchorRows[0];
    const batchMatchParts = buildRepairBatchMatchParts(columns);
    const [lineRows] = await pool.execute(
      `
        SELECT ir.id, ir.item_id, ir.quantity, ir.status
        FROM item_repairs anchor
        INNER JOIN item_repairs ir ON ${batchMatchParts.join(" AND ")}
        WHERE anchor.id = ?
        ORDER BY ir.id ASC
      `,
      [repairId]
    );

    const itemIds = [...new Set(lineRows.map((row) => row.item_id).filter(Boolean))];
    const itemMap = new Map();

    if (itemIds.length > 0 && itemIdColumn && tableNames.has(DB_ITEMS_TABLE)) {
      const placeholders = itemIds.map(() => "?").join(", ");
      const [itemRows] = await pool.execute(
        `SELECT * FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} IN (${placeholders})`,
        itemIds
      );
      itemRows.forEach((row) => {
        const normalized = normalizeItemRow(row);
        itemMap.set(Number(normalized.id), normalized);
      });
    }

    const formItems = [];
    const lineItems = lineRows.map((row) => {
      const itemDetail = itemMap.get(Number(row.item_id)) || null;
      const quantity = Number(row.quantity) || 1;

      if (itemDetail) {
        for (let index = 0; index < quantity; index += 1) {
          formItems.push({
            id: itemDetail.id,
            itemName: itemDetail.itemName || itemDetail.item_name || "",
            itemCode: itemDetail.itemCode || itemDetail.item_code || "",
            serialNo: itemDetail.serialNo || itemDetail.serial_no || "",
            model: itemDetail.model || "",
            brand: itemDetail.brand || itemDetail.manufacturer || "",
            value: itemDetail.value ?? "",
            ginNo: itemDetail.ginNo || itemDetail.gin_no || "",
            poNo: itemDetail.poNo || itemDetail.po_no || "",
            pageno: itemDetail.pageno || itemDetail.page_no || itemDetail.pageNo || "",
            purchaseDate: itemDetail.purchaseDate || itemDetail.purchase_date || "",
            warranty: itemDetail.warranty || "",
            supplier: itemDetail.supplier || "",
          });
        }
      }

      return {
        repairLineId: row.id,
        itemId: row.item_id,
        itemName: itemDetail?.itemName || itemDetail?.item_name || `Item #${row.item_id}`,
        quantity,
        status: row.status || "submitted",
      };
    });

    const inventoryId = Number(anchor.inventory_id ?? 0);
    const sourceInventory = await fetchInventoryPartyDetails(inventoryId, inventoryColumns, schema);
    const inventoryLocationMap = await getInventoryLocationMapByIncharge();
    const contactPersonLocation = resolveUserLocation(
      inventoryLocationMap,
      anchor.contact_person_user_id
    );

    return res.json({
      success: true,
      repair: {
        id: anchor.id,
        repairIds: lineRows.map((row) => row.id),
        inventoryId,
        inventory: sourceInventory,
        faultDescription: anchor.fault_description || "",
        repairNotes: anchor.repair_notes || "",
        contactPersonUserId: anchor.contact_person_user_id ?? null,
        contactPersonName: anchor.contact_person_name || "",
        contactPersonExtension: anchor.contact_person_extension ?? "",
        contactPersonLocation,
        officerMobileNo: anchor.initiated_by_mobile ?? "",
        officerExtensionNo: anchor.initiated_by_extension ?? "",
        status: anchor.status || "submitted",
        repairDate: anchor.repair_date ? new Date(anchor.repair_date).toISOString().split("T")[0] : "",
        initiatedById: anchor.initiated_by_id ?? null,
        initiatedBy: anchor.initiated_by_name || "-",
        items: lineItems,
        formItems,
      },
    });
  })
);

app.post(
  "/api/item-repairs",
  withDatabase(async (req, res) => {
    const columns = await ensureItemRepairsWorkflow();
    if (!columns) {
      return res.status(500).json({ success: false, message: "Item repairs table is not available." });
    }

    const initiatedById = Number(req.body?.initiatedById ?? req.body?.initiated_by_id ?? 0);
    const inventoryId = Number(req.body?.inventoryId ?? req.body?.inventory_id ?? 0);
    const faultDescription = String(req.body?.faultDescription ?? req.body?.fault_description ?? "").trim();
    const repairNotes = String(req.body?.repairNotes ?? req.body?.repair_notes ?? "").trim();
    const repairDateInput = String(req.body?.repairDate ?? req.body?.repair_date ?? "").trim();
    const repairDate = repairDateInput || new Date().toISOString().split("T")[0];
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!Number.isInteger(initiatedById) || initiatedById <= 0) {
      return res.status(400).json({ success: false, message: "A valid initiating user is required." });
    }
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return res.status(400).json({ success: false, message: "Please select an inventory." });
    }
    if (!faultDescription) {
      return res.status(400).json({ success: false, message: "Nature of damage is required." });
    }
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: "Select at least one item to repair." });
    }

    const contactPersonUserId = Number(req.body?.contactPersonUserId ?? req.body?.contact_person_user_id ?? 0);
    const hasContactPerson = Number.isInteger(contactPersonUserId) && contactPersonUserId > 0;

    if (!hasContactPerson) {
      return res.status(400).json({ success: false, message: "Please select a contact person from your department." });
    }

    const officerCheck = await validateInventoryOfficerForInventory(inventoryId, initiatedById);
    if (!officerCheck.ok) {
      return res.status(officerCheck.status).json({ success: false, message: officerCheck.message });
    }

    const schema = await getAuthSchema();
    const inventoryColumns = officerCheck.inventoryColumns || (await ensureInventoriesLocationColumn());
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const departmentIdColumn = inventoryColumns.has("department_id") ? "department_id" : null;
    let inventoryDepartmentId = null;

    if (inventoryIdColumn && departmentIdColumn) {
      const [inventoryRows] = await pool.execute(
        `SELECT ${departmentIdColumn} AS department_id FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
        [inventoryId]
      );
      inventoryDepartmentId = inventoryRows[0]?.department_id ?? null;
    }

    const userIdColumn = getUserPrimaryKeyColumn(schema);
    const [contactRows] = await pool.execute(
      `SELECT department_id FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
      [contactPersonUserId]
    );

    if (contactRows.length === 0) {
      return res.status(400).json({ success: false, message: "Selected contact person was not found." });
    }

    if (
      inventoryDepartmentId !== null
      && String(contactRows[0]?.department_id ?? "") !== String(inventoryDepartmentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Contact person must belong to the same department as the inventory.",
      });
    }

    const requestedItemIds = items
      .map((entry) => Number(entry?.itemId ?? entry?.item_id ?? 0))
      .filter((itemId) => Number.isInteger(itemId) && itemId > 0);

    const [transferLockMap, disposalLockMap, repairLockMap, warrantyClaimLockMap] = await Promise.all([
      getTransferLockMapForInventory(inventoryId, requestedItemIds),
      getDisposalLockMapForInventory(inventoryId, requestedItemIds),
      getRepairLockMapForInventory(inventoryId, requestedItemIds),
      getWarrantyClaimLockMapForInventory(inventoryId, requestedItemIds),
    ]);

    for (const itemId of requestedItemIds) {
      if (transferLockMap.has(itemId) || disposalLockMap.has(itemId) || repairLockMap.has(itemId) || warrantyClaimLockMap.has(itemId)) {
        return res.status(409).json({
          success: false,
          message: `Item #${itemId} is unavailable because it is already in another active workflow.`,
        });
      }
    }

    const itemColumns = await ensureInventoryItemsColumns();
    const itemIdColumn = getItemIdColumn(itemColumns);
    const itemInventoryColumn = itemColumns.has("inventory_id") ? "inventory_id" : null;
    const purchaseDateColumn = resolveDbColumn(itemColumns, ["purchase_date", "purchaseDate", "purchased_date"]);
    const warrantyColumn = resolveDbColumn(itemColumns, ["warranty"]);
    const createdAtColumn = resolveDbColumn(itemColumns, ["created_at", "createdAt"]);

    if (!itemIdColumn || !itemInventoryColumn) {
      return res.status(500).json({ success: false, message: "Inventory item schema is missing required columns." });
    }

    const createdRepairs = [];

    for (const entry of items) {
      const itemId = Number(entry?.itemId ?? entry?.item_id ?? 0);
      const quantity = Number(entry?.quantity ?? 1);

      if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: "Each repair entry must include a valid item id and quantity." });
      }

      const selectParts = [`${itemIdColumn} AS id`, `${itemInventoryColumn} AS inventory_id`];
      if (purchaseDateColumn) selectParts.push(`${purchaseDateColumn} AS purchase_date`);
      if (itemColumns.has("purchased_date") && purchaseDateColumn !== "purchased_date") {
        selectParts.push("purchased_date");
      }
      if (warrantyColumn) selectParts.push(`${warrantyColumn} AS warranty`);
      if (createdAtColumn) selectParts.push(`${createdAtColumn} AS created_at`);

      const [itemRows] = await pool.execute(
        `SELECT ${selectParts.join(", ")} FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} = ? LIMIT 1`,
        [itemId]
      );

      if (itemRows.length === 0) {
        return res.status(404).json({ success: false, message: `Item #${itemId} was not found.` });
      }

      if (Number(itemRows[0]?.inventory_id ?? 0) !== inventoryId) {
        return res.status(400).json({ success: false, message: `Item #${itemId} does not belong to the selected inventory.` });
      }

      if (isItemInWarrantyPeriod(itemRows[0], itemRows[0]?.warranty)) {
        return res.status(400).json({
          success: false,
          message: `Item #${itemId} is still under warranty. Submit a warranty claim instead.`,
        });
      }

      const insertColumns = ["item_id", "inventory_id", "quantity", "fault_description", "status"];
      const insertValues = [itemId, inventoryId, quantity, faultDescription, "submitted"];

      if (columns.has("repair_notes")) {
        insertColumns.push("repair_notes");
        insertValues.push(repairNotes);
      }
      if (columns.has("repair_date")) {
        insertColumns.push("repair_date");
        insertValues.push(repairDate);
      }
      if (columns.has("initiated_by_id")) {
        insertColumns.push("initiated_by_id");
        insertValues.push(initiatedById);
      }
      if (columns.has("contact_person_user_id") && hasContactPerson) {
        insertColumns.push("contact_person_user_id");
        insertValues.push(contactPersonUserId);
      }
      if (columns.has("created_date")) {
        insertColumns.push("created_date");
        insertValues.push(new Date());
      }

      const placeholders = insertColumns.map(() => "?").join(", ");
      const [result] = await pool.execute(
        `INSERT INTO item_repairs (${insertColumns.join(", ")}) VALUES (${placeholders})`,
        insertValues
      );

      createdRepairs.push({ id: result.insertId, itemId, quantity });
    }

    return res.status(201).json({
      success: true,
      message: `${createdRepairs.length} repair request${createdRepairs.length === 1 ? "" : "s"} submitted successfully.`,
      repairs: createdRepairs,
    });
  })
);

app.patch(
  "/api/item-repairs/:id",
  withDatabase(async (req, res) => {
    const repairId = Number(req.params.id);
    const columns = await ensureItemRepairsWorkflow();
    if (!columns || !Number.isInteger(repairId) || repairId <= 0) {
      return res.status(404).json({ success: false, message: "Repair request was not found." });
    }

    const faultDescription = String(req.body?.faultDescription ?? req.body?.fault_description ?? "").trim();
    const repairNotes = String(req.body?.repairNotes ?? req.body?.repair_notes ?? "").trim();
    const contactPersonUserId = Number(req.body?.contactPersonUserId ?? req.body?.contact_person_user_id ?? 0);
    const officerUserId = Number(req.body?.officerUserId ?? req.body?.officer_user_id ?? 0);

    if (!faultDescription) {
      return res.status(400).json({ success: false, message: "Nature of damage is required." });
    }

    if (!Number.isInteger(contactPersonUserId) || contactPersonUserId <= 0) {
      return res.status(400).json({ success: false, message: "Please select a contact person from your department." });
    }

    const [anchorRows] = await pool.execute("SELECT * FROM item_repairs WHERE id = ? LIMIT 1", [repairId]);
    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Repair request was not found." });
    }

    const anchor = anchorRows[0];
    const inventoryId = Number(anchor.inventory_id ?? 0);
    const initiatedById = Number(anchor.initiated_by_id ?? 0);

    if (Number.isInteger(officerUserId) && officerUserId > 0 && initiatedById !== officerUserId) {
      return res.status(403).json({
        success: false,
        message: "You can only update repair requests that you initiated.",
      });
    }

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
    const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);
    const departmentIdColumn = inventoryColumns.has("department_id") ? "department_id" : null;

    if (inventoryIdColumn && inventoryInchargeColumn && Number.isInteger(officerUserId) && officerUserId > 0) {
      const [inventoryRows] = await pool.execute(
        `SELECT ${inventoryInchargeColumn} AS incharge_id FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
        [inventoryId]
      );
      if (String(inventoryRows[0]?.incharge_id ?? "") !== String(officerUserId)) {
        return res.status(403).json({
          success: false,
          message: "You can only update repair requests for inventories assigned to you.",
        });
      }
    }

    const schema = await getAuthSchema();
    let inventoryDepartmentId = null;

    if (inventoryIdColumn && departmentIdColumn) {
      const [inventoryRows] = await pool.execute(
        `SELECT ${departmentIdColumn} AS department_id FROM inventories WHERE ${inventoryIdColumn} = ? LIMIT 1`,
        [inventoryId]
      );
      inventoryDepartmentId = inventoryRows[0]?.department_id ?? null;
    }

    const userIdColumn = getUserPrimaryKeyColumn(schema);
    const [contactRows] = await pool.execute(
      `SELECT department_id FROM users WHERE ${userIdColumn} = ? LIMIT 1`,
      [contactPersonUserId]
    );

    if (contactRows.length === 0) {
      return res.status(400).json({ success: false, message: "Selected contact person was not found." });
    }

    if (
      inventoryDepartmentId !== null
      && String(contactRows[0]?.department_id ?? "") !== String(inventoryDepartmentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Contact person must belong to the same department as the inventory.",
      });
    }

    const lineIds = await fetchRepairBatchLineIds(repairId, columns);
    if (lineIds.length === 0) {
      return res.status(404).json({ success: false, message: "Repair request was not found." });
    }

    const updateParts = ["fault_description = ?"];
    const updateValues = [faultDescription];

    if (columns.has("repair_notes")) {
      updateParts.push("repair_notes = ?");
      updateValues.push(repairNotes);
    }

    if (columns.has("contact_person_user_id")) {
      updateParts.push("contact_person_user_id = ?");
      updateValues.push(contactPersonUserId);
    }

    const placeholders = lineIds.map(() => "?").join(", ");
    await pool.execute(
      `UPDATE item_repairs SET ${updateParts.join(", ")} WHERE id IN (${placeholders})`,
      [...updateValues, ...lineIds]
    );

    return res.json({
      success: true,
      message: "Repair details saved. You can now generate the official repair form.",
    });
  })
);

app.get(
  "/api/warranty-claims",
  withDatabase(async (req, res) => {
    const columns = await ensureWarrantyClaimsWorkflow();
    if (!columns) {
      return res.json({ success: true, claims: [] });
    }

    const claimItemIdColumn = getWarrantyClaimItemIdColumn(columns);
    const claimIdColumn = getWarrantyClaimIdColumn(columns);
    const claimInventoryIdColumn = getWarrantyClaimInventoryIdColumn(columns);
    if (!isWarrantyClaimSchemaQueryable(columns)) {
      return res.status(500).json({
        success: false,
        message: "Warranty claims schema is missing required columns.",
      });
    }

    const schema = await getAuthSchema();
    const inventoryOfficerUserId = Number(
      req.query?.inventoryOfficerUserId ?? req.query?.inventory_officer_user_id ?? 0
    );
    const claimScope = String(req.query?.claimScope ?? "all").trim().toLowerCase();
    const hasInventoryOfficerFilter = Number.isInteger(inventoryOfficerUserId) && inventoryOfficerUserId > 0;
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const itemNameExpr = buildItemNameExpression(itemColumns);
    const userNameColumn = schema.userColumns.has("name") ? "name" : "full_name";
    const userIdColumn = schema.userColumns.has("id") ? "id" : "user_id";
    const itemJoin = tableNames.has(DB_ITEMS_TABLE)
      ? buildItemAliasJoin(itemColumns, `wc.${claimItemIdColumn}`)
      : "";
    const params = [];
    const whereParts = [];

    if (hasInventoryOfficerFilter) {
      const inventoryColumns = await ensureInventoriesLocationColumn();
      const inventoryIdColumn = getInventoryIdColumn(inventoryColumns);
      const inventoryInchargeColumn = getInventoryInchargeColumn(inventoryColumns);

      if (inventoryIdColumn && inventoryInchargeColumn) {
        const officerInventorySubquery = `(SELECT inv.${inventoryIdColumn} FROM inventories inv WHERE inv.${inventoryInchargeColumn} = ?)`;
        whereParts.push(`wc.${claimInventoryIdColumn} IN ${officerInventorySubquery}`);
        params.push(inventoryOfficerUserId);

        if (claimScope === "pending") {
          whereParts.push("LOWER(COALESCE(wc.status, '')) NOT IN ('completed', 'cancelled')");
        } else if (claimScope === "completed") {
          whereParts.push("LOWER(COALESCE(wc.status, '')) = 'completed'");
        }
      }
    }

    const inventoryColumns = await ensureInventoriesLocationColumn();
    const inventoryNameSelect = buildInventoryAliasNameSelect("inv", inventoryColumns, "inventory_name");
    const inventoryJoin = buildInventoryAliasJoin("inv", inventoryColumns, `wc.${claimInventoryIdColumn}`);
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const claimDateCol = columns.has("claim_date") ? "wc.claim_date" : "wc.created_date";
    const itemNameSelect = tableNames.has(DB_ITEMS_TABLE)
      ? `${itemNameExpr} AS item_name`
      : `CAST(wc.${claimItemIdColumn} AS CHAR) AS item_name`;

    const [rows] = await pool.execute(
      `
        SELECT
          wc.${claimIdColumn} AS id,
          wc.${claimItemIdColumn} AS item_id,
          ${itemNameSelect},
          ${inventoryNameSelect},
          wc.quantity,
          wc.fault_description,
          ${columns.has("claim_notes") ? "wc.claim_notes" : "NULL AS claim_notes"},
          wc.status,
          ${claimDateCol} AS claim_date,
          initiator.${userNameColumn} AS initiated_by_name
        FROM warranty_claims wc
        ${itemJoin}
        ${inventoryJoin}
        LEFT JOIN users initiator ON initiator.${userIdColumn} = wc.initiated_by_id
        ${whereClause}
        ORDER BY ${claimDateCol} DESC, wc.${claimIdColumn} DESC
      `,
      params
    );

    return res.json({
      success: true,
      claims: rows.map((row) => ({
        id: row.id,
        itemId: row.item_id,
        itemName: row.item_name || `Item #${row.item_id}`,
        inventory: row.inventory_name || "-",
        quantity: row.quantity ?? 1,
        faultDescription: row.fault_description || "",
        claimNotes: row.claim_notes || "",
        status: row.status || "submitted",
        claimDate: row.claim_date ? new Date(row.claim_date).toISOString().split("T")[0] : "",
        initiatedBy: row.initiated_by_name || "-",
      })),
    });
  })
);

app.get(
  "/api/warranty-claims/:id",
  withDatabase(async (req, res) => {
    const claimId = Number(req.params.id);
    const columns = await ensureWarrantyClaimsWorkflow();
    if (!columns || !Number.isInteger(claimId) || claimId <= 0) {
      return res.status(404).json({ success: false, message: "Warranty claim was not found." });
    }

    const claimItemIdColumn = getWarrantyClaimItemIdColumn(columns);
    const claimIdColumn = getWarrantyClaimIdColumn(columns);
    const claimInventoryIdColumn = getWarrantyClaimInventoryIdColumn(columns);
    if (!isWarrantyClaimSchemaQueryable(columns)) {
      return res.status(500).json({
        success: false,
        message: "Warranty claims schema is missing required columns.",
      });
    }

    const schema = await getAuthSchema();
    const inventoryColumns = await ensureInventoriesLocationColumn();
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
    const itemIdColumn = itemColumns.size > 0 ? getItemIdColumn(itemColumns) : null;
    const userNameColumn = getUserNameColumn(schema);
    const userIdColumn = getUserPrimaryKeyColumn(schema);
    const claimDateCol = columns.has("claim_date") ? "claim_date" : "created_date";

    const [anchorRows] = await pool.execute(
      `
        SELECT
          wc.${claimIdColumn} AS id,
          wc.${claimItemIdColumn} AS item_id,
          wc.${claimInventoryIdColumn} AS inventory_id,
          wc.quantity,
          wc.fault_description,
          ${columns.has("claim_notes") ? "wc.claim_notes" : "NULL AS claim_notes"},
          wc.status,
          wc.${claimDateCol} AS claim_date,
          ${columns.has("initiated_by_id") ? "wc.initiated_by_id" : "NULL AS initiated_by_id"},
          initiator.${userNameColumn} AS initiated_by_name
        FROM warranty_claims wc
        LEFT JOIN users initiator ON initiator.${userIdColumn} = wc.initiated_by_id
        WHERE wc.${claimIdColumn} = ?
        LIMIT 1
      `,
      [claimId]
    );

    if (anchorRows.length === 0) {
      return res.status(404).json({ success: false, message: "Warranty claim was not found." });
    }

    const anchor = anchorRows[0];
    const batchMatchParts = buildWarrantyClaimBatchMatchParts(columns);
    const [lineRows] = await pool.execute(
      `
        SELECT wc.${claimIdColumn} AS id, wc.${claimItemIdColumn} AS item_id, wc.quantity, wc.status
        FROM warranty_claims anchor
        INNER JOIN warranty_claims wc ON ${batchMatchParts.join(" AND ")}
        WHERE anchor.${claimIdColumn} = ?
        ORDER BY wc.${claimIdColumn} ASC
      `,
      [claimId]
    );

    const itemIds = [...new Set(lineRows.map((row) => row.item_id).filter(Boolean))];
    const itemMap = new Map();

    if (itemIds.length > 0 && itemIdColumn && tableNames.has(DB_ITEMS_TABLE)) {
      const placeholders = itemIds.map(() => "?").join(", ");
      const [itemRows] = await pool.execute(
        `SELECT * FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} IN (${placeholders})`,
        itemIds
      );
      itemRows.forEach((row) => {
        const normalized = normalizeItemRow(row);
        itemMap.set(Number(normalized.id), normalized);
      });
    }

    const formItems = [];
    const lineItems = lineRows.map((row) => {
      const itemDetail = itemMap.get(Number(row.item_id)) || null;
      const quantity = Number(row.quantity) || 1;

      if (itemDetail) {
        for (let index = 0; index < quantity; index += 1) {
          formItems.push({
            id: itemDetail.id,
            itemName: itemDetail.itemName || itemDetail.item_name || "",
            itemCode: itemDetail.itemCode || itemDetail.item_code || "",
            serialNo: itemDetail.serialNo || itemDetail.serial_no || "",
            model: itemDetail.model || "",
            brand: itemDetail.brand || itemDetail.manufacturer || "",
            warranty: itemDetail.warranty || "",
            purchaseDate: itemDetail.purchaseDate || itemDetail.purchase_date || "",
            supplier: itemDetail.supplier || "",
            ginNo: itemDetail.ginNo || itemDetail.gin_no || "",
            poNo: itemDetail.poNo || itemDetail.po_no || "",
          });
        }
      }

      return {
        claimLineId: row.id,
        itemId: row.item_id,
        itemName: itemDetail?.itemName || itemDetail?.item_name || `Item #${row.item_id}`,
        quantity,
        status: row.status || "submitted",
      };
    });

    const inventoryId = Number(anchor.inventory_id ?? 0);
    const sourceInventory = await fetchInventoryPartyDetails(inventoryId, inventoryColumns, schema);

    return res.json({
      success: true,
      claim: {
        id: anchor.id,
        claimIds: lineRows.map((row) => row.id),
        inventoryId,
        inventory: sourceInventory,
        faultDescription: anchor.fault_description || "",
        claimNotes: anchor.claim_notes || "",
        status: anchor.status || "submitted",
        claimDate: anchor.claim_date ? new Date(anchor.claim_date).toISOString().split("T")[0] : "",
        initiatedById: anchor.initiated_by_id ?? null,
        initiatedBy: anchor.initiated_by_name || "-",
        items: lineItems,
        formItems,
      },
    });
  })
);

app.post(
  "/api/warranty-claims",
  withDatabase(async (req, res) => {
    const columns = await ensureWarrantyClaimsWorkflow();
    if (!columns) {
      return res.status(500).json({ success: false, message: "Warranty claims table is not available." });
    }

    const claimItemIdColumn = getWarrantyClaimItemIdColumn(columns);
    if (!isWarrantyClaimSchemaQueryable(columns)) {
      return res.status(500).json({
        success: false,
        message: "Warranty claims schema is missing required columns.",
      });
    }

    const initiatedById = Number(req.body?.initiatedById ?? req.body?.initiated_by_id ?? 0);
    const inventoryId = Number(req.body?.inventoryId ?? req.body?.inventory_id ?? 0);
    const faultDescription = String(req.body?.faultDescription ?? req.body?.fault_description ?? "").trim();
    const claimNotes = String(req.body?.claimNotes ?? req.body?.claim_notes ?? "").trim();
    const claimDateInput = String(req.body?.claimDate ?? req.body?.claim_date ?? "").trim();
    const claimDate = claimDateInput || new Date().toISOString().split("T")[0];
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!Number.isInteger(initiatedById) || initiatedById <= 0) {
      return res.status(400).json({ success: false, message: "A valid initiating user is required." });
    }
    if (!Number.isInteger(inventoryId) || inventoryId <= 0) {
      return res.status(400).json({ success: false, message: "Please select an inventory." });
    }
    if (!faultDescription) {
      return res.status(400).json({ success: false, message: "Fault description is required." });
    }
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: "Select at least one item for the warranty claim." });
    }

    const officerCheck = await validateInventoryOfficerForInventory(inventoryId, initiatedById);
    if (!officerCheck.ok) {
      return res.status(officerCheck.status).json({ success: false, message: officerCheck.message });
    }

    const requestedItemIds = items
      .map((entry) => Number(entry?.itemId ?? entry?.item_id ?? 0))
      .filter((itemId) => Number.isInteger(itemId) && itemId > 0);

    const [transferLockMap, disposalLockMap, repairLockMap, warrantyClaimLockMap] = await Promise.all([
      getTransferLockMapForInventory(inventoryId, requestedItemIds),
      getDisposalLockMapForInventory(inventoryId, requestedItemIds),
      getRepairLockMapForInventory(inventoryId, requestedItemIds),
      getWarrantyClaimLockMapForInventory(inventoryId, requestedItemIds),
    ]);

    for (const itemId of requestedItemIds) {
      if (transferLockMap.has(itemId) || disposalLockMap.has(itemId) || repairLockMap.has(itemId) || warrantyClaimLockMap.has(itemId)) {
        return res.status(409).json({
          success: false,
          message: `Item #${itemId} is unavailable because it is already in another active workflow.`,
        });
      }
    }

    const itemColumns = await ensureInventoryItemsColumns();
    const itemIdColumn = getItemIdColumn(itemColumns);
    const itemInventoryColumn = itemColumns.has("inventory_id") ? "inventory_id" : null;
    const purchaseDateColumn = resolveDbColumn(itemColumns, ["purchase_date", "purchaseDate", "purchased_date"]);
    const warrantyColumn = resolveDbColumn(itemColumns, ["warranty"]);
    const createdAtColumn = resolveDbColumn(itemColumns, ["created_at", "createdAt"]);

    if (!itemIdColumn || !itemInventoryColumn) {
      return res.status(500).json({ success: false, message: "Inventory item schema is missing required columns." });
    }

    const createdClaims = [];

    for (const entry of items) {
      const itemId = Number(entry?.itemId ?? entry?.item_id ?? 0);
      const quantity = Number(entry?.quantity ?? 1);

      if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: "Each claim entry must include a valid item id and quantity." });
      }

      const selectParts = [`${itemIdColumn} AS id`, `${itemInventoryColumn} AS inventory_id`];
      if (purchaseDateColumn) selectParts.push(`${purchaseDateColumn} AS purchase_date`);
      if (itemColumns.has("purchased_date") && purchaseDateColumn !== "purchased_date") {
        selectParts.push("purchased_date");
      }
      if (warrantyColumn) selectParts.push(`${warrantyColumn} AS warranty`);
      if (createdAtColumn) selectParts.push(`${createdAtColumn} AS created_at`);

      const [itemRows] = await pool.execute(
        `SELECT ${selectParts.join(", ")} FROM ${DB_ITEMS_TABLE} WHERE ${itemIdColumn} = ? LIMIT 1`,
        [itemId]
      );

      if (itemRows.length === 0) {
        return res.status(404).json({ success: false, message: `Item #${itemId} was not found.` });
      }

      if (Number(itemRows[0]?.inventory_id ?? 0) !== inventoryId) {
        return res.status(400).json({ success: false, message: `Item #${itemId} does not belong to the selected inventory.` });
      }

      if (!isItemInWarrantyPeriod(itemRows[0], itemRows[0]?.warranty)) {
        return res.status(400).json({
          success: false,
          message: `Item #${itemId} is not within the warranty period. Submit a repair request instead.`,
        });
      }

      const insertColumns = [claimItemIdColumn, "inventory_id", "quantity", "fault_description", "status"];
      const insertValues = [itemId, inventoryId, quantity, faultDescription, "submitted"];

      if (columns.has("claim_notes")) {
        insertColumns.push("claim_notes");
        insertValues.push(claimNotes);
      }
      if (columns.has("claim_date")) {
        insertColumns.push("claim_date");
        insertValues.push(claimDate);
      }
      if (columns.has("initiated_by_id")) {
        insertColumns.push("initiated_by_id");
        insertValues.push(initiatedById);
      }
      if (columns.has("created_date")) {
        insertColumns.push("created_date");
        insertValues.push(new Date());
      }

      const placeholders = insertColumns.map(() => "?").join(", ");
      const [result] = await pool.execute(
        `INSERT INTO warranty_claims (${insertColumns.join(", ")}) VALUES (${placeholders})`,
        insertValues
      );

      createdClaims.push({ id: result.insertId, itemId, quantity });
    }

    return res.status(201).json({
      success: true,
      message: `${createdClaims.length} warranty claim${createdClaims.length === 1 ? "" : "s"} submitted. Print the letter to Supplies Division.`,
      claims: createdClaims,
    });
  })
);

app.get(
  "/api/registrar/dashboard",
  withDatabase(async (req, res) => {
    const safeHistoryLimit = Math.min(Math.max(parseInt(String(req.query.limit || 50), 10) || 50, 1), 100);
    const schema = await getAuthSchema();
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = new Set(tableRows.map((row) => Object.values(row)[0]));
    const history = [];

    let pendingInventory = 0;
    let pendingTransfers = 0;
    let pendingDisposals = 0;

    let inventoryRequestColumns = null;
    if (tableNames.has("inventory_creation_requests")) {
      await ensureInventoryCreationRequestsTable();
      inventoryRequestColumns = await getTableColumns("inventory_creation_requests");
    }

    if (inventoryRequestColumns) {
      const requestTypeCol = inventoryRequestColumns.has("request_type") ? "request_type" : null;
      const statusCol = inventoryRequestColumns.has("approval_status") ? "approval_status" : null;
      const nameCol = inventoryRequestColumns.has("name") ? "name" : null;
      const deptCol = inventoryRequestColumns.has("department_id") ? "department_id" : null;
      const registrarDateCol = inventoryRequestColumns.has("registrar_approved_date")
        ? "registrar_approved_date"
        : null;
      const rejectionDateCol = inventoryRequestColumns.has("rejection_date") ? "rejection_date" : null;
      const rejectionReasonCol = inventoryRequestColumns.has("rejection_reason") ? "rejection_reason" : null;
      const hodDateCol = inventoryRequestColumns.has("hod_approved_date") ? "hod_approved_date" : null;
      const inventoryRequestIdColumn = getInventoryRequestPrimaryKeyColumn(inventoryRequestColumns);

      if (statusCol && requestTypeCol) {
        const [pendingRows] = await pool.execute(
          `
            SELECT COUNT(*) AS count
            FROM inventory_creation_requests
            WHERE LOWER(COALESCE(${statusCol}, '')) = ?
              AND LOWER(COALESCE(${requestTypeCol}, '')) = ?
          `,
          ["pending_registrar", "new_inventory_creation"]
        );
        pendingInventory = Number(pendingRows[0]?.count ?? 0);
      }

      const departmentJoinIdColumn = schema.departmentColumns.has("id") ? "id" : "department_id";
      const departmentNameColumn = schema.departmentColumns.has("name")
        ? "d.name"
        : schema.departmentColumns.has("department_name")
          ? "d.department_name"
          : "NULL";
      const departmentJoin =
        schema.hasDepartmentsTable && deptCol
          ? `LEFT JOIN departments d ON d.${departmentJoinIdColumn} = icr.${deptCol}`
          : "";
      const departmentSelect = schema.hasDepartmentsTable
        ? `${departmentNameColumn} AS department_name`
        : "NULL AS department_name";

      if (registrarDateCol && nameCol) {
        const [approvedRows] = await pool.execute(
          `
            SELECT
              icr.${inventoryRequestIdColumn} AS id,
              icr.${nameCol} AS title,
              ${departmentSelect},
              icr.${registrarDateCol} AS processed_at
            FROM inventory_creation_requests icr
            ${departmentJoin}
            WHERE icr.${registrarDateCol} IS NOT NULL
            ORDER BY icr.${registrarDateCol} DESC
            LIMIT ${safeHistoryLimit}
          `
        );

        approvedRows.forEach((row) => {
          history.push({
            id: `inventory-approved-${row.id}`,
            requestId: row.id,
            type: "inventory_creation",
            typeLabel: "Inventory Creation",
            title: row.title || `Request #${row.id}`,
            department: row.department_name || "-",
            action: "approved",
            actionLabel: "Approved & forwarded",
            processedAt: row.processed_at,
            link: "/admin/pending-tasks",
            tab: "inventory-requests",
          });
        });
      }

      if (statusCol && nameCol && (rejectionDateCol || rejectionReasonCol)) {
        const processedAtExpr = buildProcessedAtExpression("icr", inventoryRequestColumns, [
          "rejection_date",
        ]);
        const registrarRejectCondition = rejectionReasonCol
          ? `LOWER(COALESCE(icr.${rejectionReasonCol}, '')) LIKE '%registrar%'`
          : "0 = 1";
        const hodRejectedWithoutRegistrar =
          hodDateCol && registrarDateCol
            ? `(icr.${hodDateCol} IS NOT NULL AND icr.${registrarDateCol} IS NULL)`
            : "0 = 1";

        const [rejectedRows] = await pool.execute(
          `
            SELECT
              icr.${inventoryRequestIdColumn} AS id,
              icr.${nameCol} AS title,
              ${departmentSelect},
              ${processedAtExpr} AS processed_at,
              ${rejectionReasonCol ? `icr.${rejectionReasonCol}` : "NULL"} AS rejection_reason
            FROM inventory_creation_requests icr
            ${departmentJoin}
            WHERE LOWER(COALESCE(icr.${statusCol}, '')) = 'rejected'
              AND (
                ${registrarRejectCondition}
                OR ${hodRejectedWithoutRegistrar}
              )
              ${requestTypeCol ? `AND LOWER(COALESCE(icr.${requestTypeCol}, '')) = 'new_inventory_creation'` : ""}
            ORDER BY ${processedAtExpr} DESC
            LIMIT ${safeHistoryLimit}
          `
        );

        rejectedRows.forEach((row) => {
          history.push({
            id: `inventory-rejected-${row.id}`,
            requestId: row.id,
            type: "inventory_creation",
            typeLabel: "Inventory Creation",
            title: row.title || `Request #${row.id}`,
            department: row.department_name || "-",
            action: "rejected",
            actionLabel: "Rejected",
            processedAt: row.processed_at,
            note: row.rejection_reason || "",
            link: "/admin/pending-tasks",
            tab: "inventory-requests",
          });
        });
      }
    }

    let transferColumns = await ensureItemTransfersWorkflow();
    if (transferColumns) {
      transferColumns = await getTableColumns("item_transfers");
      const transferInventoryColumns = await ensureInventoriesLocationColumn();
      const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
      const itemNameExpr = buildItemNameExpression(itemColumns);
      const itemJoin = tableNames.has(DB_ITEMS_TABLE)
        ? buildItemAliasJoin(itemColumns, "it.item_id")
        : "";
      const itemNameSelect = tableNames.has(DB_ITEMS_TABLE)
        ? `${itemNameExpr} AS item_name`
        : "CAST(it.item_id AS CHAR) AS item_name";
      const fromInventoryNameSelect = buildInventoryAliasNameSelect("fi", transferInventoryColumns, "from_inventory_name");
      const toInventoryNameSelect = buildInventoryAliasNameSelect("ti", transferInventoryColumns, "to_inventory_name");
      const fromInventoryJoin = buildInventoryTransferJoin("fi", transferInventoryColumns, "from_inventory_id");
      const toInventoryJoin = buildInventoryTransferJoin("ti", transferInventoryColumns, "to_inventory_id");

      const [pendingTransferRows] = await pool.execute(
        transferColumns.has("approval_status")
          ? `
              SELECT COUNT(*) AS count
              FROM item_transfers it
              WHERE LOWER(COALESCE(it.approval_status, '')) = 'pending_registrar'
                 OR (it.approval_status IS NULL AND LOWER(COALESCE(it.status, '')) = 'pending')
            `
          : `
              SELECT COUNT(*) AS count
              FROM item_transfers it
              WHERE LOWER(COALESCE(it.status, '')) = 'pending'
            `
      );
      pendingTransfers = Number(pendingTransferRows[0]?.count ?? 0);

      if (transferColumns.has("registrar_approved_date")) {
        const [approvedRows] = await pool.execute(
          `
            SELECT
              it.id,
              ${itemNameSelect},
              ${fromInventoryNameSelect},
              ${toInventoryNameSelect},
              it.registrar_approved_date AS processed_at
            FROM item_transfers it
            ${itemJoin}
            ${fromInventoryJoin}
            ${toInventoryJoin}
            WHERE it.registrar_approved_date IS NOT NULL
            ORDER BY it.registrar_approved_date DESC
            LIMIT ${safeHistoryLimit}
          `
        );

        approvedRows.forEach((row) => {
          history.push({
            id: `transfer-approved-${row.id}`,
            requestId: row.id,
            type: "transfer",
            typeLabel: "Item Transfer",
            title: row.item_name || `Item #${row.id}`,
            department: `${row.from_inventory_name || "-"} → ${row.to_inventory_name || "-"}`,
            action: "approved",
            actionLabel: "Approved & forwarded",
            processedAt: row.processed_at,
            link: "/admin/pending-tasks",
            tab: "transfer-requests",
          });
        });
      }

      if (transferColumns.has("rejection_reason")) {
        const [rejectedRows] = await pool.execute(
          `
            SELECT
              it.id,
              ${itemNameSelect},
              ${fromInventoryNameSelect},
              ${toInventoryNameSelect},
              ${buildProcessedAtExpression("it", transferColumns)} AS processed_at,
              it.rejection_reason
            FROM item_transfers it
            ${itemJoin}
            ${fromInventoryJoin}
            ${toInventoryJoin}
            WHERE (
              LOWER(COALESCE(it.approval_status, '')) = 'rejected'
              OR LOWER(COALESCE(it.status, '')) = 'cancelled'
            )
            AND LOWER(COALESCE(it.rejection_reason, '')) LIKE '%registrar%'
            ORDER BY processed_at DESC
            LIMIT ${safeHistoryLimit}
          `
        );

        rejectedRows.forEach((row) => {
          history.push({
            id: `transfer-rejected-${row.id}`,
            requestId: row.id,
            type: "transfer",
            typeLabel: "Item Transfer",
            title: row.item_name || `Item #${row.id}`,
            department: `${row.from_inventory_name || "-"} → ${row.to_inventory_name || "-"}`,
            action: "rejected",
            actionLabel: "Rejected",
            processedAt: row.processed_at,
            note: row.rejection_reason || "",
            link: "/admin/pending-tasks",
            tab: "transfer-requests",
          });
        });
      }
    }

    let disposalColumns = await ensureItemDisposalsWorkflow();
    if (disposalColumns) {
      disposalColumns = await getTableColumns("item_disposals");
      const disposalInventoryColumns = await ensureInventoriesLocationColumn();
      const itemColumns = tableNames.has(DB_ITEMS_TABLE) ? await getTableColumns(DB_ITEMS_TABLE) : new Set();
      const itemNameExpr = buildItemNameExpression(itemColumns);
      const itemJoin = tableNames.has(DB_ITEMS_TABLE)
        ? buildItemAliasJoin(itemColumns, "idp.item_id")
        : "";
      const itemNameSelect = tableNames.has(DB_ITEMS_TABLE)
        ? `${itemNameExpr} AS item_name`
        : "CAST(idp.item_id AS CHAR) AS item_name";
      const disposalInventoryNameSelect = buildInventoryAliasNameSelect("inv", disposalInventoryColumns, "inventory_name");
      const disposalInventoryJoin = buildInventoryAliasJoin("inv", disposalInventoryColumns, "idp.inventory_id");

      const [pendingDisposalRows] = await pool.execute(
        disposalColumns.has("approval_status")
          ? `
              SELECT COUNT(*) AS count
              FROM item_disposals idp
              WHERE LOWER(COALESCE(idp.approval_status, '')) = 'pending_registrar'
                 OR (idp.approval_status IS NULL AND LOWER(COALESCE(idp.status, '')) = 'pending')
            `
          : `
              SELECT COUNT(*) AS count
              FROM item_disposals idp
              WHERE LOWER(COALESCE(idp.status, '')) = 'pending'
            `
      );
      pendingDisposals = Number(pendingDisposalRows[0]?.count ?? 0);

      if (disposalColumns.has("registrar_approved_date")) {
        const [approvedRows] = await pool.execute(
          `
            SELECT
              idp.id,
              ${itemNameSelect},
              ${disposalInventoryNameSelect},
              idp.registrar_approved_date AS processed_at
            FROM item_disposals idp
            ${itemJoin}
            ${disposalInventoryJoin}
            WHERE idp.registrar_approved_date IS NOT NULL
            ORDER BY idp.registrar_approved_date DESC
            LIMIT ${safeHistoryLimit}
          `
        );

        approvedRows.forEach((row) => {
          history.push({
            id: `disposal-approved-${row.id}`,
            requestId: row.id,
            type: "disposal",
            typeLabel: "Item Disposal",
            title: row.item_name || `Item #${row.id}`,
            department: row.inventory_name || "-",
            action: "approved",
            actionLabel: "Approved & forwarded",
            processedAt: row.processed_at,
            link: "/admin/pending-tasks",
            tab: "disposal-requests",
          });
        });
      }

      if (disposalColumns.has("rejection_reason")) {
        const [rejectedRows] = await pool.execute(
          `
            SELECT
              idp.id,
              ${itemNameSelect},
              ${disposalInventoryNameSelect},
              ${buildProcessedAtExpression("idp", disposalColumns)} AS processed_at,
              idp.rejection_reason
            FROM item_disposals idp
            ${itemJoin}
            ${disposalInventoryJoin}
            WHERE LOWER(COALESCE(idp.approval_status, '')) = 'rejected'
              AND LOWER(COALESCE(idp.rejection_reason, '')) LIKE '%registrar%'
            ORDER BY processed_at DESC
            LIMIT ${safeHistoryLimit}
          `
        );

        rejectedRows.forEach((row) => {
          history.push({
            id: `disposal-rejected-${row.id}`,
            requestId: row.id,
            type: "disposal",
            typeLabel: "Item Disposal",
            title: row.item_name || `Item #${row.id}`,
            department: row.inventory_name || "-",
            action: "rejected",
            actionLabel: "Rejected",
            processedAt: row.processed_at,
            note: row.rejection_reason || "",
            link: "/admin/pending-tasks",
            tab: "disposal-requests",
          });
        });
      }
    }

    history.sort((left, right) => {
      const leftTime = new Date(left.processedAt || 0).getTime();
      const rightTime = new Date(right.processedAt || 0).getTime();
      return rightTime - leftTime;
    });

    const trimmedHistory = history.slice(0, safeHistoryLimit).map((entry) => ({
      ...entry,
      processedAt: entry.processedAt ? new Date(entry.processedAt).toISOString() : null,
    }));

    return res.json({
      success: true,
      summary: {
        pendingInventory,
        pendingTransfers,
        pendingDisposals,
        totalPending: pendingInventory + pendingTransfers + pendingDisposals,
        approvedCount: trimmedHistory.filter((entry) => entry.action === "approved").length,
        rejectedCount: trimmedHistory.filter((entry) => entry.action === "rejected").length,
      },
      history: trimmedHistory,
    });
  })
);

app.get(
  "/api/notifications",
  withDatabase(async (req, res) => {
    const userId = Number(req.query?.userId ?? 0);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "A valid userId is required." });
    }

    await syncWarrantyNotifications(pool, DB_ITEMS_TABLE);
    const result = await getNotificationsForUser(pool, userId);

    return res.json({
      success: true,
      notifications: result.notifications,
      unreadCount: result.unreadCount,
    });
  })
);

app.patch(
  "/api/notifications/:id/read",
  withDatabase(async (req, res) => {
    const notificationId = Number(req.params.id);
    const userId = Number(req.body?.userId ?? req.query?.userId ?? 0);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ success: false, message: "A valid notification id is required." });
    }

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "A valid userId is required." });
    }

    const updated = await markNotificationRead(pool, { notificationId, userId });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    return res.json({ success: true, message: "Notification marked as read." });
  })
);

app.patch(
  "/api/notifications/read-all",
  withDatabase(async (req, res) => {
    const userId = Number(req.body?.userId ?? req.query?.userId ?? 0);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: "A valid userId is required." });
    }

    const updatedCount = await markAllNotificationsRead(pool, userId);

    return res.json({
      success: true,
      message: "All notifications marked as read.",
      updatedCount,
    });
  })
);

app.get(
  "/api/item-identifiers/check",
  withDatabase(async (req, res) => {
    const dbColumns = await ensureInventoryItemsColumns();
    const validation = await validateItemIdentifiers(dbColumns, {
      itemCode: req.query?.itemCode,
      serialNo: req.query?.serialNo,
      serialNo2: req.query?.serialNo2,
      excludeItemId: Number(req.query?.excludeItemId ?? 0),
    });

    return res.json({
      success: true,
      valid: validation.valid,
      conflicts: validation.conflicts,
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
      await createItemRequestsTable();
      await createItemTransfersTable();
      await createInventoryItemsTable();
    }
    await ensureItemRequestsTable();
    await ensureItemTransfersWorkflow();
    await ensureItemDisposalsWorkflow();
    await ensureItemRepairsWorkflow();
    await ensureWarrantyClaimsWorkflow();
    await ensureNotificationsTable(pool);
    await ensurePasswordResetOtpsTable(pool);
    await ensureForeignKeyRelationships();
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
    console.log("Item request routes: GET/POST /api/item-requests, POST .../issue, POST .../cancel");
  });
};

startServer();
