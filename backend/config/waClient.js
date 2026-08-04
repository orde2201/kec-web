const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode'); // Library untuk konversi ke Base64 DataURL
const fs = require('fs');
const path = require('path');

// Helper untuk menghapus file SingletonLock bekas crash/restart
function removeChromiumLocks(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (file.includes('SingletonLock') || file.includes('SingletonSocket') || file.includes('SingletonCookie')) {
        try {
          fs.unlinkSync(fullPath);
          console.log(`🧹 Membersihkan stale lock: ${file}`);
        } catch (e) {}
      } else if (fs.statSync(fullPath).isDirectory()) {
        removeChromiumLocks(fullPath);
      }
    }
  } catch (err) {
    // Abaikan jika ada error permission
  }
}

// Bersihkan folder auth sebelum launch
const authPath = path.join(process.cwd(), '.wwebjs_auth');
removeChromiumLocks(authPath);

// Deteksi path Chromium
function getChromiumPath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  if (fs.existsSync('/usr/bin/chromium-browser')) {
    return '/usr/bin/chromium-browser';
  }
  if (fs.existsSync('/usr/bin/chromium')) {
    return '/usr/bin/chromium';
  }
  return undefined;
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: getChromiumPath(),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process'
    ]
  }
});

// State Global untuk menyimpan status WhatsApp & Gambar QR Code
client.waState = {
  isReady: false,
  qrCodeDataUrl: null,
  authenticated: false,
  phoneNumber: null
};

// Event QR Code Diterima
client.on('qr', async (qr) => {
  client.waState.isReady = false;
  client.waState.authenticated = false;
  
  // Konversi QR Text ke Gambar Base64 (DataURL) untuk Frontend
  try {
    client.waState.qrCodeDataUrl = await QRCode.toDataURL(qr);
  } catch (err) {
    console.error('Gagal membuat QR DataURL:', err.message);
  }

  // Tetap tampilkan di terminal sebagai cadangan
  console.log('\n==================================================');
  console.log('📲 SCAN QR CODE INI MENGGUNAKAN WHATSAPP DI HP ANDA');
  console.log('==================================================');
  qrcodeTerminal.generate(qr, { small: true });
});

// Event Berhasil Terhubung
client.on('ready', () => {
  client.waState.isReady = true;
  client.waState.authenticated = true;
  client.waState.qrCodeDataUrl = null; // Hapus QR jika sudah terhubung
  
  if (client.info && client.info.wid) {
    client.waState.phoneNumber = client.info.wid.user;
  }

  console.log('✅ WhatsApp Gateway Berhasil Terhubung & Siap Digunakan!');
});

// Event Disconnected / Terputus
client.on('disconnected', (reason) => {
  console.log('⚠️ WhatsApp Terputus:', reason);
  client.waState.isReady = false;
  client.waState.authenticated = false;
  client.waState.qrCodeDataUrl = null;
  client.waState.phoneNumber = null;
  
  // Inisialisasi ulang agar QR baru bisa dibuat lagi
  client.initialize();
});

client.initialize();

module.exports = client;