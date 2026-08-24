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

const resolveItemPurchaseDate = (row = {}) => {
  const candidates = [row.purchaseDate, row.purchase_date, row.purchased_date, row.created_at];
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

const getWarrantyExpiryDate = (row = {}) => {
  const months = parseWarrantyMonths(row.warranty);
  const purchaseDate = resolveItemPurchaseDate(row);
  if (!months || !purchaseDate) {
    return null;
  }
  const expiry = new Date(purchaseDate);
  expiry.setMonth(expiry.getMonth() + months);
  return expiry;
};

const getDaysUntil = (targetDate, referenceDate = new Date()) => {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDateLabel = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().split("T")[0];
};

const uniquePositiveIds = (values = []) =>
  [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];

let notificationsSchemaCache = null;

const getNotificationsSchema = async (pool) => {
  if (notificationsSchemaCache) {
    return notificationsSchemaCache;
  }

  const [columnRows] = await pool.query("SHOW COLUMNS FROM notifications");
  const columns = new Set(columnRows.map((row) => row.Field));
  const idColumn = columns.has("id")
    ? "id"
    : columns.has("notification_id")
      ? "notification_id"
      : null;

  notificationsSchemaCache = { columns, idColumn };
  return notificationsSchemaCache;
};

export const ensureNotificationsTable = async (pool) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      type VARCHAR(80) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      link VARCHAR(500) NULL,
      dedupe_key VARCHAR(255) NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_notification_dedupe (user_id, dedupe_key)
    )
  `);
};

export const createNotification = async (pool, {
  userId,
  type,
  title,
  message,
  link = null,
  dedupeKey = null,
}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return null;
  }

  const key = dedupeKey ? String(dedupeKey) : null;

  if (key) {
    await pool.execute(
      `
        INSERT INTO notifications (user_id, type, title, message, link, dedupe_key, is_read)
        VALUES (?, ?, ?, ?, ?, ?, 0)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          message = VALUES(message),
          link = VALUES(link),
          created_at = CURRENT_TIMESTAMP
      `,
      [normalizedUserId, type, title, message, link, key]
    );
    return key;
  }

  const [result] = await pool.execute(
    `
      INSERT INTO notifications (user_id, type, title, message, link, dedupe_key, is_read)
      VALUES (?, ?, ?, ?, ?, NULL, 0)
    `,
    [normalizedUserId, type, title, message, link]
  );

  return Number(result.insertId);
};

export const createNotificationsForUsers = async (pool, userIds, payload) => {
  const recipients = uniquePositiveIds(userIds);
  await Promise.all(recipients.map((userId) => createNotification(pool, { ...payload, userId })));
  return recipients.length;
};

const getWarrantyRecipients = (row = {}) =>
  uniquePositiveIds([row.incharge_user_id, row.incharge_id]);

export const syncWarrantyNotifications = async (pool, itemsTable) => {
  const tableName = String(itemsTable || "inventory_items").trim() || "inventory_items";
  const now = new Date();

  let itemRows = [];
  try {
    const [rows] = await pool.execute(
      `
        SELECT
          i.id,
          COALESCE(i.itemName, i.item_name, '') AS item_name,
          i.warranty,
          i.purchaseDate,
          i.purchase_date,
          i.created_at,
          i.inventory_id,
          COALESCE(inv.incharge_user_id, inv.incharge_id) AS incharge_user_id
        FROM ${tableName} i
        LEFT JOIN inventories inv ON inv.id = i.inventory_id
        WHERE i.warranty IS NOT NULL AND TRIM(i.warranty) <> ''
      `
    );
    itemRows = rows;
  } catch (error) {
    const [rows] = await pool.execute(
      `
        SELECT item_id, itemName AS item_name, warranty, purchaseDate, purchased_date, created_at, inventory_id
        FROM ${tableName}
        WHERE warranty IS NOT NULL AND TRIM(warranty) <> ''
      `
    );
    itemRows = rows;
  }

  for (const row of itemRows) {
    const expiryDate = getWarrantyExpiryDate(row);
    if (!expiryDate) {
      continue;
    }

    const daysUntilExpiry = getDaysUntil(expiryDate, now);
    const itemName = String(row.item_name || "Item").trim() || "Item";
    const itemId = Number(row.id);
    const link = `/inventory/item/${itemId}`;
    const expiryLabel = formatDateLabel(expiryDate);
    const recipients = getWarrantyRecipients(row);

    if (recipients.length === 0) {
      continue;
    }

    if (daysUntilExpiry <= 0) {
      await createNotificationsForUsers(pool, recipients, {
        type: "warranty_expired",
        title: "Warranty expired",
        message: `Warranty for "${itemName}" expired on ${expiryLabel}.`,
        link,
        dedupeKey: `warranty_expired_item_${itemId}`,
      });
      continue;
    }

    if (daysUntilExpiry <= 30) {
      await createNotificationsForUsers(pool, recipients, {
        type: "warranty_expiry_1m",
        title: "Warranty expiring in 1 month",
        message: `Warranty for "${itemName}" expires on ${expiryLabel} (about ${daysUntilExpiry} day(s) remaining).`,
        link,
        dedupeKey: `warranty_1m_item_${itemId}`,
      });
      continue;
    }

    if (daysUntilExpiry <= 90) {
      await createNotificationsForUsers(pool, recipients, {
        type: "warranty_expiry_3m",
        title: "Warranty expiring in 3 months",
        message: `Warranty for "${itemName}" expires on ${expiryLabel} (about ${daysUntilExpiry} day(s) remaining).`,
        link,
        dedupeKey: `warranty_3m_item_${itemId}`,
      });
    }
  }
};

export const notifyApprovalStage = async (pool, {
  userIds,
  workflow,
  stage,
  entityId,
  entityLabel = "request",
  link = null,
}) => {
  const recipients = uniquePositiveIds(userIds);
  if (recipients.length === 0) {
    return 0;
  }

  const stageLabels = {
    hod: "Head of Department",
    registrar: "Registrar",
  };
  const workflowLabels = {
    inventory_creation: "inventory creation request",
    transfer: "item transfer request",
    disposal: "item disposal request",
  };

  const approverLabel = stageLabels[stage] || "Approver";
  const workflowLabel = workflowLabels[workflow] || "request";
  const label = String(entityLabel || "request").trim() || "request";

  return createNotificationsForUsers(pool, recipients, {
    type: `approval_${stage}_${workflow}`,
    title: `${approverLabel} approved`,
    message: `Your ${workflowLabel} "${label}" was approved by the ${approverLabel}.`,
    link,
    dedupeKey: `approval_${stage}_${workflow}_${entityId}`,
  });
};

export const notifyItemRequestReceived = async (pool, {
  inventoryOfficerUserId,
  requestId,
  itemName,
  quantity,
  requesterName = "",
  inventoryName = "",
}) => {
  const label = String(itemName || "Item").trim() || "Item";
  const qty = Number(quantity) > 0 ? Number(quantity) : 1;
  const requesterPart = String(requesterName || "").trim() ? ` from ${String(requesterName).trim()}` : "";
  const inventoryPart = String(inventoryName || "").trim() ? ` — ${String(inventoryName).trim()}` : "";

  return createNotificationsForUsers(pool, [inventoryOfficerUserId], {
    type: "item_request_received",
    title: "Item request received",
    message: `You received an item request for "${label}" (qty ${qty})${requesterPart}${inventoryPart}. Please review and issue the item.`,
    link: "/inventory/requests/list/incharge",
    dedupeKey: `item_request_received_${requestId}`,
  });
};

export const getNotificationsForUser = async (pool, userId, { limit = 50 } = {}) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return { notifications: [], unreadCount: 0 };
  }

  const { idColumn } = await getNotificationsSchema(pool);
  if (!idColumn) {
    return { notifications: [], unreadCount: 0 };
  }

  const maxRows = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const [rows] = await pool.execute(
    `
      SELECT ${idColumn} AS id, type, title, message, link, is_read, created_at
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC, ${idColumn} DESC
      LIMIT ${maxRows}
    `,
    [normalizedUserId]
  );

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND is_read = 0`,
    [normalizedUserId]
  );

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      link: row.link || null,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    })),
    unreadCount: Number(countRows[0]?.unread_count ?? 0),
  };
};

export const markNotificationRead = async (pool, { notificationId, userId }) => {
  const normalizedNotificationId = Number(notificationId);
  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedNotificationId) || normalizedNotificationId <= 0) {
    return false;
  }

  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return false;
  }

  const { idColumn } = await getNotificationsSchema(pool);
  if (!idColumn) {
    return false;
  }

  const [result] = await pool.execute(
    `UPDATE notifications SET is_read = 1 WHERE ${idColumn} = ? AND user_id = ?`,
    [normalizedNotificationId, normalizedUserId]
  );

  return result.affectedRows > 0;
};

export const markAllNotificationsRead = async (pool, userId) => {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return 0;
  }

  const [result] = await pool.execute(
    `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
    [normalizedUserId]
  );

  return Number(result.affectedRows ?? 0);
};
