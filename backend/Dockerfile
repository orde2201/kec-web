# 1. Gunakan image Node.js berbasis Alpine
FROM node:20-alpine

# 2. Install Chromium & pustaka pendukung Puppeteer di Alpine
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# 3. Beritahu Puppeteer agar TIDAK download Chrome bawaan
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 4. Tentukan direktori kerja di dalam kontainer
WORKDIR /app

# 5. Salin package.json dan package-lock.json
COPY package*.json ./

# 6. Install seluruh dependencies cukup 1x saja dari package.json
RUN npm install express cors dotenv pg multer qrcode-terminal sanitize-html validator whatsapp-web.js


# 7. Salin seluruh kode proyek ke dalam kontainer
COPY . .

# 8. Buka port yang digunakan aplikasi
EXPOSE 3000

# 9. Perintah untuk menjalankan backend
# ⚠️ Pastikan file utama Anda bernama server.js atau app.js
CMD ["node", "server.js"]