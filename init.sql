-- 1. Hapus tabel lama jika ada agar tidak bentrok
-- 2. Membuat Tabel Master Instansi
CREATE TABLE instansi (
    id SERIAL PRIMARY KEY,
    nama_instansi VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Membuat Tabel Master Kategori Berita
CREATE TABLE kategori_berita (
    id SERIAL PRIMARY KEY,
    nama_kategori VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Membuat Tabel Users yang sudah terelasi dengan Instansi
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    "Nama" VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    "hakAkses" VARCHAR(20) NOT NULL CHECK ("hakAkses" IN ('Admin', 'User')),
    instansi_id INT NOT NULL REFERENCES instansi(id) ON DELETE CASCADE, -- Menghubungkan ke tabel instansi
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Data Awal (Opsional - Sebagai Contoh Pertama)
INSERT INTO instansi (nama_instansi) VALUES ('Operations'), ('Sales'), ('Content'), ('Finance');
INSERT INTO kategori_berita (nama_kategori) VALUES ('Pengumuman'), ('Kegiatan'), ('Edukasi');