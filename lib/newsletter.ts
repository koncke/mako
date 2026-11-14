import 'server-only';

// =============================================================================
// newsletter — el CRM de los suscriptos, las ediciones y la etapa que se calcula de la lectura
// =============================================================================
// Lo puro (etapas, segmento, la regla de «Dormido», la config) vive en ./newsletter-reglas.ts. Acá, lo que lee y
// escribe la base, siempre con el negocio de la pestaña (getTenantDb).
//
// UNA EDICIÓN ES UN BROADCAST (ver la cabecera de las reglas): crear, programar, probar y enviar pasan por
// lib/email-marketing.ts, que ya sabe resolver el segmento `newsletter:<funnelId>` (`destinatariosDeNewsletter`, acá).
// Nada de lo de acá manda un email.
//
// LOS SUSCRIPTOS SON LEADS del CRM «Newsletter», en sus dos formas: los que tienen ese CRM de CASA (`leads.funnel_id`,
// p. ej. los que entraron por una landing asignada a él) y los AGREGADOS desde otro CRM (`lead_funnel`, mig 0207), cada
// uno con la etapa propia de ese tablero. Leer sólo la casa dejaría afuera a todos los que vinieron de otro CRM (la falla
// de las cohortes de un CRM con agregados, AGENTS.md «Elegir funnels»).
// =============================================================================

import { getTenantDb } from './workspace';
import { getSetting, setSetting } from './settings';
import { leerTodo } from './supabase-paginado';
import { pipelineStageOf, type StageDerivable } from './pipeline';
import { crearFunnel, listarFunnels } from './funnels';
import { agregarLoteAProducto, moverEtapaEnProducto } from './lead-funnel';
import { moverLeadAuto } from './leads';
import { AUTOR_SISTEMA } from './etapa-historial';
import {
  APAGADAS_NEWSLETTER, CONFIG_VACIA, ETAPAS_NEWSLETTER, ETAPA_BAJA, KEY_CONFIG_NEWSLETTER, NOMBRE_CRM_NEWSLETTER,
  PLANTILLA_NEWSLETTER, PREFIJO_SEGMENTO_NEWSLETTER, edicionDelDoc, entraEnSegmento, etapaPorLectura, leerConfig, metricasDe,
  segmentoDeNewsletter, segmentoNewsletter,
  type ConfigNewsletter, type EntregaEdicion, type EtapaNewsletter, type FilaEnvio, type MetricasEdicion, type SegmentoNewsletter,
} from './newsletter-reglas';

// ── La configuración ─────────────────────────────────────────────────────────
export async function leerConfigNewsletter(): Promise<ConfigNewsletter> {
  return leerConfig(await getSetting(KEY_CONFIG_NEWSLETTER));
}

/** Guarda lo que llega (saneado con la misma `leerConfig`) encima de lo que había. */
export async function guardarConfigNewsletter(patch: Partial<ConfigNewsletter>): Promise<ConfigNewsletter> {
  const actual = await leerConfigNewsletter();
  const nueva = leerConfig({ ...actual, ...patch });
  await setSetting(KEY_CONFIG_NEWSLETTER, JSON.stringify(nueva));
  return nueva;
}

// ── El CRM ───────────────────────────────────────────────────────────────────
export type CrmNewsletter = { id: number; nombre: string };

/**
 * El CRM del newsletter si existe y está activo, o `null`. Un CRM archivado no cuenta: el negocio lo sacó, y escribirle
 * a sus suscriptos desde una tab sería escribirle a una lista que ya no ve.
 */
export async function crmDelNewsletter(cfg?: ConfigNewsletter): Promise<CrmNewsletter | null> {
  const c = cfg ?? await leerConfigNewsletter();
  if (!c.funnelId) return null;
  const f = (await listarFunnels()).find((x) => x.id === c.funnelId);
  return f ? { id: f.id, nombre: f.nombre } : null;
}

