// =============================================================================
// El historial del escritor de Instagram SOBREVIVE a recargar (item 129, 6/11/2026)
// =============================================================================
// «Si el cliente recarga la página pierde toda la conversación.» Lo que se fija acá no es
// que exista un archivo de historial, sino que el ciclo entero funcione EJECUTADO, con
// `app_settings` en memoria (sin tabla nueva: se reusa la que ya está):
//
//   1. generar → guardar → VOLVER A LEER devuelve la pieza (la recarga, en una línea);
//   2. el tope de 10: la número 11 entra y la más vieja se cae, en ese orden;
//   3. el aislamiento: lo que escribe un workspace NO lo lee el otro (la clave de
//      app_settings es workspace_id+key, y el historial es material del negocio);
//   4. la escritura es compare-and-set: dos piezas que terminan a la vez NO se pisan
//      (el defecto conocido del historial viejo de Reels era el read-modify-write pelado);
//   5. una entrada corrupta se cae SOLA, sin voltear el historial;
//   6. guardar es best-effort: si la escritura revienta, la secuencia se devuelve igual;
//   7. la pantalla del teléfono siembra la lista con lo guardado y abre con la última.
//
// El molde del proceso hijo (react-server + `mock.module`) es tests/editor-web-discutir-editar.ts.
// Correr: node --import tsx --test tests/ig-historial.test.ts
//
// ⚠️ PROBADO ROMPIENDO CADA PIEZA (6/11/2026): la rotura va arriba de su test con cuántos
// rojos dio.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const url = (rel: string): string => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);

function hijo(codigo: string): Record<string, unknown> {
  const out = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = out.trim().split('\n');
  return JSON.parse(lineas[lineas.length - 1]!) as Record<string, unknown>;
}

/**
 * `app_settings` en memoria, POR WORKSPACE, con la misma semántica que lib/settings.ts:
 * leer sin workspace no trae nada y escribir sin workspace TIRA. `cambiarSettingSi` se
 * reimplementa acá como el compare-and-set que es (el de verdad lo hace en PostgREST):
 * es lo único que no se puede ejecutar sin base, y lo que importa es que quien llama use
 * uno — el test 4 lo comprueba haciendo competir dos escrituras.
 */
const SETTINGS_FALSO = `
let WS = 9;
const base = new Map();   // \`\${ws}|\${key}\` → value
const clave = (k) => { if (WS == null) throw new Error('sin workspace'); return WS + '|' + k; };
mock.module(${url('lib/settings.ts')}, { exports: {
  getSetting: async (k) => (WS == null ? null : base.get(WS + '|' + k) ?? null),
  setSetting: async (k, v) => { base.set(clave(k), v); },
  cambiarSettingSi: async (k, esperado, nuevo) => {
    const c = clave(k);
    const actual = base.get(c) ?? null;
    if (actual !== esperado) return false;
    base.set(c, nuevo);
    return true;
  },
} });
const { getHistorialIg, guardarEnHistorialIg, TOPE_HISTORIAL_IG } = await import(${url('lib/ig-historial.ts')});
const pieza = (idea) => ({ formato: 'story', idea, frames: [{ tipo: 'selfie', texto: 't', indicacion: 'i', interactivoManual: false }], cta: null, palabraClave: null });
`;

