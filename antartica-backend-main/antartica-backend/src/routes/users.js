import express from "express";
import { auth, requireAdmin } from "../middleware/auth.js";
import { getPool } from "../config/db.js";

const router = express.Router();

// Listado de usuarios (solo admin)
router.get("/", auth, requireAdmin, async (req, res) => {
  try {
    const role = req.query.role;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 1000;
    const offset = (page - 1) * limit;
    const pool = await getPool();

    let totalSql = "SELECT COUNT(*) as total FROM users";
    const totalParams = [];
    if (role) {
      totalSql += " WHERE role = ?";
      totalParams.push(role);
    }
    const [[{ total }]] = await pool.query(totalSql, totalParams);

    let rowsSql = "SELECT id, nombre, apellido, email, telefono, region, comuna, rut, role, created_at FROM users";
    const rowsParams = [];
    if (role) {
      rowsSql += " WHERE role = ?";
      rowsParams.push(role);
    }
    rowsSql += " ORDER BY FIELD(role, 'admin') DESC, id DESC LIMIT ? OFFSET ?";
    rowsParams.push(limit, offset);
    const [rows] = await pool.query(rowsSql, rowsParams);
    res.json({ items: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron obtener los usuarios" });
  }
});

// Información del usuario autenticado
router.get("/me", auth, async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT id, nombre, apellido, email, telefono, region, comuna, rut, role, created_at FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo obtener el usuario" });
  }
});

// Eliminar usuario (solo admin, no admins)
router.delete("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();
    const [rows] = await pool.query("SELECT id, role FROM users WHERE id = ? LIMIT 1", [id]);
    if (!rows.length) return res.status(404).json({ error: "Usuario no encontrado" });
    if (rows[0].role === "admin") return res.status(403).json({ error: "No se puede eliminar un admin" });
    await pool.query("DELETE FROM cart_items WHERE user_id = ?", [id]);
    await pool.query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo eliminar el usuario" });
  }
});

export default router;
