/**
 * STUDIO PERTIWI – Sistem Tempahan (Google Forms + Calendar + Telegram)
 *
 * Satu fail ini mengandungi SEMUA logik:
 *   - setupSemua()      : cipta Calendar, Form Tempah, Form Batal, Slides (sekali sahaja)
 *   - pasangTrigger()   : pasang trigger form + trigger harian
 *   - onTempahan(e)     : bila ada tempahan baru -> semak bertindih -> cipta event
 *   - onBatal(e)        : bila ada pembatalan -> padam event
 *   - hantarHarian()    : post senarai hari ini + imej 2 minggu ke Telegram
 *   - doGet(e)          : (pilihan) dipanggil oleh cron-job.org untuk tepat 7:00
 *
 * Rahsia (token Telegram dll) JANGAN tulis di sini. Simpan di
 * Project Settings > Script Properties. Lihat PANDUAN.md.
 */

// ====================== TETAPAN (boleh ubah) ======================
const CONFIG = {
  NAMA_STUDIO: 'Studio Pertiwi',
  TZ: 'Asia/Kuala_Lumpur',
  BUKA_JAM: 8,                 // slot pertama bermula 8:00am
  TUTUP_JAM: 18,               // slot terakhir tamat 6:00pm
  SLOT_MINIT: 30,
  JAM_POST: 7,                 // trigger harian (tetingkap 7-8 pagi)
  HARI_IMEJ: 14,               // bilangan hari dalam imej (susun 2 lajur)
  UMUM_TEMPAHAN_BARU: true,    // bot post "✅ ditempah" bila tempahan berjaya
  HANTAR_FAIL_PENUH: false,    // true = hantar juga fail PNG kualiti penuh
  IMEJ_HUJUNG_MINGGU_KOSONG: false // true = hantar imej walaupun post Sabtu/Ahad senyap
};

// Tajuk soalan dalam Form. JANGAN ubah selepas setup (skrip baca ikut tajuk).
const T = { NAMA: 'Nama', TARIKH: 'Tarikh', MULA: 'Masa mula', TAMAT: 'Masa tamat', TUJUAN: 'Tujuan' };

const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const HARI_PENDEK = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];
const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];

// ====================== SETUP SEKALI SAHAJA ======================

/** Jalankan SEKALI. Cipta semua benda & simpan ID. Selamat dijalankan semula (guna semula yang sedia ada). */
function setupSemua() {
  // 1. Calendar
  if (!prop_('CAL_ID')) {
    const cal = CalendarApp.createCalendar(CONFIG.NAMA_STUDIO, {
      timeZone: CONFIG.TZ,
      summary: 'Tempahan ' + CONFIG.NAMA_STUDIO
    });
    setProp_('CAL_ID', cal.getId());
  }

  // 2. Form Tempah
  if (!prop_('FORM_TEMPAH_ID')) {
    const f = FormApp.create('Tempah ' + CONFIG.NAMA_STUDIO);
    f.setDescription('Isi 4 soalan sahaja. Bot Telegram akan beritahu dalam group sama ada tempahan berjaya atau bertindih.');
    f.setCollectEmail(false);
    f.setConfirmationMessage('Terima kasih! Semak group Telegram: bot akan sahkan tempahan, atau beritahu jika masa bertindih.');
    f.addTextItem().setTitle(T.NAMA).setRequired(true);
    f.addDateItem().setTitle(T.TARIKH).setRequired(true);
    f.addListItem().setTitle(T.MULA).setChoiceValues(slotMula_()).setRequired(true);
    f.addListItem().setTitle(T.TAMAT).setChoiceValues(slotTamat_()).setRequired(true);
    f.addTextItem().setTitle(T.TUJUAN).setHelpText('Contoh: Live MW, Shooting produk').setRequired(true);
    setProp_('FORM_TEMPAH_ID', f.getId());
  }

  // 3. Form Batal
  if (!prop_('FORM_BATAL_ID')) {
    const f = FormApp.create('Batal Tempahan ' + CONFIG.NAMA_STUDIO);
    f.setDescription('Isi nama, tarikh dan masa mula tempahan yang mahu dibatalkan (sama seperti semasa tempah).');
    f.setCollectEmail(false);
    f.setConfirmationMessage('Diterima. Bot akan post dalam group Telegram.');
    f.addTextItem().setTitle(T.NAMA).setRequired(true);
    f.addDateItem().setTitle(T.TARIKH).setRequired(true);
    f.addListItem().setTitle(T.MULA).setChoiceValues(slotMula_()).setRequired(true);
    setProp_('FORM_BATAL_ID', f.getId());
  }

  // 4. Slides (portrait) untuk imej 2 minggu
  if (!prop_('SLIDES_ID')) {
    const p = Slides.Presentations.create({
      title: CONFIG.NAMA_STUDIO + ' – Imej 2 minggu (jangan padam)',
      pageSize: { width: { magnitude: 450, unit: 'PT' }, height: { magnitude: 800, unit: 'PT' } }
    });
    setProp_('SLIDES_ID', p.presentationId);
  }

  Logger.log('=== SIAP ===');
  Logger.log('Link BORANG TEMPAH (kongsi ke team): ' + FormApp.openById(prop_('FORM_TEMPAH_ID')).getPublishedUrl());
  Logger.log('Link BORANG BATAL (kongsi ke team) : ' + FormApp.openById(prop_('FORM_BATAL_ID')).getPublishedUrl());
  Logger.log('Link KALENDAR (kongsi ke team)     : ' + pautanKalendar_());
  Logger.log('Seterusnya: isi TELEGRAM_TOKEN & TELEGRAM_CHAT_ID di Script Properties, kemudian jalankan pasangTrigger().');
}

