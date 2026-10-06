// El RESIDUO (#790): a quién le llega la reactivación, y a qué ritmo
// =============================================================================
// Decide mensajes reales a leads reales de un cliente: el WhatsApp a los que
// tuvieron reunión hace más de 45 días y el email a los formularios que nunca
// agendaron. La decisión es pura (lib/nutricion-residuo.ts) y se prueba de verdad;
// el cableado del motor se fija leyendo el fuente SIN comentarios y por BLOQUE.
//
// ROTURAS (06/10/2026), cada una corrida y restaurada a mano, sobre 24 tests:
//   · sin la guarda de «la última reunión es de los últimos 45 días» → 3 fallos
//     (la reciente, la que está por delante y la de la hora exacta).
//   · R1 sin marcar contada como falta (`asistio_j1 !== true`) → 1 fallo.
//   · `esResiduo` aceptando el formulario (`m !== null`) → 1 fallo.
//   · `estaPagado` sin la tabla `pagos` → 2 fallos (el WhatsApp y el email).
//   · `esResiduo` sin mirar `ocupados` → 1 fallo.
//   · `turnosResiduo` contando desde ahora y no desde el último turno → 1 fallo.
//   · `turnosResiduo` sin multiplicar por los pasos → 1 fallo.
//   · `procesarEnvios` sin la re-pregunta (comparando contra otro trigger) → 1 fallo;
//     con la re-pregunta pero sin cerrar al que dejó de ser residuo → 1 fallo.
//   · el commit sin pasarle la secuencia a `horariosDeInscripcion` → 1 fallo.
//   · la cohorte sin la exclusión de familia → 1 fallo.
//   · el segmento contado con el `count` del prefiltro → 1 fallo.
// La guarda «hay una reunión por delante» se SACÓ: una reunión futura es posterior
// al corte de 45 días y la de arriba ya la cubre, así que romperla daba 0 fallos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TRIGGER_RESIDUO, SEGMENTO_RESIDUO, RESIDUO_POR_DIA,
  motivoResiduo, esResiduo, esResiduoFormulario, estaPagado, turnosResiduo,
  type LeadResiduo, type CtxResiduo,
} from '../lib/nutricion-residuo';

const DIA = 86_400_000;
const AHORA = Date.parse('2026-10-06T18:00:00Z');
const haceDias = (d: number) => new Date(AHORA - d * DIA).toISOString();
const fechaHace = (d: number) => haceDias(d).slice(0, 10);

const base: LeadResiduo = {
  id: 1, estado_lead: 'abierto', telefono: '+52 1 664 123 4567', email: 'ana@ejemplo.com', email_opt_out: false,
  created_at: haceDias(120), fecha_agenda: null,
  fecha_junta_1: null, junta_1_at: null, fecha_junta_2: null, junta_2_at: null,
  asistio_j1: null, asistio_j2: null, fecha_primer_pago: null, cerro: null,
};
const lead = (p: Partial<LeadResiduo>): LeadResiduo => ({ ...base, ...p });
const asistio = (dias = 60) => lead({ fecha_agenda: haceDias(dias + 3), fecha_junta_1: fechaHace(dias), asistio_j1: true });
const falto = (dias = 60) => lead({ fecha_agenda: haceDias(dias + 3), fecha_junta_1: fechaHace(dias), asistio_j1: false });
const ctx = (p: Partial<CtxResiduo> = {}): CtxResiduo => ({
  ahoraMs: AHORA, pagados: new Set(), bloqueados: new Set(), ocupados: new Set(), ...p,
});

// ── Por qué es residuo ──────────────────────────────────────────────────────
test('asistió a la reunión hace más de 45 días y no compró', () => {
  assert.equal(motivoResiduo(asistio(60), AHORA), 'asistio_sin_comprar');
  // Asistir a la R2 también es haber hablado, aunque la R1 no tenga marca.
  assert.equal(motivoResiduo(lead({ fecha_junta_1: fechaHace(80), fecha_junta_2: fechaHace(70), asistio_j2: true }), AHORA), 'asistio_sin_comprar');
});

test('faltó a la R1 hace más de 45 días', () => {
  assert.equal(motivoResiduo(falto(60), AHORA), 'falto_r1');
});

