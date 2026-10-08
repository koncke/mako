// =============================================================================
// La agenda de Google no pasa por ningún modelo de IA.
// =============================================================================
// Decisión de Martín (07/10/2026): el modelo lee lo que escribió la persona y elige qué
// hacer; el CÓDIGO busca en la agenda y le muestra el detalle a la persona. Reemplaza al
// ruteo «sólo a proveedores que no entrenan» de esa misma mañana (ac446f7f), que era el
// diagnóstico equivocado.
//
// Lo que fija este archivo:
//   1. los constructores de lib/agenda-sin-ia.ts, con CENTINELAS: títulos, horarios y
//      motivos falsos que no pueden aparecer en nada que lea el modelo y sí en lo que va
//      a la persona. Es comportamiento, no nombres de variables: la primera versión de
//      este test buscaba nombres y daba verde sobre la forma exacta del bug de antes;
//   2. que los runners de agenda NO armen texto: sólo leen la agenda y llaman a esos
//      constructores, y sus errores propios sólo llevan lo que dice el CRM;
//   3. que toda operación que llega a lib/google-calendar lo declare (con rebote);
//   4. la tubería: el registro entrega `paraLaPersona` sin mezclarlo con lo que ve el
//      modelo, el doer lo manda y no lo guarda, el chat de la app no ofrece esas
//      herramientas, la bandeja lo muestra, y el ruteo viejo no volvió;
//   5. el pedido de agenda que queda abierto para la respuesta corta de la persona;
//   6. reuniones_lead, el CRM automático, el reagendar de la pantalla y la extracción.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REGISTRO } from '../lib/api-mako/registro';
import { clasificarIntencion } from '../lib/mako-intencion';
import {
  alModelo, ESTADOS_AGENDA, motivoFijo, filtrarReuniones, rangosLibres, listaDeReuniones, paraWhatsApp, diaLegible,
  salidaHorarios, salidaReunionesDeLead, propuestaAgendar, elegirParaMover, propuestaMover, yaPaso, resultadoAgendar,
  resultadoMover, historialAgendar, historialMover, agendaQueSigue, agendaSeCierra, agendaVigente, contextoAgendaAbierta,
  bloqueAgendaGoogle, AGENDA_ABIERTA_MIN, type ReunionAgenda,
} from '../lib/agenda-sin-ia';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// --- 1. Los constructores, con centinelas -------------------------------------

// Buenos Aires: UTC-3 todo el año. 13:37Z → 10:37 local: una hora que nadie diría.
const TZ = 'America/Argentina/Buenos_Aires';
const TITULO = 'ZZTITULOZZ';
const CHOQUE = 'ZZCHOQUEZZ';
const MOTIVO = 'ZZMOTIVOZZ';
const HORA_AGENDA = '10:37';
const CENTINELAS = [TITULO, CHOQUE, MOTIVO, HORA_AGENDA];

const REUNION: ReunionAgenda = { inicioIso: '2026-10-09T13:37:00Z', titulo: TITULO, duracionMin: 45, organizaOtro: false };
const OTRA: ReunionAgenda = { inicioIso: '2026-10-09T20:37:00Z', titulo: `${TITULO}-2`, duracionMin: 30, organizaOtro: false };
// Lo que dijo la persona: el sábado 10 a las 16:00.
const NUEVO = '2026-10-10T19:00:00Z';

/** Todo lo que puede leer un modelo de una salida: el texto de herramienta, el resumen
 *  (que además vuelve en cada turno mientras la pendiente vive), el error, lo que falta
 *  y lo que ofrece como disponible. NO el payload (lo lee sólo el código al confirmar)
 *  ni `paraLaPersona`. */
function visibleParaElModelo(x: Record<string, unknown>): string {
  return JSON.stringify([x.content, x.resumen, x.error, x.faltan, x.disponibles]);
}
const sinCentinelas = (texto: string, que: string) => {
  for (const c of CENTINELAS) assert.ok(!texto.includes(c), `${que} le pasa al modelo «${c}», que es de la agenda: ${texto.slice(0, 200)}`);
};

