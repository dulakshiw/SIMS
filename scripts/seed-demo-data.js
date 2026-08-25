import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const DEMO_PREFIX = "DEMO-SIMS-2026";

if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 8) {
  console.error("Set DEMO_PASSWORD to a value of at least 8 characters before running the seed.");
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sims_db",
  waitForConnections: true,
  connectionLimit: 4,
});

const quoteIdentifier = (value) => `\`${String(value).replaceAll("`", "``")}\``;
const asDate = (date) => date.toISOString().slice(0, 10);
const dateMonthsAgo = (months) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return asDate(date);
};
const dateDaysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return asDate(date);
};

const tableColumns = new Map();
const getColumns = async (connection, table) => {
  if (!tableColumns.has(table)) {
    const [rows] = await connection.query(`SHOW COLUMNS FROM ${quoteIdentifier(table)}`);
    tableColumns.set(table, new Set(rows.map((row) => row.Field)));
  }
  return tableColumns.get(table);
};

const filterRow = async (connection, table, row) => {
  const columns = await getColumns(connection, table);
  return Object.fromEntries(Object.entries(row).filter(([column, value]) => columns.has(column) && value !== undefined));
};

const insertRow = async (connection, table, row) => {
  const filtered = await filterRow(connection, table, row);
  const entries = Object.entries(filtered);
  if (!entries.length) throw new Error(`No compatible columns found for ${table}.`);
  const columns = entries.map(([column]) => quoteIdentifier(column)).join(", ");
  const placeholders = entries.map(() => "?").join(", ");
  const [result] = await connection.execute(
    `INSERT INTO ${quoteIdentifier(table)} (${columns}) VALUES (${placeholders})`,
    entries.map(([, value]) => value)
  );
  return Number(result.insertId);
};

const findBy = async (connection, table, where) => {
  const filtered = await filterRow(connection, table, where);
  const entries = Object.entries(filtered);
  if (!entries.length) return null;
  const clause = entries.map(([column]) => `${quoteIdentifier(column)} = ?`).join(" AND ");
  const [rows] = await connection.execute(
    `SELECT * FROM ${quoteIdentifier(table)} WHERE ${clause} LIMIT 1`,
    entries.map(([, value]) => value)
  );
  return rows[0] || null;
};

const insertOnce = async (connection, table, idColumn, markerColumn, marker, row) => {
  const existing = await findBy(connection, table, { [markerColumn]: marker });
  if (existing) return { id: Number(existing[idColumn]), created: false };
  return { id: await insertRow(connection, table, row), created: true };
};

const nextId = async (connection, table, idColumn) => {
  const [rows] = await connection.query(
    `SELECT COALESCE(MAX(${quoteIdentifier(idColumn)}), 0) + 1 AS next_id FROM ${quoteIdentifier(table)}`
  );
  return requireId(`${table}.${idColumn}`, rows[0]?.next_id);
};

const requireId = (label, value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`${label} did not resolve to a valid id.`);
  return id;
};

const ensureRole = async (connection, roleName) => {
  const existing = await findBy(connection, "user_roles", { user_role: roleName });
  if (existing) return requireId(`role ${roleName}`, existing.role_id);
  return requireId(`role ${roleName}`, await insertRow(connection, "user_roles", { user_role: roleName }));
};

const ensureDepartment = async (connection, department) => {
  const existing = await findBy(connection, "departments", { dept_code: department.dept_code });
  if (existing) return requireId(`department ${department.dept_code}`, existing.department_id);
  return requireId(`department ${department.dept_code}`, await insertRow(connection, "departments", department));
};

const ensureUser = async (connection, user, passwordHash, roleIds, departmentIds) => {
  const existing = await findBy(connection, "users", { email: user.email });
  if (existing) return requireId(`user ${user.email}`, existing.user_id);
  return requireId(`user ${user.email}`, await insertRow(connection, "users", {
    full_name: user.full_name,
    email: user.email,
    password: passwordHash,
    role_id: roleIds[user.role],
    department_id: departmentIds[user.department],
    mobile_no: user.mobile_no,
    status: "Active",
  }));
};

