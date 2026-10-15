# syntax=docker/dockerfile:1

# Image PENGEMBANGAN JelajahLokal (bukan image produksi: produksi di Vercel).
#
# Image ini hanya berisi runtime Node + entrypoint. Kode sumber di-bind-mount
# oleh compose.yaml, dan dependensi hidup di volume bernama `node_modules`
# (lihat docker/dev-entrypoint.sh). Dengan begitu binary native Linux tidak
# bercampur dengan folder di Windows/Ubuntu dan install tidak diulang tiap start.
FROM node:24-bookworm-slim AS dev

# Samakan UID/GID user `node` dengan user di host. Di Ubuntu ini mencegah
# package-lock.json dan file lain yang ditulis dari container menjadi milik
# root. Default 1000 = user pertama di Ubuntu; di Docker Desktop (Windows)
# nilainya tidak berpengaruh.
ARG DEV_UID=1000
ARG DEV_GID=1000

RUN groupmod -o -g "${DEV_GID}" node \
 && usermod -o -u "${DEV_UID}" -g "${DEV_GID}" node \
 && mkdir -p /app/node_modules /app/.next \
 && chown -R node:node /app

# Folder yang sudah ada dan dimiliki `node` di image inilah yang diwarisi volume
# bernama saat pertama dibuat, sehingga volume bisa ditulis tanpa root.
COPY docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
# Jaga-jaga bila berkas ter-checkout dengan CRLF.
RUN sed -i 's/\r$//' /usr/local/bin/dev-entrypoint.sh

USER node
WORKDIR /app
EXPOSE 3000

# Dipanggil lewat /bin/sh agar tidak bergantung pada bit eksekusi berkas
# (hilang saat repository berpindah antara Windows dan Linux).
ENTRYPOINT ["/bin/sh", "/usr/local/bin/dev-entrypoint.sh"]
CMD ["npm", "run", "dev:docker"]
