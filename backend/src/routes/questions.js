const express = require("express");
const router = express.Router();

module.exports = (prisma) => {
  // GET all questions
  router.get("/", async (req, res) => {
    try {
      const questions = await prisma.question.findMany({
        orderBy: { createdAt: "asc" }
      });
      res.json(questions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create new question
  router.post("/", async (req, res) => {
    try {
      const { text, category, description, isCustom } = req.body;
      if (!text) return res.status(400).json({ error: "Question text is required" });

      const question = await prisma.question.create({
        data: {
          text: text.trim(),
          category: category || "General",
          description: description?.trim() || "",
          isCustom: isCustom ?? true
        }
      });
      res.status(201).json(question);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE question
  router.delete("/:id", async (req, res) => {
    try {
      await prisma.question.delete({
        where: { id: req.params.id }
      });
      res.json({ success: true, message: "Question deleted" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
