import express from "express";
import cors from "cors";
import Database from "better-sqlite3";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const db = new Database("./server/db.sqlite");

db.prepare(
  `CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    itemName TEXT NOT NULL,
    itemCode TEXT DEFAULT '',
    serialNo TEXT DEFAULT '',
    serialNo2 TEXT DEFAULT '',
    model TEXT DEFAULT '',
    QRCode TEXT DEFAULT '',
    itemImage TEXT DEFAULT '',
    value TEXT DEFAULT '',
    purchaseDate TEXT DEFAULT '',
    ginNo TEXT DEFAULT '',
    ginfile TEXT DEFAULT '',
    poNo TEXT DEFAULT '',
    supplier TEXT DEFAULT '',
    funding TEXT DEFAULT '',
    receivedfrom TEXT DEFAULT '',
    warranty TEXT DEFAULT '',
    location TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    qrcodeUrl TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`
).run();

const normalizeItemPayload = (payload = {}) => ({
  itemName: String(payload.itemName ?? payload.itemname ?? "").trim(),
  itemCode: payload.itemCode ?? payload.itemcode ?? "",
  serialNo: payload.serialNo ?? payload.serialno ?? "",
  serialNo2: payload.serialNo2 ?? payload.serialno2 ?? "",
  model: payload.model ?? "",
  QRCode: payload.QRCode ?? payload.qrcode ?? "",
  itemImage: payload.itemImage ?? payload.itemimage ?? "",
  value: payload.value ?? "",
  purchaseDate: payload.purchaseDate ?? payload.purchasedate ?? "",
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
});

const validateRequiredFields = (item) => {
  if (!item.itemName) return "itemName is required";
  return null;
};

app.options("/*", (req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS,DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.sendStatus(204);
});

app.post("/api/items", (req, res) => {
  try {
    const item = normalizeItemPayload(req.body);
    const err = validateRequiredFields(item);
    if (err) return res.status(400).json({ success: false, error: err });

    const stmt = db.prepare(
      `INSERT INTO items (
        itemName,itemCode,serialNo,serialNo2,model,QRCode,itemImage,value,purchaseDate,
        ginNo,ginfile,poNo,supplier,funding,receivedfrom,warranty,location,remarks,qrcodeUrl
      ) VALUES (
        @itemName,@itemCode,@serialNo,@serialNo2,@model,@QRCode,@itemImage,@value,@purchaseDate,
        @ginNo,@ginfile,@poNo,@supplier,@funding,@receivedfrom,@warranty,@location,@remarks,@qrcodeUrl
      )`
    );

    const info = stmt.run(item);
    const created = { id: info.lastInsertRowid, ...item };
    return res.status(201).json({ success: true, item: created });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: String(e) });
  }
});

app.post("/api/items/bulk", (req, res) => {
  try {
    const body = req.body;
    if (!Array.isArray(body)) return res.status(400).json({ success: false, error: "Expected an array of items" });
    if (body.length === 0) return res.status(400).json({ success: false, error: "No items provided" });

    const items = body.map(normalizeItemPayload);
    const invalid = items.find(validateRequiredFields);
    if (invalid) return res.status(400).json({ success: false, error: validateRequiredFields(invalid) });

    const insert = db.prepare(
      `INSERT INTO items (
        itemName,itemCode,serialNo,serialNo2,model,QRCode,itemImage,value,purchaseDate,
        ginNo,ginfile,poNo,supplier,funding,receivedfrom,warranty,location,remarks,qrcodeUrl
      ) VALUES (
        @itemName,@itemCode,@serialNo,@serialNo2,@model,@QRCode,@itemImage,@value,@purchaseDate,
        @ginNo,@ginfile,@poNo,@supplier,@funding,@receivedfrom,@warranty,@location,@remarks,@qrcodeUrl
      )`
    );

    const insertMany = db.transaction((records) => {
      for (const r of records) insert.run(r);
    });

    insertMany(items);
    return res.status(201).json({ success: true, createdCount: items.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: String(e) });
  }
});

app.get("/api/items", (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM items ORDER BY id DESC`).all();
    return res.json({ success: true, items: rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: String(e) });
  }
});

app.get("/api/items/:id", (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, error: "Invalid id" });
    const row = db.prepare(`SELECT * FROM items WHERE id = ? LIMIT 1`).get(id);
    if (!row) return res.status(404).json({ success: false, error: "Item not found" });
    return res.json({ success: true, item: row });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`SQLite server listening on http://localhost:${PORT}`);
});
