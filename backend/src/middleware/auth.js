const bcrypt = require("bcryptjs");

function authMiddleware(req, res, next) {
  // Allow public routes
  if (
    req.path.startsWith("/api/auth/login") ||
    req.path.startsWith("/uploads") ||
    req.path === "/health"
  ) {
    return next();
  }

  const authCookie = req.cookies?.interview_auth;
  if (authCookie && authCookie === "authenticated") {
    return next();
  }

  // Authorization Header fallback
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return next();
  }

  // If no auth required in dev mode, proceed
  if (process.env.NODE_ENV === "development" || !process.env.REQUIRE_AUTH) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized. Shared password required." });
}

module.exports = { authMiddleware };
