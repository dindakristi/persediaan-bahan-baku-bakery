# Bunberry Bakery - Sistem Persediaan Bahan Baku

Web app sederhana untuk mencatat bahan baku, bahan masuk, bahan keluar, dan stok minimum. Struktur database menggunakan tiga entitas utama:

- `suppliers`: pemasok bahan baku.
- `materials`: master bahan baku dan batas stok minimum.
- `stock_transactions`: jurnal bahan masuk (`IN`) dan bahan keluar (`OUT`).

Relasi ERD: `suppliers 1--* materials 1--* stock_transactions`.

## Struktur folder

```text
frontend/
  index.html
  styles.css
  app.js
backend/
  app.js
  schema.sql
  policies.sql
README.md
```

## Menyiapkan Supabase

1. Buat project baru di Supabase.
2. Buka **SQL Editor**, tempel seluruh isi `backend/schema.sql`, lalu jalankan.
  Jika tabel sudah ada, jalankan juga seluruh isi `backend/policies.sql` agar form browser boleh membaca dan menyimpan data.
3. Pastikan URL project dan publishable key Supabase sudah ditulis sebagai string di bagian konfigurasi `backend/app.js`. Backend memakai REST API Supabase sehingga tidak memerlukan package npm tambahan.

PowerShell:

```powershell
node backend/app.js
```

Backend sekaligus menyajikan frontend pada `http://localhost:3000`.

4. Buka `frontend/index.html` langsung dengan browser. Frontend sekarang terhubung langsung ke REST API Supabase, sehingga Node.js, npm, dan backend lokal tidak diperlukan.

Fitur pesanan bahan menggunakan tabel `purchase_orders` dan fungsi `receive_purchase_order`. Kategori bahan menggunakan tabel `material_categories`; schema juga menambahkan relasi kategori untuk bahan dan mengisi kategori bahan awal secara idempotent. Jika database sudah pernah dibuat, jalankan ulang `backend/schema.sql` di SQL Editor Supabase agar tabel, fungsi, kategori, dan data awal dibuat. Setelah itu, jalankan `backend/policies.sql` jika policy akses perlu diperbarui.

`backend/app.js` tetap tersedia sebagai alternatif API lokal, tetapi hanya perlu digunakan jika Node.js sudah tersedia.

## Catatan

- Frontend memakai publishable key Supabase. Jangan menaruh service-role key di frontend atau mengunggahnya ke repositori publik.
- Jika tabel Supabase memakai Row Level Security, buat policy `SELECT`, `INSERT`, dan sesuai kebutuhan agar data dapat dibaca dan diisi dari browser.
- Halaman **Pesanan bahan** mencatat pesanan dengan status `Dipesan`. Stok baru bertambah ketika pesanan ditandai `Diterima`.
- Halaman **Persediaan** mengelompokkan bahan per kategori. Kategori dapat dipilih saat menambah bahan, dibuat melalui opsi **+ Kategori Baru**, dan diubah melalui **Edit bahan**.
- Karena belum menggunakan autentikasi, batasi akses backend hanya untuk lingkungan lokal selama tahap tugas/pengembangan.
