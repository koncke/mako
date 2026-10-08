// =============================================================================
// Meter a UN lead en UNA secuencia elegida a mano (inscribir_lead_secuencia, 08/10/2026)
// =============================================================================
// Hasta ese día un lead entraba a una secuencia por su cohorte o por un evento: no había forma
// de decir «mete a este lead en ESTA secuencia», que es lo que necesita un paso «⚡ Acción» de
// un flujo (decisión de Martín: «que pueda hacer todo, sin limitaciones») y el dueño por
// WhatsApp. Lo que estos tests fijan, por capa:
//
//   · la DECISIÓN (`decidirInscripcionManual`, lib/nutricion-inscripcion-manual.ts), ejecutada
//     con datos falsos: qué se inscribe, qué se reinicia y qué se contesta;
//   · el motivo que lee la persona, incluido el id que no es de este negocio;
//   · el cableado de `inscribirEnSecuencia` (lib/nutricion.ts): el lead y la secuencia se leen
//     con getTenantDb ANTES de escribir nada, `soloVer` no escribe, y lo que el motor vuelve a
//     mirar al mandar se pregunta con sus mismas funciones;
//   · el runner (chatbot.run.ts): preparar() con `soloVer`, ejecutar() sin él y con historial,
//     y SIN la vía rápida cuando lo pide un flujo (puede estar corriendo adentro del motor);
//   · la definición: chat, sin HTTP, sólo el admin.
//
// El runner y el motor llevan server-only (o lo arrastran): no se pueden importar. Se leen del
// fuente SIN comentarios y por bloque; la decisión, que es lo que cambia a quién se le escribe,
// se EJECUTA.
//
// Probado rompiéndolo (08/10/2026) con un arnés que restaura de memoria (md5 igual al final).
// Como está: 14 pasan / 0 fallan. Cada rotura por separado:
//   · el lead de OTRO negocio: sin el `return … 'lead_no_existe'` del motor  → 1 falla / 13 pasan
//   · la secuencia inexistente: sin el `return … 'secuencia_no_existe'`      → 1 falla / 13 pasan
//   · `soloVer` puesto DESPUÉS de escribir (preparar escribiría)              → 1 falla / 13 pasan
//   · el preparar() del runner sin `{ soloVer: true }`                        → 1 falla / 13 pasan
//   · una cancelada que se reabre (sin la regla de 'cancelada')               → 1 falla / 13 pasan
//   · una en curso que se reinicia (sin ESTADOS_EN_CURSO)                     → 2 fallan / 12 pasan
//   · una pausada que se inscribe (sin la regla de `activa`)                  → 1 falla / 13 pasan
//   · el tope de antigüedad ignorado en la decisión                           → 1 falla / 13 pasan
//   · el motor sin `aTiempo(` (cae también tests/antiguedad-cableada)         → 1 falla acá y 1 allá
//   · el motor sin `residuoVigente(`                                          → 1 falla / 13 pasan
//   · la vía rápida también desde un flujo (sin `sinEnvioInmediato`)          → 1 falla / 13 pasan
//   · el runner sin avisar que viene de un flujo                              → 1 falla / 13 pasan
//   · la definición abierta a HTTP                                            → 1 falla / 13 pasan
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decidirInscripcionManual, motivoNoInscribe, ESTADOS_EN_CURSO,
  type CondicionesDelMotor, type PorQueNoSeInscribio,
} from '../lib/nutricion-inscripcion-manual';
import { ESTADOS_TERMINADOS } from '../lib/nutricion-reinscripcion';
import { DEFS } from '../lib/api-mako/areas/chatbot.def';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const SEC_OK = { activa: true, archivada: false, pasos: 2 };
const MOTOR_OK: CondicionesDelMotor = { aTiempo: true, sinReunion: false, fueraDelResiduo: false, enLaOtraMitad: false };
const decidir = (o: { secuencia?: Partial<typeof SEC_OK>; previa?: { estado: string; desenlace?: string | null } | null; motor?: Partial<CondicionesDelMotor> } = {}) =>
  decidirInscripcionManual({
    secuencia: { ...SEC_OK, ...o.secuencia },
    previa: o.previa ? { estado: o.previa.estado, desenlace: o.previa.desenlace ?? null } : null,
    motor: { ...MOTOR_OK, ...o.motor },
  });

// ── 1. La decisión ───────────────────────────────────────────────────────────

test('sin inscripción previa y con la secuencia andando, entra de cero', () => {
  assert.deepEqual(decidir(), { inscribe: true, como: 'nueva' });
});

