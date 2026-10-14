// =============================================================================
// tests/editor-landing-disenos.test.ts — el DISEÑO de una landing, separado del COPY
// =============================================================================
// Feedback de Martín (12/10/2026): «en las plantillas confundiste la plantilla de DISEÑO, con el
// COPY... En el panel principal, se tienen que ver plantillas del diseño, y al darle a una, puede
// salir un pop-up... que te pregunte de que quieres crearla», y «aproveches las herramientas que
// tenemos dentro de MaKo... embed de calendly, de cal, de stripe, de mercado pago, del VSL».
//
// Fija:
//   · cada diseño × cada objetivo arma una landing que el saneo del server acepta sin tirar nada;
//   · el diseño manda en la forma (tema y hero) y el objetivo en el copy;
//   · los bloques de MaKo entran donde el objetivo los usa (agenda, VSL, botón de pago);
//   · la caja de crear ofrece DISEÑOS para una landing y plantillas para una presentación, y el
//     alta de un diseño lleva el objetivo elegido;
//   · (14/10/2026, «que la mayoría de las plantillas sean con un VIDEO, porque deberían ser tipo VSL
//     Funnel») la mayoría de los diseños lleva video y el primero es MaKo; el video entra UNA vez en
//     el hero de cada objetivo; al centro, titular → video → botón, centrados; al costado, dos
//     columnas con el video solo a la derecha; la agenda no hereda nada del hero.
//
// ── Roturas (12/10/2026, a mano y restaurado; base en verde: 7 pasan, 0 fallan) ──
//   · `conHerramientasMako` sin la rama del VSL ............................... 6 / 1
//   · `aplicarDiseno` sin poner el hero del diseño ............................. 6 / 1
//   · `plantillasDe('landing')` devuelve las plantillas de copy (PLANTILLAS) .. 5 / 2
//   · `pedidoDeDiseno` con el tema de la plantilla de copy en vez del diseño ... 6 / 1
// ── Roturas del VSL del diseño (14/10/2026, en memoria, restauradas y verificadas por hash; base: 12 / 0) ──
//   · MaKo al final de la grilla ................................................ 11 / 1
//   · 4 diseños más sin video (quedan 4 de 9) .................................... 11 / 1
//   · `conVideoDelDiseno` no reusa el VSL del objetivo (entra otro) ............... 9 / 3
//   · al centro sin centrar los textos ........................................... 11 / 1
//   · al centro con el video debajo del botón .................................... 11 / 1
//   · al centro sin achicar el «Título» display .................................. 11 / 1
//   · al costado con el video a la izquierda ..................................... 11 / 1
//   · el video ANTES de las herramientas, marcando el hero (la agenda lo hereda) .. 8 / 4
// ── Revisión del 14/10/2026: las roturas con las que dos verificadores dejaban esto en verde (base: 13 / 0) ──
//   · al centro, video y botón justo debajo del titular y el subtítulo DEBAJO ..... 12 / 1
//   · al costado, vuelve el «Título» display con anchos [8,4] .................... 12 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanearConfig, sanearContenido } from '../lib/editor-landing/validar';
import { TEMAS } from '../lib/editor-landing/temas';
import { PLANTILLAS } from '../lib/editor-landing/plantillas';
import { NODO, type JsonNodo, type LandingContenido } from '../lib/editor-landing/doc';
import { DISENOS_LANDING, OBJETIVOS_LANDING, heroDelDiseno, landingDesde } from '../lib/editor-landing/disenos-landing';
import { pedidoDeDiseno, plantillasDe } from '../app/landing-generator/crear/tipo';

const nodos = (c: LandingContenido): JsonNodo[] => {
  const out: JsonNodo[] = [];
  const ir = (n: JsonNodo) => { out.push(n); for (const h of n.content ?? []) ir(h); };
  for (const p of c.paginas) for (const t of p.doc.content) ir(t);
  return out;
};
const textoDe = (n: JsonNodo): string => (n.text ?? '') + (n.content ?? []).map(textoDe).join('');

