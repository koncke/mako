// =============================================================================
// config-automatizacion — el horario y los límites de UNA automatización (puro, sin `server-only`)
// =============================================================================
// Martín, 16/10/2026 (punto 5, texto entero en docs/relevo/chatbot.md) y otra vez el 20/10: «Es importante que
// "configuraciones" ya no viva para todo Automations, sino para cada chat en los 3 puntos... Porque por ejemplo, si estoy
// corriendo ads en Meta y llegan leads, ahí no hay riesgo, pero si tengo configurado eso y no salen mensajes si es un
// problema... cada usuario puede configurar eso desde los 3 puntos, como también el horario de oficina para cada
// automatización».
//
// Lo que es de CADA automatización (y lo que no):
//   · el HORARIO DE OFICINA: entero, propio o el del negocio;
//   · las HORAS ENTRE DOS MENSAJES A LA MISMA PERSONA (WhatsApp y email): es el freno de la prospección en frío, el que
//     Martín no quiere sobre los leads de un anuncio;
//   · ⚠️ LOS TOPES DE LA LÍNEA NO (por día y por hora de WhatsApp, por día de email): son el presupuesto anti-ban de UNA
//     línea que comparten todas las automatizaciones. Un tope por automatización no la protege; sigue siendo del negocio.
//   · EL GOTEO SÍ (22/10/2026, la llamada con Mauricio: «que no salgan juntos: uno, esperar 4-5 min, el siguiente»;
//     configurable por automatización: minutos entre envíos y tope por día). Es un SUB-TOPE adentro del de la línea
//     (decisión del Cerebro): nunca deja mandar más que la línea; sólo frena a ESTA automatización. Los días de la
//     semana son los del horario propio. La regla vive en lib/goteo.ts.
//   · Y ES UNO SOLO PARA TODOS LOS CANALES (24/10/2026 23:00, Martín, f21 de la llamada con Leandro: «Uno solo: un solo
//     interruptor de goteo (y uno de tope por día) que valga para todos los canales»): WhatsApp, email, Instagram y
//     Messenger. Cada canal cuenta lo suyo (lib/goteo.ts). Hasta ese día había uno de WhatsApp (`goteo`) y otro de email
//     (`goteoEmail`, 23/10), e Instagram no tenía (f20).
//
// SIN NADA GUARDADO, LA DEL NEGOCIO. Así cada automatización que ya existía arranca con lo que hoy tiene su negocio
// (regla «nunca una versión vieja»), sin escribir nada en producción, y lo que cambie el negocio le llega.
//
// Se guarda en `app_settings`, una clave por automatización (`claveConfigAutomatizacion`), como su chat
// (lib/automatizacion-chat.ts): sin migración. Lo leen la pantalla (la tuerca del título y el «⋯» de la fila), la API
// de MaKo y el motor, que la lee UNA vez por corrida para todas (`CLAVE_PREFIJO`).
// =============================================================================

import { arranqueLlega, ARRANQUE_MAX_DIAS } from './goteo';
import { sanearHorario, dentroDelHorario, acabaDeAbrir, horaTexto, relojEnZona, DIAS_PANTALLA, HORARIO_SUGERIDO, type HorarioEnvio, type DiaSemana } from './horario-envio';
import { RANGOS_LIMITES, rangoDeLimite, type OpcionesRango } from './limites-envio';
import { TRIGGER_ETAPA } from './nutricion-etapa';

