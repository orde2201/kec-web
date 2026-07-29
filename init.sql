-- ============================================================
-- 1. CLEANUP (Hapus tabel lama jika ada agar tidak bentrok)
-- ============================================================
DROP TABLE IF EXISTS halaman CASCADE;
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
CREATE TABLE berita (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    konten TEXT NOT NULL,
    gambar TEXT,
    kategori_id INT REFERENCES kategori_berita(id) ON DELETE CASCADE,
    penulis_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- E. Tabel Pengumuman
CREATE TABLE pengumuman (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    isi TEXT NOT NULL,
    instansi_id INT REFERENCES instansi(id) ON DELETE CASCADE,
    link_gform TEXT,
    gambar VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- F. Tabel Pengaturan Beranda, Logo & Footer (LENGKAP)
CREATE TABLE pengaturan_halaman (
    id SERIAL PRIMARY KEY,
    hero_image VARCHAR(255),
    about_image VARCHAR(255),
    about_title VARCHAR(255),
    about_desc TEXT,
    logo VARCHAR(255),
    footer_about TEXT,
    footer_address TEXT,
    footer_phone VARCHAR(100),
    footer_email VARCHAR(255),
    footer_copyright TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- G. Tabel Halaman Kustom / Blank Page
CREATE TABLE halaman (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    konten TEXT NOT NULL,
    tampilkan_di_header BOOLEAN DEFAULT TRUE,
    urutan INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 3. INPUT DATA AWAL (SEEDING DATA)
-- ============================================================

INSERT INTO instansi (id, nama_instansi) VALUES
(1, 'Umum / Publik'),
(2, 'Operations'),
(3, 'Sales'),
(4, 'Content'),
(5, 'Finance')
ON CONFLICT (id) DO NOTHING;

INSERT INTO kategori_berita (id, nama_kategori) VALUES
(1, 'Umum'),
(2, 'Pemerintahan'),
(3, 'Kegiatan Masyarakat'),
(4, 'Pendidikan & Kebudayaan'),
(5, 'Ekonomi & Usaha')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, "Nama", email, password, phone, "hakAkses", instansi_id, notes) VALUES
(1, 'Admin Utama', 'admin@gmail.com', 'admin123', '081234567890', 'Admin', 2, 'Superadmin Sistem'),
(2, 'User Biasa', 'user@gmail.com', 'user123', '089876543210', 'User', 3, 'Staf Sales')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pengumuman (id, judul, isi, instansi_id, link_gform, gambar) VALUES
(1, 'Selamat Datang di Portal Resmi', 'Pengumuman ini ditujukan untuk seluruh pengunjung publik maupun pengguna terdaftar.', NULL, 'https://forms.gle/sampleLink', NULL),
(2, 'Pengumuman Khusus Tim Operations', 'Diharapkan seluruh anggota tim Operations mengikuti rapat internal pukul 14.00 WIB.', 2, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO berita (id, judul, konten, gambar, kategori_id, penulis_id) VALUES
(1, 'Pembaruan Sistem Portal Berhasil Dilakukan', 'Sistem portal kini mendukung pemisahan hak akses per instansi dan publik.', NULL, 1, 1)
ON CONFLICT (id) DO NOTHING;

-- Seed Pengaturan Beranda, Logo & Footer
INSERT INTO pengaturan_halaman (
    id, 
    about_title, 
    about_desc, 
    footer_about, 
    footer_address, 
    footer_phone, 
    footer_email, 
    footer_copyright
) VALUES (
    1, 
    'Tentang Kecamatan Rumbia', 
    'Portal informasi dan layanan resmi Kecamatan Rumbia.',
    'Memberikan Pelayanan terbaik untuk masyarakat Kecamatan Rumbia secara efisien, transparan, dan akuntabel.',
    'Jl. Raya Kecamatan Rumbia No. 1, Lampung',
    '+62 812 3456 7890',
    'info@rumbia.go.id',
    'Kecamatan Rumbia'
) ON CONFLICT (id) DO NOTHING;

-- Seed Halaman Kustom Contoh
INSERT INTO halaman (id, judul, slug, konten, tampilkan_di_header, urutan) VALUES 
(1, 'Profil Kecamatan', 'profil-kecamatan', '<h2>Profil Kecamatan Rumbia</h2><p>Selamat datang di halaman profil resmi Kecamatan Rumbia...</p>', TRUE, 1),
(2, 'Visi & Misi', 'visi-misi', '<h2>Visi & Misi</h2><p><strong>Visi:</strong> Terwujudnya pelayanan publik yang prima dan unggul.</p>', TRUE, 2)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 4. SINKRONISASI SEQUENCE ID
-- ============================================================
SELECT setval('instansi_id_seq', (SELECT COALESCE(MAX(id), 1) FROM instansi));
SELECT setval('kategori_berita_id_seq', (SELECT COALESCE(MAX(id), 1) FROM kategori_berita));
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('berita_id_seq', (SELECT COALESCE(MAX(id), 1) FROM berita));
SELECT setval('pengumuman_id_seq', (SELECT COALESCE(MAX(id), 1) FROM pengumuman));
SELECT setval('pengaturan_halaman_id_seq', (SELECT COALESCE(MAX(id), 1) FROM pengaturan_halaman));
SELECT setval('halaman_id_seq', (SELECT COALESCE(MAX(id), 1) FROM halaman));

-- ============================================================
-- 1. CLEANUP (Hapus tabel lama jika ada agar tidak bentrok)
-- ============================================================
DROP TABLE IF EXISTS halaman CASCADE;
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
CREATE TABLE berita (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    konten TEXT NOT NULL,
    gambar TEXT,
    kategori_id INT REFERENCES kategori_berita(id) ON DELETE CASCADE,
    penulis_id INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- E. Tabel Pengumuman
CREATE TABLE pengumuman (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    isi TEXT NOT NULL,
    instansi_id INT REFERENCES instansi(id) ON DELETE CASCADE,
    link_gform TEXT,
    gambar VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- F. Tabel Pengaturan Beranda, Logo & Footer
CREATE TABLE pengaturan_halaman (
    id SERIAL PRIMARY KEY,
    hero_image VARCHAR(255),
    about_image VARCHAR(255),
    about_title VARCHAR(255),
    about_desc TEXT,
    logo VARCHAR(255),
    footer_about TEXT,
    footer_address TEXT,
    footer_phone VARCHAR(100),
    footer_email VARCHAR(255),
    footer_copyright TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- G. Tabel Halaman Kustom / Blank Page (DITAMBAHKAN KOLOM GAMBAR)
CREATE TABLE halaman (
    id SERIAL PRIMARY KEY,
    judul VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    konten TEXT NOT NULL,
    gambar VARCHAR(255),
    tampilkan_di_header BOOLEAN DEFAULT TRUE,
    urutan INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 3. INPUT DATA AWAL (SEEDING DATA)
-- ============================================================

INSERT INTO instansi (id, nama_instansi) VALUES
(1, 'Umum / Publik'),
(2, 'Operations'),
(3, 'Sales'),
(4, 'Content'),
(5, 'Finance')
ON CONFLICT (id) DO NOTHING;

INSERT INTO kategori_berita (id, nama_kategori) VALUES
(1, 'Umum'),
(2, 'Pemerintahan'),
(3, 'Kegiatan Masyarakat'),
(4, 'Pendidikan & Kebudayaan'),
(5, 'Ekonomi & Usaha')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, "Nama", email, password, phone, "hakAkses", instansi_id, notes) VALUES
(1, 'Admin Utama', 'admin@gmail.com', 'admin123', '081234567890', 'Admin', 2, 'Superadmin Sistem'),
(2, 'User Biasa', 'user@gmail.com', 'user123', '089876543210', 'User', 3, 'Staf Sales')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pengumuman (id, judul, isi, instansi_id, link_gform, gambar) VALUES
(1, 'Selamat Datang di Portal Resmi', 'Pengumuman ini ditujukan untuk seluruh pengunjung publik maupun pengguna terdaftar.', NULL, 'https://forms.gle/sampleLink', NULL),
(2, 'Pengumuman Khusus Tim Operations', 'Diharapkan seluruh anggota tim Operations mengikuti rapat internal pukul 14.00 WIB.', 2, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO berita (id, judul, konten, gambar, kategori_id, penulis_id) VALUES
(1, 'Pembaruan Sistem Portal Berhasil Dilakukan', 'Sistem portal kini mendukung pemisahan hak akses per instansi dan publik.', NULL, 1, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO pengaturan_halaman (
    id, about_title, about_desc, footer_about, footer_address, footer_phone, footer_email, footer_copyright
) VALUES (
    1, 
    'Tentang Kecamatan Rumbia', 
    'Portal informasi dan layanan resmi Kecamatan Rumbia.',
    'Memberikan Pelayanan terbaik untuk masyarakat Kecamatan Rumbia secara efisien, transparan, dan akuntabel.',
    'Jl. Raya Kecamatan Rumbia No. 1, Lampung',
    '+62 812 3456 7890',
    'info@rumbia.go.id',
    'Kecamatan Rumbia'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO halaman (id, judul, slug, konten, gambar, tampilkan_di_header, urutan) VALUES 
(1, 'Profil Kecamatan', 'profil-kecamatan', 'Profil Kecamatan Rumbia\n\nSelamat datang di halaman profil resmi Kecamatan Rumbia.', NULL, TRUE, 1),
(2, 'Visi & Misi', 'visi-misi', 'Visi & Misi\n\nVisi: Terwujudnya pelayanan publik yang prima dan unggul.', NULL, TRUE, 2)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 4. SINKRONISASI SEQUENCE ID
-- ============================================================
SELECT setval('instansi_id_seq', (SELECT COALESCE(MAX(id), 1) FROM instansi));
SELECT setval('kategori_berita_id_seq', (SELECT COALESCE(MAX(id), 1) FROM kategori_berita));
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('berita_id_seq', (SELECT COALESCE(MAX(id), 1) FROM berita));
SELECT setval('pengumuman_id_seq', (SELECT COALESCE(MAX(id), 1) FROM pengumuman));
SELECT setval('pengaturan_halaman_id_seq', (SELECT COALESCE(MAX(id), 1) FROM pengaturan_halaman));
SELECT setval('halaman_id_seq', (SELECT COALESCE(MAX(id), 1) FROM halaman));