test('cada diseño × cada objetivo arma una landing que el saneo acepta sin tirar nada', () => {
  assert.ok(DISENOS_LANDING.length >= 6, 'hay diseños');
  assert.equal(OBJETIVOS_LANDING.length, PLANTILLAS.length, 'un objetivo por plantilla de copy');
  for (const d of DISENOS_LANDING) {
    for (const o of OBJETIVOS_LANDING) {
      const c = landingDesde(d, o.id);
      assert.ok(c, `${d.id} × ${o.id}: no armó nada`);
      const saneo = sanearContenido(c);
      assert.deepEqual(saneo.descartes, [], `${d.id} × ${o.id}: el saneo tiró algo`);
    }
  }
});

test('el diseño manda en la forma: su tema existe y el hero toma el del diseño', () => {
  const ids = new Set(TEMAS.map((t) => t.id));
  for (const d of DISENOS_LANDING) {
    assert.ok(ids.has(d.tema), `${d.id}: el tema «${d.tema}» no existe`);
    const c = landingDesde(d, 'webinar')!;
    assert.equal(c.paginas[0].doc.content[0].attrs?.diseno, heroDelDiseno(d), `${d.id}: el hero no es el del diseño`);
  }
  assert.equal(landingDesde(DISENOS_LANDING[0], 'no-existe'), null, 'un objetivo que no existe no arma nada');
});

// En un VSL el video ES el visual del hero (14/10/2026): una imagen al costado o arriba sin cargar se
// dibujaba en el editor como el hueco «Agregar imagen» al 37,5% al lado del video. Va 'sin', salvo
// 'fondo' (detrás del video sí tiene sentido). El zigzag de las demás secciones no cambia: arranca del
// lado opuesto al hero del DATO, como siempre.
// Roturas (14/10/2026, en memoria, restauradas y verificadas por hash; base: 13 pasan, 0 fallan):
// `heroDelDiseno` devuelve `d.hero` (la imagen al costado vuelve junto al video) → 12 / 1; el zigzag
// arranca del hero ya corregido (cambia el de las demás secciones) → 12 / 1.
test('con video, el hero va sin imagen al costado (salvo «fondo»), y el zigzag de las demás sigue igual', () => {
  const mal: string[] = [];
  for (const d of DISENOS_LANDING) {
    for (const o of OBJETIVOS_LANDING) {
      const tarjetas = landingDesde(d, o.id)!.paginas[0].doc.content;
      const hero = tarjetas[0].attrs?.diseno;
      if (d.video && !['sin', 'fondo'].includes(String(hero))) mal.push(`${d.id} × ${o.id}: hero «${hero}» junto al video`);
      if (d.video && d.hero === 'fondo' && hero !== 'fondo') mal.push(`${d.id} × ${o.id}: perdió la imagen de fondo`);
      if (!d.video && hero !== d.hero) mal.push(`${d.id} × ${o.id}: sin video, el hero tiene que ser el del diseño`);
      // Las secciones con imagen al costado: con zigzag alternan arrancando del lado opuesto a d.hero.
      if (!d.zigzag) continue;
      let lado = d.hero === 'izquierda' ? 'derecha' : 'izquierda';
      for (const t of tarjetas.slice(1)) {
        const s = t.attrs?.diseno;
        if (s !== 'izquierda' && s !== 'derecha') continue;
        if (s !== lado) { mal.push(`${d.id} × ${o.id}: el zigzag cambió (${s} donde iba ${lado})`); break; }
        lado = lado === 'izquierda' ? 'derecha' : 'izquierda';
      }
    }
  }
  assert.deepEqual(mal, []);
});

test('el objetivo manda en el copy: el mismo diseño con dos objetivos dice cosas distintas', () => {
  const d = DISENOS_LANDING[0];
  const a = textoDe(landingDesde(d, 'agenda-llamada')!.paginas[0].doc.content[0]);
  const b = textoDe(landingDesde(d, 'lead-magnet')!.paginas[0].doc.content[0]);
  assert.notEqual(a, b);
});

