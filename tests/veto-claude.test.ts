// =============================================================================
// «Que ya no se pueda gastar con Claude directamente, que se prohíba»
// =============================================================================
// El pedido del dueño, 13/8/2026. Lo que lo hace difícil es que NO HAY UNA PUERTA A
// ANTHROPIC, HAY CINCO — y cerrar cuatro deja la quinta abierta. Ya pasó: el `fallback: []`
// del día anterior tapó dos y las otras tres siguieron cobrando US$12,79.
//
//   1. `def` pago del catálogo
//   2. fallback pago de `chatClaude`
//   3. fallback pago de `chatClaudeTools` — ni consultaba `fallbackDeFeature`
//   4. `opts.model` explícito — saltea el registro entero
//   5. el `MODEL` del módulo — feature fuera del catálogo → Opus, el más caro
//
// La #5 es la peor y explica la forma del veto: el camino de MENOS esfuerzo (escribir
// `chatClaude` sin registrar la feature) era el MÁS caro, y se leía perfecto en el diff.
//
// Estos tests son la segunda capa. La primera es que `lib/anthropic.ts` ya no tiene ni
// `MODEL` ni `ENDPOINT`: la URL sale del permiso, así que un `fetch` a Claude escrito por
// afuera no tipa.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluarPermiso, permisoDeGasto, VetoClaude, CLAUDE_PERMITIDO, permisosPorVencer, modelosPermitidos } from '../lib/veto-claude';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Los archivos de esos directorios que traen la URL de MENSAJES de Anthropic.
 *  ⚠️ `/v1/messages` y NO el dominio: lib/metodo-verificar.ts le pega a `/v1/models` para
 *  validar la key en /integraciones, no gasta un token, y tiene que seguir existiendo. */
function conLaUrl(dirs: string[]): string[] {
  const hits: string[] = [];
  const buscar = (dir: string): void => {
    for (const e of readdirSync(resolve(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!/node_modules|\.next/.test(e.name)) buscar(rel); continue; }
      if (!/\.(ts|tsx|mjs|js)$/.test(e.name)) continue;
      if (readFileSync(resolve(RAIZ, rel), 'utf8').includes('api.anthropic.com/v1/messages')) hits.push(rel);
    }
  };
  for (const d of dirs) buscar(d);
  return hits.sort();
}
const HOY = new Date('2026-08-14');

test('EL PEDIDO: una feature cualquiera NO puede pagarle a Claude', () => {
  const v = evaluarPermiso({ feature: 'mako-guardian', model: 'claude-sonnet-5', hoy: HOY });
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.razon : '', /lista blanca/);
});

test('LA QUINTA PUERTA: sin `feature` no se compra nada', () => {
  // Era la peor de todas. `chatClaude` resolvía el registro solo `if (!opts.model &&
  // opts.feature)`; sin feature no había nada que consultar y caía al `MODEL` del
  // módulo, que era `claude-opus-4-8`. Olvidarse de un parámetro costaba el modelo más
  // caro que existe, y en el diff se veía bien.
  const v = evaluarPermiso({ feature: '', model: 'claude-sonnet-5', hoy: HOY });
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.razon : '', /sin `feature`/);
  assert.equal(evaluarPermiso({ hoy: HOY }).ok, false);
});

test('una feature que NO está en el catálogo tampoco: eso es un dato que falta, no un default', () => {
  // `modeloDeFeature` devolvía null igual si no había feature que si la feature no
  // existía, y los dos caían en el mismo `else`. Seis features vivas entraron por ahí.
  const v = evaluarPermiso({ feature: 'feature-nueva-sin-registrar', model: 'claude-sonnet-5', hoy: HOY });
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.razon : '', /CATALOGO_MODELOS/);
});

test('closing SÍ puede, con Sonnet, y es la única', () => {
  const v = evaluarPermiso({ feature: 'closing', model: 'claude-sonnet-5', hoy: HOY });
  assert.equal(v.ok, true);
  assert.equal(v.ok === true && v.permiso.model, 'claude-sonnet-5');
  assert.equal(v.ok === true && v.permiso.endpoint, 'https://api.anthropic.com/v1/messages');
  assert.deepEqual(CLAUDE_PERMITIDO.map((p) => p.feature), ['closing']);
});

test('…pero NO con Opus: el permiso es por MODELO, no por feature', () => {
  // El 13/8 el dueño bajó closing de Opus a Sonnet («~60% menos»). Un permiso que dijera
  // «closing puede pagar» a secas dejaría volver a Opus sin que nadie lo decida.
  const v = evaluarPermiso({ feature: 'closing', model: 'claude-opus-4-8', hoy: HOY });
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.razon : '', /no para «claude-opus-4-8»/);
});

test('CUARTA PUERTA: `opts.model` deja de saltear el registro', () => {
  // Era la única ruta que no consultaba NADA: el lookup entero se cortaba con
  // `if (!opts.model && opts.feature)`. US$8,67 en 30 días entraron por acá.
  assert.equal(evaluarPermiso({ feature: 'mako-doer-in', model: 'claude-opus-4-8', hoy: HOY }).ok, false);
});

test('el permiso VENCE, y vencer es la decisión por default', () => {
  // Sin fecha, una excepción de hoy es una excepción para siempre y nadie la vuelve a
  // mirar. Es la misma forma del «default que cobra en silencio».
  const v = evaluarPermiso({ feature: 'closing', model: 'claude-sonnet-5', hoy: new Date('2027-01-01') });
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.razon : '', /venció/);
});

