# Panduan Setup – Sistem Tempahan Studio Pertiwi (RM0)

Semua guna akaun Google syarikat + Telegram. Tiada bayaran, tiada subscription.
**Setup dibuat sekali oleh admin di LAPTOP** (editor Apps Script susah di phone). Team lain cuma buka link di phone/laptop.

## Apa yang awak akan dapat

| Bahagian | Fungsi |
|---|---|
| Form **Tempah Studio** | Nama, Tarikh, Masa mula, Masa tamat, Tujuan |
| Form **Batal Tempahan** | Nama, Tarikh, Masa mula |
| Calendar **Studio Pertiwi** | Satu tempat tengok semua tempahan (view-only untuk team) |
| Bot Telegram | Sahkan tempahan, tolak jika bertindih, umum pembatalan |
| Post harian ~7 pagi | Senarai hari ini + imej ringkasan 2 minggu |

Keputusan yang saya guna (ubah di bahagian `CONFIG` dalam `Kod.gs` jika perlu):
- Slot 30 minit, **8:00am – 6:00pm**. Tempahan dibuka 7 hari seminggu dengan waktu sama. Jika Sabtu/Ahad waktu lain, beritahu saya.
- Isnin–Jumaat kosong: "Tiada tempahan hari ini". Sabtu/Ahad kosong: senyap (imej pun tidak dihantar).
- Bot juga post "✅ Studio ditempah ..." bila tempahan berjaya supaya semua nampak (tutup dengan `UMUM_TEMPAHAN_BARU: false`).
- Tempahan mesti dalam satu hari yang sama. Tempahan masa yang sudah lepas ditolak.
- Borang tidak kumpul e-mel. Pembatalan berasaskan kepercayaan: nama + tarikh + masa mula mesti sama dengan tempahan asal (nama boleh huruf besar/kecil berbeza, atau separa).

---

## LANGKAH 0 – Semak tetapan admin (5 minit, elak buntu kemudian)

Anda mungkin tak boleh tukar tetapan ini; kalau ujian di Langkah 8 gagal, minta IT/admin Workspace semak:

| Perkara | Gejala jika disekat | Cara semak |
|---|---|---|
| **Apps Script dibenarkan** | script.google.com kata "disabled" / tak boleh buka | Cuba buka <https://script.google.com>. Admin: Admin console > Apps > Additional Google services / Google Workspace > Apps Script |
| **Akses ke API luar (UrlFetchApp ke Telegram)** | Ralat "Access to … is not allowed" atau `api.telegram.org` ditolak semasa `ujiTelegram` | Jalankan `ujiTelegram` (Langkah 5). Admin: Security > API controls, dan semak sama ada ada "allowlist" URL untuk Apps Script |
| **Perkongsian Calendar dalam organisasi** | Team tak nampak calendar | Calendar > Settings calendar > "Access permissions". Admin: Apps > Google Workspace > Calendar > Sharing settings (perlu benarkan "Share within organization / See all event details") |
| **Google Forms dibenarkan** | Tak boleh cipta Form | Cuba buka <https://forms.google.com> |
| **Amaran "app belum disahkan"** | Skrin amaran semasa authorize | Normal untuk skrip sendiri. Klik **Advanced > Go to … (unsafe)**. Jika disekat sepenuhnya, admin perlu benarkan skrip anda |
| **Kuota** | Jarang berlaku di sini | Penggunaan kita sangat kecil berbanding had harian |

---

## LANGKAH 1 – Bot Telegram

1. Dalam Telegram, cari **@BotFather** > hantar `/newbot` > pilih nama (cth "Studio Pertiwi Bot") dan username (mesti berakhir `bot`).
2. BotFather beri **token** (panjang, bentuk `123456:ABC...`). **Simpan, jangan kongsi dalam group.**
3. Tambah bot ke group team: Group > Add member > cari username bot.
4. Hantar satu mesej dalam group, contoh `/start`. (Chat ID dicari automatik di Langkah 5.)

## LANGKAH 2 – Cipta projek Apps Script

1. Buka <https://script.google.com> dengan akaun syarikat > **New project**. Namakan "Studio Pertiwi".
2. **Project Settings** (ikon gear) > tandakan **"Show appsscript.json manifest file in editor"**.
3. Kembali ke **Editor**. Klik fail `appsscript.json` > gantikan seluruh kandungan dengan fail `appsscript.json` dalam folder ini (tetapkan zon masa KL + aktifkan Slides API).
4. Klik fail `Code.gs` > padam semua > tampal seluruh kandungan `Kod.gs`. Tekan Ctrl+S.

## LANGKAH 3 – Isi rahsia (Script Properties)

