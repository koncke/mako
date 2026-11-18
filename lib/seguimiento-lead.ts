// =============================================================================
// seguimiento-lead — «agendar llamar a Valery en dos semanas»: la nota Y el evento del Calendario (puro)
// =============================================================================
// Ticket #110 (Marcela, ws 23, 18/11/2026 07:24 UTC). Pidió en el grupo: «agrega una nota al lead valery que quede agendada en su
// ficha del CRM, la nota dice: agendar llamar en dos semanas para coordinar reunión (…)». MaKo propuso la nota y la parte de
// «agendar» la DELEGÓ al equipo como pedido #110, cuando la herramienta existe (`crear_evento_calendario`, una «llamada de venta»
// en el Calendario de MaKo).
//
// ⚠️ NO FUE EL MODELO (corrió con Haiku, y el diagnóstico obvio era ése). Medido con el turno real (`herramientasDelTurno`): el pedido
// sólo nombraba el área `crm` —la del área `calendario` pide «calendario» o agendar UNA PUBLICACIÓN o un bloque (lib/mako-intencion.ts,
// AREA_KEYWORDS)— y `crear_evento_calendario` NO VIAJÓ. Ningún modelo propone lo que no tiene. Y aunque hubiera viajado, nada le decía
// que un «agendar llamar en dos semanas» es un evento del Calendario y no sólo el texto de la nota.
//
// Lo que fija este módulo, sin leer nada:
//   · `pideSeguimiento`: un recordatorio de CONTACTAR a alguien MÁS ADELANTE. Un verbo de contactar en infinitivo (llamar, contactar,
//     escribirle, hacer seguimiento) con un cuándo futuro, y agendar/recordar delante; «llamar a X en dos semanas» alcanza solo (MaKo
//     no llama: es un recordatorio). «agéndame una REUNIÓN / una llamada con Juan» NO entra: es una reunión con el lead, con su
//     invitación (`proponer_agendar_agenda`), y sigue como estaba.
//   · `fechaDelSeguimiento`: el día, calculado por el CÓDIGO desde hoy en la zona del negocio («en dos semanas» = hoy + 14). Una
//     fecha que el modelo suma de cabeza es una llamada en el día equivocado.
//   · `instruccionDelSeguimiento`: proponer las DOS cosas en el mismo turno, y que un solo «sí» las confirme.
// El evento NO se ata al lead: `calendario_eventos` no tiene columna de lead (supabase/migrations/0271). Por eso el nombre va en el
// título y en las notas (docs/hallazgos-calendario.md). Lo del turno, en docs/hallazgos-ia.md; el «sí» que confirma las dos, en
// docs/hallazgos-api-mako.md.
// =============================================================================

import { sumarDias, diaDeLaSemana } from './calendario-modelo';

