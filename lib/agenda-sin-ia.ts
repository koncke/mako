// =============================================================================
// La agenda de Google no pasa por ningún modelo de IA.
//
// Decisión de Martín (07/10/2026), con sus palabras: «si la IA solo procesa la info
// que le pide el usuario, y la app se debe ejecutar con código interno, no con IA».
// El modelo lee lo que escribió la persona y elige qué hacer (con ids del CRM y la
// fecha y la hora COMO LAS DIJO); el CÓDIGO busca en la agenda y le muestra el
// detalle a la persona (`paraLaPersona`, que el doer agrega a la respuesta sin pasarlo
// por el modelo).
//
// ⚠️ TODO lo que una herramienta de agenda le dice al modelo o a la persona se arma
// ACÁ, en funciones puras: los runners (lib/api-mako/areas/crm.run.ts) leen la agenda
// y llaman a estas. Así la regla se prueba con datos falsos de verdad
// (tests/agenda-sin-ia.test.ts mete títulos y horarios centinela y mira adónde van),
// y no por los nombres de las variables: un test por nombres dio verde sobre la forma
// exacta del bug que se venía a arreglar (`const aviso = …choques…` + `${aviso}`).
//
// Lo que ve el modelo: un estado de una lista cerrada con su texto fijo, o un resumen
// armado sólo con lo que dijo la persona y el CRM. Lo que es de la agenda —el título
// de un evento, su horario, los títulos de los que se pisan, el texto de error de
// Google— va sólo a `paraLaPersona`, o al `payload` que lee el código al confirmar.
//
// Reemplaza a ac446f7f, que ruteaba esos turnos a proveedores «que no entrenan»: era
// el diagnóstico equivocado (ver docs/hallazgos-ia.md).
//
// SIN `server-only`: lo importan los runners del registro, el doer y el test.
// =============================================================================

import type { Ejecutado, Preparado, SalidaLectura } from './api-mako/tipos';

/** Una reunión de la agenda, como la devuelve `proximasReunionesCon`. */
export type ReunionAgenda = { inicioIso: string; titulo: string; duracionMin: number | null; organizaOtro: boolean };
/** Un horario de la grilla del día, como lo devuelve `horariosLibresDeGoogle`. */
export type SlotDia = { hora: string; libre: boolean };

// ── Lo que ve el modelo ───────────────────────────────────────────────────────

/**
 * El estado de una LECTURA de la agenda y qué hacer después. Las instrucciones son
 * NEUTRAS a propósito: no dicen si hubo algo o no, y le prohíben al modelo afirmarlo
 * —el bloque del código puede decir «no tienes huecos» justo debajo, y un «¿a qué hora
 * la quieres?» que dé por hecho que hay se lee como una contradicción—.
 */
export const ESTADOS_AGENDA = {
  horarios_mostrados: 'El sistema ya le mostró a la persona lo que tiene libre ese día en su agenda (puede que no haya nada): tú NO lo ves, así que no digas qué horarios hay ni que no hay. Pregúntale a qué hora la quiere y, con la hora que diga, propón agendar.',
  horarios_sin_verificar: 'No se pudo leer la agenda de ese día y el sistema ya se lo dijo a la persona. Pregúntale a qué hora la quiere.',
  reuniones_mostradas: 'El sistema ya le mostró a la persona lo que tiene ese lead en la agenda (puede que no haya nada): tú NO lo ves, así que no digas qué reuniones hay ni que no hay. Si quiere mover una, que te diga el día y la hora que tiene hoy, y llama a proponer_mover_reunion con eso.',
} as const;
export type EstadoAgenda = keyof typeof ESTADOS_AGENDA;

/** El texto de herramienta que recibe el modelo: sólo el estado y la instrucción fija. */
export function alModelo(estado: EstadoAgenda): string {
  return JSON.stringify({ ok: true, estado, instruccion: ESTADOS_AGENDA[estado] });
}

/** Lo que el modelo tiene que pedir cuando no está claro qué reunión se mueve. El doer
 *  lo mira para dejar el pedido abierto (ver `agendaQueSigue`). */
export const FALTA_CUAL = ['fecha_actual', 'hora_actual'] as const;

/** Los errores de mover que el modelo SÍ tiene que leer para seguir. Sólo llevan lo que
 *  dijo la persona o lo que sale del CRM (el nombre del lead), nunca la agenda. */
