// =============================================================================
// primer-contacto-server — lo que le salió a cada lead, por cada canal, para medir su primer contacto
// =============================================================================
// La regla vive en lib/primer-contacto.ts (pura, con test). Acá se lee, por lead y de todos los canales con rastro, lo que
// le salió y quién lo mandó:
//
//   · WhatsApp (`wa_mensajes`, salientes): `automatico` lo marca el emisor (mig 0396, lib/evolution-envio.ts). Sin la
//     migración la columna no existe y se lee sin ella: todo queda `null`, o sea «No se sabe». Nunca se adivina.
//   · Email (`email_mensajes`, salientes): con `autor` lo escribió una persona desde Chats; sin `autor`, una automatización.
//   · Instagram y Messenger (`salientesSocialesDeLeads`, lib/canal-zernio.ts): sólo lo que manda una persona desde Chats
//     (lo de una automatización no queda en `ig_mensajes`).
//   · Llamadas: las grabadas con «Grabar» (`llamadas_grabadas`) y las reuniones del grabador con el lead (`closing_analyses`,
//     menos las de prueba): las hace siempre una persona.
//
// ⚠️ «NO PUDE LEER» TIRA: un canal que no se pudo leer no es un canal sin mensajes. La única excepción es la TABLA que falta
// (una migración que todavía no llegó a este negocio: las llamadas grabadas, la 0390): ahí no hay nada que leer.
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { leerTodo } from './supabase-paginado';
import { enTandas } from './ids-con-filas';
import { esColumnaInexistente, esTablaInexistente } from './nutricion-grafo-motor';
import { salientesSocialesDeLeads } from './canal-zernio';
import { CATEGORIA_SIN_CONTACTO } from './cs-contacto';
import {
  cuentaParaPrimerContacto, primerContacto, resumirPrimerContacto,
  type PrimerContacto, type ResumenPrimerContacto, type SalienteContacto,
} from './primer-contacto';

const TANDA = 150;

/** ¿El error de una lectura dice que falta la tabla? (`leerTodo` tira un Error con el mensaje de PostgREST adentro.) */
const faltaLaTabla = (e: unknown): boolean => esTablaInexistente({ message: e instanceof Error ? e.message : String(e) });
const faltaLaColumna = (e: unknown): boolean => esColumnaInexistente({ message: e instanceof Error ? e.message : String(e) });

type FilaWa = { id: number; lead_id: number | null; wa_timestamp: string | null; created_at: string; tipo: string | null; status: string | null; automatico?: boolean | null };

/**
 * Cuántas tandas de leads se leen a la vez. La tarjeta de Closing la espera la página del Dashboard: en un negocio con 50 leads por
 * día son ~10 tandas por canal, y de a una sumaban segundos a cada apertura. Pocas, para no ocupar el pool de la base.
 */
const A_LA_VEZ = 4;

/** `fn` sobre cada tanda, de a `A_LA_VEZ`; los resultados en el orden de las tandas. Tira si alguna tira. */
async function porTandas<T>(tandas: readonly number[][], fn: (tanda: number[]) => Promise<T>): Promise<T[]> {
  const out: T[] = new Array(tandas.length);
  let i = 0;
  const trabajador = async () => { while (i < tandas.length) { const k = i++; out[k] = await fn(tandas[k]); } };
  await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, tandas.length) }, trabajador));
  return out;
}