test('⚠️ la R1 SIN asistencia marcada no entra: no se sabe si fue', () => {
  // Son 12 en ws1. «Qué bueno que hablamos» o «te extrañamos» serían afirmar algo
  // que nadie midió.
  assert.equal(motivoResiduo(lead({ fecha_junta_1: fechaHace(60), asistio_j1: null }), AHORA), null);
});

test('una reunión de los últimos 45 días no es residuo: la cubren los disparadores de 45', () => {
  assert.equal(motivoResiduo(asistio(30), AHORA), null);
  assert.equal(motivoResiduo(falto(44), AHORA), null);
  // Y manda la ÚLTIMA reunión, no la primera: R1 vieja y R2 reciente no es residuo.
  assert.equal(motivoResiduo(lead({ fecha_junta_1: fechaHace(90), asistio_j1: true, fecha_junta_2: fechaHace(10) }), AHORA), null);
});

test('⚠️ con una reunión POR DELANTE no es residuo, aunque la R1 sea vieja', () => {
  // Es de la post-agenda. Mandarle una reactivación a quien tiene una reunión
  // agendada es el mensaje que habla del momento equivocado.
  const conR2 = lead({ fecha_junta_1: fechaHace(90), asistio_j1: true, junta_2_at: new Date(AHORA + 2 * DIA).toISOString() });
  assert.equal(motivoResiduo(conR2, AHORA), null);
});

test('la hora exacta de la reunión le gana a la fecha', () => {
  // `junta_1_at` (Calendly) es la que vale, como en `reunionFuturaMs`.
  const reagendada = lead({ fecha_junta_1: fechaHace(90), junta_1_at: haceDias(10), asistio_j1: true });
  assert.equal(motivoResiduo(reagendada, AHORA), null);
});

test('el formulario que nunca agendó, de más de 45 días', () => {
  assert.equal(motivoResiduo(lead({ created_at: haceDias(60) }), AHORA), 'formulario_sin_agenda');
  assert.equal(motivoResiduo(lead({ created_at: haceDias(30) }), AHORA), null);
  // Agendó y no hay fecha de reunión: no se sabe qué pasó, no se le escribe.
  assert.equal(motivoResiduo(lead({ created_at: haceDias(60), fecha_agenda: haceDias(55) }), AHORA), null);
});

// ── El WhatsApp: sólo los que tuvieron reunión ─────────────────────────────
test('el WhatsApp le llega al que asistió y al que faltó', () => {
  assert.equal(esResiduo(asistio(), ctx()), true);
  assert.equal(esResiduo(falto(), ctx()), true);
});

test('⚠️ el formulario NO recibe el WhatsApp: va por email', () => {
  // De los 884, 882 nunca escribieron por WhatsApp. Escribirles primero por la
  // línea no oficial es lo que AGENTS.md prohíbe para cuidarla.
  assert.equal(esResiduo(lead({ created_at: haceDias(60) }), ctx()), false);
});

test('⚠️ sólo los ABIERTOS: perdidos, descalificados y «no responde» no están decididos', () => {
  for (const estado of ['perdido', 'descalificado', 'no_responde', 'ganado']) {
    assert.equal(esResiduo({ ...asistio(), estado_lead: estado }, ctx()), false, estado);
  }
});

test('⚠️ quien pagó no recibe una reactivación, por cualquiera de las tres señales', () => {
  assert.equal(esResiduo({ ...asistio(), fecha_primer_pago: fechaHace(5) }, ctx()), false);
  assert.equal(esResiduo({ ...asistio(), cerro: true }, ctx()), false);
  // Un pago registrado en `pagos` con la columna del lead vacía: el caso que la
  // columna sola no ve.
  assert.equal(esResiduo(asistio(), ctx({ pagados: new Set([1]) })), false);
  assert.equal(estaPagado({ id: 7, fecha_primer_pago: null, cerro: null }, new Set([7])), true);
  assert.equal(estaPagado({ id: 7, fecha_primer_pago: null, cerro: false }, new Set()), false);
});

test('sin teléfono, o con el teléfono bloqueado, no hay WhatsApp', () => {
  assert.equal(esResiduo({ ...asistio(), telefono: null }, ctx()), false);
  assert.equal(esResiduo({ ...asistio(), telefono: '  ' }, ctx()), false);
  // `wa_bloqueados` guarda dígitos: el formato del lead no puede esquivar el bloqueo.
  assert.equal(esResiduo(asistio(), ctx({ bloqueados: new Set(['5216641234567']) })), false);
});

