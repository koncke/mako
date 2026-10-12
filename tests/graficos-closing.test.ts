// =============================================================================
// Closing COMPLETO en el Dashboard (decisión 6 de Martín, 11/10/2026): la lista, la ficha y sus tareas
// =============================================================================
// Lo que fija:
//   · El modelo de la hoja (app/dashboard/bloques/extra/llamadas-modelo.ts): cómo se nombra una llamada, el
//     reproductor de Fathom y el salto al segundo (con lo que entra en una URL), lo que avisa la ficha de una
//     llamada que no es una venta analizada, la búsqueda y el orden de la lista, las marcas del transcript, el
//     puntaje que se recalcula al revisar (la MISMA cuenta que `reviseAnalysis`), lo que sale por
//     GET /api/closing/llamada (`fichaDe`), y que una tarea vencida NO se afirma fallida.
//   · La puerta de las rutas de Closing: admin o closer, con el Dashboard en la capa (un setter no gasta IA),
//     y que la usan las cinco rutas —y NO analizar-lead, que es del CRM—.
//   · Que cada pedido de la pantalla lleve `signal`, y que su tope supere el `maxDuration` de su ruta.
//   · El bloque «Las llamadas» registrado (catálogo, lectura, dibujo, con personas) y en la plantilla, abajo;
//     el KPI «Analizadas»; los ejemplos de Factores abren la ficha; la API de MaKo linkea a la hoja.
//   · Sin voseo en los archivos nuevos (el guard del repo no ve lo que no tiene `git add`).
// Correr: npx tsx --test tests/graficos-closing.test.ts
//
// PROBADO ROMPIÉNDOLO (11/10/2026, P2a): una rotura por vez sobre la base en verde (19/19), con un arnés que
// restaura DE MEMORIA y compara byte a byte; cada una dio 1 fallo y 18 pases, en el test que la persigue:
//   · `nombreDeLlamada` con el título primero                              → «una llamada se nombra…»
//   · el token de Fathom aceptando cualquier cosa (`/^.+$/`)              → «el reproductor…»
//   · el embed sin `autoplay=1`                                            → «el reproductor…»
//   · el token sin pasar por `embedDe` (no reconoce un link /embed/)       → «el reproductor…»
//   · la miniatura de un token y el iframe de otro                         → «el reproductor…»
//   · `linkAlSegundo` sin `esLinkHttp` (abría `javascript:`)               → «▶ mm:ss…»
//   · `estadoDeLlamada` sin la rama de `error`                             → «la ficha avisa…»
//   · la búsqueda sin `sinAcentos` en lo buscado                           → «la lista…»
//   · el orden por fecha sin el desempate por id                           → «la lista…» ⚠️ La primera rotura de
//     ese orden (sacar «sin fecha al final») dio 0 fallos: `localeCompare` ya manda '' al final en orden
//     descendente. No era un test flojo, era una rotura que no rompía; se cambió por el desempate.
//   · las marcas del transcript a 60 s en vez de 30                        → «las marcas del análisis…»
//   · `puntajeEnVivo` sin redondear a un decimal                           → «el puntaje que va quedando…»
//   · `fichaDe` copiando todas las columnas                                → «GET /api/closing/llamada…»
//   · `postearTarea` diciendo «No se pudo» al vencer el tope               → «una tarea…»
//   · la puerta en NEGATIVO (`rol === 'setter'`)                           → «la puerta…»
//   · /api/closing/sync leyendo el cuerpo ANTES de la puerta               → «las cinco rutas…»
//   · revise volviendo a usar `body.autor`                                 → «las cinco rutas…»
//   · `TOPE_MS.analizar` en 100 s (la ruta corta a 120)                    → «cada pedido… lleva signal…»
//   · el fetch del transcript sin `signal`                                 → «cada pedido… lleva signal…»
//   · sin `case 'llamadas_cierre'` en datosDeBloquesExtra                  → «"Las llamadas" es un bloque…»
//   · `llamadas_cierre` fuera de BLOQUES_CON_PERSONAS                      → «"Las llamadas" es un bloque…»
//   · BloqueFactores con un `onRefrescar` que no refresca                  → «"Las llamadas" es un bloque…»
//   · la plantilla sin el bloque `cl-llamadas`                             → «la plantilla Closing…»
//   · un ejemplo de Factores que no abre la ficha                          → «los ejemplos de Factores…»
//   · `llamadas_venta.llamada` fuera de DIMENSIONES_PERSONA                → «la llamada de venta es una persona…»
//   · `llamadas_venta` sin la dimensión `llamada`                          → «la llamada de venta es una persona…»
//   · el conjunto `llamadas` sin el `estado`                               → «el conjunto de TODAS las llamadas…»
//   · `linkLlamada` de vuelta a /closing?call=                             → «la API de MaKo linkea…»
//   · «Revisá a mano» en la ficha                                          → «sin voseo…»

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAMPOS_FICHA, FILTRO_INICIAL, TOPE_MS, estadoDeLlamada, fichaDe, filtrarLlamadas, linkAlSegundo, marcasDeTranscript, nombreDeLlamada,
  postearTarea, puntajeEnVivo, reproductorFathom, textoDeSync, tokenFathom,
} from '../app/dashboard/bloques/extra/llamadas-modelo';
import { reglaDePuerta } from '../app/api/closing/puerta-regla';
import { BLOQUES_CON_PERSONAS, BLOQUES_EXTRA, type FilaLlamada } from '../lib/graficos-bloques-extra-catalogo';
import { PLANTILLAS_ANALYSTS } from '../lib/graficos-plantillas-analysts';
import { DIMENSIONES_PERSONA } from '../lib/graficos-acciones';
import { dimensionPublica } from '../lib/graficos-analisis';
import { fuenteDe, sanearHoja } from '../lib/graficos-catalogo';
import { marcasDeVoseo } from '../lib/puestas-data';
import type { ClosingAnalysisRow } from '../lib/closing';

