// =============================================================================
// «TOCA AQUÍ» SIEMPRE MARCA DÓNDE, Y EL VIDEO DE SPY SIN LA ESPERA DE 6 S (20/11/2026, la llamada con Leila)
// =============================================================================
// Martín (Fathom 205366178):
//   · 00:32:37: «Siempre me lo tiene que marcar, porque si no, la persona no sabe dónde es aquí». Una frase que manda a tocar algo
//     que no está en la pantalla, y que nada abre, ya no se dice: el video salta a su t_fin en el silencio de antes de su voz
//     (app/_ui/tutorial/pausas.ts → `saltarSinMarca`). Y los cierres de Offer y de «Report a problem» traen su marca.
//   · 00:32:05: «se tardó bastante en saltarme el video del tutorial» (Competitor Spy). La primera vez esperaba hasta 6 s el lugar
//     del primer paso, que en Spy existe sólo con un competidor abierto (`arrancaLaPrimeraVez`).
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ANTES_DE_LA_VOZ_S, PAGINA_LISTA_MS, PIDE_TOCAR, TOPE_PRIMER_PASO_MS, arrancaLaPrimeraVez, fraseQueSuena, saltarSinMarca,
} from '../app/_ui/tutorial/pausas';
import type { FraseVideo } from '../lib/tutoriales/videos';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '');
type Manifiesto = { videos: { key: string; frases: (FraseVideo & { sel?: string | null })[] }[] };
const manifiesto = JSON.parse(fuente('public/tutoriales/manifiesto.json')) as Manifiesto;
const frasesDe = (key: string) => manifiesto.videos.find((v) => v.key === key)!.frases.map((f) => ({ ...f, sel: f.sel ?? null, espera_clic: !!f.espera_clic, cierra_despues: !!f.cierra_despues }));

test('la frase que suena: en el silencio de antes de su voz o mientras suena; nunca una que todavía no llegó', () => {
  const fr = frasesDe('spy');
  const spy3 = fr.find((f) => f.id === 'spy-3')!;
  assert.equal(fraseQueSuena(fr, spy3.t_inicio - ANTES_DE_LA_VOZ_S - 0.01, new Set())?.id, 'spy-2', 'todavía suena la bienvenida');
  assert.equal(fraseQueSuena(fr, spy3.t_inicio - 0.2, new Set())?.id, 'spy-3', 'en el silencio de antes de su voz');
  assert.equal(fraseQueSuena(fr, spy3.t_inicio + 0.1, new Set())?.id, 'spy-3');
  assert.equal(fraseQueSuena(fr, spy3.t_inicio, new Set(['spy-3']))?.id ?? null, null, 'lo hecho no vuelve');
});

test('saltarSinMarca: sólo una frase que manda a tocar, sin su marca, sin nada que la abra y con la página quieta', () => {
  const toca = { id: 'x', t_inicio: 1, t_fin: 2, texto: 'Toca aquí, en Anuncios, y mira los que tiene activos.', sel: 's', espera_clic: true, cierra_despues: false };
  const mira = { ...toca, texto: 'Mira aquí, el chat: contestas, y tu oferta se completa sola.' };
  assert.equal(saltarSinMarca(toca, { marca: false, abre: false, cargando: false }), true);
  assert.equal(saltarSinMarca(toca, { marca: true, abre: false, cargando: false }), false, 'con su marca, se dice y se marca');
  assert.equal(saltarSinMarca(toca, { marca: false, abre: true, cargando: false }), false, 'lo que la abre (`antes`, la barra) va a tiempo');
  assert.equal(saltarSinMarca(toca, { marca: false, abre: false, cargando: true }), false, 'cargando, la marca puede llegar mientras suena');
  assert.equal(saltarSinMarca(mira, { marca: false, abre: false, cargando: false }), false, 'una «Mira aquí» no manda a tocar');
  assert.ok(PIDE_TOCAR.test('Pruébalo ya: toca aquí, en una pieza') && PIDE_TOCAR.test('Para ir a fondo, toca aquí, en Analicemos mi oferta'));
});

test('Competitor Spy sin competidores no dice ningún «toca aquí»; con uno a mano (lo abre el motor), sí', () => {
  const fr = frasesDe('spy');
  const tocas = fr.filter((f) => PIDE_TOCAR.test(f.texto));
  assert.deepEqual(tocas.map((f) => f.id), ['spy-3', 'spy-4', 'spy-5']);
  // 0 competidores: ni las pestañas, ni la grilla, ni una tarjeta que abrir.
  for (const f of tocas) assert.equal(saltarSinMarca(f, { marca: false, abre: false, cargando: false }), true, `${f.id} se diría sin recuadro`);
  // Con 2 o más: la tarjeta del primero está (el `antes` de spy-3), el motor lo abre mientras suena.
  assert.equal(saltarSinMarca(tocas[0], { marca: false, abre: true, cargando: false }), false);
});