// rotura (guardarEnHistorialIg sin la escritura: devuelve el item y no guarda): 1 fallo, 6 pases.
// rotura (CLAVE sin el formato, 'ig.historial'): 1 fallo, 6 pases.
test('generar → guardar → volver a leer: la pieza está ahí (es la recarga, en una línea)', () => {
  const r = hijo(`import { mock } from 'node:test';${SETTINGS_FALSO}
const vacio = await getHistorialIg('story');
const item = await guardarEnHistorialIg('story', pieza('la idea de hoy'), 'Venta');
const despues = await getHistorialIg('story');
// Y el formato no se mezcla: un carrusel guardado no aparece en el historial de stories.
await guardarEnHistorialIg('carrusel', { formato: 'carrusel', objetivo: '', slides: [{ texto: 'a', visual: 'b' }], cta: null, palabraClave: null, caption: '' }, 'Educativo');
const storiesIgual = await getHistorialIg('story');
const carruseles = await getHistorialIg('carrusel');
console.log(JSON.stringify({ vacio, item, despues, storiesIgual, carruseles }));
`) as {
    vacio: unknown[]; item: { at: string; etiqueta: string };
    despues: { at: string; etiqueta: string; formato: string; pieza: { idea: string } }[];
    storiesIgual: unknown[]; carruseles: { formato: string }[];
  };
  assert.deepEqual(r.vacio, [], 'sin nada guardado tiene que devolver una lista vacía');
  assert.equal(r.despues.length, 1);
  assert.equal(r.despues[0]!.pieza.idea, 'la idea de hoy');
  assert.equal(r.despues[0]!.etiqueta, 'Venta', 'el rótulo del objetivo se guarda resuelto');
  assert.equal(r.despues[0]!.formato, 'story');
  assert.equal(r.despues[0]!.at, r.item.at, 'lo devuelto y lo guardado son la MISMA entrada');
  assert.equal(r.storiesIgual.length, 1, 'un carrusel no entra al historial de stories');
  assert.equal(r.carruseles.length, 1);
  assert.equal(r.carruseles[0]!.formato, 'carrusel');
});

// rotura (slice(TOPE) sacado de guardarEnHistorialIg): 1 fallo, 6 pases.
// rotura (el item nuevo al final: [...lista, item]): 1 fallo, 6 pases.
test('el tope de 10: la número 11 entra, la más vieja se cae, y la FILA no crece', () => {
  const r = hijo(`import { mock } from 'node:test';${SETTINGS_FALSO}
for (let i = 1; i <= 12; i++) await guardarEnHistorialIg('story', pieza('idea ' + i), 'Conexión');
const h = await getHistorialIg('story');
console.log(JSON.stringify({
  tope: TOPE_HISTORIAL_IG,
  ideas: h.map((x) => x.pieza.idea),
  // Lo que QUEDÓ ESCRITO en app_settings, no lo que la lectura recorta: el tope existe para
  // que la fila no crezca sin fin, así que se mira ahí. (Con el recorte sólo en la lectura,
  // la fila guarda las doce y nadie lo nota hasta que el valor es enorme.)
  guardadas: JSON.parse(base.get('9|ig.historial.story')).length,
}));
`) as { tope: number; ideas: string[]; guardadas: number };
  assert.equal(r.tope, 10);
  assert.equal(r.ideas.length, 10);
  assert.equal(r.ideas[0], 'idea 12', 'la última escrita va PRIMERA');
  assert.equal(r.ideas.at(-1), 'idea 3', 'las dos más viejas se cayeron');
  assert.equal(r.ideas.includes('idea 1'), false);
  assert.equal(r.guardadas, 10, 'la fila de app_settings se guardó con más de 10: el tope no recorta al ESCRIBIR');
});

// rotura (getSetting leyendo sin el ws en la clave): 1 fallo, 6 pases.
test('aislamiento: lo que escribe un workspace no lo lee el otro, y sin workspace no se escribe', () => {
  const r = hijo(`import { mock } from 'node:test';${SETTINGS_FALSO}
WS = 9;  await guardarEnHistorialIg('story', pieza('la del nueve'), 'Venta');
WS = 13; await guardarEnHistorialIg('story', pieza('la del trece'), 'Conexión');
const trece = (await getHistorialIg('story')).map((x) => x.pieza.idea);
WS = 9;  const nueve = (await getHistorialIg('story')).map((x) => x.pieza.idea);
// Sin workspace (agencia sin impersonar): leer no trae nada y escribir TIRA. Nunca cae al dueño.
WS = null;
const sinWs = await getHistorialIg('story');
let escribio = 'no tiró';
try { await guardarEnHistorialIg('story', pieza('la de nadie'), ''); } catch (e) { escribio = 'tiró'; }
WS = 9;  const nueveDespues = (await getHistorialIg('story')).map((x) => x.pieza.idea);
console.log(JSON.stringify({ nueve, trece, sinWs, escribio, nueveDespues }));
`) as { nueve: string[]; trece: string[]; sinWs: unknown[]; escribio: string; nueveDespues: string[] };
  assert.deepEqual(r.nueve, ['la del nueve']);
  assert.deepEqual(r.trece, ['la del trece']);
  assert.deepEqual(r.sinWs, [], 'sin workspace la lectura no trae el historial de nadie');
  assert.equal(r.escribio, 'tiró', 'sin workspace la escritura tiene que fallar, no caer al dueño');
  assert.deepEqual(r.nueveDespues, ['la del nueve'], 'el intento sin workspace no escribió en el ws 9');
});

