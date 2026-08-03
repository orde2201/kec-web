const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
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
    // Abaikan jika ada error permission saat pembacaan folder
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
      '--single-process' // 👈 Membantu mencegah dangling process di Docker
    ]
  }
});

client.on('qr', (qr) => {
  console.log('\n==================================================');
  console.log('📲 SCAN QR CODE INI MENGGUNAKAN WHATSAPP DI HP ANDA');
  console.log('==================================================');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp Gateway Berhasil Terhubung & Siap Digunakan!');
});

client.initialize();

module.exports = client;