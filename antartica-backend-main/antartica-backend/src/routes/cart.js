import express from "express";
import { auth } from "../middleware/auth.js";
import { getPool } from "../config/db.js";

const router = express.Router();

// Obtener carrito con info descriptiva del libro
router.get("/", auth, async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT ci.id,
              ci.book_id,
              ci.quantity,
              b.title,
              b.author,
              b.price,
              b.image,
              c.name AS category_name
       FROM cart_items ci
       LEFT JOIN books b ON ci.book_id = b.id
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE ci.user_id = ?`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo obtener el carrito" });
  }
});

// Agregar al carrito
router.post("/", auth, async (req, res) => {
  try {
    const { book_id, quantity } = req.body;
    if (!book_id) return res.status(400).json({ error: "book_id requerido" });
    const qty = Number(quantity) || 1;
    const pool = await getPool();

    const [books] = await pool.query("SELECT stock FROM books WHERE id = ? LIMIT 1", [book_id]);
    if (!books.length) return res.status(404).json({ error: "Libro no encontrado" });
    if (books[0].stock <= 0 || books[0].stock < qty) return res.status(400).json({ error: "Stock insuficiente" });

    await pool.query("INSERT INTO cart_items (user_id, book_id, quantity) VALUES (?, ?, ?)", [
      req.user.id,
      book_id,
      qty
    ]);
    await pool.query("UPDATE books SET stock = stock - ? WHERE id = ?", [qty, book_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo agregar al carrito" });
  }
});

// Eliminar item del carrito
router.delete("/:id", auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();
    const [rows] = await pool.query(
      "SELECT book_id, quantity FROM cart_items WHERE id = ? AND user_id = ? LIMIT 1",
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Item no encontrado" });
    const item = rows[0];
    await pool.query("DELETE FROM cart_items WHERE id = ?", [id]);
    await pool.query("UPDATE books SET stock = stock + ? WHERE id = ?", [item.quantity, item.book_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo eliminar el item" });
  }
});

// Checkout simple (vaciar carrito para cliente)
router.post("/checkout", auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== "client") {
      return res.status(403).json({ error: "Solo clientes pueden pagar" });
    }
    const pool = await getPool();
    const [items] = await pool.query("SELECT id FROM cart_items WHERE user_id = ?", [req.user.id]);
    if (!items.length) return res.status(400).json({ error: "El carrito está vacío" });
    await pool.query("DELETE FROM cart_items WHERE user_id = ?", [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo procesar el pago" });
  }
});

export default router;
