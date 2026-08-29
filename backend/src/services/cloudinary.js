const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "neugchyg",
  api_key: process.env.CLOUDINARY_API_KEY || "873364838956414",
  api_secret: process.env.CLOUDINARY_API_SECRET || "og37Q3XrAlIEQpghPENPY2ybIPw"
});

/**
 * Upload audio file to Cloudinary
 * @param {String} filePath - Path to local uploaded audio file
 * @returns {Promise<String>} Public URL of uploaded audio
 */
async function uploadAudio(filePath) {
  try {
    console.log(`Uploading audio to Cloudinary: ${filePath}...`);
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
      folder: "interview_transcripts",
      use_filename: true
    });
    console.log("Cloudinary Upload Success:", result.secure_url);
    return result.secure_url;
  } catch (err) {
    console.error("Cloudinary Upload Error detail:", err);
    // Return relative local file path URL fallback
    const fileName = path.basename(filePath);
    return `/uploads/recordings/${fileName}`;
  }
}

module.exports = {
  cloudinary,
  uploadAudio
};