// rotura (setSetting pelado en vez de cambiarSettingSi): 1 fallo, 6 pases.
// rotura (el for de reintentos con una sola vuelta): 1 fallo, 6 pases.
test('dos piezas que terminan a la vez no se pisan: la escritura es compare-and-set con reintento', () => {
  const r = hijo(`import { mock } from 'node:test';${SETTINGS_FALSO}
// Las dos leen lo mismo (la lista vacía) y escriben: con un read-modify-write pelado la
// segunda pisa a la primera y queda UNA. Con compare-and-set, la que pierde reintenta.
const [a, b] = await Promise.all([
  guardarEnHistorialIg('story', pieza('la primera'), 'Venta'),
  guardarEnHistorialIg('story', pieza('la segunda'), 'Conexión'),
]);
const ideas = (await getHistorialIg('story')).map((x) => x.pieza.idea).sort();
console.log(JSON.stringify({ ideas, devueltas: [a.pieza.idea, b.pieza.idea].sort() }));
`) as { ideas: string[]; devueltas: string[] };
  assert.deepEqual(r.devueltas, ['la primera', 'la segunda']);
  assert.deepEqual(r.ideas, ['la primera', 'la segunda'], 'una de las dos se perdió: la escritura se pisó');
});

// rotura (normalizarItemIg devolviendo el item sin mirar `at` ni `formato`): 2 fallos, 5 pases.
// rotura (leerHistorialIg sin el try/catch del JSON.parse): 1 fallo, 6 pases.
test('una entrada corrupta se cae sola, y un valor que no es JSON no voltea nada', () => {
  const r = hijo(`import { mock } from 'node:test';${SETTINGS_FALSO}
const { leerHistorialIg, normalizarItemIg } = await import(${url('lib/ig-historial.ts')});
const buena = { at: '2026-11-06T10:00:00.000Z', formato: 'story', etiqueta: 'Venta', pieza: pieza('la buena') };
const crudo = JSON.stringify([
  buena,
  { at: '', formato: 'story', pieza: pieza('sin fecha') },
  { at: 'mañana', formato: 'story', pieza: pieza('fecha inventada') },
  { at: '2026-11-05T10:00:00.000Z', formato: 'story' },
  { at: '2026-11-05T10:00:00.000Z', formato: 'story', pieza: { formato: 'carrusel' } },
  'una cadena suelta',
  null,
]);
console.log(JSON.stringify({
  sobrevivientes: leerHistorialIg(crudo, 'story').map((x) => x.pieza.idea),
  noEsJson: leerHistorialIg('{{roto', 'story'),
  noEsLista: leerHistorialIg('{"a":1}', 'story'),
  sinEtiqueta: normalizarItemIg({ ...buena, etiqueta: undefined }, 'story')?.etiqueta,
}));
`) as { sobrevivientes: string[]; noEsJson: unknown[]; noEsLista: unknown[]; sinEtiqueta: string };
  assert.deepEqual(r.sobrevivientes, ['la buena'], 'las seis entradas rotas tenían que caerse solas');
  assert.deepEqual(r.noEsJson, []);
  assert.deepEqual(r.noEsLista, []);
  assert.equal(r.sinEtiqueta, '', 'una entrada sin rótulo se dibuja sin rótulo, no con «undefined»');
});

