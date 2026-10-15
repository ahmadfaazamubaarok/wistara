#!/bin/sh
# Entrypoint container dev: pastikan dependensi sinkron, lalu jalankan perintah.
#
# node_modules berada di volume bernama, jadi `docker compose up` biasa tidak
# melihat perubahan package.json setelah `git pull`. Skrip ini menyimpan sidik
# jari (hash) package.json + package-lock.json di dalam volume dan menjalankan
# `npm install` hanya bila sidik jarinya berubah.
#
# Memakai `npm install`, bukan `npm ci`: `npm ci` menghapus folder node_modules
# dan gagal (EBUSY) karena folder itu adalah titik mount volume.
set -eu

STAMP_FILE="node_modules/.deps-stamp"

current_stamp() {
  cat package.json package-lock.json 2>/dev/null | sha256sum | cut -d' ' -f1
}

if [ ! -f package.json ]; then
  echo "[dev] package.json tidak ditemukan di $(pwd)." >&2
  echo "[dev] Pastikan compose dijalankan dari root repository (bind mount .:/app)." >&2
  exit 1
fi

if [ ! -f "$STAMP_FILE" ] || [ "$(cat "$STAMP_FILE")" != "$(current_stamp)" ]; then
  echo "[dev] Dependensi belum terpasang atau berubah -> npm install (pertama kali bisa beberapa menit)"
  npm install --no-audit --no-fund
  # Hitung ulang setelah install: npm bisa membuat/memperbarui package-lock.json.
  current_stamp > "$STAMP_FILE"
else
  echo "[dev] Dependensi sudah sinkron, lewati npm install"
fi

exec "$@"
