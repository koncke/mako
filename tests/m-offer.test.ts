// =============================================================================
// MaKo Mobile — Offer en el teléfono (app/m/offer): lo que se decide en pantalla y no se ve sin un teléfono
// =============================================================================
// La pantalla destila app/offer con las MISMAS acciones y los MISMOS rótulos. Acá se EJECUTA lo puro
// (app/m/offer/modelo.ts) cruzándolo contra escritorio donde hay dos copias de algo, y se fija el cableado
// que no se puede ejecutar sin Next (la orquestación de OfferM, el portal de la franja, la hoja de estilos).
//
// PROBADO ROMPIÉNDOLO (16/10/2026, un arnés que rompe UNA cosa, corre este archivo y restaura desde lo leído;
// base 13 pases / 0 fallos). Las 15 roturas, cazadas, cada una con 12 / 1:
//   R1  un rótulo de ROTULOS cambiado («Descargar el PDF»)                          (rótulos)
//   R2  GRUPOS_PIEZAS con «semana» al final de «Cómo» (el orden del riel)           (piezas)
//       (16/10: los grupos se mudaron a app/offer/ayudas.ts y ya no hay copia; la rotura que vale ahora es
//       volver a escribirlos en modelo.ts: 12 / 1)
//   R3  seccionesDeOferta sin la sección «Urgencia»                                 (secciones)
//   R4  el campo «En cuotas» rotulado «Cuotas»                                      (secciones)
//   R5  el selector sin desambiguar los títulos de las ofertas                       (selector)
//   R6  opcionesRapidas sin el `!ultimo.pregunta` (armaría desde el diagnóstico)    (respuestas)
//   R7  trasRefrescar adoptando la más reciente aunque sea OTRA conversación        (refrescar)
//   R8  enviarAudio con `descartarSubida(a.path)` también cuando salió              (orquestación)
//   R9  la franja por portal a #m-root (ahí no existe --m-abajo)                    (portal)
//   R10 una clase `.of-doc` sin prefijo en offer.css                                (estilos)
//   R11 `<Icon name="adjuntar">` (no existe en el set)                              (íconos)
//   R12 «Tocá para elegir» en el botón del vacío                                    (copy)
//   R13 el Diagnóstico sin `avisosAfirmables` (mostraría «Cierras el 170%»)         (conclusión)
//   R14 el «[completar]» dibujado como texto común                                  (conclusión)
//   R15 el chip del héroe sin contar lo que falta del control final                 (conclusión)
// Restaurado → 13 / 0.
// La nota de voz (16/10/2026, mismo arnés, base 14 / 0), cada una 13 / 1:
//   R16 el composer de vuelta con `useVoiceRecorder` (entrega al parar)              (voz)
//   R17 un efecto que manda sola la nota apenas pasa a escucharse                    (voz)
//   R18 la fila de escuchar sin el reproductor                                       (voz)
// Restaurado → 14 / 0.
// La selección múltiple, `varias` (16/10/2026, mismo arnés, base 16 / 0), cada una 15 / 1 salvo V1 (14 / 2):
//   V1  «No, sólo ésta» marcable (sin `esOpcionNinguna`)                             (varias, hilo)
//   V2  marcables también en una pregunta del diagnóstico                            (varias)
//   V3  las marcadas en el orden de los toques                                      (varias)
//   V4  cada toque manda una sola opción, como antes (el bug)                         (hilo)
//   V5  sin la ayuda «Puedes marcar varias»                                          (hilo)
//   V6  «Enviar (N)» manda sólo la primera, sin `unirOpciones`                       (hilo)
//   V7  el rótulo de la ayuda distinto del de escritorio                             (rótulos)
//   V8  lo marcado sin colgar del id del mensaje                                     (hilo)
// Restaurado → 16 / 0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DONDE_VIVE, GRUPOS_PIEZAS, ROTULOS, alternarMarcada, estadoDePasos, filasDimensiones, heroeDe, opcionesRapidas, piezasEnGrupos, progresoDePiezas,
  renglonesDelSelector, seccionesDeOferta, seccionesDelSelector, sinContestar, trasRefrescar,
} from '../app/m/offer/modelo';
import { ConclusionM, GenerandoM } from '../app/m/offer/HojasOfferM';
import { HiloOfferM } from '../app/m/offer/HiloOfferM';
import { GRUPOS_PIEZAS as GRUPOS_ESCRITORIO } from '../app/offer/PiezasRail';
import { seccionesDelArbol } from '../app/offer/arbol';
import { PIEZAS, DIMENSIONES, type ArbolOffer, type ConclusionOferta, type OfferMensaje, type OfferSesionVista, type PropuestaOferta } from '../lib/offer-marco';