test('toda frase del manifiesto que dice «toca aquí» trae su marca (los cierres de Offer y de «Report a problem» incluidos)', () => {
  const sinMarca = manifiesto.videos.flatMap((v) => v.frases).filter((f) => PIDE_TOCAR.test(f.texto ?? '') && !f.sel).map((f) => f.id);
  assert.deepEqual(sinMarca, [], 'una frase «toca aquí» sin `sel` suena sin recuadro');
  const fr = manifiesto.videos.flatMap((v) => v.frases);
  assert.equal(fr.find((f) => f.id === 'offer-5')?.sel, '[aria-label="Respuestas rápidas"] button', 'la de su paso (lib/tutoriales/offer.ts)');
  assert.equal(fr.find((f) => f.id === 'report-problem-5')?.sel, '[data-tarjeta="ticket"] button.co-chip--primario', 'la de su paso (lib/tutoriales/reportar.ts)');
  assert.ok(fuente('lib/tutoriales/offer.ts').includes("sel: '[aria-label=\"Respuestas rápidas\"] button',"));
  assert.ok(fuente('lib/tutoriales/reportar.ts').includes("sel: '[data-tarjeta=\"ticket\"] button.co-chip--primario',"));
  // La fuente del manifiesto (scripts/tutorial-animado/hacer.mjs pone `sel` desde guiones.json): al regenerarlo no se pierde.
  const g = fuente('scripts/tutorial-animado/guiones.json');
  assert.ok(g.includes('"dice": "Para ir a fondo, toca aquí, en Analicemos mi oferta: te marca qué falta y la mejora, en PDF.",\n    "sel": "[aria-label=\\"Respuestas rápidas\\"] button",'));
  assert.ok(g.includes('"dice": "Cuando esté claro, toca aquí, en Mandárselo al equipo: si te preguntan algo, verás Espera tu respuesta.",\n    "sel": "[data-tarjeta=\\"ticket\\"] button.co-chip--primario",'));
});

test('el video de una pestaña arranca sin la espera de 6 s: con su lugar, con lo que lo abre o con la página quieta', () => {
  assert.equal(arrancaLaPrimeraVez({ marca: false, abre: false, cargando: false, pasadoMs: PAGINA_LISTA_MS }), true, 'Spy sin competidores');
  assert.equal(arrancaLaPrimeraVez({ marca: false, abre: true, cargando: false, pasadoMs: 0 }), true, 'Spy con competidores: la tarjeta');
  assert.equal(arrancaLaPrimeraVez({ marca: true, abre: false, cargando: true, pasadoMs: 0 }), true);
  assert.equal(arrancaLaPrimeraVez({ marca: false, abre: false, cargando: true, pasadoMs: 3000 }), false, 'cargando, espera');
  assert.equal(arrancaLaPrimeraVez({ marca: false, abre: false, cargando: false, pasadoMs: PAGINA_LISTA_MS - 1 }), false);
  assert.equal(arrancaLaPrimeraVez({ marca: false, abre: false, cargando: true, pasadoMs: TOPE_PRIMER_PASO_MS }), true, 'el tope de siempre');
  assert.ok(PAGINA_LISTA_MS < TOPE_PRIMER_PASO_MS / 4);
});

test('el motor: salta la frase en el silencio de antes de su voz, y la primera vez arranca con `arrancaLaPrimeraVez`', () => {
  const m = sinComentarios(fuente('app/_ui/tutorial/MotorTutorial.tsx'));
  const salto = m.indexOf('const q = fraseQueSuena(frases, t, hechas.current);');
  assert.ok(salto > 0 && salto < m.indexOf('const f = fraseParaMarcar(frases, t, hechas.current);'), 'antes de marcar la frase');
  assert.ok(m.includes('if (saltarSinMarca(q, { marca: !!pq && !!lugarDe(pq.sel), abre, cargando: cargandoAhora() })) { hechas.current.add(q.id); v.currentTime = q.t_fin; return; }'));
  assert.ok(m.includes("const abre = !!pq && (presentaLaBarra(pq.sel) || (typeof antes === 'string' ? !!lugarDe(antes) : !!antes?.some((s) => !!lugarDe(s))));"), 'la barra que se presenta y el `antes` (o un eslabón de su cadena) la abren');
  assert.ok(m.includes('if (arrancaLaPrimeraVez({ marca: !!lugarDe(p0.sel), abre: abre0, cargando: cargandoAhora(), pasadoMs: Date.now() - desde })) {'));
  assert.doesNotMatch(m, /Date\.now\(\) - desde > 6000/, 'volvió la espera fija de 6 s');
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 6/0; al restaurar, 6/0). Cada rotura, de a una:
//   - el regex con `\b` (no ve el borde de la «í») → 4/2
//   - salta aunque la página esté cargando → 5/1; salta aunque `antes` la abra → 4/2
//   - mira frases que todavía no llegaron → 5/1
//   - el motor no salta (no mueve el video) → 5/1; la barra que se presenta no cuenta como que la abre → 5/1
//   - offer-5 sin su marca en el manifiesto → 5/1; el guion de report-problem-5 sin su marca → 5/1
//   - arranca aunque la página esté cargando → 5/1; vuelve la espera fija de 6 s → 5/1
