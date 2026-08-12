// ==========================================
// CONTROLLER: STORAGE STATS (AKURAT UNTUK UBUNTU VPS)
// ==========================================
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { uploadDir } = require('../middleware/upload');

// Hitung total ukuran folder uploads secara rekursif
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

// Pembacaan kapasitas Disk VPS Ubuntu secara Akurat
function getVPSDiskInfo(targetPath) {
  try {
    // Cara 1: Menggunakan API Bawaan Node.js (fs.statfsSync)
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(targetPath);
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize; // bavail = space yang tersedia untuk non-root user

      return {
        totalDiskGB: parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(2)),
        freeDiskGB: parseFloat((freeBytes / (1024 * 1024 * 1024)).toFixed(2)),
        usedDiskGB: parseFloat(((totalBytes - freeBytes) / (1024 * 1024 * 1024)).toFixed(2))
      };
    }

    // Cara 2: Fallback Perintah Linux `df -k` untuk Ubuntu
    const output = execSync(`df -k "${targetPath}"`).toString();
    const lines = output.trim().split('\n');
    if (lines.length >= 2) {
      // Ambil baris output df
      const parts = lines[1].replace(/\s+/g, ' ').split(' ');
      // parts[1] = Total 1K-blocks, parts[3] = Available 1K-blocks
      const totalKB = parseInt(parts[1], 10);
      const freeKB = parseInt(parts[3], 10);

      const totalDiskGB = parseFloat((totalKB / (1024 * 1024)).toFixed(2));
      const freeDiskGB = parseFloat((freeKB / (1024 * 1024)).toFixed(2));
      const usedDiskGB = parseFloat(((totalKB - freeKB) / (1024 * 1024)).toFixed(2));

      return { totalDiskGB, freeDiskGB, usedDiskGB };
    }
  } catch (err) {
    console.error('⚠️ Gagal membaca statistik disk Ubuntu VPS:', err.message);
  }

  return { totalDiskGB: 0, freeDiskGB: 0, usedDiskGB: 0 };
}

function getStorageStats(req, res) {
  try {
    // 1. Ukuran folder /uploads
    const totalBytes = getFolderSize(uploadDir);
    const uploadsSizeMB = parseFloat((totalBytes / (1024 * 1024)).toFixed(2));
    
    // Alokasi kuota khusus aplikasi (jika di-set di .env)
    const maxQuotaMB = parseInt(process.env.MAX_STORAGE_QUOTA_MB || '1024', 10);

    // 2. Baca Kapasitas Real VPS Ubuntu dari lokasi uploadDir
    const diskInfo = getVPSDiskInfo(uploadDir);

    res.json({
      success: true,
      data: {
        uploadsSizeMB: uploadsSizeMB,
        maxQuotaMB: maxQuotaMB,
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