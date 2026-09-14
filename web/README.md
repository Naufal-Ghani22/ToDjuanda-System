# Peta 3D Terminal 1

Jalankan dari folder `web`:

```sh
npm install
node server.js
```

Buka http://127.0.0.1:4173. Library Three.js disajikan secara lokal.

Drag kiri atau satu jari untuk orbit, drag kanan atau dua jari untuk geser,
scroll atau pinch untuk zoom. Tombol panah pada canvas mengatur orbit;
Shift + panah menggeser. Home mengembalikan kamera. Tombol di layar juga
menyediakan kontrol tersebut, tampak atas, serta seluruh peta.

`map3d.js` membaca SVG dan membangun ExtrudeGeometry, dengan sumbu Y sebagai
tinggi. Ruang memiliki tinggi visual tetap 0,5 unit dan berdiri pada bidang tanah.
Kamera dibatasi agar tidak berputar ke bawah bidang tanah.
Geometri SVG asli tetap disimpan di assets tanpa perubahan. ID zona sementara
bergantung pada urutan bentuk SVG dan belum cocok menjadi ID routing permanen.

`routing.js` membaca node pintu oranye, node persimpangan merah, serta edge merah,
lalu membentuk adjacency graph dan menjalankan Dijkstra. Jarak masih memakai unit
peta sampai skala SVG dikalibrasi. Data tenant dan navigasi operasional belum ada.
`app.js` adalah prototipe SVG lama; halaman sekarang memakai `map3d.js`.
