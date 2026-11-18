// =============================================================================
// O45 · Traer los contactos de un grupo de WhatsApp por el chat: a qué funnel van lo dice la persona (18/11/2026)
// =============================================================================
// En la pantalla, lo extraído entra al CRM que se mira (cb24330c6, 26/10: «siempre en el CRM en el que estoy parado»). Por el chat
// de MaKo no hay CRM «que se mira», y `traer_contactos_de_grupo` caía sin `embudoId` en el CRM «Prospección» o en el principal
// (`funnelPorDefecto`), con una tarjeta que nombraba la etapa y no el funnel: la persona confirmaba sin saber a cuál iban. Pasó
// con Leila en la llamada del 30/10. Ahora, corriendo el preparar() REAL (tests/_traer-grupo-funnel-hijo.ts):
//   1. con un solo funnel, ése, y la tarjeta lo nombra;
//   2. con dos o más y sin `embudoId`, no se propone: vuelve un error que pide el dato y lista los funnels (nunca elige uno);
//   3. con `embudoId`, ése, nombrado en la tarjeta;
//   4. uno que no es del negocio se rechaza, y la base caída es una falla nuestra, no «hay uno».
//
// Probado rompiéndolo (18/11/2026, base 5 de 5 en verde, restaurado de memoria):
//   · sin la pregunta con dos o más (vuelve el default)               → 1 fallo (el 2)
//   · la tarjeta sin el nombre del funnel                              → 2 fallos (el 1 y el 3)
//   · `listarFunnels` en vez de `leerFunnels` (la base caída es «[]») → 1 fallo (el 4)
//   · la descripción de `embudoId` que vuelve a prometer el default   → 1 fallo (el 5)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { porId } from '../lib/api-mako/registro';
import { esAccion, type AccionDef } from '../lib/api-mako/tipos';

const RAIZ = join(__dirname, '..');

type Prep = { payload?: Record<string, unknown>; resumen?: string; error?: string; faltan?: string[]; disponibles?: Array<{ id: number; nombre: string }>; falla?: boolean };
type Salida = { uno: Prep; dosSinElegir: Prep; dosElegido: Prep; ajeno: Prep; caidos: Prep; red: string[] };
let salida: Salida | null = null;
const correr = (): Salida => {
  if (salida) return salida;
  const stdout = execFileSync(process.execPath, ['--conditions=react-server', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_traer-grupo-funnel-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 180_000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const linea = stdout.split('\n').find((l) => l.startsWith('@@TRAER@@'));
  assert.ok(linea, `el hijo no contestó: ${stdout.slice(-1500)}`);
  salida = JSON.parse(linea.slice('@@TRAER@@'.length)) as Salida;
  return salida;
};

test('1. con un solo funnel, sin embudoId: ése, y la tarjeta dice a qué funnel van', () => {
  const { uno, red } = correr();
  assert.equal(uno.payload?.funnelId, 41, JSON.stringify(uno));
  assert.match(String(uno.resumen), /al funnel «Ventas», en «/, 'la tarjeta no nombra el funnel');
  assert.deepEqual(red, [], 'algo salió a la red');
});

test('2. con dos funnels y sin embudoId no se propone: se pregunta, con los dos, y nunca se elige uno', () => {
  const { dosSinElegir: d } = correr();
  assert.equal(d.payload, undefined, `eligió un funnel por su cuenta: ${JSON.stringify(d.payload)}`);
  assert.deepEqual(d.faltan, ['embudoId']);
  assert.deepEqual(d.disponibles, [{ id: 41, nombre: 'Ventas' }, { id: 42, nombre: 'Prospección' }]);
  assert.match(String(d.error), /tiene 2 funnels: pregúntale a la persona a cuál van los contactos \(«Ventas», «Prospección»\)/);
});

test('3. con embudoId, ése (aunque haya un «Prospección»), nombrado en la tarjeta', () => {
  const { dosElegido: e } = correr();
  assert.equal(e.payload?.funnelId, 41);
  assert.match(String(e.resumen), /al funnel «Ventas»/);
});

test('4. un funnel ajeno se rechaza, y con la base caída es una falla nuestra (no «hay uno»)', () => {
  const { ajeno, caidos } = correr();
  assert.match(String(ajeno.error), /no es de este negocio/);
  assert.equal(caidos.falla, true, `con la base caída: ${JSON.stringify(caidos)}`);
  assert.equal(caidos.payload, undefined);
});

test('5. lo que lee el modelo pide preguntar el funnel cuando hay más de uno, y ya no promete «Prospección» por defecto', () => {
  const d = porId('traer_contactos_de_grupo');
  assert.ok(d && esAccion(d));
  const embudo = (d as AccionDef).parametros.find((p) => p.nombre === 'embudoId');
  assert.ok(embudo, 'el parámetro embudoId desapareció');
  assert.match(embudo.descripcion, /más de uno, pregúntale a la persona a cuál van/);
  assert.doesNotMatch(embudo.descripcion, /Prospección/, 'la descripción vuelve a prometer un funnel por defecto');
});
