import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "./server/models/User.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/studysmart";
const SESSION_SECRET = process.env.SESSION_SECRET || "changeme";
const JWT_SECRET = process.env.JWT_SECRET || "changeme";

mongoose.connect(MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, UPLOADS_DIR); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(session({
    name: "sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, sameSite: "lax", maxAge: 1000 * 60 * 60 * 24 },
    store: MongoStore.create({ mongoUrl: MONGO_URI, collectionName: "sessions" }),
  }));

  // Auth routes
  app.post("/api/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password || password.length < 8) {
        return res.status(400).json({ success: false, error: "Invalid email or password (min 8 chars)." });
      }
      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ success: false, error: "Email already in use." });
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({ email, passwordHash });
      (req.session as any).userId = user._id.toString();
      const token = jwt.sign({ sub: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: "1d" });
      return res.status(201).json({ success: true, user: { id: user._id, email: user.email }, token });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: "Internal server error." });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ success: false, error: "Invalid input." });
      const user = await User.findOne({ email }).select("+passwordHash");
      if (!user) return res.status(401).json({ success: false, error: "Invalid email or password." });
      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) return res.status(401).json({ success: false, error: "Invalid email or password." });
      (req.session as any).userId = user._id.toString();
      const token = jwt.sign({ sub: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: "1d" });
      return res.json({ success: true, user: { id: user._id, email: user.email }, token });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: "Internal server error." });
    }
  });

  app.get("/api/me", async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) return res.json({ loggedIn: false });
      const user = await User.findById(userId).select("email");
      if (!user) return res.json({ loggedIn: false });
      return res.json({ loggedIn: true, user: { id: user._id, email: user.email } });
    } catch (err) {
      return res.status(500).json({ success: false, error: "Internal server error." });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ success: false, error: "Could not log out." });
      res.clearCookie("sid");
      return res.json({ success: true });
    });
  });
  app.post("/api/change-password", async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: "Not logged in." });
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ success: false, error: "Invalid input." });
      }
      const user = await User.findById(userId).select("+passwordHash");
      if (!user) return res.status(404).json({ success: false, error: "User not found." });
      const matches = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matches) return res.status(401).json({ success: false, error: "Current password is incorrect." });
      user.passwordHash = await bcrypt.hash(newPassword, 12);
      await user.save();
      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: "Internal server error." });
    }
  });

  // File routes
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.json({ message: "File uploaded successfully", file: { id: req.file.filename, name: req.file.originalname, size: req.file.size, path: `/api/files/${req.file.filename}`, uploadedAt: new Date().toISOString() } });
  });

  app.get("/api/library", (req, res) => {
    const files = fs.readdirSync(UPLOADS_DIR).map(filename => {
      const stats = fs.statSync(path.join(UPLOADS_DIR, filename));
      const nameParts = filename.split("-");
      const originalName = nameParts.slice(2).join("-");
      return { id: filename, name: originalName || filename, size: stats.size, path: `/api/files/${filename}`, uploadedAt: stats.birthtime.toISOString() };
    });
    res.json(files);
  });

  app.get("/api/files/:filename", (req, res) => {
    const filePath = path.join(UPLOADS_DIR, req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({ error: "File not found" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.listen(PORT, "0.0.0.0", () => { console.log(`Server running on http://localhost:${PORT}`); });
}
startServer();