const RAIZ = join(__dirname, '..');
const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (un `/*` adentro de un `//` se comería código). */
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '');
const sinComentariosCss = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}
const CARPETA = 'app/m/offer';
const TSX = readdirSync(join(RAIZ, CARPETA)).filter((f) => /\.(tsx|ts)$/.test(f)).map((f) => `${CARPETA}/${f}`);

// ── 1. Los rótulos son los de escritorio ─────────────────────────────────────
test('rótulos: cada texto que el teléfono copia de escritorio está, tal cual, en su archivo de app/offer', () => {
  const faltan: string[] = [];
  for (const [k, texto] of Object.entries(ROTULOS) as Array<[keyof typeof ROTULOS, string]>) {
    for (const f of DONDE_VIVE[k]) if (!leer(f).includes(texto)) faltan.push(`${k} «${texto}» no está en ${f}`);
  }
  assert.deepEqual(faltan, []);
});

// ── 2. Los grupos de piezas (los MISMOS del riel, no una copia) ─────────────
test('piezas: los grupos son los del riel de escritorio, y ninguna pieza queda afuera', () => {
  // Desde el 16/10/2026 viven en app/offer/ayudas.ts: el teléfono y PiezasRail.tsx re-exportan el mismo objeto.
  assert.equal(GRUPOS_PIEZAS, GRUPOS_ESCRITORIO, 'el teléfono volvió a tener su copia de los grupos');
  assert.doesNotMatch(sinComentarios(leer('app/m/offer/modelo.ts')), /GRUPOS_PIEZAS[^=\n]*=\s*\[/, 'app/m/offer/modelo.ts volvió a escribir los grupos');
  const piezas = piezasEnGrupos({ cliente: { valor: 'Dueños', fuente: 'chat', at: '' }, precio: { valor: '900', fuente: 'negocio', at: '' } });
  assert.equal(piezas.flatMap((g) => g.piezas).length, PIEZAS.length);
  const de = (k: string) => piezas.flatMap((g) => g.piezas).find((p) => p.key === k)?.estado;
  assert.equal(de('cliente'), 'confirmada');
  assert.equal(de('precio'), 'negocio');
  assert.equal(de('problema'), 'vacia');
  const p = progresoDePiezas({ cliente: { valor: 'x', fuente: 'chat', at: '' }, problema: { valor: ' ', fuente: 'chat', at: '' } });
  assert.deepEqual(p, { sabidas: 1, total: PIEZAS.length, pct: Math.round(100 / PIEZAS.length) });
});

// ── 3. Las secciones de la oferta nueva son las de la Conclusión ─────────────
const LLENO: PropuestaOferta = {
  nombre: 'Programa Escala', frase: 'Llena tu agenda en 90 días',
  mensajes: { corto: 'c', largo: 'l', entrada: 'e' },
  paraQuien: { perfil: 'p', minimo: 'm', noEs: 'n' },
  problema: { hoy: 'h', despues: 'd', obstaculos: ['o1', ''], yaProbo: 'y' },
  mecanismo: { nombres: ['Método A'], pasos: ['p1', 'p2'], distinto: 'x' },
  ruta: [{ fase: 'Fase 1', objetivo: 'obj', hito: 'hito' }],
  incluye: [{ nombre: 'Llamadas', beneficio: 'b' }],
  formato: 'f', prueba: 'pr',
  garantia: { nombre: 'g', condiciones: 'c', plazo: 'p', siNoCumple: 's' },
  bonos: [{ nombre: 'Bono', objecion: 'o', valor: '[completar: valor]' }],
  inversion: { valorTotal: 'v', precio: 'p', contado: 'c', plan: 'pl', comoDecirlo: 'cd' },
  urgencia: 'u', escenarios: { mejor: 'm', peor: 'p' },
  ecuacion: [{ variable: 'tiempo', antes: '6 meses', despues: '90 días' }],
  numeros: ['n1'], validar: ['v1'], siguiente: 's', completar: [],
};

test('secciones: las mismas claves, títulos y rótulos que `seccionesDe` de escritorio, en el mismo orden', () => {
  const src = bloque(leer('app/offer/Conclusion.tsx'), 'function seccionesDe(', 'return s.filter(');
  const trozos = src.split(/\n\s*\{\n?\s*key: '/).slice(1);
  const escritorio = trozos.map((t) => {
    const key = t.slice(0, t.indexOf("'"));
    const titulo = /titulo: '([^']+)'/.exec(t)?.[1] ?? '';
    const etiquetas = [...t.matchAll(/etiqueta="([^"]+)"/g)].map((m) => m[1]);
    if (t.includes('Nombres propuestos')) etiquetas.unshift('Nombres propuestos');
    return { key, titulo, etiquetas };
  });
  assert.ok(escritorio.length >= 17, `leí ${escritorio.length} secciones de escritorio: el corte se rompió`);
  const movil = seccionesDeOferta(LLENO).map((s) => ({
    key: s.key, titulo: s.titulo,
    etiquetas: s.bloques.flatMap((b) => ('etiqueta' in b && b.etiqueta ? [b.etiqueta] : [])),
  }));
  assert.deepEqual(movil, escritorio);
  // Y los prefijos de los renglones (Hito, Ataca, Valor) son los de escritorio.
  for (const p of ['Hito: ', 'Ataca: ', 'Valor: ']) assert.ok(src.includes(p.trim()), p);
});

test('secciones: una vacía no se dibuja, los vacíos de una lista se caen y el «[completar]» llega intacto', () => {
  const s = seccionesDeOferta({ ...LLENO, urgencia: '  ', bonos: [], problema: { hoy: '', despues: '', obstaculos: ['', 'o2'], yaProbo: '' } });
  assert.equal(s.find((x) => x.key === 'urgencia'), undefined);
  assert.equal(s.find((x) => x.key === 'bonos'), undefined);
  assert.deepEqual(s.find((x) => x.key === 'problema')?.bloques, [{ t: 'lista', etiqueta: 'Lo que lo frena', items: ['o2'], numerada: false }]);
  const bonos = seccionesDeOferta(LLENO).find((x) => x.key === 'bonos');
  assert.deepEqual(bonos?.bloques, [{ t: 'items', numerada: false, items: [{ titulo: 'Bono', lineas: ['Ataca: o', 'Valor: [completar: valor]'] }] }]);
  assert.deepEqual(seccionesDeOferta(null), []);
});

// ── 4. El selector nombra lo mismo que el desplegable de escritorio ──────────
const res = (id: number, titulo: string, updatedAt: string, total: number | null = null) => ({ id, titulo, estado: 'conversando' as const, total, updatedAt });
const ARBOL: ArbolOffer = {
  funnels: [
    {
      id: 1, nombre: 'Llamada', sesionesNuevas: [res(30, '', '2026-10-10T10:00:00Z')],
      ofertas: [
        { id: 7, nombre: 'Escala', principal: false, sesiones: [res(10, 'Vieja', '2026-10-01T10:00:00Z'), res(11, 'Nueva', '2026-10-12T10:00:00Z', 64)] },
        { id: 8, nombre: 'Escala', principal: true, sesiones: [] },
      ],
    },
    { id: 2, nombre: 'Llamada', ofertas: [], sesionesNuevas: [] },
  ],
  sueltas: [res(40, 'De la v1', '2026-09-01T10:00:00Z')],
};

test('selector: los mismos títulos, el mismo orden y los mismos renglones que `seccionesDelArbol`', () => {
  const ICONOS = { funnel: 'f', oferta: 'o', conversacion: 'c', sueltas: 's' };
  const esc = seccionesDelArbol(ARBOL, ICONOS);
  const mov = seccionesDelSelector(ARBOL, 11);
  assert.deepEqual(mov.map((s) => s.titulo), esc.map((g) => g.title));
  const sinCrear = (os: Array<{ label: string; sub?: string; crear?: boolean }>) => os.filter((o) => !o.crear).map((o) => [o.label, o.sub ?? '']);
  for (let i = 0; i < esc.length; i++) {
    assert.deepEqual(mov[i].ofertas.map((o) => o.titulo), (esc[i].grupos ?? []).map((g) => g.title), `ofertas de ${esc[i].title}`);
    (esc[i].grupos ?? []).forEach((g, j) => assert.deepEqual(mov[i].ofertas[j].conversaciones.map((c) => [c.titulo, c.segunda]), sinCrear(g.options)));
    assert.deepEqual(mov[i].nuevas.map((c) => [c.titulo, c.segunda]), sinCrear(esc[i].options));
  }
  // La principal primero, la abierta marcada, y la sección «Sin funnel» sin salidas de crear.
  assert.equal(mov[0].ofertas[0].principal, true);
  assert.equal(mov[0].ofertas[1].conversaciones[0].abierta, true);
  assert.equal(mov[2].id, null);
  // 3 conversaciones + 2 «Analizar» + 1 «Nueva oferta» (funnel 1) · 1 «Nueva oferta» (funnel 2) · 1 suelta.
  assert.equal(renglonesDelSelector(mov), 8);
});

// ── 5. El chat ───────────────────────────────────────────────────────────────
const msg = (p: Partial<OfferMensaje>): OfferMensaje => ({ id: Math.random().toString(36), de: 'mako', texto: 't', at: '2026-10-15T10:00:00Z', ...p });

test('respuestas rápidas: del último de MaKo, con su índice ORIGINAL; la de armar sólo fuera del diagnóstico y si se puede', () => {
  const ultimo = msg({ opciones: ['Sí', ' ', 'Armar mi oferta'] });
  const s = { mensajes: [msg({ de: 'yo' }), ultimo], puedeConcluir: true };
  assert.deepEqual(opcionesRapidas(s, false, 'Armar mi oferta', 'Actualizar el PDF'), [{ t: 'Sí', idx: 0, armar: false, marcable: false }, { t: 'Armar mi oferta', idx: 2, armar: true, marcable: false }]);
  assert.equal(opcionesRapidas({ ...s, puedeConcluir: false }, false, 'Armar mi oferta', 'Actualizar el PDF')[1].armar, false);
  const pregunta = { mensajes: [msg({ opciones: ['Armar mi oferta'], pregunta: { tipo: 'diagnostico', id: 'p1' } })], puedeConcluir: true };
  assert.equal(opcionesRapidas(pregunta, false, 'Armar mi oferta', 'Actualizar el PDF')[0].armar, false);
  assert.deepEqual(opcionesRapidas(s, true, 'Armar mi oferta', 'Actualizar el PDF'), [], 'con un mensaje en vuelo no se contesta nada');
  assert.deepEqual(opcionesRapidas({ mensajes: [ultimo, msg({ de: 'yo' })], puedeConcluir: true }, false, 'Armar mi oferta', 'x'), []);
  assert.equal(sinContestar({ mensajes: [msg({}), msg({ de: 'yo' })] }, false), true);
  assert.equal(sinContestar({ mensajes: [msg({}), msg({ de: 'yo' })] }, true), false);
  assert.equal(sinContestar(null, false), false);
});

// Offer sumó `varias` el 16/10/2026 (la pregunta de las otras ofertas): en escritorio cada opción se marca y «Enviar (N)»
// las manda juntas; el teléfono no lo leía y cada toque mandaba UNA sola, o sea que «tengo un curso y una mentoría» no se
// podía contestar.
test('varias: cada opción se marca, salvo la de armar y la de «ninguna»; nunca en el diagnóstico ni con algo en vuelo', () => {
  const OPS = ['Un curso grabado', 'Una mentoría', 'No, sólo ésta', 'Armar mi oferta'];
  const marcables = (m: Partial<OfferMensaje>, pendiente = false) =>
    opcionesRapidas({ mensajes: [msg(m)], puedeConcluir: true }, pendiente, 'Armar mi oferta', 'Actualizar el PDF').map((o) => o.marcable);
  assert.deepEqual(marcables({ varias: true, opciones: OPS }), [true, true, false, false]);
  assert.deepEqual(marcables({ opciones: OPS }), [false, false, false, false], 'sin `varias`, cada opción sale con un toque');
  assert.deepEqual(marcables({ varias: true, opciones: OPS, pregunta: { tipo: 'diagnostico', id: 'p1' } }), [false, false, false, false],
    'en el diagnóstico la opción N es la respuesta N');
  assert.deepEqual(marcables({ varias: true, opciones: OPS }, true), []);
  // Lo marcado queda en el orden de las opciones (unirOpciones arma «A, b y c» con ese orden), no en el de los toques.
  assert.deepEqual(alternarMarcada([], 1), [1]);
  assert.deepEqual(alternarMarcada([1], 0), [0, 1]);
  assert.deepEqual(alternarMarcada([0, 1], 1), [0]);
});

test('varias en el hilo: la ayuda, las marcables con aria-pressed, y OfferM las manda juntas como escritorio', () => {
  const ops = (varias: boolean) => opcionesRapidas({ mensajes: [msg({ id: 'm1', opciones: ['Un curso grabado', 'Una mentoría', 'No, sólo ésta'], ...(varias ? { varias: true as const } : {}) })], puedeConcluir: false }, false, 'Armar mi oferta', 'x');
  const hilo = (varias: boolean) => renderToStaticMarkup(createElement(HiloOfferM, {
    sesionId: 1, mensajes: [msg({ id: 'm1' })], pendiente: null, respondiendo: false, fuente: '', opciones: ops(varias),
    opcionesHabilitadas: true, onOpcion: () => {}, onVarias: () => {}, onReintentar: null, onError: () => {},
  }));
  const con = hilo(true);
  assert.match(con, new RegExp(`class="m-offer-opciones__ayuda">${ROTULOS.marcarVarias}<`));
  assert.equal([...con.matchAll(/aria-pressed="false"/g)].length, 2, 'las dos ofertas se marcan; «No, sólo ésta» sale sola');
  assert.match(con, /<button[^>]*class="m-offer-opcion"[^>]*>No, sólo ésta</);
  assert.doesNotMatch(con, /aria-pressed="false"[^>]*>No, sólo ésta</);
  const sin = hilo(false);
  assert.doesNotMatch(sin, /aria-pressed|m-offer-opciones__ayuda/);
  const src = sinComentarios(leer(`${CARPETA}/OfferM.tsx`));
  const elegir = bloque(src, 'const elegirVarias = ', 'const abrirSesion = ');
  assert.match(elegir, /!ultimo\.varias \|\| !puedeMandar\) return;/);
  assert.match(elegir, /unirOpciones\(idxs\.map\(\(i\) => \(ultimo\.opciones \?\? \[\]\)\[i\] \?\? ''\)\)/, 'una sola respuesta, «A, b y c»');
  assert.match(elegir, /mandar\(\{ texto, docs: \[\], fuente: 'tu respuesta' \}\)/);
  assert.match(src, /onVarias=\{elegirVarias\}/);
  const hiloSrc = sinComentarios(leer(`${CARPETA}/HiloOfferM.tsx`));
  assert.match(hiloSrc, /onClick=\{\(\) => \{ onVarias\(marcadasAhora\); setMarcadas\(\{ de: '', idxs: \[\] \}\); \}\}/);
  assert.match(hiloSrc, /disabled=\{!opcionesHabilitadas\} onClick=\{\(\) => tocar\(o\)\}/, 'una opción marcable no se manda sola al tocarla');
  assert.match(hiloSrc, /if \(!o\.marcable\) \{ onOpcion\(o\.idx\); return; \}/);
  assert.match(hiloSrc, /marcadas\.de === ultimoId \? marcadas\.idxs : \[\]/, 'lo marcado es del mensaje: con el siguiente arranca vacío');
});

