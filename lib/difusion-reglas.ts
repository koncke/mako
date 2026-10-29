// =============================================================================
// difusion-reglas — mandar UN mensaje a muchos leads elegidos en el CRM (28/10/2026, pedido de Martín por Leila)
// =============================================================================
// Martín: «seleccionando a toda una columna o una cantidad de leads específicos en el CRM y apretar mandar mensaje de difusión
// … por alguno de los canales WhatsApp, email, Instagram o varios … y configurar ahí mismo el goteo o la cantidad de mensajes
// diarios por una cuestión de baneo». La regla del Cerebro: UNA DIFUSIÓN ES UNA AUTOMATIZACIÓN de una sola vez (la regla
// «Mensaje = automatización»): una fila, el mismo motor, las mismas tarjetas, y después se ve en Automations con sus métricas.
//
// ⚠️ UN HILO POR CANAL, CADA UNO CON SU CONDICIÓN (el mapa del motor, 28/10/2026): en un flujo LINEAL, una tarjeta que no puede
// llegar (sin teléfono, sin email o dado de baja, sin conversación de Instagram) es un fallo terminal y cierra la inscripción
// entera: el email de después no salía nunca. Con la tarjeta de inicio y un hilo en paralelo por canal (el patrón de «Un
// Lead Agendó Llamada»), cada hilo mira primero si el lead tiene ESE canal; si no, ese hilo termina y los otros siguen.
//
// ⚠️ WHATSAPP SÓLO POR QR (no oficial): el oficial no tiene quién lo mande hoy (`SIN_CANAL_OFICIAL`, lib/nutricion.ts), y
// mandar en masa por QR es el riesgo de baneo: por eso el goteo y el tope del día van en la misma hoja.
//
// Puro y sin `server-only`: lo usan la hoja (app/automations/difusion/HojaDifusion.tsx), el server (lib/difusion.ts), la API
// de MaKo (`difundir_a_leads`) y el test.
// =============================================================================

import { decidirSalida, salidaHastaMs, type ConversacionSocial } from './canal-social';
import { telefonoSinArreglo } from './lead-sin-arreglo';
import { ID_INICIO, type PasoGrafo, type FilaCondicion } from './flujo-grafo';
import { RANGOS_GOTEO } from './config-automatizacion';

export const CANALES_DIFUSION = ['whatsapp', 'email', 'instagram'] as const;
export type CanalDifusion = (typeof CANALES_DIFUSION)[number];
export const esCanalDifusion = (v: unknown): v is CanalDifusion => (CANALES_DIFUSION as readonly unknown[]).includes(v);

export const NOMBRE_CANAL_DIFUSION: Readonly<Record<CanalDifusion, string>> = { whatsapp: 'WhatsApp', email: 'Email', instagram: 'Instagram' };

/** Hasta cuántos leads por difusión (una columna grande del CRM entra; más es otra herramienta). */
export const TOPE_DIFUSION = 2000;

/** El goteo con el que arranca la hoja: de a uno cada 3 minutos y hasta 40 por día en cada canal (el tope de una línea). */
export const GOTEO_DIFUSION_INICIAL = { minutos: 3, dia: 40 } as const;

/** Lo que se lee de cada lead para saber por dónde le llega. */
export type LeadDifusion = {
  id: number;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  emailBaja: boolean;
  /** Su conversación de Instagram (la que cuenta), o null si nunca escribió ni comentó. */
  instagram: ConversacionSocial | null;
};

/** Por qué un lead queda afuera de un canal, en palabras de persona. */
export type MotivoAfuera = 'sin_telefono' | 'telefono_invalido' | 'sin_email' | 'email_baja' | 'sin_instagram' | 'instagram_ventana' | 'instagram_turno';
export const TEXTO_AFUERA: Readonly<Record<MotivoAfuera, string>> = {
  sin_telefono: 'no tienen teléfono',
  telefono_invalido: 'el teléfono no es válido',
  sin_email: 'no tienen email',
  email_baja: 'se dieron de baja del email',
  sin_instagram: 'nunca escribieron ni comentaron por Instagram',
  instagram_ventana: 'pasaron más de 24 h desde su último mensaje (Instagram no deja escribirles)',
  instagram_turno: 'con este goteo no les toca antes de que se cierre su ventana de Instagram (sube el tope por día)',
};