const sinTildes = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const NUMEROS: Readonly<Record<string, number>> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30,
};
const PALABRA_NUMERO = Object.keys(NUMEROS).join('|');
/** «en dos semanas», «dentro de 10 días», «en un par de semanas», «en 1 mes». */
const RX_EN_N = new RegExp(`\\b(?:en|dentro de)\\s+(?:(\\d{1,3})|(${PALABRA_NUMERO})|(un par de))\\s+(dias?|semanas?|mes(?:es)?)\\b`);
const RX_SEMANA_QUE_VIENE = /\b(?:(?:la|esta) semana (?:que viene|proxima|entrante)|la proxima semana)\b/;
const RX_MES_QUE_VIENE = /\b(?:el mes (?:que viene|proximo|entrante)|el proximo mes)\b/;
const RX_PASADO_MANANA = /\bpasado manana\b/;
/** «mañana» el día, no «por la mañana» ni «de la mañana». */
const RX_MANANA = /(?<!\b(?:la|esta|cada|pasado)\s)\bmanana\b/;
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const RX_DIA = new RegExp(`\\b(?:el|este|el proximo|el otro)\\s+(${DIAS.join('|')})\\b`);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;
const RX_D_DE_MES = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES.join('|')}|setiembre)\\b`);
const RX_D_BARRA_M = /\b(\d{1,2})\/(\d{1,2})\b/;

/** Agendar, recordar, avisar, anotar o programar: lo que convierte «contactarlo» en algo para el Calendario. */
const RX_AGENDAR = /\b(?:agend(?:a|ar|ame|alo|ala|ale|arlo|arla|arle|ado|ada|emos)|recorda(?:r|rme|rle|me|torio)|recuerda(?:me|le)?|acorda(?:r|rme|te)|avisa(?:me|rme)?|anota(?:me|lo|r)?|programa(?:r|me|lo|la)?|pon(?:me|e|le)?\s+(?:un\s+)?(?:recordatorio|aviso))\b/;
/** Llamar a alguien: el verbo, nunca «una llamada» (eso es una reunión con el lead, con su invitación). MaKo no llama: es un recordatorio. */
const RX_LLAMAR = /\b(?:llamar(?:l[oae]s?)?|volver a llamar(?:l[oae]s?)?)\b/;
/** Contactar, escribirle, hacer seguimiento: sólo con agendar/recordar delante («escríbele en dos días» podría ser un WhatsApp programado). */
const RX_CONTACTAR = /\b(?:contactar(?:l[oae]s?)?|escribir(?:l[oae]s?)?|(?:hacer(?:le)?|dar(?:le)?)\s+(?:el\s+)?seguimiento|seguimiento|retomar|volver a (?:hablar|escribir|contactar)(?:l[oae]s?)?|hablar con)\b/;

/** Lo que nombra el Plan: una tarea, el plan, un to-do. */
const RX_PLAN = /\b(?:tareas?|to-?dos?|(?:al|en el|del|mi|el) plan)\b/;

/** ¿Hay un CUÁNDO futuro que se pueda poner en el Calendario? */
function nombraUnCuando(t: string): boolean {
  return RX_EN_N.test(t) || RX_SEMANA_QUE_VIENE.test(t) || RX_MES_QUE_VIENE.test(t) || RX_PASADO_MANANA.test(t) || RX_MANANA.test(t)
    || RX_DIA.test(t) || RX_D_DE_MES.test(t) || RX_D_BARRA_M.test(t);
}

/**
 * ¿Piden acordarse de CONTACTAR a alguien más adelante? «agendar llamar en dos semanas», «recuérdame llamar a Juan el lunes», «llamar
 * a Valery en 2 semanas», «agéndame hacerle seguimiento a Pedro la semana que viene». Un cuándo futuro siempre; con «llamar» alcanza
 * eso, con contactar o escribir hace falta agendar/recordar delante. «agéndame una reunión/llamada con Juan» no: es una reunión.
 */
export function pideSeguimiento(texto: string): boolean {
  const t = sinTildes(texto).slice(0, 2000);
  if (!nombraUnCuando(t)) return false;
  // Una TAREA del Plan no es esto: «anotá: llamar a Nicolás el lunes» y «agregá al plan que hay que llamar a Juan» van al Plan
  // (tests/crm-pedidos-whatsapp.test.ts). Las reglas ya las leen como `capturar`, pero la clase de la IA puede volverlas `actuar`.
  if (RX_PLAN.test(t)) return false;
  if (RX_LLAMAR.test(t)) return true;
  return RX_AGENDAR.test(t) && RX_CONTACTAR.test(t);
}

/** Suma meses de calendario a 'YYYY-MM-DD' (el 31 de un mes de 30 cae el 30). */
function sumarMeses(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/** El próximo `dia` y `mes` desde hoy (si ya pasó este año, el que viene). null si la fecha no existe. */
function proximaFecha(hoy: string, dia: number, mes: number): string | null {
  const anio = Number(hoy.slice(0, 4));
  for (const y of [anio, anio + 1]) {
    const f = new Date(Date.UTC(y, mes - 1, dia));
    if (f.getUTCMonth() !== mes - 1) return null;
    const iso = f.toISOString().slice(0, 10);
    if (iso >= hoy) return iso;
  }
  return null;
}

/**
 * El día del seguimiento, calculado desde `hoy` ('YYYY-MM-DD', en la zona del negocio). «en dos semanas» = hoy + 14, «en un mes» =
 * el mismo día del mes que viene, «el lunes» = el próximo lunes (hoy lunes → el de la semana que viene). null si no se puede saber
 * («en unos días»): entonces la calcula el modelo desde «HOY ES» o la pregunta.
 */
export function fechaDelSeguimiento(texto: string, hoy: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hoy)) return null;
  const t = sinTildes(texto).slice(0, 2000);
  const n = t.match(RX_EN_N);
  if (n) {
    const cant = n[1] ? Number(n[1]) : n[2] ? NUMEROS[n[2]] : 2;
    if (!cant) return null;
    if (n[4].startsWith('semana')) return sumarDias(hoy, cant * 7);
    if (n[4].startsWith('mes')) return sumarMeses(hoy, cant);
    return sumarDias(hoy, cant);
  }
  if (RX_SEMANA_QUE_VIENE.test(t)) return sumarDias(hoy, 7);
  if (RX_MES_QUE_VIENE.test(t)) return sumarMeses(hoy, 1);
  if (RX_PASADO_MANANA.test(t)) return sumarDias(hoy, 2);
  if (RX_MANANA.test(t)) return sumarDias(hoy, 1);
  const d = t.match(RX_DIA);
  if (d) {
    const hasta = (DIAS.indexOf(d[1] as (typeof DIAS)[number]) - diaDeLaSemana(hoy) + 7) % 7;
    return sumarDias(hoy, hasta || 7);
  }
  const dm = t.match(RX_D_DE_MES);
  if (dm) return proximaFecha(hoy, Number(dm[1]), dm[2] === 'setiembre' ? 9 : MESES.indexOf(dm[2] as (typeof MESES)[number]) + 1);
  const db = t.match(RX_D_BARRA_M);
  if (db) return proximaFecha(hoy, Number(db[1]), Number(db[2]));
  return null;
}

/** La hora que dijo la persona ('HH:MM', 24 h), o null. «a las 10», «a las 5 de la tarde», «16:30», «10hs». */
export function horaDelSeguimiento(texto: string): string | null {
  const t = sinTildes(texto).slice(0, 2000);
  const m = t.match(/\ba las (\d{1,2})(?::(\d{2}))?\s*(?:hs?\b|horas?\b)?\s*(de la (?:tarde|noche)|pm\b|de la manana|am\b)?/)
    ?? t.match(/\b(\d{1,2}):(\d{2})\s*(?:hs?\b)?\s*(pm\b|am\b)?/)
    ?? t.match(/\b(\d{1,2})\s*hs\b()\s*(pm\b|am\b)?/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (m[3] && /tarde|noche|pm/.test(m[3]) && h < 12) h += 12;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** La hora del evento cuando la persona no la dice: una hora de trabajo, en la zona del negocio. Se dice en la propuesta. */
export const HORA_DEL_SEGUIMIENTO = '10:00';

const LEGIBLE_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
const LEGIBLE_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;
/** «miércoles 2 de diciembre», para que el modelo lo diga sin calcular el día de la semana. */
export const fechaLegible = (f: string): string => `${LEGIBLE_DIA[diaDeLaSemana(f)]} ${Number(f.slice(8, 10))} de ${LEGIBLE_MES[Number(f.slice(5, 7)) - 1]}`;

/**
 * La línea del system de ESTE turno. Nombra sólo las herramientas que viajan (un prompt que nombra una que no viajó es una trampa):
 * quien la arma pasa `hayNota` según si `agregar_nota_lead` está en el turno.
 */
export function instruccionDelSeguimiento(p: { texto: string; hoy?: string | null; hayNota: boolean; enLaApp?: boolean }): string {
  const fecha = p.hoy ? fechaDelSeguimiento(p.texto, p.hoy) : null;
  const dicha = horaDelSeguimiento(p.texto);
  const hora = dicha ?? HORA_DEL_SEGUIMIENTO;
  const cuando = fecha
    ? `fecha ${fecha} (${fechaLegible(fecha)}, ya calculada desde hoy: úsala tal cual)`
    : 'la fecha que dijo, calculada desde «HOY ES» (si no dijo cuándo, pregúntalo en una línea)';
  const laHora = dicha
    ? `hora ${hora} (la que dijo)`
    : `hora ${hora} (no dijo hora: es una hora de trabajo razonable; dilo en la propuesta para que la cambie si quiere)`;
  const nota = p.hayNota
    ? '1) Si es un lead del CRM: agregar_nota_lead con la nota en sus palabras (si no tienes su id, búscalo primero con buscar_leads).\n2) '
    : '';
  return [
    'TE PIDEN AGENDAR UN SEGUIMIENTO PARA MÁS ADELANTE (llamar o contactar a alguien en una fecha). Es algo que puedes hacer: no lo delegues ni lo dejes sólo en el texto de una nota. En ESTE turno, sin preguntar antes, propón:',
    `${nota}crear_evento_calendario con tipo «llamada», título «Llamar a <su nombre como figura en el CRM>», ${cuando}, ${laHora} en la zona del negocio, duracionMin 15, y en notas el nombre del lead y para qué es la llamada.`,
    'El evento del Calendario no queda atado a la ficha del lead: por eso su nombre va en el título y en las notas. No es una reunión con el lead: nada de proponer_agendar_agenda ni crear_evento_google, que le mandan una invitación.',
    // En la app no hay «sí» escrito: cada propuesta es una tarjeta que la persona toca (lib/mako-turno-app-reglas.ts, CONFIRMAR).
    p.enLaApp
      ? (p.hayNota ? 'Las dos quedan propuestas, cada una en su tarjeta: la persona las confirma con un toque.' : 'Queda propuesto en su tarjeta: la persona lo confirma con un toque.')
      : p.hayNota ? 'Las dos quedan propuestas y un solo «sí» confirma las dos: pregúntalo así, una vez («¿Confirmas las dos?»).' : 'Queda propuesto y se confirma con un «sí».',
  ].join('\n');
}
