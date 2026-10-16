// =============================================================================
// Offer v2 — la PANTALLA (app/offer/*), EJECUTADA: el árbol del selector, el chat y la conclusión
// =============================================================================
// Pedido de Martín (11/10/2026): el título «Offer» se va y en su lugar va el selector del funnel en
// árbol (funnel → ofertas → conversaciones), el chat de WhatsApp de la casa, y la oferta guardada
// queda ligada al funnel. Lo que el motor decide lo fija tests/offer-v2.test.ts; acá va lo que decide
// la PANTALLA y ningún compilador ve. La mayoría son los seis hallazgos de la revisión adversarial
// del 11/10 (scratchpad revision-pantalla.json):
//   1. «Guardar en este funnel» con `aviso` (la oferta se escribió pero no se ligó) no puede dibujar
//      «Guardada»: el aviso pide volver a tocar el botón y el botón tiene que estar. Y desde el contrato
//      que sumó el motor el mismo día: también después de RECARGAR (`ligada: false` de la vista), y SIN
//      botón cuando el aviso no se arregla reintentando (`avisoReintentable: false`: funnel borrado);
//   2. «Reintentar la oferta» no puede repetir un 'generar' que el servidor rechazó con 409, y si el
//      servidor sí terminó, se muestra lo que armó;
//   3. con el árbol sin leer, la bienvenida dice que no cargó: «no pude leer» no es «no hay funnels»;
//   4. 'nueva' que devuelve la MISMA conversación abierta no descarta lo que está en vuelo;
//   5. una conversación no se mueve de rama en cada turno: se ubica con la MISMA regla y el MISMO dato
//      que `construirArbol` del servidor (la columna cruda `oferta_id` = `ofertaGuardadaId`), y un test
//      diferencial cruza las dos;
//   6. un audio rechazado como definitivo (422 sin voz, 413, 415) no vuelve a la barra para reintentar.
//
// Además: la «Transcripción del audio» (`via: 'audio'`) se dibuja con el ícono del audio, y una nota de
// voz que trae documentos los muestra (la burbuja del audio los tiraba).
//
// PROBADO ROMPIÉNDOLO, contra una base de 10 tests y 0 fallos (11/10/2026; un «fallo» es un test en rojo,
// así que cada rotura tumba exactamente el test que la cuida y ningún otro):
//   · guardadaVisible sin mirar el aviso (`ofertaId != null && ligada`)               → 1 fallo
//   · guardadaVisible sin mirar `ligada` (después de recargar)                        → 1 fallo
//   · guardadaVisible ofreciendo el botón con un aviso NO reintentable                 → 1 fallo
//   · pasoTrasFalloDeOferta sin la rama del 409                                       → 1 fallo
//   · pasoTrasFalloDeOferta sin la rama de la versión nueva                           → 1 fallo
//   · bienvenidaDe ignorando `arbolLeido` (vacío = «sin funnels»)                      → 1 fallo
//   · nuevaSesion sin la guarda de la misma conversación                              → 1 fallo
//   · conSesionEnArbol ubicando con `ofertaBaseId` solo (sin `ofertaGuardadaId`)      → 2 fallos (el suyo y el diferencial)
//   · iconoDeAdjunto sin el caso `via: 'audio'`                                       → 1 fallo
//   · esRechazoDefinitivo sin el 422                                                  → 1 fallo
//   · enviarAudio devolviendo a la barra con cualquier resultado que no sea 'salio'   → 1 fallo
// (Ver el detalle de cada rotura al lado de su test.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  bienvenidaDe, guardadaVisible, iconoDeAdjunto, linksDe, pasoTrasFalloDeOferta, quedoGuardado, ticksDe,
} from '../app/offer/ayudas';
import {
  arbolSeguro, conSesionEnArbol, leerValor, seccionesDelArbol, titulosUnicos, todasLasSesiones, valorNueva, valorSesion,
} from '../app/offer/arbol';
import { esRechazoDefinitivo } from '../app/offer/offer-api';
import { construirArbol, type SesionParaArbol } from '../lib/offer-reglas';
import type { ArbolOffer, OfferMensaje, OfferSesionResumen } from '../lib/offer-marco';