const ensureInventory = async (connection, inventory, departmentId, inchargeUserId, hodUserId) => {
  const existing = await findBy(connection, "inventories", { inventory_name: inventory.inventory_name });
  if (existing) return requireId(`inventory ${inventory.inventory_name}`, existing.inventory_id);
  return requireId(`inventory ${inventory.inventory_name}`, await insertRow(connection, "inventories", {
    inventory_name: inventory.inventory_name,
    location: inventory.location,
    department_id: departmentId,
    incharge_user_id: inchargeUserId,
    hod_user_id: hodUserId,
  }));
};

const ensureItem = async (connection, item, inventoryId) => {
  const existing = await findBy(connection, "inventory_items", { item_code: item.code });
  if (existing) return requireId(`item ${item.code}`, existing.item_id ?? existing.id);
  return requireId(`item ${item.item_code}`, await insertRow(connection, "inventory_items", {
    inventory_id: inventoryId,
    item_id: undefined,
    item_name: item.item_name,
    item_code: item.code,
    serial_no: item.serial_no,
    serial_no2: item.serial_no2,
    model: item.model,
    value: item.value,
    qr_code: item.code,
    purchased_date: item.purchased_date,
    po_no: item.po_no,
    gin_no: item.gin_no,
    supplier: item.supplier,
    warranty: item.warranty,
    funding_source: item.funding_source,
    location: item.location,
    status: item.status,
    remarks: `${item.category}; ${item.remarks}`,
    itemName: item.item_name,
    itemCode: item.code,
    serialNo: item.serial_no,
    model: item.model,
    QRCode: item.code,
    purchaseDate: item.purchased_date,
    poNo: String(item.po_no),
    ginNo: String(item.gin_no),
    funding: item.funding_source,
    receivedfrom: item.receivedfrom,
    qrcodeUrl: `http://localhost:5173/inventory/scan?q=${encodeURIComponent(item.code)}`,
  }));
};

const updateItemStatus = async (connection, itemId, status) => {
  const columns = await getColumns(connection, "inventory_items");
  if (columns.has("status")) {
    await connection.execute("UPDATE `inventory_items` SET `status` = ? WHERE `item_id` = ?", [status, itemId]);
  }
};