/** Pasang semua trigger. Selamat dijalankan semula (padam trigger lama dulu). */
function pasangTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('onTempahan')
    .forForm(FormApp.openById(wajib_('FORM_TEMPAH_ID'))).onFormSubmit().create();
  ScriptApp.newTrigger('onBatal')
    .forForm(FormApp.openById(wajib_('FORM_BATAL_ID'))).onFormSubmit().create();
  // Berjalan bila-bila masa antara JAM_POST dan JAM_POST+1 (had Apps Script).
  ScriptApp.newTrigger('hantarHarianTrigger')
    .timeBased().everyDays(1).atHour(CONFIG.JAM_POST).create();

  Logger.log('Trigger dipasang: tempah, batal, harian (' + CONFIG.JAM_POST + '-' + (CONFIG.JAM_POST + 1) + ' pagi).');
}

// ====================== TEMPAHAN ======================

/** Trigger: Form Tempah dihantar. */
function onTempahan(e) {
  const j = jawapan_(e.response);
  prosesTempahan_(j[T.NAMA], j[T.TARIKH], j[T.MULA], j[T.TAMAT], j[T.TUJUAN]);
}

/**
 * Logik teras tempahan (dipisahkan supaya boleh diuji tanpa Form).
 * tarikhStr = 'yyyy-MM-dd', mulaStr/tamatStr = '11:00am'.
 */
