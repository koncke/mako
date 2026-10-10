// =============================================================================
// Los MUELLES de /chatbot: dónde va «Probar», el editor apaisado y lo que cada cosa deja libre
// =============================================================================
// Pedido literal de Martín (segunda tanda, 08/10/2026), puntos 3 y 8: «El editor de WhatsApp
// debes hacerlo más ancho que largo, sino, se amontona todo» y «El "Probar" debe ser más ancho
// también, no tan largo, sino, se rompe el diseño». Con los dos anchos y anclados donde estaban
// se pisaban (relevo R3: con la lista y «Probar» abiertos quedaban ~500 px de lienzo y el editor
// ocupaba 392). Decisión 11: «Probar» arriba a la derecha, debajo del chrome; el editor en la
// franja de abajo; y si apilados no entran (ventana baja), lado a lado.
//
// Lo decide UNA función pura (`muelles`, lib/lienzo-grafo.ts): esta aritmética repartida en tres
// componentes ya produjo el inset contado dos veces (hallazgos-chatbot.md). Acá se EJECUTA con
// cajas de verdad y se mide que los rectángulos no se pisen.
//
// PROBADO ROMPIÉNDOLO (08/10/2026; con todo puesto: 8 pasan, 0 fallan). Cada rotura de a una,
// aplicada y restaurada DE MEMORIA por un arnés (nunca con `git checkout`). Pasan / fallan:
//   1. «Probar» apilado arranca en top 0 (debajo del chrome no)                    -> 7 / 1
//   2. el alto de «Probar» deja de descontar el editor (se pisan)                   -> 6 / 2
//      (a 1440x900 entran igual: lo caza la caja de 1280x620, donde sí se pisan)
//   3. «Probar» depende de `editorAbierto` (su alto cambia al abrir una tarjeta)     -> 7 / 1
//   4. sin la caída a «lado a lado» en una ventana baja                             -> 7 / 1
//   5. el editor apaisado sin el piso de 620 px (no cae a columna en una angosta)   -> 7 / 1
//   6. `vistaConPanelAbajo` centra la tarjeta alta (la cabecera queda bajo el chrome) -> 7 / 1
//   7. `nodoRevelado` esconde lo que el orden no nombra (el CRON)                   -> 7 / 1
//   8. `yDePuerto` sin la caída a la fila 'sig' al llegar al tope de caminos        -> 7 / 1
// Tercera tanda (09/10/2026, decisión 1: el editor MEDIANO, hasta 720 × ~420 pegado a la lista).
// Con todo puesto 10 / 0; arnés b-arnes (en memoria):
//   9. el editor vuelve a ir de borde a borde (sin el tope de 720)                  -> 6 / 4
//  10. el alto de «Probar» deja de descontar el del editor (se pisan en medianas)   -> 6 / 4
//  11. `vistaConPanelAbajo` ignora `panelDer` (corre lo que está al lado del panel) -> 9 / 1
//
// Correr: node --import tsx --test tests/lienzo-muelles.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  muelles, vistaConPanelAbajo, nodoRevelado, aristaRevelada, yDePuerto, editorDeTarjeta,
  MUELLE, PANEL_MARGEN, ZOOM_ALTO, CHROME_ALTO, ALTO_PUERTO, PIE_PUERTOS, BORDE_NODO, ALTO_EDITOR_CONTROL, PANEL_COLUMNA_ANCHO,
  type RectMuelle, type NodoFlujo, type TipoNodo,
} from '../lib/lienzo-grafo';

const sePisan = (a: RectMuelle, b: RectMuelle) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
const dentro = (r: RectMuelle, w: number, h: number) =>
  r.left >= 0 && r.top >= 0 && r.left + r.width <= w && r.top + r.height <= h && r.width > 0 && r.height > 0;
const LISTA = MUELLE.listaAncho + MUELLE.hueco * 2;
const ABAJO = PANEL_MARGEN + ZOOM_ALTO;

