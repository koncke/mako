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
 * Lo propio de una automatización. Cada parte AUSENTE = la del negocio. `horario: null` también se guarda: es «sin
 * horario» propio (manda a cualquier hora aunque el negocio tenga uno), distinto de no haber elegido.
 */
export type ConfigAutomatizacion = {
  horario?: HorarioEnvio | null;
  personaHoras?: { whatsapp?: number; email?: number };
};

const enRango = (n: unknown, [min, max]: readonly [number, number]): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

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
    const wa = enRango(ph.whatsapp, RANGOS_LIMITES.wa.personaHoras) ? ph.whatsapp : undefined;
    const em = enRango(ph.email, RANGOS_LIMITES.email.personaHoras) ? ph.email : undefined;
    if (wa !== undefined || em !== undefined) out.personaHoras = { ...(wa !== undefined ? { whatsapp: wa } : {}), ...(em !== undefined ? { email: em } : {}) };
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
export const tieneConfigPropia = (c: ConfigAutomatizacion): boolean => c.horario !== undefined || c.personaHoras !== undefined;

/**
 * EL HORARIO QUE VALE PARA ESA AUTOMATIZACIÓN: el propio si eligió uno (también «sin horario»), si no el del negocio.
 * Un horario guardado APAGADO es «sin horario» (como el del negocio: `horarioVigente`).
 */
export function horarioDeLaAutomatizacion(c: ConfigAutomatizacion, delNegocio: HorarioEnvio | null): HorarioEnvio | null {
  if (c.horario === undefined) return delNegocio;
  return c.horario && c.horario.activo ? c.horario : null;
}

/** LAS HORAS ENTRE DOS MENSAJES A LA MISMA PERSONA que valen para esa automatización, por canal. */
export function personaHorasDeLaAutomatizacion(c: ConfigAutomatizacion, delNegocio: LimitesEnvio): { whatsapp: number; email: number } {
  return {
    whatsapp: c.personaHoras?.whatsapp ?? delNegocio.wa.personaHoras,
    email: c.personaHoras?.email ?? delNegocio.email.personaHoras,
  };
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
        if (!enRango(ph[canal], rango)) return { ok: false, error: `Las horas entre dos ${nombre} van de ${rango[0]} a ${rango[1]}.` };
        nuevo[canal] = ph[canal] as number;
      }
      if (Object.keys(nuevo).length) out.personaHoras = nuevo; else delete out.personaHoras;
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
