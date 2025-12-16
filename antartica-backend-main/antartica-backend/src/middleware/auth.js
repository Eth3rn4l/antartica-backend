import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token faltante" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Token inválido o expirado" });
  }
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Solo administradores" });
  }
  next();
};