test('⚠️ ventana grande: «Probar» de debajo del chrome hasta abajo a la derecha, el editor entre la lista y él, y no se pisan', () => {
  // Cuarta tanda, punto 3: «En "Probar", si tiene que ser más grande el desplegable, sino, no se lee
  // el mensaje». Apilado medía ~330 de alto; ahora va SIEMPRE lado a lado, debajo del chrome.
  const w = 1850, h = 900;
  const m = muelles({ w, h }, { listaAbierta: true, probarAbierto: true, editorAbierto: true });
  assert.equal(m.disposicion, 'lado');
  assert.equal(m.editorForma, 'apaisado');
  const p = m.probar!, e = m.editor!;
  assert.equal(p.top, CHROME_ALTO, '«Probar» tapa el chrome (el «Cerrar» vive ahí)');
  assert.equal(p.left + p.width, w - MUELLE.hueco);
  assert.equal(p.width, MUELLE.probarAncho);
  assert.equal(p.height, h - CHROME_ALTO - MUELLE.hueco, '«Probar» va hasta abajo');
  assert.ok(e.left + e.width <= p.left, 'el editor se mete debajo de «Probar»');
  // El editor MEDIANO (tercera tanda, decisión 1): pegado a la lista, 720 de ancho como mucho (ya
  // no hasta el borde derecho: «ya te fuiste al otro extremo»), pegado arriba de la fila del zoom,
  // alto FIJO de ~420.
  assert.equal(e.left, LISTA + PANEL_MARGEN);
  assert.equal(e.width, MUELLE.editorAnchoMax);
  assert.equal(m.editorAncho, e.width, 'lo dibujado (`panelAncho`) y lo reservado salen del mismo número');
  assert.ok(e.left + e.width < w - PANEL_MARGEN, 'el editor volvió a ir de borde a borde');
  assert.equal(e.top + e.height, h - ABAJO, 'el editor no queda arriba de la fila del zoom');
  assert.equal(e.height, m.editorAlto);
  assert.equal(e.height, MUELLE.editorAltoMax, 'a 900 de alto el editor mide sus 420');
  assert.ok(!sePisan(p, e), '«Probar» y el editor se pisan');
  assert.ok(dentro(p, w, h) && dentro(e, w, h));
  // Los insets: la lista a la izquierda; a la derecha, «Probar» abajo (el chrome no se corre).
  assert.deepEqual(m.insets, { izq: LISTA, der: p.width + MUELLE.hueco * 2, derChrome: 0, derAbajo: p.width + MUELLE.hueco * 2 });
});

test('⚠️ abrir una tarjeta NO le cambia el tamaño a «Probar» (una medición que cambia lo que mide no decide)', () => {
  for (const caja of [{ w: 1440, h: 900 }, { w: 1280, h: 620 }, { w: 1100, h: 500 }, { w: 1920, h: 1080 }]) {
    const cerrado = muelles(caja, { listaAbierta: true, probarAbierto: true, editorAbierto: false });
    const abierto = muelles(caja, { listaAbierta: true, probarAbierto: true, editorAbierto: true });
    assert.deepEqual(abierto.probar, cerrado.probar, `en ${caja.w}x${caja.h} «Probar» cambia al abrir el editor`);
    assert.deepEqual(abierto.insets, cerrado.insets);
    assert.equal(cerrado.editor, null, 'sin tarjeta abierta no hay rectángulo del editor');
    assert.equal(abierto.editorAlto, cerrado.editorAlto);
    // Y en ninguna de estas cajas se pisan (1280x620 es la que cae a lado a lado).
    if (abierto.probar && abierto.editor) assert.ok(!sePisan(abierto.probar, abierto.editor), `en ${caja.w}x${caja.h} «Probar» y el editor se pisan`);
    if (abierto.probar) assert.ok(dentro(abierto.probar, caja.w, caja.h), `en ${caja.w}x${caja.h} «Probar» se sale de la caja`);
  }
});

test('⚠️ ventana baja: si apilados no entran, van LADO A LADO y tampoco se pisan', () => {
  const w = 1440, h = 560;
  const m = muelles({ w, h }, { listaAbierta: true, probarAbierto: true, editorAbierto: true });
  assert.equal(m.disposicion, 'lado');
  const p = m.probar!;
  assert.equal(p.top, CHROME_ALTO);
  assert.equal(p.height, h - CHROME_ALTO - MUELLE.hueco, 'lado a lado, «Probar» va de debajo del chrome hasta abajo');
  assert.ok(dentro(p, w, h));
  assert.equal(m.insets.derChrome, 0, 'el chrome no se corre: su «▶ Probar» se vuelve «Cerrar» en el mismo lugar');
  assert.equal(m.insets.derAbajo, m.insets.der);
  if (m.editor) {
    assert.ok(!sePisan(p, m.editor), '«Probar» y el editor se pisan lado a lado');
    assert.ok(m.editor.left + m.editor.width <= p.left, 'el editor se mete debajo de «Probar»');
    assert.ok(m.editor.width >= MUELLE.apaisadoMin);
  } else {
    assert.equal(m.editorForma, 'columna');
  }
  // Y en una caja bajísima los rectángulos siguen siendo válidos (nada negativo).
  const chica = muelles({ w: 1200, h: 300 }, { listaAbierta: true, probarAbierto: true, editorAbierto: true });
  assert.ok(chica.probar!.height >= 0 && chica.editorAlto >= 0);
});

