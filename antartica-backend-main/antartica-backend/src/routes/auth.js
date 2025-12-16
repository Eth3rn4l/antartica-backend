import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getPool } from "../config/db.js";

const router = express.Router();

const ACCESS_TTL = process.env.ACCESS_TTL || "15m";
const REFRESH_TTL_DAYS = parseInt(process.env.REFRESH_TTL_DAYS || "7", 10);

const toUserPayload = (u) => ({
  id: u.id,
  nombre: u.nombre,
  apellido: u.apellido,
  email: u.email,
  telefono: u.telefono,
  region: u.region,
  comuna: u.comuna,
  rut: u.rut,
  role: u.role
});

const signAccessToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, nombre: user.nombre }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TTL,
  });

const issueRefreshToken = async (userId) => {
  const token = crypto.randomBytes(64).toString("hex");
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  const pool = await getPool();
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token, expires_at, revoked) VALUES (?, ?, ?, 0)",
    [userId, token, expires]
  );
  return { token, expires_at: expires };
};

router.post("/register", async (req, res) => {
  try {
    const { nombre, apellido, email, password, telefono, region, comuna, rut } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Correo y contraseña son obligatorios" });
    const pool = await getPool();
    const [exists] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (exists.length) return res.status(400).json({ error: "El usuario ya existe" });

    const hash = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (nombre, apellido, email, password, telefono, region, comuna, rut, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [nombre || "", apellido || "", email, hash, telefono || "", region || "", comuna || "", rut || "", "client"]
    );
    const insertedId = result.insertId;
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [insertedId]);
    const user = rows[0];
    const accessToken = signAccessToken(user);
    const refresh = await issueRefreshToken(user.id);
    res.json({ token: accessToken, refreshToken: refresh.token, user: toUserPayload(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Credenciales obligatorias" });
    const pool = await getPool();
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    if (!rows.length) return res.status(401).json({ error: "Credenciales inválidas" });
    const u = rows[0];
    const ok = bcrypt.compareSync(password, u.password);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

    const accessToken = signAccessToken(u);
    const refresh = await issueRefreshToken(u.id);
    res.json({ token: accessToken, refreshToken: refresh.token, user: toUserPayload(u) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "refreshToken requerido" });
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0 LIMIT 1",
      [refreshToken]
    );
    if (!rows.length) return res.status(401).json({ error: "Refresh token inválido" });
    const rt = rows[0];
    if (rt.expires_at && new Date(rt.expires_at) < new Date()) {
      await pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?", [rt.id]);
      return res.status(401).json({ error: "Refresh token expirado" });
    }
    const [users] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [rt.user_id]);
    if (!users.length) return res.status(401).json({ error: "Usuario no encontrado" });
    const user = users[0];
    const accessToken = signAccessToken(user);
    // rotar refresh
    await pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?", [rt.id]);
    const refresh = await issueRefreshToken(user.id);
    res.json({ token: accessToken, refreshToken: refresh.token, user: toUserPayload(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al renovar token" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const pool = await getPool();
      await pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE token = ?", [refreshToken]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cerrar sesión" });
  }
});

export default router;
