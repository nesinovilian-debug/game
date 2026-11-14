
const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");
const crypto = require("crypto");
const path = require("path");

const app = express();
const db = new Database(process.env.DB_FILE || "visitors.db");
const PORT = process.env.PORT || 3000;

if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visited_at TEXT NOT NULL,
    browser TEXT NOT NULL,
    device TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    created_at TEXT NOT NULL
  );
`);

app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));

app.use(session({
  name: "darkadmin.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: "Admin login required" });
}

function identifyBrowser(ua = "") {
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Other / unknown";
}

function identifyDevice(ua = "") {
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  if (/Mobile|Android|iPhone/i.test(ua)) return "Mobile";
  return "Desktop";
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve(salt.toString("hex") + ":" + key.toString("hex"));
    });
  });
}

// Register a website account.
app.post("/api/register", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const phone = String(req.body?.phone || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        error: "Password must be between 8 and 128 characters."
      });
    }

    if (phone.length > 30) {
      return res.status(400).json({ error: "Phone number is too long." });
    }

    const passwordHash = await hashPassword(password);

    db.prepare(`
      INSERT INTO accounts (email, password_hash, phone, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      email,
      passwordHash,
      phone || null,
      new Date().toISOString()
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "An account with that email already exists."
      });
    }

    console.error("Registration failed:", err.message);
    res.status(500).json({ error: "Registration failed." });
  }
});

// Record analytics only when the visitor opts in.
app.post("/api/visit", (req, res) => {
  const ua = String(req.get("user-agent") || "").slice(0, 500);

  db.prepare(`
    INSERT INTO visits (visited_at, browser, device)
    VALUES (?, ?, ?)
  `).run(
    new Date().toISOString(),
    identifyBrowser(ua),
    identifyDevice(ua)
  );

  res.json({ ok: true });
});

// Admin login.
app.post("/api/admin/login", (req, res) => {
  const password = String(req.body?.password || "");

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  req.session.regenerate(err => {
    if (err) {
      return res.status(500).json({ error: "Could not start session." });
    }

    req.session.isAdmin = true;
    res.json({ ok: true });
  });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/check", (req, res) => {
  res.json({ authenticated: !!req.session?.isAdmin });
});

// Admin dashboard data.
app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const total = db.prepare(
    "SELECT COUNT(*) AS n FROM visits"
  ).get().n;

  const today = new Date().toISOString().slice(0, 10);

  const todayCount = db.prepare(`
    SELECT COUNT(*) AS n
    FROM visits
    WHERE substr(visited_at, 1, 10) = ?
  `).get(today).n;

  const visits = db.prepare(`
    SELECT id, visited_at, browser, device
    FROM visits
    ORDER BY id DESC
    LIMIT 200
  `).all();

  const accounts = db.prepare(`
    SELECT email, phone, created_at
    FROM accounts
    ORDER BY id DESC
    LIMIT 500
  `).all();

  res.json({
    total,
    today: todayCount,
    visits,
    accounts
  });
});

app.listen(PORT, () => {
  console.log(`DARKADMIN running on port ${PORT}`);
});
