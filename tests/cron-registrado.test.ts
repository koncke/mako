// =============================================================================
// Toda ruta de cron está AGENDADA en vercel.json
// =============================================================================
// Un cron sin su entrada en vercel.json no falla: no corre. Compila, sus tests pasan, `?dry=1` contesta
// bien a mano, y en producción no lo llama nadie — que se lee igual que «no había nada que hacer».
//
// Pasó el 07/10/2026 con la alerta de baja de Customer Success (#109,
// app/api/cron/cs-sin-contacto): el route existía, su cabecera decía «vercel.json: `3 14 * * *`» y
// la entrada no estaba. La regla de la corrida que lo escribió prohíbe tocar vercel.json desde un
// worktree (lo agrega quien integra), y en el resumen del grupo no apareció el {path, schedule}: la
// alerta habría salido a producción sin correr nunca. Los otros 37 crons sí estaban agendados.
//
// Los tests de cada cron fijan SU entrada (tests/curso-mensajes.test.ts, recordatorio-lead, …);
// éste pregunta por el CONJUNTO, así que el cron que se escriba mañana lo hereda sin que nadie se
// acuerde. Si alguna vez hace falta una ruta de cron que NO agende Vercel (la llama otro sistema),
// va en `SIN_AGENDA` con su porqué: no agendarla tiene que ser una decisión escrita.
//
// PROBADO ROMPIÉNDOLO (07/10/2026), en una copia del árbol en el scratchpad (vercel.json no se toca
// desde el worktree). Los números, al final.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

type Cron = { path: string; schedule: string };
const CRONS = (JSON.parse(leer('vercel.json')) as { crons: Cron[] }).crons;

/** Rutas de cron que a propósito no agenda Vercel, con su motivo. Hoy, ninguna. */
const SIN_AGENDA: Readonly<Record<string, string>> = {};

/** Las rutas que existen: cada carpeta de app/api/cron con su route.ts. */
const RUTAS = readdirSync(join(RAIZ, 'app/api/cron'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(RAIZ, 'app/api/cron', d.name, 'route.ts')))
  .map((d) => `/api/cron/${d.name}`)
  .sort();

test('cada ruta de app/api/cron tiene su entrada en vercel.json (o está en SIN_AGENDA con su porqué)', () => {
  assert.ok(RUTAS.length >= 30, `encontré ${RUTAS.length} rutas de cron: ¿se movió la carpeta?`);
  const agendadas = new Set(CRONS.map((c) => c.path));
  const faltan = RUTAS.filter((r) => !agendadas.has(r) && !(r in SIN_AGENDA));
  assert.deepEqual(faltan, [],
    `sin agendar en vercel.json, y por eso no corren nunca: ${faltan.join(', ')}. ` +
    'Agrega { "path": …, "schedule": … } a "crons" (el schedule está en la cabecera del route).');
  // Y al revés: una entrada que apunta a una ruta que ya no existe es un 404 diario.
  const huerfanas = CRONS.map((c) => c.path).filter((p) => p.startsWith('/api/cron/') && !RUTAS.includes(p));
  assert.deepEqual(huerfanas, [], `vercel.json agenda rutas que no existen: ${huerfanas.join(', ')}`);
});

test('la alerta de baja (cs-sin-contacto) corre a diario a las 14:03 UTC, ANTES del resumen de la mañana', () => {
  const cron = CRONS.find((c) => c.path === '/api/cron/cs-sin-contacto');
  assert.ok(cron, 'falta { "path": "/api/cron/cs-sin-contacto", "schedule": "3 14 * * *" } en vercel.json: la alerta no corre');
  assert.equal(cron!.schedule, '3 14 * * *');
  // Antes del resumen (avisos-resumen) de la misma hora: así un negocio que pidió juntar los avisos
  // lo recibe en el resumen de ESE día y no en el de mañana (la cabecera del route lo explica).
  const resumen = CRONS.find((c) => c.path === '/api/cron/avisos-resumen');
  assert.ok(resumen, 'no encontré el cron del resumen');
  const [mA, hA] = cron!.schedule.split(' ').map(Number);
  const [mR, hR] = resumen!.schedule.split(' ').map(Number);
  assert.ok(hA === hR && mA < mR, `la alerta (${cron!.schedule}) tiene que salir antes del resumen (${resumen!.schedule})`);
});

// ── Las roturas (07/10/2026) ──────────────────────────────────────────────────
// En el worktree de la corrida, vercel.json NO tiene la entrada de cs-sin-contacto (la agrega quien
// integra): ahí este archivo da 0 pass / 2 fail, y los dos mensajes nombran la ruta y el schedule.
// En una copia del árbol (scratchpad: este test + vercel.json + app/api/cron/*/route.ts) con la
// entrada agregada: 2 pass / 0 fail. Sobre esa copia, cada rotura restaurada antes de la siguiente:
//   1. sin la entrada de cs-sin-contacto                         → 0 / 2 (los dos)
//   2. la entrada con "3 15 * * *" (después del resumen)         → 1 / 1 (el de la alerta)
//   3. una carpeta nueva app/api/cron/x-nuevo/route.ts sin agendar → 1 / 1 (el del conjunto)
//   4. una entrada a /api/cron/no-existe                          → 1 / 1 (el del conjunto)
