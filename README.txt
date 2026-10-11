ONE STOP CENTRE — UNIT BIMBINGAN DAN KAUNSELING SMK BULUH KASAP
KEPIMPINAN MURID | CLOUDFLARE WORKERS | 11 OKTOBER 2026

CARA MUDAH
1. Buka MULA_DI_SINI.html dengan Chrome/Edge. Klik Salin kod Worker.
2. Cloudflare > Workers & Pages > Create application > Start with Hello World!
3. Namakan Worker baharu dan Deploy. Kemudian buka Edit code.
4. Padam SEMUA kod contoh dan tampal SEMUA kod yang disalin. Klik Deploy.
5. Buka alamat .workers.dev. Sahkan folder, subfolder dan pratonton.

PENTING
Ini bukan ZIP aset statik atau pakej Pages. Jangan gunakan Upload static files.
Jangan muat naik MULA_DI_SINI.html sebagai laman utama.
worker.js mengandungi laman penuh; index.html berasingan TIDAK diperlukan.
Tiada _routes.json, _worker.js, _headers atau _redirects digunakan.
Cipta Worker Hello World baharu untuk mengelakkan aturan aset daripada projek lama.
Tiada kata laluan, kunci Google, KV atau ASSETS binding diperlukan.

ALTERNATIF UNTUK PENGGUNA TEKNIKAL (WRANGLER)
Dari folder yang mengandungi worker.js dan wrangler.jsonc:
  npx wrangler@latest login
  npx wrangler@latest deploy
Untuk ujian tempatan:
  npx wrangler@latest dev
Kemaskini nama dalam wrangler.jsonc hanya jika perlu.
Jangan gunakan arahan muat naik Pages untuk projek Worker ini.

FUNGSI
- Enam bahagian Kepimpinan Murid, 38 pintasan sedia ada, carian Grid/Senarai.
- Folder dan subfolder bertingkat dimuatkan sebagai butang laman sendiri.
- Nama fail dan folder dibaca semula setiap kali dibuka atau disegarkan.
- Auto meminta senarai selepas 60 saat apabila tab aktif dan ruang kelihatan.
- Auto dijeda ketika fail sedang dipratonton. Muat semula tersedia.
- Pratonton fail menggunakan paparan Google terbenam tanpa kebenaran popup,
  top-navigation, borang atau muat turun. Laman tidak membuka tab luar.
- Format tidak disokong / akses terhad dipaparkan sebagai makluman.
- Folder baharu boleh diterokai melalui senarai folder induk yang dimuatkan.
  Pintasan tetap pada menu kiri masih mengikut konfigurasi enam bahagian asal.
- Tema ungu, gambar guru dan logo dikekalkan; footer: Design by @5Lin.

KERAHASIAAN DAN BATASAN
Sambungan hanya membaca paparan HTML awam Google Drive dan tidak menggunakan
akaun Google pelawat. Ia bukan Google Drive API rasmi. Cookie/Authorization
pelawat tidak dihantar kepada Google. Tiada kebenaran perkongsian diubah.
Jangan jadikan rekod sulit murid umum untuk memaksa akses.
Google boleh mengehadkan permintaan, mengambil masa memaparkan perubahan,
atau menukar markup. Sambungan ini mungkin memerlukan penyelenggaraan.
Penyegaran bukan serta-merta dan tiada jaminan semua format boleh dipratonton.
Tiada salinan tetap / data simulasi diganti sebagai kandungan sebenar dalam kod.

UJIAN DAN STATUS
Kod Worker diuji dengan permintaan GET/HEAD, kawalan kaedah dan asal permintaan,
ralat akses/timeout/saiz, dan respons folder simulasi. Browser diuji bagi navigasi
bertingkat, carian, pratonton, tiada popup, serta susun atur komputer dan telefon.
Ujian ini BUKAN penerbitan sebenar pada akaun Cloudflare atau jaminan capaian
Google dari lokasi Worker. Sahkan selepas Deploy. Tiada penerbitan automatik.
/_osc-health hanya mengesahkan Worker berjalan, bukan capaian Google Drive.

FAIL
worker.js            — Kod Worker lengkap, termasuk laman, gambar dan logo.
MULA_DI_SINI.html     — Panduan tempatan dengan butang salin kod penuh.
wrangler.jsonc       — Konfigurasi penerbitan CLI (pilihan).
README.txt           — Panduan dan batasan ini.

RUJUKAN TEKNIKAL RASMI (disemak 11 Oktober 2026)
https://developers.cloudflare.com/kv/get-started/
  Pilihan Hello World serta penyunting Edit code; KV TIDAK digunakan laman ini.
https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/
https://developers.cloudflare.com/workers/wrangler/configuration/
https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe
