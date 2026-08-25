/* ══════════════════════════════════════════════════════════════════════
   PADRINOS — TRES HOJAS SUELTAS EN PDF
   ──────────────────────────────────────────────────────────────────────
   Same A5 sheet, same palette and typefaces as the invitation, but each
   design is a single page with its own layout and its own photograph:

     · peticion      — asks one person or couple to take a role
     · agradecimiento— thanks every sponsor, ceremony and honorary
     · ausencia      — for the guests who already said they cannot come

   The palette, the fonts, the cropping and the CSV reader all come from
   InvitacionPDF.kit, so there is one copy of each and the three designs
   can never drift away from the invitation.

   The sponsor names are read out of the live page (#padrinos), not
   copied here: the site stays the single source of truth, and a name
   fixed there is fixed on the sheets too.
   ══════════════════════════════════════════════════════════════════════ */
window.PadrinosPDF = (function () {

  const K = window.InvitacionPDF.kit;
  const { W, H, M, GOLD, DARKGOLD, CHARCOAL, MUTED, CREAM, SAGE,
          LIGHTGOLD, GOLD_BORDER, SITE, WA_ROBERTO, WA_CRISTINA } = K;

  let _assets = null;

  /* ── Photos ───────────────────────────────────────────────────────
     Deliberately none of the frames the invitation already uses, so a
     guest holding both sheets is not looking at the same picture twice. */
  const PETICION_BAND_ASPECT = (W - 12) / 66;

  async function ensureAssets() {
    if (_assets) return _assets;
    const [bandPeticion, retrato, bgAusencia, texture] = await Promise.all([
      /* Wide band across the foot of the asking sheet. The heads sit in
         the top third of this frame, so the crop window starts high. */
      K.loadPhoto('assets/gallery/gallery-14.jpg', PETICION_BAND_ASPECT, 1100, 0.2),
      /* Small square portrait for the thank-you sheet - it is the only
         photo on that page, so it is cropped tight on the two of them. */
      K.loadPhoto('assets/gallery/gallery-05.jpg', 1, 420, 0.42, 1.7, 0.42),
      /* Full sheet behind the "we will miss you" note: the couple sits
         in the upper half, above where the cream wash begins. */
      K.loadPhoto('assets/gallery/gallery-08.jpg', W / H, 950, 0.1, 1.15, 0.45),
      K.loadTiledTexture('assets/gallery/textura_03_tier1.jpg', W / H, 700, 140),
    ]);
    _assets = { bandPeticion, retrato, bgAusencia, texture };
    return _assets;
  }

  /* ── Shared furniture ─────────────────────────────────────────────── */
  function bgTexture(doc, a) {
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.8 }));
    doc.addImage(a.texture.data, 'JPEG', 0, 0, W, H, undefined, 'FAST');
    doc.restoreGraphicsState();
  }

  /* A hairline double rule just inside the trim. These sheets carry no
     page number, so the frame is what tells the eye where the sheet
     ends - the invitation's footer does that job there. */
  function frame(doc, inset) {
    inset = inset === undefined ? 6 : inset;
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.4);
    doc.rect(inset, inset, W - 2 * inset, H - 2 * inset, 'S');
    doc.setLineWidth(0.15);
    doc.rect(inset + 1.6, inset + 1.6, W - 2 * (inset + 1.6), H - 2 * (inset + 1.6), 'S');
  }

  function signature(doc, y, colour) {
    K.setF(doc, 'Cinzel', 6, colour || GOLD);
    doc.text('C  &  R    ·    03 · 10 · 2026', W / 2, y, { align: 'center' });
  }

  /* Two tappable phone numbers side by side, the same pair the
     invitation closes with. */
  function contactos(doc, y, colour) {
    [['Roberto · 662 146 1622', WA_ROBERTO], ['Cristina · 662 341 9038', WA_CRISTINA]]
      .forEach((n, i) => {
        const cx = W / 4 + (W / 2) * i;
        K.setF(doc, 'Cinzel', 6.6, colour || DARKGOLD);
        doc.text(n[0], cx, y, { align: 'center' });
        const tw = doc.getTextWidth(n[0]);
        doc.link(cx - tw / 2, y - 3, tw, 4.5, { url: 'https://wa.me/' + n[1] });
      });
  }

  /* ── The names, read off the live page ────────────────────────────
     #padrinos holds them in document order: a .padrino-role opens a
     group and every .padrino-name after it belongs to that group, on
     through the .padrino-card-divider blocks (the second Bible couple
     has no role of its own and joins the group above it, exactly as
     the site renders it).

     data-es first, not textContent: the language toggle rewrites the
     roles in place, so a sheet generated while the site is in English
     would come out reading "VEILING SPONSORS". These are printed in
     Spanish whatever the page is showing. */
  function es(el) {
    return (el.getAttribute('data-es') || el.textContent || '')
      .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function roles() {
    const out = [];
    document.querySelectorAll('#padrinos .padrinos-main p').forEach(p => {
      if (p.classList.contains('padrino-role')) {
        out.push({ rol: es(p), nombres: [] });
      } else if (p.classList.contains('padrino-name') && out.length) {
        out[out.length - 1].nombres.push(es(p));
      }
    });
    return out;
  }

  function honorificos() {
    return Array.from(document.querySelectorAll('#padrinos .honorificos-grid .padrino-name'))
      .map(es);
  }

  function newDoc(title, subject) {
    const doc = new (window.jspdf.jsPDF)({ unit: 'mm', format: [W, H], compress: true });
    K.registerFonts(doc);
    doc.setProperties({ title: title, subject: subject || '', author: 'Cristina & Roberto' });
    return doc;
  }

  /* ══ 1 · PETICIÓN ══════════════════════════════════════════════════
     Cream sheet inside a gold frame, the question set large in the top
     half, and one wide photograph anchoring the foot. Everything above
     the band is fixed to the millimetre: the role line is the only part
     that changes length, and it is tracked, so it is measured and
     shrunk rather than allowed to run into the margins. */
  function drawPeticion(doc, a, nombres, rol) {
    K.page(doc, true);
    bgTexture(doc, a);
    frame(doc);

    K.tracked(doc, 'CRISTINA  &  ROBERTO', 22, 6.2, GOLD, 1.1);
    K.rule(doc, 27, 22, GOLD);

    const rolTxt = String(rol || 'PADRINOS').toUpperCase();

    /* "de ser nuestra MADRINA DE RAMO", not "nuestros" - the sheet goes
       to one person as often as to a couple, and the role itself says
       which. The title is the authority, since a couple can perfectly
       well be asked to be one thing. */
    const plural = /S\b|S$/.test(rolTxt.split(' ')[0]);
    const fem = /^MADRINA/.test(rolTxt);
    const posesivo = 'de ser ' + (fem ? (plural ? 'nuestras' : 'nuestra')
                                      : (plural ? 'nuestros' : 'nuestro'));

    K.centred(doc, '¿Nos harías el honor', 45, 'CormorantI', 19, CHARCOAL);
    K.centred(doc, posesivo, 55.5, 'CormorantI', 19, CHARCOAL);

    /* The role is the whole point of the sheet, so it is the largest
       tracked line on it - stepped down only if it will not fit. */
    let size = 11, spacing = 1.2;
    for (; size > 6; size -= 0.5) {
      K.setF(doc, 'Cinzel', size, DARKGOLD);
      if (doc.getTextWidth(rolTxt) + spacing * rolTxt.length < W - 2 * M - 6) break;
    }
    K.tracked(doc, rolTxt, 70, size, DARKGOLD, spacing);

    K.rule(doc, 76, 26, GOLD);

    /* The invited names, one per line, in the same italic the
       invitation uses for the guest's own name. */
    const lista = (Array.isArray(nombres) ? nombres : String(nombres || '').split('\n'))
      .map(s => String(s).trim()).filter(Boolean);
    let y = 87;
    (lista.length ? lista : ['Nuestros padrinos']).forEach(n => {
      K.centred(doc, n, y, 'Cormorant', 15, CHARCOAL);
      y += 8;
    });

    K.paragraph(doc, 'Para nosotros no es un trámite ni un adorno: es pedirle a quienes más queremos que estén de pie junto a nosotros ese día. Nos haría muy felices que ' + (lista.length > 1 ? 'aceptaran' : 'aceptaras') + '.',
                Math.max(y + 4, 105), 'Lato', 7.4, MUTED, W - 2 * M - 8, 4.3);

    const bandY = 120, bandH = 66, bandX = 6 + 1.6 + 1.4;
    doc.addImage(a.bandPeticion.data, 'JPEG', bandX, bandY, W - 2 * bandX, bandH, undefined, 'FAST');
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.25);
    doc.rect(bandX, bandY, W - 2 * bandX, bandH, 'S');

    K.tracked(doc, 'NOS ENCANTARÍA SABER TU RESPUESTA', 193, 5.6, GOLD, 0.7);
    contactos(doc, 199.5);
  }

  /* ══ 2 · AGRADECIMIENTO ════════════════════════════════════════════
     One sheet that has to hold every name, so the type is small and the
     lists are measured rather than placed by eye: the ceremony groups
     are dealt into two columns by running height (not four-and-four),
     and the honorary names are laid out in four columns whose leading
     is squeezed until the block ends above the closing line. */
  function drawGracias(doc, a) {
    K.page(doc, true);
    bgTexture(doc, a);
    frame(doc);

    const ph = 30, px = (W - ph) / 2, py = 13;
    doc.addImage(a.retrato.data, 'JPEG', px, py, ph, ph, undefined, 'FAST');
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.35);
    doc.rect(px, py, ph, ph, 'S');

    K.tracked(doc, 'GRACIAS', 53, 11, GOLD, 2.2);
    K.rule(doc, 58.5, 26, GOLD);
    K.paragraph(doc, 'A cada uno de ustedes: gracias por decir que sí, por su cariño y por acompañarnos en el día más importante de nuestra historia.',
                65, 'CormorantI', 9, MUTED, W - 2 * M - 6, 4.4);

    /* — Ceremony groups, balanced across two columns —
         Each group goes to whichever column is shorter so far. Splitting
         four-and-four instead leaves a hole under the left column, since
         the Bible group carries two couples and is twice the height. */
    const grupos = roles();
    const alto = g => 4.6 + g.nombres.length * 3.3 + 2.6;
    const colA = [], colB = [];
    let hA = 0, hB = 0;
    grupos.forEach(g => {
      if (hA <= hB) { colA.push(g); hA += alto(g); } else { colB.push(g); hB += alto(g); }
    });

    K.tracked(doc, 'PADRINOS DE CEREMONIA', 79, 5.8, DARKGOLD, 0.9);
    K.rule(doc, 82, 20, GOLD_BORDER);

    let bottom = 88;
    [colA, colB].forEach((col, i) => {
      const cx = W / 4 + (W / 2) * i;
      let y = 88;
      col.forEach(g => {
        K.tracked(doc, g.rol, y, 5, GOLD, 0.5, cx);
        y += 4.6;
        K.setF(doc, 'Lato', 6.6, CHARCOAL);
        g.nombres.forEach(n => { doc.text(n, cx, y, { align: 'center' }); y += 3.3; });
        y += 2.6;
      });
      bottom = Math.max(bottom, y);
    });

    /* — Honorary names — */
    let y = bottom + 4;
    K.tracked(doc, 'PADRINOS Y MADRINAS HONORÍFICOS', y, 5.6, GOLD, 0.8);
    K.rule(doc, y + 3, 26, GOLD_BORDER);
    y += 9;

    /* Three columns, filled top-to-bottom. The site lists these in
       couples, two consecutive names at a time, so the column has to
       hold an even number of rows or every column break splits a pair. */
    const nombres = honorificos();
    const cols = 3;
    let filas = Math.ceil(nombres.length / cols);
    if (filas % 2) filas++;
    const CIERRE_Y = 196;                       /* the closing line's baseline */
    const lead = Math.min(3.2, (CIERRE_Y - 6 - y) / Math.max(filas, 1));
    const colW = (W - 2 * (M - 4)) / cols;
    K.setF(doc, 'Lato', 5.2, CHARCOAL);
    nombres.forEach((n, i) => {
      const c = Math.floor(i / filas), r = i % filas;
      doc.text(n, (M - 4) + colW * (c + 0.5), y + r * lead, { align: 'center', maxWidth: colW - 1.5 });
    });

    K.centred(doc, 'Con todo nuestro cariño,', CIERRE_Y, 'CormorantI', 9, MUTED);
    K.centred(doc, 'Cristina  &  Roberto', CIERRE_Y + 6.5, 'CormorantI', 12, CHARCOAL);
  }

  /* ══ 3 · AUSENCIA ══════════════════════════════════════════════════
     The photograph fills the sheet and the cream wash rises from the
     foot - the mirror of the invitation's dress-code page, so the two
     read as a pair without repeating a layout. The gift note is kept
     to two compact lines: this sheet is a thank-you first, and the
     accounts are only there so nobody has to go looking for them. */
  function drawAusencia(doc, a, nombre) {
    K.page(doc, true);
    doc.addImage(a.bgAusencia.data, 'JPEG', 0, 0, W, H, undefined, 'FAST');

    /* Solid wash from 116mm down, then a stepped fade upward into the
       photo (jsPDF has no gradient primitive of its own).

       The strips are butted, not overlapped: where two translucent
       strips overlap the cream composites twice and prints as a hard
       pale ridge, which is exactly the banding a long fade shows. A
       0.02mm bleed is enough to close the seam without stacking. */
    const washTop = 116, fadeH = 26, op = 0.96, steps = 34;
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: op }));
    doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);
    doc.rect(0, washTop, W, H - washTop, 'F');
    doc.restoreGraphicsState();
    const stepH = fadeH / steps;
    for (let i = 0; i < steps; i++) {
      doc.saveGraphicsState();
      /* Squared, so the cream builds slowly out of the photograph and
         then climbs quickly into the solid wash. */
      doc.setGState(new doc.GState({ opacity: op * Math.pow((i + 1) / steps, 2) }));
      doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);
      doc.rect(0, washTop - fadeH + i * stepH, W, stepH + 0.02, 'F');
      doc.restoreGraphicsState();
    }

    K.tracked(doc, 'TE VAMOS A EXTRAÑAR', 122, 8, GOLD, 1.1);
    K.rule(doc, 127, 26, GOLD);

    const boxY = 132, boxH = 15;
    doc.setFillColor(SAGE[0], SAGE[1], SAGE[2]);
    doc.rect(M, boxY, W - 2 * M, boxH, 'F');
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.3);
    doc.rect(M, boxY, W - 2 * M, boxH, 'S');
    K.tracked(doc, 'PARA', boxY + 5, 6, GOLD, 1);
    K.setF(doc, 'CormorantI', 14, CHARCOAL);
    doc.text(String(nombre || 'Nuestro invitado'), W / 2, boxY + 11.6, { align: 'center' });

    K.paragraph(doc, 'Ya sabemos que ese día no vas a poder acompañarnos, y lo entendemos con todo el cariño. Aun así te vamos a extrañar, y queríamos decírtelo: gracias por ser parte de nuestras vidas.',
                155, 'Lato', 7.4, MUTED, W - 2 * M - 8, 4.3);

    K.tracked(doc, 'SI QUIERES OTORGARNOS UN DETALLE', 174, 5.8, DARKGOLD, 0.7);
    K.paragraph(doc, 'Lo recibimos con mucho cariño. Nada de esto cambia lo agradecidos que estamos contigo.',
                179, 'CormorantI', 7.6, MUTED, W - 2 * M - 10, 3.8);

    /* Straight quotes and plain digits only: the embedded font subsets
       drop the curly ones and truncate the line where they appear. */
    K.setF(doc, 'Lato', 6, CHARCOAL);
    doc.text('BBVA · Cristina Borquez Bernal · CLABE 012180015298657265', W / 2, 189, { align: 'center' });
    doc.text('Banorte · José Roberto Moreno Ruiz · TARJETA 072760013297837244', W / 2, 192.6, { align: 'center' });

    K.setF(doc, 'Cinzel', 5.6, GOLD);
    doc.text('VER LA PÁGINA', W / 2, 198.6, { align: 'center' });
    const tw = doc.getTextWidth('VER LA PÁGINA');
    doc.link(W / 2 - tw / 2, 195.6, tw, 4.5, { url: SITE });

    signature(doc, 204);
  }

  /* ── Building, previewing, saving ─────────────────────────────────── */
  const DESIGNS = {
    peticion: {
      title: 'Padrinos · Boda de Cristina y Roberto',
      file: 'Peticion_Padrinos',
      draw: (doc, a, d) => drawPeticion(doc, a, d.nombres, d.rol),
      name: d => (d.rol || 'padrinos') + '_' + (Array.isArray(d.nombres) ? d.nombres[0] : d.nombres),
    },
    gracias: {
      title: 'Gracias · Boda de Cristina y Roberto',
      file: 'Gracias_Padrinos',
      draw: (doc, a) => drawGracias(doc, a),
      name: () => 'Padrinos_y_Madrinas',
    },
    ausencia: {
      title: 'Te extrañaremos · Boda de Cristina y Roberto',
      file: 'Te_Extranaremos',
      draw: (doc, a, d) => drawAusencia(doc, a, d.nombre),
      name: d => d.nombre,
    },
  };

  async function buildDoc(tipo, data) {
    const d = DESIGNS[tipo];
    if (!d) throw new Error('Diseño desconocido: ' + tipo);
    await K.ensureLibs();
    const a = await ensureAssets();
    const doc = newDoc(d.title, d.name(data || {}) || '');
    d.draw(doc, a, data || {});
    return doc;
  }

  function fileName(tipo, data) {
    const d = DESIGNS[tipo];
    return d.file + '_' + K.safeName(d.name(data || {})) + '.pdf';
  }

  async function preview(tipo, data) {
    const doc = await buildDoc(tipo, data);
    window.open(doc.output('bloburl'), '_blank', 'noopener');
  }

  async function one(tipo, data) {
    const doc = await buildDoc(tipo, data);
    doc.save(fileName(tipo, data));
  }

  /* One ZIP per batch, flat: unlike the invitations these are not split
     between the two of them. */
  async function batch(tipo, items, onProgress) {
    const { JSZip } = await K.ensureLibs();
    await ensureAssets();
    const zip = new JSZip(), used = Object.create(null);
    for (let i = 0; i < items.length; i++) {
      const doc = await buildDoc(tipo, items[i]);
      let fn = fileName(tipo, items[i]);
      if (used[fn]) { used[fn]++; fn = fn.replace(/\.pdf$/, '_' + used[fn] + '.pdf'); } else { used[fn] = 1; }
      zip.file(fn, doc.output('arraybuffer'));
      if (onProgress) onProgress(i + 1, items.length, DESIGNS[tipo].name(items[i]));
      if (i % 5 === 4) await new Promise(res => setTimeout(res, 0));
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = DESIGNS[tipo].file + '_Lote.zip';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return items.length;
  }

  /* ── CSV in ───────────────────────────────────────────────────────
     Peticion: Rol,Nombre 1,Nombre 2…  (everything after the role is a
     name, so a single madrina and a couple use the same file).
     Ausencia: one name per row. */
  function parsePeticion(text) {
    return K.parseRows(text).map(r => ({
      rol: (r[0] || '').trim(),
      nombres: r.slice(1).map(s => s.trim()).filter(Boolean),
    })).filter((d, i) => {
      if (!d.rol && !d.nombres.length) return false;
      return !(i === 0 && /^(rol|role|titulo|título)$/i.test(d.rol));
    });
  }

  function parseAusencia(text) {
    return K.parseRows(text).map(r => ({ nombre: (r[0] || '').trim() }))
      .filter((d, i) => d.nombre && !(i === 0 && /nombre|name|invitad/i.test(d.nombre)));
  }

  function descargarCSV(nombre, lineas) {
    const blob = new Blob(['﻿' + lineas.join('\r\n') + '\r\n'],
                          { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /* The petición template is pre-filled from the site itself, so the
     usual batch is "download, delete the rows already asked, generate". */
  function plantillaPeticion() {
    descargarCSV('Plantilla_Peticion_Padrinos.csv',
      ['Rol,Nombre 1,Nombre 2'].concat(roles().map(g =>
        [g.rol].concat(g.nombres).map(s => '"' + s.replace(/"/g, '""') + '"').join(','))));
  }

  function plantillaAusencia() {
    descargarCSV('Plantilla_Te_Extranaremos.csv',
      ['Nombre', 'Familia Torres Casas', 'Sr. Ignacio Torres']);
  }

  return {
    roles: roles, honorificos: honorificos,
    preview: preview, one: one, batch: batch,
    parsePeticion: parsePeticion, parseAusencia: parseAusencia,
    plantillaPeticion: plantillaPeticion, plantillaAusencia: plantillaAusencia,
  };
})();
