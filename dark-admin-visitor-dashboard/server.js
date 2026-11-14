const express = require("express");
const session = require("express-session");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database(process.env.DB_FILE || "visitors.db");
const PORT = process.env.PORT || 3000;

if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
  console.error("Set ADMIN_PASSWORD and SESSION_SECRET environment variables.");
  process.exit(1);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visited_at TEXT NOT NULL,
    browser TEXT NOT NULL,
    device TEXT NOT NULL
  )
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

// A visit is recorded only after the visitor chooses "Allow basic analytics".
app.post("/api/visit", (req, res) => {
  const ua = String(req.get("user-agent") || "").slice(0, 500);
  const browser = identifyBrowser(ua);
  const device = identifyDevice(ua);
  db.prepare(
    "INSERT INTO visits (visited_at, browser, device) VALUES (?, ?, ?)"
  ).run(new Date().toISOString(), browser, device);
  res.json({ ok: true });
});

app.post("/api/admin/login", (req, res) => {
  const password = String(req.body?.password || "");
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect password" });
  }
  req.session.isAdmin = true;
  res.json({ ok: true });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS n FROM visits").get().n;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = db.prepare(
    "SELECT COUNT(*) AS n FROM visits WHERE substr(visited_at, 1, 10) = ?"
  ).get(today).n;
  const visits = db.prepare(
    "SELECT id, visited_at, browser, device FROM visits ORDER BY id DESC LIMIT 200"
  ).all();
  res.json({ total, today: todayCount, visits });
});

app.get("/api/admin/check", (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

app.listen(PORT, () => console.log(`Dark Admin running on port ${PORT}`));