const RAIZ = join(__dirname, '..');
const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (AGENTS.md: si no, un `/*` citado se come el código). */
const sinComentarios = (src: string): string => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque de una función: desde su declaración hasta la que la sigue (nunca un número de caracteres). */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

// ── 1. «Guardada» sólo si está guardada Y ligada ─────────────────────────────
// Roturas: sin el aviso (`ofertaId != null && ligada !== false`) → 1 fallo;
//          sin `ligada` (`ofertaId != null && !aviso`) → 1 fallo (después de recargar dice «Guardada»);
//          con `if (aviso…) return false` (botón también con un aviso NO reintentable) → 1 fallo.
// (Los tres tumban este mismo test: es el único que cuida la decisión.)
test('guardar en el funnel: el botón vuelve si la liga falta (con aviso o después de recargar); no si no se arregla reintentando', () => {
  const reintentable = { texto: 'Guardé tu oferta, pero no pude sumarla a tu funnel. Vuelve a tocar «Guardar»…', reintentable: true };
  const definitivo = { texto: 'La oferta quedó guardada en tu negocio, pero ese funnel ya no existe en el CRM.', reintentable: false };
  // Recién guardada, la liga falló y se arregla reintentando → el botón (aunque `ligada` diga otra cosa).
  assert.equal(guardadaVisible(7, false, reintentable), false);
  assert.equal(guardadaVisible(7, true, reintentable), false);
  // El funnel se borró o se archivó → «Guardada» con el aviso, sin invitar a repetir.
  assert.equal(guardadaVisible(7, true, definitivo), true);
  assert.equal(guardadaVisible(7, false, definitivo), true);
  // Después de RECARGAR (el aviso ya no existe): lo dice `ligada`.
  assert.equal(guardadaVisible(7, false, null), false);
  assert.equal(guardadaVisible(7, true, null), true);
  assert.equal(guardadaVisible(7, undefined, null), true, 'una vista vieja sin el campo no inventa un faltante');
  assert.equal(guardadaVisible(7, true, { texto: '   ', reintentable: true }), true, 'un aviso vacío no es un aviso');
  assert.equal(guardadaVisible(null, true, null), false, 'sin la versión vigente guardada, el botón');
  // Y la conclusión lo usa con `ligada` de la vista y el aviso que devolvió el guardado.
  const barra = sinComentarios(bloque(leer('app/offer/Conclusion.tsx'), 'function BarraAcciones', 'const pdf ='));
  assert.match(barra, /const guardada = guardadaVisible\(sesion\.ofertaId, sesion\.ligada, aviso\)/);
  // `avisoReintentable` en positivo: sólo un true explícito vuelve a ofrecer el botón.
  const guardar = sinComentarios(bloque(leer('app/offer/OfferApp.tsx'), 'const guardarOferta = async', 'const conclusion ='));
  assert.match(guardar, /reintentable: r\.avisoReintentable === true/);
});

// ── 2. El reintento de la oferta ─────────────────────────────────────────────
// Roturas: sin `if (e.status === 409)` → 1 fallo (el 409 vuelve a 'oferta');
//          sin la rama de la versión → 1 fallo (lo que el servidor armó no se muestra).
test('reintentar la oferta: 409 rehace el diagnóstico; una conclusión nueva al releer es «listo»', () => {
  assert.equal(pasoTrasFalloDeOferta({ status: 409, versionAntes: 1, versionAhora: 1 }), 'diagnostico');
  assert.equal(pasoTrasFalloDeOferta({ status: 409, versionAntes: 0, versionAhora: null }), 'diagnostico', 'sin poder releer decide el status');
  assert.equal(pasoTrasFalloDeOferta({ status: undefined, versionAntes: 1, versionAhora: 2 }), 'listo', 'se cortó la conexión, no el trabajo');
  assert.equal(pasoTrasFalloDeOferta({ status: 409, versionAntes: 0, versionAhora: 1 }), 'listo', 'si ya terminó, se muestra aunque haya sido 409');
  assert.equal(pasoTrasFalloDeOferta({ status: 502, versionAntes: 1, versionAhora: 1 }), 'oferta');
  assert.equal(pasoTrasFalloDeOferta({ status: undefined, versionAntes: 0, versionAhora: null }), 'oferta');
  // Y `armar` la consulta en su catch (con la versión de ANTES de armar).
  const armar = sinComentarios(bloque(leer('app/offer/OfferApp.tsx'), 'const armar = async', 'const elegirOpcion'));
  assert.match(armar, /const versionAntes = sesionRef\.current\?\.conclusion\?\.version \?\? 0/);
  assert.match(armar, /pasoTrasFalloDeOferta\(\{ status: err instanceof ErrorOfferApi \? err\.status : undefined, versionAntes, versionAhora \}\)/);
});