function prosesTempahan_(nama, tarikhStr, mulaStr, tamatStr, tujuan) {
  nama = String(nama || '').trim();
  tujuan = String(tujuan || '').trim();
  const minMula = parseMasa_(mulaStr);
  const minTamat = parseMasa_(tamatStr);
  const mula = tarikhMasa_(tarikhStr, minMula);
  const tamat = tarikhMasa_(tarikhStr, minTamat);
  const label = tarikhPanjang_(mula) + ', ' + rentang_(mula, tamat);

  if (minTamat <= minMula) {
    hantarTeks_('❌ <b>' + esc_(nama) + '</b>: masa tamat mesti selepas masa mula (' + esc_(mulaStr) + ' → ' + esc_(tamatStr) + '). Sila isi borang semula.');
    return 'tidak sah';
  }
  if (mula.getTime() < Date.now()) {
    hantarTeks_('❌ <b>' + esc_(nama) + '</b>: masa ' + esc_(label) + ' sudah berlalu. Sila pilih masa akan datang.');
    return 'lepas';
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // elak dua orang tempah serentak
  let bertindih;
  try {
    const cal = kalendar_();
    bertindih = cal.getEvents(mula, tamat).filter(function (ev) {
      return ev.getStartTime() < tamat && ev.getEndTime() > mula; // sentuh sempadan = BUKAN bertindih
    });
    if (!bertindih.length) {
      const ev = cal.createEvent(tujuan + ' (' + nama + ')', mula, tamat, {
        description: 'Nama: ' + nama + '\nTujuan: ' + tujuan + '\nDitempah melalui borang: ' +
          Utilities.formatDate(new Date(), CONFIG.TZ, 'd/M/yyyy h:mma')
      });
      ev.setTag('pertiwi', '1');
      ev.setTag('nama', nama);
      ev.setTag('tujuan', tujuan);
    }
  } finally {
    lock.releaseLock();
  }

  if (bertindih.length) {
    const senarai = bertindih.map(function (ev) {
      return esc_(ev.getTitle()) + ' ' + rentang_(ev.getStartTime(), ev.getEndTime());
    }).join(', ');
    hantarTeks_('❌ <b>' + esc_(nama) + '</b>: ' + esc_(label) + ' bertindih dengan <b>' + senarai + '</b>. Sila pilih masa lain.');
    return 'bertindih';
  }
  if (CONFIG.UMUM_TEMPAHAN_BARU) {
    hantarTeks_('✅ Studio ditempah: ' + esc_(label) + ' · ' + esc_(tujuan) + ' (' + esc_(nama) + ')');
  }
  return 'berjaya';
}

// ====================== PEMBATALAN ======================

/** Trigger: Form Batal dihantar. */
function onBatal(e) {
  const j = jawapan_(e.response);
  prosesBatal_(j[T.NAMA], j[T.TARIKH], j[T.MULA]);
}

function prosesBatal_(nama, tarikhStr, mulaStr) {
  nama = String(nama || '').trim();
  const mula = tarikhMasa_(tarikhStr, parseMasa_(mulaStr));
  const hujung = new Date(mula.getTime() + CONFIG.SLOT_MINIT * 60000);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let dipadam = [];
  try {
    dipadam = kalendar_().getEvents(mula, hujung).filter(function (ev) {
      return ev.getStartTime().getTime() === mula.getTime() && padanNama_(ev, nama);
    });
    dipadam = dipadam.map(function (ev) {
      const maklumat = { tajuk: ev.getTitle(), mula: ev.getStartTime(), tamat: ev.getEndTime() };
      ev.deleteEvent();
      return maklumat;
    });
  } finally {
    lock.releaseLock();
  }

  if (!dipadam.length) {
    hantarTeks_('⚠️ Cuba batal tempahan <b>' + esc_(nama) + '</b> pada ' + tarikhPanjang_(mula) + ' ' + esc_(mulaStr) +
      ' tetapi tiada padanan. Semak nama/tarikh/masa mula (mesti sama dengan tempahan asal).');
    return 'tiada';
  }
  dipadam.forEach(function (m) {
    hantarTeks_('🗑 Tempahan <b>' + esc_(nama) + '</b> dibatalkan: ' + tarikhPanjang_(m.mula) + ', ' +
      rentang_(m.mula, m.tamat) + ' (' + esc_(m.tajuk) + '). Slot kosong semula.');
  });
  return 'dibatalkan';
}

// ====================== POST HARIAN ======================

function hantarHarianTrigger() { hantarHarian(false); }

/**
 * Hantar senarai hari ini (+ imej 2 minggu).
 * paksa=true: abaikan semakan "sudah dihantar hari ini" (untuk ujian).
 * Hantaran dihadkan sekali sehari, jadi trigger Apps Script dan cron-job.org boleh wujud serentak.
 */
function hantarHarian(paksa) {
  const kini = new Date();
  const kunci = Utilities.formatDate(kini, CONFIG.TZ, 'yyyy-MM-dd');
  if (!paksa && prop_('HARIAN_TERAKHIR') === kunci) return 'sudah dihantar hari ini';

  const hujungMinggu = kini.getDay() === 0 || kini.getDay() === 6;
  const acara = acaraAntara_(mulaHari_(kini), tambahHari_(mulaHari_(kini), 1));

  if (!acara.length && hujungMinggu) {
    setProp_('HARIAN_TERAKHIR', kunci);
    if (CONFIG.IMEJ_HUJUNG_MINGGU_KOSONG) hantarImej_();
    return 'senyap (hujung minggu kosong)';
  }

  let teks = '🛑 <b>TEMPAHAN STUDIO PERTIWI – ' + tarikhPanjang_(kini) + '</b>\n';
  if (acara.length) {
    teks += acara.map(function (ev) {
      return '🎥 ' + rentang_(ev.getStartTime(), ev.getEndTime()) + ' · ' + esc_(tajukAcara_(ev));
    }).join('\n');
  } else {
    teks += 'Tiada tempahan hari ini';
  }
  teks += '\n📅 Semua tempahan: ' + pautanKalendar_();
  teks += '\n📝 Buat tempahan: ' + wajibFormUrl_('FORM_TEMPAH_ID');
  teks += '\n🗑 Batal tempahan: ' + wajibFormUrl_('FORM_BATAL_ID');
  hantarTeks_(teks);
  setProp_('HARIAN_TERAKHIR', kunci);

  try {
    hantarImej_();
  } catch (err) {
    Logger.log('Imej gagal: ' + err); // teks sudah dihantar; semak Executions untuk punca
  }
  return 'dihantar';
}

// ====================== IMEJ 2 MINGGU (Cara 1: Slides) ======================

function hantarImej_() {
  const mula = mulaHari_(new Date());
  const tajuk = '📅 Tempahan 2 minggu: ' + tarikhPanjang_(mula) + ' – ' +
    tarikhPanjang_(tambahHari_(mula, CONFIG.HARI_IMEJ - 1));
  const blob = buatImejDuaMinggu_(false);
  telegram_('sendPhoto', { chat_id: wajib_('TELEGRAM_CHAT_ID'), photo: blob, caption: tajuk });
  if (CONFIG.HANTAR_FAIL_PENUH) {
    telegram_('sendDocument', {
      chat_id: wajib_('TELEGRAM_CHAT_ID'),
      document: buatImejDuaMinggu_(true).setName('studio-pertiwi-2minggu-penuh.png'),
      caption: 'Fail kualiti penuh'
    });
  }
}

/** Lukis slide dari data Calendar Studio Pertiwi SAHAJA, kembalikan PNG. */
function buatImejDuaMinggu_(kualitiPenuh) {
  const pres = SlidesApp.openById(wajib_('SLIDES_ID'));
  const slide = pres.getSlides()[0];
  slide.getPageElements().forEach(function (p) { p.remove(); });
  slide.getBackground().setSolidFill('#FFFFFF');

  const W = pres.getPageWidth(), H = pres.getPageHeight();
  const M = 12, G = 6, Y0 = 58;
  const n = CONFIG.HARI_IMEJ;
  const baris = Math.ceil(n / 2);
  const lebar = (W - 2 * M - G) / 2;
  const tinggi = (H - M - Y0 - G * (baris - 1)) / baris;

  const hari0 = mulaHari_(new Date());
  const kini = new Date();
  const timbunan = {}; // 'yyyy-MM-dd' -> [event]
  acaraAntara_(hari0, tambahHari_(hari0, n)).forEach(function (ev) {
    const k = kunciTarikh_(ev.getStartTime());
    (timbunan[k] = timbunan[k] || []).push(ev);
  });

  // Tajuk
  const tajuk = slide.insertTextBox('STUDIO PERTIWI\nTempahan ' + n + ' hari · kemas kini ' +
    tarikhPanjang_(kini) + ', ' + jamTeks_(kini, true), M, 6, W - 2 * M, 48);
  const tt = tajuk.getText();
  tt.getTextStyle().setFontFamily('Roboto').setFontSize(10).setForegroundColor('#5F6368');
  tt.getRange(0, 14).getTextStyle().setFontSize(18).setBold(true).setForegroundColor('#202124');

  for (let i = 0; i < n; i++) {
    const d = tambahHari_(hari0, i);
    const hariIni = i === 0;
    const hujungMgg = d.getDay() === 0 || d.getDay() === 6;
    const x = M + Math.floor(i / baris) * (lebar + G);
    const y = Y0 + (i % baris) * (tinggi + G);

    const kotak = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, lebar, tinggi);
    kotak.getFill().setSolidFill(hariIni ? '#FFE08A' : hujungMgg ? '#E8EAFD' : '#F1F3F4');
    if (hariIni) {
      kotak.getBorder().getLineFill().setSolidFill('#E65100');
      kotak.getBorder().setWeight(2.5);
    } else {
      kotak.getBorder().setTransparent();
    }
    kotak.setContentAlignment(SlidesApp.ContentAlignment.TOP);

    const tajukKotak = HARI_PENDEK[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1) + (hariIni ? '  · HARI INI' : '');
    const senarai = (timbunan[kunciTarikh_(d)] || []).slice().sort(function (a, b) { return a.getStartTime() - b.getStartTime(); });
    const MAKS = 5;
    let baris_ = senarai.map(function (ev) { return ringkas_(ev); });
    if (baris_.length > MAKS) {
      const lebih = baris_.length - (MAKS - 1);
      baris_ = baris_.slice(0, MAKS - 1).concat(['+' + lebih + ' lagi']);
    }
    const kosong = !baris_.length;
    const teks = tajukKotak + '\n' + (kosong ? '–' : baris_.join('\n'));

    const tr = kotak.getText();
    tr.setText(teks);
    tr.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.START);
    tr.getTextStyle().setFontFamily('Roboto').setFontSize(10).setBold(false)
      .setForegroundColor(kosong ? '#9AA0A6' : '#202124');
    tr.getRange(0, tajukKotak.length).getTextStyle().setBold(true).setFontSize(10.5).setForegroundColor('#202124');
  }

  const slideId = slide.getObjectId();
  const id = pres.getId();
  pres.saveAndClose();

  const lakar = Slides.Presentations.Pages.getThumbnail(id, slideId, {
    'thumbnailProperties.mimeType': 'PNG',
    'thumbnailProperties.thumbnailSize': kualitiPenuh ? 'LARGE' : 'MEDIUM' // MEDIUM = lebar 800px
  });
  return UrlFetchApp.fetch(lakar.contentUrl).getBlob().setName('studio-pertiwi-2minggu.png');
}

