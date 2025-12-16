import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initDb } from "./config/db.js";

import authRoutes from "./routes/auth.js";
import bookRoutes from "./routes/books.js";
import userRoutes from "./routes/users.js";
import cartRoutes from "./routes/cart.js";
import categoryRoutes from "./routes/categories.js";
import orderRoutes from "./routes/orders.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Función principal de inicio
const start = async () => {
  await initDb();

  app.use("/api/auth", authRoutes);
  app.use("/api/books", bookRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/cart", cartRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/orders", orderRoutes);

  // Servir frontend (versión build) desde /public
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.join(__dirname, "..", "public");
  app.use(express.static(publicDir));

  app.get("*", (_req, res) =>
    res.sendFile(path.join(publicDir, "index.html"))
  );

  const port = process.env.PORT || 4000;

  // ESCUCHAR EN TODAS LAS IP (REQUIRED para EC2)
  app.listen(port, "0.0.0.0", () => {
    console.log("Backend corriendo en puerto", port);
  });
};

start();