/**
 * El CRM del newsletter, creándolo la primera vez. Nace SIN producto ni oferta (`crearFunnel`, no `crearCrm`): un
 * newsletter no se vende, y con producto aparecería como una oferta más en Offer. El desplegable del CRM y el CRON de
 * Automations listan los funnels, no los productos, así que se ve en los dos.
 *
 * ⚠️ EL NOMBRE ES ÚNICO POR NEGOCIO (`funnels_nombre_uk`, también entre los archivados): si «Newsletter» ya existe
 * —un CRM propio del negocio con otras etapas—, no se adopta, se crea «Newsletter 2». Adoptarlo le pondría la lectura
 * de «Dormido» a etapas que no son éstas.
 */
export async function asegurarCrmNewsletter(nombrePedido?: string): Promise<CrmNewsletter> {
  const cfg = await leerConfigNewsletter();
  const ya = await crmDelNewsletter(cfg);
  if (ya) return ya;
  const db = await getTenantDb();
  const { data: todos, error } = await db.from('funnels').select('id, nombre, activo, plantilla');
  if (error) throw new Error(`No pude leer tus CRM: ${error.message}`);
  const filas = (todos ?? []) as Array<{ id: number; nombre: string | null; activo: boolean; plantilla: string | null }>;
  // Uno que creó esta tab antes y se perdió de la config (la config se pisó, o se restauró de la papelera): ése es.
  const propio = filas.find((f) => f.activo && f.plantilla === PLANTILLA_NEWSLETTER);
  if (propio) {
    await guardarConfigNewsletter({ funnelId: Number(propio.id) });
    return { id: Number(propio.id), nombre: propio.nombre ?? NOMBRE_CRM_NEWSLETTER };
  }
  const usados = new Set(filas.map((f) => (f.nombre ?? '').trim().toLowerCase()));
  // El nombre que se pidió en «Nuevo CRM» (14/11/2026), o «Newsletter»; con uno igual ya usado, «… 2».
  const base = (nombrePedido ?? '').trim().slice(0, 80) || NOMBRE_CRM_NEWSLETTER;
  let nombre = base;
  for (let i = 2; usados.has(nombre.toLowerCase()) && i < 50; i++) nombre = `${base} ${i}`;
  const id = await crearFunnel({
    nombre,
    pipeline: ETAPAS_NEWSLETTER,
    suppressed: [...APAGADAS_NEWSLETTER],
    plantilla: PLANTILLA_NEWSLETTER,
    // Entran por una landing (la que el negocio le asigna) o los suma una persona.
    extra: { entradas: ['landing'] },
  });
  await guardarConfigNewsletter({ funnelId: id });
  return { id, nombre };
}

// ── Los suscriptos ───────────────────────────────────────────────────────────
const COLS_LEAD = 'id, nombre, email, empresa, email_opt_out, funnel_id, pipeline_stage, estado_lead, fecha_agenda, fecha_junta_1, fecha_junta_2, asistio_j1, asistio_j2, nutricion_realizada';
type FilaLead = StageDerivable & {
  id: number; nombre: string | null; email: string | null; empresa: string | null; email_opt_out: boolean | null; funnel_id: number | null;
};

export type Suscripto = {
  id: number; nombre: string | null; email: string; empresa: string | null;
  /** Se dio de baja del email (el link, un rebote o una queja): la verdad de «¿se le puede escribir?». */
  optOut: boolean;
  /** Su etapa EN el CRM del newsletter. */
  etapa: string;
  /** true = el Newsletter es su casa; false = lo agregaron desde otro CRM. */
  casa: boolean;
};

/**
 * Todos los del CRM del newsletter, con su etapa ahí y su email limpio. Los que no tienen email quedan afuera: a un
 * suscripto sin email no hay nada que mandarle (siguen en el tablero, donde se les puede cargar).
 * Paginado por las dos puntas: la lista de un newsletter crece sin fin.
 */
export async function suscriptosDe(funnelId: number): Promise<Suscripto[]> {
  const db = await getTenantDb();
  const deCasa = await leerTodo<FilaLead>(db, 'leads', COLS_LEAD, { orden: 'id', eq: { funnel_id: funnelId } });
  const filas = await leerTodo<{ id: number; lead_id: number; etapa: string | null }>(db, 'lead_funnel', 'id, lead_id, etapa', { orden: 'id', eq: { funnel_id: funnelId } });
  const etapaAgregado = new Map(filas.map((f) => [Number(f.lead_id), f.etapa ?? '']));
  const yaEnCasa = new Set(deCasa.map((l) => Number(l.id)));
  const ids = [...etapaAgregado.keys()].filter((id) => !yaEnCasa.has(id));
  const agregados: FilaLead[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const tanda = ids.slice(i, i + 200);
    agregados.push(...await leerTodo<FilaLead>(db, 'leads', COLS_LEAD, { orden: 'id', filtros: (q) => q.in('id', tanda) }));
  }
  const out: Suscripto[] = [];
  const sumar = (l: FilaLead, etapa: string, casa: boolean) => {
    const email = (l.email ?? '').trim();
    if (!email) return;
    out.push({ id: Number(l.id), nombre: l.nombre, email, empresa: l.empresa, optOut: l.email_opt_out === true, etapa, casa });
  };
  for (const l of deCasa) sumar(l, pipelineStageOf(l), true);
  for (const l of agregados) sumar(l, etapaAgregado.get(Number(l.id)) || ETAPAS_NEWSLETTER[0].key, false);
  return out.sort((a, b) => a.id - b.id);
}

/** Cuántos hay en cada etapa (la baja incluye a los que tienen `email_opt_out`, aunque su tarjeta no se haya movido). */
export function conteoPorEtapa(subs: readonly Suscripto[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const s of subs) {
    const e = s.optOut ? ETAPA_BAJA : s.etapa;
    c[e] = (c[e] ?? 0) + 1;
  }
  return c;
}

export type LeadDestinoNewsletter = { id: number; nombre: string | null; email: string; empresa: string | null };

/**
 * Los destinatarios de un segmento de newsletter: los del CRM con email, sin baja y en la etapa pedida. Lo llama
 * `leadsDeSegmento` (lib/email-marketing.ts): el envío, el conteo de la pantalla y la API usan ESTA lista.
 */
export async function destinatariosDeNewsletter(seg: SegmentoNewsletter): Promise<LeadDestinoNewsletter[]> {
  // ⚠️ UN CRM ARCHIVADO NO TIENE A QUIÉN ESCRIBIRLE (la revisión del 30/10/2026, M4): archivarlo apaga `activo` y nada más, los
  // leads siguen colgados de él. Sin esto, lo que estaba programado seguía saliendo a toda la lista.
  if (!(await existeCrm(seg.funnelId))) return [];
  const subs = await suscriptosDe(seg.funnelId);
  return subs
    .filter((s) => !s.optOut && entraEnSegmento(seg, s.etapa))
    .map((s) => ({ id: s.id, nombre: s.nombre, email: s.email, empresa: s.empresa }));
}

/** ¿Ese funnel existe, está activo y es de este negocio? Lo pregunta el validador de segmentos antes de guardar uno. */
export async function existeCrm(funnelId: number): Promise<boolean> {
  return (await listarFunnels()).some((f) => f.id === funnelId);
}

/**
 * Suma leads de otro CRM al newsletter, en su etapa de entrada. SÓLO con su permiso: `permiso` es lo que declaró quien
 * los suma («me dieron su permiso para escribirles»), y queda escrito en el historial de cada uno. Sin él, no suma.
 * Los que ya están (de casa o agregados) no se tocan.
 */
export async function sumarAlNewsletter(leadIds: readonly number[], permiso: string): Promise<{ crm: CrmNewsletter; agregados: number[]; fallaron: number }> {
  const declarado = permiso.trim();
  if (!declarado) throw new Error('Para sumarlos al newsletter, confirma que te dieron su permiso.');
  const crm = await asegurarCrmNewsletter();
  const r = await agregarLoteAProducto([...leadIds], crm.id, `Sumado al ${crm.nombre} (${declarado.slice(0, 160)})`);
  return { crm, ...r };
}

