// La campaña no le quita el cupo a la bienvenida (21/10/2026, la prospección del Sprint de Mauricio)
// =============================================================================
// El tope de WhatsApp es UNO por negocio (40/día y 6/hora de fábrica) y la cola era FIFO: una campaña de 1.000 se
// ponía delante del audio de «Un Lead Entró» y a la tarde se había comido el día. Se fija la regla
// (lib/nutricion-prioridad.ts, ejecutada) y el cableado en el motor (lib/nutricion.ts: del fuente sólo se lee eso).
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esEntradaFresca, reservaParaEntradas, cupoDeCampana, textoPrioridad, HORAS_ENTRADA } from '../lib/nutricion-prioridad';

const H = 3_600_000;
const AHORA = Date.parse('2026-10-21T18:00:00Z');
const hace = (horas: number) => new Date(AHORA - horas * H).toISOString();

test('entrada fresca: entró POR UN CANAL o agendó en las últimas 24 h', () => {
  assert.equal(HORAS_ENTRADA, 24);
  assert.equal(esEntradaFresca({ created_at: hace(2), origen_lead: 'instant_form' }, AHORA), true);
  assert.equal(esEntradaFresca({ created_at: hace(30), origen_lead: 'instant_form' }, AHORA), false);
  // Importado o cargado a mano hoy (sin origen): NO es una entrada — una base fría importada a la mañana se llevaba el
  // cupo entero a la tarde (revisión adversarial del 21/10/2026).
  assert.equal(esEntradaFresca({ created_at: hace(2) }, AHORA), false);
  assert.equal(esEntradaFresca({ created_at: hace(2), origen_lead: '  ' }, AHORA), false);
  assert.equal(esEntradaFresca({ created_at: hace(300 * 24), fecha_agenda: '2026-10-21' }, AHORA), true, 'un lead viejo que agendó hoy');
  assert.equal(esEntradaFresca({ created_at: hace(300 * 24), fecha_agenda: '2026-10-18' }, AHORA), false);
  for (const nada of [null, undefined, {}, { created_at: 'x', fecha_agenda: 'ayer' }]) assert.equal(esEntradaFresca(nada, AHORA), false);
});

test('la reserva: una hora del cupo por día (con techo) y 1 por hora', () => {
  assert.deepEqual(reservaParaEntradas({ dia: 40, hora: 6 }), { dia: 6, hora: 1 }, 'los de fábrica');
  assert.deepEqual(reservaParaEntradas({ dia: 150, hora: 30 }), { dia: 10, hora: 1 }, 'con el tope alto, no 30 por día sin usar');
  assert.deepEqual(reservaParaEntradas({ dia: 2, hora: 1 }), { dia: 1, hora: 0 }, 'la prueba del ws3: la campaña manda 1 por día');
  assert.deepEqual(reservaParaEntradas({ dia: 1, hora: 1 }), { dia: 0, hora: 0 }, 'con 1 por día no se reserva nada: la campaña no se queda en cero');
});

test('el cupo de la campaña en una corrida: el de la corrida menos la reserva, nunca negativo', () => {
  const r = { dia: 6, hora: 1 };
  assert.equal(cupoDeCampana({ cupo: 6, presupuesto: 40, horaTope: 6, enLaHora: 0, reserva: r, porHora: true }), 5);
  assert.equal(cupoDeCampana({ cupo: 3, presupuesto: 40, horaTope: 6, enLaHora: 3, reserva: r, porHora: true }), 2);
  assert.equal(cupoDeCampana({ cupo: 6, presupuesto: 6, horaTope: 6, enLaHora: 0, reserva: r, porHora: true }), 0, 'lo último del día es de lo que entra');
  assert.equal(cupoDeCampana({ cupo: 6, presupuesto: 40, horaTope: 6, enLaHora: 0, reserva: r, porHora: false }), 6, 'la vía rápida no mira la hora');
  assert.equal(cupoDeCampana({ cupo: 0, presupuesto: 2, horaTope: 6, enLaHora: 6, reserva: r, porHora: true }), 0);
});