const RAIZ = join(__dirname, '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después: un `/*` dentro de un comentario de línea se comería el código.
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── El modelo ────────────────────────────────────────────────────────────────────────────

test('una llamada se nombra como en la tab: el lead, si no el email del invitado, si no el título', () => {
  assert.equal(nombreDeLlamada({ lead_nombre: '  Ana Ruiz ', invitee_email: 'ana@x.com', title: 'Junta' }), 'Ana Ruiz');
  assert.equal(nombreDeLlamada({ lead_nombre: ' ', invitee_email: 'ana@x.com', title: 'Junta' }), 'ana@x.com');
  assert.equal(nombreDeLlamada({ lead_nombre: null, invitee_email: null, title: 'x'.repeat(120) }), 'x'.repeat(80), 'el título va recortado');
  assert.equal(nombreDeLlamada({}), null);
});

test('el reproductor: el embed de Fathom con autoplay y la miniatura, y sólo un token que entra limpio en una URL', () => {
  assert.deepEqual(reproductorFathom(null, 'abc123XYZ'), { src: 'https://fathom.video/embed/abc123XYZ?autoplay=1', miniatura: 'https://fathom.video/share/abc123XYZ/thumbnail' });
  // Sin token guardado, el del link de Compartir (con su query y todo).
  assert.equal(tokenFathom('https://fathom.video/share/tok_en-99?tab=summary', null), 'tok_en-99');
  assert.equal(reproductorFathom('https://fathom.video/share/tok_en-99', null)?.miniatura, 'https://fathom.video/share/tok_en-99/thumbnail');
  // Lo que no es un token no entra en la URL del iframe.
  assert.equal(tokenFathom(null, 'a"><script>'), null);
  assert.equal(tokenFathom('https://fathom.video/share/..%2F..%2Fx', null), null);
  assert.equal(reproductorFathom(null, 'a b c d'), null);
  assert.equal(reproductorFathom(null, null), null, 'sin grabación no hay reproductor');
  // El link lo reconoce `embedDe` (lib/embeds.ts): también un /embed/, que el token guardado no trae.
  assert.equal(reproductorFathom('https://fathom.video/embed/Qq77_k', null)?.src, 'https://fathom.video/embed/Qq77_k?autoplay=1');
  // La foto y el video, del MISMO token aunque el guardado no coincida con el link.
  const r = reproductorFathom('https://fathom.video/share/AAAA1', 'BBBB2')!;
  assert.equal(/embed\/([^?]+)/.exec(r.src)?.[1], /share\/([^/]+)\/thumbnail/.exec(r.miniatura)?.[1], 'la miniatura y el iframe son de grabaciones distintas');
});

test('▶ mm:ss abre la grabación en Fathom en ese segundo; un link que no es http no se abre', () => {
  assert.equal(linkAlSegundo('https://fathom.video/share/T', 95.6), 'https://fathom.video/share/T?timestamp=96');
  assert.equal(linkAlSegundo('https://fathom.video/share/T?timestamp=3', 10), 'https://fathom.video/share/T?timestamp=10', 'se reemplaza, no se duplica');
  assert.equal(linkAlSegundo('https://fathom.video/share/T', -4), 'https://fathom.video/share/T?timestamp=0');
  assert.equal(linkAlSegundo('javascript:alert(1)', 5), null);
  assert.equal(linkAlSegundo(null, 5), null);
});

test('la ficha avisa lo que NO es una venta analizada (la abre también el conjunto de todas las llamadas)', () => {
  const base = { category: 'venta' as const, status: 'analizada' as const, error: null, has_transcript: true };
  assert.equal(estadoDeLlamada(base), null);
  assert.deepEqual(estadoDeLlamada({ ...base, status: 'error', error: 'Your credit balance is too low' }), { tono: 'bad', texto: 'No se pudo analizar', detalle: 'Your credit balance is too low' });
  assert.equal(estadoDeLlamada({ ...base, status: 'error', error: 'x'.repeat(500) })!.detalle!.length, 201, 'el motivo va recortado');
  assert.equal(estadoDeLlamada({ ...base, status: 'pendiente' })!.texto, 'Sin transcript: se reintenta al sincronizar');
  assert.equal(estadoDeLlamada({ ...base, category: 'interna', status: 'descartada' })!.texto, 'Llamada interna: no se analiza');
  assert.equal(estadoDeLlamada({ ...base, has_transcript: false })!.texto, 'Sin transcript');
});

const fila = (o: Partial<FilaLlamada> & { id: number }): FilaLlamada => ({
  fecha: '2026-10-01', tipo: 'R1', closer: 'Ana', nombre: 'Lead', empresa: null, email: null, titulo: null, puntaje: 5, tono: 'warn', minutos: 30, conTranscript: true, ...o,
});

test('la lista: busca sin acentos en lead, empresa, título y email; filtra; y ordena con lo que no tiene número al final', () => {
  const xs = [
    fila({ id: 1, nombre: 'José Pérez', fecha: '2026-10-03', puntaje: 8, minutos: 20, tipo: 'R2', tono: 'good' }),
    fila({ id: 2, nombre: 'Marta', empresa: 'Acme', fecha: null, puntaje: null, minutos: null }),
    fila({ id: 3, nombre: 'Luis', email: 'luis@perez.com', fecha: '2026-10-03', puntaje: 6, minutos: 50, closer: 'Beto', tono: 'bad' }),
    fila({ id: 4, nombre: 'Sol', titulo: 'Junta con Pérez', fecha: '2026-10-05', puntaje: 9, minutos: 40 }),
  ];
  const ids = (f: Partial<typeof FILTRO_INICIAL>) => filtrarLlamadas(xs, { ...FILTRO_INICIAL, ...f }).map((x) => x.id);
  assert.deepEqual(ids({}), [4, 3, 1, 2], 'fecha: lo más nuevo primero, el empate por id, sin fecha al final');
  assert.deepEqual(ids({ q: 'perez' }), [4, 3, 1], 'el nombre, el email y el título, sin acentos');
  assert.deepEqual(ids({ q: 'ACME' }), [2], 'la empresa');
  assert.deepEqual(ids({ tipo: 'R2' }), [1]);
  assert.deepEqual(ids({ closer: 'Beto' }), [3]);
  assert.deepEqual(ids({ tono: 'good' }), [1]);
  assert.deepEqual(ids({ orden: 'puntaje' }), [4, 1, 3, 2], 'sin puntaje al final');
  assert.deepEqual(ids({ orden: 'duracion' }), [3, 4, 1, 2], 'sin duración al final');
  assert.equal(xs[0].id, 1, 'no ordena la lista que recibe');
});

test('las marcas del análisis van a la línea más cercana, a 30 s o menos', () => {
  const lineas = [0, 40, 100].map((t) => ({ t_seconds: t, speaker: 'A', text: 'hola' }));
  const m = marcasDeTranscript(lineas, [
    { t_seconds: 35, tone: 'good', label: 'Buena' },
    { t_seconds: 160, tone: 'bad', label: 'Lejos' },
    { t_seconds: 95, tone: 'good', label: 'Primera' },
    { t_seconds: 104, tone: 'bad', label: 'Segunda' },
  ]);
  assert.deepEqual([...m.entries()], [[1, { tone: 'good', label: 'Buena' }], [2, { tone: 'bad', label: 'Segunda' }]], 'a 60 s no marca; dos en la misma línea: la última');
  assert.equal(marcasDeTranscript(lineas, null).size, 0);
});

test('el puntaje que va quedando al revisar es el promedio de las dimensiones con un decimal (la cuenta de reviseAnalysis)', () => {
  const dims = [{ label: 'A', score: 7 }, { label: 'B', score: 8 }, { label: 'C', score: 6.5 }];
  assert.equal(puntajeEnVivo(dims, {}, 3), 7.2);
  assert.equal(puntajeEnVivo(dims, { C: 9 }, 3), 8);
  assert.equal(puntajeEnVivo([], {}, 6.4), 6.4, 'sin dimensiones queda el que había');
});

test('GET /api/closing/llamada manda SÓLO lo que la ficha dibuja', () => {
  const fila = Object.fromEntries([...CAMPOS_FICHA.map((k) => [k, null]), ['model', 'claude-opus'], ['call_url', 'https://fathom.video/calls/9'], ['analyzed_at', 'x'], ['transcript_items', 99]]) as unknown as ClosingAnalysisRow;
  const f = fichaDe({ ...fila, recording_id: 9 });
  assert.deepEqual(Object.keys(f).sort(), [...CAMPOS_FICHA].sort());
  assert.equal((f as unknown as Record<string, unknown>).model, undefined);
  assert.equal(f.recording_id, 9);
});

test('una tarea: el motivo del server tal cual, y una vencida NO se afirma fallida', async () => {
  const fetchViejo = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, ventas: 3, servicio: 1, restantes: 2 }))) as typeof fetch;
    const ok = await postearTarea('/api/closing/sync', {}, 1000);
    assert.ok(ok.ok);
    assert.equal(textoDeSync(ok.ok ? ok.j : {}), '3 de venta · 1 de servicio · quedan 2');
    assert.equal(textoDeSync({ ventas: 0, servicio: 0, restantes: 0 }), '0 de venta · 0 de servicio');
    globalThis.fetch = (async () => new Response(JSON.stringify({ ok: false, error: 'Sólo el admin de la cuenta o un closer' }), { status: 403 })) as typeof fetch;
    assert.deepEqual(await postearTarea('/x', {}, 1000), { ok: false, error: 'Sólo el admin de la cuenta o un closer' });
    globalThis.fetch = (async () => new Response('<html>', { status: 504 })) as typeof fetch;
    assert.deepEqual(await postearTarea('/x', {}, 1000), { ok: false, error: 'No se pudo (error 504)' });
    globalThis.fetch = (async () => { throw new DOMException('se venció', 'TimeoutError'); }) as typeof fetch;
    const vencida = await postearTarea('/x', {}, 1000);
    assert.ok(!vencida.ok && /Puede que haya terminado igual/.test(vencida.error), 'vencido el tope, el server puede haber terminado');
  } finally {
    globalThis.fetch = fetchViejo;
  }
});