// ── Las ediciones ────────────────────────────────────────────────────────────
export type Edicion = {
  id: number; asunto: string; preheader: string | null; cuerpo: string; segmento: string;
  etapa: EtapaNewsletter | null;
  estado: string; programado_at: string | null; enviado_at: string | null; created_at: string;
  copy_doc_id: string | null;
  metricas: MetricasEdicion;
};

/** Las ediciones de un CRM (más nuevas primero), con sus métricas sobre los envíos REALES. */
export async function listarEdiciones(funnelId: number): Promise<Edicion[]> {
  const db = await getTenantDb();
  const prefijo = segmentoDeNewsletter(funnelId);
  const { data, error } = await db.from('email_broadcasts')
    .select('id, asunto, preheader, cuerpo, segmento, estado, programado_at, enviado_at, created_at, copy_doc_id')
    .like('segmento', `${prefijo}%`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`No pude leer las ediciones: ${error.message}`);
  const filas = ((data ?? []) as Array<Omit<Edicion, 'etapa' | 'metricas'>>)
    // `newsletter:1` también matchea `newsletter:12%`: se filtra por el segmento parseado.
    .filter((b) => segmentoNewsletter(b.segmento)?.funnelId === funnelId);
  const porEdicion = new Map<number, FilaEnvio[]>();
  const ids = filas.map((b) => b.id);
  for (let i = 0; i < ids.length; i += 100) {
    const tanda = ids.slice(i, i + 100);
    const envios = await leerTodo<FilaEnvio & { broadcast_id: number }>(db, 'email_broadcast_envios', 'id, broadcast_id, estado, abierto_at, clic_at, baja_at', {
      orden: 'id', filtros: (q) => q.in('broadcast_id', tanda),
    });
    for (const e of envios) {
      const l = porEdicion.get(Number(e.broadcast_id)) ?? [];
      l.push(e);
      porEdicion.set(Number(e.broadcast_id), l);
    }
  }
  return filas.map((b) => ({ ...b, etapa: segmentoNewsletter(b.segmento)?.etapa ?? null, metricas: metricasDe(porEdicion.get(b.id) ?? []) }));
}

/** Una edición por id, de ESTE negocio y de un CRM del newsletter; `null` si no existe o es un broadcast común. */
export async function edicionDe(id: number): Promise<Edicion | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('email_broadcasts').select('segmento').eq('id', id).limit(1);
  if (error) throw new Error(`No pude leer la edición: ${error.message}`);
  const seg = segmentoNewsletter(((data ?? []) as Array<{ segmento: string }>)[0]?.segmento);
  if (!seg) return null;
  return (await listarEdiciones(seg.funnelId)).find((e) => e.id === id) ?? null;
}

/**
 * Una edición nueva, en BORRADOR, para todo el CRM (o una etapa). Pasa por `crearBroadcast` (lib/email-marketing.ts),
 * que valida el segmento contra la base: una edición es un broadcast más.
 */
export async function crearEdicion(crmId: number, input: { asunto?: string; preheader?: string | null; cuerpo?: string; etapa?: EtapaNewsletter | null }): Promise<number> {
  const { crearBroadcast } = await import('./email-marketing');
  return crearBroadcast({
    asunto: (input.asunto ?? '').trim() || 'Nueva edición',
    preheader: input.preheader ?? undefined,
    cuerpo: input.cuerpo ?? '',
    segmento: segmentoDeNewsletter(crmId, input.etapa ?? null),
  });
}

/** Liga una edición con el guion del Copywriter donde se escribe (mig 0351). */
export async function ligarCopyDeEdicion(id: number, docId: string): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('email_broadcasts').update({ copy_doc_id: docId, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`No pude ligar la edición con el Copywriter: ${error.message}`);
}

const EDITABLE = new Set(['borrador', 'programado', 'cancelado']);

