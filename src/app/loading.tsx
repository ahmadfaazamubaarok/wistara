// Tampil saat halaman menunggu data (mis. pengambilan BMKG pertama yang bisa beberapa detik).
export default function Loading() {
  return (
    <main id="konten" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-10 md:px-8" aria-busy="true">
      <p role="status" className="text-body">
        Memuat data destinasi dan prakiraan…
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-surface-card" />
        ))}
      </div>
    </main>
  );
}