test('horarios: el modelo sólo recibe el estado; los huecos y el motivo de Google, la persona', () => {
  const slots = [{ hora: '10:30', libre: false }, { hora: '10:45', libre: true }];
  const ok = salidaHorarios({ fecha: '2026-10-09', codigo: 'ok', motivo: '', slots, pasoMin: 15, duracionMin: 45 });
  sinCentinelas(visibleParaElModelo(ok), 'horarios ok');
  assert.match(ok.paraLaPersona ?? '', /10:45 a 11:30/);
  const mal = salidaHorarios({ fecha: '2026-10-09', codigo: 'api', motivo: MOTIVO, slots: [], pasoMin: 15, duracionMin: 45 });
  sinCentinelas(visibleParaElModelo(mal), 'horarios sin verificar');
  assert.match(mal.paraLaPersona ?? '', new RegExp(MOTIVO));
  // 'ok' sin horarios NO es «agenda llena»: se dice el motivo real (el día ya pasó).
  const vacio = salidaHorarios({ fecha: '2026-10-09', codigo: 'ok', motivo: 'Ya pasaron todos los horarios de hoy.', slots: [], pasoMin: 15, duracionMin: 45 });
  assert.match(vacio.paraLaPersona ?? '', /Ya pasaron/);
  assert.doesNotMatch(vacio.paraLaPersona ?? '', /no tienes huecos/);
});

test('reuniones de un lead: el modelo no ve la lista ni cuántas hay', () => {
  const con = salidaReunionesDeLead({ nombre: 'Juan', reuniones: [REUNION], tz: TZ });
  const sin = salidaReunionesDeLead({ nombre: 'Juan', reuniones: [], tz: TZ });
  sinCentinelas(visibleParaElModelo(con), 'reuniones');
  assert.equal(con.content, sin.content, 'el modelo distingue «hay» de «no hay»');
  assert.match(con.paraLaPersona ?? '', new RegExp(TITULO));
  assert.match(con.paraLaPersona ?? '', new RegExp(HORA_AGENDA));
});

test('agendar: los choques van a la persona, no al resumen', () => {
  const p = propuestaAgendar({ leadId: 1, email: 'ana@x.com', titulo: 'Visita con Ana', inicioIso: NUEVO, tz: TZ, duracionMin: 45, choques: [CHOQUE] });
  sinCentinelas(visibleParaElModelo(p), 'propuesta de agendar');
  assert.match(p.paraLaPersona ?? '', new RegExp(CHOQUE));
  const r = resultadoAgendar({ ok: false, codigo: 'api', motivo: MOTIVO, titulo: 'Visita con Ana', inicioIso: NUEVO, tz: TZ, email: 'ana@x.com' });
  sinCentinelas(visibleParaElModelo(r), 'resultado de agendar');
  assert.match(r.paraLaPersona ?? '', new RegExp(MOTIVO));
  assert.doesNotMatch(historialAgendar({ titulo: 'Visita con Ana', inicioIso: NUEVO, tz: TZ, canal: 'WhatsApp', email: 'ana@x.com' }), new RegExp(CENTINELAS.join('|')));
});

