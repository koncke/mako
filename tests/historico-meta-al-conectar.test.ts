// =============================================================================
// El histórico de Meta arranca al CONECTAR Meta, no sólo en el wizard
// =============================================================================
// Hasta el 16/10/2026 el único que arrancaba la extracción histórica (365 días de métricas, 90 de leads,
// la transcripción de los anuncios) era `OnboardingWizard.tsx:274`, al verificar Meta en su pantalla. El
// cron (app/api/cron/onboarding-extraccion) sólo SIGUE las que están corriendo. O sea que quien postergaba
// Meta y lo conectaba después desde /integraciones se quedaba sin su histórico, sin un error. Y con el chat
// de Offer como onboarding (Martín: «el onboarding será ese chat de offer»), Meta se posterga siempre: sin
// esto, NINGÚN negocio nuevo volvía a tener su histórico. Cerebro, el mismo día: «conectar Meta sin wizard →
// arranca una vez; reconectar → no duplica».
//
// Lo que se prueba:
//   · la regla, ejecutándola (lib/onboarding-contrato.ts, pura): cuándo hay que arrancar, y que arrancar dos
//     veces no toca lo que ya corre ni lo hecho;
//   · el cableado: cada puerta que guarda Meta lo llama, se lee estricto, y una puerta NUEVA que guarde
//     credenciales falla acá hasta que alguien decida si conecta Meta.
//
// Correr: npx tsx --test tests/historico-meta-al-conectar.test.ts
//
// PROBADO ROMPIÉNDOLO el 16/10/2026, cada rotura restaurada DE MEMORIA. Base: 8 pasan, 0 fallan.
//   (los números de cada rotura, al pie del archivo)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  estadoInicial, estadoDeLoGuardado, historicoMetaPorArrancar, reevaluarExtraccion, JOB_KEYS, JOBS_DE_META,
  type JobKey,
} from '../lib/onboarding-contrato';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')   // las líneas PRIMERO
  .replace(/\/\*[\s\S]*?\*\//g, ''); // y los bloques después
/** Desde `desde` hasta `hasta` (exclusivo), sobre el texto sin comentarios. Tira si no encuentra el inicio. */
function bloque(src: string, desde: string, hasta: string): string {
  const s = sinComentarios(src);
  const i = s.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = s.indexOf(hasta, i + desde.length);
  return s.slice(i, j < 0 ? undefined : j);
}

const AHORA = '2026-10-16T12:00:00.000Z';
/** Lo que contesta `jobAplica` para un negocio con Meta y sin Fathom ni VSL. */
const CON_META = Object.fromEntries(JOB_KEYS.map((k) => [k, JOBS_DE_META.includes(k)
  ? { aplica: true } : { aplica: false, motivo: 'no conectado' }])) as Record<JobKey, { aplica: boolean; motivo?: string }>;

test('conectar Meta sin el wizard arranca el histórico, y reconectar no lo repite', () => {
  // Un negocio que terminó el onboarding con Meta postergado: el histórico nunca arrancó.
  const s = estadoInicial('done');
  assert.equal(historicoMetaPorArrancar(s.extraction), true, 'conectar Meta después del onboarding no arranca el histórico');

  reevaluarExtraccion(s, CON_META, AHORA);
  assert.equal(s.extraction.status, 'running');
  for (const k of JOBS_DE_META) assert.equal(s.extraction.jobs[k].status, 'pending', `${k} no quedó por correr`);
  assert.equal(s.extraction.jobs.fathom_calls.status, 'skipped');
  assert.equal(s.status, 'done', 'arrancar el histórico le tocó el estado del onboarding');

  // Reconectar: ya está pendiente, no hay nada que arrancar.
  assert.equal(historicoMetaPorArrancar(s.extraction), false, 'reconectar vuelve a arrancar el histórico');

  // Y aunque se vuelva a evaluar con el cron a mitad de camino, lo que corre y lo hecho no se tocan.
  s.extraction.jobs.meta_metrics = { status: 'running', cursor: '2026-03-01', detail: 'día 230/365' };
  s.extraction.jobs.meta_leads = { status: 'done', detail: '412 leads' };
  reevaluarExtraccion(s, CON_META, AHORA);
  assert.deepEqual(s.extraction.jobs.meta_metrics, { status: 'running', cursor: '2026-03-01', detail: 'día 230/365' },
    'volver a arrancar reinició las métricas que ya estaban corriendo');
  assert.equal(s.extraction.jobs.meta_leads.status, 'done', 'volver a arrancar repite los leads ya traídos');
});

test('lo que quedó salteado o con error se retoma al conectar: la página elegida después, un token que no servía', () => {
  // El wizard corrió sin Meta, o con varias páginas y ninguna elegida todavía: los leads quedaron salteados.
  const s = estadoInicial('done');
  reevaluarExtraccion(s, { ...CON_META, meta_leads: { aplica: false, motivo: 'Falta token de página o ID de página' } }, AHORA);
  assert.equal(s.extraction.jobs.meta_leads.status, 'skipped');
  assert.equal(historicoMetaPorArrancar(s.extraction), true, 'elegir la página después no trae los leads del histórico');
  reevaluarExtraccion(s, CON_META, AHORA);
  assert.equal(s.extraction.jobs.meta_leads.status, 'pending');

  const conError = estadoInicial('done');
  conError.extraction.status = 'error';
  conError.extraction.jobs.meta_metrics = { status: 'error', error: 'token de Meta inválido' };
  assert.equal(historicoMetaPorArrancar(conError.extraction), true, 'reconectar con un token bueno no retoma lo que falló');
});

test('lo que no es de Meta no lo arranca: un Fathom salteado no es motivo', () => {
  const s = estadoInicial('done');
  reevaluarExtraccion(s, CON_META, AHORA);
  for (const k of JOBS_DE_META) s.extraction.jobs[k] = { status: 'done' };
  s.extraction.status = 'done';
  assert.equal(s.extraction.jobs.fathom_calls.status, 'skipped');
  assert.equal(historicoMetaPorArrancar(s.extraction), false);
});

test('lo guardado se lee igual que siempre, y un JSON roto TIRA (quien escribe no puede inventar el estado)', () => {
  assert.deepEqual(estadoDeLoGuardado(null), estadoInicial());
  assert.throws(() => estadoDeLoGuardado('{roto'), 'un estado que no se entiende se convirtió en el inicial');
  const viejo = JSON.stringify({ status: 'done', steps: { fase: { done: true } }, extraction: { status: 'done', jobs: { meta_metrics: { status: 'done' } } } });
  const s = estadoDeLoGuardado(viejo);
  assert.equal(s.status, 'done');
  assert.equal(s.steps.fase.done, true);
  assert.equal(s.steps.productos.done, false, 'un paso que no estaba guardado no se completó con el esqueleto');
  assert.equal(s.extraction.jobs.meta_metrics.status, 'done');
  assert.equal(s.extraction.jobs.meta_leads.status, 'pending', 'un trabajo que no estaba guardado no se completó con el esqueleto');
});

test('el arranque lee ESTRICTO, sólo para negocios con onboarding y nunca el ws1, y no tumba la conexión', () => {
  const src = leer('lib/onboarding-extract.ts');
  const arranque = bloque(src, 'export async function arrancarHistoricoAlConectarMeta', '\nexport ');
  assert.match(arranque, /getEstadoOnboardingEstricto\(\)/, 'el arranque lee el estado tolerante: con la base caída pisaría un onboarding terminado');
  assert.doesNotMatch(arranque, /getEstadoOnboarding\(\)/);
  assert.match(arranque, /ws === OWNER_WS\) return 'no corresponde'/, 'el ws1 corre la extracción del onboarding');
  assert.match(arranque, /pasosDeCapaActual\(\)\)\.length === 0\) return 'no corresponde'/, 'la plataforma corre la extracción del onboarding');
  assert.match(arranque, /if \(!historicoMetaPorArrancar\(s\.extraction\)\) return 'ya estaba'/, 'reconectar vuelve a arrancar');
  assert.match(arranque, /await iniciarExtraccion\(s\)/, 'el arranque vuelve a leer el estado (tolerante) en vez de usar el que leyó estricto');

  const fondo = bloque(src, 'export async function arrancarHistoricoEnSegundoPlano', '\nexport ');
  assert.match(fondo, /after\(\(\) => runWithWorkspace\(ws, trabajo\)\)/, 'la conexión espera al histórico');
  assert.match(fondo, /await runWithWorkspace\(ws, trabajo\)/, 'sin request no corre');
  assert.match(fondo, /catch \(e\)/, 'un error del histórico tumba la conexión');

  // La decisión pura es LA que usa `iniciarExtraccion`: dos copias de la regla se separan.
  const iniciar = bloque(src, 'export async function iniciarExtraccion', '\nexport ');
  assert.match(iniciar, /reevaluarExtraccion\(s, aplica, ahora\(\)\)/);
  assert.doesNotMatch(iniciar, /extraction\.status = 'running'/, 'iniciarExtraccion volvió a tener su propia copia de la regla');
});