/** Lo que le salió a cada lead, por todos los canales, en el orden que sea (la regla los ordena). Los canales, a la vez. */
export async function salientesDeLeads(leadIds: readonly number[]): Promise<Map<number, SalienteContacto[]>> {
  const ids = [...new Set(leadIds.filter((x) => Number.isSafeInteger(x) && x > 0))];
  const out = new Map<number, SalienteContacto[]>();
  if (!ids.length) return out;
  const sumar = (lead: number | null | undefined, s: SalienteContacto) => {
    if (lead == null || !Number.isFinite(s.t)) return;
    const l = out.get(Number(lead)) ?? [];
    l.push(s);
    out.set(Number(lead), l);
  };
  const db = await getTenantDb();
  const tandas = enTandas(ids, TANDA);

  // WhatsApp. Sin la 0396, se relee sin la columna: todo `null` («No se sabe»).
  const whatsapp = porTandas(tandas, async (tanda) => {
    const leer = (cols: string) => leerTodo<FilaWa>(db, 'wa_mensajes', cols, { filtros: (q) => q.in('lead_id', tanda).eq('from_me', true) });
    try {
      return await leer('id, lead_id, wa_timestamp, created_at, tipo, status, automatico');
    } catch (e) {
      if (!faltaLaColumna(e)) throw e;
      return leer('id, lead_id, wa_timestamp, created_at, tipo, status');
    }
  });
  // Email: con `autor`, una persona; sin `autor`, una automatización.
  const emails = porTandas(tandas, (tanda) => leerTodo<{ lead_id: number | null; created_at: string; autor: string | null; estado: string | null }>(
    db, 'email_mensajes', 'id, lead_id, created_at, autor, estado', { filtros: (q) => q.in('lead_id', tanda).eq('direccion', 'saliente') },
  ).catch((e) => { if (faltaLaTabla(e)) return []; throw e; }));
  // Instagram y Messenger: lo que manda una persona desde Chats.
  const sociales = salientesSocialesDeLeads(ids);
  // Las llamadas: las grabadas con «Grabar» (sin la 0390 no hay tabla) y las reuniones del grabador (menos las de prueba).
  const grabadas = porTandas(tandas, (tanda) => leerTodo<{ lead_id: number | null; created_at: string }>(
    db, 'llamadas_grabadas', 'id, lead_id, created_at', { filtros: (q) => q.in('lead_id', tanda) },
  ).catch((e) => { if (faltaLaTabla(e)) return []; throw e; }));
  const reuniones = porTandas(tandas, (tanda) => leerTodo<{ lead_id: number | null; started_at: string | null; call_date: string | null; category: string | null }>(
    db, 'closing_analyses', 'recording_id, lead_id, started_at, call_date, category', { orden: 'recording_id', filtros: (q) => q.in('lead_id', tanda) },
  ));

  const [wa, em, so, gr, re] = await Promise.all([whatsapp, emails, sociales, grabadas, reuniones]);
  for (const f of wa.flat()) {
    // Un evento (una reacción, un aviso del sistema) o un envío que falló no es un contacto.
    if (f.tipo === 'evento' || f.status === 'failed') continue;
    sumar(f.lead_id, { t: Date.parse(f.wa_timestamp ?? f.created_at), canal: 'whatsapp', automatico: typeof f.automatico === 'boolean' ? f.automatico : null });
  }
  for (const f of em.flat()) {
    if (f.estado === 'fallido') continue;
    sumar(f.lead_id, { t: Date.parse(f.created_at), canal: 'email', automatico: !f.autor?.trim() });
  }
  for (const [lead, lista] of so) for (const x of lista) sumar(lead, { t: x.t, canal: x.canal, automatico: false });
  for (const f of gr.flat()) sumar(f.lead_id, { t: Date.parse(f.created_at), canal: 'llamada', automatico: false });
  for (const f of re.flat()) {
    if (f.category === CATEGORIA_SIN_CONTACTO) continue;
    const cuando = f.started_at ?? (f.call_date ? `${f.call_date}T12:00:00Z` : null);
    if (cuando) sumar(f.lead_id, { t: Date.parse(cuando), canal: 'llamada', automatico: false });
  }
  return out;
}

/** Un lead tal como lo mira la métrica. */
export type LeadPrimerContacto = { id: number; nombre: string | null; entro: string; origen: string | null; setter: string | null; funnelId: number | null };

/** El primer contacto de cada lead (de los que cuentan: `cuentaParaPrimerContacto`). */
export async function primerContactoDeLeads(leads: readonly LeadPrimerContacto[], ahora: Date = new Date()): Promise<Array<LeadPrimerContacto & { pc: PrimerContacto }>> {
  const cuentan = leads.filter((l) => cuentaParaPrimerContacto(l.origen));
  const salientes = await salientesDeLeads(cuentan.map((l) => l.id));
  const ahoraMs = ahora.getTime();
  return cuentan.map((l) => ({ ...l, pc: primerContacto(Date.parse(l.entro), salientes.get(l.id) ?? [], ahoraMs) }));
}

/** Los leads que entraron desde `desdeIso`, con lo que mira la métrica. Paginado: la tabla pasa las 1.000 filas. */
export async function leadsDesde(desdeIso: string): Promise<LeadPrimerContacto[]> {
  const db = await getTenantDb();
  const filas = await leerTodo<{ id: number; nombre: string | null; created_at: string; origen_lead: string | null; setter: string | null; funnel_id: number | null }>(
    db, 'leads', 'id, nombre, created_at, origen_lead, setter, funnel_id', { filtros: (q) => q.gte('created_at', desdeIso) },
  );
  return filas.map((f) => ({ id: Number(f.id), nombre: f.nombre, entro: f.created_at, origen: f.origen_lead, setter: f.setter, funnelId: f.funnel_id != null ? Number(f.funnel_id) : null }));
}

/** Cuántos días mira la tarjeta de la hoja Closing y la API por defecto. */
export const DIAS_PRIMER_CONTACTO = 30;

export type PrimerContactoDelNegocio = {
  dias: number;
  resumen: ResumenPrimerContacto;
  /** Cada lead que cuenta, con su primer contacto. */
  leads: Array<LeadPrimerContacto & { pc: PrimerContacto }>;
};

/** El primer contacto de los leads que entraron en los últimos `dias` días. */
export async function primerContactoDelNegocio(dias: number = DIAS_PRIMER_CONTACTO, ahora: Date = new Date()): Promise<PrimerContactoDelNegocio> {
  const d = Math.max(1, Math.min(365, Math.trunc(dias)));
  const desde = new Date(ahora.getTime() - d * 86_400_000).toISOString();
  const leads = await primerContactoDeLeads(await leadsDesde(desde), ahora);
  return { dias: d, resumen: resumirPrimerContacto(leads.map((l) => l.pc)), leads };
}
