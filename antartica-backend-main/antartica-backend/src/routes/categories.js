import express from "express";
import { auth, requireAdmin } from "../middleware/auth.js";
import { getPool } from "../config/db.js";

const router = express.Router();

// Listar categorías
router.get("/", async (_req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query("SELECT * FROM categories ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron obtener las categorías" });
  }
});

// Crear categoría (admin)
router.post("/", auth, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Nombre requerido" });
    const pool = await getPool();
    const [result] = await pool.query("INSERT INTO categories (name) VALUES (?)", [name]);
    const [rows] = await pool.query("SELECT * FROM categories WHERE id = ?", [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo crear la categoría" });
  }
});

// Actualizar categoría (admin)
router.put("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name } = req.body;
    const pool = await getPool();
    await pool.query("UPDATE categories SET name=? WHERE id=?", [name, id]);
    const [rows] = await pool.query("SELECT * FROM categories WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar la categoría" });
  }
});

// Eliminar categoría (admin)
router.delete("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();
    await pool.query("DELETE FROM categories WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo eliminar la categoría" });
  }
});

export default router;
