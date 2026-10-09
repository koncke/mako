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
//
// REVISIÓN (06/10/2026), sobre 30 tests:
//   · la partición de inscripciones con `if` en vez de `else if` (la del PROPIO
//     residuo contada como «ocupado») → ANTES de esta revisión daba 0 fallos en 24:
//     la re-pregunta cerraba todas las inscripciones sin mandar y todo verde. Con la
//     partición en `clasificarInscripciones` → 1 fallo.
//   · `handoff` fuera de los ocupados → 1 fallo.
//   · `contextoDe` sin pasarle las secuencias del residuo → 1 fallo.
//   · sin el techo por corrida (condición imposible) → 1 fallo; sin el `+= 1` → 1 fallo.
//   · `RESIDUO_POR_CORRIDA = 2` con el cron de 9 corridas → 1 fallo.
//   · el segmento del residuo fuera del enum de la API de MaKo → 1 fallo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TRIGGER_RESIDUO, SEGMENTO_RESIDUO, RESIDUO_POR_DIA, RESIDUO_POR_CORRIDA,
  motivoResiduo, esResiduo, esResiduoFormulario, estaPagado, turnosResiduo, clasificarInscripciones,
  type LeadResiduo, type CtxResiduo,
} from '../lib/nutricion-residuo';
import { DEFS as DEFS_EMAIL } from '../lib/api-mako/areas/email.def';

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

// ── Quién está «ocupado» y quién ya pasó por el residuo ─────────────────────
const RESIDUO_SEC = 90;   // una secuencia del residuo
const OTRA_SEC = 12;      // cualquier otra

test('⚠️ la inscripción del PROPIO residuo no cuenta como «otra secuencia le habla»', () => {
  // Es el estado de cada lead en el momento en que el motor le va a mandar el paso:
  // su inscripción del residuo, en `activa`. Si eso lo volviera «ocupado», la
  // re-pregunta cerraría TODAS las inscripciones sin mandar nada.
  const { ocupados, yaEnResiduo } = clasificarInscripciones(
    [{ lead_id: 1, secuencia_id: RESIDUO_SEC, estado: 'activa' }],
    new Set([RESIDUO_SEC]),
  );
  assert.equal(ocupados.has(1), false);
  assert.equal(yaEnResiduo.has(1), true);
  assert.equal(esResiduo(asistio(), ctx({ ocupados })), true, 'la re-pregunta lo cerraría sin mandar');
});

