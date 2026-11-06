// =============================================================================
// La biblioteca de miniaturas se renueva antes de vencer (y la cadencia alcanza)
// =============================================================================
// Lo que protege este archivo no es que el cron exista: es que CORRA SEGUIDO. El vencimiento de YouTube son 30 días exactos
// (`DIAS_VIGENTE`), y el pendiente estaba escrito como «agendar `leer` + `podar` una vez por mes» — que es justo la cadencia
// que no alcanza:
//
//   · mensual el día 1 → entre el 1 de enero y el 1 de febrero pasan 31 días: lo leído el 1 de enero vence el 31 y la
//     galería aparece vacía un día entero antes de que el cron la salve;
//   · y con una sola oportunidad por vencimiento, cualquier corrida que falle (cuota de YouTube, un 403, el deploy caído)
//     vacía la galería igual, sin red.
//
// Por eso el schedule es semanal, y por eso se fija acá: un cambio a mensual pasa el typecheck, pasa el test de
// `cron-registrado` (que sólo pide que ESTÉ agendado) y no se nota hasta que un cliente abre la pestaña vacía.
//
// PROBADO ROMPIÉNDOLO (6/11/2026) — los números, al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
// ⚠️ Se importa de `explorar.ts`, NO de `renovar.ts`: ése es `server-only` y `npm test` corre sin
// `--conditions=react-server` (importarlo tira ahí mismo). De `renovar.ts` y del route se leen los números del FUENTE.
import { DIAS_VIGENTE, cadenciaAlcanza, diasEntreCorridas, limiteDeVigencia } from '../lib/thumbnails/explorar';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

type Cron = { path: string; schedule: string };
const CRONS = (JSON.parse(leer('vercel.json')) as { crons: Cron[] }).crons;
const RUTA = '/api/cron/thumbnails-renovar';

// ── La cadencia ────────────────────────────────────────────────────────────────────────────────

test('el cron de miniaturas está agendado y corre MÁS SEGUIDO que el vencimiento de 30 días', () => {
  const cron = CRONS.find((c) => c.path === RUTA);
  assert.ok(cron, `falta { "path": "${RUTA}", "schedule": … } en vercel.json: la galería se vacía a los 30 días`);
  const dias = diasEntreCorridas(cron!.schedule);
  assert.ok(dias != null, `no sé leer cada cuánto corre «${cron!.schedule}»: si es a propósito, enseñale el caso a diasEntreCorridas`);
  assert.ok(
    cadenciaAlcanza(dias!),
    `«${cron!.schedule}» dispara cada ${dias} días y lo guardado vence a los ${DIAS_VIGENTE}: ` +
    'una sola corrida fallida deja la galería vacía. Hace falta que entren dos corridas antes del vencimiento.',
  );
});

test('cadenciaAlcanza pide margen para una corrida fallida, no sólo llegar antes del vencimiento', () => {
  assert.equal(cadenciaAlcanza(1), true);    // diario
  assert.equal(cadenciaAlcanza(7), true);    // semanal: 4 oportunidades
  assert.equal(cadenciaAlcanza(15), true);   // justo dos
  assert.equal(cadenciaAlcanza(16), false);  // ya no entran dos
  assert.equal(cadenciaAlcanza(29), false);  // llega una sola vez, el día 29: sin red
  assert.equal(cadenciaAlcanza(31), false);  // mensual: llega TARDE
  assert.equal(cadenciaAlcanza(0), false);
  assert.equal(cadenciaAlcanza(-7), false);
});

test('diasEntreCorridas lee los schedules que usamos y dice null cuando no sabe', () => {
  assert.equal(diasEntreCorridas('55 6 * * 0'), 7);      // domingos
  assert.equal(diasEntreCorridas('47 6 * * *'), 1);      // todos los días
  assert.equal(diasEntreCorridas('*/10 * * * *'), 1);
  assert.equal(diasEntreCorridas('0 9 1 * *'), 31);      // el día 1 de cada mes: el peor caso son 31 días
  assert.equal(diasEntreCorridas('0 9 15 * *'), 31);
  assert.equal(diasEntreCorridas('0 9 * 3 *'), null);    // un mes puntual: no lo sabe leer
  assert.equal(diasEntreCorridas('0 9 * *'), null);      // cuatro campos
  assert.equal(diasEntreCorridas(''), null);
});

// ── El corte de vigencia ───────────────────────────────────────────────────────────────────────

test('limiteDeVigencia es el corte de los 30 días, en UTC', () => {
  const ahora = Date.parse('2026-11-06T12:00:00.000Z');
  assert.equal(limiteDeVigencia(ahora), '2026-10-07T12:00:00.000Z');
  // El mismo número que usa la pantalla para decidir qué muestra: si se separan, se poda lo que todavía se ve (o al revés).
  assert.equal(Math.round((ahora - Date.parse(limiteDeVigencia(ahora))) / 86_400_000), DIAS_VIGENTE);
});

// ── Los topes de la corrida ────────────────────────────────────────────────────────────────────

test('la corrida entra en el maxDuration del cron y el tope de canales cubre la biblioteca de hoy', () => {
  const route = leer('app/api/cron/thumbnails-renovar/route.ts');
  const max = /export const maxDuration = (\d+)/.exec(route);
  assert.ok(max, 'el route no declara maxDuration: una corrida larga la corta Vercel a los 60 s por defecto');
  const fuente = leer('lib/thumbnails/renovar.ts');
  const presupuesto = /PRESUPUESTO_MS = ([\d_]+)/.exec(fuente);
  const canales = /CANALES_POR_CORRIDA = ([\d_]+)/.exec(fuente);
  assert.ok(presupuesto && canales, 'no encontré PRESUPUESTO_MS / CANALES_POR_CORRIDA en lib/thumbnails/renovar.ts');
  const ms = Number(presupuesto![1].replace(/_/g, ''));
  assert.ok(
    ms < Number(max![1]) * 1000,
    `el presupuesto (${ms} ms) tiene que cortar ANTES de que Vercel mate la función (${max![1]} s)`,
  );
  // 79 canales activos el 6/11/2026. El tope deja aire para que la biblioteca crezca sin que la corrida deje canales afuera.
  assert.ok(Number(canales![1].replace(/_/g, '')) >= 150, `${canales![1]} canales por corrida es poco para una biblioteca que crece`);
});

test('el cron pide el secreto antes de cualquier otra cosa y no usa la cuota de búsquedas de YouTube', () => {
  const route = leer('app/api/cron/thumbnails-renovar/route.ts');
  const cuerpo = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.match(cuerpo, /checkCronAuth\(req\)/, 'el handler no llama a checkCronAuth: /api/cron es público por prefijo');
  // `descubrir`/`buscarCanales` gastan del balde de 100 `search.list` por día de TODA la app (Spy incluido): un cron no los toca.
  assert.doesNotMatch(cuerpo, /descubrir|buscarCanales|urlDeBusqueda/, 'un cron no puede gastar el balde de búsquedas de YouTube');
  const renovar = leer('lib/thumbnails/renovar.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.doesNotMatch(renovar, /buscarCanales|urlDeBusqueda|CONSULTAS/, 'renovar.ts no descubre canales: sólo relee los que ya están');
});

// ── Las roturas ────────────────────────────────────────────────────────────────────────────────
// (se completan con los números medidos al romperlo; ver el mensaje del commit)