/**
 * UN DÍA DE MAURICIO, simulado con la regla: de 9 a 21, una campaña con 1.000 vencidos y UNA bienvenida que entra a
 * las 17:00. Cada hora, primero lo que entra (cupo entero) y después la campaña (su cupo). Sin la regla (lo de antes:
 * FIFO, todo con el mismo cupo), la campaña se lleva las 40 antes de las 17 y la bienvenida no sale ese día.
 */
function unDia(conRegla: boolean): { bienvenidaSale: number | null; campana: number } {
  const wa = { dia: 40, hora: 6 };
  const reserva = conRegla ? reservaParaEntradas(wa) : { dia: 0, hora: 0 };
  let enviados = 0; let campana = 0; let bienvenidaSale: number | null = null;
  for (let hora = 9; hora < 21; hora += 1) {
    let enLaHora = 0;
    const presupuesto = () => wa.dia - enviados;
    const cupo = () => Math.max(0, Math.min(wa.hora - enLaHora, presupuesto()));
    const entra = bienvenidaSale == null && hora >= 17;
    if (entra && conRegla && cupo() > 0) { enviados += 1; enLaHora += 1; bienvenidaSale = hora; }
    while (campana < 1000 && enLaHora < cupoDeCampana({ cupo: wa.hora, presupuesto: wa.dia - (enviados - enLaHora), horaTope: wa.hora, enLaHora: 0, reserva, porHora: true }) && cupo() > 0) {
      enviados += 1; enLaHora += 1; campana += 1;
    }
    // FIFO: la bienvenida, detrás de la campaña.
    if (entra && !conRegla && cupo() > 0) { enviados += 1; enLaHora += 1; bienvenidaSale = hora; }
  }
  return { bienvenidaSale, campana };
}

test('un día: con la regla la bienvenida de las 17 sale a las 17; sin ella, no sale ese día', () => {
  const antes = unDia(false);
  assert.equal(antes.bienvenidaSale, null, 'el escenario de antes ya no reproduce el problema');
  assert.equal(antes.campana, 40);
  const ahora = unDia(true);
  assert.equal(ahora.bienvenidaSale, 17);
  assert.equal(ahora.campana, 34, 'la campaña usa el día menos la reserva');
});

test('la regla está dicha en Configuraciones (en el ⓘ del bloque «Todos los canales»), con los números del negocio', () => {
  assert.equal(textoPrioridad({ dia: 40, hora: 6 }),
    'Primero lo que entra: a un lead que llegó por un formulario, una landing o una agenda, o que agendó, en las últimas 24 h le sale antes que a una campaña. La campaña le deja 6 por día y 1 por hora.');
  assert.ok(!textoPrioridad({ dia: 1, hora: 1 }).includes('le deja'), 'sin reserva no promete una');
  const panel = readFileSync(join(__dirname, '..', 'app/automations/ConfigAutomatizacionPanel.tsx'), 'utf8');
  // 22/10/2026 (Martín: «Elimina todo el texto innecesario»): era una línea suelta debajo del grupo; va en su ⓘ. Desde el
  // 23/10/2026 la línea ya no se edita en la pantalla de una automatización, pero la regla sigue frenando: la dice el ⓘ del
  // bloque de CADA automatización, con los números del negocio (desde el 24/10/2026 el bloque es «Todos los canales», f21).
  assert.match(panel, /info: d \? `\$\{INFO_TODOS_LOS_CANALES\} \$\{textoPrioridad\(d\.lineaWa\)\}` : undefined,/);
  assert.match(panel, /<GrupoOpciones titulo="Todos los canales" info=\{auto\.info\} primero \/>/);
});

