// Helper tautan Google Maps untuk destinasi wisata Wistara.
// Membuka langsung halaman lokasi resmi di Google Maps untuk melihat ulasan pengunjung, foto kontributor, dan navigasi.

/** URL pencarian lokasi di Google Maps untuk melihat profil tempat, ulasan, dan foto kontributor */
export function getGoogleMapsPlaceUrl(name: string, kabupaten?: string): string {
  const query = `${name}${kabupaten ? `, ${kabupaten}` : ""}, Daerah Istimewa Yogyakarta`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** URL navigasi rute turn-by-turn kendaraan pribadi di Google Maps */
export function getGoogleMapsRouteUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}`;
}

/** URL rute kendaraan umum (Trans Jogja, KRL, KA Bandara, Bus Wisata) di Google Maps */
export function getGoogleMapsTransitUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}&travelmode=transit`;
}
