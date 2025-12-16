import dotenv from "dotenv";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

dotenv.config();

const DB_NAME = process.env.DB_NAME || "BDANTARTICA-LOCAL";
const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: DB_NAME,
};

let pool;

const sampleCategories = [
  { name: "Realismo Mágico" },
  { name: "Infantil" },
  { name: "Distopía" },
  { name: "Fantasía" }
];

const sampleBooks = [
  { title: "Cien Años de Soledad", author: "Gabriel García Márquez", price: 12000, image: "/assets/cienanos.png", description: "Una novela mágica y realista sobre la familia Buendía.", stock: 10, category: "Realismo Mágico" },
  { title: "El Principito", author: "Antoine de Saint-Exupéry", price: 8000, image: "/assets/principito.png", description: "Un clásico cuento filosófico sobre la vida y la amistad.", stock: 10, category: "Infantil" },
  { title: "1984", author: "George Orwell", price: 9500, image: "/assets/1984.png", description: "Distopía clásica sobre vigilancia y totalitarismo.", stock: 10, category: "Distopía" },
  { title: "Harry Potter y la Piedra Filosofal", author: "J.K. Rowling", price: 11000, image: "/assets/piedrafil.png", description: "El inicio de la saga del joven mago.", stock: 10, category: "Fantasía" },
  { title: "Harry Potter y la Cámara Secreta", author: "J.K. Rowling", price: 11000, image: "/assets/camarasecreta.png", description: "Segunda aventura de Harry en Hogwarts.", stock: 10, category: "Fantasía" },
  { title: "Harry Potter y el Prisionero de Azkaban", author: "J.K. Rowling", price: 11000, image: "/assets/azkaban.png", description: "Tercera entrega con misterio y viaje en el tiempo.", stock: 10, category: "Fantasía" },
  { title: "Harry Potter y el Cáliz de Fuego", author: "J.K. Rowling", price: 12000, image: "/assets/calizdefuego.png", description: "Torneo de los tres magos y peligros crecientes.", stock: 10, category: "Fantasía" },
  { title: "Harry Potter y la Orden del Fénix", author: "J.K. Rowling", price: 13000, image: "/assets/ordenfenix.png", description: "La resistencia contra las fuerzas oscuras se organiza.", stock: 10, category: "Fantasía" },
  { title: "Harry Potter y el Misterio del Príncipe", author: "J.K. Rowling", price: 13000, image: "/assets/misprince.png", description: "Se revelan secretos del pasado y alianzas importantes.", stock: 10, category: "Fantasía" }
];

async function ensureDatabaseExists() {
  const tmp = await mysql.createConnection({
    host: DB_CONFIG.host,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
  });
  await tmp.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await tmp.end();
}

export const getPool = async () => {
  if (!pool) {
    pool = mysql.createPool({
      host: DB_CONFIG.host,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      database: DB_CONFIG.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
};

export const initDb = async () => {
  await ensureDatabaseExists();
  const p = await getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT,
      nombre VARCHAR(100),
      apellido VARCHAR(100),
      email VARCHAR(150) UNIQUE,
      password VARCHAR(256),
      telefono VARCHAR(30),
      region VARCHAR(100),
      comuna VARCHAR(100),
      rut VARCHAR(30),
      role VARCHAR(20) DEFAULT 'client',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(150) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS books (
      id INT NOT NULL AUTO_INCREMENT,
      category_id INT,
      title VARCHAR(200),
      author VARCHAR(200),
      price DECIMAL(10,2) DEFAULT 0,
      image VARCHAR(255),
      description TEXT,
      stock INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_books_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT,
      book_id INT,
      quantity INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_cart_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      total DECIMAL(10,2) DEFAULT 0,
      order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT NOT NULL AUTO_INCREMENT,
      order_id INT NOT NULL,
      book_id INT NOT NULL,
      quantity INT DEFAULT 1,
      price DECIMAL(10,2) DEFAULT 0,
      PRIMARY KEY (id),
      CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_oi_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      token VARCHAR(255) UNIQUE,
      expires_at DATETIME,
      revoked TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Seeds de usuarios
  const adminPass = bcrypt.hashSync("admin123", 10);
  await p.query(
    `INSERT INTO users (nombre, apellido, email, password, role)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), apellido=VALUES(apellido), password=VALUES(password), role=VALUES(role)`,
    ["Administrador", "", "admin@admin.com", adminPass, "admin"]
  );

  const clientPass = bcrypt.hashSync("cliente123", 10);
  await p.query(
    `INSERT INTO users (nombre, apellido, email, password, telefono, region, comuna, rut, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), apellido=VALUES(apellido), password=VALUES(password), telefono=VALUES(telefono), region=VALUES(region), comuna=VALUES(comuna), rut=VALUES(rut), role=VALUES(role)`,
    ["Cliente", "Prueba", "cliente@cliente.com", clientPass, "+56912345678", "Metropolitana", "Santiago", "20.142.499-2", "client"]
  );

  // Seeds de categorías
  for (const c of sampleCategories) {
    await p.query(
      `INSERT INTO categories (name) VALUES (?) ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [c.name]
    );
  }

  // Asegurar columna category_id en books para instalaciones previas
  const [colCheck] = await p.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'books' AND COLUMN_NAME = 'category_id'`,
    [DB_NAME]
  );
  if (!colCheck.length) {
    await p.query("ALTER TABLE books ADD COLUMN category_id INT NULL");
    // Intentar agregar FK; si ya existe o falla, continuar
    try {
      await p.query(
        "ALTER TABLE books ADD CONSTRAINT fk_books_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL"
      );
    } catch (err) {
      console.warn("No se pudo agregar FK de category_id (puede existir):", err.message);
    }
  }

  // Mapa de categoría -> id
  const [catRows] = await p.query("SELECT id, name FROM categories");
  const catMap = Object.fromEntries(catRows.map((c) => [c.name, c.id]));

  // Asegurar catálogo mínimo: insertar/actualizar con categoría y stock
  for (const b of sampleBooks) {
    const categoryId = catMap[b.category] || null;
    await p.query(
      `INSERT INTO books (title, author, price, image, description, stock, category_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         price=VALUES(price),
         image=VALUES(image),
         description=VALUES(description),
         stock=GREATEST(stock, VALUES(stock)),
         category_id=VALUES(category_id)`,
      [b.title, b.author, b.price, b.image, b.description, b.stock, categoryId]
    );
  }

  console.log("MySQL conectado y tablas listas");
};