// ── La puerta de las rutas ───────────────────────────────────────────────────────────────

test('la puerta: entran el admin y el closer, con el Dashboard en la capa; un setter no gasta IA', () => {
  assert.equal(reglaDePuerta('admin', true, true), null);
  assert.equal(reglaDePuerta('closer', true, true), null);
  assert.equal(reglaDePuerta('closer', true, null), null, 'una ruta que no exige Fathom (el transcript) no lo mira');
  assert.equal(reglaDePuerta('setter', true, true)?.status, 403);
  assert.equal(reglaDePuerta('otro_rol', true, true)?.status, 403, 'en positivo: un rol nuevo no entra por olvido');
  assert.equal(reglaDePuerta(null, true, true)?.status, 401);
  assert.equal(reglaDePuerta('admin', false, true)?.status, 404, 'sin la tab Dashboard, la pantalla no existe');
  assert.deepEqual(reglaDePuerta('admin', true, false), { status: 403, error: 'Conecta Fathom en Integraciones' });
});

const RUTAS = ['llamada', 'sync', 'analyze', 'revise', 'transcript'] as const;

test('las cinco rutas de Closing pasan por la puerta ANTES de hacer nada; analizar-lead (del CRM) no', () => {
  for (const r of RUTAS) {
    const src = sinComentarios(leer(`app/api/closing/${r}/route.ts`));
    const handler = src.indexOf('export async function ');
    const puerta = src.indexOf('const cerrada = await puertaClosing(', handler);
    assert.ok(handler > 0 && puerta > handler, `${r}: no pasa por la puerta`);
    const antes = src.slice(handler, puerta);
    assert.ok(!/await /.test(antes), `${r}: hace algo antes de la puerta`);
    assert.match(src.slice(puerta, puerta + 120), /if \(cerrada\) return cerrada;/, `${r}: la puerta no corta`);
    assert.match(src, r === 'transcript' ? /puertaClosing\(\{ fathom: false \}\)/ : /puertaClosing\(\{ fathom: true \}\)/, `${r}: la exigencia de Fathom`);
  }
  assert.doesNotMatch(leer('app/api/closing/analizar-lead/route.ts'), /puertaClosing/, 'analizar-lead es del CRM: tiene su propia regla');
  // El autor del historial lo pone el server con la sesión: el del cuerpo lo escribiría cualquiera.
  const revise = sinComentarios(leer('app/api/closing/revise/route.ts'));
  assert.doesNotMatch(revise, /body\.autor/);
  assert.match(revise, /getUsuarioActual\(\)/);
});