// ── 3. «No pude leer» no es «no hay» ─────────────────────────────────────────
// Rotura: `bienvenidaDe = (_, vacio) => vacio ? 'sin-funnels' : 'elegir'` → 1 fallo.
test('bienvenida: con el árbol sin leer dice que no cargó, nunca «crea un funnel»', () => {
  assert.equal(bienvenidaDe(false, true), 'no-cargo');
  assert.equal(bienvenidaDe(false, false), 'no-cargo');
  assert.equal(bienvenidaDe(true, true), 'sin-funnels');
  assert.equal(bienvenidaDe(true, false), 'elegir');
});

// ── 4. 'nueva' que devuelve la conversación abierta ──────────────────────────
// Rotura: borrar el `if (r.sesion.id === sesionRef.current?.id)` → 1 fallo.
test('nueva oferta: si el servidor devuelve la MISMA conversación, no se reinicia', () => {
  const nueva = sinComentarios(bloque(leer('app/offer/OfferApp.tsx'), 'const nuevaSesion = async', 'const elegir ='));
  const guarda = nueva.indexOf('if (r.sesion.id === sesionRef.current?.id)');
  const reinicia = nueva.indexOf('reiniciar();');
  assert.ok(guarda >= 0, 'falta la guarda de la misma conversación');
  assert.ok(reinicia > guarda, 'la guarda tiene que ir ANTES de reiniciar()');
  assert.match(nueva.slice(guarda, reinicia), /return;/, 'la guarda corta antes de reiniciar');
});

// ── 5. La rama la decide el servidor ─────────────────────────────────────────
const r = (id: number, titulo: string, at: string): OfferSesionResumen => ({ id, titulo, estado: 'conversando', total: null, updatedAt: at });
const ARBOL = arbolSeguro({
  funnels: [
    {
      id: 1, nombre: 'Coaching',
      ofertas: [
        { id: 10, nombre: 'Mentoría', principal: false, sesiones: [r(100, 'a', '2026-10-10')] },
        { id: 11, nombre: 'Programa', principal: true, sesiones: [r(102, 'guardada', '2026-10-09')] },
      ],
      sesionesNuevas: [r(101, 'b', '2026-10-09')],
    },
    { id: 2, nombre: 'Coaching', ofertas: [], sesionesNuevas: [] },
    { nombre: 'sin id' },
  ],
  sueltas: [r(200, 'v1', '2026-10-01')],
});
const donde = (a: typeof ARBOL, id: number): string[] => [
  ...a.funnels.flatMap((f) => [
    ...f.ofertas.filter((o) => o.sesiones.some((s) => s.id === id)).map((o) => `oferta:${o.id}`),
    ...(f.sesionesNuevas.some((s) => s.id === id) ? [`nuevas:${f.id}`] : []),
  ]),
  ...(a.sueltas.some((s) => s.id === id) ? ['sueltas'] : []),
];

