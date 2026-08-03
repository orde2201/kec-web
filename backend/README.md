# Struktur Backend (Router & Controller)

`server.js` (1 file, ~900 baris) sudah dipecah menjadi struktur MVC-ringan
berikut. **Semua endpoint, URL, dan perilaku tetap identik** dengan versi
sebelumnya — ini murni pemisahan tanggung jawab kode, bukan perubahan fungsi.

```
backend/
├── app.js                     # Entry point: setup middleware, static, routes, listen
├── package.json
├── .env.example
│
├── config/
│   ├── db.js                  # Pool koneksi PostgreSQL + pool.on('error') + tes koneksi
│   └── mailer.js               # Konfigurasi transporter Nodemailer
│
├── middleware/
│   ├── security.js            # helmet, cors, rate limiter, blokir file sensitif
│   ├── upload.js               # Konfigurasi multer (validasi tipe & ukuran file)
│   └── errorHandler.js        # 404 /api + error handler terpusat
│
├── utils/
│   └── sanitize.js            # sanitizePlainText, sanitizeRichText, escapeHtml,
│                               # isValidEmail, isValidHttpUrl, verifyPassword, buatSlug
│
├── services/
│   └── emailService.js        # kirimEmailPengumuman() — logika kirim email notifikasi
│
├── controllers/                # Logika bisnis tiap domain (menerima req, res)
│   ├── kategoriController.js
│   ├── instansiController.js
│   ├── beritaController.js
│   ├── pengumumanController.js
│   ├── storageController.js
│   ├── usersController.js
│   ├── pengaturanController.js
│   └── halamanController.js
│
└── routes/                     # Definisi path + middleware per endpoint
    ├── index.js                # Menggabungkan semua router di bawah /api
    ├── kategoriRoutes.js
    ├── instansiRoutes.js
    ├── beritaRoutes.js
    ├── pengumumanRoutes.js
    ├── storageRoutes.js
    ├── usersRoutes.js
    ├── pengaturanRoutes.js
    └── halamanRoutes.js
```

## Pemetaan endpoint (tidak berubah)

| Method | Endpoint                     | Route file              | Controller function              |
|--------|-------------------------------|--------------------------|-----------------------------------|
| GET    | /api/kategori                 | kategoriRoutes.js       | getKategori                       |
| POST   | /api/kategori                 | kategoriRoutes.js       | createKategori                    |
| DELETE | /api/kategori/:id             | kategoriRoutes.js       | deleteKategori                    |
| GET    | /api/instansi                 | instansiRoutes.js       | getInstansi                       |
| POST   | /api/instansi                 | instansiRoutes.js       | createInstansi                    |
| DELETE | /api/instansi/:id             | instansiRoutes.js       | deleteInstansi                    |
| GET    | /api/berita                   | beritaRoutes.js         | getBerita                         |
| GET    | /api/berita/:id               | beritaRoutes.js         | getBeritaById                     |
| POST   | /api/berita                   | beritaRoutes.js         | createBerita                      |
| PUT    | /api/berita/:id               | beritaRoutes.js         | updateBerita                      |
| DELETE | /api/berita/:id               | beritaRoutes.js         | deleteBerita                      |
| GET    | /api/pengumuman               | pengumumanRoutes.js     | getPengumuman                     |
| GET    | /api/pengumuman/:id           | pengumumanRoutes.js     | getPengumumanById                 |
| POST   | /api/pengumuman               | pengumumanRoutes.js     | createPengumuman                  |
| PUT    | /api/pengumuman/:id           | pengumumanRoutes.js     | updatePengumuman                  |
| DELETE | /api/pengumuman/:id           | pengumumanRoutes.js     | deletePengumuman                  |
| GET    | /api/storage-stats             | storageRoutes.js        | getStorageStats                   |
| GET    | /api/users                    | usersRoutes.js          | getUsers                          |
| POST   | /api/add-users                | usersRoutes.js          | addUser                           |
| POST   | /api/login                    | usersRoutes.js          | login (+ loginLimiter)            |
| GET    | /api/pengaturan               | pengaturanRoutes.js     | getPengaturan                     |
| POST   | /api/pengaturan                | pengaturanRoutes.js     | handlePengaturanUpdate            |
| POST   | /api/pengaturan/update        | pengaturanRoutes.js     | handlePengaturanUpdate            |
| GET    | /api/halaman                  | halamanRoutes.js        | getHalaman                        |
| GET    | /api/halaman/:slugOrId        | halamanRoutes.js        | getHalamanDetail                  |
| POST   | /api/halaman                  | halamanRoutes.js        | createHalaman                     |
| PUT    | /api/halaman/:id              | halamanRoutes.js        | updateHalaman                     |
| DELETE | /api/halaman/:id              | halamanRoutes.js        | deleteHalaman                     |

## Cara menjalankan

```bash
npm install
cp .env.example .env   # lalu isi kredensial DB & email Anda
npm start
```

## Kenapa dipecah begini?

- **`config/`** — sesuatu yang cuma perlu diinisialisasi sekali (koneksi DB,
  transporter email) dan dipakai berulang di banyak tempat.
- **`utils/`** — fungsi murni (sanitasi, validasi) tanpa efek samping,
  gampang di-unit-test terpisah tanpa perlu server jalan.
- **`middleware/`** — hal-hal yang "menyelip" di antara request masuk dan
  controller (keamanan, upload, error handling).
- **`services/`** — logika yang melibatkan pihak ketiga/proses async
  tambahan (kirim email) — dipisah dari controller supaya controller tetap
  fokus ke "terima request → panggil DB/service → kirim response".
- **`controllers/`** — logika bisnis per domain data.
- **`routes/`** — hanya definisi "path apa dipetakan ke fungsi controller
  mana", tanpa logika bisnis sama sekali.

Struktur ini membuat setiap file singkat & fokus satu tanggung jawab,
sehingga jauh lebih mudah dicari saat debugging (tinggal buka
`controllers/beritaController.js` kalau ada masalah di endpoint berita,
tanpa perlu scroll file 900 baris).
