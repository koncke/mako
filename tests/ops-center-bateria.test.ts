// =============================================================================
// La batería guardián del Ops Center: las frases medidas de los 8 mapas (20/10/2026, ola 1, pieza 1.1)
// =============================================================================
// docs/ops-center-principal.md §5, la 1.1: «Una sola batería guardián con las frases medidas de los 8 mapas. Hoy viven
// en el scratchpad temporal (y otro agente pisó un script ahí), así que pasan a `tests/`. Corre por
// `herramientasDelChat` y por `herramientasDelTurno`». Hecho = el test existe, marca el piso de hoy por área, y romper
// un verbo lo hace caer.
//
// La batería es tests/fixtures/ops-center-frases.json: cada par frase → operación, con su área, de dónde salió y si
// la operación VIAJA hoy al turno en el chat de la app (`llegaHoy`) y en WhatsApp (`llegaWhatsApp`). Las corre
// tests/_bateria-ops-center-hijo.ts por el camino de un turno real (el clasificador y la selección de herramientas, con
// las de siempre reales).
//
// ⚠️ EL PISO ES UN TRINQUETE:
//   · algo que llegaba y deja de llegar → falla, con la frase y la operación (eso es romper el ruteo);
//   · algo que no llegaba y ahora llega → TAMBIÉN falla, para que el piso suba con el arreglo y no se pierda. Se anota
//     corriendo el test con `ACTUALIZAR_PISO=1` (reescribe `llegaHoy`, `llegaWhatsApp` y `medido`) y se commitea con
//     el arreglo. Así trabaja la 1.2: cada tanda de un área sube su piso acá.
// ⚠️ EN NÚCLEO, CRM Y AUTOMATIONS, LAS OPERACIONES DE UNA FRASE SON ALTERNATIVAS: «creame una landing» llega si viaja
//    CUALQUIERA de las que la crean, y se cuenta por frase. En las otras áreas se esperan todas, y se cuenta por par.
// ⚠️ LA BATERÍA NO TIENE TODO LO MEDIDO: afuera quedaron 229 frases (173 sin una operación explícita en su script, 40
//    con la batería vacía a propósito, 8 con una operación que no existe, 5 con adjunto y 3 «sí» que dependen del mensaje
//    anterior). Cada una con su motivo en tests/fixtures/ops-center-frases-afuera.json (la 1.2 les pone su operación y
//    las pasa acá); lo aprendido al armarla, en docs/hallazgos-ia.md.
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · sin el verbo «creame» en el clasificador (lib/mako-intencion.ts) → 2 fallos (el piso de la app y el de WhatsApp);
//   · una operación de la batería renombrada en el registro → 1 fallo (1) más los pisos;
//   · `llegaHoy` en true para una frase que hoy no llega (el piso inflado a mano) → 1 fallo (2).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVO = join(RAIZ, 'tests', 'fixtures', 'ops-center-frases.json');

type Par = { area: string; frase: string; operacion: string; fuente: string; llegaHoy: boolean; llegaWhatsApp?: boolean };
type Bateria = { medido: string; frases: Par[] };
type Medido = { porFrase: Record<string, { app: string[]; whatsapp: string[] }>; inexistentes: string[] };
type Canal = 'app' | 'whatsapp';

const AREAS = ['nucleo', 'crm-chats', 'pagos-cuenta', 'automations-clients', 'offer-copy-cerebro', 'plan-calendario-dashboard', 'video-imagen', 'web-ads'];
/** Las áreas donde las operaciones de una frase son alternativas (alcanza con una). */
const ALTERNATIVAS = new Set(['nucleo', 'crm-chats', 'automations-clients']);

const bateria = JSON.parse(readFileSync(ARCHIVO, 'utf8')) as Bateria;
let medicion: Medido | null = null;
const medir = (): Medido => {
  medicion ??= JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_bateria-ops-center-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 240_000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  })) as Medido;
  return medicion;
};
const llega = (m: Medido, p: Par, canal: Canal) => m.porFrase[p.frase]?.[canal].includes(p.operacion) ?? false;
const anotado = (p: Par, canal: Canal) => (canal === 'app' ? p.llegaHoy : p.llegaWhatsApp === true);

