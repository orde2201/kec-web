const { Pool } = require('pg');

const db = new Pool({
    user: process.env.POSTGRES_USER || "postgres",
    host: process.env.POSTGRES_HOST || "database",
    database: process.env.POSTGRES_DB || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
});

function connectWithRetry() {
    db.connect((err, client, release) => {
        if (err) {
            console.error('Database belum siap, mencoba lagi dalam 5 detik...', err.message);
            setTimeout(connectWithRetry, 5000);
        } else {
            console.log('Sukses terhubung ke database PostgreSQL!');
            release();
        }
    });
}

connectWithRetry();

module.exports = db;