export const ERRORES_MOVER = {
  varias: (lead: string) => `${lead} tiene más de una reunión que coincide. El sistema ya le mostró la lista y le preguntó cuál (tú no la ves): no repitas la pregunta. Cuando diga el día o la hora que tiene hoy, vuelve a llamar con fecha_actual y hora_actual.`,
  ninguna: (lead: string) => `No encontré reuniones próximas de ${lead} en la agenda de Google del negocio (si la lectura de Google falló, también da vacío).`,
  ningunaQueCoincida: (lead: string) => `No encontré una reunión de ${lead} ese día u hora. El sistema ya le mostró las que tiene (tú no las ves): pregúntale cuál es.`,
  otraCuenta: 'Esa reunión la organiza otra cuenta de Google: hay que moverla desde esa agenda.',
  mismoHorario: 'Esa reunión ya está en ese horario: no hay nada que mover.',
} as const;

/** Por qué no salió una escritura en la agenda, en una frase fija por código. El
 *  `motivo` que arma lib/google-calendar.ts puede traer el título de un evento o el
 *  texto de error de Google: ése va a la persona, no al modelo. */
export function motivoFijo(codigo: string): string {
  switch (codigo) {
    case 'sin-conexion': return 'la agenda de Google no está conectada';
    case 'sin-permiso': return 'el permiso de la agenda no alcanza para escribir: hay que reconectarla';
    case 'sin-fecha': return 'la fecha no es válida';
    case 'no-organizador': return 'esa reunión la organiza otra cuenta de Google';
    case 'no-encontrado': return 'no encontré esa reunión en la agenda (puede que la hayan borrado o movido)';
    // 'api' cubre un error de Google, un timeout y la red: la frase no afirma cuál.
    default: return 'no se pudo completar con Google';
  }
}

// ── Formato ───────────────────────────────────────────────────────────────────

/** «jue 9 oct, 10:00» en la zona del negocio. Lo usan el resumen (con fechas que dijo
 *  la persona) y el detalle (con las de la agenda): la función no sabe cuál es cuál. */
export function cuandoLegible(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
  } catch { return iso; }
}

/** «jueves 9 oct» para un día YYYY-MM-DD. Al mediodía UTC: un día calendario no se
 *  corre de fecha por la zona. */
export function diaLegible(fecha: string): string {
  try {
    return new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '');
  } catch { return fecha; }
}

/** El día (YYYY-MM-DD) y los minutos desde medianoche de un instante, en la zona. */
function localDe(iso: string, tz: string): { dia: string; min: number } | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    const h = Number(p.hour) % 24;
    return { dia: `${p.year}-${p.month}-${p.day}`, min: h * 60 + Number(p.minute) };
  } catch { return null; }
}