test('⚠️ si otra secuencia (o una persona) ya le está hablando, no es residuo', () => {
  assert.equal(esResiduo(asistio(), ctx({ ocupados: new Set([1]) })), false);
});

// ── El email: los formularios ───────────────────────────────────────────────
test('el email le llega al formulario abierto, sin pago, con correo y sin baja', () => {
  const form = lead({ created_at: haceDias(60) });
  assert.equal(esResiduoFormulario(form, { ahoraMs: AHORA, pagados: new Set() }), true);
  assert.equal(esResiduoFormulario({ ...form, email: '' }, { ahoraMs: AHORA, pagados: new Set() }), false);
  assert.equal(esResiduoFormulario({ ...form, email: '   ' }, { ahoraMs: AHORA, pagados: new Set() }), false);
  assert.equal(esResiduoFormulario({ ...form, email_opt_out: true }, { ahoraMs: AHORA, pagados: new Set() }), false);
  assert.equal(esResiduoFormulario({ ...form, estado_lead: 'perdido' }, { ahoraMs: AHORA, pagados: new Set() }), false);
  assert.equal(esResiduoFormulario(form, { ahoraMs: AHORA, pagados: new Set([1]) }), false);
  // El que tuvo reunión va por WhatsApp, no por acá: no recibe los dos.
  assert.equal(esResiduoFormulario(asistio(), { ahoraMs: AHORA, pagados: new Set() }), false);
});

// ── El ritmo ────────────────────────────────────────────────────────────────
test('sin leads no hay turnos', () => {
  assert.deepEqual(turnosResiduo({ desdeMs: AHORA, ultimoMs: null, n: 0 }), []);
});

test('nunca salen más de RESIDUO_POR_DIA en 24 horas', () => {
  const t = turnosResiduo({ desdeMs: AHORA, ultimoMs: null, n: 40, pasos: 1 });
  assert.equal(t.length, 40);
  assert.equal(t[0], AHORA);
  for (let i = 0; i < t.length; i++) {
    const enElDia = t.filter((x) => x >= t[i] && x < t[i] + DIA).length;
    assert.ok(enElDia <= RESIDUO_POR_DIA, `desde el turno ${i} hay ${enElDia} en 24 h`);
  }
});

test('⚠️ con N pasos, el espacio entre leads se multiplica por N', () => {
  // Cada lead manda N mensajes: espaciar sólo el primero dejaba salir N veces más.
  const uno = turnosResiduo({ desdeMs: AHORA, ultimoMs: null, n: 2, pasos: 1, porDia: 10 });
  const dos = turnosResiduo({ desdeMs: AHORA, ultimoMs: null, n: 2, pasos: 2, porDia: 10 });
  assert.equal(uno[1] - uno[0], DIA / 10);
  assert.equal(dos[1] - dos[0], (2 * DIA) / 10);
});

test('⚠️ se cuenta desde el ÚLTIMO turno ya agendado, no desde ahora', () => {
  // Si no, los que cumplen 45 días mañana se apilan sobre los días ya repartidos.
  const ultimo = AHORA + 3 * DIA;
  const t = turnosResiduo({ desdeMs: AHORA, ultimoMs: ultimo, n: 2, pasos: 1, porDia: 10 });
  assert.equal(t[0], ultimo + DIA / 10);
  // Y si el último ya pasó, arranca ahora (no en el pasado).
  assert.equal(turnosResiduo({ desdeMs: AHORA, ultimoMs: AHORA - 5 * DIA, n: 1 })[0], AHORA);
});

// ── El cableado del motor ───────────────────────────────────────────────────
const raiz = join(__dirname, '..');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (p: string) => sinComentarios(readFileSync(join(raiz, p), 'utf8'));
const bloque = (src: string, desde: string, hasta: string) => {
  const ini = src.indexOf(desde);
  assert.ok(ini >= 0, `no encontré «${desde}»`);
  const fin = src.indexOf(hasta, ini + desde.length);
  assert.ok(fin > ini, `no encontré el cierre «${hasta}» después de «${desde}»`);
  return src.slice(ini, fin);
};

test('el motor resuelve el trigger del residuo con el ámbito del embudo', () => {
  const src = fuente('lib/nutricion.ts');
  const rama = bloque(src, 'if (triggerTipo === TRIGGER_RESIDUO)', '\n  }');
  assert.match(rama, /cohorteResiduo\(supabase, \(q\) => conAmbito\(q, ambito\)\)/);
});

