// Kategori destinasi dan tipe fasilitas. Nilai harus sama dengan enum di
// supabase/migrations/20261015000100_core_schema.sql.

export const DEST_CATEGORIES = ["pantai", "alam", "budaya", "museum", "desa_wisata"] as const;
export type DestCategory = (typeof DEST_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<DestCategory, string> = {
  pantai: "Pantai",
  alam: "Alam",
  budaya: "Budaya",
  museum: "Museum",
  desa_wisata: "Desa Wisata",
};

export const FACILITY_TYPES = ["toilet", "parkir", "makan", "ibadah", "atm", "halte", "stasiun"] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const FACILITY_LABEL: Record<FacilityType, string> = {
  toilet: "Toilet",
  parkir: "Parkir",
  makan: "Tempat makan",
  ibadah: "Tempat ibadah",
  atm: "ATM",
  halte: "Halte",
  stasiun: "Stasiun",
};

export const isDestCategory = (value: string): value is DestCategory =>
  (DEST_CATEGORIES as readonly string[]).includes(value);