test('cada puerta que guarda Meta arranca el histórico', () => {
  const conexion = bloque(leer('lib/meta-conexion.ts'), 'export async function guardarConexionMeta', '\nexport ');
  const iLoop = conexion.indexOf('for (const [env, valor] of aGuardar)');
  const iArranque = conexion.indexOf('arrancarHistoricoEnSegundoPlano(ws)');
  assert.ok(iArranque > iLoop && iLoop > 0, 'pegar el token o «Conectar con Meta» no arranca el histórico (o lo arranca antes de guardar)');
  assert.ok(conexion.indexOf('if (!d.ok) return') < iArranque, 'un token que no sirve arranca el histórico');

  const credencial = leer('app/api/integraciones/credencial/route.ts');
  assert.match(bloque(credencial, "body.action === 'guardar'", "body.action === 'descubrir-github'"),
    /servicio\.key === 'meta' && guardadas > 0\) await arrancarHistoricoEnSegundoPlano\(ctx\.ws\)/,
    'guardar los campos de Meta a mano no arranca el histórico');
  assert.match(bloque(credencial, "body.action === 'elegir'", "body.action === 'borrar'"),
    /if \(!conflicto\) await arrancarHistoricoEnSegundoPlano\(ctx\.ws\)/,
    'elegir la cuenta o la página no arranca el histórico');

  assert.match(bloque(leer('app/api/metodo/route.ts'), "body.action === 'guardar'", "body.action === 'borrar'"),
    /servicio\.key === 'meta' && guardadas > 0\)[\s\S]*arrancarHistoricoEnSegundoPlano\(ws\)/);
  const onboarding = leer('app/api/onboarding/route.ts');
  assert.match(bloque(onboarding, "case 'guardar': {", "case 'verificar': {"),
    /servicio\.key === 'meta' && guardados > 0\)[\s\S]*arrancarHistoricoEnSegundoPlano\(ws\)/);
  // «Simular» copia las credenciales del ws1 (Mauricio, un cliente) al de prueba: arrancar ahí el histórico
  // traería SUS leads al otro workspace.
  assert.doesNotMatch(bloque(onboarding, "case 'simular': {", "case 'clonar-dueno'"), /arrancarHistorico/,
    'simular arranca el histórico con las credenciales de Mauricio');

  // El botón «Conectar con Meta» llega por guardarConexionMeta.
  assert.match(sinComentarios(leer('app/api/integraciones/meta/callback/route.ts')), /guardarConexionMeta\(/);
});