test('cada pedido de la ficha y de la lista lleva `signal`, y su tope supera el maxDuration de su ruta', () => {
  const ruta: Record<keyof typeof TOPE_MS, string> = { llamada: 'llamada', transcript: 'transcript', analizar: 'analyze', revisar: 'revise', sincronizar: 'sync' };
  for (const [k, r] of Object.entries(ruta) as Array<[keyof typeof TOPE_MS, string]>) {
    const m = /export const maxDuration = (\d+);/.exec(leer(`app/api/closing/${r}/route.ts`));
    assert.ok(m, `${r}: sin maxDuration`);
    assert.ok(TOPE_MS[k] > Number(m![1]) * 1000, `${k}: ${TOPE_MS[k]} ms no supera los ${m![1]} s de la ruta`);
  }
  // Cada `fetch(` hasta SU paréntesis de cierre (no un número de caracteres): adentro tiene que estar el signal.
  for (const archivo of ['app/dashboard/bloques/extra/FichaLlamada.tsx', 'app/dashboard/bloques/extra/BloquesClosing.tsx', 'app/dashboard/bloques/extra/llamadas-modelo.ts']) {
    const src = sinComentarios(leer(archivo));
    let i = src.indexOf('fetch(');
    while (i >= 0) {
      let prof = 0;
      let j = i + 'fetch'.length;
      for (; j < src.length; j++) {
        if (src[j] === '(') prof++;
        else if (src[j] === ')' && --prof === 0) break;
      }
      const llamado = src.slice(i, j + 1);
      assert.match(llamado, /signal: /, `${archivo}: un fetch sin signal: ${llamado.slice(0, 80)}`);
      i = src.indexOf('fetch(', j);
    }
  }
});

