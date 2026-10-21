"use client";

import { useActionState, useEffect, useRef, useState, startTransition, type FormEvent, type ReactNode } from "react";
import { reverseGeocodeAction } from "@/app/actions/geocode";
import { createSubmissionAction, type SubmissionFormState } from "@/app/actions/submissions";
import { buttonClass } from "@/components/ui";
import { CATEGORY_LABEL, DEST_CATEGORIES } from "@/lib/categories";
import { KABUPATEN_DIY, MANAGER_ROLES, MANAGER_ROLE_LABEL, WEEK_DAYS } from "@/lib/submissions/constants";
import { LocationPicker } from "./location-picker";

const INPUT =
  "min-h-11 w-full rounded-md border border-border-input bg-canvas px-3 text-base text-ink placeholder:text-muted";
const LEGEND = "font-serif text-[20px] text-ink";

function Field({
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
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="text-score-bad-text">
            {" "}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={`${id}-petunjuk`} className="mt-0.5 text-[13px] text-muted">
          {hint}
        </p>
      )}
      <div className="mt-1">{children}</div>
      {error && (
        <p id={`${id}-galat`} role="alert" className="mt-1 text-sm font-medium text-score-bad-text">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmissionForm({ mapStyleUrl }: { mapStyleUrl: string }) {
  const [state, formAction, pending] = useActionState<SubmissionFormState, FormData>(createSubmissionAction, {});
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [kabupaten, setKabupaten] = useState("");
  const [address, setAddress] = useState("");
  // Pesan sukses yang sudah ditutup pengguna ("Usulkan destinasi lain").
  const [dismissed, setDismissed] = useState<SubmissionFormState["success"] | null>(null);

  // Saran alamat dari peta. Aturan utama: saran HANYA mengisi kolom yang masih kosong atau yang
  // isinya masih hasil otomatis sebelumnya. Apa pun yang sudah diketik atau diubah pengguna
  // tidak pernah ditimpa.
  const [geoMessage, setGeoMessage] = useState("");
  const current = useRef({ kabupaten, address });
  const lastAuto = useRef({ kabupaten: "", address: "" });
  const lookupId = useRef(0);
  useEffect(() => {
    current.current = { kabupaten, address };
  }, [kabupaten, address]);

  const lookup = async (latitude: string, longitude: string) => {
    const id = ++lookupId.current;
    setGeoMessage("Mencari alamat dari peta…");
    let result: Awaited<ReturnType<typeof reverseGeocodeAction>>;
    try {
      result = await reverseGeocodeAction(Number(latitude.replace(",", ".")), Number(longitude.replace(",", ".")));
    } catch {
      result = { ok: false };
    }
    if (id !== lookupId.current) return; // titik yang lebih baru sudah dipilih; abaikan hasil lama

    if (!result.ok || (!result.kabupaten && !result.address)) {
      setGeoMessage("Alamat otomatis tidak tersedia untuk titik ini. Isi kabupaten/kota dan alamat secara manual.");
      return;
    }

    const { kabupaten: nowKabupaten, address: nowAddress } = current.current;
    const fillKabupaten = !!result.kabupaten && (nowKabupaten === "" || nowKabupaten === lastAuto.current.kabupaten);
    const fillAddress = !!result.address && (nowAddress.trim() === "" || nowAddress === lastAuto.current.address);
    if (fillKabupaten && result.kabupaten) {
      lastAuto.current.kabupaten = result.kabupaten;
      setKabupaten(result.kabupaten);
    }
    if (fillAddress && result.address) {
      lastAuto.current.address = result.address;
      setAddress(result.address);
    }

    // Sebut dengan jujur apa yang berubah dan apa yang dibiarkan karena sudah diisi pengguna.
    const keptKabupaten = !!result.kabupaten && !fillKabupaten;
    const keptAddress = !!result.address && !fillAddress;
    if (fillKabupaten && fillAddress) {
      setGeoMessage("Kabupaten/kota dan alamat terisi otomatis dari OpenStreetMap. Periksa dan ubah bila perlu.");
    } else if (fillKabupaten) {
      setGeoMessage(`Kabupaten/kota terisi dari peta${keptAddress ? ". Alamat yang Anda ketik tidak diubah." : ". Alamat tidak tersedia, isi manual."}`);
    } else if (fillAddress) {
      setGeoMessage(`Alamat terisi dari peta${keptKabupaten ? ". Kabupaten/kota yang Anda pilih tidak diubah." : ". Kabupaten/kota tidak tersedia, pilih manual."}`);
    } else {
      setGeoMessage("Isian kabupaten/kota dan alamat Anda tidak diubah.");
    }
  };

  const errors = state.fieldErrors ?? {};
  // Hubungkan isian dengan pesan galat/petunjuknya untuk pembaca layar.
  const describe = (id: string, name: string, hasHint = false) => ({
    id,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": [hasHint ? `${id}-petunjuk` : null, errors[name] ? `${id}-galat` : null].filter(Boolean).join(" ") || undefined,
  });

  // Dikirim manual (bukan lewat form action) agar isian TIDAK direset React saat validasi gagal.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  if (state.success && state.success !== dismissed) {
    return (
      <div role="status" className="rounded-lg border border-hairline bg-surface-card p-6">
        <h2 className="!text-[22px]">Usulan terkirim</h2>
        <p className="mt-2 text-body">
          Terima kasih. &ldquo;{state.success.name}&rdquo; sudah masuk antrean dan akan ditinjau tim Wistara. Usulan tidak langsung
          tampil di katalog; kami memeriksa lokasi dan jam bukanya dulu. Statusnya bisa Anda pantau di daftar &ldquo;Usulan saya&rdquo;
          di bawah.
        </p>
        <button
          type="button"
          className={`${buttonClass.secondary} mt-4`}
          onClick={() => {
            setDismissed(state.success);
            setLat("");
            setLon("");
            setKabupaten("");
            setAddress("");
            lastAuto.current = { kabupaten: "", address: "" };
            setGeoMessage("");
          }}
        >
          Usulkan destinasi lain
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      {state.error && (
        <p role="alert" className="rounded-md bg-score-bad-bg px-3 py-2 text-sm font-medium text-score-bad-text">
          {state.error}
        </p>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className={LEGEND}>1. Tentang destinasi</legend>
        <Field id="usul-nama" label="Nama destinasi" required error={errors.name}>
          <input {...describe("usul-nama", "name")} required maxLength={80} placeholder="mis. Pantai Contoh Indah" className={INPUT} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="usul-kategori" label="Kategori" required error={errors.category}>
            <select {...describe("usul-kategori", "category")} required defaultValue="" className={INPUT}>
              <option value="" disabled>
                Pilih kategori
              </option>
              {DEST_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
              <input type="checkbox" name="isIndoor" className="size-5 accent-primary" />
              Sebagian besar kegiatan di dalam ruangan (mis. museum)
            </label>
          </div>
        </div>
        <Field id="usul-deskripsi" label="Deskripsi singkat" hint="Opsional, maksimal 600 karakter." error={errors.description}>
          <textarea {...describe("usul-deskripsi", "description", true)} rows={3} maxLength={600} className={`${INPUT} py-2`} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className={LEGEND}>2. Lokasi</legend>
        <p className="text-[14px] text-body">Saat ini Wistara hanya mencakup Daerah Istimewa Yogyakarta.</p>
        <LocationPicker
          styleUrl={mapStyleUrl}
          lat={lat}
          lon={lon}
          onChange={(nextLat, nextLon) => {
            setLat(nextLat);
            setLon(nextLon);
          }}
          onCommit={lookup}
          error={errors.lat ?? errors.lon}
        />
        <p role="status" aria-live="polite" className="min-h-5 text-[13px] text-muted">
          {geoMessage}
        </p>
        <Field id="usul-kabupaten" label="Kabupaten / kota" required error={errors.kabupaten}>
          <select
            {...describe("usul-kabupaten", "kabupaten")}
            required
            value={kabupaten}
            onChange={(event) => setKabupaten(event.target.value)}
            className={INPUT}
          >
            <option value="" disabled>
              Pilih kabupaten/kota
            </option>
            {KABUPATEN_DIY.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="usul-alamat" label="Alamat lengkap" required hint="Dusun/jalan, desa/kelurahan, kecamatan." error={errors.address}>
          <textarea
            {...describe("usul-alamat", "address", true)}
            required
            rows={2}
            maxLength={300}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className={`${INPUT} py-2`}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className={LEGEND}>3. Jam buka</legend>
        <p className="text-[14px] text-body">
          Opsional. Kosongkan jam buka dan tutup bila tempat ini tidak punya batas jam; Wistara lalu memakai jendela kunjungan
          bawaan.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="usul-buka" label="Jam buka" error={errors.openTime}>
            <input {...describe("usul-buka", "openTime")} type="time" className={INPUT} />
          </Field>
          <Field id="usul-tutup" label="Jam tutup" error={errors.closeTime}>
            <input {...describe("usul-tutup", "closeTime")} type="time" className={INPUT} />
          </Field>
        </div>
        <div role="group" aria-labelledby="usul-hari-tutup">
          <p id="usul-hari-tutup" className="text-sm font-medium text-ink">
            Hari tutup
          </p>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
            {WEEK_DAYS.map((day) => (
              <label key={day.key} className="flex min-h-11 items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="closedDays" value={day.key} className="size-5 accent-primary" />
                {day.label}
              </label>
            ))}
          </div>
          {errors.closedDays && (
            <p role="alert" className="text-sm font-medium text-score-bad-text">
              {errors.closedDays}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className={LEGEND}>4. Tentang Anda</legend>
        <Field id="usul-pengelola" label="Nama pengelola atau lembaga" required error={errors.managerName}>
          <input {...describe("usul-pengelola", "managerName")} required maxLength={100} placeholder="mis. Pokdarwis Mekar Sari" className={INPUT} />
        </Field>
        <Field id="usul-peran" label="Hubungan Anda dengan destinasi" required error={errors.managerRole}>
          <select {...describe("usul-peran", "managerRole")} required defaultValue="" className={INPUT}>
            <option value="" disabled>
              Pilih hubungan
            </option>
            {MANAGER_ROLES.map((role) => (
              <option key={role} value={role}>
                {MANAGER_ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="usul-wa"
          label="Nomor WhatsApp yang bisa dihubungi"
          required
          hint="Dipakai tim Wistara untuk memverifikasi data. Tidak ditampilkan ke publik."
          error={errors.contactWa}
        >
          <input {...describe("usul-wa", "contactWa", true)} type="tel" inputMode="tel" autoComplete="tel" required placeholder="0812 3456 7890" className={INPUT} />
        </Field>
        <Field id="usul-bukti" label="Tautan bukti" hint="Opsional: akun Instagram, Google Maps, atau situs resmi tempat ini." error={errors.evidenceUrl}>
          <input {...describe("usul-bukti", "evidenceUrl", true)} inputMode="url" autoComplete="off" maxLength={300} placeholder="https://" className={INPUT} />
        </Field>
      </fieldset>

      <div>
        <label className="flex items-start gap-3 text-sm text-ink">
          <input
            type="checkbox"
            name="consent"
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? "usul-persetujuan-galat" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span>
            Saya setuju tim Wistara menghubungi nomor WhatsApp di atas untuk memverifikasi usulan ini. Nomor hanya dilihat tim
            peninjau, tidak ditampilkan ke publik, dan dihapus bila usulan ditolak.
          </span>
        </label>
        {errors.consent && (
          <p id="usul-persetujuan-galat" role="alert" className="mt-1 text-sm font-medium text-score-bad-text">
            {errors.consent}
          </p>
        )}
      </div>

      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Mengirim…" : "Kirim usulan"}
        </button>
        <p className="mt-2 text-[13px] text-muted">
          Usulan ditinjau manual dan tidak langsung tampil di katalog. Maksimal 5 usulan yang menunggu per akun.
        </p>
      </div>
    </form>
  );
}
