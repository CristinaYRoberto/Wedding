/* ══════════════════════════════════════════════════════════════════════
   INVITACIONES EN PDF
   ──────────────────────────────────────────────────────────────────────
   Draws a two page A5 invitation with the same palette and typefaces as
   the site. Text is drawn as vectors rather than rasterised, so it stays
   sharp, stays selectable, and the buttons can carry real links.

   Everything heavy — jsPDF, JSZip, the fonts, the photos — loads only
   when an invitation is actually generated, and is then reused for the
   whole batch.
   ══════════════════════════════════════════════════════════════════════ */
window.InvitacionPDF = (function () {

  /* ── Where the guest is sent from the PDF ─────────────────────────── */
  const SITE = (window.SITE_URL || 'https://cristinayroberto.github.io/Wedding/');
  const WA_ROBERTO  = '526621461622';
  const WA_CRISTINA = '526623419038';
  const MAPS_MISA  = 'https://maps.app.goo.gl/SFEHyiZqfgwzFr6AA';
  const MAPS_FIESTA = 'https://maps.app.goo.gl/YP5qQpQrmvKPxaF79';

  /* ── Palette, lifted from the site's custom properties ────────────── */
  const GOLD     = [184, 154, 106];
  const DARKGOLD = [138, 111,  69];
  const CHARCOAL = [ 44,  44,  44];
  const MUTED    = [122, 111,  99];
  const CREAM    = [245, 240, 232];
  const SAGE     = [232, 237, 228];
  const AVOID    = [180,  83,  75];

  const W = 148, H = 210, M = 13;          /* A5 in mm, with margin */

  let _libs = null, _assets = null;

  /* ── Lazy loading ─────────────────────────────────────────────────── */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureLibs() {
    if (_libs) return _libs;
    if (!window.jspdf) await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    if (!window.JSZip) await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    if (!window.PDF_FONTS) await loadScript('assets/pdf-fonts.js');
    _libs = { jsPDF: window.jspdf.jsPDF, JSZip: window.JSZip };
    return _libs;
  }

  /* Downscale a photo through a canvas so each PDF carries a sensibly
     sized JPEG rather than the full 2048px original. */
  function loadPhoto(src, maxW) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.naturalWidth);
        const c = document.createElement('canvas');
        c.width  = Math.round(img.naturalWidth  * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res({ data: c.toDataURL('image/jpeg', 0.72), w: c.width, h: c.height });
      };
      img.onerror = () => rej(new Error('No se pudo cargar la foto ' + src));
      img.src = src;
    });
  }

  async function ensureAssets() {
    if (_assets) return _assets;
    const [wide, tallA, tallB] = await Promise.all([
      loadPhoto('assets/gallery/gallery-02.jpg', 900),
      loadPhoto('assets/gallery/gallery-04.jpg', 460),
      loadPhoto('assets/gallery/gallery-12.jpg', 460),
    ]);
    _assets = { wide, tallA, tallB };
    return _assets;
  }

  /* ── Drawing helpers ──────────────────────────────────────────────── */
  function registerFonts(doc) {
    const F = window.PDF_FONTS;
    doc.addFileToVFS('Cinzel.ttf',     F.CinzelSemi);    doc.addFont('Cinzel.ttf',     'Cinzel',    'normal');
    doc.addFileToVFS('Cormorant.ttf',  F.CormorantReg);  doc.addFont('Cormorant.ttf',  'Cormorant', 'normal');
    doc.addFileToVFS('CormorantI.ttf', F.CormorantItal); doc.addFont('CormorantI.ttf', 'CormorantI','normal');
    doc.addFileToVFS('Lato.ttf',       F.LatoReg);       doc.addFont('Lato.ttf',       'Lato',      'normal');
  }

  function setF(doc, family, size, colour) {
    doc.setFont(family, 'normal');
    doc.setFontSize(size);
    doc.setTextColor(colour[0], colour[1], colour[2]);
  }

  /* Cinzel has no lowercase of its own character, and the site always
     letterspaces it, so mirror that here. */
  function tracked(doc, text, y, size, colour, spacing) {
    setF(doc, 'Cinzel', size, colour);
    const sp = spacing === undefined ? 0.6 : spacing;
    const chars = String(text).split('');
    let total = 0;
    chars.forEach(ch => { total += doc.getTextWidth(ch) + sp; });
    total -= sp;
    let x = (W - total) / 2;
    chars.forEach(ch => { doc.text(ch, x, y); x += doc.getTextWidth(ch) + sp; });
    return total;
  }

  function centred(doc, text, y, family, size, colour) {
    setF(doc, family, size, colour);
    doc.text(String(text), W / 2, y, { align: 'center' });
  }

  function rule(doc, y, width, colour) {
    doc.setDrawColor(colour[0], colour[1], colour[2]);
    doc.setLineWidth(0.3);
    doc.line((W - width) / 2, y, (W + width) / 2, y);
  }

  /* A filled pill with a label, wired to a URL. Returns the y below it. */
  function button(doc, label, y, url, fill, textColour) {
    const h = 9, w = 84, x = (W - w) / 2;
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(x, y, w, h, 4.5, 4.5, 'F');
    setF(doc, 'Cinzel', 8, textColour);
    doc.text(label, W / 2, y + 5.9, { align: 'center' });
    doc.link(x, y, w, h, { url: url });
    return y + h;
  }

  /* Wrapped body copy, centred, returns the y below the last line. */
  function paragraph(doc, text, y, family, size, colour, maxW, lead) {
    setF(doc, family, size, colour);
    const lines = doc.splitTextToSize(String(text), maxW);
    lines.forEach((ln, i) => doc.text(ln, W / 2, y + i * lead, { align: 'center' }));
    return y + (lines.length - 1) * lead;
  }

  /* ── Page 1: the invitation ───────────────────────────────────────── */
  function pageOne(doc, a, familia, pases) {
    doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);
    doc.rect(0, 0, W, H, 'F');

    /* Photo band across the top, cropped to a letterbox */
    const bandH = 46;
    doc.addImage(a.wide.data, 'JPEG', 0, 0, W, bandH, undefined, 'FAST');
    doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);

    let y = bandH + 13;
    tracked(doc, 'NOS CASAMOS', y, 7.5, GOLD, 1.1);

    y += 15;
    centred(doc, 'Cristina', y, 'Cormorant', 34, CHARCOAL);
    y += 9;
    centred(doc, '&', y, 'CormorantI', 17, GOLD);
    y += 12;
    centred(doc, 'Roberto', y, 'Cormorant', 34, CHARCOAL);

    y += 9;
    rule(doc, y, 34, GOLD);

    y += 7;
    tracked(doc, '03 · OCTUBRE · 2026', y, 8.5, MUTED, 0.9);

    /* Who this copy is for */
    y += 11;
    const boxH = pases ? 20 : 14;
    doc.setFillColor(SAGE[0], SAGE[1], SAGE[2]);
    doc.rect(M, y, W - 2 * M, boxH, 'F');
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.3);
    doc.rect(M, y, W - 2 * M, boxH, 'S');

    tracked(doc, 'PARA', y + 6, 6.5, GOLD, 1);
    setF(doc, 'CormorantI', 15, CHARCOAL);
    doc.text(String(familia || 'Nuestro invitado'), W / 2, y + 12.5, { align: 'center' });
    if (pases) {
      setF(doc, 'Cinzel', 7, DARKGOLD);
      doc.text(pases + (pases === 1 ? ' PASE' : ' PASES'), W / 2, y + 17.6, { align: 'center' });
    }
    y += boxH + 11;

    /* The two events, side by side */
    const colL = W / 4, colR = 3 * W / 4;
    function event(cx, label, name, time, place, url) {
      setF(doc, 'Cinzel', 6.2, GOLD);
      doc.text(label, cx, y, { align: 'center' });
      setF(doc, 'Cormorant', 14, CHARCOAL);
      doc.text(name, cx, y + 7, { align: 'center' });
      setF(doc, 'Cinzel', 9, DARKGOLD);
      doc.text(time, cx, y + 13.5, { align: 'center' });
      setF(doc, 'Lato', 7, MUTED);
      const lines = doc.splitTextToSize(place, 56);
      lines.forEach((ln, i) => doc.text(ln, cx, y + 19 + i * 3.6, { align: 'center' }));
      const by = y + 19 + lines.length * 3.6 + 1;
      setF(doc, 'Cinzel', 6, GOLD);
      doc.text('VER EN MAPA', cx, by, { align: 'center' });
      const tw = doc.getTextWidth('VER EN MAPA');
      doc.link(cx - tw / 2, by - 3, tw, 4.5, { url: url });
    }
    event(colL, 'CEREMONIA', 'Misa', '12:00 PM',
          'Catedral de Hermosillo, Blvr. Miguel Hidalgo S/N, Centro', MAPS_MISA);
    event(colR, 'RECEPCIÓN', 'Cena y Baile', '7:00 PM',
          'Salón Las Cascadas, Los Molinos 97, Las Minitas', MAPS_FIESTA);

    y += 40;
    button(doc, 'CONFIRMAR ASISTENCIA', y, SITE + '#rsvp', CHARCOAL, CREAM);

    y += 13;
    setF(doc, 'CormorantI', 8.5, MUTED);
    doc.text('Confirma antes del 1 de septiembre de 2026', W / 2, y, { align: 'center' });
  }

  /* ── Page 2: what a guest needs at a glance ───────────────────────── */
  function pageTwo(doc, a) {
    doc.addPage();
    doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);
    doc.rect(0, 0, W, H, 'F');

    let y = 16;
    tracked(doc, 'DRESS CODE', y, 7.5, GOLD, 1.1);
    y += 8;
    centred(doc, 'Vestimenta Formal', y, 'Cormorant', 20, CHARCOAL);
    y += 6;
    rule(doc, y, 26, GOLD);

    y += 7;
    setF(doc, 'Lato', 7.6, MUTED);
    const rules = [
      'Traje sastre clásico para caballero. Sugerencias: negro, gris, azul marino.',
      'Corbata o pañuelo de cualquier color menos blanco.',
      'Vestido largo o cóctel para nuestras invitadas.',
    ];
    rules.forEach(r => {
      const lines = doc.splitTextToSize('·  ' + r, W - 2 * M - 6);
      lines.forEach(ln => { doc.text(ln, M + 3, y); y += 4.2; });
      y += 1.2;
    });

    /* Colours to avoid — the one loud thing on the page */
    y += 2;
    const avH = 26;
    doc.setFillColor(250, 244, 243);
    doc.rect(M, y, W - 2 * M, avH, 'F');
    doc.setDrawColor(AVOID[0], AVOID[1], AVOID[2]);
    doc.setLineWidth(0.3);
    doc.rect(M, y, W - 2 * M, avH, 'S');
    setF(doc, 'Cinzel', 7, AVOID);
    doc.text('POR FAVOR EVITA ESTOS TONOS EN TU VESTIDO', W / 2, y + 6, { align: 'center' });

    const sw = ['Blanco', 'Gris', 'Dorado', 'Negro'];
    const fills = [[247, 244, 236], [157, 157, 157], [201, 162, 39], [26, 26, 26]];
    const cw = (W - 2 * M) / 4;
    sw.forEach((label, i) => {
      const cx = M + cw * i + cw / 2;
      doc.setFillColor(fills[i][0], fills[i][1], fills[i][2]);
      doc.circle(cx, y + 13, 3.2, 'F');
      doc.setDrawColor(AVOID[0], AVOID[1], AVOID[2]);
      doc.setLineWidth(0.4);
      doc.circle(cx, y + 13, 3.2, 'S');
      doc.line(cx - 2.3, y + 15.3, cx + 2.3, y + 10.7);   /* struck through */
      setF(doc, 'Lato', 6.4, MUTED);
      doc.text(label, cx, y + 21, { align: 'center' });
    });
    y += avH + 10;

    /* Gifts */
    tracked(doc, 'REGALOS', y, 7, GOLD, 1);
    y += 6;
    y = paragraph(doc, 'Su presencia es el regalo más valioso. Si desean tener un detalle, lo recibimos con cariño.',
                  y, 'Lato', 7.4, MUTED, W - 2 * M - 10, 4);
    y += 7;
    setF(doc, 'Lato', 7.2, CHARCOAL);
    const banks = [
      'BBVA · Cristina Borquez Bernal · CLABE 4152314000799307',
      'Santander · José Roberto Moreno Ruiz · CLABE 014760200064187105',
    ];
    banks.forEach(b => { doc.text(b, W / 2, y, { align: 'center' }); y += 4.6; });
    y += 6;

    /* Hotels */
    tracked(doc, 'HOTELES CERCANOS', y, 7, GOLD, 1);
    y += 6.5;
    const hotels = [
      ['Lucerna Hermosillo', '662 259 2000'],
      ['Fiesta Inn Hermosillo', '662 289 1700'],
      ['Holiday Inn Express', '662 289 0000'],
      ['Araiza Hermosillo', '662 210 9700'],
    ];
    const hw = (W - 2 * M) / 2;
    hotels.forEach((h, i) => {
      const cx = M + hw * (i % 2) + hw / 2;
      const ry = y + Math.floor(i / 2) * 10;
      setF(doc, 'Cormorant', 11, CHARCOAL);
      doc.text(h[0], cx, ry, { align: 'center' });
      setF(doc, 'Lato', 7, DARKGOLD);
      doc.text(h[1], cx, ry + 4.2, { align: 'center' });
    });
    y += 24;

    /* Confirm, by whichever route suits the guest */
    tracked(doc, 'CONFIRMA POR WHATSAPP', y, 7, GOLD, 1);
    y += 5;
    const bw = 56, gap = 6, bx = (W - (bw * 2 + gap)) / 2;
    [['ROBERTO', WA_ROBERTO], ['CRISTINA', WA_CRISTINA]].forEach((c, i) => {
      const x = bx + (bw + gap) * i;
      doc.setFillColor(37, 211, 102);
      doc.roundedRect(x, y, bw, 8, 4, 4, 'F');
      setF(doc, 'Cinzel', 7, [255, 255, 255]);
      doc.text(c[0], x + bw / 2, y + 5.4, { align: 'center' });
      doc.link(x, y, bw, 8, { url: 'https://wa.me/' + c[1] });
    });
    y += 15;

    /* Back to the site for everything this page could not hold */
    button(doc, 'VER LA INVITACIÓN COMPLETA', y, SITE, GOLD, [255, 255, 255]);
    y += 6;
    setF(doc, 'CormorantI', 7.6, MUTED);
    doc.text('Historia, galería, padrinos, menú y preguntas frecuentes', W / 2, y, { align: 'center' });

    /* Two portraits closing the page */
    const py = H - 42, pw = (W - 2 * M - 5) / 2, ph = 30;
    doc.addImage(a.tallA.data, 'JPEG', M, py, pw, ph, undefined, 'FAST');
    doc.addImage(a.tallB.data, 'JPEG', M + pw + 5, py, pw, ph, undefined, 'FAST');

    setF(doc, 'Cinzel', 6.5, GOLD);
    doc.text('C  &  R    ·    03 · 10 · 2026', W / 2, H - 7, { align: 'center' });
  }

  /* ── Public API ───────────────────────────────────────────────────── */
  async function buildDoc(familia, pases) {
    const { jsPDF } = await ensureLibs();
    const a = await ensureAssets();
    const doc = new jsPDF({ unit: 'mm', format: [W, H], compress: true });
    registerFonts(doc);
    doc.setProperties({
      title: 'Invitación · Boda de Cristina y Roberto',
      subject: familia || '',
      author: 'Cristina & Roberto',
    });
    pageOne(doc, a, familia, pases);
    pageTwo(doc, a);
    return doc;
  }

  function safeName(s) {
    return String(s || 'invitado')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'invitado';
  }

  async function one(familia, pases) {
    const doc = await buildDoc(familia, pases);
    doc.save('Invitacion_' + safeName(familia) + '.pdf');
  }

  async function preview(familia, pases) {
    const doc = await buildDoc(familia, pases);
    window.open(doc.output('bloburl'), '_blank', 'noopener');
  }

  /* Minimal CSV reader: handles quoted fields, commas or semicolons. */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', q = false;
    const delim = (text.split('\n')[0].split(';').length > text.split('\n')[0].split(',').length) ? ';' : ',';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') q = false;
        else field += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }

    const out = [];
    rows.forEach((r, i) => {
      const name = (r[0] || '').trim();
      if (!name) return;
      /* Skip a header row if the first cell is obviously a label */
      if (i === 0 && /nombre|name|invitad|familia/i.test(name)) return;
      const n = parseInt((r[1] || '').trim(), 10);
      out.push({ familia: name, pases: isNaN(n) || n < 1 ? 1 : n });
    });
    return out;
  }

  async function batch(rows, onProgress) {
    const { JSZip } = await ensureLibs();
    await ensureAssets();
    const zip = new JSZip();
    const used = Object.create(null);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const doc = await buildDoc(r.familia, r.pases);
      let fn = 'Invitacion_' + safeName(r.familia);
      if (used[fn]) { used[fn]++; fn += '_' + used[fn]; } else { used[fn] = 1; }
      zip.file(fn + '.pdf', doc.output('arraybuffer'));
      if (onProgress) onProgress(i + 1, rows.length, r.familia);
      /* Yield so the progress line actually paints between documents. */
      if (i % 5 === 4) await new Promise(res => setTimeout(res, 0));
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' },
      meta => { if (onProgress) onProgress(rows.length, rows.length, 'Comprimiendo ' + Math.round(meta.percent) + '%'); });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Invitaciones_Boda_CR.zip';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return rows.length;
  }

  return { one: one, preview: preview, batch: batch, parseCSV: parseCSV };
})();
