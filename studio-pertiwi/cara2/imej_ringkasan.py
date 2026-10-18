#!/usr/bin/env python3
"""Studio Pertiwi - imej ringkasan 2 minggu (Cara 2: GitHub Actions + Pillow).

Baca calendar Studio Pertiwi SAHAJA melalui "Secret address in iCal format",
lukis imej portrait, hantar ke Telegram sebagai foto.

Pembolehubah persekitaran (simpan sebagai GitHub Secrets, JANGAN tulis dalam kod):
  ICAL_URL           alamat rahsia iCal calendar (atau laluan fail .ics untuk ujian)
  TELEGRAM_TOKEN     token bot
  TELEGRAM_CHAT_ID   ID group
  HANTAR_FAIL_PENUH  "true" = hantar juga fail PNG kualiti penuh (pilihan)

Contoh ujian tanpa hantar:
  python imej_ringkasan.py --ical contoh.ics --keluar imej.png --tiada-hantar --sentiasa
"""
import argparse
import datetime as dt
import io
import os
import re
import sys
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events
import requests
from PIL import Image, ImageDraw, ImageFont

TZ = ZoneInfo("Asia/Kuala_Lumpur")
HARI = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"]  # weekday(): Isnin=0
HARI_PENDEK = ["Isn", "Sel", "Rab", "Kha", "Jum", "Sab", "Ahd"]
BULAN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis"]

BILANGAN_HARI = 14
MAKS_BARIS = 5  # baris sehari dalam kotak (termasuk "+N lagi")

# Saiz asas 450x800 unit (sama seperti Cara 1); skala 2 = 900x1600 px.
ASAS_W, ASAS_H = 450, 800

WARNA = {
    "latar": "#FFFFFF",
    "kotak": "#F1F3F4",
    "hujung_minggu": "#E8EAFD",
    "hari_ini": "#FFE08A",
    "sempadan_hari_ini": "#E65100",
    "teks": "#202124",
    "senyap": "#9AA0A6",
    "kecil": "#5F6368",
}


# ----------------------------------------------------------------- data

class Acara:
    def __init__(self, mula, tamat, sehari, tajuk, nama):
        self.mula, self.tamat, self.sehari, self.tajuk, self.nama = mula, tamat, sehari, tajuk, nama


def _ke_kl(nilai):
    """date -> (datetime, sehari=True); datetime -> waktu KL."""
    if isinstance(nilai, dt.datetime):
        if nilai.tzinfo is None:
            nilai = nilai.replace(tzinfo=TZ)
        return nilai.astimezone(TZ), False
    return dt.datetime.combine(nilai, dt.time.min, TZ), True


def _nama_dari(komponen, tajuk):
    """Nama penempah: 'Nama: X' dalam DESCRIPTION (dicipta skrip), atau 'Tujuan (Nama)' dalam tajuk."""
    huraian = str(komponen.get("DESCRIPTION", ""))
    m = re.search(r"^Nama:\s*(.+)$", huraian, re.MULTILINE)
    if m:
        return m.group(1).strip()
    m = re.search(r"\(([^()]+)\)\s*$", tajuk)
    if m:
        return m.group(1).strip()
    return tajuk


def baca_kalendar(sumber, dari, hingga):
    if re.match(r"^https?://", sumber):
        r = requests.get(sumber, timeout=30)
        # Jangan cetak URL (ia rahsia).
        if r.status_code != 200:
            sys.exit(f"Gagal ambil iCal: HTTP {r.status_code}. Semak secret ICAL_URL.")
        data = r.content
    else:
        with open(sumber, "rb") as f:
            data = f.read()
    cal = icalendar.Calendar.from_ical(data)
    hasil = []
    for k in recurring_ical_events.of(cal).between(dari, hingga):
        mula, sehari = _ke_kl(k.get("DTSTART").dt)
        dtend = k.get("DTEND")
        tamat = _ke_kl(dtend.dt)[0] if dtend is not None else mula
        tajuk = str(k.get("SUMMARY", "")).strip() or "(tanpa tajuk)"
        hasil.append(Acara(mula, tamat, sehari, tajuk, _nama_dari(k, tajuk)))
    hasil.sort(key=lambda a: a.mula)
    return hasil