/** ¿Por dónde le llega a ESTE lead? null = le llega; si no, el motivo. */
export function motivoAfuera(l: LeadDifusion, canal: CanalDifusion, ahoraMs: number): MotivoAfuera | null {
  if (canal === 'whatsapp') {
    const t = telefonoSinArreglo(l.telefono);
    return t === 'lead sin teléfono' ? 'sin_telefono' : t === 'teléfono inválido' ? 'telefono_invalido' : null;
  }
  if (canal === 'email') {
    if (!(l.email ?? '').includes('@')) return 'sin_email';
    return l.emailBaja ? 'email_baja' : null;
  }
  if (!l.instagram) return 'sin_instagram';
  // La MISMA decisión que el envío (`decidirSalida`): la ventana de 24 h o la respuesta privada a un comentario reciente.
  return decidirSalida(l.instagram, ahoraMs, 'instagram').via === null ? 'instagram_ventana' : null;
}

export type AlcanceCanal = { canal: CanalDifusion; llegan: number; afuera: Array<{ motivo: MotivoAfuera; cuantos: number }> };
export type Alcance = {
  total: number;
  /** A cuántos les llega por AL MENOS uno de los canales elegidos (los que se inscriben). */
  llegan: number;
  /** Los ids que se inscriben (con al menos un canal). */
  ids: number[];
  /** A cuántos no les llega por ninguno de los elegidos. */
  ninguno: number;
  porCanal: AlcanceCanal[];
};

/**
 * Por dónde le llega a cada lead, SIN sus datos de contacto: es lo que viaja a la hoja (recalcula al tildar un canal sin
 * volver al server, y el teléfono y el email no salen del server).
 */
export type MotivosDelLead = {
  id: number;
  motivos: Record<CanalDifusion, MotivoAfuera | null>;
  /** Hasta cuándo le puede llegar por Instagram (`salidaHastaMs`): el goteo que no le llega antes, no se le promete. */
  instagramHastaMs?: number | null;
};

export function motivosDe(l: LeadDifusion, ahoraMs: number): MotivosDelLead {
  return {
    id: l.id,
    motivos: { whatsapp: motivoAfuera(l, 'whatsapp', ahoraMs), email: motivoAfuera(l, 'email', ahoraMs), instagram: motivoAfuera(l, 'instagram', ahoraMs) },
    instagramHastaMs: salidaHastaMs(l.instagram),
  };
}

/**
 * CUÁNDO SALE EL k-ÉSIMO (desde 0) de un canal con este goteo, desde que arranca: de a uno cada `minutos` y, cumplido el tope
 * del día, cuando el más viejo sale de las 24 h móviles (`frenoDeGoteo`, lib/goteo.ts).
 */
export function demoraDelTurno(k: number, g: { minutos: number; dia: number }): number {
  const dia = Math.max(1, Math.floor(g.dia));
  return Math.floor(k / dia) * 86_400_000 + (k % dia) * g.minutos * 60_000;
}

/** El goteo con el que va a salir y desde cuándo: con él, Instagram promete sólo a los que alcanza antes de su ventana. */
export type RitmoDifusion = { goteo: { minutos: number; dia: number }; ahoraMs: number };

/** A QUIÉN LE LLEGA, POR CANAL, Y QUIÉN QUEDA AFUERA Y POR QUÉ. Con `canales` vacío, nadie. */
export function alcanceDe(leads: readonly LeadDifusion[], canales: readonly CanalDifusion[], ahoraMs: number, goteo?: RitmoDifusion['goteo']): Alcance {
  return alcanceDeMotivos(leads.map((l) => motivosDe(l, ahoraMs)), canales, goteo ? { goteo, ahoraMs } : undefined);
}

/**
 * Lo mismo, desde lo que ya se decidió por lead (`motivosDe`): lo usa la hoja al cambiar de canales y de goteo.
 *
 * ⚠️ INSTAGRAM CON GOTEO (la verificación del Cerebro sobre 69b49a31c, 29/10/2026): la hoja prometía «le llega a 100» con
 * 40 por día, y a los 60 de después se les cerraba la ventana de 24 h antes de su turno: el envío los daba por fallo. Con el
 * `ritmo`, a cada uno de Instagram se le cuenta su turno (`demoraDelTurno`, en el orden en que se inscriben: el del motor)
 * y el que no llega antes de su ventana queda afuera (`instagram_turno`); si Instagram era su único canal, no se inscribe.
 */