test('una puerta NUEVA que guarde credenciales tiene que decidir si conecta Meta', () => {
  // En positivo: cada archivo que llama a guardarCredencial dice si guarda Meta (y entonces arranca el
  // histórico) o por qué no. Uno nuevo falla acá hasta que alguien lo decida.
  const PUERTAS: Record<string, string> = {
    'lib/meta-conexion.ts': 'Meta: pegar el token y «Conectar con Meta»',
    'app/api/integraciones/credencial/route.ts': 'Meta: guardar a mano y elegir la cuenta o la página (y GitHub, que no es Meta)',
    'app/api/metodo/route.ts': 'cualquier servicio, Meta incluido',
    'app/api/onboarding/route.ts': 'cualquier servicio en el wizard (Meta incluido) · «simular» queda afuera: son las credenciales de Mauricio',
  };
  const NO_ES_META: Record<string, string> = {
    'lib/cobros-conexion.ts': 'las pasarelas de pago',
    'lib/credenciales.ts': 'la migración de las envs viejas (la declaración vive acá)',
    'lib/datos-mau.ts': 'la copia de los datos de Mauricio, que nunca arranca un onboarding',
  };
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('app/admin/dev/'));
  const llaman = archivos.filter((f) => /\bguardarCredencial\(/.test(sinComentarios(leer(f)).replace(/export async function guardarCredencial\(/, '')));
  const sinDecidir = llaman.filter((f) => !(f in PUERTAS) && !(f in NO_ES_META));
  assert.deepEqual(sinDecidir, [], 'una puerta nueva guarda credenciales sin decidir si arranca el histórico de Meta');
  for (const f of Object.keys(PUERTAS)) {
    assert.ok(llaman.includes(f), `${f} ya no guarda credenciales: sacalo de la lista`);
    assert.match(sinComentarios(leer(f)), /arrancarHistoricoEnSegundoPlano\(/, `${f} guarda Meta y no arranca el histórico`);
  }
  for (const f of Object.keys(NO_ES_META)) assert.ok(llaman.includes(f), `${f} ya no guarda credenciales: sacalo de la lista`);
});

test('el cron describe quién arranca la extracción', () => {
  const cron = leer('app/api/cron/onboarding-extraccion/route.ts');
  assert.doesNotMatch(cron, /solo se dispara al\s*\n?\s*\/\/\s*verificar esa credencial/, 'el cron sigue diciendo que la arranca sólo el wizard');
  assert.match(cron, /arrancarHistoricoEnSegundoPlano/);
});

// ROTURAS (16/10/2026), base 8/0:
//   - guardarConexionMeta sin el arranque                         → 6/2
//   - elegir la cuenta o la página sin el arranque                → 7/1
//   - guardar los campos de Meta a mano sin el arranque           → 7/1
//   - la decisión ignora lo salteado (sólo idle y error)          → 7/1
//   - reevaluar reinicia lo que ya corre                          → 7/1
//   - el arranque lee el estado tolerante                         → 7/1
//   - el ws1 corre el histórico                                   → 7/1
//   - la conexión espera al histórico (sin `after`)               → 7/1
//   - «simular» arranca con las credenciales de Mauricio          → 7/1
//   - una puerta nueva guarda credenciales sin decidir            → 7/1
