// ==========================================
// KONFIGURASI NODEMAILER (PENGIRIM EMAIL)
// ==========================================
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'igede.123140163@student.itera.ac.id',
    pass: process.env.EMAIL_PASS || 'mboo efej bsdl mlox',
  },
});

module.exports = transporter;