test('refrescar: nunca le cambia la conversación a nadie, y con algo en vuelo no toca nada', () => {
  const s = (id: number, updatedAt: string) => ({ id, updatedAt }) as OfferSesionVista;
  assert.equal(trasRefrescar({ abierta: null, llegada: s(1, '2026-10-15T10:00:00Z'), ocupado: false }), 'adoptar');
  assert.equal(trasRefrescar({ abierta: null, llegada: null, ocupado: false }), 'nada');
  assert.equal(trasRefrescar({ abierta: s(1, '2026-10-15T10:00:00Z'), llegada: s(1, '2026-10-15T11:00:00Z'), ocupado: false }), 'adoptar');
  assert.equal(trasRefrescar({ abierta: s(1, '2026-10-15T12:00:00Z'), llegada: s(1, '2026-10-15T11:00:00Z'), ocupado: false }), 'nada');
  assert.equal(trasRefrescar({ abierta: s(1, '2026-10-15T10:00:00Z'), llegada: s(2, '2026-10-15T11:00:00Z'), ocupado: false }), 'releer');
  assert.equal(trasRefrescar({ abierta: s(1, '2026-10-15T10:00:00Z'), llegada: null, ocupado: false }), 'releer');
  assert.equal(trasRefrescar({ abierta: s(1, '2026-10-15T10:00:00Z'), llegada: s(1, '2026-10-15T11:00:00Z'), ocupado: true }), 'nada');
});