test('los bloques de MaKo entran donde el objetivo los usa', () => {
  // Con Minimal (el diseño SIN video): lo que se ve acá es sólo lo del objetivo.
  const d = DISENOS_LANDING.find((x) => x.video === null)!;
  const insertados = (o: string) => nodos(landingDesde(d, o)!).filter((n) => n.type === NODO.insertado);
  const botonPago = (o: string) => nodos(landingDesde(d, o)!).some((n) => n.type === NODO.boton && textoDe(n) === 'Pagar ahora');
  // Agenda (Calendly o Cal.com) en agendar una llamada y en la consultoría.
  assert.ok(insertados('agenda-llamada').some((n) => n.attrs?.proveedor === 'calendly'), 'agenda-llamada sin agenda');
  assert.ok(insertados('consultoria').some((n) => n.attrs?.proveedor === 'calendly'), 'consultoría sin agenda');
  // El VSL en el hero del webinar y de la venta directa.
  for (const o of ['webinar', 'venta-directa']) {
    const hero = landingDesde(d, o)!.paginas[0].doc.content[0];
    assert.ok((hero.content ?? []).some((n) => n.type === NODO.insertado && n.attrs?.proveedor === 'youtube'), `${o}: sin VSL en el hero`);
  }
  // El botón de pago (Stripe o Mercado Pago) en lo que se vende.
  for (const o of ['venta-directa', 'curso-programa', 'app-software']) assert.ok(botonPago(o), `${o}: sin botón de pago`);
  // Y nada de eso donde no va.
  assert.deepEqual(insertados('gracias'), [], 'la página de gracias no lleva agenda ni VSL del objetivo');
  assert.equal(botonPago('lead-magnet'), false, 'un lead magnet no cobra');
});

// ─────────────────────────────────────────────────────────────────────────────
// El VSL del DISEÑO (pedido de Martín, 14/10/2026): «que la mayoría de las plantillas sean con un
// VIDEO, porque deberían ser tipo VSL Funnel... Puedes inspirarte en otras plantillas de VSL Funnel e
// incluso en la misma plantilla de MaKo.»
// ─────────────────────────────────────────────────────────────────────────────

const esVideo = (n: JsonNodo) => n.type === NODO.insertado && ['youtube', 'vimeo', 'loom', 'drive', 'panda', 'wistia', 'bunny', 'fathom'].includes(String(n.attrs?.proveedor));
const todos = (n: JsonNodo): JsonNodo[] => [n, ...(n.content ?? []).flatMap(todos)];
const videosEn = (n: JsonNodo): JsonNodo[] => todos(n).filter(esVideo);
const heroDe = (d: (typeof DISENOS_LANDING)[number], o: string) => landingDesde(d, o)!.paginas[0].doc.content[0];
const CON_VSL_DEL_OBJETIVO = new Set(['webinar', 'venta-directa', 'curso-programa', 'lista-espera']);

test('la mayoría de los diseños lleva video; el primero es MaKo, con su tema y el video al costado', () => {
  const con = DISENOS_LANDING.filter((d) => d.video !== null);
  assert.ok(con.length > DISENOS_LANDING.length / 2, `${con.length} de ${DISENOS_LANDING.length} con video`);
  assert.deepEqual(DISENOS_LANDING.filter((d) => d.video === null).map((d) => d.id), ['minimal'], 'sin video queda sólo Minimal');
  const mako = DISENOS_LANDING[0];
  assert.equal(mako.id, 'mako');
  assert.equal(mako.tema, 'mako');
  assert.equal(mako.video, 'costado');
  assert.equal(TEMAS.find((t) => t.id === 'mako')?.nombre, 'MaKo');
  assert.equal(plantillasDe('landing')[0].id, 'mako', 'primero en la grilla');
  for (const d of DISENOS_LANDING) assert.ok(d.descripcion.length <= 45, `${d.id}: descripción de ${d.descripcion.length} caracteres`);
});

test('cada diseño con video × cada objetivo: EXACTAMENTE un video en el hero (Minimal, sólo el del objetivo)', () => {
  const mal: string[] = [];
  for (const d of DISENOS_LANDING) {
    for (const o of OBJETIVOS_LANDING) {
      const c = landingDesde(d, o.id)!;
      const enHero = videosEn(c.paginas[0].doc.content[0]).length;
      const esperados = d.video ? 1 : CON_VSL_DEL_OBJETIVO.has(o.id) ? 1 : 0;
      if (enHero !== esperados) mal.push(`${d.id} × ${o.id}: ${enHero} videos en el hero (esperaba ${esperados})`);
      // Y fuera del hero, ninguno nuevo: el video del diseño entra UNA vez.
      const fuera = c.paginas.flatMap((p, i) => p.doc.content.slice(i === 0 ? 1 : 0)).flatMap(videosEn).length;
      if (fuera) mal.push(`${d.id} × ${o.id}: ${fuera} videos fuera del hero`);
    }
  }
  assert.deepEqual(mal, []);
});

