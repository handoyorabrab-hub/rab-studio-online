# RAB Studio — Google Drive edition

Versi ini memakai GitHub Pages untuk menayangkan aplikasi dan Google Drive untuk menyimpan data. File `RAB Studio - Data Proyek.json` dibuat di Drive akun Google yang disambungkan. File tersebut berisi riwayat proyek, katalog, profil perusahaan, logo, dan foto item.

> Kode aplikasi di GitHub Pages bersifat publik. Data tetap privat di Google Drive karena setiap pengguna harus memberi izin Google. Aplikasi meminta scope `drive.file`, yang membatasi akses pada file yang dibuat/dipilih melalui aplikasi.

## Persiapan Google (sekali saja)

1. Buka [Google Cloud Console](https://console.cloud.google.com/) dan buat project baru.
2. Di **APIs & Services → Library**, aktifkan **Google Drive API**.
3. Buka **Google Auth Platform** (atau **APIs & Services → OAuth consent screen**) dan lengkapi nama aplikasi serta email dukungan. Pilih tipe pengguna yang sesuai. Untuk uji coba pribadi, tambahkan email Anda sebagai **Test user** bila aplikasi berstatus Testing.
4. Buka **Clients → Create client → Web application**.
5. Tambahkan **Authorized JavaScript origins**:
   - `http://localhost:8000` untuk mencoba lokal.
   - `https://USERNAME.github.io` setelah Anda membuat alamat GitHub Pages. Ganti `USERNAME` dengan nama akun GitHub Anda. Origin tidak menyertakan nama repository atau garis miring setelah domain.
6. Salin **Client ID**. Jangan membuat atau memasukkan Client Secret untuk aplikasi browser.
7. Isi `clientId` di file `config.js`.

Aplikasi meminta izin dari akun Google yang dipilih. Izin dapat dicabut kapan saja melalui pengaturan akun Google. Untuk membaca tentang alur izin web Google, lihat [dokumentasi Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/overview).

## Publikasikan melalui GitHub Pages

1. Buat repository GitHub baru. Isi repository dengan semua file di folder ini: `index.html`, `google-drive.js`, `config.js`, dan `.nojekyll`.
2. Di repository, buka **Settings → Pages**.
3. Pada bagian **Build and deployment**, pilih **Deploy from a branch**, lalu pilih branch `main` dan folder `/ (root)`. Simpan.
4. Buka alamat Pages yang diberikan GitHub. Jika baru pertama kali, tunggu proses publikasi beberapa menit.
5. Tambahkan origin GitHub Pages tersebut ke OAuth client di Google Cloud Console. Muat ulang situs, lalu klik **Hubungkan akun Google**.

GitHub Pages melayani file statis HTML/CSS/JavaScript; ia tidak menjalankan backend server. Karena itu, aplikasi mengakses Drive langsung melalui Google OAuth dan Drive API. Google mendukung panggilan Drive API dari browser dengan access token; token hanya dipegang sementara di tab tersebut.

## Coba lokal sebelum mempublikasikan

Jalankan server lokal dari folder ini:

```bash
python -m http.server 8000
```

Buka `http://localhost:8000`, lalu pastikan origin lokal itu sudah tercantum pada OAuth Client ID. Membuka file langsung dengan `file://` tidak didukung untuk alur OAuth.

## Data lama dan batas versi uji coba

- Pada sambungan pertama, jika file data belum ada di Drive akun yang dipilih, aplikasi menyalin data yang tersedia pada browser/origin saat ini ke Drive. Data pada alamat `file://` prototipe sebelumnya mungkin tidak ikut terbaca karena alamat dan penyimpanan browser berbeda. Pastikan proyek lama sudah tersimpan dan jangan menghapus prototipe lama sebelum proses migrasi dipastikan.
- Foto dan logo disimpan dalam satu file JSON sebagai data gambar. Ini praktis untuk uji coba kecil, tetapi file dapat menjadi besar jika banyak foto.
- Sinkronisasi otomatis berjalan ketika data lokal aplikasi berubah. Gunakan satu akun Google yang sama di semua perangkat. Hindari mengedit proyek yang sama bersamaan di dua perangkat; versi ini menyimpan satu file data dan perubahan terakhir dapat menggantikan perubahan sebelumnya.
- Token Google tidak disimpan permanen oleh aplikasi. Saat membuka ulang situs atau ketika izin kedaluwarsa, hubungkan akun lagi.
- Ini adalah prototipe personal untuk dicoba. Untuk operasional dengan banyak pengguna, foto berukuran besar, atau pengeditan bersamaan, perlu database dan penyimpanan file terpisah.