// Rotura: ubicar con `ofertaBaseId` solo → 1 fallo acá (la 102, guardada en la 11 y que analiza la 10,
// salta a la 10) y 1 en el diferencial de abajo.
test('árbol: la conversación cuelga de la oferta GUARDADA (columna cruda), si no de la que analiza', () => {
  // La 102 se guardó en la oferta 11 (`ofertaGuardadaId`) y analiza la 10. Después de afinar, la vista trae
  // `ofertaId` en null, pero la columna cruda sigue diciendo 11: no se mueve, sólo cambia su título.
  const alDia = conSesionEnArbol(ARBOL, { id: 102, funnelId: 1, ofertaGuardadaId: 11, ofertaBaseId: 10 }, r(102, 'afinada', '2026-10-11'));
  assert.deepEqual(donde(alDia, 102), ['oferta:11']);
  assert.equal(alDia.funnels[0].ofertas[1].sesiones[0].titulo, 'afinada');
  assert.equal(todasLasSesiones(alDia).length, todasLasSesiones(ARBOL).length, 'no se duplica');
  // Una que no estaba: la oferta que analiza, «nuevas» del funnel, o las sueltas.
  assert.deepEqual(donde(conSesionEnArbol(ARBOL, { id: 300, funnelId: 1, ofertaGuardadaId: null, ofertaBaseId: 10 }, r(300, 'n', '2026-10-12')), 300), ['oferta:10']);
  assert.deepEqual(donde(conSesionEnArbol(ARBOL, { id: 301, funnelId: 2, ofertaGuardadaId: null, ofertaBaseId: null }, r(301, 'n', '2026-10-12')), 301), ['nuevas:2']);
  assert.deepEqual(donde(conSesionEnArbol(ARBOL, { id: 302, funnelId: 99, ofertaGuardadaId: null, ofertaBaseId: null }, r(302, 'n', '2026-10-12')), 302), ['sueltas']);
  assert.deepEqual(donde(conSesionEnArbol(ARBOL, { id: 303, funnelId: 1, ofertaGuardadaId: 77, ofertaBaseId: 76 }, r(303, 'n', '2026-10-12')), 303), ['nuevas:1'],
    'ofertas que el funnel no tiene caen en «nuevas»');
  // La más nueva queda arriba de su rama.
  const nueva = conSesionEnArbol(ARBOL, { id: 300, funnelId: 1, ofertaGuardadaId: null, ofertaBaseId: 10 }, r(300, 'n', '2026-10-12'));
  assert.deepEqual(nueva.funnels[0].ofertas[0].sesiones.map((s) => s.id), [300, 100]);
});

// DIFERENCIAL (AGENTS.md: dos copias de una regla se comparan sobre una batería, no se leen): para cada
// conversación, la rama que le da `construirArbol` con todas las filas tiene que ser la misma que le da
// `conSesionEnArbol` partiendo del árbol sin ella.
test('árbol: la regla de la pantalla y la de construirArbol ubican igual cada conversación', () => {
  const funnels = [{ id: 1, nombre: 'Coaching' }, { id: 2, nombre: 'Ventas' }];
  const ofertas = [{ id: 10, nombre: 'Mentoría' }, { id: 11, nombre: 'Programa' }, { id: 12, nombre: 'Afuera' }];
  const ligas = [
    { funnel_id: 1, oferta_id: 11, es_principal: true, orden: 0 },
    { funnel_id: 1, oferta_id: 10, es_principal: false, orden: 1 },
  ];
  const fila = (id: number, funnelId: number | null, ofertaId: number | null, ofertaBaseId: number | null): SesionParaArbol =>
    ({ ...r(id, `s${id}`, `2026-10-${String(10 + (id % 10)).padStart(2, '0')}`), funnelId, ofertaId, ofertaBaseId });
  const sesiones = [
    fila(1, 1, 11, 10),    // guardada en la 11, analiza la 10 → la 11
    fila(2, 1, null, 10),  // analiza la 10 → la 10
    fila(3, 1, 12, null),  // guardada en una oferta que el funnel no tiene → nuevas
    fila(4, 99, null, null), // funnel que no está → sueltas
    fila(5, null, null, null), // v1 → sueltas
    fila(6, 2, null, 10),  // analiza una oferta que el funnel 2 no tiene → nuevas del 2
    fila(7, 1, 12, 10),    // guardada afuera, analiza la 10 → la 10
  ];
  const servidor = construirArbol({ funnels, ofertas, ligas, sesiones });
  for (const s of sesiones) {
    const sinElla: ArbolOffer = construirArbol({ funnels, ofertas, ligas, sesiones: sesiones.filter((x) => x.id !== s.id) });
    const local = conSesionEnArbol(sinElla, { id: s.id, funnelId: s.funnelId, ofertaGuardadaId: s.ofertaId, ofertaBaseId: s.ofertaBaseId }, r(s.id, s.titulo, s.updatedAt));
    assert.deepEqual(donde(local, s.id), donde(servidor, s.id), `la conversación ${s.id}`);
  }
});

