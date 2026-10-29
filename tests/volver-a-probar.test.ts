// =============================================================================
// «Volver a probar» una automatización con un lead que ya la terminó (28/10/2026, ticket #19 de Leandro)
// =============================================================================
// Leandro (Fiesta Music, ws10) probó su 680 comentando con dos cuentas suyas (@aliensfilms, @martin.koncke): las dos
// quedaron con su inscripción 'completada' y la 680 es de «Una sola vez», así que su próximo comentario NO las vuelve a
// hacer entrar. El Cerebro: «prefiero que el negocio lo pueda hacer solo desde la pantalla («Volver a probar» por lead)».
// La marca va en el desenlace de la inscripción terminada (lib/reentrada.ts, `DESENLACE_VOLVER_A_PROBAR`): lo PRÓXIMO que
// arranca la automatización (otro comentario, otro DM, moverlo de nuevo a la etapa) la vuelve a correr UNA vez, con
// cualquier reentrada. No manda nada al marcar. Fija:
//   · la regla pura (`puedeReentrar`, `puedeVolverAProbar`, `textoDeVolverAProbar`);
//   · el motor (leyendo el fuente): `enrolarPorEvento` le pregunta también a las de «Una sola vez», y `reusablesDe` deja
//     entrar a la marcada; el reuso limpia el desenlace (la marca es de UNA vez);
//   · la escritura (compare-and-set), la action del admin, el botón de la ficha y la operación de la API.
// Correr: node --import tsx --test tests/volver-a-probar.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { puedeReentrar, puedeVolverAProbar, claveDeEnvio, DESENLACE_VOLVER_A_PROBAR } from '../lib/reentrada';
import { textoDeVolverAProbar } from '../lib/automatizaciones-del-lead-reglas';
import { SIN_MARCAS } from '../lib/nutricion-reinscripcion';
import { porId } from '../lib/api-mako/registro';

const leer = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const M = DESENLACE_VOLVER_A_PROBAR;
const fila = (estado: string, desenlace: string | null = null) => ({ estado, desenlace, reunion_at: null, proximo_envio_at: null });
const reentra = (modo: 'una_vez' | 'otra_reunion' | 'siempre', f: ReturnType<typeof fila>, porEvento = true) =>
  puedeReentrar(modo, { fila: f, marcas: SIN_MARCAS, reunionNuevaMs: null, porEvento });

test('la regla: la marcada entra UNA vez con el próximo EVENTO, aunque sea «Una sola vez»; sin marca, como siempre', () => {
  // Las dos cuentas de Leandro: completadas en una de «Una sola vez».
  assert.deepEqual(reentra('una_vez', fila('completada')), { entra: false, porque: 'una_sola_vez' }, 'sin marca no vuelve (lo de hoy)');
  assert.deepEqual(reentra('una_vez', fila('completada', M)), { entra: true, porque: 'volver_a_probar' });
  assert.deepEqual(reentra('una_vez', fila('respondio', M)), { entra: true, porque: 'volver_a_probar' }, 'quien prueba suele contestar el DM');
  assert.deepEqual(reentra('otra_reunion', fila('no_responde', M)), { entra: true, porque: 'volver_a_probar' });
  // El barrido NO la usa: mira quién ESTÁ en la etapa, y la correría en cada vuelta.
  assert.deepEqual(reentra('una_vez', fila('completada', M), false), { entra: false, porque: 'una_sola_vez' });
  // Nunca abre una que está corriendo ni una frenada (puede ser una baja), ni una que atiende una persona.
  assert.equal(reentra('una_vez', fila('activa', M)).entra, false);
  assert.equal(reentra('siempre', fila('cancelada', M)).entra, false);
  assert.equal(reentra('una_vez', fila('handoff', M)).entra, false);
  assert.equal(puedeVolverAProbar({ estado: 'completada', desenlace: 'cancelado' }), false);
  for (const e of ['completada', 'no_responde', 'respondio']) assert.equal(puedeVolverAProbar({ estado: e, desenlace: null }), true, e);
  for (const e of ['activa', 'pendiente', 'pausada', 'handoff', 'cancelada']) assert.equal(puedeVolverAProbar({ estado: e, desenlace: null }), false, e);
});

