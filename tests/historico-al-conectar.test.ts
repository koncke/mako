// =============================================================================
// El histórico arranca al CONECTAR una integración, no sólo en el wizard
// =============================================================================
// Hasta el 16/10/2026 el único que arrancaba la extracción histórica (365 días de métricas de Meta, 90 de
// leads, los anuncios, las llamadas de Fathom, el VSL de YouTube o Panda) era `OnboardingWizard.tsx:274`, al
// verificar Meta en su pantalla. El cron (app/api/cron/onboarding-extraccion) sólo SIGUE las que están
// corriendo. O sea que quien postergaba una integración y la conectaba después desde /integraciones se
// quedaba sin su histórico, sin un error. Y con el chat de Offer como onboarding (Martín: «el onboarding será
// ese chat de offer»), las integraciones se postergan siempre: sin esto, NINGÚN negocio nuevo volvía a tener
// su histórico. Cerebro, el mismo día: «conectar Meta sin wizard → arranca una vez; reconectar → no duplica»,
// y después lo mismo para Fathom, YouTube y Panda.
//
// Lo que se prueba:
//   · la regla, ejecutándola (lib/onboarding-contrato.ts, pura): cuándo hay que arrancar cada parte, y que
//     arrancar dos veces no toca lo que ya corre ni lo hecho;
//   · el cableado: cada puerta que guarda una integración lo llama con su servicio, se lee estricto, el VSL
//     lee los videos donde /integraciones los guarda, y una puerta NUEVA que guarde credenciales falla acá
//     hasta que alguien decida.
//
// Correr: npx tsx --test tests/historico-al-conectar.test.ts
//
// PROBADO ROMPIÉNDOLO el 16/10/2026, cada rotura restaurada DE MEMORIA (los números, al pie del archivo).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  estadoInicial, estadoDeLoGuardado, historicoPorArrancar, reevaluarExtraccion, sirveAlHistorico,
  JOB_KEYS, JOBS_DE_META, JOBS_DEL_HISTORICO, type JobKey,
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
type Aplica = Record<JobKey, { aplica: boolean; motivo?: string }>;
/** Lo que contesta `jobAplica` para un negocio con estas integraciones conectadas. */
const con = (...servicios: string[]): Aplica => {
  const conectados = new Set(servicios.flatMap((s) => JOBS_DEL_HISTORICO[s] ?? []));
  return Object.fromEntries(JOB_KEYS.map((k) => [k, conectados.has(k) ? { aplica: true } : { aplica: false, motivo: 'no conectado' }])) as Aplica;
};

test('conectar Meta sin el wizard arranca el histórico, y reconectar no lo repite', () => {
  // Un negocio que terminó el onboarding con Meta postergado: el histórico nunca arrancó.
  const s = estadoInicial('done');
  assert.equal(historicoPorArrancar(s.extraction, 'meta'), true, 'conectar Meta después del onboarding no arranca el histórico');

  reevaluarExtraccion(s, con('meta'), AHORA);
  assert.equal(s.extraction.status, 'running');
  for (const k of JOBS_DE_META) assert.equal(s.extraction.jobs[k].status, 'pending', `${k} no quedó por correr`);
  assert.equal(s.extraction.jobs.fathom_calls.status, 'skipped');
  assert.equal(s.status, 'done', 'arrancar el histórico le tocó el estado del onboarding');

  // Reconectar: ya está pendiente, no hay nada que arrancar.
  assert.equal(historicoPorArrancar(s.extraction, 'meta'), false, 'reconectar vuelve a arrancar el histórico');

  // Y aunque se vuelva a evaluar con el cron a mitad de camino, lo que corre y lo hecho no se tocan.
  s.extraction.jobs.meta_metrics = { status: 'running', cursor: '2026-03-01', detail: 'día 230/365' };
  s.extraction.jobs.meta_leads = { status: 'done', detail: '412 leads' };
  reevaluarExtraccion(s, con('meta'), AHORA);
  assert.deepEqual(s.extraction.jobs.meta_metrics, { status: 'running', cursor: '2026-03-01', detail: 'día 230/365' },
    'volver a arrancar reinició las métricas que ya estaban corriendo');
  assert.equal(s.extraction.jobs.meta_leads.status, 'done', 'volver a arrancar repite los leads ya traídos');
});