export function alcanceDeMotivos(leads: readonly MotivosDelLead[], canales: readonly CanalDifusion[], ritmo?: RitmoDifusion): Alcance {
  const elegidos = CANALES_DIFUSION.filter((c) => canales.includes(c));
  const porCanal: AlcanceCanal[] = elegidos.map((canal) => ({ canal, llegan: 0, afuera: [] }));
  const ids: number[] = [];
  let turnoIg = 0;
  for (const l of leads) {
    let alguno = false;
    for (const pc of porCanal) {
      let m = l.motivos[pc.canal];
      if (pc.canal === 'instagram' && m == null && ritmo) {
        const hasta = l.instagramHastaMs;
        if (hasta != null && ritmo.ahoraMs + demoraDelTurno(turnoIg, ritmo.goteo) >= hasta) m = 'instagram_turno';
        else turnoIg += 1;
      }
      if (m == null) { pc.llegan += 1; alguno = true; continue; }
      const fila = pc.afuera.find((a) => a.motivo === m);
      if (fila) fila.cuantos += 1; else pc.afuera.push({ motivo: m, cuantos: 1 });
    }
    if (alguno) ids.push(l.id);
  }
  return { total: leads.length, llegan: ids.length, ids, ninguno: leads.length - ids.length, porCanal };
}

/** Lo que se escribe en cada tarjeta de la hoja. */
export type MensajesDifusion = {
  /** `partes`: varios mensajes seguidos, como los arma la tarjeta (el `cuerpo` es el espejo de la primera). */
  whatsapp?: { cuerpo: string; partes?: unknown[] };
  email?: { asunto: string; cuerpo: string; cuerpo_html?: string | null };
  instagram?: { cuerpo: string; partes?: unknown[] };
};

/** Las partes de una tarjeta, si las trae (el guardado las revisa: `setSecuenciaPasos`). */
const conPartes = (x: { partes?: unknown[] } | undefined): { partes?: unknown[] } => (Array.isArray(x?.partes) && x.partes.length ? { partes: x.partes } : {});

/** Lo que le falta a la difusión para mandarse, en palabras cortas. null = está. */
export function problemaDeDifusion(o: { canales: readonly CanalDifusion[]; mensajes: MensajesDifusion; alcance: Pick<Alcance, 'llegan'> }): string | null {
  if (!o.canales.length) return 'Elige al menos un canal';
  for (const c of o.canales) {
    if (c === 'email') {
      if (!o.mensajes.email?.asunto?.trim()) return 'Falta el asunto del email';
      if (!o.mensajes.email?.cuerpo?.trim()) return 'Falta el texto del email';
    } else if (!o.mensajes[c]?.cuerpo?.trim()) return `Falta el mensaje de ${NOMBRE_CANAL_DIFUSION[c]}`;
  }
  if (o.alcance.llegan === 0) return 'A ninguno le llega por los canales elegidos';
  return null;
}

/** Las filas de la condición de cada hilo: que tenga ESE canal (y, el email, que no se haya dado de baja). */
const CONDICION_DEL_CANAL: Readonly<Record<CanalDifusion, readonly FilaCondicion[]>> = {
  whatsapp: [{ campo: 'tiene_telefono' }],
  email: [{ campo: 'tiene_email' }, { campo: 'email_baja', no: true, union: 'y' }],
  instagram: [{ campo: 'tiene_instagram' }],
};

const RELLENO = { orden: 0, delay_horas: 0, asunto: null, template_wa: null } as const;

/**
 * EL FLUJO DE LA DIFUSIÓN: la tarjeta de inicio con UN HILO POR CANAL (el primero en `siguiente`, el resto en `paralelos`),
 * y cada hilo una CONDITION «tiene ese canal» → el mensaje. Los mensajes salen solos (`revisar: false`): es una difusión, la
 * persona ya los escribió y los confirmó. El WhatsApp por QR (`proveedor: 'no_oficial'`).
 */