# ----------------------------------------------------------------- format

def tarikh_panjang(d):
    return f"{HARI[d.weekday()]}, {d.day} {BULAN[d.month - 1]}"


def jam(d, ampm):
    h12 = d.hour % 12 or 12
    teks = str(h12) + (f":{d.minute:02d}" if d.minute else "")
    return teks + (("pm" if d.hour >= 12 else "am") if ampm else "")


def rentang(mula, tamat):
    sama = (mula.hour >= 12) == (tamat.hour >= 12)
    return f"{jam(mula, not sama)}–{jam(tamat, True)}"


def ringkas(a):
    nama = a.nama.split()[0] if a.nama.split() else a.nama
    if a.sehari:
        return f"Sehari {nama}"
    return f"{jam(a.mula, False)}-{jam(a.tamat, False)} {nama}"


# ----------------------------------------------------------------- lukis

_FON_BIASA = ["DejaVuSans.ttf", "Roboto-Regular.ttf", "LiberationSans-Regular.ttf", "Arial.ttf"]
_FON_TEBAL = ["DejaVuSans-Bold.ttf", "Roboto-Bold.ttf", "LiberationSans-Bold.ttf", "Arial Bold.ttf"]
_FON_CARIAN = ["/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/roboto",
               "/usr/share/fonts/truetype/liberation", "/Library/Fonts", "C:/Windows/Fonts", ""]


def fon(saiz, tebal=False):
    for folder in _FON_CARIAN:
        for nama in (_FON_TEBAL if tebal else _FON_BIASA):
            try:
                return ImageFont.truetype(os.path.join(folder, nama), int(saiz))
            except OSError:
                continue
    return ImageFont.load_default(int(saiz))  # Pillow >= 10.1


def potong(lukis, teks, f, lebar):
    if lukis.textlength(teks, font=f) <= lebar:
        return teks
    while teks and lukis.textlength(teks + "…", font=f) > lebar:
        teks = teks[:-1]
    return teks + "…"