/** "11-2 Nourani" */
function ringkas_(ev) {
  if (ev.isAllDayEvent()) return 'Sehari ' + pendekNama_(ev);
  return jamTeks_(ev.getStartTime(), false) + '-' + jamTeks_(ev.getEndTime(), false) + ' ' + pendekNama_(ev);
}

function pendekNama_(ev) {
  const nama = ev.getTag('nama') || ev.getTitle();
  const s = String(nama).trim().split(/\s+/)[0];
  return s.length > 14 ? s.slice(0, 13) + '…' : s;
}

// ====================== WEB APP (pilihan: cron-job.org) ======================

/** URL web app + ?key=SECRET_KEY akan mencetuskan post harian. Lihat PANDUAN bahagian cron-job.org. */
function doGet(e) {
  const kunci = prop_('SECRET_KEY');
  if (!kunci || !e || !e.parameter || e.parameter.key !== kunci) {
    return ContentService.createTextOutput('Tidak dibenarkan');
  }
  return ContentService.createTextOutput('OK: ' + hantarHarian(false));
}

// ====================== TELEGRAM ======================

function telegram_(kaedah, payload) {
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + wajib_('TELEGRAM_TOKEN') + '/' + kaedah, {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Telegram ' + kaedah + ' gagal (' + res.getResponseCode() + '): ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

function hantarTeks_(teks) {
  telegram_('sendMessage', {
    chat_id: wajib_('TELEGRAM_CHAT_ID'),
    text: teks,
    parse_mode: 'HTML',
    disable_web_page_preview: 'true'
  });
}

/** Selepas bot ditambah ke group, jalankan ini dan baca Log untuk dapat chat ID (nombor negatif). */
function cariChatId() {
  const r = telegram_('getUpdates', { limit: '100' });
  const dilihat = {};
  r.result.forEach(function (u) {
    const m = u.message || u.channel_post || u.my_chat_member || u.edited_message;
    if (m && m.chat && !dilihat[m.chat.id]) {
      dilihat[m.chat.id] = true;
      Logger.log(m.chat.type + ' | ' + (m.chat.title || m.chat.username || '') + ' | CHAT ID: ' + m.chat.id);
    }
  });
  if (!Object.keys(dilihat).length) {
    Logger.log('Tiada kemas kini. Hantar satu mesej dalam group (cth /start), kemudian jalankan semula.');
  }
}

// ====================== UJIAN (jalankan satu-satu dari editor) ======================

function ujiTelegram() { hantarTeks_('✅ Ujian bot Studio Pertiwi berjaya.'); }

/** Tempah esok 2:00pm–3:00pm sebagai "Ujian". */
function ujiTempahan() { Logger.log(prosesTempahan_('Ujian', tarikhEsok_(), '2:00pm', '3:00pm', 'Ujian sistem')); }
/** Patut ditolak (bertindih) selepas ujiTempahan. */
function ujiBertindih() { Logger.log(prosesTempahan_('Ujian2', tarikhEsok_(), '2:30pm', '3:30pm', 'Patut ditolak')); }
/** Batalkan tempahan ujian. */
function ujiBatal() { Logger.log(prosesBatal_('Ujian', tarikhEsok_(), '2:00pm')); }
/** Hantar post harian sekarang (abaikan semakan sekali sehari). */
function ujiHantarHarian() { Logger.log(hantarHarian(true)); }
/** Hanya jana imej, simpan dalam Drive untuk semak rupa & saiz fail. */
function ujiImej() {
  const blob = buatImejDuaMinggu_(false);
  const f = DriveApp.createFile(blob);
  Logger.log('Imej disimpan: ' + f.getUrl() + ' (' + Math.round(blob.getBytes().length / 1024) + ' KB)');
}

function tarikhEsok_() { return Utilities.formatDate(tambahHari_(new Date(), 1), CONFIG.TZ, 'yyyy-MM-dd'); }

// ====================== PEMBANTU ======================

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }
function wajib_(k) {
  const v = prop_(k);
  if (!v) throw new Error('Tetapan "' + k + '" belum diisi. Rujuk PANDUAN.md.');
  return v;
}
function wajibFormUrl_(kunciId) { return FormApp.openById(wajib_(kunciId)).getPublishedUrl(); }

function kalendar_() {
  const c = CalendarApp.getCalendarById(wajib_('CAL_ID'));
  if (!c) throw new Error('Calendar tidak ditemui. Semak CAL_ID dan akses akaun.');
  return c;
}

function pautanKalendar_() {
  return prop_('CALENDAR_LINK') ||
    ('https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(wajib_('CAL_ID')) + '&ctz=' + CONFIG.TZ);
}

function jawapan_(response) {
  const o = {};
  response.getItemResponses().forEach(function (ir) { o[ir.getItem().getTitle()] = ir.getResponse(); });
  return o;
}

function acaraAntara_(dari, hingga) {
  return kalendar_().getEvents(dari, hingga).sort(function (a, b) { return a.getStartTime() - b.getStartTime(); });
}

function tajukAcara_(ev) {
  const nama = ev.getTag('nama'), tujuan = ev.getTag('tujuan');
  return nama && tujuan ? tujuan + ' (' + nama + ')' : ev.getTitle();
}

function padanNama_(ev, nama) {
  const n = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); };
  const a = n(ev.getTag('nama') || ev.getTitle()), b = n(nama);
  return !!b && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
}

