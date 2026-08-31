const path = require("path");
const os = require("os");

/**
 * Returns the best local IP address for LAN access.
 * Falls back to HOST_IP env var if set, then auto-detects.
 */
function getHostIp() {
  if (process.env.HOST_IP) return process.env.HOST_IP.trim();
  try {
    const interfaces = os.networkInterfaces();
    const virtualKeywords = ["radmin", "vpn", "warp", "docker", "vethernet", "virtual", "loopback", "teredo", "vmware", "hyper-v", "tailscale", "zerotier"];

    // First pass: find IPv4 on standard physical LAN interfaces (Wi-Fi, Ethernet)
    for (const name of Object.keys(interfaces)) {
      const lowerName = name.toLowerCase();
      const isVirtual = virtualKeywords.some((v) => lowerName.includes(v));
      if (isVirtual) continue;

      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          // Check standard private LAN subnets (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
          if (
            iface.address.startsWith("192.168.") ||
            iface.address.startsWith("10.") ||
            (iface.address.startsWith("172.") && !isVirtual)
          ) {
            return iface.address;
          }
        }
      }
    }

    // Second pass: any non-internal IPv4 not matching virtual keywords
    for (const name of Object.keys(interfaces)) {
      const lowerName = name.toLowerCase();
      if (virtualKeywords.some((v) => lowerName.includes(v))) continue;
      for (const iface of interfaces[name]) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (e) {}
  return "localhost";
}

/**
 * Local audio file storage.
 * Audio files are saved to disk by multer already.
 * Returns a LAN-accessible URL so remote devices can play audio.
 *
 * @param {String} filePath - Path to the already-saved audio file
 * @returns {Promise<String>} LAN URL accessible from any device on the network
 */
async function uploadAudio(filePath) {
  const hostIp = getHostIp();
  try {
    const fileName = path.basename(filePath);
    const localUrl = `http://${hostIp}:${process.env.PORT || 4000}/uploads/recordings/${fileName}`;
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
  get HOST_IP() {
    return getHostIp();
  }
};
