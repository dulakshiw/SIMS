import express from "express";
import mysql from "mysql2";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 5000;

let isDbConnected = false;

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "1234",   // 👈 your new password
  database: "sims_db",
});

db.connect(err => {
  if (err) {
    console.log("DB connection failed:", err);
  } else {
    console.log("MySQL Connected");
  }
});

// Test route
app.get("/", (req, res) => {
  res.send("Backend is running...");
});

// Example route
app.get("/users", (req, res) => {
  db.query("SELECT * FROM users", (err, result) => {
    if (err) {
      console.log("Query Error:", err);   // 👈 show real issue
      return res.status(500).json(err);
    }
    return res.json(result);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