export function pasosDeDifusion(canales: readonly CanalDifusion[], m: MensajesDifusion): PasoGrafo[] {
  const elegidos = CANALES_DIFUSION.filter((c) => canales.includes(c));
  const pasos: PasoGrafo[] = [];
  for (const c of elegidos) {
    const cond = `d_c_${c}`;
    const msg = `d_${c}`;
    pasos.push({
      ...RELLENO, id: cond, canal: 'whatsapp', cuerpo: '', nodo: 'condicion', si_no: null,
      ramas: [{ id: `${cond}_si`, modo: 'todas', filas: CONDICION_DEL_CANAL[c].map((f) => ({ ...f })), siguiente: msg }],
    } as unknown as PasoGrafo);
    if (c === 'whatsapp') pasos.push({ ...RELLENO, id: msg, canal: 'whatsapp', proveedor: 'no_oficial', cuerpo: m.whatsapp?.cuerpo ?? '', ...conPartes(m.whatsapp), siguiente: null, revisar: false } as unknown as PasoGrafo);
    else if (c === 'email') {
      pasos.push({
        ...RELLENO, id: msg, canal: 'email', asunto: m.email?.asunto ?? '', cuerpo: m.email?.cuerpo ?? '',
        ...(m.email?.cuerpo_html ? { cuerpo_html: m.email.cuerpo_html } : {}), siguiente: null, revisar: false,
      } as unknown as PasoGrafo);
    } else pasos.push({ ...RELLENO, id: msg, canal: 'instagram', cuerpo: m.instagram?.cuerpo ?? '', ...conPartes(m.instagram), siguiente: null, revisar: false } as unknown as PasoGrafo);
  }
  const hilos = elegidos.map((c) => `d_c_${c}`);
  pasos.push({ ...RELLENO, id: ID_INICIO, canal: 'whatsapp', cuerpo: '', nodo: 'inicio', siguiente: hilos[0] ?? null, paralelos: hilos.slice(1) } as unknown as PasoGrafo);
  return pasos;
}

/** El nombre de la automatización: «Difusión · Contacto nuevo · 28/10» o «Difusión · 12 leads · 28/10». */
export function nombreDeDifusion(o: { etapa?: string | null; leads: number; fecha: string }): string {
  const de = o.etapa?.trim() ? o.etapa.trim() : `${o.leads} ${o.leads === 1 ? 'lead' : 'leads'}`;
  return `Difusión · ${de} · ${o.fecha}`.slice(0, 80);
}

/** Cuánto tarda en salir todo con el goteo, en palabras: «sale todo hoy» / «unos 3 días». Por el canal más cargado. */
export function textoDeDuracion(llegan: number, goteo: { minutos: number; dia: number }): string {
  if (llegan <= 0) return '';
  const dias = Math.ceil(llegan / Math.max(1, goteo.dia));
  if (dias <= 1) {
    const min = (llegan - 1) * goteo.minutos;
    return min < 60 ? `sale todo en ${Math.max(1, min)} min` : `sale todo en unas ${Math.ceil(min / 60)} h`;
  }
  return `tarda unos ${dias} días (hasta ${goteo.dia} por día)`;
}

/**
 * LA MISMA DIFUSIÓN DOS VECES (la verificación del Cerebro sobre 69b49a31c, 29/10/2026). El server no tenía idempotencia: un
 * reintento (la hoja dice «Vuelve a intentarlo» también cuando lo que falló fue la red y la difusión ya estaba creada), dos
 * pestañas, o MaKo proponiendo otra vez después de una tanda que falló, creaban OTRA automatización con los mismos leads y les
 * llegaba dos veces. Ahora cada pedido tiene su clave (a quién, por dónde, qué y con qué goteo) y su marca (lib/difusion.ts):
 * el MISMO pedido dentro de `VENTANA_DIFUSION_REPETIDA_MIN` RETOMA la automatización que creó (suma sólo a los que faltan);
 * mientras otro la está creando, espera. Dos difusiones distintas a los mismos leads no son un defecto: otra clave.
 */
export const VENTANA_DIFUSION_REPETIDA_MIN = 24 * 60;
/** Una marca SIN automatización es alguien creándola; pasado esto, se cayó a mitad y el pedido vuelve a ser nuevo. */
export const ESPERA_DIFUSION_EN_CURSO_MIN = 5;

