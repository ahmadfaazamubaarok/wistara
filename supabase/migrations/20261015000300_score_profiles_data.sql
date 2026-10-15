-- Bobot awal skor per kategori (Rancangan Teknis, "Bobot awal per kategori").
-- Ini ASUMSI DESAIN tim, bukan standar BMKG. Disimpan sebagai data agar bisa
-- disetel setelah uji pengguna tanpa deploy ulang (update tabel ini saja).

insert into score_profiles (category, w_rain, w_wind, w_heat, w_vis) values
  ('pantai',      1.0, 0.8, 0.5, 0.3),
  ('alam',        1.0, 0.5, 0.3, 0.8),
  ('budaya',      0.8, 0.1, 0.8, 0.1),
  ('desa_wisata', 0.7, 0.2, 0.5, 0.1),
  ('museum',      0.1, 0.0, 0.1, 0.0)
on conflict (category) do nothing;
