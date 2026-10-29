// =============================================================================
// difusion — preparar y crear una DIFUSIÓN desde el CRM (server-only; las reglas, en lib/difusion-reglas.ts)
// =============================================================================
// Una difusión es una AUTOMATIZACIÓN de una sola vez (la regla «Mensaje = automatización»): `crearDifusion` crea la fila (A
// mano, sin cohorte: sólo entran los que se inscriben acá), le pone el flujo de un hilo por canal (`pasosDeDifusion`), el
// goteo y el tope del día de ESTA automatización (la config de «Todos los canales», lib/config-automatizacion.ts), la prende
// y la inscribe a los elegidos. El motor la manda como a cualquier otra, con el goteo y los topes de la línea, y queda en
// Automations con sus métricas.
//
// ⚠️ LA INSCRIPCIÓN EN LOTE ES ACÁ Y SÓLO ACÁ (la barra de lote del CRM la dejó afuera a propósito: «necesita su pantalla con el
// ritmo a la vista», app/crm/AccionesLoteLeads.tsx). La hoja muestra el goteo antes de confirmar; la API de MaKo también lo
// dice en la propuesta. Un insert por tanda: la automatización es nueva, no hay filas viejas que reusar.
// =============================================================================
import 'server-only';
import { getTenantDb } from './workspace';
import {
  alcanceDeMotivos, motivosDe, problemaDeDifusion, pasosDeDifusion, nombreDeDifusion, goteoValido, TOPE_DIFUSION, esCanalDifusion,
  type LeadDifusion, type MotivosDelLead, type Alcance, type CanalDifusion, type MensajesDifusion,
} from './difusion-reglas';
import { conversacionDeFila } from './canal-social';
import { TRIGGER_ETAPA } from './nutricion-etapa';
import { RANGOS_GOTEO } from './config-automatizacion';

/** Los elegidos en el tablero, o la columna entera (se resuelve acá: el tablero puede no tener todas las tarjetas cargadas). */
export type SeleccionDifusion = { leadIds: number[] } | { funnelId: number | null; etapa: string };

export type VistaDifusion = {
  /** De dónde salen, para el nombre: la etapa de la columna, o null (tildados). */
  etapa: string | null;
  alcance: Alcance;
  /** Hay más de `TOPE_DIFUSION`: se cortó (se dice). */
  cortado: boolean;
  /** WhatsApp por QR conectado: sin él, el canal no se ofrece (el oficial hoy no manda). */
  whatsappQr: boolean;
  /** Por dónde le llega a cada uno (para recalcular en la hoja al cambiar de canal). SIN sus datos de contacto. */
  porLead: MotivosDelLead[];
};

const idValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
const enTandas = <T,>(xs: readonly T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };

/** Los ids de la selección, con su tope. */
async function idsDe(sel: SeleccionDifusion): Promise<{ ids: number[]; etapa: string | null; cortado: boolean }> {
  let ids: number[];
  let etapa: string | null = null;
  if ('leadIds' in sel) ids = [...new Set(sel.leadIds.filter(idValido))];
  else {
    etapa = String(sel.etapa ?? '').trim() || null;
    if (!etapa) return { ids: [], etapa: null, cortado: false };
    // La MISMA cohorte que el CRON de etapa, sin la ventana de 90 días: los que ESTÁN hoy en la columna (sólo abiertos).
    const { leadsDeCohorte } = await import('./nutricion');
    ids = await leadsDeCohorte(TRIGGER_ETAPA, etapa, sel.funnelId ?? null, null, null, { sinVentana: true });
  }
  return { ids: ids.slice(0, TOPE_DIFUSION), etapa, cortado: ids.length > TOPE_DIFUSION };
}

/**
 * Lo que se lee de cada lead (sus datos de contacto y su conversación de Instagram), en tandas. Las conversaciones, POR EL
 * CANAL (`conversacionesDeLeads`, lib/canal-zernio.ts: Instagram se cablea sólo por ahí, tests/sin-instagram).
 */
async function leadsDe(ids: readonly number[]): Promise<LeadDifusion[]> {
  const db = await getTenantDb();
  const { conversacionesDeLeads } = await import('./canal-zernio');
  const convs = await conversacionesDeLeads(ids);
  const out: LeadDifusion[] = [];
  for (const tanda of enTandas(ids, 200)) {
    const leads = await db.from('leads').select('id, nombre, telefono, email, email_opt_out').in('id', tanda);
    if (leads.error) throw new Error(`difusión (leads): ${leads.error.message}`);
    for (const l of (leads.data ?? []) as Array<{ id: number; nombre: string | null; telefono: string | null; email: string | null; email_opt_out: boolean | null }>) {
      const conv = convs.get(Number(l.id))?.instagram;
      out.push({ id: Number(l.id), nombre: l.nombre, telefono: l.telefono, email: l.email, emailBaja: l.email_opt_out === true, instagram: conv ? conversacionDeFila(conv) : null });
    }
  }
  return out;
}

/** ¿El negocio tiene una línea de WhatsApp por QR conectada? (lo que el motor usa para mandar: `lineasParaMandar`). */
async function hayWhatsAppQr(ws: number): Promise<boolean> {
  const { lineasParaMandar } = await import('./evolution');
  const { lineas } = await lineasParaMandar(ws).catch(() => ({ lineas: [] as Array<{ estado?: string | null }> }));
  return lineas.some((l) => String(l.estado ?? '').toLowerCase() === 'conectado');
}