test('lo que se le dice a la persona: qué pasa y por qué no, en palabras', () => {
  const sec: { nombre: string; archivada_at: string | null } = { nombre: "Comentario con 'pruebafm' en Instagram", archivada_at: null };
  const ok = textoDeVolverAProbar({ estado: 'completada', desenlace: null }, sec, '@martin.koncke');
  assert.ok(ok.ok && /^@martin\.koncke puede volver a probar «Comentario con 'pruebafm' en Instagram»: entra de nuevo con lo próximo que la arranca/.test(ok.resumen));
  const no = (f: { estado: string; desenlace: string | null }, s: typeof sec | null = sec) => {
    const r = textoDeVolverAProbar(f, s, 'Ana');
    return r.ok ? '' : r.error;
  };
  assert.match(no({ estado: 'cancelada', desenlace: 'cancelado' }), /frenaron/);
  assert.match(no({ estado: 'handoff', desenlace: null }), /una persona/);
  assert.match(no({ estado: 'activa', desenlace: null }), /Todavía la está haciendo/);
  assert.match(no({ estado: 'completada', desenlace: null }, { ...sec, archivada_at: '2026-10-01' }), /archivada/);
  assert.match(no({ estado: 'completada', desenlace: null }, null), /no existe/);
});

test('el motor: le pregunta también a las de «Una sola vez», deja entrar a la marcada, y al reusarla la marca se va', () => {
  const n = sinComentarios(leer('lib/nutricion.ts'));
  // `enrolarPorEvento`: antes `reusaInscripciones` dejaba afuera «Una sola vez» sin mirar la fila.
  assert.match(n, /const modoSec = new Map\(elegidas\.filter\(\(s\) => s\.pasos\.length > 0\)\.map\(\(s\) => \[s\.id, reentradaDeSecuencia\(s\)\] as const\)\);/);
  // `reusablesDe`: la marcada entra a la pregunta con cualquier reentrada (y `puedeReentrar` decide).
  assert.match(n, /if \(f\.desenlace === DESENLACE_VOLVER_A_PROBAR\) return puedeVolverAProbar\(f\);\s*return modo !== 'una_vez' &&/);
  // El reuso deja la fila como un insert: sin desenlace (la marca es de UNA vez).
  assert.match(leer('lib/nutricion-reinscripcion.ts'), /desenlace: null,\s*desenlace_at: null,/);
});

