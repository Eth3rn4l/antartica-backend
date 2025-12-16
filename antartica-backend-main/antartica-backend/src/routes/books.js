import express from "express";
import { auth, requireAdmin } from "../middleware/auth.js";
import { getPool } from "../config/db.js";

const router = express.Router();

// Listado de libros con paginación opcional y nombre de categoría
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 1000;
    const offset = (page - 1) * limit;
    const pool = await getPool();
    const [[{ total }]] = await pool.query("SELECT COUNT(*) as total FROM books");
    const [rows] = await pool.query(
      `SELECT b.*, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       ORDER BY b.id DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json({ items: rows, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron obtener los libros" });
  }
});

// Crear libro (solo admin)
router.post("/", auth, requireAdmin, async (req, res) => {
  try {
    const { title, author, price, image, description, stock, category_id } = req.body;
    const pool = await getPool();
    const [result] = await pool.query(
      "INSERT INTO books (title, author, price, image, description, stock, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [title, author, price || 0, image || "", description || "", stock || 0, category_id || null]
    );
    const insertedId = result.insertId;
    const [rows] = await pool.query(
      `SELECT b.*, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.id = ?`,
      [insertedId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo crear el libro" });
  }
});

// Actualizar libro (solo admin)
router.put("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();
    const [rows] = await pool.query("SELECT * FROM books WHERE id = ?", [id]);
    if (!rows.length) return res.status(404).json({ error: "Libro no encontrado" });
    const current = rows[0];
    const title = req.body.title ?? current.title;
    const author = req.body.author ?? current.author;
    const price = req.body.price !== undefined ? req.body.price : current.price;
    const image = req.body.image ?? current.image;
    const description = req.body.description ?? current.description;
    const stock = req.body.stock !== undefined ? req.body.stock : current.stock;
    const category_id = req.body.category_id !== undefined ? req.body.category_id : current.category_id;
    await pool.query(
      "UPDATE books SET title=?, author=?, price=?, image=?, description=?, stock=?, category_id=? WHERE id=?",
      [title, author, price || 0, image || "", description || "", stock || 0, category_id || null, id]
    );
    const [updated] = await pool.query(
      `SELECT b.*, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.id = ?`,
      [id]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar el libro" });
  }
});

// Eliminar libro (solo admin)
router.delete("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();
    await pool.query("DELETE FROM books WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo eliminar el libro" });
  }
});

export default router;