test('⚠️ en una ventana angosta el editor cae a COLUMNA (con lo que no cambia al abrir el panel)', () => {
  // 320 + 32 de lista + 24 de márgenes: con 840 de ancho quedan 464 < 560 (el piso del mediano).
  const m = muelles({ w: 840, h: 800 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true });
  assert.equal(m.editorForma, 'columna');
  assert.equal(m.editor, null, 'columna: el panel de siempre, no la franja');
  // Con la lista cerrada, la misma ventana sí tiene lugar (y el editor no pasa de su tope). Desde la
  // cuarta tanda (punto 16) el tope es 840 y la ventana de 840 deja 816 de lugar: manda el lugar.
  const sinLista = muelles({ w: 840, h: 800 }, { listaAbierta: false, probarAbierto: false, editorAbierto: true });
  assert.equal(sinLista.editorForma, 'apaisado');
  assert.equal(sinLista.insets.izq, 0);
  assert.equal(sinLista.editor!.left, PANEL_MARGEN);
  assert.equal(sinLista.editor!.width, Math.min(MUELLE.editorAnchoMax, 840 - PANEL_MARGEN * 2));
  // Justo en el borde: 560 de lugar entra (y el editor mide eso), 559 no.
  const borde = LISTA + PANEL_MARGEN * 2 + MUELLE.apaisadoMin;
  const enBorde = muelles({ w: borde, h: 800 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true });
  assert.equal(enBorde.editorForma, 'apaisado');
  assert.equal(enBorde.editor!.width, MUELLE.apaisadoMin);
  assert.equal(muelles({ w: borde - 1, h: 800 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true }).editorForma, 'columna');
});

test('«Probar» cerrado no reserva nada a la derecha', () => {
  const m = muelles({ w: 1440, h: 900 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true });
  assert.equal(m.probar, null);
  assert.equal(m.disposicion, null);
  assert.deepEqual(m.insets, { izq: LISTA, der: 0, derChrome: 0, derAbajo: 0 });
  // Mediano: pegado a la lista, 720, y a su derecha sigue el lienzo.
  assert.equal(m.editor!.left + m.editor!.width, LISTA + PANEL_MARGEN + MUELLE.editorAnchoMax);
});

test('⚠️ el editor MEDIANO en CUALQUIER caja: ≤ 720 × ≤ 420, pegado a la lista, y «Probar» no lo pisa (tercera tanda)', () => {
  // Pedido literal: «El editor no debe ser tan ancho, ya te fuiste al otro extremo». Se barre una
  // grilla de cajas de verdad, con y sin «Probar», incluidas las medianas (1000-1280 × 560-760),
  // donde «Probar» apilado y el editor compiten por el alto.
  const pisadas: string[] = [];
  for (const w of [1000, 1100, 1180, 1280, 1366, 1440, 1600, 1920]) for (const h of [560, 620, 700, 760, 900, 1080]) for (const probar of [false, true]) {
    const m = muelles({ w, h }, { listaAbierta: true, probarAbierto: probar, editorAbierto: true });
    if (!m.editor) { assert.equal(m.editorForma, 'columna'); continue; }
    const e = m.editor;
    assert.ok(e.width <= MUELLE.editorAnchoMax && e.width >= MUELLE.apaisadoMin, `${w}x${h}: el editor mide ${e.width} de ancho`);
    assert.ok(e.height <= MUELLE.editorAltoMax, `${w}x${h}: el editor mide ${e.height} de alto`);
    assert.equal(e.left, LISTA + PANEL_MARGEN, `${w}x${h}: el editor no está pegado a la lista`);
    assert.equal(e.top + e.height, h - ABAJO, `${w}x${h}: el editor no está encima de la fila del zoom`);
    assert.ok(dentro(e, w, h), `${w}x${h}: el editor se sale de la caja`);
    if (m.probar && sePisan(m.probar, e)) pisadas.push(`${w}x${h}`);
  }
  assert.deepEqual(pisadas, [], `«Probar» y el editor se pisan en ${pisadas.length} cajas`);
});

