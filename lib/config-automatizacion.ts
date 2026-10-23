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
//
// SIN NADA GUARDADO, LA DEL NEGOCIO. Así cada automatización que ya existía arranca con lo que hoy tiene su negocio
// (regla «nunca una versión vieja»), sin escribir nada en producción, y lo que cambie el negocio le llega.
//
// Se guarda en `app_settings`, una clave por automatización (`claveConfigAutomatizacion`), como su chat
// (lib/automatizacion-chat.ts): sin migración. Lo leen la pantalla (la tuerca del título y el «⋯» de la fila), la API
// de MaKo y el motor, que la lee UNA vez por corrida para todas (`CLAVE_PREFIJO`).
// =============================================================================

import { sanearHorario, dentroDelHorario, acabaDeAbrir, horaTexto, DIAS_PANTALLA, HORARIO_SUGERIDO, type HorarioEnvio } from './horario-envio';
import { RANGOS_LIMITES, type LimitesEnvio } from './limites-envio';
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
 * Lo propio de una automatización. Cada parte AUSENTE = la del negocio (desde el 23/10/2026 toda automatización NACE con su
 * «Misma persona» guardada: `CONFIG_DE_NACIMIENTO`). `horario: null` también se guarda: es «sin horario» propio (manda a
 * cualquier hora aunque el negocio tenga uno), distinto de no haber elegido.
 */
export type ConfigAutomatizacion = {
  horario?: HorarioEnvio | null;
  /** Por canal. `PERSONA_SIN_ESPERA` (0) = APAGADO: esta automatización no espera entre dos mensajes a la misma persona. */
  personaHoras?: { whatsapp?: number; email?: number };
  /** El goteo de sus WhatsApp (lib/goteo.ts): minutos entre dos envíos y tope en 24 h. Ausente = sin goteo propio. */
  goteo?: { minutos?: number; dia?: number };
  /**
   * SUS WhatsApp SIN LA VISTA PREVIA DE LOS LINKS (#869, Mauricio: «es más discreto»; 23/10/2026 pasó de la tarjeta a
   * Configuraciones › WhatsApp). Ausente = con vista previa. Se suma a la de cada mensaje (`sin_vista_previa` del paso),
   * que sigue valiendo: `sinVistaPreviaDe`.
   */
  sinVistaPrevia?: true;
};

/** ¿Este mensaje sale sin la tarjeta de sus links? Lo de la automatización o lo del mensaje (`sin_vista_previa`). */
export const sinVistaPreviaDe = (delMensaje: boolean, c: ConfigAutomatizacion | null | undefined): boolean =>
  delMensaje || c?.sinVistaPrevia === true;

/**
 * «MISMA PERSONA» APAGADO (22/10/2026, Martín, Configuraciones › Anti-ban: «Cada opción se prende y se apaga con un
 * interruptor... Apagada, no aplica»): 0 horas entre dos mensajes a la misma persona, sólo para ESTA automatización (los
 * leads de un anuncio, el caso del 16/10). Ausente sigue siendo «la del negocio» (y desde el 23/10/2026 las nuevas nacen con la suya apagada). El motor
 * no necesita nada propio: con 0 h la ventana de `leadsConEnvioReciente` (lib/nutricion.ts) es vacía, y lo que ya salió
 * en la MISMA corrida lo sigue frenando `frenadoPorAntiBan`.
 */
export const PERSONA_SIN_ESPERA = 0;
/** Los rangos del goteo: hasta 4 h entre envíos, y el tope por día no pasa el máximo de la línea. */
export const RANGOS_GOTEO = { minutos: [1, 240] as const, dia: RANGOS_LIMITES.wa.dia } as const;