const main = async () => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    const roleIds = {};
    for (const role of ["admin", "registrar", "inventory_incharge", "head_of_department", "staff", "dean"]) {
      roleIds[role] = await ensureRole(connection, role);
    }

    const departmentIds = {};
    for (const department of [
      { dept_code: "DEMO-CS", department_name: "Computer Science (Demonstration)" },
      { dept_code: "DEMO-NET", department_name: "Network Engineering (Demonstration)" },
      { dept_code: "DEMO-ADMIN", department_name: "Faculty Administration (Demonstration)" },
    ]) {
      departmentIds[department.dept_code] = await ensureDepartment(connection, department);
    }

    const users = {};
    const userDefinitions = [
      { key: "admin", email: "demo.admin@sims.invalid", full_name: "Alex Morgan (Demo Administrator)", role: "admin", department: "DEMO-ADMIN", mobile_no: 5550101 },
      { key: "registrar", email: "demo.registrar@sims.invalid", full_name: "Jordan Lee (Demo Registrar)", role: "registrar", department: "DEMO-ADMIN", mobile_no: 5550102 },
      { key: "inchargeCs", email: "demo.inventory.cs@sims.invalid", full_name: "Taylor Brooks (Demo Inventory Officer)", role: "inventory_incharge", department: "DEMO-CS", mobile_no: 5550103 },
      { key: "inchargeNet", email: "demo.inventory.net@sims.invalid", full_name: "Casey Rivera (Demo Inventory Officer)", role: "inventory_incharge", department: "DEMO-NET", mobile_no: 5550104 },
      { key: "hodCs", email: "demo.hod.cs@sims.invalid", full_name: "Riley Chen (Demo CS HOD)", role: "head_of_department", department: "DEMO-CS", mobile_no: 5550105 },
      { key: "hodNet", email: "demo.hod.net@sims.invalid", full_name: "Morgan Patel (Demo Network HOD)", role: "head_of_department", department: "DEMO-NET", mobile_no: 5550106 },
      { key: "staffCs", email: "demo.staff.cs@sims.invalid", full_name: "Sam Wilson (Demo Staff Member)", role: "staff", department: "DEMO-CS", mobile_no: 5550107 },
      { key: "staffNet", email: "demo.staff.net@sims.invalid", full_name: "Jamie Park (Demo Staff Member)", role: "staff", department: "DEMO-NET", mobile_no: 5550108 },
      { key: "dean", email: "demo.dean@sims.invalid", full_name: "Avery Thompson (Demo Dean)", role: "dean", department: "DEMO-ADMIN", mobile_no: 5550109 },
    ];
    for (const user of userDefinitions) {
      users[user.key] = await ensureUser(connection, user, passwordHash, roleIds, departmentIds);
    }

    await connection.execute("UPDATE `departments` SET `dept_hod` = ? WHERE `department_id` = ?", [users.hodCs, departmentIds["DEMO-CS"]]);
    await connection.execute("UPDATE `departments` SET `dept_hod` = ? WHERE `department_id` = ?", [users.hodNet, departmentIds["DEMO-NET"]]);

    const inventories = {};
    inventories.cs = await ensureInventory(connection, { inventory_name: `${DEMO_PREFIX} CS Laboratory`, location: "Demo Science Block, Lab 201" }, departmentIds["DEMO-CS"], users.inchargeCs, users.hodCs);
    inventories.net = await ensureInventory(connection, { inventory_name: `${DEMO_PREFIX} Network Laboratory`, location: "Demo Engineering Block, Lab 305" }, departmentIds["DEMO-NET"], users.inchargeNet, users.hodNet);
    inventories.admin = await ensureInventory(connection, { inventory_name: `${DEMO_PREFIX} Faculty Administration Store`, location: "Demo Administration Block, Store 01" }, departmentIds["DEMO-ADMIN"], users.admin, users.dean);

    const itemDefinitions = [
      { key: "available", code: `${DEMO_PREFIX}-IT-001`, item_name: "Dell Latitude 7440 Laptop", category: "Computing Equipment", serial_no: "DL7440-DEMO-001", model: "Latitude 7440", value: 285000, po_no: 202601, gin_no: 910001, purchased_date: dateMonthsAgo(8), warranty: "3 Years", location: "CS Laboratory, Cabinet A1", status: "available", supplier: "Fictional Campus Technology Ltd.", funding_source: "Faculty Development Fund", receivedfrom: "Demo Procurement Office", remarks: "Within warranty; available for allocation." },
      { key: "issued", code: `${DEMO_PREFIX}-IT-002`, item_name: "HP ProDesk 600 G6 Desktop", category: "Computing Equipment", serial_no: "HP600G6-DEMO-002", model: "ProDesk 600 G6", value: 175000, po_no: 202402, gin_no: 910002, purchased_date: dateMonthsAgo(28), warranty: "3 Years", location: "CS Laboratory, Workstation 08", status: "issued", supplier: "Fictional Campus Technology Ltd.", funding_source: "Capital Fund", receivedfrom: "Demo Procurement Office", remarks: "Issued demonstration item." },
      { key: "repair", code: `${DEMO_PREFIX}-IT-003`, item_name: "Epson EB-X49 Projector", category: "Audio Visual Equipment", serial_no: "EPX49-DEMO-003", model: "EB-X49", value: 145000, po_no: 202103, gin_no: 910003, purchased_date: dateMonthsAgo(38), warranty: "2 Years", location: "CS Laboratory, Repair Shelf", status: "maintenance", supplier: "Fictional Presentation Systems Ltd.", funding_source: "Capital Fund", receivedfrom: "Demo Procurement Office", remarks: "Out of warranty; active repair demonstration." },
      { key: "transfer", code: `${DEMO_PREFIX}-IT-004`, item_name: "Cisco Catalyst 2960 Switch", category: "Networking Equipment", serial_no: "CAT2960-DEMO-004", model: "Catalyst 2960-L", value: 98000, po_no: 202507, gin_no: 910004, purchased_date: dateMonthsAgo(11), warranty: "2 Years", location: "Network Laboratory, Rack 02", status: "available", supplier: "Fictional Network Supplies Ltd.", funding_source: "University Development Fund", receivedfrom: "Demo Procurement Office", remarks: "Within warranty; active transfer demonstration." },
      { key: "disposal", code: `${DEMO_PREFIX}-IT-005`, item_name: "APC Smart-UPS 1500VA", category: "Power Equipment", serial_no: "APC1500-DEMO-005", model: "SMC1500I", value: 72000, po_no: 201905, gin_no: 910005, purchased_date: dateMonthsAgo(75), warranty: "3 Years", location: "Network Laboratory, Quarantine Area", status: "damaged", supplier: "Fictional Power Systems Ltd.", funding_source: "Capital Fund", receivedfrom: "Demo Procurement Office", remarks: "End-of-life unit; active disposal demonstration." },
      { key: "warrantyClaim", code: `${DEMO_PREFIX}-IT-006`, item_name: "Lenovo ThinkPad E14", category: "Computing Equipment", serial_no: "LNE14-DEMO-006", model: "ThinkPad E14 Gen 5", value: 210000, po_no: 202602, gin_no: 910006, purchased_date: dateMonthsAgo(4), warranty: "3 Years", location: "Network Laboratory, Workstation 03", status: "available", supplier: "Fictional Campus Technology Ltd.", funding_source: "Faculty Development Fund", receivedfrom: "Demo Procurement Office", remarks: "Within warranty; active warranty claim demonstration." },
      { key: "duplicateCandidate", code: `${DEMO_PREFIX}-IT-007`, item_name: "Brother HL-L6400DW Printer", category: "Office Equipment", serial_no: "BHL6400-DEMO-007", model: "HL-L6400DW", value: 115000, po_no: 202404, gin_no: 910007, purchased_date: dateMonthsAgo(26), warranty: "2 Years", location: "Faculty Administration Store, Shelf B2", status: "available", supplier: "Fictional Office Machines Ltd.", funding_source: "Department Development Fund", receivedfrom: "Demo Procurement Office", remarks: `Duplicate validation demo candidate. Re-enter item code ${DEMO_PREFIX}-IT-007 or serial ${"BHL6400-DEMO-007"} in the Add Item form.` },
      { key: "extra", code: `${DEMO_PREFIX}-IT-008`, item_name: "TP-Link Wi-Fi 6 Access Point", category: "Networking Equipment", serial_no: "TPLWIFI6-DEMO-008", model: "EAP660 HD", value: 52000, po_no: 202505, gin_no: 910008, purchased_date: dateMonthsAgo(15), warranty: "1 Year", location: "Network Laboratory, Rack 04", status: "available", supplier: "Fictional Network Supplies Ltd.", funding_source: "University Development Fund", receivedfrom: "Demo Procurement Office", remarks: "Outside warranty; available inventory example." },
    ];

    const items = {};
    for (const definition of itemDefinitions) {
      items[definition.key] = await ensureItem(connection, definition, definition.key === "disposal" || definition.key === "transfer" || definition.key === "extra" ? inventories.net : definition.key === "duplicateCandidate" ? inventories.admin : inventories.cs);
    }

    const transferMarker = `${DEMO_PREFIX}-TRANSFER-001`;
    await insertOnce(connection, "item_transfers", "id", "notes", transferMarker, {
      item_id: items.transfer,
      from_inventory_id: inventories.net,
      to_inventory_id: inventories.cs,
      quantity: 1,
      reason: "Move a network switch to support the demonstration laboratory expansion.",
      notes: transferMarker,
      status: "pending",
      approval_status: "pending_hod",
      transfer_date: dateDaysFromNow(14),
      initiated_by_id: users.inchargeNet,
      source_hod_user_id: users.hodNet,
      destination_hod_user_id: users.hodCs,
    });

    const disposalMarker = `${DEMO_PREFIX}-DISPOSAL-001`;
    await insertOnce(connection, "item_disposals", "id", "description", disposalMarker, {
      item_id: items.disposal,
      inventory_id: inventories.net,
      quantity: 1,
      reason: "end-of-life",
      description: disposalMarker,
      condition: "poor",
      status: "pending",
      approval_status: "pending_hod",
      disposal_date: dateDaysFromNow(21),
      initiated_by_id: users.inchargeNet,
      source_hod_user_id: users.hodNet,
      disposal_type: "auction",
      disposal_type_details: "Fictional auction lot for demonstration only.",
    });

    const repairMarker = `${DEMO_PREFIX}-REPAIR-001`;
    await insertOnce(connection, "item_repairs", "id", "repair_notes", repairMarker, {
      item_id: items.repair,
      inventory_id: inventories.cs,
      quantity: 1,
      fault_description: "Projector powers on but displays intermittent lamp failure and distorted colour.",
      repair_notes: repairMarker,
      status: "submitted",
      approval_status: "pending_hod",
      repair_date: dateDaysFromNow(7),
      initiated_by_id: users.inchargeCs,
      contact_person_user_id: users.inchargeCs,
      source_hod_user_id: users.hodCs,
      repair_cost: 18500,
    });

    const claimMarker = `${DEMO_PREFIX}-CLAIM-001`;
    await insertOnce(connection, "warranty_claims", "claim_id", "claim_notes", claimMarker, {
      claim_id: await nextId(connection, "warranty_claims", "claim_id"),
      item_name: "Lenovo ThinkPad E14",
      item_id: items.warrantyClaim,
      inventory_id: inventories.net,
      quantity: 1,
      fault_description: "Battery health dropped below the expected threshold during the warranty period.",
      claim_notes: claimMarker,
      status: "submitted",
      claim_date: dateDaysFromNow(3),
      initiated_by_id: users.inchargeNet,
    });

    const requestRows = [
      { marker: `${DEMO_PREFIX}-REQUEST-001`, item_name: "USB-C docking station", quantity: 2, priority: "normal", specification: "Dual-monitor docking station with 90W USB-C charging.", reason: `${DEMO_PREFIX}-REQUEST-001: Teaching laboratory expansion.`, requested_by_id: users.staffCs, requested_inventory_id: inventories.cs, inventory_location: "CS Laboratory", department_id: departmentIds["DEMO-CS"], inventory_department_id: departmentIds["DEMO-CS"], hod_user_id: users.hodCs, approval_status: "pending_requester_hod", required_by_date: dateDaysFromNow(30) },
      { marker: `${DEMO_PREFIX}-REQUEST-002`, item_name: "Managed 24-port switch", quantity: 1, priority: "urgent", specification: "Layer 2 managed switch with VLAN support.", reason: `${DEMO_PREFIX}-REQUEST-002: Replace a failed teaching-lab switch.`, requested_by_id: users.staffNet, requested_inventory_id: inventories.net, inventory_location: "Network Laboratory", department_id: departmentIds["DEMO-NET"], inventory_department_id: departmentIds["DEMO-NET"], hod_user_id: users.hodNet, approval_status: "approved_to_issue", required_by_date: dateDaysFromNow(10), hod_approved_date: new Date(), hod_approved_by_id: users.hodNet, lab_hod_approved_date: new Date(), lab_hod_approved_by_id: users.hodNet, inventory_officer_user_id: users.inchargeNet },
      { marker: `${DEMO_PREFIX}-REQUEST-003`, item_name: "Ergonomic keyboard", quantity: 3, priority: "low", specification: "Quiet full-size keyboard for shared workstations.", reason: `${DEMO_PREFIX}-REQUEST-003: Approved and issued demonstration request.`, requested_by_id: users.staffCs, requested_inventory_id: inventories.cs, inventory_location: "CS Laboratory", department_id: departmentIds["DEMO-CS"], inventory_department_id: departmentIds["DEMO-CS"], hod_user_id: users.hodCs, approval_status: "approved", required_by_date: dateMonthsAgo(1), hod_approved_date: dateMonthsAgo(2), hod_approved_by_id: users.hodCs, issued_date: dateMonthsAgo(1), issued_by_id: users.inchargeCs, allocated_inventory_id: inventories.cs, allocated_quantity: 3, allocated_date: dateMonthsAgo(1), allocated_inventory_item_id: items.issued },
      { marker: `${DEMO_PREFIX}-REQUEST-004`, item_name: "Portable projector screen", quantity: 1, priority: "normal", specification: "100-inch pull-down screen.", reason: `${DEMO_PREFIX}-REQUEST-004: Rejected duplicate equipment request.`, requested_by_id: users.staffNet, requested_inventory_id: inventories.net, inventory_location: "Network Laboratory", department_id: departmentIds["DEMO-NET"], inventory_department_id: departmentIds["DEMO-NET"], hod_user_id: users.hodNet, approval_status: "rejected", rejection_reason: "Equivalent equipment is already available in the destination inventory.", rejection_date: dateMonthsAgo(1) },
    ];
    for (const request of requestRows) await insertOnce(connection, "item_requests", "id", "reason", request.marker, request);

    await insertOnce(connection, "inventory_creation_requests", "inv_req_id", "reason", `${DEMO_PREFIX}-INVENTORY-REQUEST-001`, {
      name: `${DEMO_PREFIX} Robotics Inventory`,
      location: "Demo Innovation Block, Lab 410",
      department_id: departmentIds["DEMO-CS"],
      requested_by_id: users.inchargeCs,
      submitted_by_role: "inventory_incharge",
      incharge_user_id: users.inchargeCs,
      hod_user_id: users.hodCs,
      reason: `${DEMO_PREFIX}-INVENTORY-REQUEST-001: New robotics teaching inventory for approval demonstration.`,
      approval_status: "pending_hod",
      request_type: "new_inventory_creation",
    });

    await insertOnce(connection, "account_requests", "id", "request_reason", `${DEMO_PREFIX}-ACCOUNT-REQUEST-001`, {
      request_type: "account_creation",
      requested_by_name: "Demo New Staff Applicant",
      email: "demo.new.applicant@sims.invalid",
      requested_role: "staff",
      requested_department_id: departmentIds["DEMO-CS"],
      requested_password: passwordHash,
      requested_designation: "Demonstration Lecturer",
      requested_mobile_no: "5550110",
      approval_status: "pending_admin",
      submitted_by_role: "staff",
      request_reason: `${DEMO_PREFIX}-ACCOUNT-REQUEST-001`,
    });

    await updateItemStatus(connection, items.issued, "issued");
    await updateItemStatus(connection, items.repair, "maintenance");
    await updateItemStatus(connection, items.disposal, "damaged");
    await updateItemStatus(connection, items.transfer, "available");

    await connection.commit();
    console.log("Demo seed completed successfully.");
    console.log(`Demo login password was supplied through DEMO_PASSWORD; no plaintext password was stored.`);
    console.log(`Created or reused ${Object.keys(items).length} marked items across ${Object.keys(inventories).length} inventories.`);
    console.log("Active locks: transfer DEMO-SIMS-2026-IT-004, disposal DEMO-SIMS-2026-IT-005, repair DEMO-SIMS-2026-IT-003.");
  } catch (error) {
    await connection.rollback();
    console.error(`Demo seed rolled back: ${error.message}`);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
};

main();