/** LO QUE LA HOJA MUESTRA ANTES DE MANDAR: a cuántos les llega por cada canal y quién queda afuera. No escribe nada. */
export async function prepararDifusion(ws: number, sel: SeleccionDifusion, canales: readonly CanalDifusion[] = ['whatsapp', 'email', 'instagram']): Promise<VistaDifusion> {
  const { ids, etapa, cortado } = await idsDe(sel);
  const [leads, whatsappQr] = await Promise.all([leadsDe(ids), hayWhatsAppQr(ws)]);
  const usables = canales.filter((c) => c !== 'whatsapp' || whatsappQr);
  const ahora = Date.now();
  const porLead = leads.map((l) => motivosDe(l, ahora));
  return { etapa, cortado, whatsappQr, alcance: alcanceDeMotivos(porLead, usables), porLead };
}

export type PedidoDifusion = {
  seleccion: SeleccionDifusion;
  canales: CanalDifusion[];
  mensajes: MensajesDifusion;
  goteo: { minutos: number; dia: number };
  /** Quién la mandó (el historial de la automatización y del lead). */
  autor: string;
};

export type ResultadoDifusion =
  | { ok: true; secuenciaId: number; nombre: string; leads: number; alcance: Alcance }
  | { ok: false; error: string };

/**
 * CREA LA DIFUSIÓN Y LA MANDA (con su goteo). Vuelve a leer a quién le llega (no confía en lo que vio la hoja), crea la
 * automatización, la prende e inscribe. Lo que falla ANTES de inscribir borra la fila nueva (como Crear con IA): no queda una
 * automatización a medias con el nombre de la difusión.
 */
export async function crearDifusion(ws: number, p: PedidoDifusion): Promise<ResultadoDifusion> {
  const canales = [...new Set(p.canales.filter(esCanalDifusion))];
  const goteo = goteoValido(p.goteo);
  if (!goteo) return { ok: false, error: `El goteo va de ${RANGOS_GOTEO.minutos[0]} a ${RANGOS_GOTEO.minutos[1]} minutos y de ${RANGOS_GOTEO.dia[0]} a ${RANGOS_GOTEO.dia[1]} por día.` };
  const vista = await prepararDifusion(ws, p.seleccion, canales);
  if (canales.includes('whatsapp') && !vista.whatsappQr) return { ok: false, error: 'No hay un WhatsApp por QR conectado: conéctalo o saca WhatsApp de la difusión.' };
  const falta = problemaDeDifusion({ canales, mensajes: p.mensajes, alcance: vista.alcance });
  if (falta) return { ok: false, error: `${falta}.` };

  const { crearSecuenciaVacia } = await import('./setting-secuencias');
  const { setSecuenciaPasos, setSecuenciaActiva, setSecuenciaReentrada } = await import('./nutricion');
  const { guardarConfigAutomatizacion } = await import('./config-automatizacion-db');
  const fecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(new Date());
  const nombre = nombreDeDifusion({ etapa: vista.etapa, leads: vista.alcance.llegan, fecha });
  const fila = await crearSecuenciaVacia(nombre);
  const db = await getTenantDb();
  try {
    await setSecuenciaPasos(fila.id, pasosDeDifusion(canales, p.mensajes) as Parameters<typeof setSecuenciaPasos>[1]);
    const cfg = await guardarConfigAutomatizacion(fila.id, { goteo });
    if (!cfg.ok) throw new Error(cfg.error);
    await setSecuenciaReentrada(fila.id, 'una_vez');
    // Activar pasa por las mismas puertas que «Activar» (el tope del plan, el medio conectado). `aunqueDuplique`: una
    // difusión es A mano y no le escribe a nadie más que a los que se inscriben acá.
    await setSecuenciaActiva(fila.id, true, { aunqueDuplique: true, ws });
  } catch (e) {
    await db.from('nutricion_secuencias').delete().eq('id', fila.id).then(({ error }) => {
      if (error) console.error(`[difusion] no pude borrar la automatización ${fila.id} que quedó a medias: ${error.message}`);
    });
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // LA INSCRIPCIÓN, EN TANDAS: todas vencidas ahora; el goteo de ESTA automatización las ordena (de a una cada N minutos, con
  // su tope por día) y el anti-ban de la línea también. Una tanda que falla se dice: las de antes ya entraron.
  const ahora = new Date().toISOString();
  let inscriptos = 0;
  for (const tanda of enTandas(vista.alcance.ids, 200)) {
    const { error } = await db.from('nutricion_inscripciones').insert(
      tanda.map((leadId) => ({ lead_id: leadId, secuencia_id: fila.id, paso_actual: 0, estado: 'activa', proximo_envio_at: ahora })),
    );
    if (error) {
      console.error(`[difusion] automatización ${fila.id}: inscribí ${inscriptos} y la tanda siguiente falló: ${error.message}`);
      return { ok: false, error: `Entraron ${inscriptos} de ${vista.alcance.llegan}: la siguiente tanda falló (${error.message}). La automatización «${nombre}» quedó prendida con ésos.` };
    }
    inscriptos += tanda.length;
  }
  console.log(`[difusion] ws=${ws} «${nombre}» (#${fila.id}) por ${canales.join(', ')}: ${inscriptos} leads, de a uno cada ${goteo.minutos} min y hasta ${goteo.dia} por día — ${p.autor}`);
  return { ok: true, secuenciaId: fila.id, nombre, leads: inscriptos, alcance: vista.alcance };
}
