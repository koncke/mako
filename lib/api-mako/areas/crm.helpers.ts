// =============================================================================
// api-mako/areas/crm.helpers — lo que el área `crm` necesita y lib/ no exporta
// =============================================================================
// Todo esto es DEUDA con lib/: vive inline en app/crm/actions.ts o en
// app/crm/[id]/deal-actions.ts (server actions, que no se pueden llamar desde el
// registro porque leen la sesión y llaman updateTag/revalidatePath) o en
// app/api/agente/lead/route.ts. Se copió la MISMA regla, corta; el día que exista
// en lib/ (leads-filtro, leads-higiene, deal, propuestas-lead), esto se borra.
//
// Todo pasa por getTenantDb() o por libs que ya lo usan: corre adentro de
// runWithWorkspace(ctx.ws), que pone el choke point (lib/api-mako/ejecutar.ts).
//
// ⚠️ `usuarios` NO es tenant-scoped (no está en TENANT_TABLES): el filtro por
// workspace de `nombresDelEquipo` es EXPLÍCITO y no se saca.
// =============================================================================

import 'server-only';
import { revalidateTag } from 'next/cache';
import { getTenantDb } from '@/lib/workspace';
import { TAG } from '@/lib/cache';
import { listLeads, getFunnel, getLeadRespuestas, faltantesDeLead, saveFunnel, logLeadEvent, type Lead } from '@/lib/leads';
import { getPagosByLead } from '@/lib/pagos';
import { encuentroGrabable } from '@/lib/encuentro-ws';
import { etapaVigenteDe } from '@/lib/funnel-etapas';
import { stageMetaOpt, parseEntradas, MAKO_SETTER, type Stage } from '@/lib/pipeline';
import { listarUsuarios } from '@/lib/usuarios';
import { tzDeWorkspace, TZ_DEFAULT } from '@/lib/timezone';
import { hoyEnTz } from '@/lib/date-utils';
import { crearPropuesta } from '@/lib/propuestas';
import type { Step } from '@/lib/stage-requirements';

/** La caché de lecturas (listLeads, getJuntasProximas…) vence sola a los 60 s; esto
 *  la adelanta. ⚠️ NO `updateTag`: solo corre dentro de una server action, y
 *  ejecutar() corre desde el webhook de WhatsApp o desde HTTP — lanzaba, el catch se
 *  lo tragaba y la caché quedaba vieja. Mismo arreglo que general.run.ts. */
export function invalidar(...tags: Array<keyof typeof TAG>): void {
  for (const t of tags) { try { revalidateTag(TAG[t], { expire: 0 }); } catch { /* vence por TTL */ } }
}

/** El estado de una confirmación del CRM automático en ESTE workspace (getTenantDb
 *  scopea), o null si no existe. resolverConfirmacion no avisa si ya estaba resuelta. */
export async function estadoConfirmacion(id: number): Promise<string | null> {
  const { data, error } = await (await getTenantDb()).from('mako_confirmaciones').select('estado').eq('id', id).maybeSingle();
  if (error) throw new Error(`No se pudo leer la confirmación #${id}: ${error.message}`);
  return data ? String((data as { estado: unknown }).estado) : null;
}

export async function hoyDelWorkspace(ws: number): Promise<{ tz: string; hoy: string }> {
  const tz = await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
  return { tz, hoy: hoyEnTz(tz) };
}