const enRango = (n: unknown, [min, max]: readonly [number, number]): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
const enRangoPersona = (n: unknown, rango: readonly [number, number]): n is number => n === PERSONA_SIN_ESPERA || enRango(n, rango);

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
  const ph = o.personaHoras && typeof o.personaHoras === 'object' ? o.personaHoras as Record<string, unknown> : null;
  if (ph) {
    const wa = enRangoPersona(ph.whatsapp, RANGOS_LIMITES.wa.personaHoras) ? ph.whatsapp : undefined;
    const em = enRangoPersona(ph.email, RANGOS_LIMITES.email.personaHoras) ? ph.email : undefined;
    if (wa !== undefined || em !== undefined) out.personaHoras = { ...(wa !== undefined ? { whatsapp: wa } : {}), ...(em !== undefined ? { email: em } : {}) };
  }
  if (o.sinVistaPrevia === true) out.sinVistaPrevia = true;
  const go = o.goteo && typeof o.goteo === 'object' ? o.goteo as Record<string, unknown> : null;
  if (go) {
    const min = enRango(go.minutos, RANGOS_GOTEO.minutos) ? go.minutos : undefined;
    const dia = enRango(go.dia, RANGOS_GOTEO.dia) ? go.dia : undefined;
    if (min !== undefined || dia !== undefined) out.goteo = { ...(min !== undefined ? { minutos: min } : {}), ...(dia !== undefined ? { dia } : {}) };
  }
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

/** ¿Tiene algo propio? (si no, es la del negocio entera). */
export const tieneConfigPropia = (c: ConfigAutomatizacion): boolean => c.horario !== undefined || c.personaHoras !== undefined || c.goteo !== undefined || c.sinVistaPrevia === true;

/**
 * ¿Ya le eligieron el RITMO? (el aviso de Prospección de Publicar y Probar: «revisa su horario y sus límites»). Su horario o
 * su goteo, no la «Misma persona»: desde el 23/10/2026 TODAS las que existían tienen la suya guardada
 * (scripts/misma-persona-propia.mts), y con `tieneConfigPropia` ninguna vieja volvía a avisar.
 */
export const tieneRitmoPropio = (c: ConfigAutomatizacion): boolean => c.horario !== undefined || c.goteo !== undefined;

/**
 * EL HORARIO QUE VALE PARA ESA AUTOMATIZACIÓN: el propio si eligió uno (también «sin horario»), si no el del negocio.
 * Un horario guardado APAGADO es «sin horario» (como el del negocio: `horarioVigente`).
 */
export function horarioDeLaAutomatizacion(c: ConfigAutomatizacion, delNegocio: HorarioEnvio | null): HorarioEnvio | null {
  if (c.horario === undefined) return delNegocio;
  return c.horario && c.horario.activo ? c.horario : null;
}

/**
 * LAS HORAS ENTRE DOS MENSAJES A LA MISMA PERSONA que valen para esa automatización, por canal: las suyas, y sin las suyas, las
 * del negocio (la regla de siempre, que NO cambia: así el deploy y el paso de una vez se pueden hacer en cualquier orden).
 *
 * «"Misma persona" apagado por defecto» (Martín, 23/10/2026) se cumple al NACER: toda automatización nueva guarda la suya
 * apagada (`CONFIG_DE_NACIMIENTO`, `nacerConfigAutomatizacion` en lib/config-automatizacion-db.ts), y las que ya existían
 * guardan como suya la que heredaban (`fijarPersonaPropia`, scripts/misma-persona-propia.mts). Después del paso, «sin las
 * suyas» ya no le pasa a ninguna: la herencia queda sólo como red.
 */
export function personaHorasDeLaAutomatizacion(c: ConfigAutomatizacion, delNegocio: LimitesEnvio): { whatsapp: number; email: number } {
  return {
    whatsapp: c.personaHoras?.whatsapp ?? delNegocio.wa.personaHoras,
    email: c.personaHoras?.email ?? delNegocio.email.personaHoras,
  };
}

/** CON LO QUE NACE una automatización nueva (23/10/2026, Martín: «"Misma persona" apagado por defecto»): la suya, apagada. */
export const CONFIG_DE_NACIMIENTO: ConfigAutomatizacion = Object.freeze({
  personaHoras: Object.freeze({ whatsapp: PERSONA_SIN_ESPERA, email: PERSONA_SIN_ESPERA }),
}) as ConfigAutomatizacion;

