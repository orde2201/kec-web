// ==========================================
// CONTROLLER: STORAGE STATS (UBUNTU VPS REAL)
// ==========================================
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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

function getVPSDiskInfo(targetPath) {
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(targetPath);
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize;

      return {
        totalDiskGB: parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(2)),
        freeDiskGB: parseFloat((freeBytes / (1024 * 1024 * 1024)).toFixed(2)),
        usedDiskGB: parseFloat(((totalBytes - freeBytes) / (1024 * 1024 * 1024)).toFixed(2))
      };
    }

    const output = execSync(`df -k "${targetPath}"`).toString();
    const lines = output.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].replace(/\s+/g, ' ').split(' ');
      const totalKB = parseInt(parts[1], 10);
      const freeKB = parseInt(parts[3], 10);

      const totalDiskGB = parseFloat((totalKB / (1024 * 1024)).toFixed(2));
      const freeDiskGB = parseFloat((freeKB / (1024 * 1024)).toFixed(2));
      const usedDiskGB = parseFloat(((totalKB - freeKB) / (1024 * 1024)).toFixed(2));

      return { totalDiskGB, freeDiskGB, usedDiskGB };
    }
  } catch (err) {
    console.error('Gagal membaca disk VPS:', err.message);
  }

  return { totalDiskGB: 0, freeDiskGB: 0, usedDiskGB: 0 };
}

function getStorageStats(req, res) {
  try {
    const totalBytes = getFolderSize(uploadDir);
    const uploadsSizeMB = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
    
    // Ambil Info Disk Fisik VPS Ubuntu
    const diskInfo = getVPSDiskInfo(uploadDir);

    // Hitung Total Kuota berdasarkan Total Disk VPS dalam MB (contoh: 57 GB * 1024 = 58,368 MB)
    const totalVPSDiskMB = Math.round(diskInfo.totalDiskGB * 1024);

    res.json({
      success: true,
      data: {
        uploadsSizeMB: uploadsSizeMB,
        totalVPSDiskMB: totalVPSDiskMB, // Total ukuran fisik VPS dalam MB
        freeDiskGB: diskInfo.freeDiskGB,
        totalDiskGB: diskInfo.totalDiskGB,
        usedDiskGB: diskInfo.usedDiskGB
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, data: null });
  }
}

module.exports = { getStorageStats };