test('ocupado es una inscripción VIVA en otra secuencia; una terminada no', () => {
  const { ocupados, yaEnResiduo } = clasificarInscripciones([
    { lead_id: 1, secuencia_id: OTRA_SEC, estado: 'activa' },
    { lead_id: 2, secuencia_id: OTRA_SEC, estado: 'respondio' },
    { lead_id: 3, secuencia_id: OTRA_SEC, estado: 'handoff' },
    { lead_id: 4, secuencia_id: OTRA_SEC, estado: 'completada' },
    { lead_id: 5, secuencia_id: RESIDUO_SEC, estado: 'completada' },
    { lead_id: null, secuencia_id: OTRA_SEC, estado: 'activa' },
  ], new Set([RESIDUO_SEC]));
  assert.deepEqual([...ocupados].sort(), [1, 2, 3]);
  // La familia cuenta en CUALQUIER estado: una ya cerrada del residuo también.
  assert.deepEqual([...yaEnResiduo], [5]);
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
// El `\r` se saca ANTES de nada: en un worktree recién hecho los archivos llegan en CRLF
// (core.autocrlf) y los recortes que buscan `\n}\n` no encontrarían el cierre (AGENTS.md).
const fuente = (p: string) => sinComentarios(readFileSync(join(raiz, p), 'utf8').replace(/\r\n/g, '\n'));
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
  // Al integrar #789 (la reagenda) con esto, el horario de los dos caminos pasó a salir de
  // UNA función, `aInscribir`, que reemplazó a `horariosDeInscripcion`: el escalonado se
  // injertó ahí. Probado rompiéndolo (06/10): sacar el `escalonados?.get(lead_id) ??` → 1 rojo.
  const src = fuente('lib/nutricion.ts');
  const fn = bloque(src, 'async function aInscribir(', '\n}\n');
  assert.ok(fn.length < 3000, `el recorte mide ${fn.length}: mira otra cosa`);
  assert.match(fn, /sec\.trigger_tipo === TRIGGER_RESIDUO && pendientes\.length\s*\?\s*await horariosResiduo\(db, \{ pendientes,/);
  // (Segunda tanda, 08/10/2026: sin escalonado, el mínimo entre las raíces, `proximoDeEntrada`.)
  assert.match(fn, /proximo_envio_at: escalonados\?\.get\(lead_id\) \?\? proximoDeEntrada\(sec\.pasos, \(p\) => proximoEnvioDePaso\(p, /);
  assert.doesNotMatch(src, /horariosDeInscripcion\(/, 'volvió el segundo camino del horario');
  const llamadas = [...src.matchAll(/await aInscribir\(supabase, sec, candidatos\)/g)];
  assert.equal(llamadas.length, 2, 'son dos los que inscriben: el dry-run y el commit, y los dos por aInscribir');
});

test('⚠️ al MANDAR se vuelve a preguntar si sigue siendo residuo, y si no, se cierra sin mandar', () => {
  const src = fuente('lib/nutricion.ts');
  const fn = bloque(src, 'export async function procesarEnvios(', '\nexport ');
  assert.match(fn, /residuoDelLote[^;]*= delResiduo\.length\s*\?\s*await residuoVigente\(supabase, delResiduo\)/);
  // Hasta el re-anclado del recordatorio (08/10/2026: `anclada`, que suma la espera «antes de la
  // reunión» del flujo al `ancla` de siempre).
  const guarda = bloque(fn, 'if (sec.trigger_tipo === TRIGGER_RESIDUO)', 'if (anclada) {');
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

test('la cohorte y la re-pregunta parten las inscripciones con la función que tiene test', () => {
  const src = fuente('lib/nutricion-residuo-cohorte.ts');
  const ctxFn = bloque(src, 'async function contextoDe(', 'export async function cohorteResiduo(');
  assert.match(ctxFn, /const \{ ocupados, yaEnResiduo \} = clasificarInscripciones\(inscripciones, delResiduo\);/);
  // Y no hay una segunda partición escrita a mano al lado.
  assert.doesNotMatch(ctxFn, /ESTADOS_OCUPADO|ocupados\.add|yaEnResiduo\.add/);
});

test('⚠️ el residuo pasa de a RESIDUO_POR_CORRIDA por corrida, después de las guardas que no mandan', () => {
  const src = fuente('lib/nutricion.ts');
  const fn = bloque(src, 'export async function procesarEnvios(', '\nexport ');
  const iTope = fn.indexOf('residuoEnCorrida >= RESIDUO_POR_CORRIDA');
  assert.ok(iTope > 0, 'no hay techo por corrida: una cola amontonada sale entera');
  const ini = fn.lastIndexOf('if (sec.trigger_tipo === TRIGGER_RESIDUO) {', iTope);
  const tope = fn.slice(ini, fn.indexOf('let estado', ini));
  assert.ok(tope.length > 0 && tope.length < 600, `el recorte mide ${tope.length}: mira otra cosa`);
  assert.match(tope, /if \(residuoEnCorrida >= RESIDUO_POR_CORRIDA\)\s*\{\s*res\.detalle\.push\(\{[^}]*\}\);\s*continue;\s*\}\s*residuoEnCorrida \+= 1;/);
  // Después de «msg <20h» (si no, esa fila le gasta el turno a la siguiente) y antes
  // de cualquier rama que mande o deje un borrador.
  // (08/10/2026, segunda tanda: el freno es `frenadoPorAntiBan`, por canal y con lo de la corrida.)
  const freno = fn.indexOf('frenadoPorAntiBan(insc.lead_id');
  assert.ok(freno > 0 && ini > freno);
  for (const sale of ['enviarYEspejar(', 'enviarAudioYEspejar(', 'crearBorrador(']) {
    assert.ok(ini < fn.indexOf(sale), `el techo va después de ${sale}`);
  }
  // El contador nace una vez por corrida, afuera del bucle de lotes.
  // (El bucle de lotes cambió de condición el 08/10/2026: sigue mientras haya cupo de
  // mensajes O secuencias con pasos «⚡ Acción», que no gastan cupo. Con el ancla nueva,
  // probado rompiéndolo: el contador declarado adentro del bucle → 29 pasan / 1 falla, éste.)
  const decl = fn.indexOf('let residuoEnCorrida = 0;');
  // (Y el 08/10/2026 noche, decisión 5: con el cupo de WhatsApp cumplido siguen acciones Y emails.)
  const bucle = fn.indexOf('while ((!cupoLleno() || sinTopeWa.length > 0) && rondas < 6)');
  assert.ok(bucle > 0, 'no encontré el bucle de lotes');
  assert.ok(decl >= 0 && decl < bucle, 'el contador se reinicia por lote');
});

test('⚠️ con el cron cada minuto, el residuo sigue saliendo de a UNO por hora y RESIDUO_POR_DIA por día', () => {
  // Hasta el 09/10/2026 esto contaba las corridas de vercel.json («0 15-23 * * *» = 9 × 1 ≤ 10).
  // Con el tick de cada minuto y la corrida de la hora las 24 h, «por corrida» dejó de ser techo: las
  // corridas del cron (`cupoPorHora`) arrancan el contador en lo que el residuo YA usó.
  // Probado rompiéndolo (09/10/2026): sacar el `enElDia >= RESIDUO_POR_DIA` → cae éste.
  const vercel = JSON.parse(readFileSync(join(raiz, 'vercel.json'), 'utf8')) as { crons: Array<{ path: string; schedule: string }> };
  const corren = vercel.crons.filter((c) => c.path === '/api/cron/nutricion' || c.path === '/api/cron/nutricion-tick');
  assert.equal(corren.length, 2, 'las dos rutas del motor');
  const src = fuente('lib/nutricion.ts');
  const fn = bloque(src, 'export async function procesarEnvios(', '\nexport ');
  assert.match(fn, /if \(opts\?\.cupoPorHora\) residuoEnCorrida = await residuoYaUsado\(secuencias\.filter\(\(s\) => s\.trigger_tipo === TRIGGER_RESIDUO\)\.map\(\(s\) => s\.id\)\);/);
  // Las dos rutas del cron pasan `cupoPorHora` (lo fija tests/espera-duracion.test.ts, llamada por llamada).
  for (const c of corren) assert.match(fuente(`app${c.path}/route.ts`), /cupoPorHora: true/);
  const usado = bloque(src, 'async function residuoYaUsado(', '\n}\n');
  assert.match(usado, /return enLaHora >= RESIDUO_POR_CORRIDA \|\| enElDia >= RESIDUO_POR_DIA \? RESIDUO_POR_CORRIDA : enLaHora;/);
  assert.match(usado, /contar\(haceHorasISO\(24\)\)/, 'el día es de 24 h');
  assert.match(usado, /\.in\('estado', \['enviado', 'borrador', 'fallo'\]\)/, 'cuentan los tres desenlaces de un turno');
  assert.match(usado, /\} catch \(e\) \{[\s\S]*return RESIDUO_POR_CORRIDA;\s*\}$/, '«no pude leer» es «sin turno»');
  // Y el techo del día sigue siendo más que el de una hora (si no, el residuo no sale nunca).
  assert.ok(RESIDUO_POR_DIA >= RESIDUO_POR_CORRIDA);
});

test('⚠️ los segmentos que MaKo puede usar son los mismos que MaKo lista', () => {
  // `listar_segmentos_email` sale de SEGMENTOS entero; las otras cuatro validan
  // contra el enum de la def. Uno que falte en el enum se lista con sus leads y
  // después se rechaza: pasó con el residuo.
  const src = fuente('lib/email-marketing.ts');
  const lista = bloque(src, 'export const SEGMENTOS: Segmento[] = [', '];');
  const constantes: Record<string, string> = { SEGMENTO_RESIDUO };
  const valores = [...lista.matchAll(/\{ value: (?:'([^']+)'|([A-Z_]+)),/g)].map((m) => m[1] ?? constantes[m[2]]);
  assert.ok(valores.length >= 7 && valores.every(Boolean), `no supe leer SEGMENTOS: ${JSON.stringify(valores)}`);
  for (const op of ['contar_segmento_email', 'leads_de_segmento_email', 'crear_broadcast', 'editar_broadcast']) {
    const p = DEFS_EMAIL.find((d) => d.id === op)?.parametros?.find((x) => x.nombre === 'segmento');
    assert.ok(p, `${op} no pide segmento`);
    assert.deepEqual([...(p.enum ?? [])].sort(), [...valores].sort(), op);
  }
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
