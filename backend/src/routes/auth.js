const express = require("express");
const router = express.Router();

router.post("/login", (req, res) => {
  const { password } = req.body;
  const sharedPassword = process.env.SHARED_PASSWORD || "admin123";

  if (password === sharedPassword || !process.env.REQUIRE_AUTH) {
    res.cookie("interview_auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    return res.json({ success: true, message: "Authenticated successfully" });
  }

  return res.status(401).json({ error: "Invalid password" });
});

router.post("/logout", (req, res) => {
  res.clearCookie("interview_auth");
  return res.json({ success: true, message: "Logged out" });
});

module.exports = router;
