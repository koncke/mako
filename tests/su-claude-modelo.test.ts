// =============================================================================
// IA5 (22/10/2026): el negocio elige el modelo de SU Claude (no sólo Haiku), y lo paga su cuenta
// =============================================================================
// Con la clave del negocio sólo se podía usar claude-haiku-4-5 (lib/veto-claude.ts), y el Closing Analyst necesita Sonnet
// (IA12). Ahora la puerta 2 suma Sonnet cuando el negocio lo elige en «Tus cuentas de IA». Lo que fija este test:
//   1. el veto: el modelo elegido pasa si es de la lista; Haiku por default; uno fuera de la lista no; la frontera (una copia
//      de la clave de la plataforma) y el Plan siguen cerrados;
//   2. el crédito de Max de la PLATAFORMA puesto como clave de un negocio (el ws10: Martín le puso su cuenta 2) va con Haiku
//      aunque elija Sonnet, y si no se pueden leer las claves del crédito, también;
//   3. corriendo la puerta real (tests/_su-claude-modelo-hijo.ts): el ws3 le pide Sonnet a Anthropic con su clave y la marca
//      del negocio en el gasto; el ws10, Haiku; el Plan, nada.
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada):
//   · el veto sin mirar el crédito → 2 y 3 en rojo;
//   · «no pude leer el crédito» habilitando Sonnet → 2 en rojo;
//   · la puerta sin leer el modelo elegido (siempre Haiku) → 3 en rojo;
//   · Opus en la lista → 1 en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { CLAUDE_CON_CLAVE_DEL_NEGOCIO, MODELO_SU_CLAUDE, evaluarClaveDelNegocio, modeloDeSuClaude } from '../lib/veto-claude';

const RAIZ = join(__dirname, '..');
const NEGOCIO = 'sk-ant-api03-del-negocio-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const PLATAFORMA = ['sk-ant-api03-de-mako-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'];
const CREDITO = 'sk-ant-api03-credito-de-max-zzzzzzzzzzzzzzzzzzzzzzzzz';

test('1. el veto: el modelo elegido, Haiku por default, nada fuera de la lista, y la frontera y el Plan cerrados', () => {
  assert.deepEqual([...CLAUDE_CON_CLAVE_DEL_NEGOCIO.modelos], ['claude-haiku-4-5', 'claude-sonnet-5'], 'Haiku primero (default) y Sonnet; Opus no');
  const sonnet = evaluarClaveDelNegocio({ feature: 'closing', clave: NEGOCIO, clavesPlataforma: PLATAFORMA, model: MODELO_SU_CLAUDE.sonnet, creditosPlataforma: [CREDITO] });
  assert.ok(sonnet.ok && sonnet.permiso.model === 'claude-sonnet-5');
  const sinElegir = evaluarClaveDelNegocio({ feature: 'closing', clave: NEGOCIO, clavesPlataforma: PLATAFORMA, creditosPlataforma: [] });
  assert.ok(sinElegir.ok && sinElegir.permiso.model === 'claude-haiku-4-5');
  assert.equal(evaluarClaveDelNegocio({ feature: 'closing', clave: NEGOCIO, clavesPlataforma: PLATAFORMA, model: 'claude-opus-5-5', creditosPlataforma: [] }).ok, false);
  assert.equal(evaluarClaveDelNegocio({ feature: 'closing', clave: PLATAFORMA[0], clavesPlataforma: PLATAFORMA, model: MODELO_SU_CLAUDE.sonnet, creditosPlataforma: [] }).ok, false, 'una copia de la de MaKo sigue rechazada');
  assert.equal(evaluarClaveDelNegocio({ feature: 'plan-fathom', clave: NEGOCIO, clavesPlataforma: PLATAFORMA, model: MODELO_SU_CLAUDE.sonnet, creditosPlataforma: [] }).ok, false, 'el Plan nunca paga IA');
  assert.equal(modeloDeSuClaude('sonnet'), 'claude-sonnet-5');
  assert.equal(modeloDeSuClaude('opus'), 'claude-haiku-4-5', 'lo guardado que no está en la lista es el barato');
  assert.equal(modeloDeSuClaude(null), 'claude-haiku-4-5');
});

