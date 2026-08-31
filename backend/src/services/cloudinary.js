const path = require("path");
const os = require("os");

/**
 * Returns the best local IP address for LAN access.
 * Falls back to HOST_IP env var if set, then auto-detects.
 */
function getHostIp() {
  if (process.env.HOST_IP) return process.env.HOST_IP;
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (e) {}
  return "localhost";
}

const HOST_IP = getHostIp();

/**
 * Local audio file storage.
 * Audio files are saved to disk by multer already.
 * Returns a LAN-accessible URL so remote devices can play audio.
 *
 * @param {String} filePath - Path to the already-saved audio file
 * @returns {Promise<String>} LAN URL accessible from any device on the network
 */
async function uploadAudio(filePath) {
  try {
    const fileName = path.basename(filePath);
    const localUrl = `http://${HOST_IP}:${process.env.PORT || 4000}/uploads/recordings/${fileName}`;
    console.log(`[Storage] Audio saved at: ${localUrl}`);
    return localUrl;
  } catch (err) {
    console.error("[Storage] Error building local audio URL:", err.message);
    const fileName = path.basename(filePath);
    return `/uploads/recordings/${fileName}`;
  }
}

module.exports = {
  uploadAudio,
  getHostIp,
  HOST_IP
};
