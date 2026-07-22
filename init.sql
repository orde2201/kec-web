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

-- Membuat Tabel Berita
CREATE TABLE berita (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    konten TEXT NOT NULL,
    gambar VARCHAR(255), -- untuk menyimpan nama file gambar
    kategori_id INT NOT NULL REFERENCES kategori_berita(id) ON DELETE CASCADE,
    penulis_id INT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Membuat Tabel Pengaturan Halaman
CREATE TABLE pengaturan_halaman (
    id SERIAL PRIMARY KEY,
    hero_image VARCHAR(255),
    about_image VARCHAR(255),
    about_title VARCHAR(255),
    about_desc TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Data Awal (Default)
INSERT INTO pengaturan_halaman (hero_image, about_image, about_title, about_desc) 
VALUES ('image.png', 'about.jpg', 'Selamat Datang di Website Kecamatan Rumbia', 'Kecamatan Rumbia merupakan...');

-- 5. Data Awal (Opsional - Sebagai Contoh Pertama)
-- Pastikan instansi_id = 1 sudah ada (Operations)
-- 1. Insert Instansi (Master) DULU
INSERT INTO instansi (nama_instansi) VALUES ('Operations'), ('Sales'), ('Content'), ('Finance');

-- 2. Insert Kategori (Master)
INSERT INTO kategori_berita (nama_kategori) VALUES ('Pengumuman'), ('Kegiatan'), ('Edukasi');

-- 3. BARU Insert User (Karena butuh instansi_id = 1)
INSERT INTO users ("Nama", email, phone, "hakAkses", instansi_id) 
VALUES ('Admin HMD', 'admin@hmd.com', '08123456789', 'Admin', 1);