test('lo que quedó salteado o con error se retoma al conectar: la página elegida después, un token que no servía', () => {
  // El wizard corrió sin Meta, o con varias páginas y ninguna elegida todavía: los leads quedaron salteados.
  const s = estadoInicial('done');
  reevaluarExtraccion(s, { ...con('meta'), meta_leads: { aplica: false, motivo: 'Falta token de página o ID de página' } }, AHORA);
  assert.equal(s.extraction.jobs.meta_leads.status, 'skipped');
  assert.equal(historicoPorArrancar(s.extraction, 'meta'), true, 'elegir la página después no trae los leads del histórico');
  reevaluarExtraccion(s, con('meta'), AHORA);
  assert.equal(s.extraction.jobs.meta_leads.status, 'pending');

  const conError = estadoInicial('done');
  conError.extraction.status = 'error';
  conError.extraction.jobs.meta_metrics = { status: 'error', error: 'token de Meta inválido' };
  assert.equal(historicoPorArrancar(conError.extraction, 'meta'), true, 'reconectar con un token bueno no retoma lo que falló');
});

test('conectar Fathom, YouTube o Panda después revive SU parte, sin tocar la de Meta', () => {
  // El histórico de Meta ya corrió entero; Fathom y el VSL quedaron salteados porque no estaban conectados.
  const s = estadoInicial('done');
  reevaluarExtraccion(s, con('meta'), AHORA);
  for (const k of JOBS_DE_META) s.extraction.jobs[k] = { status: 'done', detail: 'listo' };
  s.extraction.status = 'done';
  assert.equal(s.extraction.jobs.fathom_calls.status, 'skipped');
  assert.equal(s.extraction.jobs.vsl_metrics.status, 'skipped');

  // Lo que no es de esa integración no la arranca: con Meta hecho, reconectar Meta no tiene nada que hacer.
  assert.equal(historicoPorArrancar(s.extraction, 'meta'), false, 'un Fathom salteado arranca el histórico al reconectar Meta');
  assert.equal(historicoPorArrancar(s.extraction, 'fathom'), true, 'conectar Fathom después no trae las llamadas del histórico');
  assert.equal(historicoPorArrancar(s.extraction, 'youtube'), true, 'conectar YouTube después no trae el VSL del histórico');
  assert.equal(historicoPorArrancar(s.extraction, 'panda'), true, 'conectar Panda después no trae el VSL del histórico');

  reevaluarExtraccion(s, con('meta', 'fathom'), AHORA);
  assert.equal(s.extraction.status, 'running');
  assert.equal(s.extraction.jobs.fathom_calls.status, 'pending');
  for (const k of JOBS_DE_META) assert.deepEqual(s.extraction.jobs[k], { status: 'done', detail: 'listo' }, `conectar Fathom repitió ${k}`);
  assert.equal(historicoPorArrancar(s.extraction, 'fathom'), false, 'reconectar Fathom repite las llamadas');

  // Y lo que no tiene histórico no arranca nada.
  for (const otro of ['calendly', 'gemini', 'resend', '']) {
    assert.equal(sirveAlHistorico(otro), false, `«${otro}» arranca el histórico`);
    assert.equal(historicoPorArrancar(estadoInicial('done').extraction, otro), false, `conectar «${otro}» arranca el histórico`);
  }
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
  const arranque = bloque(src, 'export async function arrancarHistoricoAlConectar(', '\nexport ');
  assert.match(arranque, /getEstadoOnboardingEstricto\(\)/, 'el arranque lee el estado tolerante: con la base caída pisaría un onboarding terminado');
  assert.doesNotMatch(arranque, /getEstadoOnboarding\(\)/);
  assert.match(arranque, /if \(!sirveAlHistorico\(servicio\)\) return 'no corresponde'/, 'una integración sin histórico lee el estado');
  assert.match(arranque, /ws === OWNER_WS\) return 'no corresponde'/, 'el ws1 corre la extracción del onboarding');
  assert.match(arranque, /pasosDeCapaActual\(\)\)\.length === 0\) return 'no corresponde'/, 'la plataforma corre la extracción del onboarding');
  assert.match(arranque, /if \(!historicoPorArrancar\(s\.extraction, servicio\)\) return 'ya estaba'/, 'reconectar vuelve a arrancar');
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