export const esFechaIso = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T12:00:00Z`));

/** Las etapas GENERADAS del funnel (con `kind`): sin kind los requisitos dan nivel 0. */
export async function etapasDelFunnel(): Promise<Stage[]> {
  return (await getFunnel()).stages;
}

/** Copia de getLeadFullAction (app/crm/actions.ts): los mismos insumos para faltantesDeLead. */
export async function faltantesDeUnLead(lead: Lead): Promise<Step[]> {
  const [pagos, respuestas, stages, grabable] = await Promise.all([
    getPagosByLead(lead.id).catch(() => []),
    getLeadRespuestas(lead).catch(() => ({ R1: [], R2: [] })),
    etapasDelFunnel(),
    encuentroGrabable(),
  ]);
  const comprobantesFaltantes = pagos.filter((p) => p.pagado && !p.comprobante_path).length;
  return faltantesDeLead(lead, pagos.length > 0, { comprobantesFaltantes, r2RespuestasOk: respuestas.R2.length > 0, pipeline: stages, grabable });
}

const BANDA: Record<string, string> = { activo: 'pipeline', nutricion: 'nutricion', descartado: 'salidas' };
const origenDe = (l: Lead): string => l.meta_ad_name?.trim() || l.meta_campaign_name?.trim() || l.utm_campaign?.trim() || 'directo';

export type FiltroLeads = { etapas?: string[]; banda?: string; campoFecha?: string; desde?: string; hasta?: string; persona?: string };

/** Copia corta de leadsFiltrados (app/crm/actions.ts): trae la cartera ENTERA (listLeads
 *  pagina) y filtra en memoria por etapa EFECTIVA. Filtrar por la columna
 *  pipeline_stage devuelve 0 leads en nutrición: es un override, casi siempre null. */
export async function leadsFiltrados(f: FiltroLeads) {
  const [leads, stages] = await Promise.all([listLeads(), etapasDelFunnel()]);
  const banda = f.banda ? BANDA[f.banda] : null;
  const campo = (f.campoFecha ?? 'created_at') as keyof Lead;
  const persona = f.persona?.trim().toLowerCase();
  const filas = leads.flatMap((l) => {
    const key = etapaVigenteDe(l, stages);
    const meta = stageMetaOpt(stages, key);
    if (f.etapas?.length && !f.etapas.includes(key)) return [];
    if (banda && (meta?.band ?? 'pipeline') !== banda) return [];
    const fecha = typeof l[campo] === 'string' ? (l[campo] as string).slice(0, 10) : null;
    if ((f.desde || f.hasta) && !fecha) return [];
    if (f.desde && fecha! < f.desde) return [];
    if (f.hasta && fecha! > f.hasta) return [];
    if (persona === 'sin_asignar' && (l.closer?.trim() || l.setter?.trim())) return [];
    if (persona && persona !== 'sin_asignar' && l.closer?.trim().toLowerCase() !== persona && l.setter?.trim().toLowerCase() !== persona) return [];
    return [{ l, key, label: meta?.label ?? null, band: meta?.band ?? null, fecha }];
  });
  return { filas, total_cartera: leads.length };
}

/** Copia corta de getOpcionesExportAction: conteo por etapa efectiva, origen y sin asignar. */
export async function conteoPorEtapa() {
  const [leads, stages] = await Promise.all([listLeads(), etapasDelFunnel()]);
  const porEtapa = new Map<string, number>();
  const porOrigen = new Map<string, number>();
  let sinAsignar = 0;
  for (const l of leads) {
    const k = etapaVigenteDe(l, stages);
    porEtapa.set(k, (porEtapa.get(k) ?? 0) + 1);
    const o = origenDe(l);
    porOrigen.set(o, (porOrigen.get(o) ?? 0) + 1);
    if (!l.closer?.trim() && !l.setter?.trim()) sinAsignar++;
  }
  const etapas = stages.map((s) => ({ key: s.key, label: s.label, banda: s.band ?? 'pipeline', leads: porEtapa.get(s.key) ?? 0 }));
  const fuera = [...porEtapa].filter(([k]) => !stageMetaOpt(stages, k)).map(([key, leads]) => ({ key, leads }));
  const origenes = [...porOrigen].sort((a, b) => b[1] - a[1]).map(([origen, leads]) => ({ origen, leads }));
  return { total_leads: leads.length, etapas, etapas_fuera_del_funnel: fuera, origenes, sin_closer_ni_setter: sinAsignar };
}

/** Nombres asignables como closer/setter: el equipo del workspace (sin admins de
 *  agencia, suspendidos ni MaKo, como getEquipoAction) más los ya usados en leads. */
export async function nombresAsignables(ws: number): Promise<string[]> {
  const [usuarios, leads] = await Promise.all([listarUsuarios().catch(() => []), listLeads()]);
  const equipo = usuarios
    .filter((u) => u.workspace_id === ws && u.rol !== 'admin' && u.estado !== 'suspendido')
    // Sin caer al email: esta lista viaja en `disponibles`, también por HTTP, y un
    // miembro sin nombre cargado le entregaba su email al tenedor del token.
    .map((u) => u.nombre?.trim());
  const usados = leads.flatMap((l) => [l.closer?.trim(), l.setter?.trim()]);
  return [...new Set([...equipo, ...usados].filter((n): n is string => !!n && n !== MAKO_SETTER))].sort();
}

/** Copia de ignorarPendientesAction / reactivarPendientesAction (app/crm/actions.ts). */
export async function marcarPendientesIgnorados(leadId: number, ignorar: boolean, autor: string): Promise<void> {
  const db = await getTenantDb();
  const { error } = await db.from('leads').update({ pendientes_ignorados: ignorar ? new Date().toISOString() : null }).eq('id', leadId);
  if (error) throw new Error(`No se pudo ${ignorar ? 'ignorar' : 'reactivar'}: ${error.message}`);
  await logLeadEvent(leadId, 'Datos sin marcar', ignorar ? 'ignorados' : 'reactivados', autor);
  invalidar('leads');
}

/** Copia de declararEntradasAction sin el evento: se conserva el que ya estaba.
 *  ⚠️ Con el funnel leído en ERROR, getFunnel devuelve el DEFAULT y guardarlo pisaría
 *  el funnel real del cliente con la plantilla: se corta antes. */
export async function guardarEntradas(entradas: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const limpias = parseEntradas(entradas);
  if (!limpias.length) return { ok: false, error: 'Elige al menos una forma en la que llega la gente.' };
  const actual = await getFunnel();
  if (actual.origen === 'error') return { ok: false, error: 'No se pudo leer el funnel actual; no se guardó nada para no pisarlo. Vuelve a intentarlo.' };
  await saveFunnel(actual.pipeline, actual.suppressed, { entradas: limpias, evento: actual.evento });
  invalidar('pipeline', 'leads');
  return { ok: true };
}

type Seccion = Record<string, unknown> | null | undefined;
const fusion = (previo: Seccion, nuevo: Seccion) => ({ ...(previo ?? {}), ...(nuevo ?? {}) });

/** Copia de saveDealSectionsAction (deal-actions.ts), con MERGE por sección: la
 *  pantalla del CRM manda la sección entera (con doc_path); un agente manda solo lo
 *  que sabe, y reemplazar el objeto borraría el documento fiscal subido. */
export async function guardarDeal(lead: Lead, p: Record<string, unknown>, autor: string): Promise<string[]> {
  const upd: Record<string, unknown> = {};
  const tocadas: string[] = [];
  const sec = (k: 'deal_fiscal' | 'deal_servicio' | 'deal_promesa' | 'deal_obligaciones', nombre: string) => {
    if (p[k] === undefined) return;
    upd[k] = fusion(lead[k] as Seccion, p[k] as Seccion);
    tocadas.push(nombre);
  };
  sec('deal_fiscal', 'datos fiscales');
  sec('deal_servicio', 'servicio');
  sec('deal_promesa', 'promesa');
  sec('deal_obligaciones', 'obligaciones');
  if (p.facturado_por_id !== undefined) { upd.facturado_por_id = p.facturado_por_id; tocadas.push('facturado por'); }
  if (!tocadas.length) return [];
  const { error } = await (await getTenantDb()).from('leads').update(upd).eq('id', lead.id);
  if (error) throw new Error(`Error guardando el deal del lead ${lead.id}: ${error.message}`);
  await logLeadEvent(lead.id, 'Deal details', `Guardó: ${tocadas.join(', ')}`, autor);
  invalidar('leads');
  return tocadas;
}

/** ¿Existe esa identidad fiscal en ESTE workspace? (getTenantDb scopea). */
export async function existeIdentidadFiscal(id: number): Promise<boolean> {
  const { data } = await (await getTenantDb()).from('identidades_fiscales').select('id').eq('id', id).maybeSingle();
  return !!data;
}

const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Copia de aFila + el alta de app/api/agente/lead/route.ts: mismo saneo, misma ref
 *  por defecto (los contactos, no los nombres), misma forma de `datos.leads`. */
export async function proponerLote(ws: number, crudos: Array<Record<string, unknown>>, origenTxt: string | null, refPedida: string | null, origen: string) {
  const filas: Array<Record<string, unknown>> = [];
  const descartados: string[] = [];
  crudos.forEach((c, i) => {
    const nombre = txt(c.nombre);
    const email = txt(c.email)?.toLowerCase() ?? null;
    const telefono = txt(c.telefono);
    if (!nombre) { descartados.push(`el contacto #${i + 1} no tiene nombre`); return; }
    if (!email && !telefono) { descartados.push(`«${nombre}» no tiene email ni teléfono`); return; }
    filas.push({ nombre, email, telefono, empresa: txt(c.empresa), utm_source: txt(c.utm_source), utm_medium: txt(c.utm_medium), utm_campaign: txt(c.utm_campaign), utm_content: txt(c.utm_content) });
  });
  if (!filas.length) return { error: descartados.join(' · ') || 'ningún contacto válido' };
  const ref = refPedida ?? `lead:${filas.map((f) => f.telefono ?? f.email).join(',')}`.slice(0, 200);
  const resumen = filas.length === 1 ? `${filas[0].nombre}${origenTxt ? ` · ${origenTxt}` : ''}` : `${filas.length} contactos${origenTxt ? ` · ${origenTxt}` : ''}`;
  const { id, nueva } = await crearPropuesta({ ws, tipo: 'lead', origen, ref, resumen, datos: { leads: filas, origen: origenTxt } });
  return { id, nueva, leads: filas.length, descartados };
}