test('video al centro: titular, video y botón en ese orden, todo centrado y sin el «Título» display', () => {
  const mal: string[] = [];
  for (const d of DISENOS_LANDING.filter((x) => x.video === 'centro')) {
    for (const o of OBJETIVOS_LANDING) {
      const hero = heroDe(d, o.id);
      const bloques = hero.content ?? [];
      if (bloques.some((n) => n.type === NODO.columnas)) continue; // el lead magnet: el video va en su primera columna (abajo)
      const iVideo = bloques.findIndex(esVideo);
      const iAccion = bloques.findIndex((n) => n.type === NODO.botones || n.type === NODO.formulario);
      const iTitulo = bloques.findIndex((n) => n.type === 'heading');
      if (!(iTitulo >= 0 && iTitulo < iVideo)) mal.push(`${d.id} × ${o.id}: el titular no va arriba del video`);
      // TODO el texto del hero (pre-titular, titular, subtítulo) va ARRIBA del video: debajo sólo la acción.
      if (bloques.slice(iVideo + 1).some((n) => n.type === 'paragraph' || n.type === 'heading')) mal.push(`${d.id} × ${o.id}: hay texto del hero debajo del video`);
      if (iAccion >= 0 && iAccion !== iVideo + 1) mal.push(`${d.id} × ${o.id}: el botón no va JUSTO debajo del video`);
      if (iAccion < 0 && iVideo !== bloques.length - 1) mal.push(`${d.id} × ${o.id}: sin botón, el video no cierra el hero`);
      for (const n of bloques) {
        if ((n.type === 'paragraph' || n.type === 'heading') && n.attrs?.textAlign !== 'center') mal.push(`${d.id} × ${o.id}: «${textoDe(n).slice(0, 30)}» sin centrar`);
        if (n.type === NODO.botones && n.attrs?.alinea !== 'centro') mal.push(`${d.id} × ${o.id}: botones sin centrar`);
        if (n.type === 'heading' && n.attrs?.variante === 'titulo') mal.push(`${d.id} × ${o.id}: el «Título» display tapa el video en la miniatura`);
      }
    }
  }
  assert.deepEqual(mal, []);
  // El lead magnet al centro: el video en la primera columna, debajo del texto, y el formulario al lado.
  const lm = heroDe(DISENOS_LANDING.find((x) => x.video === 'centro')!, 'lead-magnet');
  const cols = lm.content?.[0];
  assert.equal(cols?.type, NODO.columnas);
  assert.ok(esVideo(cols!.content![0].content!.at(-1)!), 'el video cierra la primera columna');
  assert.ok(cols!.content![1].content!.some((n) => n.type === NODO.formulario), 'el formulario sigue al lado');
});

test('video al costado: el hero es UNA fila de dos columnas, texto y botón a la izquierda y el video solo a la derecha', () => {
  for (const d of DISENOS_LANDING.filter((x) => x.video === 'costado')) {
    for (const o of OBJETIVOS_LANDING) {
      const p = landingDesde(d, o.id)!;
      const hero = p.paginas[0].doc.content[0];
      assert.equal(hero.content?.length, 1, `${d.id} × ${o.id}: el hero no es una sola fila`);
      const [izq, der] = hero.content![0].content ?? [];
      assert.equal(hero.content![0].type, NODO.columnas, `${d.id} × ${o.id}`);
      assert.deepEqual(hero.content![0].attrs?.anchos, [5, 7], `${d.id} × ${o.id}: el texto en 5 de 12 y el video en 7`);
      assert.ok(!todos(izq).some((n) => n.type === 'heading' && n.attrs?.variante === 'titulo'), `${d.id} × ${o.id}: el «Título» display no entra en 5 de 12`);
      assert.deepEqual(der.content!.map((n) => esVideo(n)), [true], `${d.id} × ${o.id}: la derecha no es el video`);
      assert.equal(videosEn(izq).length, 0, `${d.id} × ${o.id}: video a la izquierda`);
      assert.ok(izq.content!.some((n) => n.type === 'heading'), `${d.id} × ${o.id}: sin titular a la izquierda`);
      // Lo que traía el hero del objetivo sigue ahí (el formulario del lead magnet, los botones).
      const antes = PLANTILLAS.find((x) => x.id === o.id)!.contenido().paginas[0].doc.content[0];
      const tipos = (n: JsonNodo): string[] => [n.type, ...(n.content ?? []).flatMap(tipos)].filter((t) => t !== 'text' && t !== NODO.columnas && t !== NODO.columna);
      assert.deepEqual(tipos(izq).sort(), tipos(antes).slice(1).filter((t) => t !== NODO.insertado).sort(), `${d.id} × ${o.id}: se perdió algo del hero`);
    }
  }
});

