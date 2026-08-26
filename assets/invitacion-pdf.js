/* ══════════════════════════════════════════════════════════════════════
   INVITACIONES EN PDF
   ──────────────────────────────────────────────────────────────────────
   Three A5 pages with the same palette and typefaces as the site. Text
   is drawn as vectors rather than rasterised, so it stays sharp, stays
   selectable, and the buttons carry real links.

   Confirming happens on the site, in the form, so that every reply
   lands in one place. The PDF only carries the button that opens it.

   Everything heavy — jsPDF, JSZip, the fonts, the photos — loads only
   when an invitation is generated, then is reused for the whole batch.
   ══════════════════════════════════════════════════════════════════════ */
window.InvitacionPDF = (function () {

  const SITE = (window.SITE_URL || 'https://cristinayroberto.github.io/Wedding/');
  const WA_ROBERTO  = '526621461622';
  const WA_CRISTINA = '526623419038';
  const MAPS_MISA   = 'https://maps.app.goo.gl/SFEHyiZqfgwzFr6AA';
  const MAPS_FIESTA = 'https://maps.app.goo.gl/YP5qQpQrmvKPxaF79';

  const GOLD     = [184, 154, 106];
  const DARKGOLD = [138, 111,  69];
  const CHARCOAL = [ 44,  44,  44];
  const MUTED    = [122, 111,  99];
  const CREAM    = [245, 240, 232];
  const SAGE     = [232, 237, 228];
  const AVOID    = [180,  83,  75];
  const WHITE    = [255, 255, 255];
  const LIGHTGOLD = [248, 242, 229];
  const GOLD_BORDER = [214, 195, 158];

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

  /* Crop the source to the aspect the layout needs, then downscale.
     jsPDF stretches whatever it is handed, so the cropping has to
     happen here or faces come out squashed. focusY biases the crop
     window vertically: 0 keeps the top, 1 the bottom. */
  function loadPhoto(src, aspect, outW, focusY, zoom, focusX, keepAlpha) {
    zoom = zoom || 1;
    focusX = focusX === undefined ? 0.5 : focusX;
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const sw = img.naturalWidth, sh = img.naturalHeight;
        let cw = sw, ch = Math.round(sw / aspect);
        if (ch > sh) { ch = sh; cw = Math.round(sh * aspect); }
        /* zoom shrinks that window before it is positioned, so a crop can
           frame a detail (a face) rather than only the widest fit. */
        cw = Math.round(cw / zoom);
        ch = Math.round(ch / zoom);
        const sx = Math.round((sw - cw) * focusX);
        const sy = Math.round((sh - ch) * (focusY === undefined ? 0.5 : focusY));

        const c = document.createElement('canvas');
        c.width  = Math.min(outW, cw);
        c.height = Math.round(c.width / aspect);
        c.getContext('2d').drawImage(img, sx, sy, cw, ch, 0, 0, c.width, c.height);
        /* JPEG has no alpha channel - exporting a transparent PNG (like the
           tennis illustration) through it flattens the transparent
           background to solid black. keepAlpha exports PNG instead so the
           real transparency survives and composites onto the card behind it. */
        res(keepAlpha
          ? { data: c.toDataURL('image/png'), aspect: aspect }
          : { data: c.toDataURL('image/jpeg', 0.72), aspect: aspect });
      };
      img.onerror = () => rej(new Error('No se pudo cargar la foto ' + src));
      img.src = src;
    });
  }

  const BAND_ASPECT = W / 46;
  const DOORBAND_H = 52;
  const DOORBAND_ASPECT = W / DOORBAND_H;

  /* Tiles a small texture swatch into one full-page-sized image, since
     jsPDF has no repeating-background primitive - a single addImage call
     of this is far cheaper than tiling addImage calls per page. */
  function loadTiledTexture(src, pageAspect, outW, tilePx) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = outW;
        c.height = Math.round(outW / pageAspect);
        const ctx = c.getContext('2d');
        const tileW = tilePx, tileH = tilePx * (img.naturalHeight / img.naturalWidth);
        for (let y = 0; y < c.height; y += tileH) {
          for (let x = 0; x < c.width; x += tileW) {
            ctx.drawImage(img, x, y, tileW, tileH);
          }
        }
        res({ data: c.toDataURL('image/jpeg', 0.85) });
      };
      img.onerror = () => rej(new Error('No se pudo cargar la textura ' + src));
      img.src = src;
    });
  }

  async function ensureAssets() {
    if (_assets) return _assets;
    const [band, telasW, telasG, telasD, telasN, veil, twoA, twoB, closing, tennis, bgDoor, bgPath, bgStreet, texture] = await Promise.all([
      /* The hands sit just past the middle of this portrait, so the
         wide strip is cropped around them. */
      loadPhoto('assets/gallery/gallery-01.jpg', BAND_ASPECT, 1200, 0.52),
      /* Four separate quarter-crops of the same strip (one per shade),
         framed as their own cards instead of one continuous banner -
         matches the site's four individual swatch cards. focusX 0/⅓/⅔/1
         walks the crop window across the strip left to right. */
      loadPhoto('assets/gallery/dress-code_v2.jpg', 400 / 482, 340, 0.5, 1, 0),
      loadPhoto('assets/gallery/dress-code_v2.jpg', 400 / 482, 340, 0.5, 1, 1 / 3),
      loadPhoto('assets/gallery/dress-code_v2.jpg', 400 / 482, 340, 0.5, 1, 2 / 3),
      loadPhoto('assets/gallery/dress-code_v2.jpg', 400 / 482, 340, 0.5, 1, 1),
      /* Full-page background for the dress code: zoomed and positioned so
         the couple's faces sit in the page's own empty margin at the top,
         clear of the rules text and the fabric photo below them. */
      loadPhoto('assets/gallery/gallery-13.jpg', W / H, 900, 0.32, 1.35),
      loadPhoto('assets/gallery/gallery-09.jpg', 1, 460, 0.32),
      loadPhoto('assets/gallery/gallery-03.jpg', 1, 460, 0.42),
      loadPhoto('assets/gallery/gallery-12.jpg', 1.4, 900, 0.42),
      loadPhoto('assets/UI/outfit_tennis.png', 1085 / 1450, 500, 0.5, 1, 0.5, true),
      /* Dress-code page backgrounds - each fills the whole sheet, cropped
         to A5 so the couple sits in the lower half, below the content.
         focusX centres the crop window on where the couple actually
         stands in each frame (they are off-centre in the landscape ones). */
      loadPhoto('assets/gallery/gallery-13.jpg', W / H, 950, 0.5),
      loadPhoto('assets/gallery/gallery-07.jpg', W / H, 950, 0.5, 1, 0.29),
      loadPhoto('assets/gallery/gallery-06.jpg', W / H, 950, 0.5, 1, 0.05),
      /* Same faint scrollwork as the site, for the pages that have no
         photo of their own to sit on. */
      loadTiledTexture('assets/gallery/textura_03_tier1.jpg', W / H, 700, 140),
    ]);
    _assets = { band, telasW, telasG, telasD, telasN, veil, twoA, twoB, closing, tennis, bgDoor, bgPath, bgStreet, texture };
    return _assets;
  }

  /* Same faint site texture under every page's content, so the cream
     background never reads as flat white. Page 2 layers a.veil on top
     of this at low opacity for its own photo detail. */
  function bgTexture(doc, a) {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.8 }));
    doc.addImage(a.texture.data, 'JPEG', 0, 0, W, H, undefined, 'FAST');
    doc.restoreGraphicsState();
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

  /* The site always letterspaces Cinzel, so mirror that here. */
  function tracked(doc, text, y, size, colour, spacing, cx) {
    setF(doc, 'Cinzel', size, colour);
    const sp = spacing === undefined ? 0.6 : spacing;
    const chars = String(text).split('');
    let total = 0;
    chars.forEach(ch => { total += doc.getTextWidth(ch) + sp; });
    total -= sp;
    let x = (cx === undefined ? W / 2 : cx) - total / 2;
    chars.forEach(ch => { doc.text(ch, x, y); x += doc.getTextWidth(ch) + sp; });
  }

  function centred(doc, text, y, family, size, colour, cx) {
    setF(doc, family, size, colour);
    doc.text(String(text), cx === undefined ? W / 2 : cx, y, { align: 'center' });
  }

  function rule(doc, y, width, colour, cx) {
    cx = cx === undefined ? W / 2 : cx;
    doc.setDrawColor(colour[0], colour[1], colour[2]);
    doc.setLineWidth(0.3);
    doc.line(cx - width / 2, y, cx + width / 2, y);
  }

  function button(doc, label, y, url, fill, textColour) {
    const h = 10, w = 88, x = (W - w) / 2;
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.roundedRect(x, y, w, h, 5, 5, 'F');
    setF(doc, 'Cinzel', 8, textColour);
    doc.text(label, W / 2, y + 6.4, { align: 'center' });
    doc.link(x, y, w, h, { url: url });
    return y + h;
  }

  function paragraph(doc, text, y, family, size, colour, maxW, lead, cx) {
    cx = cx === undefined ? W / 2 : cx;
    setF(doc, family, size, colour);
    const lines = doc.splitTextToSize(String(text), maxW);
    lines.forEach((ln, i) => doc.text(ln, cx, y + i * lead, { align: 'center' }));
    return y + (lines.length - 1) * lead;
  }

  function page(doc, first) {
    if (!first) doc.addPage();
    doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);
    doc.rect(0, 0, W, H, 'F');
  }

  function footer(doc, n, colour) {
    setF(doc, 'Cinzel', 6, colour || GOLD);
    doc.text('C  &  R    ·    03 · 10 · 2026    ·    ' + n, W / 2, H - 5.5, { align: 'center' });
  }

  /* ── Page 1 — the invitation ──────────────────────────────────────
     Coordinates are fixed rather than accumulated: the page has no room
     to spare below 206mm, and a drifting cursor is what pushed the
     button under the footer before. */
  function pageOne(doc, a, familia, pases) {
    page(doc, true);
    bgTexture(doc, a);

    const bandH = W / BAND_ASPECT;                       /* 46mm */
    doc.addImage(a.band.data, 'JPEG', 0, 0, W, bandH, undefined, 'FAST');

    tracked(doc, 'NOS CASAMOS', 57, 7.5, GOLD, 1.1);
    centred(doc, 'Cristina', 70, 'Cormorant', 27, CHARCOAL);
    centred(doc, '&',        77.5, 'CormorantI', 15, GOLD);
    centred(doc, 'Roberto',  87.5, 'Cormorant', 27, CHARCOAL);
    rule(doc, 95, 34, GOLD);
    tracked(doc, '03 · OCTUBRE · 2026', 101, 8.5, MUTED, 0.9);

    const boxY = 109, boxH = 20;
    doc.setFillColor(SAGE[0], SAGE[1], SAGE[2]);
    doc.rect(M, boxY, W - 2 * M, boxH, 'F');
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.3);
    doc.rect(M, boxY, W - 2 * M, boxH, 'S');
    tracked(doc, 'PARA', boxY + 6, 6.5, GOLD, 1);
    setF(doc, 'CormorantI', 15, CHARCOAL);
    doc.text(String(familia || 'Nuestro invitado'), W / 2, boxY + 12.6, { align: 'center' });
    if (pases) {
      setF(doc, 'Cinzel', 7, DARKGOLD);
      doc.text(pases + (pases === 1 ? ' ACOMPAÑANTE' : ' ACOMPAÑANTES'), W / 2, boxY + 17.6, { align: 'center' });
    }

    /* Both columns share one baseline for the map link: the addresses
       wrap to different line counts, and letting each column place its
       own link left the two sitting at visibly different heights. */
    const ey = 138, colL = W / 4, colR = 3 * W / 4;
    setF(doc, 'Lato', 7, MUTED);
    const events = [
      { cx: colL, label: 'CEREMONIA', time: '12:00 PM', url: MAPS_MISA,
        lines: doc.splitTextToSize('Catedral de Hermosillo, Blvr. Miguel Hidalgo S/N, Centro', 56) },
      { cx: colR, label: 'RECEPCIÓN', time: '7:00 PM', url: MAPS_FIESTA,
        lines: doc.splitTextToSize('Salón Las Cascadas, Los Molinos 97, Las Minitas', 56) },
    ];
    const linkY = ey + 18 + Math.max.apply(null, events.map(e => e.lines.length)) * 3.6 + 1.5;
    events.forEach(e => {
      tracked(doc, e.label, ey, 6.2, GOLD, 0.7, e.cx);
      centred(doc, e.time, ey + 10, 'Cinzel', 11, DARKGOLD, e.cx);
      setF(doc, 'Lato', 7, MUTED);
      e.lines.forEach((ln, i) => doc.text(ln, e.cx, ey + 18 + i * 3.6, { align: 'center' }));
      setF(doc, 'Cinzel', 6, GOLD);
      doc.text('VER EN MAPA', e.cx, linkY, { align: 'center' });
      const tw = doc.getTextWidth('VER EN MAPA');
      doc.link(e.cx - tw / 2, linkY - 3, tw, 4.5, { url: e.url });
    });

    /* The one rule the couple wants read before the day itself */
    tracked(doc, 'ESTRICTAMENTE NO NIÑOS', 179, 8, CHARCOAL, 0.9);

    /* No confirm button here on purpose: a guest who taps it from the
       first page never reads the dress code, the gifts or the hotels.
       The only button lives on the last page, so replying comes after
       reading. This keeps the deadline visible without the shortcut. */
    setF(doc, 'CormorantI', 8, MUTED);
    doc.text('Se confirma en la página antes del 1 de septiembre de 2026',
             W / 2, 190, { align: 'center' });
    doc.text('En caso de no asistencia, también nos gustaría conocerlo a la brevedad. Gracias.',
             W / 2, 194.2, { align: 'center' });

    footer(doc, '1 / 4');
  }

  /* ── Page 2 — dress code ──────────────────────────────────────────
     The photo fills the whole sheet on every variant; the content is
     deliberately small and packed into the top third so the couple, who
     always sit in the lower half of these frames, are never covered.
     A cream panel sits under the text only where the text actually is,
     fading out before it reaches them, so the type stays readable
     without flattening the photograph. */
  const PAGE2_BG = { door: 'bgDoor', path: 'bgPath', street: 'bgStreet' };

  function pageTwo(doc, a, variant) {
    const bg = a[PAGE2_BG[variant] || 'bgDoor'];
    page(doc);
    doc.addImage(bg.data, 'JPEG', 0, 0, W, H, undefined, 'FAST');

    /* Cream wash over the text zone, then a short stepped fade so it
       dissolves into the photo instead of ending on a hard edge
       (jsPDF has no gradient primitive of its own). */
    const washH = 95, fadeH = 14, washOpacity = 0.78;
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: washOpacity }));
    doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);
    doc.rect(0, 0, W, washH, 'F');
    doc.restoreGraphicsState();
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: washOpacity * (1 - (i + 1) / steps) }));
      doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);
      doc.rect(0, washH + i * (fadeH / steps), W, fadeH / steps + 0.3, 'F');
      doc.restoreGraphicsState();
    }

    tracked(doc, 'DRESS CODE', 12, 5.4, GOLD, 0.9);
    centred(doc, 'Vestimenta Formal', 18.5, 'Cormorant', 12.5, CHARCOAL);
    rule(doc, 22, 16, GOLD);

    let y = 26.5;
    y = paragraph(doc, 'Gracias por seguir este dress code para cuidar juntos el estilo de la celebración.',
                  y, 'Lato', 5.6, MUTED, W - 2 * M - 4, 3);
    y += 3.5;

    /* Two slim cards, sized to their text rather than to the page. */
    const cardGap = 3, cardW = (W - 2 * M - cardGap) / 2;
    const cardDefs = [
      { title: 'CABALLEROS', x: M, items: [
        'Traje sastre clásico. Color: negro, gris, azul marino.',
        'Corbata o pañuelo de cualquier color menos blanco.',
      ] },
      { title: 'DAMAS', x: M + cardW + cardGap, items: [ 'Vestido largo o cóctel.' ] },
    ];
    const cardTop = y;
    let cardH = 0;
    cardDefs.forEach(c => {
      let cy = 8;
      setF(doc, 'Lato', 5.6, CHARCOAL);
      c.items.forEach(item => { cy += doc.splitTextToSize(item, cardW - 7).length * 3.2 + 1; });
      cardH = Math.max(cardH, cy + 1.6);
    });
    cardDefs.forEach(c => {
      doc.setFillColor(LIGHTGOLD[0], LIGHTGOLD[1], LIGHTGOLD[2]);
      doc.rect(c.x, cardTop, cardW, cardH, 'F');
      doc.setDrawColor(GOLD_BORDER[0], GOLD_BORDER[1], GOLD_BORDER[2]);
      doc.setLineWidth(0.25);
      doc.rect(c.x, cardTop, cardW, cardH, 'S');
      tracked(doc, c.title, cardTop + 5, 5.2, CHARCOAL, 0.5, c.x + cardW / 2);
      let cy = cardTop + 8.4;
      c.items.forEach(item => {
        const lines = doc.splitTextToSize(item, cardW - 7);
        lines.forEach((ln, i) => {
          setF(doc, 'Lato', 5.6, CHARCOAL);
          if (i === 0) { setF(doc, 'Cinzel', 4.8, GOLD); doc.text('·', c.x + 3, cy); setF(doc, 'Lato', 5.6, CHARCOAL); }
          doc.text(ln, c.x + 5.5, cy);
          cy += 3.2;
        });
        cy += 1;
      });
    });
    y = cardTop + cardH + 3;

    /* Shoes note: one line of type and a small figure, kept short so the
       card stays a single band rather than a block. */
    const tPad = 1.8, timgW = 8, timgH = timgW / a.tennis.aspect;
    const tCardH = timgH + 2 * tPad;
    doc.setFillColor(LIGHTGOLD[0], LIGHTGOLD[1], LIGHTGOLD[2]);
    doc.rect(M, y, W - 2 * M, tCardH, 'F');
    doc.setDrawColor(GOLD_BORDER[0], GOLD_BORDER[1], GOLD_BORDER[2]);
    doc.setLineWidth(0.25);
    doc.rect(M, y, W - 2 * M, tCardH, 'S');
    doc.addImage(a.tennis.data, 'PNG', M + tPad, y + tPad, timgW, timgH, undefined, 'FAST');
    setF(doc, 'Cinzel', 5.4, CHARCOAL);
    const tTextX = M + tPad + timgW + 3, tTextW = (W - M - tPad) - tTextX;
    const tlines = doc.splitTextToSize('¡Lleva también tus tenis preferidos por si te cansas, estés más cómodo y bailes toda la noche!', tTextW);
    const tlineH = 3.1, tY = y + (tCardH - tlines.length * tlineH) / 2 + 2.3;
    tlines.forEach((ln, i) => doc.text(ln, tTextX, tY + i * tlineH));
    y += tCardH + 3.5;

    tracked(doc, 'POR FAVOR EVITA ESTOS TONOS', y, 5.2, AVOID, 0.35);
    y += 3.4;
    y = paragraph(doc, 'Reservados para los novios y la decoración.',
                  y, 'CormorantI', 7, AVOID, W - 2 * M - 10, 3.2);
    y += 3.4;

    /* Wide-but-short swatches: at full square they would push the row
       down over the couple, and the shade is all these need to show. */
    const swGap = 2.5, swInset = 16;
    const swW = (W - 2 * (M + swInset) - 3 * swGap) / 4, swH = swW * 0.5;
    [[a.telasW, 'Evitar Blanco'], [a.telasG, 'Evitar Gris'], [a.telasD, 'Evitar Dorado'], [a.telasN, 'Evitar Negro']]
      .forEach((s, i) => {
        const sx = M + swInset + i * (swW + swGap);
        doc.addImage(s[0].data, 'JPEG', sx, y, swW, swH, undefined, 'FAST');
        doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
        doc.setLineWidth(0.25);
        doc.rect(sx, y, swW, swH, 'S');
        setF(doc, 'Cinzel', 4.4, MUTED);
        doc.text(s[1], sx + swW / 2, y + swH + 2.8, { align: 'center' });
      });

    /* The footer would otherwise sit straight over the couple's feet.
       A short warm-dark gradient anchors the bottom edge and gives the
       cream type something to read against. */
    const scrimH = 20, sSteps = 12;
    for (let i = 0; i < sSteps; i++) {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.5 * ((i + 1) / sSteps) }));
      doc.setFillColor(38, 28, 24);
      doc.rect(0, H - scrimH + i * (scrimH / sSteps), W, scrimH / sSteps + 0.3, 'F');
      doc.restoreGraphicsState();
    }

    footer(doc, '2 / 4', CREAM);
  }

  /* ── Page 3 — gifts, hotels, two portraits ────────────────────────── */
  function pageThree(doc, a) {
    page(doc);
    bgTexture(doc, a);

    tracked(doc, 'REGALOS', 18, 7.5, GOLD, 1.1);
    paragraph(doc, 'Tu presencia es el regalo más valioso para nosotros. Si es tu deseo otorgarnos un detalle, lo recibimos con mucho cariño.',
              25, 'Lato', 7.6, MUTED, W - 2 * M - 8, 4.4);

    let y = 38;
    const bankH = 15, bankW = W - 2 * M;
    [['BBVA', 'Cristina Borquez Bernal', '012180015298657265'],
     ['Banorte', 'José Roberto Moreno Ruiz', '072760013297837244']].forEach(b => {
      doc.setFillColor(SAGE[0], SAGE[1], SAGE[2]);
      doc.rect(M, y, bankW, bankH, 'F');
      doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.setLineWidth(0.3);
      doc.rect(M, y, bankW, bankH, 'S');
      setF(doc, 'Cinzel', 6.4, DARKGOLD);
      doc.text('BANCO · ' + b[0], W / 2, y + 5, { align: 'center' });
      setF(doc, 'Lato', 7.4, CHARCOAL);
      doc.text(b[1], W / 2, y + 9.4, { align: 'center' });
      /* A CLABE is 18 digits; a 16-digit number is a card, and calling
         it a CLABE is what makes a transfer bounce. */
      const digits = b[2].replace(/\D/g, '');
      doc.text((digits.length === 18 ? 'CLABE ' : 'TARJETA ') + b[2], W / 2, y + 13.2, { align: 'center' });
      y += bankH + 2.5;
    });

    /* Without a reference the couple cannot tell whose transfer is
       whose, so the suggested wording sits with the accounts.
       Straight quotes only: the embedded font subsets drop curly ones
       and truncate the string outright at a guillemet. */
    y += 2;
    y = paragraph(doc, 'Sugerencia: En el caso de transferencia, no olvides poner "Nombre-RegaloBoda"',
                  y, 'Lato', 7, MUTED, W - 2 * M - 10, 3.9);

    y += 8;
    tracked(doc, 'EFECTIVO', y, 7, GOLD, 1);
    y += 5.5;
    y = paragraph(doc, 'Contaremos con un buzón discreto en la recepción para quienes prefieran entregar su obsequio en persona durante la celebración.',
                  y, 'Lato', 7.6, MUTED, W - 2 * M - 8, 4.4);

    /* The hotel list now lives on the site as a popup, since a printed
       page can't hold one and stay current — point there instead of
       duplicating hotel data that can drift out of date in two places. */
    y += 6;
    tracked(doc, 'HOSPEDAJE', y, 7, GOLD, 1);
    y += 6;
    y = paragraph(doc, 'Si te vas a hospedar en un hotel, en la página encontrarás una lista de hoteles recomendados en Hermosillo con teléfono y distancia a cada evento.',
                  y, 'Lato', 7.6, MUTED, W - 2 * M - 8, 4.4);
    y += 6;
    y = button(doc, 'VER LISTA DE HOTELES', y, SITE + '#hoteles', GOLD, CREAM);
    y += 6;

    /* Two square crops, side by side - a touch smaller than a straight
       half-width split, to leave room for everything above them. */
    const gap = 6, pw = (W - 2 * M - gap) / 2 - 4, px = M + 2, py = y;
    doc.addImage(a.twoA.data, 'JPEG', px, py, pw, pw, undefined, 'FAST');
    doc.addImage(a.twoB.data, 'JPEG', px + pw + gap, py, pw, pw, undefined, 'FAST');

    setF(doc, 'CormorantI', 8.5, MUTED);
    doc.text('Nos vemos el 3 de octubre', W / 2, py + pw + 7, { align: 'center' });

    footer(doc, '3 / 4');
  }

  /* ── Page 4 — one photo, and the one way to reply ─────────────────── */
  function pageFour(doc, a) {
    page(doc);
    bgTexture(doc, a);

    const iw = W - 2 * M, ih = iw / 1.4;
    doc.addImage(a.closing.data, 'JPEG', M, 18, iw, ih, undefined, 'FAST');

    let y = 18 + ih + 14;                                /* ≈ 118 */
    tracked(doc, 'CONFIRMA TU ASISTENCIA', y, 7.5, GOLD, 1.1);
    y += 8;
    y = paragraph(doc, 'Toca el botón y llena el formulario en la página. Ahí encontrarás también la historia, la galería, los padrinos y el menú.',
                  y, 'Lato', 7.6, MUTED, W - 2 * M - 8, 4.4);
    y += 9;
    y = button(doc, 'IR A LA PÁGINA Y CONFIRMAR', y, SITE + '#rsvp', CHARCOAL, CREAM);

    y += 7;
    y = paragraph(doc, '¿Se complica? Escríbenos a cualquiera de estos números o clic en el número para enviarte a WhatsApp directamente y te apoyamos.',
                  y, 'CormorantI', 7.8, MUTED, W - 2 * M - 6, 4.2);
    y += 6.5;
    /* Contact, not a second way to confirm: replies still come through
       the form so they all land in one list. */
    [['Roberto · 662 146 1622', WA_ROBERTO], ['Cristina · 662 341 9038', WA_CRISTINA]]
      .forEach((n, i) => {
        const cx = W / 4 + (W / 2) * i;
        setF(doc, 'Cinzel', 6.8, DARKGOLD);
        doc.text(n[0], cx, y, { align: 'center' });
        const tw = doc.getTextWidth(n[0]);
        doc.link(cx - tw / 2, y - 3, tw, 4.5, { url: 'https://wa.me/' + n[1] });
      });

    y += 12;
    rule(doc, y, 34, GOLD);
    y += 8;
    centred(doc, 'Cristina  &  Roberto', y, 'CormorantI', 14, CHARCOAL);

    footer(doc, '4 / 4');
  }

  /* ── Public API ───────────────────────────────────────────────────── */
  async function buildDoc(familia, pases, pageTwoVariant) {
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
    pageTwo(doc, a, pageTwoVariant);
    pageThree(doc, a);
    pageFour(doc, a);
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

  /* win is a tab the caller opened on the click itself: four pages take
     longer to build than the browser keeps that click counted as user
     initiated, and a tab opened afterwards is blocked as a popup. */
  async function preview(familia, pases, pageTwoVariant, win) {
    const doc = await buildDoc(familia, pases, pageTwoVariant);
    const url = doc.output('bloburl');
    if (win) { win.location.href = url; return; }
    window.open(url, '_blank', 'noopener');
  }

  /* Minimal CSV reader: quoted fields, comma or semicolon. Returns the raw
     cells so every generator can name its own columns. */
  function parseRows(text) {
    const rows = [];
    let row = [], field = '', q = false;
    const head = text.split('\n')[0];
    const delim = head.split(';').length > head.split(',').length ? ';' : ',';
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
    return rows;
  }

  function parseCSV(text) {
    const rows = parseRows(text);
    const out = [];
    rows.forEach((r, i) => {
      const name = (r[0] || '').trim();
      if (!name) return;
      if (i === 0 && /nombre|name|invitad|familia/i.test(name)) return;
      const n = parseInt((r[1] || '').trim(), 10);
      out.push({
        familia: name,
        pases: isNaN(n) || n < 1 ? null : n,
        entregada: isEntregada(r[2]),
        duenio: parseDuenio(r[3]),
      });
    });
    return out;
  }

  /* Column 3 — "Entregada". Deliberately an explicit whitelist: anything
     else (a note, a date, "pendiente") leaves the invitation to be made,
     which is the safe way to be wrong. */
  function isEntregada(cell) {
    return /^(x|si|sí|s|yes|y|true|1|ok)$/i.test(String(cell || '').trim());
  }

  /* Column 4 — whose guest it is, which picks the folder inside the ZIP. */
  const FOLDERS = { cristina: 'InvitacionesCristina', jose: 'InvitacionesJose' };
  function parseDuenio(cell) {
    const v = String(cell || '').trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (!v) return null;
    if (v.indexOf('cris') === 0) return 'cristina';
    if (v.indexOf('jose') === 0 || v.indexOf('rob') === 0 || v === 'j') return 'jose';
    return null;
  }

  /* A browser cannot write to G:\... , so the ZIP carries the folder
     structure instead: unzip it into the INVITACIONES folder and the
     two subfolders land where they belong. Rows without an owner go to
     the root so they are impossible to miss. */
  async function batch(rows, onProgress) {
    const { JSZip } = await ensureLibs();
    await ensureAssets();
    const zip = new JSZip();
    const used = Object.create(null);

    const pending = rows.filter(r => !r.entregada);
    const skipped = rows.length - pending.length;
    const counts = { cristina: 0, jose: 0, sinAsignar: 0 };

    for (let i = 0; i < pending.length; i++) {
      const r = pending[i];
      const doc = await buildDoc(r.familia, r.pases);
      const folder = FOLDERS[r.duenio] || '';
      if (r.duenio) counts[r.duenio]++; else counts.sinAsignar++;
      let fn = 'Invitacion_' + safeName(r.familia);
      const key = folder + '/' + fn;
      if (used[key]) { used[key]++; fn += '_' + used[key]; } else { used[key] = 1; }
      zip.file((folder ? folder + '/' : '') + fn + '.pdf', doc.output('arraybuffer'));
      if (onProgress) onProgress(i + 1, pending.length, r.familia);
      if (i % 5 === 4) await new Promise(res => setTimeout(res, 0));
    }

    if (!pending.length) return { generated: 0, skipped: skipped, counts: counts };

    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' },
      meta => { if (onProgress) onProgress(pending.length, pending.length, 'Comprimiendo ' + Math.round(meta.percent) + '%'); });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Invitaciones_Boda_CR.zip';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { generated: pending.length, skipped: skipped, counts: counts };
  }

  /* The blank sheet to fill in, so the columns are never guessed at. */
  function plantillaCSV() {
    const lines = [
      'Nombre,Pases,Entregada,De',
      'Familia Moreno Bernal,4,x,Cristina',
      'Sr. Amos Benjamin Moreno,2,,Cristina',
      'Familia Torres Casas,3,,Jose',
      'Srita. Valentina Cañez,1,,Jose',
    ];
    const blob = new Blob(['\ufeff' + lines.join('\r\n') + '\r\n'],
                          { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Plantilla_Invitaciones.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /* Everything the other one-page designs (padrinos-pdf.js) draw with, so
     the palette, the fonts and the cropping live in exactly one place. */
  const kit = {
    W: W, H: H, M: M,
    GOLD: GOLD, DARKGOLD: DARKGOLD, CHARCOAL: CHARCOAL, MUTED: MUTED,
    CREAM: CREAM, SAGE: SAGE, AVOID: AVOID, WHITE: WHITE,
    LIGHTGOLD: LIGHTGOLD, GOLD_BORDER: GOLD_BORDER,
    SITE: SITE, WA_ROBERTO: WA_ROBERTO, WA_CRISTINA: WA_CRISTINA,
    ensureLibs: ensureLibs, loadPhoto: loadPhoto, loadTiledTexture: loadTiledTexture,
    registerFonts: registerFonts, setF: setF, tracked: tracked, centred: centred,
    rule: rule, button: button, paragraph: paragraph, page: page,
    safeName: safeName, parseRows: parseRows,
  };

  return { one: one, preview: preview, batch: batch, parseCSV: parseCSV,
           plantillaCSV: plantillaCSV, kit: kit };
})();