/** Lo que se cuenta: la frase (en las áreas de alternativas) o el par. `antes` = lo anotado; `ahora` = lo medido. */
function unidades(m: Medido, canal: Canal) {
  const out = new Map<string, { area: string; que: string; antes: boolean; ahora: boolean }>();
  for (const p of bateria.frases) {
    const clave = ALTERNATIVAS.has(p.area) ? `${p.area}|${p.frase}` : `${p.area}|${p.frase}|${p.operacion}`;
    const u = out.get(clave) ?? { area: p.area, que: ALTERNATIVAS.has(p.area) ? `«${p.frase}»` : `«${p.frase}» → ${p.operacion}`, antes: false, ahora: false };
    u.antes ||= anotado(p, canal);
    u.ahora ||= llega(m, p, canal);
    out.set(clave, u);
  }
  return [...out.values()];
}

function piso(canal: Canal, t: { diagnostic: (s: string) => void }) {
  const m = medir();
  const us = unidades(m, canal);
  const tabla = AREAS.map((a) => {
    const de = us.filter((u) => u.area === a);
    return `${a}: ${de.filter((u) => u.ahora).length}/${de.length} (piso ${de.filter((u) => u.antes).length})`;
  });
  t.diagnostic(`${canal} · ${tabla.join(' · ')}`);
  const cayeron = us.filter((u) => u.antes && !u.ahora);
  assert.deepEqual(cayeron.map((u) => `${u.area} · ${u.que}`), [], `${canal}: dejaron de llegar (el piso bajó)`);
  const subieron = us.filter((u) => !u.antes && u.ahora);
  assert.deepEqual(subieron.map((u) => `${u.area} · ${u.que}`), [],
    `${canal}: ahora llegan y el piso no lo dice: corré este test con ACTUALIZAR_PISO=1 y commiteá el archivo con el arreglo`);
}

test('0. ACTUALIZAR_PISO=1 anota lo medido como el piso nuevo', { skip: process.env.ACTUALIZAR_PISO !== '1' }, () => {
  const m = medir();
  const frases = bateria.frases.map((p) => ({ ...p, llegaHoy: llega(m, p, 'app'), llegaWhatsApp: llega(m, p, 'whatsapp') }));
  // La fecha de Argentina, no la de UTC (a las 21 de acá ya es mañana en UTC).
  const nueva: Bateria = { medido: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }), frases };
  // Un par por renglón, como lo dejó el agente que la armó: el diff de una tanda se lee.
  writeFileSync(ARCHIVO, `{\n  "medido": ${JSON.stringify(nueva.medido)},\n  "frases": [\n${frases.map((p) => `    ${JSON.stringify(p)}`).join(',\n')}\n  ]\n}\n`);
  bateria.frases = frases;
  bateria.medido = nueva.medido;
});

test('1. la batería: las 8 áreas, sin pares repetidos, y cada operación existe', () => {
  assert.deepEqual([...new Set(bateria.frases.map((p) => p.area))].sort(), [...AREAS].sort());
  const claves = bateria.frases.map((p) => `${p.area}|${p.frase}|${p.operacion}`);
  assert.equal(new Set(claves).size, claves.length, 'sin pares repetidos');
  for (const p of bateria.frases) assert.ok(p.frase.trim() && p.operacion.trim() && p.fuente.trim(), `par incompleto: ${JSON.stringify(p)}`);
  // Una operación que se renombra o se borra deja la frase midiendo algo que no existe: falla acá, no en silencio.
  assert.deepEqual(medir().inexistentes, [], 'operaciones de la batería que ya no existen en el registro ni en las de siempre');
});

test('2. el piso del chat de la app (herramientasDelChat)', (t) => piso('app', t));

test('3. el piso de WhatsApp (herramientasDelTurno)', (t) => piso('whatsapp', t));