test('la secuencia tiene que poder mandar: archivada, pausada o sin pasos no inscriben', () => {
  assert.deepEqual(decidir({ secuencia: { archivada: true } }), { inscribe: false, porque: 'archivada' });
  // El motor CIERRA sin mandar la inscripción vencida de una secuencia que no está activa.
  assert.deepEqual(decidir({ secuencia: { activa: false } }), { inscribe: false, porque: 'pausada' });
  assert.deepEqual(decidir({ secuencia: { pasos: 0 } }), { inscribe: false, porque: 'sin_pasos' });
});

test('no duplica: una inscripción EN CURSO se dice y no se toca', () => {
  for (const estado of ['activa', 'pendiente', 'pausada']) {
    assert.deepEqual(decidir({ previa: { estado } }), { inscribe: false, porque: 'en_curso' }, estado);
  }
});

test('lo TERMINADO vuelve a arrancar desde el primer paso, y sólo eso', () => {
  for (const estado of ESTADOS_TERMINADOS) {
    assert.deepEqual(decidir({ previa: { estado, desenlace: 'sin_respuesta' } }), { inscribe: true, como: 'reinicio' }, estado);
  }
});

test('⚠️ una CANCELADA no se reabre nunca (puede ser una baja), ni por estado ni por desenlace', () => {
  assert.deepEqual(decidir({ previa: { estado: 'cancelada' } }), { inscribe: false, porque: 'cancelada' });
  assert.deepEqual(decidir({ previa: { estado: 'completada', desenlace: 'cancelado' } }), { inscribe: false, porque: 'cancelada' });
  // Con el lead hablando o con una persona atendiendo, tampoco se reinicia.
  assert.deepEqual(decidir({ previa: { estado: 'respondio' } }), { inscribe: false, porque: 'respondio' });
  assert.deepEqual(decidir({ previa: { estado: 'handoff' } }), { inscribe: false, porque: 'handoff' });
  // En POSITIVO: un estado que no está en ninguna lista no se toca.
  assert.deepEqual(decidir({ previa: { estado: 'fallida' } }), { inscribe: false, porque: 'estado_desconocido' });
});

test('las listas no se pisan: en curso, terminado y cancelada son tres cosas', () => {
  for (const e of ESTADOS_EN_CURSO) assert.ok(!ESTADOS_TERMINADOS.includes(e), `${e} está en las dos listas`);
  assert.ok(!ESTADOS_EN_CURSO.includes('cancelada') && !ESTADOS_TERMINADOS.includes('cancelada'));
});

test('lo que el motor cerraría al mandar se contesta ANTES, y la regla de la fila previa va primero', () => {
  assert.deepEqual(decidir({ motor: { aTiempo: false } }), { inscribe: false, porque: 'fuera_de_antiguedad' });
  assert.deepEqual(decidir({ motor: { sinReunion: true } }), { inscribe: false, porque: 'sin_reunion' });
  assert.deepEqual(decidir({ motor: { fueraDelResiduo: true } }), { inscribe: false, porque: 'fuera_del_residuo' });
  assert.deepEqual(decidir({ motor: { enLaOtraMitad: true } }), { inscribe: false, porque: 'otra_mitad_post_agenda' });
  // Un reinicio también pasa por las guardas del motor: el paso 1 vuelve a mirar el tope.
  assert.deepEqual(decidir({ previa: { estado: 'completada' }, motor: { aTiempo: false } }), { inscribe: false, porque: 'fuera_de_antiguedad' });
  // «Ya está en curso» es lo que más informa: gana sobre las guardas del motor.
  assert.deepEqual(decidir({ previa: { estado: 'activa' }, motor: { aTiempo: false } }), { inscribe: false, porque: 'en_curso' });
});

// ── 2. El motivo que lee la persona ──────────────────────────────────────────

