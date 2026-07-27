-- ============================================================
-- 1. CLEANUP (Hapus tabel lama jika ada agar tidak bentrok)
-- ============================================================
DROP TABLE IF EXISTS berita CASCADE;
DROP TABLE IF EXISTS pengumuman CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS kategori_berita CASCADE;
DROP TABLE IF EXISTS instansi CASCADE;
DROP TABLE IF EXISTS pengaturan_halaman CASCADE;

-- ============================================================
-- 2. PEMBUATAN TABEL-TABEL
-- ============================================================

-- A. Tabel Instansi
CREATE TABLE instansi (
    id SERIAL PRIMARY KEY,
    nama_instansi VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- B. Tabel Kategori Berita
CREATE TABLE kategori_berita (
    id SERIAL PRIMARY KEY,
    nama_kategori VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- C. Tabel Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    "Nama" VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    "hakAkses" VARCHAR(50) NOT NULL DEFAULT 'User',
    instansi_id INT REFERENCES instansi(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- D. Tabel Berita
-- D. Tabel Berita
CREATE TABLE berita (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    konten TEXT NOT NULL,
    gambar TEXT, -- Diubah ke TEXT untuk menampung banyak nama file
    kategori_id INT REFERENCES kategori_berita(id) ON DELETE CASCADE,
    penulis_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- E. Tabel Pengumuman (instansi_id NULL = Everyone / Publik)
CREATE TABLE pengumuman (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    isi TEXT NOT NULL,
    instansi_id INT REFERENCES instansi(id) ON DELETE CASCADE,
    link_gform TEXT,
    gambar VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- F. Tabel Pengaturan Beranda
CREATE TABLE pengaturan_halaman (
    id SERIAL PRIMARY KEY,
    hero_image VARCHAR(255),
    about_image VARCHAR(255),
    about_title VARCHAR(255),
    about_desc TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. INPUT DATA AWAL (SEEDING TERSELARAS)
-- ============================================================

-- Seed Data Instansi (ID 1-5 diselaraskan)
INSERT INTO instansi (id, nama_instansi) VALUES
(1, 'Umum / Publik'),
(2, 'Operations'),
(3, 'Sales'),
(4, 'Content'),
(5, 'Finance');

-- Seed Data Kategori Berita (ID 1-5 persis sama)
INSERT INTO kategori_berita (id, nama_kategori) VALUES
(1, 'Umum / Everyone'),
(2, 'Operations'),
(3, 'Sales'),
(4, 'Content'),
(5, 'Finance');

-- Seed Data Users (Default Admin & User)
INSERT INTO users (id, "Nama", email, password, phone, "hakAkses", instansi_id, notes) VALUES
(1, 'Admin Utama', 'admin@gmail.com', 'admin123', '081234567890', 'Admin', 2, 'Superadmin Sistem'),
(2, 'User Biasa', 'user@gmail.com', 'user123', '089876543210', 'User', 3, 'Staf Sales');

-- Seed Data Pengumuman Awal (Termasuk Kolom link_gform dan gambar)
INSERT INTO pengumuman (id, judul, isi, instansi_id, link_gform, gambar) VALUES
(1, 'Selamat Datang di Portal Resmi', 'Pengumuman ini ditujukan untuk seluruh pengunjung publik maupun pengguna terdaftar.', NULL, 'https://forms.gle/sampleLink', NULL),
(2, 'Pengumuman Khusus Tim Operations', 'Diharapkan seluruh anggota tim Operations mengikuti rapat internal pukul 14.00 WIB.', 2, NULL, NULL);

-- Seed Data Berita Awal
INSERT INTO berita (id, judul, konten, gambar, kategori_id, penulis_id) VALUES
(1, 'Pembaruan Sistem Portal Berhasil Dilakukan', 'Sistem portal kini mendukung pemisahan hak akses per instansi dan publik.', NULL, 1, 1);

-- Seed Data Pengaturan Beranda
INSERT INTO pengaturan_halaman (id, about_title, about_desc) VALUES
(1, 'Tentang Kecamatan Rumbia', 'Portal informasi dan layanan resmi Kecamatan Rumbia.');

-- ============================================================
-- 4. SINKRONISASI SEQUENCE (ID Otomatis Mulai dari ID 6)
-- ============================================================
SELECT setval('instansi_id_seq', (SELECT MAX(id) FROM instansi));
SELECT setval('kategori_berita_id_seq', (SELECT MAX(id) FROM kategori_berita));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('berita_id_seq', (SELECT MAX(id) FROM berita));
SELECT setval('pengumuman_id_seq', (SELECT MAX(id) FROM pengumuman));
SELECT setval('pengaturan_halaman_id_seq', (SELECT MAX(id) FROM pengaturan_halaman));