test('mover: elegir la reunión no le muestra la agenda al modelo', () => {
  const varias = elegirParaMover({ nombre: 'Juan', todas: [REUNION, OTRA], fechaActual: '2026-10-09', horaActual: null, nuevoIso: NUEVO, tz: TZ });
  assert.ok('error' in varias);
  sinCentinelas(visibleParaElModelo(varias), 'mover con varias');
  assert.deepEqual(varias.faltan, ['fecha_actual', 'hora_actual']);
  assert.match(varias.paraLaPersona ?? '', new RegExp(TITULO));

  const ninguna = elegirParaMover({ nombre: 'Juan', todas: [REUNION], fechaActual: '2026-10-12', horaActual: null, nuevoIso: NUEVO, tz: TZ });
  assert.ok('error' in ninguna);
  sinCentinelas(visibleParaElModelo(ninguna), 'mover sin coincidencia');

  const otraCuenta = elegirParaMover({ nombre: 'Juan', todas: [{ ...REUNION, organizaOtro: true }], fechaActual: null, horaActual: null, nuevoIso: NUEVO, tz: TZ });
  assert.ok('error' in otraCuenta);
  sinCentinelas(visibleParaElModelo(otraCuenta), 'mover de otra cuenta');

  const una = elegirParaMover({ nombre: 'Juan', todas: [REUNION, OTRA], fechaActual: '2026-10-09', horaActual: '10:30', nuevoIso: NUEVO, tz: TZ });
  assert.ok('reunion' in una && una.reunion.titulo === TITULO);
});

test('mover: la propuesta, el resultado y el historial no llevan el título ni la hora vieja', () => {
  const p = propuestaMover({ leadId: 1, nombre: 'Juan', email: 'j@x.com', reunion: REUNION, nuevoIso: NUEVO, tz: TZ, fechaActual: null, horaActual: null, choques: [CHOQUE] });
  sinCentinelas(visibleParaElModelo(p), 'propuesta de mover');
  assert.equal(p.payload.titulo, TITULO, 'el payload SÍ lleva el título: lo usa el código para encontrar el evento');
  assert.match(p.paraLaPersona ?? '', new RegExp(`${TITULO}[\\s\\S]*${HORA_AGENDA}[\\s\\S]*${CHOQUE}`));
  const ok = resultadoMover({ ok: true, codigo: 'ok', motivo: '', titulo: TITULO, antesIso: REUNION.inicioIso, nuevoIso: NUEVO, tz: TZ, conQuien: 'Juan' });
  sinCentinelas(visibleParaElModelo(ok), 'resultado de mover');
  assert.match(ok.paraLaPersona ?? '', new RegExp(TITULO));
  const mal = resultadoMover({ ok: false, codigo: 'no-organizador', motivo: MOTIVO, titulo: TITULO, antesIso: REUNION.inicioIso, nuevoIso: NUEVO, tz: TZ, conQuien: 'Juan' });
  sinCentinelas(visibleParaElModelo(mal), 'fallo de mover');
  const h = historialMover({ conQuien: 'Juan', nuevoIso: NUEVO, tz: TZ, canal: 'WhatsApp' });
  sinCentinelas(h, 'el historial del lead (lo lee historial_lead)');
  sinCentinelas(JSON.stringify(yaPaso('movió', NUEVO, TZ)), 'ya pasó');
});

// --- Los auxiliares puros -------------------------------------------------------

test('lo que ve el modelo después de una lectura es sólo el estado y su instrucción fija', () => {
  for (const estado of Object.keys(ESTADOS_AGENDA) as Array<keyof typeof ESTADOS_AGENDA>) {
    const j = JSON.parse(alModelo(estado)) as Record<string, unknown>;
    assert.deepEqual(Object.keys(j).sort(), ['estado', 'instruccion', 'ok']);
    assert.equal(j.instruccion, ESTADOS_AGENDA[estado]);
  }
  assert.equal(motivoFijo(`cualquier cosa «${TITULO}»`), 'no se pudo completar con Google');
});

test('la reunión la elige el código con el día y la hora que dijo la persona', () => {
  assert.equal(filtrarReuniones([REUNION, OTRA], {}, TZ).length, 2);
  assert.equal(filtrarReuniones([REUNION, OTRA], { fecha: '2026-10-09' }, TZ).length, 2);
  assert.deepEqual(filtrarReuniones([REUNION, OTRA], { hora: '10:30' }, TZ).map((r) => r.titulo), [TITULO]); // ±10 min
  assert.equal(filtrarReuniones([REUNION, OTRA], { hora: '10:20' }, TZ).length, 0);
  assert.equal(filtrarReuniones([REUNION, OTRA], { fecha: '2026-10-10' }, TZ).length, 0);
});