test('el VSL del histórico lee los videos donde /integraciones los guarda (el mismo lector que los crons)', () => {
  const src = sinComentarios(leer('lib/onboarding-extract.ts'));
  // El setting `youtube_vsl_video_id` lo escribe sólo la acción 'config' de /api/onboarding, que no llama
  // nadie; /integraciones guarda la CREDENCIAL. `configWs` mira los dos (lib/cron-workspaces.ts).
  assert.doesNotMatch(src, /getSetting\(/, 'el histórico lee los videos sólo del setting: el VSL queda salteado para todo cliente');
  const aplica = bloque(src, "case 'vsl_metrics': {", "\n  }\n}");
  assert.match(aplica, /configWs\('youtube_vsl_video_id'\)/);
  assert.match(aplica, /configWs\('panda_vsl_video_ids'\)/);
  const job = bloque(src, 'async function jobVsl', '\n}\n');
  assert.match(job, /configWs\('youtube_vsl_video_id'\)/);
  assert.match(job, /configWs\('panda_vsl_video_ids'\)/);
  // Y `configWs` sigue mirando la credencial en MAYÚSCULAS: si deja de hacerlo, este arreglo no arregla nada.
  assert.match(bloque(leer('lib/cron-workspaces.ts'), 'export async function configWs', '\n}\n'), /credWs\(clave\.toUpperCase\(\)/);
});

test('cada puerta que guarda una integración arranca SU parte del histórico', () => {
  const conexion = bloque(leer('lib/meta-conexion.ts'), 'export async function guardarConexionMeta', '\nexport ');
  const iLoop = conexion.indexOf('for (const [env, valor] of aGuardar)');
  const iArranque = conexion.indexOf("arrancarHistoricoEnSegundoPlano(ws, 'meta')");
  assert.ok(iArranque > iLoop && iLoop > 0, 'pegar el token o «Conectar con Meta» no arranca el histórico (o lo arranca antes de guardar)');
  assert.ok(conexion.indexOf('if (!d.ok) return') < iArranque, 'un token que no sirve arranca el histórico');

  const credencial = leer('app/api/integraciones/credencial/route.ts');
  assert.match(bloque(credencial, "body.action === 'guardar'", "body.action === 'descubrir-github'"),
    /if \(guardadas > 0\) await arrancarHistoricoEnSegundoPlano\(ctx\.ws, servicio\.key\)/,
    'guardar una integración a mano en /integraciones no arranca su histórico');
  assert.match(bloque(credencial, "body.action === 'elegir'", "body.action === 'borrar'"),
    /if \(!conflicto\) await arrancarHistoricoEnSegundoPlano\(ctx\.ws, 'meta'\)/,
    'elegir la cuenta o la página no arranca el histórico');

  assert.match(bloque(leer('app/api/metodo/route.ts'), "body.action === 'guardar'", "body.action === 'borrar'"),
    /if \(guardadas > 0\) \{[\s\S]*arrancarHistoricoEnSegundoPlano\(ws, servicio\.key\)/);
  const onboarding = leer('app/api/onboarding/route.ts');
  assert.match(bloque(onboarding, "case 'guardar': {", "case 'verificar': {"),
    /if \(guardados > 0\) \{[\s\S]*arrancarHistoricoEnSegundoPlano\(ws, servicio\.key\)/);
  // «Simular» copia las credenciales del ws1 (Mauricio, un cliente) al de prueba: arrancar ahí el histórico
  // traería SUS leads y SUS llamadas al otro workspace.
  assert.doesNotMatch(bloque(onboarding, "case 'simular': {", "case 'clonar-dueno'"), /arrancarHistorico/,
    'simular arranca el histórico con las credenciales de Mauricio');

  // El botón «Conectar con Meta» llega por guardarConexionMeta.
  assert.match(sinComentarios(leer('app/api/integraciones/meta/callback/route.ts')), /guardarConexionMeta\(/);
});

test('una puerta NUEVA que guarde credenciales tiene que decidir si arranca el histórico', () => {
  // En positivo: cada archivo que llama a guardarCredencial dice si puede guardar una integración con
  // histórico (y entonces lo arranca) o por qué no. Uno nuevo falla acá hasta que alguien lo decida.
  const PUERTAS: Record<string, string> = {
    'lib/meta-conexion.ts': 'Meta: pegar el token y «Conectar con Meta»',
    'app/api/integraciones/credencial/route.ts': 'cualquier integración a mano, y elegir la cuenta o la página de Meta (y GitHub, que no tiene histórico)',
    'app/api/metodo/route.ts': 'cualquier integración',
    'app/api/onboarding/route.ts': 'cualquier integración en el wizard · «simular» queda afuera: son las credenciales de Mauricio',
  };
  const SIN_HISTORICO: Record<string, string> = {
    'lib/cobros-conexion.ts': 'las pasarelas de pago',
    'lib/credenciales.ts': 'la migración de las envs viejas (la declaración vive acá)',
    'lib/datos-mau.ts': 'la copia de los datos de Mauricio, que nunca arranca un onboarding',
  };
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('app/admin/dev/'));
  const llaman = archivos.filter((f) => /\bguardarCredencial\(/.test(sinComentarios(leer(f)).replace(/export async function guardarCredencial\(/, '')));
  const sinDecidir = llaman.filter((f) => !(f in PUERTAS) && !(f in SIN_HISTORICO));
  assert.deepEqual(sinDecidir, [], 'una puerta nueva guarda credenciales sin decidir si arranca el histórico');
  for (const f of Object.keys(PUERTAS)) {
    assert.ok(llaman.includes(f), `${f} ya no guarda credenciales: sacalo de la lista`);
    assert.match(sinComentarios(leer(f)), /arrancarHistoricoEnSegundoPlano\(/, `${f} guarda integraciones y no arranca el histórico`);
  }
  for (const f of Object.keys(SIN_HISTORICO)) assert.ok(llaman.includes(f), `${f} ya no guarda credenciales: sacalo de la lista`);
});

test('el cron recorre a quien tenga CUALQUIER integración con histórico, no sólo Meta', () => {
  const cron = leer('app/api/cron/onboarding-extraccion/route.ts');
  assert.doesNotMatch(cron, /solo se dispara al\s*\n?\s*\/\/\s*verificar esa credencial/, 'el cron sigue diciendo que la arranca sólo el wizard');
  assert.match(cron, /arrancarHistoricoEnSegundoPlano/);
  // Con la ronda sólo de Meta, un negocio con Fathom y sin Meta queda con sus llamadas marcadas y nadie las corre.
  assert.match(sinComentarios(cron), /correrRonda\(\s*Object\.keys\(JOBS_DEL_HISTORICO\),/, 'el cron del histórico recorre sólo a quien tiene Meta');
  // Y la ronda junta a quien tenga ALGUNA de la lista, una vez.
  const ronda = bloque(leer('lib/cron-workspaces.ts'), 'export async function correrRonda', '\n}\n');
  assert.match(ronda, /for \(const sv of servicios\) \{\s*if \(await integracionConectada\(sv, w\.id\)\) \{ conectados\.push\(w\.id\); break; \}/,
    'la ronda pide TODAS las integraciones de la lista, o repite el workspace');
});

// ROTURAS (16/10/2026), base 9/0:
//   - guardarConexionMeta sin el arranque                         → 7/2
//   - elegir la cuenta o la página sin el arranque                → 8/1
//   - guardar a mano vuelve a ser sólo Meta                       → 8/1
//   - Fathom fuera de JOBS_DEL_HISTORICO                          → 8/1
//   - la decisión ignora lo salteado (sólo idle y error)          → 7/2
//   - reevaluar reinicia lo que ya corre                          → 8/1
//   - el arranque lee el estado tolerante                         → 8/1
//   - el ws1 corre el histórico                                   → 8/1
//   - la conexión espera al histórico (sin `after`)               → 8/1
//   - el VSL vuelve a leer sólo el setting                        → 8/1
//   - «simular» arranca con las credenciales de Mauricio          → 8/1
//   - una puerta nueva guarda credenciales sin decidir            → 8/1
//   - el cron vuelve a recorrer sólo a quien tiene Meta           → 8/1
//   - la ronda sin el `break` (repite el workspace)               → 8/1