test('cada motivo tiene su frase, con el nombre si se leyó y el id si no', () => {
  const todos: PorQueNoSeInscribio[] = [
    'secuencia_no_existe', 'lead_no_existe', 'carrera', 'archivada', 'pausada', 'sin_pasos', 'en_curso', 'cancelada',
    'respondio', 'handoff', 'estado_desconocido', 'fuera_de_antiguedad', 'sin_reunion', 'fuera_del_residuo', 'otra_mitad_post_agenda',
  ];
  for (const p of todos) {
    const t = motivoNoInscribe(p, { secuenciaId: 7, secuencia: 'Bienvenida', leadId: 42, lead: 'Ana' });
    assert.ok(t.length > 20 && t.length < 260, `${p}: ${t.length} caracteres`);
  }
  // Un id que no es de este negocio dice CUÁL y dónde se consigue el bueno.
  assert.match(motivoNoInscribe('lead_no_existe', { secuenciaId: 7, leadId: 42 }), /No existe el lead #42 en este negocio\. Búscalo con buscar_leads\./);
  assert.match(motivoNoInscribe('secuencia_no_existe', { secuenciaId: 7, leadId: 42 }), /No existe la secuencia #7 en este negocio\. Pide el id con listar_secuencias_nutricion\./);
  assert.match(motivoNoInscribe('en_curso', { secuenciaId: 7, secuencia: 'Bienvenida', leadId: 42, lead: 'Ana' }), /^Ana ya está en «Bienvenida»/);
  assert.match(motivoNoInscribe('en_curso', { secuenciaId: 7, leadId: 42 }), /^el lead #42 ya está en «#7»/);
});

// ── 3. El motor: inscribirEnSecuencia ────────────────────────────────────────

const MOTOR = sinComentarios(leer('../lib/nutricion.ts'));
const FN = (() => {
  const ini = MOTOR.indexOf('export async function inscribirEnSecuencia(');
  assert.ok(ini > 0, 'no encontré inscribirEnSecuencia en lib/nutricion.ts');
  const fin = MOTOR.indexOf('\n}\n', ini);
  return MOTOR.slice(ini, fin);
})();

test('⚠️ el lead y la secuencia se leen con getTenantDb y, si no son de ESTE negocio, no se escribe nada', () => {
  assert.ok(FN.length > 1500 && FN.length < 6000, `inscribirEnSecuencia mide ${FN.length}: está mirando otra cosa`);
  assert.match(FN, /^export async function inscribirEnSecuencia\([^)]*\)[^{]*\{\s*const supabase = await getTenantDb\(\);/);
  assert.match(FN, /\.from\('nutricion_secuencias'\)\s*\.select\([^)]*\)\.eq\('id', secuenciaId\)\.maybeSingle\(\)/);
  assert.match(FN, /\.from\('leads'\)\s*\.select\([^)]*\)\.eq\('id', leadId\)\.maybeSingle\(\)/);
  // La FK de nutricion_inscripciones.lead_id es GLOBAL: sin esta lectura, el insert aceptaría
  // el id de un lead de otro negocio y le escribiría la secuencia de éste.
  const noSec = FN.indexOf("if (!s) return { inscribe: false, porque: 'secuencia_no_existe'");
  const noLead = FN.indexOf("if (!lead || !quien) return { inscribe: false, porque: 'lead_no_existe'");
  assert.ok(noSec > 0, 'una secuencia que no es de este negocio tiene que contestar secuencia_no_existe');
  assert.ok(noLead > 0, 'un lead de otro negocio tiene que contestar lead_no_existe');
  const primeraEscritura = Math.min(FN.indexOf('.insert('), FN.indexOf('await reactivarInscripcion('));
  assert.ok(noSec < primeraEscritura && noLead < primeraEscritura, 'los «no existe» van ANTES de cualquier escritura');
  // Las lecturas que fallan TIRAN: «no pude leer» no es «no existe».
  assert.match(FN, /if \(eSec\) throw /);
  assert.match(FN, /if \(eLead\) throw /);
});

test('soloVer decide sin escribir: es lo que llama el preparar() del registro', () => {
  const corte = FN.indexOf('if (opts?.soloVer) return hecho;');
  assert.ok(corte > 0, 'falta la salida de soloVer');
  assert.ok(corte < FN.indexOf('.insert('), 'soloVer tiene que salir antes del insert');
  assert.ok(corte < FN.indexOf('await reactivarInscripcion('), 'soloVer tiene que salir antes del reinicio');
  assert.ok(corte < FN.indexOf('procesarEnvios('), 'soloVer tiene que salir antes de la vía rápida');
  assert.match(FN, /const v = decidirInscripcionManual\(\{/, 'la decisión sale del módulo puro');
});

test('lo que el motor vuelve a mirar al mandar se pregunta con SUS funciones, y se escribe como el evento', () => {
  assert.match(FN, /await aTiempo\(supabase, /, 'el tope de antigüedad, con la misma puerta del motor');
  assert.match(FN, /reunionFuturaMs\(lead\) == null/, 'la reunión, como la mira procesarEnvios');
  assert.match(FN, /await residuoVigente\(supabase, \[leadId\]\)/, 'el residuo, como lo mira procesarEnvios');
  assert.match(FN, /FAMILIA_POST_AGENDA\.includes\(s\.trigger_tipo\)/, 'la otra mitad de la post-agenda');
  // El alta: la misma fila que enrolarPorEvento, con la reunión sólo en la familia que prepara una.
  assert.match(FN, /\.insert\(\{\s*lead_id: leadId, secuencia_id: s\.id, paso_actual: 0, estado: 'activa', proximo_envio_at: proximo,\s*\.\.\.\(prepara \? \{ reunion_at: reunionAt \} : \{\}\),/);
  // El primer envío lo programa el nodo de ENTRADA (08/10/2026): con ramas, `pasos[0]` puede ser
  // «Si responde» o una condición, y no el primer mensaje.
  assert.match(FN, /const proximo = proximoEnvioDePaso\(pasoDeEntrada\(pasos\), lead\);/);
  // El unique (lead_id, secuencia_id) que choca no es un error de la base: otra corrida ganó.
  assert.match(FN, /if \(error\?\.code === '23505'\) return \{ inscribe: false, porque: 'carrera'/);
  assert.match(FN, /try \{ await procesarEnvios\(\{ soloLeadId: leadId \}\); \}/, 'la vía rápida de enrolarPorEvento');
});

// ── 4. El runner ─────────────────────────────────────────────────────────────

const RUN = sinComentarios(leer('../lib/api-mako/areas/chatbot.run.ts'));
const RUNNER = (() => {
  const ini = RUN.indexOf('\n  inscribir_lead_secuencia: {');
  assert.ok(ini > 0, 'falta el runner inscribir_lead_secuencia');
  const sig = RUN.slice(ini + 4).search(/\n {2}[a-z][a-z0-9_]*: \{/);
  return RUN.slice(ini, ini + 4 + sig);
})();

test('preparar() no escribe: pregunta con soloVer; ejecutar() vuelve a decidir y deja historial', () => {
  const prep = RUNNER.slice(RUNNER.indexOf('preparar:'), RUNNER.indexOf('ejecutar:'));
  const ejec = RUNNER.slice(RUNNER.indexOf('ejecutar:'));
  assert.match(prep, /await inscribirEnSecuencia\(leadId, secuenciaId, \{ soloVer: true \}\)/);
  assert.match(prep, /if \(!v\.inscribe\) return \{ error: noSeInscribe\(v, leadId, secuenciaId\), \.\.\.\(v\.porque === 'en_curso' \? \{ yaEstaba: true \} : \{\}\) \};/, 'un lead de otro negocio o una secuencia inexistente vuelve como error');
  assert.doesNotMatch(prep, /logLeadEvent|\.insert\(|\.update\(|procesarEnvios/, 'preparar() no puede escribir');
  assert.match(ejec, /await inscribirEnSecuencia\(leadId, secuenciaId, \{ sinEnvioInmediato: desdeUnFlujo\(ctx\) \}\);/, 'al confirmar, sin soloVer');
  assert.doesNotMatch(ejec, /soloVer/);
  assert.match(ejec, /await logLeadEvent\(v\.lead\.id, 'Secuencia', /, 'la inscripción a mano queda en el historial del lead');
  assert.match(ejec, /ctx\.actor\?\.trim\(\) \|\| 'MaKo'/, 'con quién la pidió (la automatización o la persona)');
  assert.match(ejec, /\} catch \(e\) \{/, 'ejecutar() nunca lanza');
});

test('⚠️ desde un flujo no hay vía rápida: el paso puede estar corriendo ADENTRO de procesarEnvios', () => {
  // Volver a llamar a procesarEnvios para el mismo lead levantaría la inscripción del paso que
  // todavía no avanzó, y la acción correría dos veces. Lo que ya toca lo manda el cron.
  assert.match(FN, /if \(!opts\?\.sinEnvioInmediato\) \{\s*try \{ await procesarEnvios\(\{ soloLeadId: leadId \}\); \}/);
  assert.equal((FN.match(/procesarEnvios\(/g) ?? []).length, 1, 'una sola llamada al motor, y detrás de la guarda');
  assert.match(RUN, /const desdeUnFlujo = \(ctx: Ctx\): boolean => ctx\.canalKey\.startsWith\(PREFIJO_FLUJO\);/, 'el flujo se reconoce por su clave de scope');
});

// ── 5. La definición ─────────────────────────────────────────────────────────

test('la definición: chat, sin HTTP, sólo el admin, con el lead y la secuencia obligatorios', () => {
  const d = DEFS.find((x) => x.id === 'inscribir_lead_secuencia');
  assert.ok(d && d.tipo === 'accion', 'falta inscribir_lead_secuencia en chatbot.def.ts');
  assert.equal(d.confirmacion, 'chat');
  assert.deepEqual([...d.canales].sort(), ['app', 'whatsapp'], 'le escribe a una persona real: abrirlo a HTTP es una decisión');
  assert.deepEqual(d.gating, { tab: 'setting', rolMinimo: 'admin' });
  // Un mensaje que ya salió no se deshace, y la vía rápida puede mandarlo en el acto.
  assert.equal(d.reversible, false);
  for (const n of ['leadId', 'secuenciaId']) {
    const p = d.parametros.find((x) => x.nombre === n);
    assert.ok(p && p.obligatorio && p.tipo === 'number' && p.entero, `${n} tiene que ser un entero obligatorio`);
  }
  // `leadId` es lo que hace que un paso de flujo lo llene con el lead del EVENTO.
  assert.ok(d.parametros.some((p) => p.nombre === 'leadId'));
});
