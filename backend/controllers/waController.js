const waClient = require('../config/waClient');

// GET: Ambil Status & QR Code WhatsApp
async function getWaStatus(req, res) {
  try {
    res.json({
      success: true,
      data: {
        isReady: waClient.waState.isReady,
        authenticated: waClient.waState.authenticated,
        qrCode: waClient.waState.qrCodeDataUrl,
        phoneNumber: waClient.waState.phoneNumber
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// POST: Logout WhatsApp dari Dashboard Admin
// POST: Logout WhatsApp dari Dashboard Admin
async function logoutWa(req, res) {
  try {
    if (waClient.waState.isReady || waClient.waState.authenticated) {
      await waClient.logout(); // Panggil logout bawaan

      // Reset state
      waClient.waState.isReady = false;
      waClient.waState.authenticated = false;
      waClient.waState.qrCodeDataUrl = null;
      waClient.waState.phoneNumber = null;

      // PENTING: Panggil inisialisasi ulang agar library mendeteksi ulang status & menghasilkan QR Code baru
      if (typeof waClient.initialize === 'function') {
        waClient.initialize();
      } else if (waClient.client && typeof waClient.client.initialize === 'function') {
        await waClient.client.initialize();
      }

      return res.json({ success: true, message: 'WhatsApp berhasil dikeluarkan. QR Code baru sedang dibuat.' });
    }
    res.status(400).json({ success: false, message: 'WhatsApp belum terhubung.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getWaStatus,
  logoutWa
};