test('los huecos como rangos: el fin real, el fin del día y el día entero', () => {
  const s = (h: string, libre: boolean) => ({ hora: h, libre });
  assert.deepEqual(rangosLibres([s('09:00', true), s('09:15', true), s('09:30', false), s('09:45', true)], 15, 15), ['09:00 a 09:30', '09:45 a 10:00']);
  // El hueco termina donde terminaría la reunión del último inicio libre.
  assert.deepEqual(rangosLibres([s('09:00', true), s('09:15', true)], 15, 45), ['09:00 a 10:00']);
  assert.deepEqual(rangosLibres([s('23:30', true), s('23:45', true)], 15, 45), ['23:30 a 24:00']);
  const todoElDia = Array.from({ length: 96 }, (_, i) => s(`${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`, true));
  assert.deepEqual(rangosLibres(todoElDia, 15, 45), ['todo el día']);
  assert.deepEqual(rangosLibres([s('09:00', false)]), []);
});

test('lo que ve la persona: viñetas sin números, el día legible, sin cortes de mensaje', () => {
  const l = listaDeReuniones([REUNION, OTRA], TZ).split('\n');
  assert.equal(l.length, 2);
  for (const x of l) assert.match(x, /^• /);
  assert.equal(paraWhatsApp('• «x»\n---\n• «y»'), '• «x»\n—\n• «y»');
  assert.match(diaLegible('2026-10-09'), /^viernes 9 de oct/); // el 9/10/2026 es viernes
});

// --- 5. El pedido de agenda que queda abierto ------------------------------------

test('el pedido queda abierto sólo con lo que mandó el modelo, y se cierra con la pendiente', () => {
  const ahora = 1_000_000;
  const mostrar = agendaQueSigue('horarios_libres_dia', { fecha: '2026-10-09' }, salidaHorarios({ fecha: '2026-10-09', codigo: 'ok', motivo: '', slots: [{ hora: '10:00', libre: true }], pasoMin: 15, duracionMin: 45 }), ahora);
  assert.deepEqual(mostrar, { herramienta: 'proponer_agendar_agenda', datos: { fecha: '2026-10-09' }, desde: ahora });
  // De un «varias», sólo los datos del input: nada de lo que el código le mostró.
  const varias = elegirParaMover({ nombre: 'Juan', todas: [REUNION, OTRA], fechaActual: null, horaActual: null, nuevoIso: NUEVO, tz: TZ });
  const salidaVarias = JSON.stringify({ ok: false, error: (varias as { error: string }).error, faltan: (varias as { faltan: string[] }).faltan });
  const abierta = agendaQueSigue('proponer_mover_reunion', { leadId: 7, fecha: '2026-10-10', hora: '16:00' }, salidaVarias, ahora);
  assert.ok(abierta);
  sinCentinelas(contextoAgendaAbierta(abierta), 'el contexto del pedido abierto');
  assert.equal(agendaQueSigue('buscar_leads', {}, '{"ok":true}', ahora), null);
  // Vigencia
  assert.ok(agendaVigente(JSON.stringify(abierta), ahora + 60_000));
  assert.equal(agendaVigente(JSON.stringify(abierta), ahora + (AGENDA_ABIERTA_MIN + 1) * 60_000), null);
  assert.equal(agendaVigente('basura', ahora), null);
  // Cierre
  assert.equal(agendaSeCierra('proponer_mover_reunion', JSON.stringify({ ok: true, pendiente_id: 4 })), true);
  assert.equal(agendaSeCierra('proponer_mover_reunion', salidaVarias), false);
  assert.equal(agendaSeCierra('buscar_leads', JSON.stringify({ ok: true, pendiente_id: 4 })), false);
});

