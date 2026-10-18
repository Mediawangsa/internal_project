# Cara 2 – Imej 2 minggu guna GitHub Actions + Python (Pillow)

Gantikan imej Cara 1 (Slides). Hasil: imej portrait 900×1600 px, kecil (~20–60KB), dilukis dari **calendar Studio Pertiwi sahaja**. Hantaran harian ~7 pagi, tetapi GitHub Actions boleh **lewat 10–30 minit**. Kos RM0.

Fail:
- `cara2/imej_ringkasan.py`: baca iCal, lukis, hantar ke Telegram
- `cara2/requirements.txt`
- `../.github/workflows/studio-pertiwi-imej.yml`: jadual harian 7:00 (23:00 UTC)

> **Penting:** guna repo **private**. Alamat iCal rahsia memberi akses baca calendar kepada sesiapa yang ada. Ia disimpan sebagai GitHub Secret (tidak dalam kod).
> Repo `Mediawangsa/internal_project` kini **awam (public)**: sesiapa boleh baca kod dan log Actions. Tukar ke private: Settings > General > Danger Zone > **Change visibility** > Make private. Kos tetap RM0 (job ini guna ~30 minit sebulan daripada 2,000 minit percuma untuk repo private).
>
> Workflow **tidak jalan ikut jadual** sehingga awak tetapkan `CARA2_AKTIF` (Langkah 4). Ini elak e-mel "Run failed" setiap pagi semasa setup belum siap.

## Langkah 1 – Matikan imej Cara 1
Dalam `Kod.gs` tukar `HANTAR_IMEJ: true` kepada `false`, simpan. (Teks harian oleh Apps Script kekal.)

## Langkah 2 – Dapatkan alamat iCal rahsia
1. Google Calendar (laptop) > hover **Studio Pertiwi** > ⋮ > **Settings and sharing**.
2. Bahagian **Integrate calendar** > salin **Secret address in iCal format** (URL berakhir `.ics`).
3. Jika bahagian ini tiada/kelabu: admin Workspace mungkin menyekat. Admin console > Apps > Google Workspace > Calendar > Sharing settings. Beritahu saya jika perlu alternatif (cth Google Calendar API + service account).

Jangan kongsi URL ini dalam group. Jika bocor: pada halaman sama klik **Reset** (URL lama mati).

## Langkah 3 – Tetapkan Secrets di GitHub
Repo > **Settings > Secrets and variables > Actions > New repository secret**:

| Secret | Nilai |
|---|---|
| `ICAL_URL` | alamat iCal rahsia |
| `TELEGRAM_TOKEN` | token bot (sama seperti Cara 1) |
| `TELEGRAM_CHAT_ID` | ID group (sama seperti Cara 1) |

Pilihan: tab **Variables** > `HANTAR_FAIL_PENUH` = `true` untuk hantar juga fail PNG kualiti penuh (1350×2400).

## Langkah 4 – Uji dahulu, kemudian aktifkan jadual
1. **Actions** > "Studio Pertiwi - imej 2 minggu" > **Run workflow** (kotak "sentiasa" ditanda). Dalam 1–2 minit, group terima foto. Jika gagal, log akan sebut secret mana yang belum diisi.
2. Bila berjaya: Settings > Secrets and variables > Actions > tab **Variables** > **New repository variable** > nama `CARA2_AKTIF`, nilai `true`. Mulai esok, jadual 7 pagi berjalan.
3. Untuk berhenti sementara: tukar `CARA2_AKTIF` kepada `false` (atau Actions > workflow > **Disable workflow**).

Nota: jadual (`schedule`) hanya berjalan dari **cabang lalai** repo. Cabang lalai repo ini ialah `claude/studio-pertiwi-booking-7uh83g` (repo kosong semasa push pertama), jadi tiada merge diperlukan.

## Langkah 5 – Semak hasil
1. Semak foto: hari ini kuning, tempahan betul, tiada nama peribadi di luar Studio.
2. Tempah satu slot melalui borang, run semula, pastikan muncul. Nota: **feed iCal Google kadang-kadang lewat beberapa minit hingga jam** menunjukkan perubahan terkini. Untuk imej pagi ini biasanya tak jadi masalah, tetapi tempahan yang dibuat beberapa minit sebelum 7 pagi mungkin belum muncul.
3. Selepas `CARA2_AKTIF` ditetapkan, esok pagi semak imej tiba ± 7:10–7:30.

Ujian di komputer sendiri (tanpa Telegram): `pip install -r cara2/requirements.txt`, kemudian
`python cara2/imej_ringkasan.py --ical fail.ics --keluar imej.png --tiada-hantar --sentiasa`

## Peraturan hantaran
- Isnin–Jumaat: sentiasa hantar imej.
- Sabtu/Ahad: senyap jika tiada tempahan hari itu (sama seperti teks harian). Untuk sentiasa hantar (termasuk hujung minggu kosong), tambah `--sentiasa` pada arahan `python` dalam fail workflow.

## Selenggara
- Untuk repo **awam**, GitHub melumpuhkan jadual selepas 60 hari tiada aktiviti repo (repo ini masih awam: tukar ke private untuk elak). Repo private tidak terkesan.
- Jika imej tak sampai: **Actions** > klik run yang gagal > baca log. Ralat Telegram `chat not found` = ID salah. `Gagal ambil iCal: HTTP 404` = URL rahsia sudah di-reset, kemas kini Secret `ICAL_URL`.
- Tukar rupa (warna, saiz fon, bilangan hari): ubah pemalar di atas `imej_ringkasan.py` (`WARNA`, `BILANGAN_HARI`, `MAKS_BARIS`).
