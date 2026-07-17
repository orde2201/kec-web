# 1. Gunakan image Node.js resmi sebagai dasar
FROM node:20-alpine

# 2. Tentukan direktori kerja di dalam kontainer
WORKDIR /app

# 3. Salin package.json dan package-lock.json terlebih dahulu
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Salin seluruh kode backend ke dalam kontainer
COPY . .

# 6. Buka port yang digunakan aplikasi
EXPOSE 3000

# (Opsional) Perintah default jika tidak di-override oleh docker-compose
CMD ["node", "server.js"]