test('árbol: las secciones del desplegable (funnel → ofertas → conversaciones) y sus valores', () => {
  const secs = seccionesDelArbol(ARBOL, { funnel: 'filtro', oferta: 'etiqueta', conversacion: 'nota', sueltas: 'archivo' });
  assert.deepEqual(secs.map((s) => s.title), ['Coaching', 'Coaching (2)', 'Sin funnel'], 'el Dropdown navega por título: no puede haber dos iguales');
  assert.deepEqual(secs[0].grupos?.map((g) => g.title), ['Programa', 'Mentoría'], 'la principal primero');
  assert.equal(secs[0].grupos?.[0].resumen, 'Principal');
  assert.deepEqual(secs[0].grupos?.[1].options.map((o) => o.value), ['sesion:100', 'analizar:1:10']);
  assert.deepEqual(secs[0].options.map((o) => o.value), ['sesion:101', 'nueva:1']);
  assert.equal(secs[0].options[1].crear, true);
  assert.deepEqual(titulosUnicos(['A', 'A', '', ' '], 'X'), ['A', 'A (2)', 'X', 'X (2)']);
  assert.deepEqual(titulosUnicos(['Sin funnel'], 'X', ['Sin funnel']), ['Sin funnel (2)']);
  assert.deepEqual(leerValor(valorSesion(5)), { tipo: 'sesion', id: 5 });
  assert.deepEqual(leerValor(valorNueva(3, null)), { tipo: 'nueva', funnelId: 3, ofertaBaseId: null });
  assert.deepEqual(leerValor(valorNueva(3, 9)), { tipo: 'nueva', funnelId: 3, ofertaBaseId: 9 });
  for (const malo of ['', 'sesion:', 'sesion:0', 'sesion:1:2', 'nueva:x', 'analizar:3', 'otra:1']) assert.equal(leerValor(malo), null, malo);
});

// ── 6. El audio rechazado como definitivo ────────────────────────────────────
// Roturas: `esRechazoDefinitivo` sin el 422 → 1 fallo;
//          `enviarAudio` con `if (res !== 'salio') setAudioEnEspera(a)` → 1 fallo;
//          (13/10) `mandar` subiendo el audio aunque ya tenga `path` → 1 fallo, 9 pases;
//          (16/10) `descartarSubida(a.path);` suelto, también cuando la nota SALIÓ → 9 / 1.
test('audio: 413, 415 y 422 son definitivos (no vuelven a la barra); un corte o un 5xx sí', () => {
  for (const s of [413, 415, 422]) assert.equal(esRechazoDefinitivo(s), true, String(s));
  for (const s of [undefined, 400, 404, 409, 500, 502, 504]) assert.equal(esRechazoDefinitivo(s), false, String(s));
  const enviar = sinComentarios(bloque(leer('app/offer/OfferApp.tsx'), 'const enviarAudio = async', 'const mandarAudio ='));
  assert.match(enviar, /if \(res === 'volver'\) \{ setAudioEnEspera\(a\); return; \}/, 'sólo un fallo que se arregla reintentando devuelve el audio');
  // Y el que se TIRA se lleva su binario: el 422 lo borra el servidor, los otros no. El que SALIÓ no:
  // su path es el que el mensaje reproduce (GET /api/offer/audio). Hasta el 16/10 se borraba también ese.
  assert.match(enviar, /if \(res === 'tirar'\) descartarSubida\(a\.path\);/, 'un audio descartado deja su binario suelto en Storage');
  assert.doesNotMatch(enviar.replace(/if \(res === 'tirar'\) descartarSubida\(a\.path\);/, ''), /descartarSubida\(a\.path\)/, 'una nota de voz que salió pierde su audio');
  const mandar = sinComentarios(bloque(leer('app/offer/OfferApp.tsx'), 'const mandar = async', 'const reintentarRespuesta'));
  assert.match(mandar, /esRechazoDefinitivo\(err\.status\)\)\) return 'tirar';/);
  // El REINTENTO no vuelve a subir el audio: el servidor conserva el binario a propósito cuando la IA
  // falla, y subirlo de nuevo dejaba el primero huérfano pagando en Storage.
  assert.match(mandar, /let path = envio\.audio\.path;\n\s*if \(!path\) \{/, 'el audio se re-sube en cada reintento');
  assert.match(mandar, /envio\.audio\.path = path;/);
  // El status viaja en el error (sin él, todo rechazo es «pasajero»).
  assert.match(sinComentarios(leer('app/offer/offer-api.ts')), /err\.status = r\.status;/);
});