/**
 * Trae a la edición lo último de su guion del Copywriter (asunto, vista previa y cuerpo): lo que sale es lo que está
 * escrito ahí. Lo llaman la tab (antes de la vista previa, la prueba, programar y enviar) y el cron, antes de mandar una
 * programada (`procesarBroadcastsProgramados`). Sin guion, o ya enviada, no hace nada. Tira si el guion no se puede leer:
 * quien llama decide (la tab lo dice; el cron lo anota y manda lo que la edición ya tenía).
 */
export async function traerEdicionDelCopy(id: number): Promise<void> {
  const e = await edicionDe(id);
  if (!e?.copy_doc_id || !EDITABLE.has(e.estado)) return;
  const [{ abrir }, { bloquesDelDoc }, { actualizarBroadcast }] = await Promise.all([
    import('./copywriter/server'), import('./copywriter/doc'), import('./email-marketing'),
  ]);
  const g = await abrir(e.copy_doc_id);
  if (!g.ok) throw new Error(g.status === 404 ? 'El guion de esta edición ya no está en el Copywriter.' : g.error);
  const copy = edicionDelDoc(bloquesDelDoc(g.doc.contenido), g.pagina.titulo);
  await actualizarBroadcast(id, { asunto: copy.asunto, preheader: copy.preheader, cuerpo: copy.cuerpo });
}

// ── El permiso de lo que se suma a mano ──────────────────────────────────────
const KEY_PERMISOS = 'newsletter.permisos';
const MAX_PERMISOS = 50;
export type PermisoDeclarado = { at: string; origen: string; quien: string };

/**
 * Quien importa una lista o trae leads de otro CRM declara que le dieron permiso para escribirles. Se guarda con quién y
 * cuándo (los últimos 50, aparte de la config: `leerConfig` tira lo que no conoce). Una lectura rota no borra lo anterior
 * en silencio: tira.
 */
export async function registrarPermiso(p: { origen: string; quien: string }): Promise<void> {
  const { getSettingEstricto } = await import('./settings');
  const crudo = await getSettingEstricto(KEY_PERMISOS);
  let lista: PermisoDeclarado[] = [];
  if (crudo) { try { const v = JSON.parse(crudo); if (Array.isArray(v)) lista = v as PermisoDeclarado[]; } catch { lista = []; } }
  lista.unshift({ at: new Date().toISOString(), origen: p.origen.slice(0, 40), quien: p.quien.slice(0, 120) });
  await setSetting(KEY_PERMISOS, JSON.stringify(lista.slice(0, MAX_PERMISOS)));
}

/** La última edición enviada o programada: de ahí se ancla la próxima (`proximaEdicion`). */
export function anclaDeLaProxima(eds: readonly Edicion[]): string | null {
  let mejor: number | null = null;
  for (const e of eds) {
    const t = Date.parse(e.enviado_at ?? (e.estado === 'programado' ? e.programado_at ?? '' : ''));
    if (Number.isFinite(t) && (mejor == null || t > mejor)) mejor = t;
  }
  return mejor == null ? null : new Date(mejor).toISOString();
}

// ── La etapa que se calcula de la lectura (Suscripto → Lee → Dormido, y la baja) ─
export type ResultadoConciliacion = { movidos: number; aLee: number; aDormido: number; aBaja: number; fallos: number; error?: string };
/** Tope de movimientos por corrida: cada uno escribe el historial del lead. Lo que no entra, en la próxima. */
const TOPE_MOVIDOS = 400;

/**
 * Mueve a cada suscripto a la etapa que dice su lectura (`etapaPorLectura`) y a «Dado de baja» al que se dio de baja.
 * La corre el cron de los broadcasts (sólo en los negocios con el envío real prendido: con el envío apagado no sale
 * nada, nadie lee nada y no hay qué mover) y la baja de un lead (`conciliarLeadDelNewsletter`).
 *
 * ⚠️ SÓLO CUENTA LO ENVIADO DE VERDAD (`estado = 'enviado'`, lo decide la regla). Y nunca tira por un lead: lo cuenta
 * en `fallos` y sigue con el resto.
 */