test('⚠️ los dos horarios (dry-run y commit) escalonan el residuo', () => {
  const src = fuente('lib/nutricion.ts');
  const fn = bloque(src, 'async function horariosDeInscripcion(', 'let juntasMap');
  assert.ok(fn.length < 800, `el recorte mide ${fn.length}: mira otra cosa`);
  assert.match(fn, /if \(sec\?\.trigger_tipo === TRIGGER_RESIDUO\)\s*\{\s*return horariosResiduo\(/);
  const llamadas = [...src.matchAll(/horariosDeInscripcion\(sec\.pasos\[0\], pendientes(, sec)?\)/g)];
  assert.equal(llamadas.length, 2, 'son dos los que inscriben: el dry-run y el commit');
  assert.ok(llamadas.every((m) => m[1] === ', sec'), 'uno de los dos no le pasa la secuencia: ese no escalona');
});

test('⚠️ al MANDAR se vuelve a preguntar si sigue siendo residuo, y si no, se cierra sin mandar', () => {
  const src = fuente('lib/nutricion.ts');
  const fn = bloque(src, 'export async function procesarEnvios(', '\nexport ');
  assert.match(fn, /residuoDelLote[^;]*= delResiduo\.length\s*\?\s*await residuoVigente\(supabase, delResiduo\)/);
  const guarda = bloque(fn, 'if (sec.trigger_tipo === TRIGGER_RESIDUO)', "if (paso.ancla === 'reunion') {");
  assert.match(guarda, /if \(residuoDelLote === null\)\s*\{\s*res\.detalle\.push\(\{[^}]*\}\);\s*continue;/, 'sin poder leer, no puede seguir de largo');
  assert.match(guarda, /if \(!residuoDelLote\.has\(insc\.lead_id\)\)\s*\{[\s\S]*estado: 'completada', proximo_envio_at: null[\s\S]*continue;/);
  // Y va ANTES de cualquier rama que mande.
  assert.ok(fn.indexOf('if (sec.trigger_tipo === TRIGGER_RESIDUO)') < fn.indexOf('enviarYEspejar('));
});

test('la cohorte excluye a quien ya pasó por el residuo; la re-pregunta, no', () => {
  const src = fuente('lib/nutricion-residuo-cohorte.ts');
  const cohorte = bloque(src, 'export async function cohorteResiduo(', 'export async function residuoVigente(');
  assert.match(cohorte, /leads\.filter\(\(l\) => !yaEnResiduo\.has\(l\.id\) && esResiduo\(l, ctx\)\)/);
  const vigente = bloque(src, 'export async function residuoVigente(', 'export async function horariosResiduo(');
  assert.match(vigente, /leads\.filter\(\(l\) => esResiduo\(l, ctx\)\)/);
  assert.doesNotMatch(vigente, /yaEnResiduo\.has/, 'el lead está, por definición, en la secuencia que lo va a mandar');
});

test('⚠️ el segmento del email se cuenta con la misma función que arma los destinatarios', () => {
  const src = fuente('lib/email-marketing.ts');
  const contar = bloque(src, 'export async function contarSegmento(', 'export async function contarTodosSegmentos(');
  assert.match(contar, /if \(segmento === SEGMENTO_RESIDUO\) return \(await leadsDeSegmento\(segmento\)\)\.length;/);
  const leads = bloque(src, 'export async function leadsDeSegmento(', 'async function leadsDelResiduo(');
  assert.match(leads, /if \(segmento === SEGMENTO_RESIDUO\) return leadsDelResiduo\(supabase\);/);
  const residuo = bloque(src, 'async function leadsDelResiduo(', 'export async function contarSegmento(');
  assert.match(residuo, /esResiduoFormulario\(l, \{ ahoraMs, pagados \}\)/);
  assert.match(src, /\{ value: SEGMENTO_RESIDUO, label: /, 'el segmento no está en SEGMENTOS: crearBroadcast lo rechaza');
  assert.equal(SEGMENTO_RESIDUO, 'residuo-formularios');
});

test('el trigger está en el catálogo de huecos (los otros dos los fija nutricion-triggers-registros)', () => {
  const src = fuente('lib/secuencias-huecos.ts');
  const mapa = bloque(src, 'const LEGACY_TRIGGER_CUBRE', '};');
  assert.match(mapa, new RegExp(`${TRIGGER_RESIDUO}: \\['reactivacion'\\]`));
});