/** «HH:MM» → minutos, o null. */
export function minutosDeHora(hora: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? h * 60 + mi : null;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * Los huecos libres de un día como rangos («09:00 a 11:30»), no 40 horas sueltas.
 * Cada slot es un INICIO libre (la reunión de `duracionMin` entra ahí), así que el
 * rango termina donde terminaría la reunión que empieza en el último: ése es el fin
 * real del hueco. Un rango que llega a medianoche dice «24:00», y uno que cubre el día
 * entero dice «todo el día» — antes salía «00:00 a 00:00», que se lee como «nada».
 */
export function rangosLibres(slots: readonly SlotDia[], pasoMin = 15, duracionMin = pasoMin): string[] {
  const out: string[] = [];
  let ini: number | null = null;
  let prev: number | null = null;
  const cerrar = () => {
    if (ini == null || prev == null) return;
    const fin = Math.min(prev + duracionMin, 24 * 60);
    out.push(ini === 0 && fin >= 24 * 60 ? 'todo el día' : `${hhmm(ini)} a ${hhmm(fin)}`);
  };
  for (const s of slots) {
    const m = minutosDeHora(s.hora);
    if (m == null) continue;
    if (s.libre && ini != null && prev != null && m === prev + pasoMin) { prev = m; continue; }
    cerrar();
    if (s.libre) { ini = m; prev = m; } else { ini = null; prev = null; }
  }
  cerrar();
  return out;
}

/** Las reuniones, en viñetas: SIN números, porque «la 2» no lo puede resolver nadie —el
 *  modelo no ve la lista—. Lo que sirve para elegir es el día y la hora. */
export function listaDeReuniones(rs: readonly Pick<ReunionAgenda, 'inicioIso' | 'titulo' | 'organizaOtro'>[], tz: string): string {
  return rs.map((r) => `• ${cuandoLegible(r.inicioIso, tz)} — «${r.titulo || 'sin título'}»${r.organizaOtro ? ' (la organiza otra cuenta)' : ''}`).join('\n');
}

/** Lo que va a la persona sale partido en mensajes por las líneas de «---» (el doer de
 *  WhatsApp separa así): un título de evento que sea sólo guiones no puede partirlo. */
export function paraWhatsApp(texto: string): string {
  return texto.replace(/^\s*-{3,}\s*$/gm, '—').trim();
}

/**
 * Cuál reunión nombró la persona, con lo que ella dijo: el día y, si lo dijo, la hora
 * (±10 minutos, la misma tolerancia que usa lib/google-calendar.ts para reconocer un
 * evento). Sin filtros, todas.
 */
export function filtrarReuniones<T extends { inicioIso: string }>(rs: readonly T[], filtro: { fecha?: string | null; hora?: string | null }, tz: string): T[] {
  const min = filtro.hora ? minutosDeHora(filtro.hora) : null;
  return rs.filter((r) => {
    const l = localDe(r.inicioIso, tz);
    if (!l) return false;
    if (filtro.fecha && l.dia !== filtro.fecha) return false;
    if (min != null && Math.abs(l.min - min) > 10) return false;
    return true;
  });
}

// ── Las salidas de cada herramienta ──────────────────────────────────────────

/** horarios_libres_dia. `motivo` es el del resultado de Google (va sólo a la persona). */
export function salidaHorarios(p: {
  fecha: string; codigo: string; motivo: string; slots: readonly SlotDia[]; pasoMin: number; duracionMin: number;
}): Exclude<SalidaLectura, string> {
  const dia = diaLegible(p.fecha);
  if (p.codigo !== 'ok') {
    return { content: alModelo('horarios_sin_verificar'), paraLaPersona: `No pude leer tu agenda de Google para el ${dia} (${p.motivo || motivoFijo(p.codigo)}), así que no sé qué horarios están libres.` };
  }
  // 'ok' sin horarios NO es «agenda llena»: el día ya pasó o no hay horarios
  // configurados, y Google ni se consultó. Se dice el motivo real.
  if (!p.slots.length) {
    return { content: alModelo('horarios_mostrados'), paraLaPersona: `🗓️ ${p.motivo || `No hay horarios para el ${dia}.`}` };
  }
  const rangos = rangosLibres(p.slots, p.pasoMin, p.duracionMin);
  return {
    content: alModelo('horarios_mostrados'),
    paraLaPersona: rangos.length ? `🗓️ Libre el ${dia}: ${rangos.join(', ')}.` : `🗓️ El ${dia} no tienes huecos libres en tu agenda.`,
  };
}

/** reuniones_agenda_lead. El modelo sólo sabe que se mostró: ni la lista ni cuántas. */
export function salidaReunionesDeLead(p: { nombre: string; reuniones: readonly ReunionAgenda[]; tz: string }): Exclude<SalidaLectura, string> {
  return {
    content: alModelo('reuniones_mostradas'),
    paraLaPersona: p.reuniones.length
      ? `🗓️ Próximas reuniones de ${p.nombre} en tu agenda:\n${listaDeReuniones(p.reuniones, p.tz)}\nSi quieres mover una, dime el día y la hora que tiene hoy.`
      : `🗓️ No encontré reuniones próximas de ${p.nombre} en tu agenda de Google (si la lectura de Google falló, también da vacío).`,
  };
}

/** proponer_agendar_agenda, preparar(). El título lo dijo la persona o sale del CRM;
 *  los choques son de la agenda y van a la persona. */
export function propuestaAgendar(p: {
  leadId: number; email: string; titulo: string; inicioIso: string; tz: string; duracionMin: number; choques: readonly string[];
}): Extract<Preparado, { payload: unknown }> {
  return {
    payload: { leadId: p.leadId, inicioIso: p.inicioIso, tz: p.tz, duracionMin: p.duracionMin, titulo: p.titulo, email: p.email },
    resumen: `Agendar «${p.titulo}» el ${cuandoLegible(p.inicioIso, p.tz)} (${p.duracionMin} min) en tu Google Calendar e invitar a ${p.email}.`,
    ...(p.choques.length ? { paraLaPersona: `⚠️ Ese horario se pisa en tu agenda con: ${p.choques.slice(0, 3).map((c) => `«${c}»`).join(', ')}.` } : {}),
  };
}

/** proponer_mover_reunion, preparar(): cuál reunión. O la reunión, o el error que
 *  lee el modelo con lo que va a la persona. */
export function elegirParaMover(p: {
  nombre: string; todas: readonly ReunionAgenda[]; fechaActual: string | null; horaActual: string | null; nuevoIso: string; tz: string;
}): { reunion: ReunionAgenda } | Extract<Preparado, { error: string }> {
  if (!p.todas.length) return { error: ERRORES_MOVER.ninguna(p.nombre) };
  const candidatas = filtrarReuniones(p.todas, { fecha: p.fechaActual, hora: p.horaActual }, p.tz);
  if (!candidatas.length) {
    return {
      error: ERRORES_MOVER.ningunaQueCoincida(p.nombre), faltan: [...FALTA_CUAL],
      paraLaPersona: `No encontré una reunión de ${p.nombre} ese día u hora. Las próximas que tiene en tu agenda:\n${listaDeReuniones(p.todas, p.tz)}\n¿Cuál movemos? Dime el día y la hora que tiene hoy.`,
    };
  }
  if (candidatas.length > 1) {
    return {
      error: ERRORES_MOVER.varias(p.nombre), faltan: [...FALTA_CUAL],
      paraLaPersona: `${p.nombre} tiene varias reuniones en tu agenda:\n${listaDeReuniones(candidatas, p.tz)}\n¿Cuál movemos? Dime el día y la hora que tiene hoy.`,
    };
  }
  const reunion = candidatas[0];
  if (reunion.organizaOtro) {
    return { error: ERRORES_MOVER.otraCuenta, paraLaPersona: `«${reunion.titulo}» (${cuandoLegible(reunion.inicioIso, p.tz)}) la organiza otra cuenta de Google: hay que moverla desde esa agenda.` };
  }
  if (Math.abs(Date.parse(p.nuevoIso) - Date.parse(reunion.inicioIso)) < 60_000) return { error: ERRORES_MOVER.mismoHorario };
  return { reunion };
}

/** proponer_mover_reunion, preparar(): la propuesta. Lo que dijo la persona para
 *  nombrarla («la del jueves 10:30») sí puede ir al resumen; el título y la hora que
 *  tiene en la agenda, no. El payload lo lee sólo el código al confirmar. */
export function propuestaMover(p: {
  leadId: number; nombre: string; email: string; reunion: ReunionAgenda; nuevoIso: string; tz: string;
  fechaActual: string | null; horaActual: string | null; choques: readonly string[];
}): Extract<Preparado, { payload: unknown }> {
  const cual = p.fechaActual ? ` del ${p.fechaActual}${p.horaActual ? ` ${p.horaActual}` : ''}` : (p.horaActual ? ` de las ${p.horaActual}` : '');
  return {
    payload: {
      leadId: p.leadId, leadNombre: p.nombre, inicioActualIso: p.reunion.inicioIso, nuevoIso: p.nuevoIso, tz: p.tz,
      titulo: p.reunion.titulo, email: p.email, duracionMin: p.reunion.duracionMin ?? null,
    },
    resumen: `Mover la reunión con ${p.nombre}${cual} al ${cuandoLegible(p.nuevoIso, p.tz)} en tu Google Calendar. Google le avisa a ${p.email}.`,
    paraLaPersona: `La que se mueve: «${p.reunion.titulo}», hoy el ${cuandoLegible(p.reunion.inicioIso, p.tz)}.${p.choques.length ? `\n⚠️ El horario nuevo se pisa con: ${p.choques.slice(0, 3).map((c) => `«${c}»`).join(', ')}.` : ''}`,
  };
}

/** Lo que se confirma pasó a ser pasado: no se escribe nada. La hora es la que dijo la
 *  persona. */
export function yaPaso(que: 'agendó' | 'movió', iso: string, tz: string): Ejecutado {
  return { ok: false, resumen: `No se ${que}: el ${cuandoLegible(iso, tz)} ya pasó. Pídelo de nuevo con otra hora.` };
}

/** proponer_agendar_agenda, ejecutar(). */
export function resultadoAgendar(p: {
  ok: boolean; codigo: string; motivo: string; titulo: string; inicioIso: string; tz: string; email: string;
}): Ejecutado {
  if (!p.ok) return { ok: false, resumen: `No se agendó: ${motivoFijo(p.codigo)}.`, paraLaPersona: `No se agendó: ${p.motivo}` };
  return { ok: true, resumen: `Listo: «${p.titulo}» quedó el ${cuandoLegible(p.inicioIso, p.tz)} en tu Google Calendar, y ${p.email} ya tiene la invitación.` };
}

/** proponer_mover_reunion, ejecutar(). El título y la hora vieja salen del payload,
 *  o sea de la agenda: van a la persona. */
export function resultadoMover(p: {
  ok: boolean; codigo: string; motivo: string; titulo: string; antesIso: string; nuevoIso: string; tz: string; conQuien: string;
}): Ejecutado {
  if (!p.ok) return { ok: false, resumen: `No se movió: ${motivoFijo(p.codigo)}.`, paraLaPersona: `No se movió: ${p.motivo}` };
  return {
    ok: true,
    resumen: `Listo: la reunión con ${p.conQuien} quedó el ${cuandoLegible(p.nuevoIso, p.tz)}, y Google ya les avisó a los invitados.`,
    paraLaPersona: `Movida: «${p.titulo}», del ${cuandoLegible(p.antesIso, p.tz)} al ${cuandoLegible(p.nuevoIso, p.tz)}.`,
  };
}

/** Las líneas del historial del lead. Lo lee un modelo (`historial_lead`): sólo lo que
 *  dijo la persona y el CRM. */
export function historialAgendar(p: { titulo: string; inicioIso: string; tz: string; canal: string; email: string }): string {
  return `«${p.titulo}» para el ${cuandoLegible(p.inicioIso, p.tz)}, en Google Calendar, desde ${p.canal}. Google le mandó la invitación a ${p.email}.`;
}
export function historialMover(p: { conQuien: string; nuevoIso: string; tz: string; canal: string }): string {
  return `La reunión con ${p.conQuien} pasó al ${cuandoLegible(p.nuevoIso, p.tz)}, en Google Calendar, desde ${p.canal}.`;
}

// ── Lo que el system del doer dice de la agenda ──────────────────────────────

/**
 * El bloque del system del doer de WhatsApp para la agenda de Google, armado con las
 * herramientas que VIAJAN en el turno (un prompt que nombra una herramienta que no se
 * mandó es una trampa: ver DOER_WA_TOOLS en lib/mako-doer-in.ts). Hace falta porque la
 * receta de agendar del system es la de Calendly («ofrécele 3 opciones» con horarios
 * que el modelo SÍ ve), y para «reagendá» viajan las dos a la vez.
 */
export function bloqueAgendaGoogle(nombres: readonly string[]): string {
  const hay = (n: string) => nombres.includes(n);
  const lineas: string[] = [];
  if (hay('proponer_agendar_agenda')) lineas.push(`- AGENDAR en su Google Calendar: proponer_agendar_agenda con la fecha y la hora que dijo la persona.${hay('horarios_libres_dia') ? ' Si no dijo la hora, usa horarios_libres_dia y pregúntale cuál quiere.' : ' Si no dijo la hora, pregúntasela.'}`);
  if (hay('proponer_mover_reunion')) lineas.push('- MOVER o REAGENDAR una reunión que YA está en su Google Calendar: proponer_mover_reunion (nunca crea una nueva), con el día y la hora que tiene hoy si los dijo. Para esto NO uses la receta de Calendly.');
  if (hay('reuniones_agenda_lead')) lineas.push('- «¿Qué reuniones tiene X?» en su Google Calendar: reuniones_agenda_lead.');
  if (!lineas.length) return '';
  return `\n\nAGENDA DE GOOGLE: tú NO ves la agenda. El sistema le muestra a la persona, directo, los horarios, las reuniones y los choques. No escribas horarios ni títulos de la agenda, ni afirmes que un horario está libre o que no hay nada.\n${lineas.join('\n')}`;
}

// ── El pedido que queda abierto en el grupo ──────────────────────────────────

/**
 * Después de mostrarle a la persona las opciones de su agenda, su respuesta es corta
 * («la de las 16», «a las 11») y el clasificador de intención la lee como material
 * para anotar: el turno llegaba sin las herramientas de agenda. Esto dice si una salida
 * deja el pedido ABIERTO, y qué herramienta lo sigue. Lo que se guarda es lo que el
 * modelo mandó (ids del CRM, fecha y hora como las dijo la persona): nada de la agenda.
 */
export type AgendaAbierta = { herramienta: 'proponer_mover_reunion' | 'proponer_agendar_agenda'; datos: Record<string, unknown>; desde: number };
export const AGENDA_ABIERTA_MIN = 30;

export function agendaQueSigue(nombre: string, input: Record<string, unknown>, salida: unknown, ahora: number): AgendaAbierta | null {
  let j: Record<string, unknown> | null = null;
  const texto = typeof salida === 'string' ? salida : (salida && typeof salida === 'object' && typeof (salida as { content?: unknown }).content === 'string') ? (salida as { content: string }).content : '';
  try { j = JSON.parse(texto) as Record<string, unknown>; } catch { return null; }
  if (!j || typeof j !== 'object') return null;
  if (nombre === 'horarios_libres_dia' && (j.estado === 'horarios_mostrados' || j.estado === 'horarios_sin_verificar')) {
    return { herramienta: 'proponer_agendar_agenda', datos: { fecha: input.fecha }, desde: ahora };
  }
  if (nombre === 'reuniones_agenda_lead' && j.estado === 'reuniones_mostradas') {
    return { herramienta: 'proponer_mover_reunion', datos: { leadId: input.leadId }, desde: ahora };
  }
  if (nombre === 'proponer_mover_reunion' && j.ok === false && Array.isArray(j.faltan) && j.faltan.includes('fecha_actual')) {
    return { herramienta: 'proponer_mover_reunion', datos: { leadId: input.leadId, fecha: input.fecha, hora: input.hora }, desde: ahora };
  }
  return null;
}

/** El pedido se cierra cuando una acción de agenda dejó su pendiente: lo que sigue es
 *  el «sí», que tiene su propio camino. */
export function agendaSeCierra(nombre: string, salida: unknown): boolean {
  if (nombre !== 'proponer_mover_reunion' && nombre !== 'proponer_agendar_agenda') return false;
  if (typeof salida !== 'string') return false;
  try {
    const j = JSON.parse(salida) as Record<string, unknown>;
    return j?.ok === true && typeof j.pendiente_id === 'number';
  } catch { return false; }
}

/** El pedido abierto que se guardó, si sigue vigente. Lo que no se puede leer, no vale. */
export function agendaVigente(guardado: string | null, ahora: number): AgendaAbierta | null {
  if (!guardado) return null;
  try {
    const a = JSON.parse(guardado) as AgendaAbierta;
    if (!a || (a.herramienta !== 'proponer_mover_reunion' && a.herramienta !== 'proponer_agendar_agenda')) return null;
    if (typeof a.desde !== 'number' || ahora - a.desde > AGENDA_ABIERTA_MIN * 60_000) return null;
    return a;
  } catch { return null; }
}

/** La línea del system que le cuenta al modelo que hay un pedido de agenda en curso.
 *  Sólo lleva lo que mandó el modelo (ids y lo que dijo la persona). */
export function contextoAgendaAbierta(a: AgendaAbierta): string {
  return `\n\nPEDIDO DE AGENDA EN CURSO: hace un momento el sistema le mostró a la persona opciones de su agenda (tú no las ves) para ${a.herramienta}, con estos datos: ${JSON.stringify(a.datos)}. Si este mensaje elige una (un día, una hora), sigue ese pedido llamando ${a.herramienta} con esos datos y lo que eligió${a.herramienta === 'proponer_mover_reunion' ? ' (lo que dice de la reunión que se mueve va en fecha_actual y hora_actual)' : ''}. Si habla de otra cosa, ignora esto.`;
}