test('la oferta: los pasos como Generando, las 9 dimensiones en el orden del marco y el héroe a la defensiva', () => {
  assert.deepEqual(estadoDePasos('diagnostico', true, null), { diagnostico: 'activo', oferta: 'pendiente' });
  assert.deepEqual(estadoDePasos('oferta', false, 'falló'), { diagnostico: 'hecho', oferta: 'fallo' });
  assert.deepEqual(estadoDePasos('listo', false, null), { diagnostico: 'hecho', oferta: 'hecho' });
  const filas = filasDimensiones({ dimensiones: [{ id: DIMENSIONES[2].id, nota: 8.4, porque: '', mejora: '' }] });
  assert.deepEqual(filas.map((f) => f.id), DIMENSIONES.map((d) => d.id));
  assert.deepEqual([filas[2].nota, filas[2].tono, filas[0].nota], [8, 'good', null]);
  const h = heroeDe({ propuesta: { ...LLENO, frase: '' }, calculo: { total: 140, cuello: 'D1', lista: false, alertas: [] } });
  assert.deepEqual([h.nombre, h.frase, h.total], [null, 'Programa Escala', 100]);
});

test('la conclusión se dibuja con lo que manda un modelo, también a medias (se lee a la defensiva)', () => {
  const c = {
    version: 2, at: '', modelo: '',
    diagnostico: { dimensiones: [{ id: DIMENSIONES[0].id, nota: 7, porque: '', mejora: '' }], tesis: 'La tesis', fuerte: 'Lo fuerte', cambios: [{ titulo: 'Subir el precio', porque: 'p', hipotesis: 'h' }] },
    calculo: { total: 64, cuello: DIMENSIONES[1].id, lista: false, alertas: ['Cierras el 170% de las llamadas', 'Ojo con el margen'], controlFinal: [{ punto: 'dolor', ok: false, porque: 'falta [completar]' }] },
    propuesta: LLENO,
  } as ConclusionOferta;
  const html = renderToStaticMarkup(createElement(ConclusionM, { conclusion: c }));
  assert.match(html, /Llena tu agenda en 90 días/);
  assert.match(html, /aria-label="Puntaje: 64 de 100"/);
  assert.match(html, /Le falta 1 cosa para venderla/);
  assert.match(html, /Qué falta para venderla/);
  assert.match(html, /class="m-offer-completar">Completar</, 'un «[completar]» es una pastilla, no texto que se copia');
  assert.doesNotMatch(html, /170%/, 'un aviso que afirma más de 100 % no se muestra (avisosAfirmables)');
  // «Probarlo» lleva la hipótesis a Experiments con la URL de escritorio (el desvío la abre en el teléfono).
  assert.match(html, /href="\/experimentos\?tab=experiments&amp;hipotesis=h">Probarlo</);
  const rota = { version: 1, diagnostico: null, calculo: {}, propuesta: null } as unknown as ConclusionOferta;
  assert.doesNotThrow(() => renderToStaticMarkup(createElement(ConclusionM, { conclusion: rota })));
  const gen = renderToStaticMarkup(createElement(GenerandoM, { gen: { paso: 'oferta', corriendo: false, error: 'Tardó más de 5 minutos.' } }));
  assert.match(gen, /role="alert"[^>]*>Tardó más de 5 minutos\.</);
  assert.match(gen, /data-estado="hecho"[\s\S]*data-estado="fallo"/);
});