Project Settings > bawah sekali **Script Properties** > **Add script property**:

| Property | Nilai |
|---|---|
| `TELEGRAM_TOKEN` | token dari BotFather |
| `TELEGRAM_CHAT_ID` | (isi selepas Langkah 5) |

## LANGKAH 4 – Cipta semua benda (sekali sahaja)

1. Di editor, pilih fungsi **`setupSemua`** dalam dropdown atas > **Run**.
2. Klik **Review permissions** > pilih akaun > **Advanced > Go to Studio Pertiwi (unsafe)** > **Allow**.
3. Buka **Execution log**. Anda akan nampak 3 link: **borang tempah**, **borang batal**, **kalendar**. Salin ke nota.

## LANGKAH 5 – Sambung Telegram

1. Pilih **`cariChatId`** > Run > baca log, cari baris `group | Nama Group | CHAT ID: -100xxxxxxxxxx`. Salin nombor (termasuk tanda `-`).
2. Tambah Script Property `TELEGRAM_CHAT_ID` dengan nombor itu.
3. Run **`ujiTelegram`**. Group patut terima "✅ Ujian bot ...". Kalau ralat, lihat jadual Langkah 0.

## LANGKAH 6 – Kongsi Calendar (view-only)

1. Buka <https://calendar.google.com> > di kiri, di bawah "My calendars", hover **Studio Pertiwi** > ⋮ > **Settings and sharing**.
2. **Access permissions for events** > tandakan **Make available for [syarikat]** > pilih **See all event details**.
3. (Pilihan) **Share with specific people** untuk tambah orang tertentu dengan "See all event details". Jangan beri "Make changes" kepada sesiapa; hanya skrip (akaun anda) yang menulis.
4. Jangan padam calendar ini dan jangan tutup akaun admin: skrip bergantung kepadanya.

Boleh juga tetapkan link kalendar yang lebih cantik: di tetapan calendar, salin **Public URL / Shareable link** dan simpan sebagai Script Property `CALENDAR_LINK` (jika tak ditetapkan, skrip guna link embed automatik).

## LANGKAH 7 – Pasang trigger

Run **`pasangTrigger`**. Selesai: ia pasang trigger untuk dua borang dan trigger harian (antara 7–8 pagi).
Semak di menu kiri **Triggers** (ikon jam): patut ada 3.

## LANGKAH 8 – Ujian (SEBELUM umum kepada team)

Buat mengikut urutan. Selepas setiap satu, semak group Telegram dan Calendar.

| # | Ujian | Jangkaan |
|---|---|---|
| 1 | Run `ujiTempahan` | Group: "✅ Studio ditempah ... Ujian sistem (Ujian)". Calendar: event esok 2–3pm |
| 2 | Run `ujiBertindih` | Group: "❌ Ujian2: ... bertindih dengan Ujian sistem (Ujian) ...". Tiada event baru |
| 3 | Run `ujiBatal` | Group: "🗑 Tempahan Ujian dibatalkan". Event hilang |
| 4 | Run `ujiImej` | Log beri link imej dalam Drive + saiz KB. Buka: portrait, 14 kotak, hari ini kuning. Jika >200KB, rujuk Masalah lazim |
| 5 | Run `ujiTempahan` lagi, kemudian `ujiHantarHarian` | Group terima senarai hari ini (hari ini mungkin "Tiada tempahan") + foto 2 minggu. Esok nampak "Ujian" |
| 6 | **Ujian sebenar guna Borang**: buka link borang tempah di phone, tempah 4pm–5pm lusa | Bot sahkan dalam ± 1 minit |
| 7 | Isi borang tempah lagi, masa bertindih (cth 4:30pm–5:30pm) | Bot tolak |
| 8 | Borang tempah: masa tamat sebelum mula | Bot tolak "masa tamat mesti selepas" |
| 9 | Borang batal dengan nama + tarikh + masa mula sama | Bot umum pembatalan |
| 10 | Esok pagi: semak post harian tiba antara 7–8 pagi | Ada senarai + imej |
| 11 | Sabtu/Ahad: pastikan senyap jika tiada tempahan; ada post jika ada tempahan | Ikut peraturan |

Bersihkan tempahan ujian dalam Calendar sebelum umum (padam manual atau guna Borang Batal).
Jika borang gagal tetapi fungsi `uji...` berjaya, lihat **Executions** (menu kiri) untuk ralat trigger.

## LANGKAH 9 – Umum kepada team

1. Kongsi link borang Tempah dan Batal (lihat log `setupSemua`, atau Forms > buka borang > **Send**).
   Jika Workspace hadkan borang kepada organisasi, staf perlu log masuk akaun syarikat; itu normal.