// rotura (el await de guardarEnHistorialIg sin el try/catch en la action): 1 fallo, 6 pases.
test('guardar es best-effort: si la base revienta, la secuencia se devuelve igual', () => {
  const r = hijo(`import { mock } from 'node:test';
mock.module(${url('lib/settings.ts')}, { exports: {
  getSetting: async () => { throw new Error('supabase caído'); },
  setSetting: async () => { throw new Error('supabase caído'); },
  cambiarSettingSi: async () => { throw new Error('supabase caído'); },
} });
const { getHistorialIg, guardarEnHistorialIg } = await import(${url('lib/ig-historial.ts')});
const pieza = { formato: 'story', idea: 'x', frames: [], cta: null, palabraClave: null };
let leyo = 'tiró';
try { leyo = JSON.stringify(await getHistorialIg('story')); } catch {}
let guardo = 'devolvió el item';
try { await guardarEnHistorialIg('story', pieza, ''); } catch { guardo = 'tiró'; }
console.log(JSON.stringify({ leyo, guardo }));
`) as { leyo: string; guardo: string };
  assert.equal(r.leyo, '[]', 'con la base caída la lectura devuelve una lista vacía, no un error');
  // Guardar SÍ puede tirar (el `wsObligatorio` es una señal real, y acá la base revienta);
  // el contrato es que QUIEN LLAMA lo envuelva, y eso se fija leyendo la action.
  assert.equal(r.guardo, 'tiró');
  const act = sinComentarios(leer('app/stories/actions.ts'));
  assert.match(act, /try \{\s*await guardarEnHistorialIg\('story', r\.pieza, OBJETIVOS_STORIES[\s\S]{0,160}?\} catch \{/);
  assert.ok(act.indexOf('await guardarEnHistorialIg') < act.indexOf('return { ok: true, pieza: r.pieza }'), 'se guarda ANTES de devolver');
});

// rotura (la page sin pasarle el historial a StoriesM): 1 fallo, 6 pases.
// rotura (sesion.length > 1 de vuelta en la lista): 1 fallo, 6 pases.
test('la pantalla del teléfono siembra la lista con lo guardado y abre con la última', () => {
  const page = sinComentarios(leer('app/m/stories/page.tsx'));
  assert.match(page, /import \{ historialStoriesAction \} from '@\/app\/stories\/actions';/);
  assert.match(page, /historialStoriesAction\(\)/);
  assert.match(page, /<StoriesM perfilListo=\{perfilListo\} historial=\{historial\} \/>/);

  const m = sinComentarios(leer('app/m/stories/StoriesM.tsx'));
  // La lista arranca con lo guardado, y lo que se mira es la última pieza (no la pantalla vacía).
  assert.match(m, /const guardadas = deHistorial\(historial\);/);
  assert.match(m, /useState<Item\[\]>\(guardadas\)/);
  assert.match(m, /useState<Item \| null>\(guardadas\[0\] \?\? null\)/);
  // Y UNA sola llamada: con una por estado, `actual` sale de otro array y deja de ser el
  // mismo objeto que su fila (el tilde de «la que mirás» y el «¿hay algo más?» comparan
  // IDENTIDAD, así que las dos se rompen a la vez, y en silencio).
  assert.equal([...m.matchAll(/deHistorial\(historial\)/g)].length, 1);
  // La lista aparece cuando hay algo que NO es lo que se está mirando: una sola secuencia,
  // que es la de arriba, no es una lista (y `> 1` dejaba la recarga de una pieza sin lista).
  assert.match(m, /\{sesion\.some\(\(h\) => h !== actual\) && \(/);
  assert.doesNotMatch(m, /sesion\.length > 1/);
  // Y un módulo server-only entra SÓLO como tipo (la frontera de datos de la casa).
  assert.match(m, /import type \{ ItemHistorialIg \} from '@\/lib\/ig-historial';/);
  assert.doesNotMatch(m, /^import \{[^}]*\} from '@\/lib\/ig-historial'/m);
});