test('la sección de la agenda no hereda nada del hero con video', () => {
  for (const d of DISENOS_LANDING.filter((x) => x.video)) {
    for (const o of ['agenda-llamada', 'consultoria']) {
      const tarjetas = landingDesde(d, o)!.paginas[0].doc.content;
      const agenda = tarjetas.find((t) => todos(t).some((n) => n.attrs?.proveedor === 'calendly'))!;
      assert.ok(agenda, `${d.id} × ${o}: sin la sección de la agenda`);
      assert.deepEqual(agenda.content!.map((n) => n.type), ['heading', 'paragraph', NODO.insertado], `${d.id} × ${o}: la agenda cambió de forma`);
      assert.ok(agenda.content!.every((n) => n.attrs?.textAlign !== 'center'), `${d.id} × ${o}: la agenda heredó el centrado`);
      // La agenda copia los atributos del hero (conHerramientasMako): tienen que ser los del hero de la
      // plantilla, no los de un hero que el video ya tocó.
      const sinId = (a: Record<string, unknown> | undefined) => { const { id: _id, diseno: _d, imagenSrc: _i, notas: _n, ...resto } = a ?? {}; return resto; };
      const original = PLANTILLAS.find((x) => x.id === o)!.contenido().paginas[0].doc.content[0];
      assert.deepEqual(sinId(agenda.attrs), sinId(original.attrs), `${d.id} × ${o}: la agenda heredó algo del hero`);
      assert.equal(agenda.attrs?.diseno, 'sin');
    }
  }
});

test('la caja de crear ofrece DISEÑOS para una landing y plantillas para una presentación', () => {
  const landing = plantillasDe('landing');
  assert.deepEqual(landing.map((p) => p.id), DISENOS_LANDING.map((d) => d.id));
  assert.ok(landing.every((p) => p.pideObjetivo), 'un diseño pregunta el objetivo');
  const pres = plantillasDe('presentacion');
  assert.ok(pres.length > 0 && pres.every((p) => !p.pideObjetivo), 'una presentación se crea directo');
});

test('el alta de un diseño lleva el objetivo elegido, el tema del diseño y es una página', () => {
  const p = plantillasDe('landing')[1];
  const d = DISENOS_LANDING.find((x) => x.id === p.id)!;
  const alta = pedidoDeDiseno(p, 'webinar');
  assert.ok(alta);
  assert.equal(alta.config?.tema, d.tema);
  assert.equal(alta.config?.formato, 'pagina');
  assert.equal(alta.titulo, PLANTILLAS.find((x) => x.id === 'webinar')!.nombre);
  assert.deepEqual(alta.config?.origen, { modo: 'plantilla', plantilla: `${d.id}:webinar` });
  // Y el origen sobrevive al saneo del server: la regex vieja no aceptaba los dos puntos y lo tiraba
  // sin motivo (hallado el 14/10/2026).
  // Rotura (14/10/2026, en memoria, restaurada; base: 13 pasan, 0 fallan): la regex sin «:» → 12 / 1.
  const saneo = sanearConfig(alta.config);
  assert.deepEqual(saneo.config.origen, { modo: 'plantilla', plantilla: `${d.id}:webinar` });
  assert.deepEqual(saneo.descartes, []);
  assert.equal(pedidoDeDiseno(p, 'no-existe'), null);
});

test('cada objetivo tiene su ícono y su nombre', () => {
  for (const o of OBJETIVOS_LANDING) {
    assert.ok(o.nombre.trim(), o.id);
    assert.ok(o.icono && o.icono !== 'objetivo', `${o.id}: sin ícono propio`);
  }
});