// ── El bloque, la plantilla y los caminos a la ficha ─────────────────────────────────────

test('«Las llamadas» es un bloque de Closing: catálogo, lectura con la MISMA memo, dibujo con refresco, con personas', () => {
  const b = BLOQUES_EXTRA.find((x) => x.id === 'llamadas_cierre');
  assert.ok(b, 'no está en BLOQUES_EXTRA');
  assert.deepEqual([b!.w, b!.h], [12, 18]);
  assert.ok(BLOQUES_CON_PERSONAS.includes('llamadas_cierre'), 'trae nombres y emails: va en BLOQUES_CON_PERSONAS');
  const datos = sinComentarios(leer('lib/graficos-bloques-extra.ts'));
  assert.match(datos, /case 'llamadas_cierre': return llamadasCierre\(p, una\);/);
  assert.match(datos, /async function vistaClosing\(una: Una\) \{\n {2}await exigirFathom\(\);\n {2}return una\('closing', \(\) => getClosingViewData\(\)\);/);
  const ini = datos.indexOf('async function llamadasCierre(');
  const cuerpo = datos.slice(ini, datos.indexOf('\n}\n', ini));
  assert.match(cuerpo, /await vistaClosing\(una\)/, 'una sola lectura para los cuatro bloques');
  assert.match(cuerpo, /enVentana\(vista\.calls, p\.desde, p\.hasta\)/, 'la lista es del período de la hoja');
  assert.match(cuerpo, /conTranscript: c\.has_transcript !== false/);
  const dibujo = sinComentarios(leer('app/dashboard/bloques/extra/CuerpoBloqueExtra.tsx'));
  assert.match(dibujo, /<BloqueLlamadas d=\{d as DatosLlamadas\} onRefrescar=\{onRefrescar\} \/>/);
  assert.match(dibujo, /<BloqueFactores d=\{d as DatosFactores\} onRefrescar=\{onRefrescar\} \/>/);
});

test('la plantilla Closing: el KPI «Analizadas» arriba y «Las llamadas» abajo de todo, a lo ancho', () => {
  const h = sanearHoja(PLANTILLAS_ANALYSTS.find((p) => p.id === 'closing')!.armar((l) => l), 0)!;
  const analizadas = h.componentes.find((c) => c.id === 'cl-analizadas') as Record<string, unknown> | undefined;
  assert.ok(analizadas, 'falta el KPI «Analizadas»');
  assert.equal(analizadas!.fuente, 'llamadas_venta');
  assert.deepEqual(analizadas!.metricas, ['llamadas']);
  assert.equal(analizadas!.y, 0);
  const lista = h.componentes.find((c) => c.id === 'cl-llamadas') as Record<string, unknown> | undefined;
  assert.ok(lista && lista.bloque === 'llamadas_cierre', 'falta «Las llamadas»');
  assert.equal(lista!.w, 12);
  const fondo = Math.max(...h.componentes.map((c) => c.y + c.h));
  assert.equal((lista!.y as number) + (lista!.h as number), fondo, '«Las llamadas» va abajo de todo');
});

test('los ejemplos de Factores y cada fila de la lista abren la ficha (ninguno vuelve a la tab retirada)', () => {
  const src = sinComentarios(leer('app/dashboard/bloques/extra/BloquesClosing.tsx'));
  assert.doesNotMatch(src, /['"`]\/closing/, 'un link a la tab /closing, que se eliminó');
  assert.equal((src.match(/onAbrir=\{setFicha\}/g) ?? []).length, 2, 'los ejemplos de Factores, donde brilló y donde faltó');
  assert.match(src, /onClick=\{\(\) => setFicha\(c\.id\)\}/, 'las filas de la lista');
  assert.equal((src.match(/<FichaLlamada recordingId=\{ficha\} onCerrar=\{\(\) => setFicha\(null\)\} onCambio=\{onRefrescar\} \/>/g) ?? []).length, 2, 'las dos fichas refrescan la hoja después de una tarea');
});

test('el conjunto de TODAS las llamadas trae el estado del análisis, en palabras', () => {
  const src = sinComentarios(leer('lib/graficos-datos.ts'));
  const ini = src.indexOf('async function filasLlamadas(');
  const cuerpo = src.slice(ini, src.indexOf('\n}\n', ini));
  assert.ok(ini > 0 && cuerpo.length > 300 && cuerpo.length < 2500, `el recorte de filasLlamadas mide ${cuerpo.length}`);
  assert.match(cuerpo, /'recording_id, call_date, duration_min, closer, category, status,/, 'no lee el estado');
  assert.match(cuerpo, /estado: ESTADO_LLAMADA\[x\.status \?\? ''\] \?\? lindo\(txt\(x\.status\)\),/);
  assert.match(src, /const ESTADO_LLAMADA: Record<string, string> = \{ analizada: 'Analizada', pendiente: 'Sin transcript', error: 'Con error', descartada: 'Descartada' \};/);
});

test('la llamada de venta es una persona para el detalle: fuera de lo que viaja a un modelo', () => {
  assert.ok(fuenteDe('llamadas_venta')!.dimensiones.some((d) => d.id === 'llamada'), 'llamadas_venta sin la dimensión `llamada`');
  assert.ok(DIMENSIONES_PERSONA.includes('llamadas_venta.llamada'));
  assert.equal(dimensionPublica('llamadas_venta', 'llamada'), false);
});

test('la API de MaKo linkea cada llamada a la hoja Closing del Dashboard, con su ficha abierta', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/closing.run.ts'));
  assert.match(run, /const linkLlamada = \(id: number\): string => linkPantalla\(`\/dashboard\?hoja=closing&llamada=\$\{id\}`\);/);
  for (const ruta of ['lib/api-mako/areas/closing.run.ts', 'lib/api-mako/areas/closing.def.ts']) {
    assert.doesNotMatch(sinComentarios(leer(ruta)), /\/closing\?call=|desde \/closing|link de \/closing/, `${ruta} todavía nombra la tab retirada`);
  }
});

// ── El texto de pantalla ─────────────────────────────────────────────────────────────────

/** Las palabras terminadas en á/é/í (o en ás/és/ís) que SÍ son de tú o neutras. Todo lo demás es sospechoso. */
const NEUTRAS = new Set(['más', 'está', 'aquí', 'así', 'ahí', 'allí', 'sí', 'qué', 'días', 'después', 'además', 'través', 'país', 'acá', 'estás', 'detrás']);
const NUEVOS = [
  'app/dashboard/bloques/extra/FichaLlamada.tsx', 'app/dashboard/bloques/extra/llamadas-modelo.ts', 'app/dashboard/bloques/extra/BloquesClosing.tsx',
  'app/api/closing/puerta-regla.ts', 'app/api/closing/puerta.ts', 'app/api/closing/llamada/route.ts', 'app/api/closing/revise/route.ts',
];

test('sin voseo en lo que se dibuja (el guard del repo no ve un archivo sin git add)', () => {
  const malas: Record<string, string[]> = {};
  for (const ruta of NUEVOS) {
    const codigo = sinComentarios(leer(ruta));
    const raras = [...new Set((codigo.match(/(?<!\p{L})\p{L}+(?:á|é|í|ás|és|ís)(?!\p{L})/gu) ?? []).map((w) => w.toLowerCase()))].filter((w) => !NEUTRAS.has(w));
    const todas = [...marcasDeVoseo(codigo).map(String), ...raras];
    if (todas.length) malas[ruta] = todas;
  }
  assert.deepEqual(malas, {}, 'voseo, o palabras con su forma («revisá», «tenés»…)');
});
