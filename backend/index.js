import express from "express";
import mysql from "mysql2";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 5000;

let isDbConnected = false;

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sims_db",
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

// Login endpoint
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required."
    });
  }

  db.query(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, result) => {
      if (err) {
        console.log("Query Error:", err);
        return res.status(500).json({
          success: false,
          error: "Database error occurred."
        });
      }

      if (result.length === 0) {
        return res.status(401).json({
          success: false,
          error: "Invalid email or password."
        });
      }

      const user = result[0];
      return res.status(200).json({
        success: true,
        message: "Login successful!",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          designation: user.designation,
          department: user.department,
          assignedInventoryCount: user.assignedInventoryCount || 0
        }
      });
    }
  );
});

// Get all users endpoint for location assignment
app.get("/api/users", (req, res) => {
  db.query("SELECT id, name, email, role, designation, department FROM users", (err, result) => {
    if (err) {
      console.log("Query Error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch users."
      });
    }
    return res.status(200).json({
      success: true,
      users: result
    });
  });
});

// Get user profile endpoint
app.get("/api/profile", (req, res) => {
  const { email, userId } = req.query;

  if (!email && !userId) {
    return res.status(400).json({
      success: false,
      error: "Email or userId is required."
    });
  }

  const query = email 
    ? "SELECT * FROM users WHERE email = ?" 
    : "SELECT * FROM users WHERE id = ?";
  const value = email || userId;

  db.query(query, [value], (err, result) => {
    if (err) {
      console.log("Query Error:", err);
      return res.status(500).json({
        success: false,
        error: "Database error occurred."
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found."
      });
    }

    const user = result[0];
    return res.status(200).json({
      success: true,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        department: user.department,
        assignedInventoryCount: user.assignedInventoryCount || 0
      }
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