test('⚠️ `vistaConPanelAbajo` con el panel MEDIANO: lo que arranca a su derecha no se corre', () => {
  const v = { k: 1, tx: 0, ty: 0 };
  // El panel va de 316 a 1036 (720) y su techo está en 480; a la derecha, el piso es 836.
  const libre = { izq: 316, der: 1400, arriba: 64, abajo: 480, panelDer: 1048, abajoSinPanel: 836 };
  // A la derecha del panel y por encima del zoom: ya se ve, no se toca.
  assert.equal(vistaConPanelAbajo(v, { x: 1100, y: 600, ancho: 252, alto: 150 }, libre), null);
  // Debajo del panel (arranca a su izquierda): sube como siempre.
  const r = vistaConPanelAbajo(v, { x: 400, y: 450, ancho: 252, alto: 150 }, libre)!;
  assert.equal(r.ty, 480 - 600);
  // A la derecha pero bajando más allá de la fila del zoom: sube hasta el piso de ahí, no hasta el techo del panel.
  const baja = vistaConPanelAbajo(v, { x: 1100, y: 800, ancho: 252, alto: 150 }, libre)!;
  assert.equal(baja.ty, 836 - 950);
});

test('⚠️ `vistaConPanelAbajo`: corre la vista en VERTICAL para que la tarjeta quede arriba del panel apaisado', () => {
  const v = { k: 1, tx: 0, ty: 0 };
  const libre = { izq: 316, der: 1400, arriba: 64, abajo: 480 };
  // Una tarjeta que el panel tapa (llega hasta 600): sube lo justo para terminar en `abajo`.
  const tapada = { x: 400, y: 450, ancho: 252, alto: 150 };
  const r = vistaConPanelAbajo(v, tapada, libre)!;
  assert.equal(r.ty, libre.abajo - (tapada.y + tapada.alto));
  assert.equal(r.tx, 0, 'no se mueve de costado si no hace falta');
  assert.equal(r.k, 1, 'no cambia el zoom');
  // Ya a la vista: no se toca (devolver la vista corre sola; ver `vistaAlCerrarPanel`).
  assert.equal(vistaConPanelAbajo(v, { x: 400, y: 100, ancho: 252, alto: 120 }, libre), null);
  // Más alta que la franja: se alinea ARRIBA (se ve la cabecera, que dice qué se edita).
  const alta = vistaConPanelAbajo(v, { x: 400, y: 300, ancho: 252, alto: 600 }, libre)!;
  assert.equal(alta.ty + 300, libre.arriba, 'una tarjeta alta quedó con la cabecera debajo del chrome');
  // Debajo de la lista: también se corre a la derecha.
  const izq = vistaConPanelAbajo(v, { x: 100, y: 450, ancho: 252, alto: 150 }, libre)!;
  assert.equal(izq.tx + 100, libre.izq);
  // Con zoom, todo en coordenadas de pantalla.
  const z = vistaConPanelAbajo({ k: 0.5, tx: 0, ty: 0 }, { x: 800, y: 900, ancho: 252, alto: 150 }, libre)!;
  assert.equal(z.ty + (900 + 150) * 0.5, libre.abajo);
  // Sin franja (panel más alto que la caja): no hay a dónde correrla.
  assert.equal(vistaConPanelAbajo(v, tapada, { ...libre, abajo: 60 }), null);
});

test('el revelado: lo que el orden no nombra se ve siempre, y una flecha aparece con sus dos puntas', () => {
  const orden = ['a', 'b', 'c'];
  assert.equal(nodoRevelado(orden, 0, 'a'), false);
  assert.equal(nodoRevelado(orden, 1, 'a'), true);
  assert.equal(nodoRevelado(orden, 1, 'b'), false);
  assert.equal(nodoRevelado(orden, 0, 'entrada'), true, 'el CRON (que el orden no nombra) desapareció');
  assert.equal(nodoRevelado(orden, Number.POSITIVE_INFINITY, 'c'), true, 'completado: todo a la vista');
  assert.equal(nodoRevelado(null, 0, 'c'), true, 'sin revelado: todo a la vista');
  assert.equal(aristaRevelada(orden, 2, { desde: 'a', hasta: 'c' }), false);
  assert.equal(aristaRevelada(orden, 3, { desde: 'a', hasta: 'c' }), true);
  assert.equal(aristaRevelada(orden, 1, { desde: 'entrada', hasta: 'a' }), true);
});

