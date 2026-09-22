# JUA Wayfinding — Terminal 1

Peta wayfinding dua lantai berbasis Three.js. Aplikasi ini sepenuhnya berjalan
di browser; tidak memerlukan backend.

## Menjalankan di komputer lokal

Di folder `web`, jalankan sekali:

```sh
npm install
```

Lalu untuk menjalankan peta:

```sh
npm run dev
```

Buka alamat yang muncul di terminal, biasanya [http://127.0.0.1:4173](http://127.0.0.1:4173).
Tekan `Ctrl + C` di terminal untuk menghentikan server.

Untuk memeriksa logika routing tanpa membuka browser:

```sh
npm test
```

Untuk membuat versi siap unggah ke hosting statis:

```sh
npm run build
```

Hasilnya berada di folder `dist`.

## Cara memakai peta

- **Peta atas** memakai kamera ortografik. Geser untuk pan, gunakan roda mouse
  untuk zoom; peta tidak dapat dirotasi.
- **Eksplorasi 3D** memakai kamera perspektif. Tarik untuk melihat dari depan,
  belakang, kanan, kiri, atau atas. Kedua lantai ditampilkan bersamaan.
- Klik node pertama sebagai titik asal dan node kedua sebagai tujuan. Rute
  Dijkstra digambar beserta penanda yang bergerak.
- Saat rute berpindah lantai di mode peta, tombol lanjutan mengarahkan ke lantai
  tujuan melalui eskalator terkait.

## Posisi SVG

Simpan SVG Figma di `assets` dengan nama berikut:

```
assets/T1-GF-Area.svg   # Ground Floor
assets/T1-FF-Area.svg   # First Floor
```

Saat halaman direfresh, kedua SVG tersebut diurai ulang. Artinya perubahan file
SVG langsung menjadi geometri peta baru, node, edge, dan kandidat eskalator.

## Konvensi Figma untuk routing

Routing dipisahkan dari visual bangunan. Semua titik dan garis harus berada di
grup khusus agar parser tidak keliru menganggap detail denah sebagai rute.

| Elemen | Konvensi ekspor SVG |
| --- | --- |
| Node lokasi/pintu | `circle` atau `ellipse` di grup bernama `node`, fill `#F58231` |
| Node persimpangan | `circle` atau `ellipse` di grup bernama `node`, fill `#FF3B30` |
| Edge | `line` atau `path` stroke `#FF3B30` yang menyentuh node di kedua ujung |
| Eskalator | grup/rect bernama persis `Eskalator01`, `Eskalator02`, dan seterusnya |

Nama eskalator tidak boleh mendapat akhiran ekspor duplikat seperti
`Eskalator16_2`. Parser sengaja menolaknya agar peta tidak membuat konektor
lantai yang salah. Untuk eskalator yang benar-benar menghubungkan lantai,
gunakan satu ID unik dan sama di GF serta FF, lalu beri node di dekat masing-
masing ujungnya.

Panjang dan arah ramp mengikuti footprint `EskalatorNN` di **Ground Floor**.
Node GF dibuat pada satu ujung (bawah), node FF pada ujung lain (atas), dan
tinggi antar lantai mengikuti `FLOOR_HEIGHT` di `src/config.js`.

## Tinggi visual

Nilai utama ada di `src/config.js` dan `src/svg-to-scene.js`:

- Massa umum: `0.5` unit.
- Grup/layer yang mengandung nama `tembok_pilar`, `tembok_kaca`, atau
  `dinding`: `0.9` unit.
- Layer yang mengandung `kaca` dibuat transparan.

## Struktur sumber

```
src/
  main.js            # menyatukan scene, UI, dan interaksi
  svg-to-scene.js    # parser SVG dan geometri 3D + LOD
  routing.js         # graph dan algoritma Dijkstra
  escalators.js      # connector ramp/tangga antar lantai
  cameras.js         # kamera peta dan eksplorasi
  floor-stack.js     # menumpuk dan mengisolasi lantai
  route-renderer.js  # kurva rute dan penanda bergerak
  interaction.js     # klik node
  lod.js             # pemilihan level of detail berdasarkan zoom
  ui.js              # kontrol antarmuka
```
