-- Hak akses eksplisit untuk anon/authenticated pada tabel referensi publik.
--
-- Di Supabase, tabel baru otomatis memberi anon/authenticated semua hak (default
-- privileges). Migrasi ini tidak mengandalkan itu: cabut semuanya lalu beri hanya
-- SELECT pada data yang memang publik. RLS (policy *_public_read) tetap berlaku di atasnya.
-- forecast_fetches adalah status internal dan tidak diberi hak apa pun.

revoke all on
  regions, destinations, facilities, forecasts, score_profiles, forecast_fetches
  from anon, authenticated;

grant select on regions, destinations, facilities, forecasts, score_profiles to anon, authenticated;