// ── El cableado en el motor ─────────────────────────────────────────────────────────────────────────────────────
const motor = readFileSync(join(__dirname, '..', 'lib/nutricion.ts'), 'utf8').replace(/\r\n/g, '\n');
const proc = motor.slice(motor.indexOf('export async function procesarEnvios('), motor.indexOf('\n}\n', motor.indexOf('export async function procesarEnvios(')));

test('procesarEnvios: los mensajes chequean `sinLugar` (no el cupo a secas) y lo que entra va primero', () => {
  assert.ok(proc.length > 1000, 'no encontré procesarEnvios');
  assert.match(proc, /const sinLugarEnLaLinea = \(leadId: number\): boolean => cupoLleno\(\) \|\| \(!frescos\.has\(leadId\) && waEnCorrida >= cupoCampana\);/);
  // (Desde el 22/10/2026 `sinLugar` suma el goteo de la automatización, y desde el 23/10 el de su canal: tests/goteo-automatizacion.test.ts.)
  assert.equal((proc.match(/if \(sinLugar\(insc, [^)]*\) && !/g) ?? []).length, 2, 'los dos puntos donde un mensaje espera al cupo');
  assert.doesNotMatch(proc, /if \(cupoLleno\(\) && !/, 'quedó un mensaje que mira el cupo sin la reserva');
  assert.match(proc, /if \(primeroEntradas\) q = q\.in\('lead_id', \[\.\.\.frescos\]\);/);
  assert.match(proc, /const frescos = await entradasFrescas\(supabase, opts\?\.soloLeadId \?\? null\);/);
  // La reserva sale del tope de HOY de la línea, con la rampa (5/11/2026, Black November): con el de fábrica, un número que
  // arranca en 20 reservaría lo de un día de 40. La rampa la prueba tests/rampa-whatsapp.test.ts.
  assert.match(proc, /const lineaWa = \{ \.\.\.limites\.wa, dia: topeWaHoy \};/);
  assert.match(proc, /reserva: reservaParaEntradas\(lineaWa\), porHora: !!opts\?\.cupoPorHora/);
  // UNA vuelta para lo que entró, devolviéndola: la cola general no se queda sin turno. Son DOS salidas de la fase (no
  // quedó nada fresco / ya se miró la vuelta) y las dos la devuelven.
  assert.equal((proc.match(/primeroEntradas\) \{ primeroEntradas = false; rondas -= 1; continue; \}/g) ?? []).length, 2);
});

test('quién entró se lee sin tirar: si falla, nadie va primero (se manda menos, no más)', () => {
  const ini = motor.indexOf('async function entradasFrescas(');
  const cuerpo = motor.slice(ini, motor.indexOf('\n}\n', ini));
  assert.match(cuerpo, /catch \(e\) \{[\s\S]*return new Set\(\);/);
  assert.match(cuerpo, /esEntradaFresca\(l, Date\.now\(\)\)/, 'la misma regla que el módulo');
  assert.match(cuerpo, /and\(created_at\.gte\.\$\{[^}]+\},origen_lead\.not\.is\.null\)/, 'la consulta pide el canal, como la regla');
});

// ── Las roturas (7 tests; sin romper nada: 7 pases, 0 fallos) ──────────────────────────────────────────────────────
// 1. `esEntradaFresca` sin mirar `fecha_agenda`: 1 fallo / 6 pases.
// 2. La reserva por día sin el techo (`TOPE_RESERVA_DIA`): 1 fallo / 6 pases.
// 3. `cupoDeCampana` sin restar la reserva por día: 2 fallos / 5 pases (el cupo y el día simulado).
// 4. El motor con `cupoLleno()` en el mensaje (lo de antes): 1 fallo / 6 pases.
// 5. Sin la vuelta de «primero lo que entra»: 1 fallo / 6 pases.
// 6. El panel sin la línea: 1 fallo / 6 pases.
// 7. `esEntradaFresca` sin mirar el canal (lo importado como fresco, revisión adversarial): 1 fallo / 6 pases.
// 8. La fase de lo que entra sin devolver la vuelta (o mirando más de una vuelta): 1 fallo / 6 pases.