/** El prefijo de las claves (el motor las lee todas juntas). */
export const CLAVE_PREFIJO = 'automatizacion.config:';
export const claveConfigAutomatizacion = (secuenciaId: number): string => `${CLAVE_PREFIJO}${secuenciaId}`;
/** El id de la automatización de una clave, o null. */
export function secuenciaDeClave(clave: string): number | null {
  if (!clave.startsWith(CLAVE_PREFIJO)) return null;
  const n = Number(clave.slice(CLAVE_PREFIJO.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Lo propio de una automatización. Cada parte AUSENTE = la del negocio (el horario) o nada propio (el goteo). `horario: null`
 * también se guarda: es «sin horario» propio (manda a cualquier hora aunque el negocio tenga uno), distinto de no haber elegido.
 *
 * ⚠️ SIN «MISMA PERSONA» (23/10/2026, Martín: «elimina "Misma persona"»; el Cerebro: si la pantalla no la muestra, el motor no
 * la puede seguir aplicando, porque sería una regla escondida). Se fue de la pantalla, de la API de MaKo y del motor: lo
 * guardado en `personaHoras` se ignora al leer. Y la vista previa de los links volvió a ser de cada mensaje (la X de la
 * tarjeta del link en el editor del WhatsApp, `sin_vista_previa` del paso): `sinVistaPrevia` de acá también se ignora.
 */
export type ConfigAutomatizacion = {
  horario?: HorarioEnvio | null;
  /**
   * EL HORARIO LO PUSO MaKo, NO LA PERSONA (5/11/2026, Black November de Leila: «quiero de 10 a 20»). Lo marca el horario de fábrica
   * (al prenderla, `naceConHorario`, y a las que ya estaban prendidas, scripts/horario-de-fabrica-prendidas.mts). Con la marca, si el
   * negocio pone su horario (`configurar_horario_envio`), vale el del negocio (`horarioDeLaAutomatizacion`): sin esto, los 10 a 20
   * de Leila no le llegaban a ninguna automatización nueva. La persona que cambia el horario en la tuerca la saca.
   */
  horarioDeFabrica?: true;
  /**
   * El goteo de sus mensajes, en TODOS los canales (lib/goteo.ts; 24/10/2026, f21): minutos entre dos envíos y tope en 24 h,
   * cada canal con su cuenta. Ausente = sin goteo propio. (El `goteoEmail` de antes se lee como éste si no hay uno.)
   */
  goteo?: {
    minutos?: number;
    dia?: number;
    arranque?: { dia: number; sube: number };
    /**
     * ⚠️ LOS DÍAS DEL GOTEO SON APARTE DEL HORARIO (9/11/2026). Hasta acá los días en que goteaba una
     * automatización eran los de su horario, así que quien quería gotear sólo de lunes a jueves tenía
     * que **achicar el horario entero** — y con eso dejaba de contestar los viernes, que no es lo que
     * pidió. Son dos cosas distintas: el horario es CUÁNDO está abierta; esto es en qué días SALE a
     * buscar. Ausente o vacío = los del horario, que es lo de siempre.
     */
    dias?: DiaSemana[];
  };
  /**
   * LAS COLUMNAS DEL CRM QUE SIGUEN A LOS EMAILS (4/11/2026, la campaña de Mauricio: «si ya lo abrió me lo pones aquí», el
   * clic a otra y una para el que compró): la key de la columna del CRM de esta automatización a la que pasa la tarjeta
   * cuando le sale un email (`enviado`), cuando lo abre (`abrio`) y cuando hace clic (`clic`). Las mueve
   * lib/email-eventos-crm.ts, nunca hacia atrás ni desde una terminal. Ausente = no se mueve nada, como antes. Con esto
   * puesto, además, quien compró o ya no está abierto deja de recibir (lib/nutricion.ts, la rama del email).
   */
  columnasEmail?: ColumnasEmail;
};

/**
 * Los momentos de un email que mueven la tarjeta. `rebote` (13/11/2026, ticket #93: Mauricio pidió «una columna o fase del CRM
 * para los correos rebotados»): la dirección no existe. Sin columna elegida, va a la del CRM que se llame «Rebotado»
 * (`columnaDeRebote`, lib/email-eventos-crm-reglas.ts). El lead ya sale de la secuencia por la baja del email.
 */
export const EVENTOS_COLUMNA = ['enviado', 'abrio', 'clic', 'rebote'] as const;
export type EventoColumna = (typeof EVENTOS_COLUMNA)[number];
export type ColumnasEmail = Partial<Record<EventoColumna, string>>;

/** La key de una columna, como se guarda: texto corto, sin saltos ni espacios en los bordes. null = no sirve. */
const keyDeColumna = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const k = v.trim();
  return k && k.length <= 80 && !/[\r\n\t]/.test(k) ? k : null;
};

/** Las columnas guardadas, saneadas: sólo los eventos que se entienden, o undefined si no queda ninguno. */
function columnasGuardadas(raw: unknown): ColumnasEmail | undefined {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  if (!o) return undefined;
  const out: ColumnasEmail = {};
  for (const e of EVENTOS_COLUMNA) { const k = keyDeColumna(o[e]); if (k) out[e] = k; }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Los rangos del goteo: hasta 4 h entre envíos, y el tope por día hasta el más alto de las líneas (el de email: un tope por
 * día de 300 deja pasar 300 emails, y los WhatsApp los sigue cortando su línea, que es más baja).
 */
export const RANGOS_GOTEO = { minutos: [1, 240] as const, dia: [RANGOS_LIMITES.wa.dia[0], RANGOS_LIMITES.email.dia[1]] as const } as const;

/**
 * EL GOTEO SIGUE A LA CUENTA (13/11/2026, ticket #93; decisión del Cerebro). El tope por día de UNA automatización llega al
 * tope de email del negocio: 2.000 con SU clave de Resend y SU dominio, 500 con la de la plataforma (`rangoDeLimite`,
 * lib/limites-envio.ts). Sin esto, con un tope de 1.600, a «Sprint correos · Fríos» de Mauricio no se le podía poner más de
 * 500 por día. `RANGOS_GOTEO` queda como el de la plataforma (lo usa la difusión).
 */
export function rangosGoteo(o?: OpcionesRango): { minutos: readonly [number, number]; dia: readonly [number, number] } {
  return { minutos: RANGOS_GOTEO.minutos, dia: [RANGOS_GOTEO.dia[0], rangoDeLimite('email', 'dia', o)[1]] };
}

/**
 * Al LEER, el más ancho: lo guardado ya pasó el rango de SU cuenta al guardarse. Descartar un tope por día de 1.200 (leído sin
 * saber la cuenta) dejaba la automatización SIN tope por día: mandaba más, no menos. El tope de la línea corta igual.
 */
const RANGOS_GOTEO_LECTURA = rangosGoteo({ cuentaPropia: true });

const enRango = (n: unknown, [min, max]: readonly [number, number]): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

/** Un goteo guardado, saneado: sus campos en rango, o undefined si no queda ninguno. */
/**
 * Los días propios del goteo, saneados: 0 a 6, sin repetidos y en orden. Lo que no se entiende queda
 * AUSENTE (= los del horario), nunca una lista a medias — media lista es peor que ninguna, porque
 * manda los días equivocados sin que nada lo diga.
 */
export function diasDeGoteo(raw: unknown): DiaSemana[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const limpios = [...new Set(raw.filter((d): d is DiaSemana => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6))].sort((x, y) => x - y);
  return limpios.length ? limpios : undefined;
}

/**
 * ¿HOY ES UN DÍA DE GOTEO de esta automatización? Sin días propios, sí: manda el horario.
 * ⚠️ El día se lee en la zona del NEGOCIO, no en la del servidor: un cron que corre a las 23:30 UTC
 * ya está en el día siguiente para medio mundo, y ahí «sólo de lunes a jueves» empezaría los domingos.
 */
export function hoyGotea(c: ConfigAutomatizacion, ahoraMs: number, tz: string | null): boolean {
  const dias = c.goteo?.dias;
  if (!dias || !dias.length) return true;
  // Sin zona no se sabe qué día es ahí, y el criterio del motor para eso ya es «no mandes».
  if (tz == null) return false;
  return dias.includes(relojEnZona(ahoraMs, tz).dia);
}

function goteoGuardado(raw: unknown): ConfigAutomatizacion['goteo'] {
  const g = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (!g) return undefined;
  const min = enRango(g.minutos, RANGOS_GOTEO_LECTURA.minutos) ? g.minutos : undefined;
  const dia = enRango(g.dia, RANGOS_GOTEO_LECTURA.dia) ? g.dia : undefined;
  // El arranque sube hasta el tope: sin tope no hay nada que suba.
  const a = g.arranque && typeof g.arranque === 'object' ? g.arranque as Record<string, unknown> : null;
  const arranque = dia !== undefined && a && enRango(a.dia, RANGOS_GOTEO_LECTURA.dia) && enRango(a.sube, RANGOS_GOTEO_LECTURA.dia) ? { dia: a.dia, sube: a.sube } : undefined;
  // ⚠️ VACÍO NO SE GUARDA, igual que en el horario: una lista de días vacía sería «no goteés nunca»,
  // que nadie quiere elegir y que además no se distingue de no haber elegido. Ausente = los del horario.
  const dias = diasDeGoteo(g.dias);
  const hayAlgo = min !== undefined || dia !== undefined || dias !== undefined;
  return hayAlgo
    ? { ...(min !== undefined ? { minutos: min } : {}), ...(dia !== undefined ? { dia } : {}), ...(arranque ? { arranque } : {}), ...(dias ? { dias } : {}) }
    : undefined;
}

/** Lo guardado, saneado: lo que no se entiende queda AUSENTE (= el del negocio). Nunca tira. */
export function sanearConfigAutomatizacion(raw: unknown): ConfigAutomatizacion {
  let v: unknown = raw;
  if (typeof v === 'string') {
    if (!v.trim()) return {};
    try { v = JSON.parse(v); } catch { return {}; }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  const out: ConfigAutomatizacion = {};
  if (o.horario === null) out.horario = null;
  else if (o.horario !== undefined) {
    const h = sanearHorario(o.horario);
    if (h) out.horario = h;
  }
  if (o.horarioDeFabrica === true && out.horario) out.horarioDeFabrica = true;
  // UNO SOLO (24/10/2026, f21): el de WhatsApp de antes, y si no hay, el del email. Medido ese día en producción: dos
  // automatizaciones con goteo, las dos sólo de WhatsApp (scripts/medir-goteo-un-interruptor.mts); ninguna se movió.
  const goteo = goteoGuardado(o.goteo) ?? goteoGuardado(o.goteoEmail);
  if (goteo) out.goteo = goteo;
  const columnas = columnasGuardadas(o.columnasEmail);
  if (columnas) out.columnasEmail = columnas;
  return out;
}

/** «de 9:00 a 21:00 · todos los días» / «sin horario: …»: cómo se dice un horario (la pantalla y la API de MaKo). */
export function textoDeHorario(h: HorarioEnvio | null): string {
  if (!h || !h.activo) return 'sin horario: manda a cualquier hora';
  const dias = h.dias.length === 7 ? 'todos los días' : DIAS_PANTALLA.filter((d) => h.dias.includes(d.dia)).map((d) => d.corto).join(' ');
  return `de ${horaTexto(h.desde)} a ${horaTexto(h.hasta)} · ${dias}`;
}

/**
 * Lo que recibe el modal de Configuraciones de una automatización (app/automations/ConfiguracionesBoton.tsx). Vive acá
 * (puro) para que la lista y el lienzo lo nombren sin tocar el archivo del modal, que arrastra acciones del servidor.
 */
export type PropsConfiguraciones = { secuenciaId: number; nombre: string; onCerrar: () => void };

/** ¿Tiene algo propio? (si no, es la del negocio entera). Las columnas del email cuentan: sin esto, guardarlas solas borraba la clave. */
export const tieneConfigPropia = (c: ConfigAutomatizacion): boolean => c.horario !== undefined || c.goteo !== undefined || c.columnasEmail !== undefined;

/**
 * ¿Ya le eligieron el RITMO? (el aviso de Prospección de Publicar y Probar: «revisa su horario y sus límites»). Su horario o
 * su goteo (uno solo para todos los canales).
 */
export const tieneRitmoPropio = (c: ConfigAutomatizacion): boolean => c.horario !== undefined || c.goteo !== undefined;

/**
 * EL HORARIO QUE VALE PARA ESA AUTOMATIZACIÓN: el propio si eligió uno (también «sin horario»), si no el del negocio.
 * Un horario guardado APAGADO es «sin horario» (como el del negocio: `horarioVigente`).
 */
export function horarioDeLaAutomatizacion(c: ConfigAutomatizacion, delNegocio: HorarioEnvio | null): HorarioEnvio | null {
  if (c.horario === undefined || (c.horarioDeFabrica && delNegocio)) return delNegocio;
  return c.horario && c.horario.activo ? c.horario : null;
}

/**
 * EL HORARIO QUE SE MUESTRA en la tuerca y en la API: el mismo que vale (`horarioDeLaAutomatizacion`), pero un propio APAGADO se
 * muestra apagado (con sus horas). undefined = no tiene ninguno, ni propio ni del negocio.
 */
export function horarioParaMostrar(c: ConfigAutomatizacion, delNegocio: HorarioEnvio | null): HorarioEnvio | null | undefined {
  if (c.horario === undefined || (c.horarioDeFabrica && delNegocio)) return delNegocio ?? undefined;
  return c.horario;
}

/** De dónde sale el horario que vale: «propio», «de fábrica» (lo puso MaKo) o «negocio». */
export function origenDelHorario(c: ConfigAutomatizacion, delNegocio: HorarioEnvio | null): 'propio' | 'fabrica' | 'negocio' {
  if (c.horario === undefined || (c.horarioDeFabrica && delNegocio)) return 'negocio';
  return c.horarioDeFabrica ? 'fabrica' : 'propio';
}

/**
 * LO QUE SE GUARDA, o el error. `null` en una parte la saca (el horario vuelve al del negocio); `horario: { activo: false }`
 * es «sin horario» propio. Devuelve el texto para `app_settings` y si quedó vacío (entonces se borra la clave).
 */
export function configParaGuardar(previo: ConfigAutomatizacion, cambio: unknown, cuenta?: OpcionesRango): { ok: true; config: ConfigAutomatizacion; valor: string; vacia: boolean } | { ok: false; error: string } {
  if (!cambio || typeof cambio !== 'object' || Array.isArray(cambio)) return { ok: false, error: 'No entiendo qué cambiar.' };
  const o = cambio as Record<string, unknown>;
  const out: ConfigAutomatizacion = { ...previo };
  if ('horario' in o) {
    if (o.horario === null) delete out.horario;
    else {
      // ⚠️ SIN `activo` BOOLEANO SE RECHAZA (revisión del 20/10/2026): `sanearHorario` lo lee como «apagado», y un pedido
      // que no dice si está prendido quedaba en «sin horario»: a las 3 AM aunque el negocio tenga de 9 a 18.
      const crudo = o.horario && typeof o.horario === 'object' ? o.horario as Record<string, unknown> : null;
      if (!crudo || typeof crudo.activo !== 'boolean') return { ok: false, error: 'Ese horario no se entiende.' };
      // APAGADO no necesita horas ni días válidos (como el del negocio, `horarioParaGuardar`): apagarlo con los días
      // vacíos se rechazaba y la automatización seguía con el último horario prendido.
      const h = sanearHorario(o.horario) ?? (crudo.activo === false ? { ...HORARIO_SUGERIDO, activo: false } : null);
      if (!h) return { ok: false, error: 'Ese horario no se entiende.' };
      if (h.activo && h.hasta <= h.desde) return { ok: false, error: 'Cierra antes de abrir.' };
      out.horario = h;
    }
    // La marca de fábrica sólo la pone quien pone el de fábrica (`horarioDeFabrica: true` junto con el horario); cualquier
    // otro cambio del horario es de la persona, y la saca.
    if (o.horarioDeFabrica === true && out.horario) out.horarioDeFabrica = true;
    else delete out.horarioDeFabrica;
  }
  if ('personaHoras' in o) return { ok: false, error: '«Misma persona» ya no existe: el anti-ban de una automatización es su goteo y su tope por día.' };
  if ('goteo' in o) {
    if (o.goteo === null) delete out.goteo;
    else {
      const g = o.goteo && typeof o.goteo === 'object' ? o.goteo as Record<string, unknown> : {};
      const nuevo = { ...(out.goteo ?? {}) };
      // El rango de la CUENTA del negocio (#93): `cuenta` lo pasa quien guarda (lib/config-automatizacion-db.ts, la API).
      const rg = rangosGoteo(cuenta);
      for (const [campo, rango, texto] of [['minutos', rg.minutos, 'Los minutos entre envíos'], ['dia', rg.dia, 'El tope por día']] as const) {
        if (!(campo in g)) continue;
        if (g[campo] === null) { delete nuevo[campo]; continue; }
        if (!enRango(g[campo], rango)) return { ok: false, error: `${texto} van de ${rango[0]} a ${rango[1]}.` };
        nuevo[campo] = g[campo] as number;
      }
      if ('arranque' in g) {
        const a = g.arranque && typeof g.arranque === 'object' ? g.arranque as Record<string, unknown> : null;
        if (g.arranque === null) delete nuevo.arranque;
        else if (!a || !enRango(a.dia, rg.dia) || !enRango(a.sube, rg.dia)) return { ok: false, error: `El arranque y lo que sube por día van de ${rg.dia[0]} a ${rg.dia[1]}.` };
        else if (nuevo.dia === undefined) return { ok: false, error: 'El arranque gradual sube hasta el tope por día: pon primero el tope.' };
        else nuevo.arranque = { dia: a.dia, sube: a.sube };
      }
      if (nuevo.dia === undefined) delete nuevo.arranque;
      if (nuevo.arranque && nuevo.dia !== undefined && !arranqueLlega(nuevo.dia, nuevo.arranque)) return { ok: false, error: `Con ese arranque tarda más de ${ARRANQUE_MAX_DIAS} días en llegar al tope: que suba más por día.` };
      if (Object.keys(nuevo).length) out.goteo = nuevo; else delete out.goteo;
    }
  }
  // UNO SOLO (24/10/2026, f21): el del email ya no existe aparte. Rechazado y dicho, como «Misma persona».
  if ('goteoEmail' in o) return { ok: false, error: 'El goteo y el tope por día son uno solo para todos los canales: cámbialo en «goteo».' };
  if ('sinVistaPrevia' in o) return { ok: false, error: 'La vista previa de un link se saca en el mensaje, con la X de su tarjeta.' };
  // Las columnas del email (4/11/2026): `null` las saca todas; en cada evento, `null` o '' saca ésa. Que la columna exista en el
  // CRM de la automatización lo mira quien guarda (la API), que tiene la base.
  if ('columnasEmail' in o) {
    if (o.columnasEmail === null) delete out.columnasEmail;
    else {
      const c = o.columnasEmail && typeof o.columnasEmail === 'object' && !Array.isArray(o.columnasEmail) ? o.columnasEmail as Record<string, unknown> : null;
      if (!c) return { ok: false, error: 'No entiendo las columnas del email.' };
      const nuevo: ColumnasEmail = { ...(out.columnasEmail ?? {}) };
      for (const e of EVENTOS_COLUMNA) {
        if (!(e in c)) continue;
        if (c[e] === null || c[e] === '') { delete nuevo[e]; continue; }
        const k = keyDeColumna(c[e]);
        if (!k) return { ok: false, error: `La columna de «${e}» no se entiende.` };
        nuevo[e] = k;
      }
      if (Object.keys(nuevo).length) out.columnasEmail = nuevo; else delete out.columnasEmail;
    }
  }
  // Vacío = todo como el negocio: quien guarda BORRA la clave (`vacia`), no deja un '{}' (revisión del 20/10/2026).
  return { ok: true, config: out, valor: JSON.stringify(out), vacia: !tieneConfigPropia(out) };
}

// ── El motor: qué automatizaciones están en su horario ahora ─────────────────────

/**
 * LAS AUTOMATIZACIONES FUERA DE SU HORARIO AHORA (el motor, una vez por corrida): cada una con el suyo
 * (`horarioDeLaAutomatizacion`: el propio, o el del negocio). Sin horario, nunca cerrada. `tz` null = no se pudo leer
 * la zona: entonces toda la que TIENE un horario está cerrada («no sé qué hora es ahí» no manda), y la que no tiene,
 * abierta.
 */
export function cerradasAhora(
  secuencias: readonly number[], configs: ReadonlyMap<number, ConfigAutomatizacion>, delNegocio: HorarioEnvio | null,
  ahoraMs: number, tz: string | null,
): Set<number> {
  const out = new Set<number>();
  for (const id of secuencias) {
    const c = configs.get(id) ?? {};
    // ⚠️ LOS DÍAS DEL GOTEO SE MIRAN ANTES QUE EL HORARIO, y antes del `continue` de abajo: una
    // automatización SIN horario propio nunca está cerrada, así que si esto fuera después, sus días
    // de goteo no se aplicarían nunca — justo en el caso más común, que es no tener horario propio.
    if (!hoyGotea(c, ahoraMs, tz)) { out.add(id); continue; }
    const h = horarioDeLaAutomatizacion(c, delNegocio);
    if (!h) continue;
    if (tz == null || !dentroDelHorario(ahoraMs, tz, h)) out.add(id);
  }
  return out;
}

/** ¿Alguna automatización tiene un horario PROPIO que acaba de abrir? (el tick barre lo vencido de ese negocio). */
export function abrioAlgunaPropia(configs: Iterable<ConfigAutomatizacion>, ahoraMs: number, tz: string, minutos: number): boolean {
  for (const c of configs) {
    const h = c.horario && c.horario.activo ? c.horario : null;
    if (h && acabaDeAbrir(ahoraMs, tz, h, minutos)) return true;
  }
  return false;
}

// ── El aviso de Prospección ──────────────────────────────────────────────────────

/**
 * ¿ALGÚN CRON DE ESTA AUTOMATIZACIÓN ELIGE ETAPAS DE UN FUNNEL DE «PROSPECCIÓN»? (Martín, 16/10/2026 punto 5: «Solo
 * cuando se selecciona etapas o algún funnel que esté catalogado como "Prospección", debe saltar un warning para
 * configurar eso al momento de darle a publicar o probar»). Un CRON de venta sin embudo propio es del de la fila, y sin
 * ése, del de por defecto. Una etiqueta o un evento no eligen funnel.
 */
export function cronDeProspeccion(
  cron: ReadonlyArray<{ trigger_tipo: string; funnel_id?: number | null }>,
  productos: ReadonlyArray<{ funnelId: number | null; esDefault?: boolean; prospeccion?: boolean }>,
  funnelDeLaFila: number | null,
): boolean {
  for (const d of cron) {
    if (d.trigger_tipo !== TRIGGER_ETAPA) continue;
    const fid = d.funnel_id ?? funnelDeLaFila;
    const p = fid != null ? productos.find((x) => x.funnelId === fid) : productos.find((x) => x.esDefault);
    if (p?.prospeccion) return true;
  }
  return false;
}

/** El texto del aviso (corto: AGENTS.md, el texto dibujado). */
export const AVISO_PROSPECCION = 'Le escribe a un funnel de Prospección: revisa su horario y sus límites.';