// -- slot & masa
function slotMula_() { return senaraiSlot_(CONFIG.BUKA_JAM * 60, CONFIG.TUTUP_JAM * 60 - CONFIG.SLOT_MINIT); }
function slotTamat_() { return senaraiSlot_(CONFIG.BUKA_JAM * 60 + CONFIG.SLOT_MINIT, CONFIG.TUTUP_JAM * 60); }
function senaraiSlot_(dari, hingga) {
  const out = [];
  for (let m = dari; m <= hingga; m += CONFIG.SLOT_MINIT) out.push(labelMasa_(m));
  return out;
}
function labelMasa_(minit) {
  const h = Math.floor(minit / 60), mm = minit % 60;
  return (h % 12 || 12) + ':' + ('0' + mm).slice(-2) + (h >= 12 ? 'pm' : 'am');
}
function parseMasa_(s) {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(String(s).trim());
  if (!m) throw new Error('Format masa tidak dikenali: ' + s);
  return ((+m[1] % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0)) * 60 + (+m[2]);
}
function tarikhMasa_(tarikhStr, minit) {
  const p = String(tarikhStr).split('-'); // 'yyyy-MM-dd' (zon masa projek = KL)
  return new Date(+p[0], +p[1] - 1, +p[2], Math.floor(minit / 60), minit % 60);
}
function mulaHari_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function tambahHari_(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes()); }
function kunciTarikh_(d) { return Utilities.formatDate(d, CONFIG.TZ, 'yyyy-MM-dd'); }

// -- paparan
function tarikhPanjang_(d) { return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()]; }

function jamTeks_(d, tunjukAmPm) {
  const h = d.getHours(), m = d.getMinutes();
  return (h % 12 || 12) + (m ? ':' + ('0' + m).slice(-2) : '') + (tunjukAmPm ? (h >= 12 ? 'pm' : 'am') : '');
}
/** 11am–2pm, 1–3pm, 11:30am–12pm */
function rentang_(s, e) {
  const samaAp = (s.getHours() >= 12) === (e.getHours() >= 12);
  return jamTeks_(s, !samaAp) + '–' + jamTeks_(e, true);
}
function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
