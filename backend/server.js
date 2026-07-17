require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import Rute-rute Mandiri
const userRoutes = require('./routes/userRoutes');
const instansiRoutes = require('./routes/instansiRoutes');
const kategoriRoutes = require('./routes/kategoriRoutes');

const app = express();

// Middleware Global
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4000',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// Registrasi Route ke API Global (prefix: /api)
app.use('/api', userRoutes);
app.use('/api', instansiRoutes);
app.use('/api', kategoriRoutes);

// Menjalankan Server Aplikasi
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Backend server berjalan di port ${PORT}`);
});