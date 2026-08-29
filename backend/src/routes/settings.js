const express = require("express");
const router = express.Router();

module.exports = (prisma) => {
  // GET all settings
  router.get("/", async (req, res) => {
    try {
      const settingsList = await prisma.settings.findMany();
      const settingsMap = {
        llmBaseUrl: "http://localhost:11434/v1",
        llmApiKey: "",
        llmModel: "llama3.1",
        transcriptionUrl: process.env.WHISPER_SERVICE_URL || "http://localhost:9000",
        cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "neugchyg"
      };

      settingsList.forEach((s) => {
        settingsMap[s.key] = s.value;
      });

      res.json(settingsMap);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT update settings
  router.put("/", async (req, res) => {
    try {
      const updates = req.body; // { key: value, ... }

      for (const [key, value] of Object.entries(updates)) {
        await prisma.settings.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) }
        });
      }

      res.json({ success: true, message: "Settings updated successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
