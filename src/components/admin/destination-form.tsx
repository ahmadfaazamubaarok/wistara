"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import {
  createDestinationAction,
  updateDestinationAction,
  type DestinationFormState,
} from "@/app/actions/admin-destinations";
import { buttonClass } from "@/components/ui";
import { CATEGORY_LABEL, DEST_CATEGORIES, type DestCategory } from "@/lib/categories";
import { WEEK_DAYS } from "@/lib/submissions/constants";
import { slugify } from "@/lib/submissions/slug";
import type { AdminDestination } from "@/lib/admin/destinations";

const INPUT =
  "min-h-11 w-full rounded-md border border-border-input bg-canvas px-3 text-base text-ink placeholder:text-muted";

function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-score-bad-text"> *</span>}
      </label>
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="text-sm font-medium text-score-bad-text">
          {error}
        </p>
      )}
    </div>
  );
}

type Props = {
  initialData?: AdminDestination;
  regions: Array<{ adm4Code: string; desa: string; kecamatan: string; kabupaten: string }>;
  marineAreas: Array<{ code: string; name: string }>;
};

export function DestinationForm({ initialData, regions, marineAreas }: Props) {
  const isEdit = Boolean(initialData);

  const [state, formAction, pending] = useActionState<DestinationFormState, FormData>(
    isEdit ? updateDestinationAction : createDestinationAction,
    {},
  );

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [category, setCategory] = useState<DestCategory>(initialData?.category ?? "alam");
  const [isIndoor, setIsIndoor] = useState(initialData?.isIndoor ?? false);
  const [adm4Code, setAdm4Code] = useState(initialData?.adm4Code ?? (regions[0]?.adm4Code ?? ""));
  const [marineAreaCode, setMarineAreaCode] = useState(initialData?.marineAreaCode ?? "");
  const [lat, setLat] = useState(initialData?.lat ? String(initialData.lat) : "-7.797");
  const [lon, setLon] = useState(initialData?.lon ? String(initialData.lon) : "110.370");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [osmRef, setOsmRef] = useState(initialData?.osmRef ?? "");
  const [hoursVerified, setHoursVerified] = useState(Boolean(initialData?.verifiedAt));

  // Extract open hours if present
  let defaultOpenTime = "08:00";
  let defaultCloseTime = "17:00";
  let defaultClosedDays: string[] = [];
  if (initialData?.openHours) {
    const hours = initialData.openHours as Record<string, [string, string] | undefined>;
    const keys = Object.keys(hours);
    if (keys.length > 0 && hours[keys[0]]) {
      defaultOpenTime = hours[keys[0]]?.[0] ?? "08:00";
      defaultCloseTime = hours[keys[0]]?.[1] ?? "17:00";
    }
    defaultClosedDays = WEEK_DAYS.map((d) => d.key).filter((k) => !hours[k]);
  }

  const [hasHours, setHasHours] = useState(Boolean(initialData?.openHours));
  const [openTime, setOpenTime] = useState(defaultOpenTime);
  const [closeTime, setCloseTime] = useState(defaultCloseTime);
  const [closedDays, setClosedDays] = useState<string[]>(defaultClosedDays);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEdit && (!slug || slug === slugify(name))) {
      setSlug(slugify(val));
    }
  };

  const toggleClosedDay = (dayKey: string) => {
    setClosedDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey],
    );
  };

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-6">
      {isEdit && <input type="hidden" name="id" value={initialData!.id} />}

      {state.error && (
        <div role="alert" className="rounded-md bg-score-bad-bg p-4 text-sm font-medium text-score-bad-text">
          {state.error}
        </div>
      )}

      {/* Informasi Utama */}
      <section className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-card p-5">
        <h2 className="text-base font-semibold text-ink">Informasi Utama</h2>

        <FormField id="name" label="Nama Destinasi" required error={state.fieldErrors?.name}>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Contoh: Pantai Parangtritis"
            className={INPUT}
          />
        </FormField>

        <FormField
          id="slug"
          label="Slug URL"
          hint="Hanya huruf kecil, angka, dan tanda hubung. Dipakai di alamat web /destinasi/[slug]."
          required
          error={state.fieldErrors?.slug}
        >
          <div className="flex gap-2">
            <input
              id="slug"
              name="slug"
              type="text"
              required
              maxLength={80}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={INPUT}
            />
            <button
              type="button"
              onClick={() => setSlug(slugify(name))}
              className={`${buttonClass.secondary} shrink-0 px-3 text-xs`}
            >
              Buat dari Nama
            </button>
          </div>
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="category" label="Kategori" required error={state.fieldErrors?.category}>
            <select
              id="category"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as DestCategory)}
              className={INPUT}
            >
              {DEST_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABEL[cat]}
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex items-center pt-6">
            <label className="flex items-center gap-2.5 text-sm font-medium text-ink cursor-pointer">
              <input
                type="checkbox"
                name="isIndoor"
                checked={isIndoor}
                onChange={(e) => setIsIndoor(e.target.checked)}
                className="h-4 w-4 rounded border-border-input"
              />
              Destinasi Indoor (Ruang Tertutup / Museum / Galeri)
            </label>
          </div>
        </div>

        <FormField
          id="description"
          label="Deskripsi Ringkas"
          hint="Maksimal 600 karakter."
          error={state.fieldErrors?.description}
        >
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={600}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Penjelasan ringkas mengenai daya tarik tempat wisata ini…"
            className="w-full rounded-md border border-border-input bg-canvas p-3 text-base text-ink placeholder:text-muted"
          />
        </FormField>
      </section>

      {/* Wilayah & Cuaca */}
      <section className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-card p-5">
        <h2 className="text-base font-semibold text-ink">Lokasi & Wilayah Cuaca</h2>

        <FormField
          id="adm4Code"
          label="Wilayah Cuaca (Kecamatan / Desa BMKG)"
          hint="Dipakai untuk mengambil prakiraan cuaca 3 harian BMKG."
          required
          error={state.fieldErrors?.adm4Code}
        >
          <select
            id="adm4Code"
            name="adm4Code"
            value={adm4Code}
            onChange={(e) => setAdm4Code(e.target.value)}
            className={INPUT}
          >
            {regions.map((r) => (
              <option key={r.adm4Code} value={r.adm4Code}>
                {r.kabupaten} — Kec. {r.kecamatan}, Desa {r.desa} ({r.adm4Code})
              </option>
            ))}
          </select>
        </FormField>

        {category === "pantai" && (
          <FormField
            id="marineAreaCode"
            label="Wilayah Perairan Maritim BMKG (Khusus Pantai)"
            hint="Pilih stasiun prakiraan gelombang maritim BMKG terdekat."
            error={state.fieldErrors?.marineAreaCode}
          >
            <select
              id="marineAreaCode"
              name="marineAreaCode"
              value={marineAreaCode}
              onChange={(e) => setMarineAreaCode(e.target.value)}
              className={INPUT}
            >
              <option value="">-- Tanpa data maritim --</option>
              {marineAreas.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name} ({m.code})
                </option>
              ))}
            </select>
          </FormField>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="lat" label="Latitude" required error={state.fieldErrors?.lat}>
            <input
              id="lat"
              name="lat"
              type="text"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="-7.797"
              className={INPUT}
            />
          </FormField>

          <FormField id="lon" label="Longitude" required error={state.fieldErrors?.lon}>
            <input
              id="lon"
              name="lon"
              type="text"
              required
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              placeholder="110.370"
              className={INPUT}
            />
          </FormField>
        </div>

        <FormField id="osmRef" label="Referensi OpenStreetMap (Opsional)" hint="Misal: way/12345678">
          <input
            id="osmRef"
            name="osmRef"
            type="text"
            value={osmRef}
            onChange={(e) => setOsmRef(e.target.value)}
            placeholder="way/..."
            className={INPUT}
          />
        </FormField>
      </section>

      {/* Jam Operasional */}
      <section className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface-card p-5">
        <h2 className="text-base font-semibold text-ink">Jam Operasional</h2>

        <label className="flex items-center gap-2.5 text-sm font-medium text-ink cursor-pointer">
          <input
            type="checkbox"
            checked={hasHours}
            onChange={(e) => setHasHours(e.target.checked)}
            className="h-4 w-4 rounded border-border-input"
          />
          Destinasi memiliki jam buka tertentu (bukan buka 24 jam bebas)
        </label>

        {hasHours && (
          <div className="mt-2 flex flex-col gap-4 border-t border-hairline pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField id="openTime" label="Jam Buka" required>
                <input
                  id="openTime"
                  name="openTime"
                  type="time"
                  required
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className={INPUT}
                />
              </FormField>
              <FormField id="closeTime" label="Jam Tutup" required>
                <input
                  id="closeTime"
                  name="closeTime"
                  type="time"
                  required
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className={INPUT}
                />
              </FormField>
            </div>

            <div>
              <span className="text-sm font-medium text-ink">Hari Tutup (Libur Operasional)</span>
              <p className="mt-0.5 text-[13px] text-muted">Centang hari di mana tempat wisata ini tutup.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEK_DAYS.map((day) => {
                  const isClosed = closedDays.includes(day.key);
                  return (
                    <label
                      key={day.key}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                        isClosed
                          ? "border-score-bad-text bg-score-bad-bg text-score-bad-text"
                          : "border-border-input bg-canvas text-ink"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="closedDays"
                        value={day.key}
                        checked={isClosed}
                        onChange={() => toggleClosedDay(day.key)}
                        className="sr-only"
                      />
                      {day.label} {isClosed ? "(Tutup)" : "(Buka)"}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2.5 text-sm font-medium text-ink cursor-pointer">
                <input
                  type="checkbox"
                  name="hoursVerified"
                  checked={hoursVerified}
                  onChange={(e) => setHoursVerified(e.target.checked)}
                  className="h-4 w-4 rounded border-border-input"
                />
                Tandai jam operasional sudah diverifikasi langsung ke pengelola
              </label>
            </div>
          </div>
        )}
      </section>

      {/* Tombol Aksi */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href="/admin/destinasi" className={buttonClass.secondary}>
          Batal
        </Link>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Menyimpan…" : isEdit ? "Perbarui Destinasi" : "Simpan Destinasi"}
        </button>
      </div>
    </form>
  );
}