def lukis_imej(acara, hari_ini, skala, sekarang):
    W, H = ASAS_W * skala, ASAS_H * skala
    M, G, Y0 = 12 * skala, 6 * skala, 58 * skala
    bil = BILANGAN_HARI
    baris = -(-bil // 2)
    lebar = (W - 2 * M - G) / 2
    tinggi = (H - M - Y0 - G * (baris - 1)) / baris

    img = Image.new("RGB", (W, H), WARNA["latar"])
    d = ImageDraw.Draw(img)

    d.text((M, 8 * skala), "STUDIO PERTIWI", font=fon(18 * skala, True), fill=WARNA["teks"])
    d.text((M, 34 * skala),
           f"Tempahan {bil} hari · kemas kini {tarikh_panjang(sekarang)}, {jam(sekarang, True)}",
           font=fon(10 * skala), fill=WARNA["kecil"])

    f_kepala = fon(12.5 * skala, True)
    f_baris = fon(12 * skala)
    pad = 6 * skala
    tinggi_kepala = 17 * skala
    tinggi_baris = 14.5 * skala

    timbunan = {}
    for a in acara:
        timbunan.setdefault(a.mula.date(), []).append(a)

    for i in range(bil):
        tarikh = hari_ini + dt.timedelta(days=i)
        ini = i == 0
        hujung = tarikh.weekday() >= 5
        x = M + (i // baris) * (lebar + G)
        y = Y0 + (i % baris) * (tinggi + G)

        d.rectangle([x, y, x + lebar, y + tinggi],
                    fill=WARNA["hari_ini"] if ini else WARNA["hujung_minggu"] if hujung else WARNA["kotak"],
                    outline=WARNA["sempadan_hari_ini"] if ini else None,
                    width=int(2.5 * skala) if ini else 0)

        kepala = f"{HARI_PENDEK[tarikh.weekday()]} {tarikh.day}/{tarikh.month}" + ("  · HARI INI" if ini else "")
        d.text((x + pad, y + pad), kepala, font=f_kepala, fill=WARNA["teks"])

        senarai = [ringkas(a) for a in timbunan.get(tarikh, [])]
        if len(senarai) > MAKS_BARIS:
            senarai = senarai[:MAKS_BARIS - 1] + [f"+{len(senarai) - (MAKS_BARIS - 1)} lagi"]
        kosong = not senarai
        for n, teks in enumerate(senarai or ["–"]):
            d.text((x + pad, y + pad + tinggi_kepala + n * tinggi_baris),
                   potong(d, teks, f_baris, lebar - 2 * pad), font=f_baris,
                   fill=WARNA["senyap"] if kosong else WARNA["teks"])
    return img


def ke_png_kecil(img):
    """Kuantisasi warna: imej rata jadi ~puluhan KB, tetap jelas."""
    buf = io.BytesIO()
    img.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(buf, "PNG", optimize=True)
    return buf.getvalue()


def ke_png_penuh(img):
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


# ----------------------------------------------------------------- telegram

def telegram(kaedah, data, fail):
    token = os.environ["TELEGRAM_TOKEN"]
    r = requests.post(f"https://api.telegram.org/bot{token}/{kaedah}", data=data, files=fail, timeout=60)
    if r.status_code != 200:
        # Jangan cetak URL (mengandungi token).
        sys.exit(f"Telegram {kaedah} gagal (HTTP {r.status_code}): {r.text}")


# ----------------------------------------------------------------- utama

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ical", default=os.environ.get("ICAL_URL"), help="URL iCal rahsia atau fail .ics")
    p.add_argument("--keluar", help="simpan imej kecil ke fail ini")
    p.add_argument("--tiada-hantar", action="store_true", help="jangan hantar ke Telegram")
    p.add_argument("--sentiasa", action="store_true",
                   help="hantar walaupun Sabtu/Ahad kosong (lalai: senyap, ikut Cara 1)")
    p.add_argument("--tarikh", help="anggap hari ini ialah yyyy-mm-dd (ujian)")
    a = p.parse_args()
    tiada = [] if a.ical else ["ICAL_URL"]
    if not a.tiada_hantar:
        tiada += [k for k in ("TELEGRAM_TOKEN", "TELEGRAM_CHAT_ID") if not os.environ.get(k)]
    if tiada:
        sys.exit("Secret belum ditetapkan: " + ", ".join(tiada) +
                 ". Isi di GitHub > Settings > Secrets and variables > Actions.")

    sekarang = dt.datetime.now(TZ)
    if a.tarikh:
        sekarang = dt.datetime.combine(dt.date.fromisoformat(a.tarikh), dt.time(7, 0), TZ)
    hari_ini = sekarang.date()

    dari = dt.datetime.combine(hari_ini, dt.time.min, TZ)
    hingga = dari + dt.timedelta(days=BILANGAN_HARI)
    acara = baca_kalendar(a.ical, dari, hingga)

    hujung_minggu = hari_ini.weekday() >= 5
    ada_hari_ini = any(x.mula.date() == hari_ini for x in acara)
    if hujung_minggu and not ada_hari_ini and not a.sentiasa:
        print("Hujung minggu & tiada tempahan hari ini: senyap.")
        return

    kecil = ke_png_kecil(lukis_imej(acara, hari_ini, 2, sekarang))
    print(f"Imej: {len(kecil) / 1024:.0f} KB, {len(acara)} tempahan dalam {BILANGAN_HARI} hari")
    if a.keluar:
        with open(a.keluar, "wb") as f:
            f.write(kecil)
    if a.tiada_hantar:
        return

    akhir = hari_ini + dt.timedelta(days=BILANGAN_HARI - 1)
    tajuk = f"📅 Tempahan 2 minggu: {tarikh_panjang(hari_ini)} – {tarikh_panjang(akhir)}"
    chat = os.environ["TELEGRAM_CHAT_ID"]
    telegram("sendPhoto", {"chat_id": chat, "caption": tajuk},
             {"photo": ("studio-pertiwi-2minggu.png", kecil, "image/png")})
    if os.environ.get("HANTAR_FAIL_PENUH", "").lower() == "true":
        penuh = ke_png_penuh(lukis_imej(acara, hari_ini, 3, sekarang))
        telegram("sendDocument", {"chat_id": chat, "caption": "Fail kualiti penuh"},
                 {"document": ("studio-pertiwi-2minggu-penuh.png", penuh, "image/png")})
    print("Dihantar.")


if __name__ == "__main__":
    main()