2. Pin dalam group Telegram: link **Tempah**, **Batal**, **Kalendar**.
3. Hantar teks pengumuman (di bawah).
4. Pada phone, staf boleh "Add to Home screen" untuk link borang bagi akses satu ketuk.

---

## Teks pengumuman untuk group Telegram

```
📢 Sistem tempahan Studio Pertiwi kini guna borang + bot

📝 Tempah studio: [LINK BORANG TEMPAH]
🗑 Batal tempahan: [LINK BORANG BATAL]
📅 Semua tempahan (calendar): [LINK KALENDAR]

Cara guna:
1. Buka link "Tempah studio", isi Nama, Tarikh, Masa mula & tamat, Tujuan
2. Tunggu bot sahkan di group (✅). Kalau masa bertindih, bot beritahu (❌), pilih masa lain
3. Kalau ada hal, isi borang "Batal tempahan" (nama, tarikh, masa mula sama seperti tempahan asal)

Tip: masa yang sama tak boleh ditempah dua kali. Semak calendar dulu untuk slot kosong.
Setiap pagi (~7 pagi) bot post tempahan hari itu + gambar ringkasan 2 minggu.
Studio dibuka 8am–6pm. Mohon batalkan awal jika tak jadi supaya team lain boleh guna 🙏
```

---

## Pilihan: post tepat jam 7:00 (cron-job.org, percuma)

Trigger Apps Script berjalan sembarang masa antara 7:00–8:00. Jika mahu tepat:

1. Dalam Script Properties tambah `SECRET_KEY` = kata laluan rawak panjang (cth 30 aksara).
2. Apps Script > **Deploy > New deployment** > jenis **Web app** > Execute as: **Me** > Who has access: **Anyone** > Deploy > salin **Web app URL** (berakhir `/exec`).
   Cron-job.org tidak log masuk Google, jadi mesti "Anyone". Jika organisasi tidak benarkan, minta admin atau kekalkan trigger Apps Script (7–8 pagi). Kunci rahsia melindungi URL.
3. Daftar akaun di <https://cron-job.org> > **Create cronjob**:
   - URL: `WEB_APP_URL?key=SECRET_KEY_ANDA`
   - Schedule: setiap hari jam 07:00, timezone Asia/Kuala_Lumpur
4. Skrip hanya hantar sekali sehari, jadi trigger Apps Script (7–8 pagi) dan cron-job.org boleh dibiarkan serentak; yang sampai dulu akan menang.
5. Cron-job.org mungkin lapor "timeout" kerana imej mengambil ± 20 saat; abaikan jika mesej sampai di group.
6. Ubah kod kemudian: Deploy > Manage deployments > Edit > New version.

## Cara 2 (upgrade kemudian): imej lebih cantik

GitHub Actions + Python (Pillow) membaca iCal rahsia calendar dan lukis imej sendiri; hantaran boleh lewat 10–30 minit. Skrip sudah siap: lihat **`PANDUAN-CARA2.md`**. Mulakan dengan Cara 1 dahulu.

---

## Masalah lazim

- **Tiada reaksi bila borang dihantar**: Triggers tiada/gagal. Run `pasangTrigger` semula; semak **Executions**.
- **`Slides is not defined`**: manifest belum ditampal (Langkah 2.3). Atau Editor > Services (+) > Google Slides API > Add.
- **Imej bukan portrait**: Slides API tak ikut saiz. Buka presentation "Studio Pertiwi – Imej 2 minggu" dalam Drive > File > Page setup > Custom > 450 x 800 pt (atau saiz sama nisbah 9:16).
- **Imej >200KB**: beritahu saya saiz sebenar dari `ujiImej`; saya laraskan warna/susun atur supaya fail lebih kecil.
- **Telegram `chat not found`**: ID salah; group yang naik taraf jadi supergroup tukar ID. Run `cariChatId` semula.
- **Jangan ubah tajuk soalan** dalam Form (Nama/Tarikh/Masa mula/Masa tamat/Tujuan), skrip bergantung padanya. Boleh ubah penerangan dan tema.
- **Tukar waktu operasi**: ubah `BUKA_JAM` / `TUTUP_JAM` dalam `CONFIG`, kemudian edit senarai dropdown dalam kedua-dua Form secara manual, atau padam Properties `FORM_TEMPAH_ID`/`FORM_BATAL_ID` dan run `setupSemua` + `pasangTrigger` untuk borang baru (link berubah).
- **Pemilik**: Form, Calendar, Slides dimiliki akaun admin yang run `setupSemua`. Jika orang itu keluar syarikat, pindah milik (Drive > Share > Transfer ownership) sebelum itu.