export async function conciliarLectores(o: { soloLead?: number } = {}): Promise<ResultadoConciliacion> {
  const r: ResultadoConciliacion = { movidos: 0, aLee: 0, aDormido: 0, aBaja: 0, fallos: 0 };
  const cfg = await leerConfigNewsletter();
  const crm = await crmDelNewsletter(cfg);
  if (!crm) return r;
  const db = await getTenantDb();
  let subs = await suscriptosDe(crm.id);
  if (o.soloLead != null) subs = subs.filter((s) => s.id === o.soloLead);
  if (!subs.length) return r;

  // Las entregas REALES de las ediciones de este CRM, por lead.
  const { data: eds, error } = await db.from('email_broadcasts').select('id, segmento').like('segmento', `${PREFIJO_SEGMENTO_NEWSLETTER}${crm.id}%`);
  if (error) return { ...r, error: `No pude leer las ediciones: ${error.message}` };
  const ids = ((eds ?? []) as Array<{ id: number; segmento: string }>).filter((b) => segmentoNewsletter(b.segmento)?.funnelId === crm.id).map((b) => Number(b.id));
  const entregas = new Map<number, EntregaEdicion[]>();
  // Las ediciones de las que llegó alguna apertura: sin ninguna, la edición no mide (la regla explica por qué).
  const medidas = new Set<number>();
  const filasDe: Array<{ broadcast_id: number; lead_id: number | null; created_at: string; abierto_at: string | null; estado: string }> = [];
  for (let i = 0; i < ids.length; i += 100) {
    const tanda = ids.slice(i, i + 100);
    // Todos los estados: cuáles cuentan (sólo los enviados de verdad) lo decide `etapaPorLectura`.
    const filas = await leerTodo<{ broadcast_id: number; lead_id: number | null; created_at: string; abierto_at: string | null; estado: string }>(db, 'email_broadcast_envios', 'id, broadcast_id, lead_id, created_at, abierto_at, estado', {
      orden: 'id', filtros: (q) => q.in('broadcast_id', tanda),
    });
    for (const f of filas) { filasDe.push(f); if (f.abierto_at) medidas.add(Number(f.broadcast_id)); }
  }
  for (const f of filasDe) {
    if (f.lead_id == null) continue;
    const l = entregas.get(Number(f.lead_id)) ?? [];
    l.push({ enviadoAt: f.created_at, abierto: !!f.abierto_at, estado: f.estado, medida: medidas.has(Number(f.broadcast_id)) });
    entregas.set(Number(f.lead_id), l);
  }

  for (const s of subs) {
    if (r.movidos >= TOPE_MOVIDOS) break;
    const destino: string | null = s.optOut
      ? (s.etapa === ETAPA_BAJA ? null : ETAPA_BAJA)
      : etapaPorLectura(s.etapa, entregas.get(s.id) ?? [], { n: cfg.dormidoTras });
    if (!destino) continue;
    try {
      const ok = s.casa
        ? await moverLeadAuto(s.id, destino, { canal: 'Newsletter', autor: AUTOR_SISTEMA })
        : (await moverEtapaEnProducto(s.id, crm.id, destino, { autor: AUTOR_SISTEMA }), true);
      if (!ok) { r.fallos += 1; continue; }
      r.movidos += 1;
      if (destino === ETAPA_BAJA) r.aBaja += 1; else if (destino === ETAPAS_NEWSLETTER[1].key) r.aLee += 1; else r.aDormido += 1;
    } catch (e) {
      r.fallos += 1;
      console.error(`[newsletter] no pude mover al lead ${s.id} a ${destino}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return r;
}

/** La baja de UN lead, en el acto (la llama /api/email/unsubscribe, ya adentro de su negocio). Nunca tira. */
export async function conciliarLeadDelNewsletter(leadId: number): Promise<void> {
  try {
    await conciliarLectores({ soloLead: leadId });
  } catch (e) {
    console.error(`[newsletter] la baja del lead ${leadId}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export { CONFIG_VACIA };