test('2. el crédito de Max de la plataforma como clave de un negocio va con Haiku, y sin poder leerlo también', () => {
  const credito = evaluarClaveDelNegocio({ feature: 'closing', clave: CREDITO, clavesPlataforma: PLATAFORMA, model: MODELO_SU_CLAUDE.sonnet, creditosPlataforma: [null, ` ${CREDITO} `] });
  assert.ok(credito.ok && credito.permiso.model === 'claude-haiku-4-5', 'lo paga Martín: el barato');
  const sinLeer = evaluarClaveDelNegocio({ feature: 'closing', clave: NEGOCIO, clavesPlataforma: PLATAFORMA, model: MODELO_SU_CLAUDE.sonnet, creditosPlataforma: null });
  assert.ok(sinLeer.ok && sinLeer.permiso.model === 'claude-haiku-4-5', '«no pude leer» nunca habilita gastar más');
});

test('3. la puerta real: el ws3 pide Sonnet con su clave y su marca; el ws10 (el crédito), Haiku; el Plan, nada', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_su-claude-modelo-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const r = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  assert.equal(r.error, undefined, r.error);
  assert.deepEqual(r.pedidos, [{ ws: 3, model: 'claude-sonnet-5' }, { ws: 10, model: 'claude-haiku-4-5' }]);
  assert.equal(r.plan, null);
  for (const g of r.gasto as Array<{ motivo: string }>) assert.match(g.motivo, /^⚠ clave de Anthropic del negocio/, 'lo paga el negocio: su marca primero');
});

// ── Lo que encontró la revisión adversarial de IA5 (22/10/2026) ───────────────────────────────────────────────────────
test('4. lo heredado no es una elección: «constructor» o «toString» guardados son Haiku, y la ruta no los acepta', async () => {
  const { esEleccionSuClaude } = await import('../lib/veto-claude');
  for (const x of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 1, null, undefined]) {
    assert.equal(esEleccionSuClaude(x), false, String(x));
    assert.equal(modeloDeSuClaude(x), 'claude-haiku-4-5', String(x));
  }
  assert.ok(esEleccionSuClaude('haiku') && esEleccionSuClaude('sonnet'));
  const ruta = readFileSync(join(RAIZ, 'app/api/ia-del-negocio/modelo/route.ts'), 'utf8');
  assert.match(ruta, /if \(!esEleccionSuClaude\(modelo\)\) return/);
  assert.doesNotMatch(ruta, / in MODELO_SU_CLAUDE/);
});

test('5. toda función de IA del Plan está en FEATURES_DEL_PLAN: la puerta 2 no la deja pagar con la clave del negocio', async () => {
  const { FEATURES_DEL_PLAN } = await import('../lib/veto-claude');
  const archivos = execFileSync('git', ['ls-files', 'app/api/plan*', 'app/plan/**', 'lib/plan-*.ts', 'lib/plan/**', 'lib/cerrar-por-commits.ts', 'lib/mako-guardian.ts', 'lib/checklist-coach.ts'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  assert.ok(archivos.length > 10, `el barrido no encontró el Plan (${archivos.length} archivos)`);
  const usadas = new Set<string>();
  for (const f of archivos) {
    for (const m of readFileSync(join(RAIZ, f), 'utf8').matchAll(/\bfeature:\s*'([a-z][a-z0-9-]*)'/g)) usadas.add(m[1]);
  }
  assert.ok(usadas.has('plan-buscar') && usadas.has('cerrar-por-commits'), `el barrido no ve las dos de la revisión: ${[...usadas]}`);
  const afuera = [...usadas].filter((f) => !FEATURES_DEL_PLAN.includes(f));
  assert.deepEqual(afuera, [], `funciones del Plan que pagarían IA con la clave del negocio: ${afuera.join(', ')}`);
});
