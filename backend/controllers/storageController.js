// ==========================================
// CONTROLLER: STORAGE STATS
// ==========================================
const fs = require('fs');
const path = require('path');
const { uploadDir } = require('../middleware/upload');

function getFolderSize(dirPath) {
  let totalSize = 0;
  if (!fs.existsSync(dirPath)) return 0;

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile()) {
      totalSize += stats.size;
    } else if (stats.isDirectory()) {
      totalSize += getFolderSize(filePath);
    }
  }
  return totalSize;
}

function getStorageStats(req, res) {
  try {
    const totalBytes = getFolderSize(uploadDir);
    const uploadsSizeMB = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
    const maxQuotaMB = parseInt(process.env.MAX_STORAGE_QUOTA_MB || '1024', 10);

    res.json({
      success: true,
      data: {
        uploadsSizeMB: uploadsSizeMB,
        maxQuotaMB: maxQuotaMB,
        freeDiskGB: 20,
        totalDiskGB: 50
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
}

module.exports = { getStorageStats };