test('con un pedido de agenda abierto, la respuesta corta es una acción, no material para anotar', () => {
  for (const t of ['la de las 16', 'a las 11', 'el jueves', 'la del jueves a las 10']) {
    assert.equal(clasificarIntencion(t, { hayAgendaAbierta: true }).intencion, 'actuar', t);
    assert.notEqual(clasificarIntencion(t, {}).intencion, 'actuar', `${t}: sin pedido abierto no se fuerza`);
  }
  // Un «sí» con una pendiente sigue siendo confirmar, y lo largo sigue su camino.
  assert.equal(clasificarIntencion('sí', { hayAgendaAbierta: true, hayPendientes: true }).intencion, 'confirmar');
  assert.notEqual(clasificarIntencion('1. llamar a Juan\n2. mandar presupuesto\n3. revisar campaña', { hayAgendaAbierta: true }).intencion, 'actuar');
});

test('el bloque de agenda del system sólo nombra las herramientas que viajan', () => {
  assert.equal(bloqueAgendaGoogle(['buscar_leads']), '');
  const b = bloqueAgendaGoogle(['proponer_mover_reunion']);
  assert.match(b, /proponer_mover_reunion/);
  assert.doesNotMatch(b, /proponer_agendar_agenda|horarios_libres_dia|reuniones_agenda_lead/);
});

// --- 2. Los runners no arman texto -------------------------------------------------