// ── La transcripción del audio ───────────────────────────────────────────────
// Rotura: sacar `if (via === 'audio') return 'audio';` → 1 fallo.
test('chat: la «Transcripción del audio» lleva el ícono del audio, y una nota de voz muestra sus documentos', () => {
  assert.equal(iconoDeAdjunto('Transcripción del audio', '', 'audio'), 'audio');
  assert.equal(iconoDeAdjunto('Transcripción del audio'), 'archivo', 'sin la vía, el nombre no alcanza (no tiene extensión)');
  assert.equal(iconoDeAdjunto('precios.pdf', '', 'pdf'), 'archivo');
  assert.equal(iconoDeAdjunto('foto.png'), 'imagen');
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  assert.match(chat, /<ChipArchivo key=\{a\.id\} nombre=\{a\.nombre\} via=\{a\.via\}/, 'el chip recibe la vía');
  const audioConDocs = bloque(chat, 'if (m.audio?.url) {', 'return (\n      <div style={{ display: \'flex\', justifyContent: \'flex-end\' }}>');
  assert.match(audioConDocs, /<Adjuntos lista=\{m\.adjuntos\} \/>/, 'una nota de voz con documentos los dibuja');
  // El motivo de un link que no abre va como lo manda el servidor, sin un prefijo nuestro.
  assert.doesNotMatch(sinComentarios(leer('app/offer/OfferApp.tsx')), /No pude abrir el link/);
});

// ── Lo de la conversación ────────────────────────────────────────────────────
// (El chip de «Leyendo… / Listo» de arriba de la barra se fue el 11/10/2026 —elegir un archivo ya no lo
// lee: abre la vista previa—, y sus asserts con él. Lo de la vista y la lectura al enviar lo fija
// tests/offer-adjuntos-al-enviar.test.ts.)
test('chat: los links del mensaje, «¿ya quedó guardado?» y las palomitas', () => {
  assert.deepEqual(linksDe('mi web es https://acme.com/precios. y www.otra.mx, fin'), ['https://acme.com/precios', 'https://www.otra.mx']);
  assert.deepEqual(linksDe('(https://a.com) https://a.com'), ['https://a.com']);
  assert.deepEqual(linksDe('nada, ni http:// suelto'), []);
  assert.equal(linksDe('https://a.com https://b.com https://c.com https://d.com').length, 3);

  const m = (de: 'yo' | 'mako', texto: string, audio = false): OfferMensaje => ({ id: `${de}-${texto}`, de, texto, at: '', ...(audio ? { audio: { url: '/x', secs: 3 } } : {}) });
  assert.equal(quedoGuardado([m('mako', 'hola'), m('yo', 'precio')], 1, { texto: 'precio', audio: false }), true);
  assert.equal(quedoGuardado([m('yo', 'precio'), m('mako', 'ok')], 1, { texto: 'precio', audio: false }), false, 'el de antes no cuenta');
  assert.equal(quedoGuardado([m('mako', 'hola'), m('yo', 'lo que dije', true)], 1, { texto: '', audio: true }), true);
  assert.deepEqual([0, 1, 2].map((i) => ticksDe([m('yo', 'a'), m('mako', 'b'), m('yo', 'c')], i)), ['read', 'sent', 'sent']);
});
