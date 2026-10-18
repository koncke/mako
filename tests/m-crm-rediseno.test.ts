// =============================================================================
// MaKo Mobile — el rediseño del CRM del 17/10/2026 (Pipedrive y HubSpot en el teléfono)
// =============================================================================
// Lo puro se EJECUTA: la señal a la derecha de cada fila del tablero (`senalDeTarjeta`, el punto de actividad de
// Pipedrive alimentado SÓLO con el pie de la tarjeta de escritorio) y la barra de avance de la ficha
// (`progresoEnFunnel`, la de la ficha del deal de Pipedrive). El cableado se lee del fuente: que el tablero pase
// los datos de escritorio, que la piel viva en la carpeta del CRM y no en el componente compartido, y que la
// barra de la etapa abra «Mover de etapa».
//
// Probado rompiéndolo (17/10/2026), con `node --test --import tsx tests/m-crm-rediseno.test.ts`:
//   · el rojo sin mirar si el lead sigue abierto (`const vencida = dia < hoyISO`)          → 6 pasan / 1 falla
//   · el verde para una reunión que ya pasó (sin `r >= ahoraMs`)                           → 6 / 1
//   · la barra contando Nutrición y salidas (sin el filtro de banda)                       → 6 / 1
//   · el tablero sin `reunionISO: c.fechaJ1` (la señal leyendo otra fecha)                 → 6 / 1
//   · la piel fuera de crm.css (la regla `.m-crm-tablero .m-kb-tj` renombrada)           → 6 / 1
//   · la fila diciendo «Sin empresa» (sin el filtro de SIN_EMPRESA en datos.ts)           → 6 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { progresoEnFunnel, senalDeTarjeta } from '../app/m/crm/reglas';

const TZ = 'America/Mexico_City';
const HOY = '2026-10-17';
// 17/10/2026 12:00 en Ciudad de México (UTC-6).
const AHORA = Date.parse('2026-10-17T18:00:00Z');
const BASE = { reunionISO: null, manualDeadline: null, enManual: false, abierto: true, creadoISO: '2026-10-15T15:00:00Z' };

test('la señal: reunión que viene = verde, con «mañana» o la hora de hoy', () => {
  const manana = senalDeTarjeta({ ...BASE, reunionISO: '2026-10-18T16:30:00Z' }, AHORA, TZ, HOY);
  assert.deepEqual(manana, { tono: 'verde', texto: 'mañana', dice: 'reunión mañana' });
  const hoy = senalDeTarjeta({ ...BASE, reunionISO: '2026-10-17T22:00:00Z' }, AHORA, TZ, HOY);
  assert.equal(hoy.tono, 'verde');
  assert.match(hoy.texto, /^16:00$/);
  assert.equal(hoy.dice, 'reunión hoy 16:00');
});

test('la señal: una reunión que YA pasó no es «agendado» — vuelve a decir cuándo llegó, sin punto', () => {
  const r = senalDeTarjeta({ ...BASE, reunionISO: '2026-10-16T16:30:00Z' }, AHORA, TZ, HOY);
  assert.equal(r.tono, null);
  assert.equal(r.dice, null);
  assert.equal(r.texto, 'jue'); // llegó el 15/10, dos días antes
});

test('la señal: la Nutrición manual dice su plazo, rojo sólo si venció Y el lead sigue abierto', () => {
  const vencida = senalDeTarjeta({ ...BASE, enManual: true, manualDeadline: '2026-10-05' }, AHORA, TZ, HOY);
  assert.deepEqual(vencida, { tono: 'rojo', texto: '5 oct', dice: 'venció 5 oct' });
  const vence = senalDeTarjeta({ ...BASE, enManual: true, manualDeadline: '2026-10-18' }, AHORA, TZ, HOY);
  assert.deepEqual(vence, { tono: null, texto: 'mañana', dice: 'vence mañana' });
  // Cerrado (ganado, perdido): el plazo pasado ya no reclama nada — el mismo `overdueManual` de CrmBoard.
  const cerrado = senalDeTarjeta({ ...BASE, enManual: true, manualDeadline: '2026-10-05', abierto: false }, AHORA, TZ, HOY);
  assert.equal(cerrado.tono, null);
});

test('la barra de la ficha: sólo el camino (banda pipeline, por columna); en Nutrición, vacía', () => {
  const stages = [
    { key: 'nutri', band: 'nutricion', col: 0 },
    { key: 'agenda', band: 'pipeline', col: 1 },
    { key: 'lead', band: 'pipeline', col: 0 },
    { key: 'perdido', band: 'salidas', col: 0 },
    { key: 'ganado', band: 'pipeline', col: 2 },
  ];
  assert.deepEqual(progresoEnFunnel(stages, 'agenda'), { total: 3, hasta: 1 });
  assert.deepEqual(progresoEnFunnel(stages, 'ganado'), { total: 3, hasta: 2 });
  assert.deepEqual(progresoEnFunnel(stages, 'nutri'), { total: 3, hasta: null });
  assert.deepEqual(progresoEnFunnel(stages, null), { total: 3, hasta: null });
  // Un funnel viejo sin `band`: todas son camino, en su orden.
  assert.deepEqual(progresoEnFunnel([{ key: 'a' }, { key: 'b' }], 'b'), { total: 2, hasta: 1 });
});

const RAIZ = resolve(fileURLToPath(import.meta.url), '..', '..');
const fuente = (...p: string[]) => readFileSync(resolve(RAIZ, ...p), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el tablero alimenta la señal con lo que dice el pie de la tarjeta de ESCRITORIO', () => {
  const datos = fuente('app', 'm', 'crm', 'datos.ts');
  assert.match(datos, /reunionISO: c\.fechaJ1, manualDeadline: c\.nutriManualDeadline, enManual: col === 'manual',/);
  assert.match(datos, /abierto: c\.estadoLead === 'abierto'/);
  // «Sin empresa» es el relleno de mapToCrmLead, no un dato: la fila dice por dónde llegó (Pipedrive: «$ · org · persona»).
  assert.match(datos, /segunda: \(empresa && empresa !== SIN_EMPRESA \? empresa : null\) \|\| llegoPor\(c\.canal, c\.origin\)/);
  assert.match(datos, /progreso: casa && stages\.length \? progresoEnFunnel\(stages, casa\.etapa\) : null,/);
});

test('la piel es del CRM: KanbanM y app/m/m.css no se tocan', () => {
  const tablero = fuente('app', 'm', 'crm', 'TableroCrm.tsx');
  assert.match(tablero, /<div className="m-crm-tablero">\s*<KanbanM/);
  const css = fuente('app', 'm', 'crm', 'crm.css');
  assert.match(css, /\.m-crm-tablero \.m-kb-tj \{/);
  assert.doesNotMatch(fuente('app', 'm', 'm.css'), /m-crm-/);
});

test('la ficha: la barra de la etapa abre «Mover de etapa» y la fila de acciones lleva Nota', () => {
  const ficha = fuente('app', 'm', 'crm', '[id]', 'FichaLead.tsx');
  assert.match(ficha, /className="m-crm-etapa"\s*onClick=\{\(\) => setSheet\('mover'\)\}/);
  assert.match(ficha, /onClick=\{abrirNota\}/);
  // El botón «WhatsApp» abre Chats (decisión de Martín, 17/10/2026).
  assert.match(ficha, /<Link className="m-crm-accion" href=\{rutaChatsDeLead\(p\.id\)\}/);
});
