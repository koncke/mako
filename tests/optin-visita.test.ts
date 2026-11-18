// =============================================================================
// O44 · El opt-in de alguien que YA estaba en el CRM le ata la visita a su ficha (18/11/2026)
// =============================================================================
// El 17/10 (576a39036) la propuesta de un opt-in duplicado, al confirmarse con «enriquecer», le copió el `visitor_id` a la ficha
// que ya existía. El 14/11 (d4d759ce5, la llamada con Julio) nació un camino nuevo en app/api/track/optin/route.ts: si el email
// o el teléfono coinciden con UN solo lead, el opt-in ya no deja propuesta y se suma directo a esa ficha. Ese camino nunca
// escribía el `visitor_id`, así que la persona que se volvía a registrar quedaba sin la grabación ni el tracking de esa visita
// (la ficha se une con sus visitas por esa llave). Los dos caminos escriben ahora por UNA función (lib/lead-visita.ts).
//
// Lo que fija, corriendo el POST REAL de la ruta (tests/_optin-visita-hijo.ts, contra un PostgREST de mentira):
//   1. la persona que ya estaba se suma a su ficha (sin propuesta ni ficha nueva) y la ficha queda con la visita;
//   2. una ficha que ya tenía su visita (otro dispositivo) no se pisa;
//   3. sin cookie no se escribe nada;
//   4. la confirmación de la propuesta usa la misma función (una cosa, un lugar).
//
// Probado rompiéndolo (18/11/2026, base 4 de 4 en verde, restaurado de memoria):
//   · sin la llamada a `atarVisitaAlLead` en el camino directo de la ruta             → 1 fallo (el 1)
//   · `atarVisitaAlLead` sin el `.is('visitor_id', null)`                              → 1 fallo (el 2)
//   · `atarVisitaAlLead` que escribe aunque no venga la visita (el `if (!visita)` sacado) → 1 fallo (el 3)
//   · la confirmación de la propuesta con su propio update otra vez                    → 1 fallo (el 4)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

type Envio = { r: { status: number; body: Record<string, unknown> | null }; visita: string | null; leads?: number; propuestas?: number };
type Salida = { ana: Envio; bruno: Envio; sinCookie: Envio; red: string[] };
let salida: Salida | null = null;
const correr = (): Salida => {
  if (salida) return salida;
  const stdout = execFileSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_optin-visita-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const linea = stdout.split('\n').find((l) => l.startsWith('@@OPTIN@@'));
  assert.ok(linea, `el hijo no contestó: ${stdout.slice(-1500)}`);
  salida = JSON.parse(linea.slice('@@OPTIN@@'.length)) as Salida;
  return salida;
};

test('1. la persona que ya estaba se suma a su ficha, sin propuesta ni ficha nueva, y la ficha queda con la visita', () => {
  const { ana, red } = correr();
  assert.equal(ana.r.status, 200);
  assert.equal(ana.r.body?.existente, true, `no tomó el camino directo: ${JSON.stringify(ana.r.body)}`);
  assert.equal(ana.r.body?.lead, 501);
  assert.equal(ana.leads, 2, 'creó una ficha nueva');
  assert.equal(ana.propuestas, 0, 'dejó una propuesta');
  assert.equal(ana.visita, 'v-nueva', 'la ficha que ya existía quedó sin la llave de esta visita');
  assert.deepEqual(red, [], 'algo salió a la red');
});

test('2. una ficha que ya tenía su visita (otro dispositivo) no se pisa', () => {
  const { bruno } = correr();
  assert.equal(bruno.r.body?.existente, true);
  assert.equal(bruno.visita, 'v-de-antes');
});

test('3. sin cookie de visita no se escribe nada', () => {
  const { sinCookie } = correr();
  assert.equal(sinCookie.r.body?.existente, true);
  assert.equal(sinCookie.visita, null);
});

test('4. la confirmación de la propuesta ata la visita por la MISMA función que el opt-in', () => {
  // Un guard de cableado: lo que la función HACE lo prueban el 1, el 2 y el 3 corriéndola por la ruta.
  const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const src = sinComentarios(leer('app/crm/revisar/[id]/acciones.ts'));
  const ini = src.indexOf("const enriquecidos = (r.ids ?? []).filter((x) => x.destino === 'enriquecer');");
  assert.ok(ini > 0, 'la confirmación ya no separa las fichas que se enriquecen');
  const fin = src.indexOf('for (const x of r.ids ?? [])', ini);
  assert.ok(fin > ini);
  const bloque = src.slice(ini, fin);
  assert.match(bloque, /await atarVisitaAlLead\(x\.leadId, visitor\)/, 'la confirmación no ata la visita con lib/lead-visita.ts');
  assert.doesNotMatch(src, /update\(\{ visitor_id:/, 'la confirmación volvió a escribir la visita por su cuenta: son dos implementaciones de lo mismo');
});
