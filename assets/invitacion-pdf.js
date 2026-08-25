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
  function loadPhoto(src, aspect, outW, focusY, zoom, focusX) {
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
        res({ data: c.toDataURL('image/jpeg', 0.72), aspect: aspect });
      };
      img.onerror = () => rej(new Error('No se pudo cargar la foto ' + src));
      img.src = src;
    });
  }

  const BAND_ASPECT = W / 46;

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
    const [band, telasW, telasG, telasD, telasN, veil, twoA, twoB, closing, tennis, texture] = await Promise.all([
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
      loadPhoto('assets/UI/outfit_tennis.png', 1085 / 1450, 500, 0.5),
      /* Same faint scrollwork as the site, for the pages that have no
         photo of their own to sit on. */
      loadTiledTexture('assets/gallery/textura_03_tier1.jpg', W / H, 700, 140),
    ]);
    _assets = { band, telasW, telasG, telasD, telasN, veil, twoA, twoB, closing, tennis, texture };
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

  function rule(doc, y, width, colour) {
    doc.setDrawColor(colour[0], colour[1], colour[2]);
    doc.setLineWidth(0.3);
    doc.line((W - width) / 2, y, (W + width) / 2, y);
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

  function paragraph(doc, text, y, family, size, colour, maxW, lead) {
    setF(doc, family, size, colour);
    const lines = doc.splitTextToSize(String(text), maxW);
    lines.forEach((ln, i) => doc.text(ln, W / 2, y + i * lead, { align: 'center' }));
    return y + (lines.length - 1) * lead;
  }

  function page(doc, first) {
    if (!first) doc.addPage();
    doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);
    doc.rect(0, 0, W, H, 'F');
  }

  function footer(doc, n) {
    setF(doc, 'Cinzel', 6, GOLD);
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

    const ey = 141, colL = W / 4, colR = 3 * W / 4;
    function event(cx, label, time, place, url) {
      tracked(doc, label, ey, 6.2, GOLD, 0.7, cx);
      centred(doc, time, ey + 10, 'Cinzel', 11, DARKGOLD, cx);
      setF(doc, 'Lato', 7, MUTED);
      const lines = doc.splitTextToSize(place, 56);
      lines.forEach((ln, i) => doc.text(ln, cx, ey + 18 + i * 3.6, { align: 'center' }));
      const by = ey + 18 + lines.length * 3.6 + 1.5;
      setF(doc, 'Cinzel', 6, GOLD);
      doc.text('VER EN MAPA', cx, by, { align: 'center' });
      const tw = doc.getTextWidth('VER EN MAPA');
      doc.link(cx - tw / 2, by - 3, tw, 4.5, { url: url });
    }
    event(colL, 'CEREMONIA', '12:00 PM',
          'Catedral de Hermosillo, Blvr. Miguel Hidalgo S/N, Centro', MAPS_MISA);
    event(colR, 'RECEPCIÓN', '7:00 PM',
          'Salón Las Cascadas, Los Molinos 97, Las Minitas', MAPS_FIESTA);

    /* The one rule the couple wants read before the day itself */
    tracked(doc, 'ESTRICTAMENTE NO NIÑOS', 175.5, 8, CHARCOAL, 0.9);

    button(doc, 'CONFIRMAR ASISTENCIA', 182, SITE + '#rsvp', CHARCOAL, CREAM);
    setF(doc, 'CormorantI', 8, MUTED);
    doc.text('Se confirma en la página, antes del 1 de septiembre de 2026',
             W / 2, 196.5, { align: 'center' });
    doc.text('En caso de no asistencia, también nos gustaría conocerlo a la brevedad. Gracias.',
             W / 2, 200.5, { align: 'center' });

    footer(doc, '1 / 4');
  }

  /* ── Page 2 — dress code ──────────────────────────────────────────
     The cathedral sits as a full-page background again, cropped and
     zoomed so the couple's faces land in the empty band above the
     title rather than under the rules or the fabric photo, and faint
     enough that it reads as texture rather than competing with either. */
  function pageTwo(doc, a) {
    page(doc);
    bgTexture(doc, a);

    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.22 }));
    doc.addImage(a.veil.data, 'JPEG', 0, 0, W, H, undefined, 'FAST');
    doc.restoreGraphicsState();

    tracked(doc, 'DRESS CODE', 18, 7.5, GOLD, 1.1);
    centred(doc, 'Vestimenta Formal', 27, 'Cormorant', 21, CHARCOAL);
    rule(doc, 33, 26, GOLD);

    let y = 39;
    y = paragraph(doc, 'Queremos que se sientan cómodos y sin dudas sobre qué usar. Les agradecemos mucho seguir este dress code para cuidar juntos el estilo de la celebración.',
                  y, 'Lato', 7.6, MUTED, W - 2 * M - 8, 4.4);
    y += 6;

    /* Two matching cards (Caballeros / Damas) instead of one flat list,
       and the tennis note and avoid-colors block below share the same
       bordered-card language, so the page reads as one family of cards
       rather than a list followed by ad-hoc boxes. */
    y += 4;
    const cardGap = 4, cardW = (W - 2 * M - cardGap) / 2;
    const cardDefs = [
      { title: 'CABALLEROS', x: M, items: [
        'Traje sastre clásico. Sugerencias de color: negro, gris, azul marino.',
        'Corbata o pañuelo de cualquier color menos blanco.',
      ] },
      { title: 'DAMAS', x: M + cardW + cardGap, items: [
        'Vestido largo o cóctel.',
      ] },
    ];
    const cardTop = y;
    let cardH = 0;
    cardDefs.forEach(c => {
      let cy = 12;
      setF(doc, 'Lato', 7, CHARCOAL);
      c.items.forEach(item => {
        cy += doc.splitTextToSize(item, cardW - 8).length * 4.2 + 1.6;
      });
      cardH = Math.max(cardH, cy + 3);
    });
    cardDefs.forEach(c => {
      doc.setFillColor(LIGHTGOLD[0], LIGHTGOLD[1], LIGHTGOLD[2]);
      doc.rect(c.x, cardTop, cardW, cardH, 'F');
      doc.setDrawColor(GOLD_BORDER[0], GOLD_BORDER[1], GOLD_BORDER[2]);
      doc.setLineWidth(0.3);
      doc.rect(c.x, cardTop, cardW, cardH, 'S');
      tracked(doc, c.title, cardTop + 7, 6.6, CHARCOAL, 0.6, c.x + cardW / 2);
      let cy = cardTop + 12;
      c.items.forEach(item => {
        const lines = doc.splitTextToSize(item, cardW - 8);
        lines.forEach((ln, i) => {
          setF(doc, 'Lato', 7, CHARCOAL);
          if (i === 0) { setF(doc, 'Cinzel', 6, GOLD); doc.text('·', c.x + 4, cy); setF(doc, 'Lato', 7, CHARCOAL); }
          doc.text(ln, c.x + 7, cy);
          cy += 4.2;
        });
        cy += 1.6;
      });
    });
    y = cardTop + cardH + 5;

    /* Shoes note as its own card - Cinzel stands in for bold here,
       since only its semibold weight is embedded (no Lato-bold). */
    const tPad = 4, timgW = 20, timgH = timgW / a.tennis.aspect;
    const tTextX = M + tPad + timgW + 4, tTextW = (W - M - tPad) - tTextX;
    setF(doc, 'Cinzel', 6.8, CHARCOAL);
    const tlines = doc.splitTextToSize(
      'Para que disfrutes al máximo, te invitamos a que también lleves tus tenis favoritos y bailar toda la noche.',
      tTextW);
    const tlineH = 3.5, tblockH = tlines.length * tlineH;
    const tCardH = Math.max(timgH, tblockH) + 2 * tPad;
    doc.setFillColor(LIGHTGOLD[0], LIGHTGOLD[1], LIGHTGOLD[2]);
    doc.rect(M, y, W - 2 * M, tCardH, 'F');
    doc.setDrawColor(GOLD_BORDER[0], GOLD_BORDER[1], GOLD_BORDER[2]);
    doc.setLineWidth(0.3);
    doc.rect(M, y, W - 2 * M, tCardH, 'S');
    doc.addImage(a.tennis.data, 'JPEG', M + tPad, y + (tCardH - timgH) / 2, timgW, timgH, undefined, 'FAST');
    const tY = y + (tCardH - tblockH) / 2 + tlineH * 0.78;
    tlines.forEach((ln, i) => doc.text(ln, tTextX, tY + i * tlineH));
    y += tCardH + 6;

    tracked(doc, 'POR FAVOR EVITA ESTOS TONOS EN TU VESTIDO', y, 6.8, AVOID, 0.4);
    y += 5;
    y = paragraph(doc, 'Reservados para los novios y la decoración. Te pedimos elegir otro color.',
                  y, 'CormorantI', 9.5, AVOID, W - 2 * M - 10, 4.6);
    y += 6;

    /* Four separate framed swatches (each a quarter-crop of the same
       strip) instead of one continuous banner. */
    const swGap = 3, swW = (W - 2 * M - 3 * swGap) / 4;
    [[a.telasW, 'Evitar Blanco'], [a.telasG, 'Evitar Gris'], [a.telasD, 'Evitar Dorado'], [a.telasN, 'Evitar Negro']]
      .forEach((s, i) => {
        const sx = M + i * (swW + swGap);
        doc.addImage(s[0].data, 'JPEG', sx, y, swW, swW, undefined, 'FAST');
        doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
        doc.setLineWidth(0.3);
        doc.rect(sx, y, swW, swW, 'S');
        setF(doc, 'Cinzel', 5.6, MUTED);
        doc.text(s[1], sx + swW / 2, y + swW + 4, { align: 'center' });
      });

    footer(doc, '2 / 4');
  }

  /* ── Page 3 — gifts, hotels, two portraits ────────────────────────── */
  function pageThree(doc, a) {
    page(doc);
    bgTexture(doc, a);

    tracked(doc, 'REGALOS', 18, 7.5, GOLD, 1.1);
    paragraph(doc, 'Su presencia es el regalo más valioso para nosotros. Si es tu deseo otorgarnos un detalle, lo recibimos con mucho cariño.',
              25, 'Lato', 7.6, MUTED, W - 2 * M - 8, 4.4);

    let y = 38;
    const bankH = 15, bankW = W - 2 * M;
    [['BBVA', 'Cristina Borquez Bernal', '4152314000799307'],
     ['Santander', 'José Roberto Moreno Ruiz', '014760200064187105']].forEach(b => {
      doc.setFillColor(SAGE[0], SAGE[1], SAGE[2]);
      doc.rect(M, y, bankW, bankH, 'F');
      setF(doc, 'Cinzel', 6.4, DARKGOLD);
      doc.text('BANCO · ' + b[0], W / 2, y + 5, { align: 'center' });
      setF(doc, 'Lato', 7.4, CHARCOAL);
      doc.text(b[1], W / 2, y + 9.4, { align: 'center' });
      doc.text('CLABE ' + b[2], W / 2, y + 13.2, { align: 'center' });
      y += bankH + 2.5;
    });

    y += 1.5;
    setF(doc, 'Cinzel', 6.4, DARKGOLD);
    doc.text('EFECTIVO', W / 2, y, { align: 'center' });
    y += 4;
    y = paragraph(doc, 'Contaremos con un buzón discreto en la recepción para quienes prefieran entregar su obsequio en persona durante la celebración.',
                  y, 'Lato', 7.4, CHARCOAL, W - 2 * M - 12, 4.2);

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

    y += 8;
    setF(doc, 'CormorantI', 7.8, MUTED);
    doc.text('¿Se te complica? Escríbenos y te ayudamos:', W / 2, y, { align: 'center' });
    y += 5.5;
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

  async function preview(familia, pases) {
    const doc = await buildDoc(familia, pases);
    window.open(doc.output('bloburl'), '_blank', 'noopener');
  }

  /* Minimal CSV reader: quoted fields, comma or semicolon. */
  function parseCSV(text) {
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

    const out = [];
    rows.forEach((r, i) => {
      const name = (r[0] || '').trim();
      if (!name) return;
      if (i === 0 && /nombre|name|invitad|familia/i.test(name)) return;
      const n = parseInt((r[1] || '').trim(), 10);
      out.push({ familia: name, pases: isNaN(n) || n < 1 ? null : n });
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