test('el vencimiento se avisa ANTES, no el día que se apaga closing', () => {
  assert.equal(permisosPorVencer(14, new Date('2026-08-14')).length, 0);
  assert.equal(permisosPorVencer(14, new Date('2026-11-05')).length, 1);
});

test('EL INTERRUPTOR DE PÁNICO apaga hasta lo autorizado', () => {
  const v = evaluarPermiso({ feature: 'closing', model: 'claude-sonnet-5', pausa: true, hoy: HOY });
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.razon : '', /PAUSADO/);
});

test('sin modelo explícito cae al `def` DEL CATÁLOGO, no a Opus', () => {
  // Import estático, no la base: con `modeloDeFeature` caído (un blip de Supabase) el
  // modelo quedaba en '' y la única feature autorizada se apagaba sola. Un default
  // POSITIVO y acotado a lo ya permitido no abre nada; la ausencia de regla sí.
  const v = evaluarPermiso({ feature: 'closing', hoy: HOY });
  assert.equal(v.ok, true);
  assert.equal(v.ok === true && v.permiso.model, 'claude-sonnet-5');
});

test('`permisoDeGasto` CORTA con un error que dice qué hacer', () => {
  assert.throws(() => permisoDeGasto({ feature: 'mako-guardian', model: 'claude-sonnet-5', hoy: HOY }),
    (e: unknown) => e instanceof VetoClaude && /lista blanca/.test(e.message));
  assert.doesNotThrow(() => permisoDeGasto({ feature: 'closing', model: 'claude-sonnet-5', hoy: HOY }));
});

test('modelosPermitidos: /modelos-ia no puede ofrecer un modelo que el veto va a rechazar', () => {
  assert.deepEqual(modelosPermitidos('closing'), ['claude-sonnet-5']);
  assert.deepEqual(modelosPermitidos('mako-guardian'), []);
});

// ---------------------------------------------------------------------------
// La capa que no depende de que nadie se acuerde
// ---------------------------------------------------------------------------

test('EL FETCH A ANTHROPIC VIVE EN UN SOLO ARCHIVO', () => {
  // Cerrar cuatro puertas y dejar la quinta es exactamente lo que pasó ayer. Si aparece
  // otro archivo con la URL de mensajes, el veto ya no es la única puerta.
  //
  // ⚠️ El grep es sobre `/v1/messages` y NO sobre el dominio: lib/metodo-verificar.ts le
  // pega a `/v1/models` para validar la key en /integraciones, no gasta un token, y tiene
  // que seguir existiendo.
  const hits = conLaUrl(['lib', 'app']);
  assert.deepEqual(hits, ['lib/veto-claude.ts'],
    `La URL de mensajes de Anthropic tiene que estar SOLO en el veto. Apareció en:\n  ${hits.join('\n  ')}`);
});

test('los SCRIPTS que le pegan a Anthropic por afuera son estos TRES y ninguno más', () => {
  // El veto vive en el producto. Estos corren a mano, desde la terminal del dueño y con
  // su key: vetarlos rompería el mantenimiento (re-analizar llamadas viejas, backfills)
  // por un gasto que él está mirando en el momento de tipear el comando.
  //
  // Pero SIN ESTA LISTA serían un agujero invisible: un script nuevo que copie el fetch
  // de otro no lo ve nadie. Acá aparece en el diff, que es la diferencia entre una
  // excepción y una filtración. Si sumás uno, sumalo también acá y decí por qué.
  const SABIDOS = [
    'scripts/backfill-closing.mjs',            // re-analiza llamadas viejas de closing
    'scripts/backfill-script-analyst.mjs',     // idem para el analista de guiones
    'scripts/closing-v2-analyze-api.mjs',      // la corrida v2 del análisis de llamadas
  ];
  assert.deepEqual(conLaUrl(['scripts']), SABIDOS.sort());
});

test('`lib/anthropic.ts` no tiene un modelo de Claude por default', () => {
  // El `const MODEL = 'claude-opus-4-8'` era la quinta puerta. Que no vuelva.
  const src = readFileSync(resolve(RAIZ, 'lib', 'anthropic.ts'), 'utf8');
  assert.doesNotMatch(src, /const\s+MODEL\s*=/, 'volvió el modelo por default del módulo');
  assert.doesNotMatch(src, /const\s+ENDPOINT\s*=/, 'volvió la URL suelta: el fetch tiene que sacarla del permiso');
});

test('el cast a PermisoClaude existe UNA sola vez, y es en el veto', () => {
  // La marca de tipo es lo que impide fabricar un permiso desde otro módulo. Un
  // `as PermisoClaude` en cualquier otro lado la desarma.
  const hits: string[] = [];
  const buscar = (dir: string): void => {
    for (const e of require('node:fs').readdirSync(resolve(RAIZ, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!/node_modules|\.next/.test(e.name)) buscar(rel); continue; }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      if (/as\s+PermisoClaude/.test(readFileSync(resolve(RAIZ, rel), 'utf8'))) hits.push(rel);
    }
  };
  for (const d of ['lib', 'app']) buscar(d);
  assert.deepEqual(hits, ['lib/veto-claude.ts']);
});