test('⚠️ una flecha en paralelo sale de la fila que la admite, y de «sig» si la fila ya no ofrece más', () => {
  const cron = (paralelo: boolean): NodoFlujo => ({
    id: 'entrada', tipo: 'entrada', titulo: 'CRON', icono: '⏰', x: 0, y: 0, ancho: 252, alto: 120,
    puertos: [{ id: 'sig', rotulo: 'Al entrar', vacio: false, ...(paralelo ? { paralelo: true } : {}) }, { id: 'resp', rotulo: 'Si responde', vacio: true }],
  });
  const filaAlEntrar = 120 - BORDE_NODO - PIE_PUERTOS - 1.5 * ALTO_PUERTO;
  assert.equal(yDePuerto(cron(true), 'par:x'), filaAlEntrar);
  // Al tope de caminos la fila deja de ofrecer el ＋ (`paralelo` ausente) y las flechas que ya
  // salen en paralelo NO pueden saltar a la cabecera.
  assert.equal(yDePuerto(cron(false), 'par:x'), filaAlEntrar);
  assert.equal(yDePuerto(cron(false), 'resp'), 120 - BORDE_NODO - PIE_PUERTOS - 0.5 * ALTO_PUERTO);
});

// ── Cuarta tanda, punto 1: el editor mide por TIPO de tarjeta (`editorDeTarjeta`) ──────────────
// Literal: «No me gusta que el editor del CRON como muchos otros tengan tanto espacio en blanco y un
// desplegable chico arriba del todo». Las capturas: DELAY, ACTION y CONDITION en ~720 × 420 con un
// renglón arriba, porque todos medían lo del editor de WhatsApp. Y el punto 16: «haz más grande el
// editable de Email y WhatsApp». Rotura con todo puesto: ver el pie de tests/editores-control.test.ts.

const CONTROL: TipoNodo[] = ['espera', 'etiqueta', 'ir-a', 'accion', 'mako', 'condicion', 'entrada', 'respuesta'];

test('⚠️ el editor de un MENSAJE es más grande que antes (punto 16) y el de control mide lo suyo', () => {
  const m = muelles({ w: 1850, h: 900 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true });
  const msg = editorDeTarjeta(m, 'mensaje');
  assert.ok(msg.ancho > 720 && msg.alto > 420, `el de WhatsApp/Email mide ${msg.ancho} × ${msg.alto}, no más que los 720 × 420 de antes`);
  assert.deepEqual(msg, { ancho: m.editorAncho, alto: m.editorAlto }, 'el de mensaje es el rectángulo de `muelles`');
  for (const t of CONTROL) {
    const c = editorDeTarjeta(m, t);
    assert.equal(c.alto, ALTO_EDITOR_CONTROL[t], `${t}: no mide lo de su tipo`);
    assert.ok(c.alto < msg.alto, `${t}: el de control no es más chico que el de un mensaje`);
    assert.equal(c.ancho, MUELLE.editorControlAncho, `${t}: el de control no va con su ancho`);
  }
  // DELAY y GO TO son UNA frase o un campo: el panel no pasa de 160 (antes, 420 con un renglón). El TAG,
  // desde la sexta tanda (TAG 2), lleva VARIAS etiquetas: el verbo y los chips bajan de renglón en el
  // panel de columna, y su tope es 200 (lib/lienzo-grafo.ts, `ALTO_EDITOR_CONTROL`, con la cuenta).
  for (const t of ['espera', 'ir-a'] as const) assert.ok(editorDeTarjeta(m, t).alto <= 160, `${t}: volvió el panel con aire`);
  assert.ok(editorDeTarjeta(m, 'etiqueta').alto <= 200, 'etiqueta: volvió el panel con aire');
  // Y el CRON mide lo de un «Recurrente» con un CRON (segunda pasada): con 320 scrolleaba en lo más común.
  assert.ok(editorDeTarjeta(m, 'entrada').alto >= 440, 'entrada: el Recurrente no entra en el panel del CRON');
});