/**
 * EL PASO DE UNA VEZ (23/10/2026): a una automatización que HEREDABA las horas del negocio le guarda esas horas como suyas,
 * canal por canal. `null` = no hay nada que guardar (ya tiene las suyas en los dos canales: por eso se puede correr dos
 * veces). Lo que hereda se lee con la MISMA regla del motor (`delNegocio`, los límites vigentes del negocio), y lo guardado tiene
 * que volver igual del saneo: si el número del negocio no entra en el rango de una automatización (un default de fábrica
 * fuera de rango, por el env), no se puede fijar sin cambiarle el anti-ban, y se dice en vez de escribir otra cosa.
 */
export function fijarPersonaPropia(c: ConfigAutomatizacion, delNegocio: LimitesEnvio):
  { cambia: false } | { cambia: true; config: ConfigAutomatizacion; valor: string } | { cambia: false; error: string } {
  const wa = c.personaHoras?.whatsapp;
  const em = c.personaHoras?.email;
  if (wa !== undefined && em !== undefined) return { cambia: false };
  const config: ConfigAutomatizacion = { ...c, personaHoras: { whatsapp: wa ?? delNegocio.wa.personaHoras, email: em ?? delNegocio.email.personaHoras } };
  const valor = JSON.stringify(config);
  const vuelta = sanearConfigAutomatizacion(valor).personaHoras;
  if (vuelta?.whatsapp !== config.personaHoras?.whatsapp || vuelta?.email !== config.personaHoras?.email) {
    return { cambia: false, error: `las horas del negocio (${delNegocio.wa.personaHoras} h WhatsApp, ${delNegocio.email.personaHoras} h email) no entran en el rango de una automatización` };
  }
  return { cambia: true, config, valor };
}

/**
 * LO QUE SE GUARDA, o el error. `null` en una parte la VUELVE a la del negocio (se saca); `horario: { activo: false }`
 * es «sin horario» propio. Devuelve el texto para `app_settings` y si quedó vacío (entonces se borra la clave).
 */
export function configParaGuardar(previo: ConfigAutomatizacion, cambio: unknown): { ok: true; config: ConfigAutomatizacion; valor: string; vacia: boolean } | { ok: false; error: string } {
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
  }
  if ('personaHoras' in o) {
    if (o.personaHoras === null) delete out.personaHoras;
    else {
      const ph = o.personaHoras && typeof o.personaHoras === 'object' ? o.personaHoras as Record<string, unknown> : {};
      const nuevo = { ...(out.personaHoras ?? {}) };
      for (const [canal, rango, nombre] of [['whatsapp', RANGOS_LIMITES.wa.personaHoras, 'WhatsApp'], ['email', RANGOS_LIMITES.email.personaHoras, 'email']] as const) {
        if (!(canal in ph)) continue;
        if (ph[canal] === null) { delete nuevo[canal]; continue; }
        if (!enRangoPersona(ph[canal], rango)) return { ok: false, error: `Las horas entre dos ${nombre} van de ${rango[0]} a ${rango[1]}.` };
        nuevo[canal] = ph[canal] as number;
      }
      if (Object.keys(nuevo).length) out.personaHoras = nuevo; else delete out.personaHoras;
    }
  }
  if ('goteo' in o) {
    if (o.goteo === null) delete out.goteo;
    else {
      const g = o.goteo && typeof o.goteo === 'object' ? o.goteo as Record<string, unknown> : {};
      const nuevo = { ...(out.goteo ?? {}) };
      for (const [campo, rango, texto] of [['minutos', RANGOS_GOTEO.minutos, 'Los minutos entre envíos'], ['dia', RANGOS_GOTEO.dia, 'El tope por día']] as const) {
        if (!(campo in g)) continue;
        if (g[campo] === null) { delete nuevo[campo]; continue; }
        if (!enRango(g[campo], rango)) return { ok: false, error: `${texto} van de ${rango[0]} a ${rango[1]}.` };
        nuevo[campo] = g[campo] as number;
      }
      if (Object.keys(nuevo).length) out.goteo = nuevo; else delete out.goteo;
    }
  }
  if ('sinVistaPrevia' in o) {
    if (o.sinVistaPrevia === true) out.sinVistaPrevia = true;
    else if (o.sinVistaPrevia === null || o.sinVistaPrevia === false) delete out.sinVistaPrevia;
    else return { ok: false, error: 'No entiendo si va con vista previa o sin.' };
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
    const h = horarioDeLaAutomatizacion(configs.get(id) ?? {}, delNegocio);
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
