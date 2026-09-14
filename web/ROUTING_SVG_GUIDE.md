# Konvensi SVG untuk Dijkstra

Sistem membaca elemen berikut saat halaman dimuat ulang:

- Node pintu: `circle` atau `ellipse` dengan fill `#F58231` atau `#FF9500`.
- Node belokan/persimpangan: `circle` atau `ellipse` dengan fill `#FF3B30`, `#FF0000`, atau `#FF5656`.
- Edge: `path`, `line`, atau `polyline` dengan stroke merah yang sama dan `fill="none"`.

Setiap node sebaiknya memiliki ID unik langsung pada lingkarannya:

```svg
<circle id="NODE-DOOR-T1-GF-001" cx="120" cy="240" r="10" fill="#F58231" />
<circle id="NODE-JUNCTION-T1-GF-001" cx="280" cy="240" r="10" fill="#FF3B30" />
<path id="EDGE-T1-GF-001" d="M120 240 H280" fill="none" stroke="#FF3B30" stroke-width="6" />
```

Garis edge harus melewati pusat setiap node. Bila satu garis melewati beberapa
node, sistem mengurutkan node sepanjang garis lalu menghubungkan pasangan yang
bersebelahan. Setiap ujung, belokan, dan persimpangan harus mempunyai node.

Hindari warna merah routing pada garis dekoratif. Warna adalah penanda graph;
ID membantu pengelolaan data, pengujian, dan hubungan ke POI.

Setelah ekspor Figma, ganti `assets/T1-GF-Area.svg`, lalu refresh browser. Panel
Dijkstra menampilkan jumlah pintu, persimpangan, dan edge yang berhasil dibentuk.