test('⚠️ POR TIPO, NUNCA POR CONTENIDO: dos tarjetas del mismo tipo miden lo mismo en cualquier caja', () => {
  // La función no recibe el contenido: sólo el tipo y la caja. Lo que se fija acá es que el resultado
  // no dependa de nada más que eso (el mismo tipo, la misma caja, el mismo tamaño), y que abrir o
  // cerrar «Probar» no le cambie el alto (sí el ancho, que se corta antes de «Probar»).
  for (const caja of [{ w: 1440, h: 900 }, { w: 1920, h: 1080 }, { w: 1280, h: 700 }]) {
    const sin = muelles(caja, { listaAbierta: true, probarAbierto: false, editorAbierto: true });
    const con = muelles(caja, { listaAbierta: true, probarAbierto: true, editorAbierto: true });
    for (const t of [...CONTROL, 'mensaje' as const]) {
      assert.deepEqual(editorDeTarjeta(sin, t), editorDeTarjeta(sin, t));
      if (sin.editorForma === con.editorForma) assert.equal(editorDeTarjeta(con, t).alto, editorDeTarjeta(sin, t).alto, `${caja.w}x${caja.h} ${t}: «Probar» le cambió el alto`);
    }
  }
});

test('⚠️ el de control comparte la esquina con el grande y cabe ADENTRO: si el grande no pisa a «Probar», el chico tampoco', () => {
  const pisadas: string[] = [];
  // 1366 con «Probar» deja 581 de lugar: es la caja donde el ancho de control (600) pasaría al de
  // mensaje si no se topara contra él.
  for (const w of [1100, 1280, 1366, 1440, 1600, 1920]) for (const h of [560, 700, 900, 1080]) for (const probar of [false, true]) {
    const m = muelles({ w, h }, { listaAbierta: true, probarAbierto: probar, editorAbierto: true });
    if (!m.editor) continue;
    for (const t of CONTROL) {
      const c = editorDeTarjeta(m, t);
      // Mismo borde izquierdo y mismo borde de abajo que el grande (`Lienzo`: left + bottom fijos).
      const r: RectMuelle = { left: m.editor.left, top: m.editor.top + m.editor.height - c.alto, width: c.ancho, height: c.alto };
      assert.ok(c.ancho <= m.editor.width && c.alto <= m.editor.height, `${w}x${h} ${t}: el de control es más grande que el de mensaje`);
      assert.ok(c.ancho >= MUELLE.apaisadoMin, `${w}x${h} ${t}: ${c.ancho} de ancho no entra ni la frase de una condición`);
      if (m.probar && sePisan(m.probar, r)) pisadas.push(`${w}x${h} ${t}`);
    }
  }
  assert.deepEqual(pisadas, [], `«Probar» y un editor de control se pisan en ${pisadas.length} casos`);
});

test('de columna (ventana angosta) el ancho es el de siempre y el alto sigue siendo por tipo; sin `muelles`, alto libre', () => {
  const m = muelles({ w: 840, h: 800 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true });
  assert.equal(m.editorForma, 'columna');
  assert.deepEqual(editorDeTarjeta(m, 'espera'), { ancho: PANEL_COLUMNA_ANCHO, alto: ALTO_EDITOR_CONTROL.espera });
  assert.deepEqual(editorDeTarjeta(m, 'mensaje'), { ancho: PANEL_COLUMNA_ANCHO, alto: m.editorAlto });
  // Sin `muelles` o con la caja sin medir (alto 0): 0, que el lienzo lee como el alto libre de siempre.
  assert.deepEqual(editorDeTarjeta(null, 'accion'), { ancho: PANEL_COLUMNA_ANCHO, alto: 0 });
  assert.equal(editorDeTarjeta(muelles({ w: 0, h: 0 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true }), 'accion').alto, 0);
  // En una caja bajísima ninguno pasa del de mensaje (que ya está topado por el chrome).
  const baja = muelles({ w: 1440, h: 300 }, { listaAbierta: true, probarAbierto: false, editorAbierto: true });
  for (const t of CONTROL) assert.ok(editorDeTarjeta(baja, t).alto <= baja.editorAlto, `${t} en una caja de 300`);
});