// ── 6. El cableado (lo que no se ejecuta sin Next) ───────────────────────────
test('orquestación: las reglas de OfferApp que costaron una revisión siguen en OfferM', () => {
  const src = sinComentarios(leer(`${CARPETA}/OfferM.tsx`));
  const mandar = bloque(src, 'const mandar = async', 'const reintentarRespuesta');
  assert.match(mandar, /quedoGuardado\(r\.sesion\.mensajes, antes,/, 'un corte relee antes de devolver lo enviado');
  assert.match(mandar, /esRechazoDefinitivo\(err\.status\)\)\) return 'tirar';/);
  assert.match(mandar, /if \(err instanceof ErrorOfferApi && err\.sesion\) \{ aplicarSesion\(err\.sesion, e\); return 'salio'; \}/);
  assert.match(mandar, /let path = envio\.audio\.path;\n\s*if \(!path\) \{/, 'el reintento no vuelve a subir la nota');
  assert.match(mandar, /envio\.audio\.path = path;/);
  assert.match(mandar, /linksLeidos\.current\.get\(url\)/, 'un link se lee una vez por conversación');
  assert.match(src, /docsLeidos\.current/);
  const audio = bloque(src, 'const enviarAudio = async', 'const mandarAudio =');
  assert.match(audio, /if \(res === 'volver'\) \{ setAudioEnEspera\(a\); return; \}/);
  // La nota que SALIÓ queda en el mensaje (se reproduce desde ahí): sólo la que no va a salir se borra.
  assert.match(audio, /if \(res === 'tirar'\) descartarSubida\(a\.path\);/);
  assert.doesNotMatch(audio.replace(/if \(res === 'tirar'\) descartarSubida\(a\.path\);/, ''), /descartarSubida\(a\.path\)/);
  assert.match(bloque(src, 'const armar = async', 'const elegirOpcion'), /pasoTrasFalloDeOferta\(\{/);
  assert.match(src, /if \(e !== epoca\.current\) return/);
  // Las mismas acciones de escritorio: nada nuevo que gaste IA.
  const acciones = [...src.matchAll(/action: '([a-z-]+)'/g)].map((m) => m[1]);
  for (const a of acciones) assert.ok(['arbol', 'abrir', 'nueva', 'leer-link', 'turno', 'leer', 'descartar-subida', 'diagnosticar', 'generar', 'guardar-oferta'].includes(a), a);
});

// Escritorio (ChatOffer → ComposerWhatsApp en modo 'enviar') graba con la sesión de la casa: ✓ TERMINA, se
// escucha, y recién la flecha la manda (VoiceRecorder.tsx: «nada sale al soltar, en ningún lado»). El teléfono
// usaba `useVoiceRecorder`, que entrega el blob al parar: «Enviar audio» mandaba la nota sin escucharla, y
// quedaba guardada en la conversación y en el diagnóstico (revisión de la tanda 2, 16/10/2026).
test('la nota de voz: nada sale al soltar — ✓ termina, se escucha, y recién «Enviar audio» la manda', () => {
  const src = sinComentarios(leer(`${CARPETA}/ComposerOfferM.tsx`));
  assert.doesNotMatch(src, /useVoiceRecorder/, 'el grabador que entrega al parar manda la nota sin escucharla');
  assert.doesNotMatch(src, /\.stop\(/, 'parar el grabador a mano entrega el blob');
  assert.doesNotMatch(src, /onAudio\(/, 'onAudio sólo lo llama la sesión, desde su enviar');
  assert.match(src, /const voz = useGrabacionVoz\(onAudio, /);
  const grabando = bloque(src, '{grabando ? (', ') : revision ? (');
  assert.match(grabando, /onClick=\{\(\) => \{ haptico\('light'\); voz\.terminar\(\); \}\}/, 'el ✓ de la barra termina');
  const escuchar = bloque(src, ') : revision ? (', ') : audioEnEspera ? (');
  assert.match(escuchar, /<EscucharNota url=\{revision\.url\} secs=\{revision\.secs\} \/>/, 'antes de mandar se escucha');
  assert.match(escuchar, /onClick=\{\(\) => \{ void voz\.enviar\(\); \}\}>\{ROTULOS\.enviarAudio\}/);
  assert.equal([...src.matchAll(/voz\.enviar\(/g)].length, 1, 'la nota sale por UN solo botón: el de la fila de escuchar');
});

test('portal y página: la franja va a #m-pie, la página monta PantallaM con el guard de su key', () => {
  const src = sinComentarios(leer(`${CARPETA}/OfferM.tsx`));
  assert.match(src, /document\.getElementById\('m-pie'\)/);
  assert.match(src, /createPortal\(\n\s*<ComposerOfferM/, 'la franja (fixed) adentro de la página se correría al tirar para refrescar');
  assert.match(sinComentariosCss(leer(`${CARPETA}/offer.css`)), /\.m-offer-dock \{[^}]*position: fixed;[^}]*bottom: var\(--m-abajo\)/);
  const page = sinComentarios(leer(`${CARPETA}/page.tsx`));
  assert.ok(page.includes("requireMovil({ navKey: 'offer' })"));
  assert.match(page, /return \(\n\s*<PantallaM>/);
  assert.match(page, /import '\.\/offer\.css';/);
  assert.match(page, /import '\.\.\/mako\/mako\.css';/, 'la vista previa de adjuntos (VistaAdjuntosM) se dibuja con la hoja del chat de MaKo');
});

test('estilos: todo con el prefijo de la carpeta, sólo tokens que existen, y cada clase usada está definida', () => {
  const css = sinComentariosCss(leer(`${CARPETA}/offer.css`));
  // Los del shell (--m-abajo) viven en app/m/m.css; el resto, en globals.css.
  const globales = leer('app/globals.css') + leer('app/m/m.css');
  const clases = [...css.matchAll(/\.(-?[a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^\d/.test(c));
  const ajenas = [...new Set(clases.filter((c) => !c.startsWith('m-offer')))];
  assert.deepEqual(ajenas.sort(), ['m-pildora', 'm-shell'], 'una clase sin el prefijo de la carpeta la pisa otra pantalla');
  const tokens = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))];
  const sinDefinir = tokens.filter((t) => !new RegExp(`(?:^|[\\s;{])${t}\\s*:`, 'm').test(globales));
  assert.deepEqual(sinDefinir, []);
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,6}\b/, 'sin hex: tokens');
  assert.doesNotMatch(css, /100vh|transition:\s*all/);
  assert.match(css, /\.m-offer-campo \{[^}]*font-size: 16px/, 'con menos de 16 px iOS hace zoom al enfocar');
  const usadas = new Set(TSX.flatMap((f) => [...leer(f).matchAll(/m-offer-[\w-]+/g)].map((m) => m[0])));
  const definidas = new Set(clases);
  assert.deepEqual([...usadas].filter((c) => !definidas.has(c) && !c.endsWith('-')), []);
});

test('íconos y copy: nombres que existen en el set, sin voseo, sin emojis ni botones «Sí/No» a secas', () => {
  const set = leer('app/_components/icons.tsx');
  const paths = set.slice(set.indexOf('const PATHS'));
  const nombres = new Set([...paths.matchAll(/^\s{2}(?:'([^']+)'|([a-zA-Z0-9_]+)):\s/gm)].map((m) => m[1] || m[2]));
  const usados = new Set(TSX.flatMap((f) => [...leer(f).matchAll(/<Icon name=(?:"([^"]+)"|\{([^}]+)\})/g)]
    .flatMap((m) => (m[1] ? [m[1]] : [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])))));
  assert.ok(usados.size >= 10, `leí ${usados.size} íconos: el barrido se rompió`);
  assert.deepEqual([...usados].filter((n) => !nombres.has(n)), [], 'un ícono que no existe dibuja un punto');
  const todo = TSX.map((f) => sinComentarios(leer(f))).join('\n');
  // Sin `\b`: sin la bandera u, la «á» no es letra y `\btocá\b` no encuentra «tocá ».
  assert.doesNotMatch(todo, /(?<!\p{L})(tocá|mirá|tenés|podés|querés|elegí|escribí|probá|hacé|poné|decí|andá|sabés|grabá|mandá|subí|abrí)(?!\p{L})/iu, 'voseo');
  assert.doesNotMatch(todo, /\p{Extended_Pictographic}/u, 'un emoji como ícono');
  assert.doesNotMatch(todo, />\s*(Sí|No|Cancelar|Aceptar|OK)\s*</, 'un botón dice la acción y su objeto');
});