/** El pedido en un texto estable: el mismo pedido da el mismo texto, en cualquier orden de ids o de canales. */
export function claveDeDifusion(p: {
  seleccion: { leadIds: number[] } | { funnelId: number | null; etapa: string };
  canales: readonly CanalDifusion[]; mensajes: MensajesDifusion; goteo: { minutos: number; dia: number };
}): string {
  const sel = 'leadIds' in p.seleccion
    ? { ids: [...new Set(p.seleccion.leadIds)].sort((x, y) => x - y) }
    : { funnel: p.seleccion.funnelId ?? null, etapa: p.seleccion.etapa.trim() };
  const canales = CANALES_DIFUSION.filter((c) => p.canales.includes(c));
  return JSON.stringify({ sel, canales, mensajes: canales.map((c) => p.mensajes[c] ?? null), goteo: [p.goteo.minutos, p.goteo.dia] });
}

/** La marca de un pedido: cuándo se pidió y la automatización que creó (null mientras se crea). */
export type MarcaDifusion = { at: string; secuenciaId: number | null };

export function leerMarcaDifusion(raw: string | null | undefined): MarcaDifusion | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { at?: unknown; secuenciaId?: unknown };
    if (typeof o.at !== 'string') return null;
    const id = Number(o.secuenciaId);
    return { at: o.at, secuenciaId: o.secuenciaId != null && Number.isInteger(id) && id > 0 ? id : null };
  } catch { return null; }
}

export type DifusionRepetida = { es: 'nueva' } | { es: 'en_curso' } | { es: 'retomar'; secuenciaId: number };

/** ¿Este pedido ya se hizo? Nuevo, alguien lo está creando ahora, o retomar la automatización que creó. */
export function decidirRepetida(marca: MarcaDifusion | null, ahoraMs: number): DifusionRepetida {
  const t = marca ? Date.parse(marca.at) : NaN;
  if (!marca || !Number.isFinite(t)) return { es: 'nueva' };
  const min = (ahoraMs - t) / 60_000;
  if (marca.secuenciaId == null) return min < ESPERA_DIFUSION_EN_CURSO_MIN ? { es: 'en_curso' } : { es: 'nueva' };
  return min < VENTANA_DIFUSION_REPETIDA_MIN ? { es: 'retomar', secuenciaId: marca.secuenciaId } : { es: 'nueva' };
}

/**
 * UNA DIFUSIÓN TERMINADA SE PAUSA SOLA (la verificación del Cerebro sobre 69b49a31c, 29/10/2026): quedaba prendida para
 * siempre y ocupaba un lugar del tope del plan Esencial (3 activas), y la difusión siguiente fallaba con «Llegaste al tope de
 * tu plan» por una que ya había terminado. Se reconoce por la `clave` (`PREFIJO_CLAVE_DIFUSION`: la clave no cambia nunca,
 * el nombre sí) y se pausa cuando no le queda nadie EN CURSO (`pausarDifusionesTerminadas`, lib/difusion.ts, en la corrida de
 * la hora). 'respondio' cuenta como en curso: el desenlace la cierra en la corrida siguiente, y si alguien le sumó una
 * respuesta en el lienzo, la está atendiendo.
 */
export const PREFIJO_CLAVE_DIFUSION = 'difusion-';
export const ESTADOS_DIFUSION_EN_CURSO = ['activa', 'pausada', 'respondio'] as const;
/** Se prende ANTES de inscribir: una recién creada no se mira hasta pasado esto. */
export const MIN_DIFUSION_ANTES_DE_PAUSAR = 15;

/** El goteo pedido, en rango (`RANGOS_GOTEO`): un número fuera de rango no se guarda callado, se dice. */
export function goteoValido(g: unknown): { minutos: number; dia: number } | null {
  const o = (g && typeof g === 'object' ? g : {}) as { minutos?: unknown; dia?: unknown };
  const [mMin, mMax] = RANGOS_GOTEO.minutos;
  const [dMin, dMax] = RANGOS_GOTEO.dia;
  const minutos = Number(o.minutos);
  const dia = Number(o.dia);
  if (!Number.isInteger(minutos) || minutos < mMin || minutos > mMax) return null;
  if (!Number.isInteger(dia) || dia < dMin || dia > dMax) return null;
  return { minutos, dia };
}
