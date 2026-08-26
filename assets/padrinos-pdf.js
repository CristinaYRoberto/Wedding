/* ══════════════════════════════════════════════════════════════════════
   PADRINOS — TRES HOJAS SUELTAS EN PDF
   ──────────────────────────────────────────────────────────────────────
   Same A5 sheet, same palette and typefaces as the invitation, but each
   design is a single page with its own layout and its own photograph:

     · peticion      — asks one person or couple to take a role
     · gracias       — thanks one sponsor, or one couple, by role
     · ausencia      — for the guests who already said they cannot come

   The first two are the same sheet turned over: the asking one is
   framed with the photograph at the foot, the thank-you one is
   unframed with the photograph bleeding off the head.

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
  const GRACIAS_BAND_H = 58;

  async function ensureAssets() {
    if (_assets) return _assets;
    const [bandPeticion, bandGracias, bgAusencia, texture] = await Promise.all([
      /* Wide band across the foot of the asking sheet. The heads sit in
         the top third of this frame, so the crop window starts high. */
      K.loadPhoto('assets/gallery/gallery-14.jpg', PETICION_BAND_ASPECT, 1100, 0.2),
      /* Full-bleed band across the head of the thank-you sheet. The two
         of them sit left of centre and low in this frame, so the window
         is zoomed in and walked down and left to find them. */
      K.loadPhoto('assets/gallery/gallery-02.jpg', W / GRACIAS_BAND_H, 1100, 0.78, 1.4, 0.29),
      /* Full sheet behind the "we will miss you" note. Framed tight and
         walked down the source so the couple climbs into the top of the
         sheet: at the old crop their heads sat at 76mm with the wash at
         116mm, leaving barely a hand's width of them in the clear. Now
         they start at 20mm and run to 165mm, so the sheet shows most of
         them instead of a wall of hedge. */
      K.loadPhoto('assets/gallery/gallery-08.jpg', W / H, 1000, 0.9, 1.3, 0.15),
      K.loadTiledTexture('assets/gallery/textura_03_tier1.jpg', W / H, 700, 140),
    ]);
    _assets = { bandPeticion, bandGracias, bgAusencia, texture };
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
     One .padrino-card is one couple (or one single sponsor): its
     .padrino-role names the group and its .padrino-name lines are who
     is in it. The two Bible cards share a role text but are two
     couples, so they stay two entries throughout - one asking sheet
     and one thank-you sheet each.

     data-es first, not textContent: the language toggle rewrites the
     roles in place, so a sheet generated while the site is in English
     would come out reading "VEILING SPONSORS". These are printed in
     Spanish whatever the page is showing. */
  function es(el) {
    return (el.getAttribute('data-es') || el.textContent || '')
      .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function roles() {
    return Array.from(document.querySelectorAll('#padrinos .padrinos-main .padrino-card'))
      .map(card => ({
        rol: es(card.querySelector('.padrino-role')),
        nombres: Array.from(card.querySelectorAll('.padrino-name')).map(es),
      }));
  }

  const HONORIFICO = 'PADRINOS Y MADRINAS HONORÍFICOS';

  /* One entry per cell of the honorary grid, so a couple sharing a cell
     shares a sheet and everyone else gets their own. The grid is built
     that way on purpose - one cell per household, not two names per
     cell to even out the columns - so this reads the real pairing and
     needs no list of its own. */
  function honorificoGrupos() {
    return Array.from(document.querySelectorAll('#padrinos .honorificos-grid > div'))
      .map(cell => ({
        rol: HONORIFICO,
        nombres: Array.from(cell.querySelectorAll('.padrino-name')).map(es),
      }))
      .filter(g => g.nombres.length);
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
       tracked line on it - stepped down only if it will not fit. It
       also carries the closing "?": the question opened three lines
       above ("¿Nos harías el honor…") and the role is where it ends,
       so the mark belongs here and not after the names. */
    const pregunta = rolTxt + '?';
    let size = 11, spacing = 1.2;
    for (; size > 6; size -= 0.5) {
      K.setF(doc, 'Cinzel', size, DARKGOLD);
      if (doc.getTextWidth(pregunta) + spacing * pregunta.length < W - 2 * M - 6) break;
    }
    K.tracked(doc, pregunta, 70, size, DARKGOLD, spacing);

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

  /* ══ 2 · AGRADECIMIENTO ════════════════════════════════
     One sheet per sponsor — a couple shares theirs — naming the role
     they took. The layout is the asking sheet turned upside down: the
     photograph is a full-bleed band at the head instead of a framed
     one at the foot, and there is no gold frame, so the two sheets are
     recognisably a pair without being the same page twice.

     The honorary sponsors have no role in the ceremony, so their sheet
     carries the category title and a body of its own. */
  function drawGracias(doc, a, nombres, rol) {
    K.page(doc, true);
    bgTexture(doc, a);

    doc.addImage(a.bandGracias.data, 'JPEG', 0, 0, W, GRACIAS_BAND_H, undefined, 'FAST');
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.4);
    doc.line(0, GRACIAS_BAND_H, W, GRACIAS_BAND_H);

    const rolTxt = String(rol || '').toUpperCase();
    const honorifico = /HONOR/.test(rolTxt);

    const lista = (Array.isArray(nombres) ? nombres : String(nombres || '').split('\n'))
      .map(s => String(s).trim()).filter(Boolean);
    /* Most of the honorary sheets go to one person, not a couple, so the
       body has to agree in number: "tu lugar", not "su lugar". */
    const dos = lista.length > 1;

    K.tracked(doc, 'GRACIAS', 74, 13, GOLD, 2.6);
    K.rule(doc, 80.5, 30, GOLD);

    K.paragraph(doc, honorifico
        ? 'Gracias por el cariño y el apoyo que nos ' + (dos ? 'han' : 'has') + ' dado en este camino.'
        : 'Gracias por decir que sí, y por estar de pie junto a nosotros ese día.',
      92, 'CormorantI', 10, MUTED, W - 2 * M - 6, 4.8);

    /* Same measure-then-shrink as the asking sheet: the honorary title
       is the longest line either design has to set. */
    if (rolTxt) {
      let size = 10, spacing = 1;
      for (; size > 5.5; size -= 0.4) {
        K.setF(doc, 'Cinzel', size, DARKGOLD);
        if (doc.getTextWidth(rolTxt) + spacing * rolTxt.length < W - 2 * M - 4) break;
      }
      K.tracked(doc, rolTxt, 108, size, DARKGOLD, spacing);
      K.rule(doc, 114, 24, GOLD_BORDER);
    }

    let y = 126;
    (lista.length ? lista : ['Nuestros padrinos']).forEach(n => {
      K.centred(doc, n, y, 'Cormorant', 16, CHARCOAL);
      y += 8.5;
    });

    K.paragraph(doc, honorifico
        ? (dos
            ? 'No llevan un cargo en la ceremonia, pero su lugar en nuestra historia pesa igual. Gracias por acompañarnos hasta aquí y por seguir con nosotros.'
            : 'No llevas un cargo en la ceremonia, pero tu lugar en nuestra historia pesa igual. Gracias por acompañarnos hasta aquí y por seguir con nosotros.')
        : (dos
            ? 'El lugar que ocupan en la ceremonia es el que ya tenían en nuestras vidas. Gracias por aceptarlo y por hacerlo suyo ese día.'
            : 'El lugar que ocupas en la ceremonia es el que ya tenías en nuestras vidas. Gracias por aceptarlo y por hacerlo tuyo ese día.'),
      Math.max(y + 12, 152), 'Lato', 7.6, MUTED, W - 2 * M - 8, 4.4);

    K.rule(doc, 174, 20, GOLD);
    K.centred(doc, 'Con todo nuestro cariño,', 184, 'CormorantI', 9.5, MUTED);
    K.centred(doc, 'Cristina  &  Roberto', 194, 'CormorantI', 14, CHARCOAL);
    K.tracked(doc, '03 · OCTUBRE · 2026', 203, 6, GOLD, 0.9);
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
    const washTop = 126, fadeH = 28, op = 0.96, steps = 36;
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

    /* Two lines, not one: the whole sentence tracked across at 8pt runs
       well past the margins, and splitting it puts the weight on the
       part that does the work. Same caps-over-italic pairing the asking
       sheet uses. "Extrañar" is what the sheet used to say, and in
       Mexico that is the word for the dead - this one is for the living
       who simply cannot make the date. */
    K.tracked(doc, 'SERÁ PARA LA PRÓXIMA', 133, 8, GOLD, 1.1);
    K.centred(doc, 'y gracias por estar siempre', 139.5, 'CormorantI', 10, MUTED);
    K.rule(doc, 143.5, 26, GOLD);

    const boxY = 147, boxH = 13.5;
    doc.setFillColor(SAGE[0], SAGE[1], SAGE[2]);
    doc.rect(M, boxY, W - 2 * M, boxH, 'F');
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.3);
    doc.rect(M, boxY, W - 2 * M, boxH, 'S');
    K.tracked(doc, 'PARA', boxY + 4.6, 6, GOLD, 1);
    K.setF(doc, 'CormorantI', 14, CHARCOAL);
    doc.text(String(nombre || 'Nuestro invitado'), W / 2, boxY + 10.6, { align: 'center' });

    /* Kept to two lines at this measure, and deliberately short of a
       third "gracias" - the heading above already carries that one. */
    K.paragraph(doc, 'Ya sabemos que ese día no podrás acompañarnos y lo entendemos con todo el cariño. Nos habría encantado tenerte ahí; esto no cambia lo que significas para nosotros.',
                167, 'Lato', 7.4, MUTED, W - 2 * M - 8, 4.3);

    K.tracked(doc, 'SI QUIERES OTORGARNOS UN DETALLE', 178, 5.8, DARKGOLD, 0.7);
    K.paragraph(doc, 'Lo recibimos con mucho cariño, aunque nada de esto sea una obligación.',
                182.3, 'CormorantI', 7.6, MUTED, W - 2 * M - 10, 3.8);

    /* Straight quotes and plain digits only: the embedded font subsets
       drop the curly ones and truncate the line where they appear. */
    K.setF(doc, 'Lato', 6, CHARCOAL);
    doc.text('BBVA · Cristina Borquez Bernal · CLABE 012180015298657265', W / 2, 188.6, { align: 'center' });
    doc.text('Banorte · José Roberto Moreno Ruiz · TARJETA 072760013297837244', W / 2, 192.2, { align: 'center' });

    K.setF(doc, 'Cinzel', 5.6, GOLD);
    doc.text('VER LA PÁGINA', W / 2, 198.4, { align: 'center' });
    const tw = doc.getTextWidth('VER LA PÁGINA');
    doc.link(W / 2 - tw / 2, 195.4, tw, 4.5, { url: SITE });

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
      file: 'Gracias',
      draw: (doc, a, d) => drawGracias(doc, a, d.nombres, d.rol),
      name: d => (d.rol || 'padrinos') + '_' + (Array.isArray(d.nombres) ? d.nombres[0] : d.nombres),
    },
    ausencia: {
      title: 'Será para la próxima · Boda de Cristina y Roberto',
      file: 'Sera_Para_La_Proxima',
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

  /* The tab has to be opened by the click itself. Building a sheet takes
     longer than the browser keeps the click counted as user-initiated -
     the "sera para la proxima" one is the heaviest of the three - so a
     opened once the PDF is ready gets eaten by the popup blocker, and
     window.open with noopener returns null either way so there is no
     telling apart a block from a success. Callers open the tab on the
     click and pass it in; win is only omitted by callers that are not
     driven by one. */
  async function preview(tipo, data, win) {
    const doc = await buildDoc(tipo, data);
    const url = doc.output('bloburl');
    if (win) { win.location.href = url; return; }
    window.open(url, '_blank', 'noopener');
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
     Peticion and agradecimiento share a shape: Rol,Nombre 1,Nombre 2…
     Everything after the role is a name, so a single madrina and a
     couple use the same file, and a pair the site guessed wrong is
     split by putting it on two rows.
     Ausencia: one name per row. */
  function parseGrupos(text) {
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

  /* Both templates are pre-filled from the site itself, so the usual
     batch is "download, fix the rows that need fixing, generate". */
  function plantillaGrupos(archivo, grupos) {
    descargarCSV(archivo,
      ['Rol,Nombre 1,Nombre 2'].concat(grupos.map(g =>
        [g.rol].concat(g.nombres).map(s => '"' + s.replace(/"/g, '""') + '"').join(','))));
  }

  function plantillaPeticion() {
    plantillaGrupos('Plantilla_Peticion_Padrinos.csv', roles());
  }

  /* The thank-you list is the ceremony sheets plus one per honorary
     cell, one sheet per couple throughout - the two Bible couples share
     a role but not a sheet, same as on the site itself. */
  function gruposGracias() {
    return roles().concat(honorificoGrupos());
  }

  function plantillaGracias() {
    plantillaGrupos('Plantilla_Gracias_Padrinos.csv', gruposGracias());
  }

  function plantillaAusencia() {
    descargarCSV('Plantilla_Sera_Para_La_Proxima.csv',
      ['Nombre', 'Familia Torres Casas', 'Sr. Ignacio Torres']);
  }

  return {
    roles: roles, honorificoGrupos: honorificoGrupos, gruposGracias: gruposGracias,
    preview: preview, one: one, batch: batch,
    parseGrupos: parseGrupos, parseAusencia: parseAusencia,
    plantillaPeticion: plantillaPeticion, plantillaGracias: plantillaGracias,
    plantillaAusencia: plantillaAusencia,
  };
})();