/** Los runners de un `.run.ts`: clave de primer nivel (2 espacios) → su cuerpo. */
function runners(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const claves = [...src.matchAll(/^ {2}([a-z][a-z0-9_]*): \{/gm)];
  claves.forEach((m, i) => out.set(m[1], src.slice(m.index!, claves[i + 1]?.index ?? src.length)));
  return out;
}

const AGENDA = ['horarios_libres_dia', 'reuniones_agenda_lead', 'proponer_agendar_agenda', 'proponer_mover_reunion'];

test('los runners de agenda no arman texto: sólo leen la agenda y llaman a los constructores', () => {
  const rs = runners(sinComentarios(leer('lib/api-mako/areas/crm.run.ts')));
  // Lo único que un runner de agenda puede escribir como error es lo que sale del CRM o
  // del pedido: un literal, el nombre del lead, el «no existe», «sin agenda» o la fecha
  // mal formada. Nada leído de Google.
  const permitido = /^(?:noExiste\(input\.leadId\)|sinAgenda|t\.error|'[^'$`]*'|`(?:[^`$]|\$\{lead\.nombre\})*`)\s*[,)}]/;
  for (const id of AGENDA) {
    const cuerpo = rs.get(id);
    assert.ok(cuerpo, `no encontré el runner ${id}`);
    for (const prohibido of ['resumen:', 'content:', 'paraLaPersona:', 'payload:', 'json(', 'disponibles:']) {
      assert.ok(!cuerpo.includes(prohibido), `${id} arma su propio «${prohibido}»: tiene que salir de lib/agenda-sin-ia.ts`);
    }
    for (const m of cuerpo.matchAll(/\b(?:error:|fallo\()\s*/g)) {
      const resto = cuerpo.slice(m.index! + m[0].length);
      assert.match(resto, permitido, `${id}: un error con algo que no es del CRM: ${resto.slice(0, 120)}`);
    }
    // El historial del lead lo lee un modelo (historial_lead): su texto sale de un constructor.
    for (const m of cuerpo.matchAll(/\banotar\(/g)) {
      assert.match(cuerpo.slice(m.index!), /^anotar\(id, '[^']*', historial\w+\(\{/, `${id}: el historial del lead se escribe con historialAgendar/historialMover`);
    }
  }
});

// --- 3. Toda operación que llega a la agenda lo declara ---------------------------

/** Las exportaciones de lib/google-calendar.ts, TODAS clasificadas. */
const DEVUELVEN_DATOS = [
  'buscarEventosGoogle', 'invitadosDeReunionPorFecha', 'duracionDeReunionEnAgendaMin',
  'moverEventoDeReunion', 'crearEventoDeReunion', 'proximasReunionesCon', 'choquesEnAgenda',
  'horariosLibresDeGoogle',
];
const NO_DEVUELVEN_DATOS = [
  'GCAL_SCOPE_LECTURA', 'GCAL_SCOPE_ESCRITURA', 'GCAL_SCOPE', 'googleRedirectUri',
  'guardarRefreshTokenGoogle', 'desconectarGoogleCalendar', 'googleCalendarConectado',
  // de QUIÉN es la agenda y si se puede escribir: la misma cuenta que da el scope `email`
  'googleCalendarDueno', 'emailDelCalendario', 'permisoCalendarioGoogle',
  // la zona horaria del calendario: es la del negocio, no un dato de un tercero
  'tzDelCalendarioGoogle',
];

test('cada exportación de lib/google-calendar.ts está clasificada', () => {
  const src = leer('lib/google-calendar.ts');
  const exportadas = [...src.matchAll(/^export (?:async )?(?:function|const) ([A-Za-z_]\w*)/gm)].map((m) => m[1]);
  const clasificadas = new Set([...DEVUELVEN_DATOS, ...NO_DEVUELVEN_DATOS]);
  assert.deepEqual(exportadas.filter((e) => !clasificadas.has(e)), [], 'clasifícala en este test');
});

/** Las funciones (de cualquier archivo de las áreas) que llegan a la agenda, hasta un
 *  punto fijo: una auxiliar que llama a otra que llama a Google también cuenta. */
function funcionesQueLleganALaAgenda(fuentes: string[]): Set<string> {
  const defs: Array<{ nombre: string; cuerpo: string }> = [];
  for (const src of fuentes) {
    for (const m of src.matchAll(/^(?:export )?(?:async )?function (\w+)\(|^(?:export )?const (\w+) = (?:async )?\(/gm)) {
      const fin = src.slice(m.index!).search(/\n\};?\n/);
      defs.push({ nombre: m[1] ?? m[2], cuerpo: src.slice(m.index!, fin < 0 ? src.length : m.index! + fin) });
    }
  }
  const llegan = new Set(DEVUELVEN_DATOS);
  for (let cambio = true; cambio;) {
    cambio = false;
    for (const d of defs) {
      if (llegan.has(d.nombre)) continue;
      if ([...llegan].some((f) => new RegExp(`\\b${f}\\(`).test(d.cuerpo))) { llegan.add(d.nombre); cambio = true; }
    }
  }
  return llegan;
}

test('toda operación cuyo runner llega a la agenda de Google lo declara (con rebote)', () => {
  const dir = join(RAIZ, 'lib/api-mako/areas');
  const archivos = readdirSync(dir).filter((x) => x.endsWith('.ts'));
  const fuentes = archivos.map((f) => sinComentarios(readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n')));
  const llegan = funcionesQueLleganALaAgenda(fuentes);
  const defPorId = new Map(REGISTRO.map((d) => [d.id, d]));
  const faltan: string[] = [];
  const vistos = new Set<string>();
  archivos.forEach((f, i) => {
    if (!f.endsWith('.run.ts')) return;
    for (const [id, cuerpo] of runners(fuentes[i])) {
      vistos.add(id);
      if ([...llegan].some((fn) => new RegExp(`\\b${fn}\\(`).test(cuerpo)) && !defPorId.get(id)?.datosDeGoogle) faltan.push(`${f} → ${id}`);
    }
  });
  assert.deepEqual(faltan, [], 'falta `datosDeGoogle: true` en su .def.ts');
  for (const id of AGENDA) assert.equal(defPorId.get(id)?.datosDeGoogle, true, id);
  // El parser tiene que ver a TODOS los runners, o lo que no ve no lo revisa nadie.
  const sinVer = REGISTRO.map((d) => d.id).filter((id) => !vistos.has(id));
  assert.deepEqual(sinVer, [], 'el parser de runners no ve estas operaciones: cambió la forma y este test dejó de mirarlas');
});

test('lo que lee la agenda no sale por HTTP: ahí no hay persona, sólo otro modelo', () => {
  for (const d of REGISTRO.filter((x) => x.datosDeGoogle)) assert.ok(!d.canales.includes('http'), d.id);
});

// --- 4. La tubería -----------------------------------------------------------------

test('el registro entrega `paraLaPersona` y nunca lo mezcla con lo que ve el modelo', () => {
  for (const f of ['lib/api-mako/ejecutar.ts', 'lib/api-mako/acciones.ts']) {
    const lineas = sinComentarios(leer(f)).split('\n').filter((l) => l.includes('paraLaPersona'));
    assert.ok(lineas.length > 0, `${f} no entrega paraLaPersona`);
    for (const l of lineas) {
      assert.match(l, /^\s*if \([^;]*\) ctx\.aPersona\?\.\(\w+\.paraLaPersona\);\s*$/, `${f}: paraLaPersona fuera de su entrega: ${l.trim()}`);
    }
  }
  const ej = sinComentarios(leer('lib/api-mako/ejecutar.ts'));
  assert.equal((ej.match(/ctx\.aPersona\?\.\(/g) ?? []).length, 3, 'la lectura, el error de preparar y la propuesta');
  // La de la propuesta, DESPUÉS de guardar la pendiente.
  const iPend = ej.indexOf('const c = await proponerChat(');
  const iEntrega = ej.indexOf('if (prep.paraLaPersona) ctx.aPersona?.(prep.paraLaPersona);');
  assert.ok(iPend > 0 && iEntrega > iPend, 'el detalle tiene que salir después de guardar la pendiente');
});

test('el doer de WhatsApp manda lo del código DESPUÉS de la respuesta y no lo guarda en el historial', () => {
  const doer = sinComentarios(leer('lib/mako-doer-in.ts'));
  assert.match(doer, /aPersona: \(t\) => \{/);
  assert.match(doer, /const enviar = \[\.\.\.partes, \.\.\.paraLaPersona\];/);
  const tras = doer.slice(doer.indexOf('const enviar = ['));
  const guardado = /await guardarTurno\(wsData, jid, 'assistant', ([^,]+),/.exec(tras);
  assert.ok(guardado, 'no encontré el guardado del turno');
  assert.equal(guardado[1].trim(), "partes.join('\\n\\n')", 'el historial tiene que guardar sólo lo que dijo el modelo');
  assert.ok(doer.indexOf('const enviar = [') > doer.indexOf('validarRespuestaDoer(respuesta, { motivoRuta'), 'lo del código va después del validador');
  // Y el pedido abierto: se lee antes de clasificar, y lo dejan/cierran las herramientas.
  assert.match(doer, /hayAgendaAbierta: !!agendaAbierta/);
  assert.match(doer, /agendaQueSigue\(name, input, out, Date\.now\(\)\)/);
  assert.match(doer, /bloqueAgendaGoogle\(tools\.map\(\(t\) => t\.name\)\)/);
});

test('el chat de la app no ofrece las herramientas que leen la agenda', () => {
  const app = sinComentarios(leer('app/api/mako-doer/route.ts'));
  assert.match(app, /REGISTRO\.filter\(\(d\) => d\.datosDeGoogle\)/);
  assert.match(app, /toolsDelRegistro\(\{[^}]*excluir,/);
});

test('la bandeja de pendientes le muestra el detalle a la persona que confirma', () => {
  const b = sinComentarios(leer('app/mako/pendientes/acciones.ts'));
  assert.match(b, /confirmarPendiente\(\{ \.\.\.c\.ctx, aPersona:/);
});

test('no volvió el ruteo a proveedores «que no entrenan»: Gemini sirve igual', () => {
  assert.equal(existsSync(join(RAIZ, 'lib/datos-google-ia.ts')), false);
  for (const f of ['lib/ai-cheap.ts', 'lib/mako-doer-in.ts', 'lib/fallo-ia-texto.ts']) {
    assert.doesNotMatch(leer(f), /puedeRecibirDatosDeGoogle|ProveedorQueEntrena|apartadas/, f);
  }
});

// --- 6. Los otros caminos ------------------------------------------------------------

test('lo que va a un modelo busca las reuniones SIN Google; sólo la pantalla con', () => {
  const llamadas: string[] = [];
  const conGoogle: string[] = [];
  const visitar = (rel: string) => {
    for (const e of readdirSync(join(RAIZ, rel), { withFileTypes: true })) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'node_modules') visitar(r); continue; }
      if (!/\.tsx?$/.test(e.name)) continue;
      const src = sinComentarios(leer(r));
      // Las LLAMADAS, no la declaración (`function buscarReunionesAutomatico(lead, opts)`).
      for (const m of src.matchAll(/(?<!function )buscarReunionesAutomatico\(([^)]*)\)/g)) {
        llamadas.push(r);
        if (/conGoogle:\s*true/.test(m[1])) conGoogle.push(r);
        else assert.match(m[1], /conGoogle:\s*false/, `${r}: buscarReunionesAutomatico sin decidir conGoogle`);
      }
    }
  };
  visitar('lib');
  visitar('app');
  assert.ok(llamadas.includes('lib/mako-tools.ts') && llamadas.includes('lib/crm-auto.ts'), 'no encontré a los llamadores conocidos');
  assert.deepEqual(conGoogle, ['app/crm/auto-actions.ts'], 'con Google sólo la pantalla, que la ve una persona');
});

test('el historial que deja el reagendar de la pantalla no guarda el motivo crudo de Google', () => {
  const a = sinComentarios(leer('app/crm/actions.ts'));
  assert.match(a, /`No se pudo mover el evento: \$\{motivoFijo\(cal\.codigo \?\? 'api'\)\}\.`/);
  const lib = sinComentarios(leer('lib/google-calendar.ts'));
  assert.doesNotMatch(lib, /nada\('no-organizador', `[^`]*evento\.summary/);
});

/** El cuerpo de una función, hasta la siguiente `export` de primer nivel. */
function cuerpoDe(src: string, firma: string): string {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré ${firma}`);
  const fin = src.indexOf('\nexport ', ini + firma.length);
  return src.slice(ini, fin < 0 ? src.length : fin);
}

test('los invitados que vienen de Google Calendar no entran al prompt de la extracción', () => {
  const src = sinComentarios(leer('lib/plan-fathom.ts'));
  const nucleo = cuerpoDe(src, 'export async function extraerTareasDeTexto(');
  assert.match(nucleo, /const paraElPrompt = participantes\.filter\(\(p\) => !p\.delCalendario\);/);
  assert.match(nucleo, /const listaParticipantes = paraElPrompt\.length\s*\?\s*paraElPrompt\.map/);
  assert.match(nucleo, /coerceCandidatas\(obj, proyectos, yo, participantes\)/);
  assert.match(src, /delCal\.map\(\(i\) => \(\{ nombre: i\.nombre, email: i\.email, delCalendario: true as const \}\)\)/);
});

// Probado rompiéndolo (07/10/2026), una rotura por vez y con todo en verde antes: 23
// roturas, cada una con 1 fallo en el test que dice cuidarla. Entre ellas las cuatro
// formas que la PRIMERA versión de este test (por nombres de variable) dejaba pasar en
// verde, según la revisión adversarial: los choques al resumen como estaban en HEAD
// (`${aviso}`), el título y la hora vieja al resumen de mover, `disponibles:` con las
// candidatas, y la hora vieja al historial del lead. Más: el motivo de Google y el título
// al resultado, el estado que distingue «hay» de «no hay», «00:00 a 00:00», la lista
// numerada, un runner con su propio resumen o con un error que cita la agenda, la marca
// y el HTTP de las definiciones, ejecutar.ts y confirmarPendiente mezclando el detalle,
// el historial del grupo, el chat de la app, la bandeja, el clasificador, reuniones_lead
// con Google, el reagendar de la pantalla, el prompt de la extracción y el ruteo viejo.