test('la escritura, la action, el botón de la ficha y la API', () => {
  const d = sinComentarios(leer('lib/automatizaciones-del-lead.ts'));
  const f = d.slice(d.indexOf('export async function volverAProbarEnAutomatizacion('), d.indexOf('export async function frenarLeadsEnAutomatizaciones('));
  // Compare-and-set sobre lo leído (estado Y desenlace), y `soloVer` no escribe.
  assert.match(f, /\.update\(\{ desenlace: DESENLACE_VOLVER_A_PROBAR, desenlace_at: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\('id', f\.id\)\.eq\('estado', f\.estado\)/);
  assert.match(f, /f\.desenlace == null \? q\.is\('desenlace', null\) : q\.eq\('desenlace', f\.desenlace\)/);
  assert.ok(f.indexOf('if (o.soloVer') > 0 && f.indexOf('if (o.soloVer') < f.indexOf('.update('), 'soloVer vuelve antes de escribir');
  assert.match(f, /logLeadEvent\(leadId, 'Automatización', v\.resumen, autor\)/, 'queda en el historial, firmado');
  // Sólo el admin.
  const act = leer('app/automations/automatizaciones-del-lead-actions.ts');
  const a = act.slice(act.indexOf('export async function volverAProbarEnAutomatizacionAction('));
  assert.match(a.slice(0, 600), /if \(rol !== 'admin'\) return \{ ok: false/);
  // La ficha: el botón en la tarjeta, por la puerta de datos del bloque, con su pregunta.
  const tar = leer('app/crm/lead-view/ficha/resumen/tarjeta-automatizacion.tsx');
  assert.match(tar, /const prueba = !!onProbar && a\.puede\.volverAProbar === true;/);
  assert.match(tar, /\{prueba && <Button variant="secondary" size="sm" onClick=\{onProbar\}>Volver a probar<\/Button>\}/);
  const blo = leer('app/crm/lead-view/ficha/resumen/automatizaciones.tsx');
  assert.match(blo, /onProbar=\{\(\) => \{ setError\(null\); setAccion\(\{ tipo: 'probar', aut: a \}\); \}\}/);
  assert.match(blo, /tipo === 'probar' \? await volverAProbarDelBloque\(ctx\.lead\.id, aut\.secuenciaId\)/);
  assert.match(leer('app/crm/lead-view/ficha/resumen/automatizaciones-datos.ts'), /return volverAProbarEnAutomatizacionAction\(leadId, secuenciaId\);/);
  // Lo ofrece el detalle: terminada (o contestó), sin archivar, sin una persona, y no dos veces.
  assert.match(sinComentarios(leer('lib/automatizaciones-del-lead-reglas.ts')),
    /\.\.\.\(s\.archivada_at == null && f\.estado !== 'handoff' && puedeVolverAProbar\(f\) && f\.desenlace !== DESENLACE_VOLVER_A_PROBAR \? \{ volverAProbar: true \} : \{\}\)/);
  // La API: propone y espera el «sí», del admin, sin HTTP; no le escribe a nadie.
  const op = porId('volver_a_probar_lead_secuencia')!;
  assert.ok(op, 'la operación existe');
  assert.equal((op as { confirmacion?: string }).confirmacion, 'chat');
  assert.equal((op as { aTerceros?: boolean }).aTerceros, undefined, 'no le manda nada a un tercero');
  assert.equal(op.gating?.rolMinimo, 'admin');
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  assert.match(run, /volverAProbarEnAutomatizacion\(leadId, secuenciaId, 'MaKo', \{ soloVer: true \}\)/, 'preparar decide sin escribir');
});

// ⚠️ LA SEGUNDA PRUEBA NO SALÍA (la verificación del Cerebro sobre 69b49a31c, 29/10/2026): la inscripción reusada mandaba
// con la MISMA Idempotency-Key de Zernio (`nutri:<inscripción>:<nodo>`) y Zernio contestaba lo de la vez anterior.
test('la clave de Zernio lleva la vuelta: otra en la segunda prueba, la misma en los reintentos de una vuelta', () => {
  const primera = claveDeEnvio(5003, '2026-10-28T20:00:00.000Z', 'm1');
  const reintento = claveDeEnvio(5003, '2026-10-28T20:00:00.000Z', 'm1');
  const segunda = claveDeEnvio(5003, '2026-10-29T01:30:00.000Z', 'm1');
  assert.equal(primera, reintento, 'un reintento de la misma vuelta repite la clave: si se pierde la respuesta, no salen dos');
  assert.notEqual(primera, segunda, 'Volver a probar renueva inscripto_at: la clave de la segunda prueba es otra');
  assert.notEqual(claveDeEnvio(5003, '2026-10-28T20:00:00.000Z', 'm2'), primera, 'cada tarjeta, la suya');
  assert.equal(claveDeEnvio(5003, null, 'm1'), 'nutri:5003:m1', 'sin inscripto_at, la de siempre');
  // El motor la usa, con `inscripto_at` en la cola, y `reactivarInscripcion` lo renueva.
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(motor, /idempotencia: claveDeEnvio\(insc\.id, insc\.inscripto_at, idDe\(paso, insc\.paso_actual\)\)/);
  assert.doesNotMatch(motor, /idempotencia: `nutri:\$\{insc\.id\}/, 'nadie arma la clave vieja a mano');
  assert.match(motor, /\.select\('id, lead_id, secuencia_id, paso_actual, nodo_actual, proximo_envio_at, hilos, hilos_rev, estado, desenlace, inscripto_at'\)/);
  assert.match(leer('lib/nutricion-reinscripcion.ts'), /inscripto_at: r\.ahora,/);
});
