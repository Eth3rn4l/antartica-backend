import express from "express";
import { auth, requireAdmin } from "../middleware/auth.js";
import { getPool } from "../config/db.js";

const router = express.Router();

// Crear pedido a partir del carrito del usuario autenticado
router.post("/", auth, async (req, res) => {
  const pool = await getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [cartItems] = await conn.query(
      `SELECT ci.id, ci.book_id, ci.quantity, b.price
       FROM cart_items ci
       LEFT JOIN books b ON ci.book_id = b.id
       WHERE ci.user_id = ?`,
      [req.user.id]
    );
    if (!cartItems.length) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: "El carrito está vacío" });
    }
    const total = cartItems.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
    const [orderRes] = await conn.query(
      "INSERT INTO orders (user_id, status, total, order_date) VALUES (?, ?, ?, NOW())",
      [req.user.id, "pending", total]
    );
    const orderId = orderRes.insertId;
    for (const item of cartItems) {
      await conn.query(
        "INSERT INTO order_items (order_id, book_id, quantity, price) VALUES (?, ?, ?, ?)",
        [orderId, item.book_id, item.quantity, item.price || 0]
      );
    }
    await conn.query("DELETE FROM cart_items WHERE user_id = ?", [req.user.id]);
    await conn.commit();
    conn.release();
    const [orderRow] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_date, u.nombre AS user_nombre, u.email AS user_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [orderId]
    );
    res.json(orderRow[0]);
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error(err);
    res.status(500).json({ error: "No se pudo crear la orden" });
  }
});

// Listar órdenes (admin) con info descriptiva
router.get("/", auth, requireAdmin, async (_req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_date, u.nombre AS user_nombre, u.email AS user_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron obtener las órdenes" });
  }
});

// Órdenes propias del usuario
router.get("/me", auth, async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_date
       FROM orders o
       WHERE o.user_id = ?
       ORDER BY o.id DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron obtener las órdenes del usuario" });
  }
});

// Detalle de una orden con nombres descriptivos
router.get("/:id", auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();
    const [orders] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_date, u.nombre AS user_nombre, u.email AS user_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [id]
    );
    if (!orders.length) return res.status(404).json({ error: "Orden no encontrada" });
    // validar acceso para no-admin
    if (req.user.role !== "admin" && orders[0].user_email !== undefined && req.user.id !== undefined) {
      // check owner
      // req.user.id viene del token
      const [owner] = await pool.query("SELECT user_id FROM orders WHERE id = ?", [id]);
      if (owner.length && owner[0].user_id !== req.user.id) {
        return res.status(403).json({ error: "No autorizado" });
      }
    }
    const [items] = await pool.query(
      `SELECT oi.id, oi.quantity, oi.price, b.title AS book_title, b.author AS book_author
       FROM order_items oi
       LEFT JOIN books b ON oi.book_id = b.id
       WHERE oi.order_id = ?`,
      [id]
    );
    res.json({ ...orders[0], items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo obtener la orden" });
  }
});

// Actualizar estado de orden (admin)
router.put("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, total } = req.body;
    const pool = await getPool();
    const [rows] = await pool.query("SELECT * FROM orders WHERE id = ?", [id]);
    if (!rows.length) return res.status(404).json({ error: "Orden no encontrada" });
    await pool.query(
      "UPDATE orders SET status = ?, total = COALESCE(?, total) WHERE id = ?",
      [status || rows[0].status, total !== undefined ? total : rows[0].total, id]
    );
    const [updated] = await pool.query(
      `SELECT o.id, o.status, o.total, o.order_date, u.nombre AS user_nombre, u.email AS user_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [id]
    );
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar la orden" });
  }
});

// Eliminar orden (admin)
router.delete("/:id", auth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = await getPool();
    await pool.query("DELETE FROM orders WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo eliminar la orden" });
  }
});

export default router;
