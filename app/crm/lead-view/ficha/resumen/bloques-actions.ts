'use server';

// =============================================================================
// ficha/resumen/bloques-actions — lo que dos bloques del Resumen leen al montarse (no viene en la ficha)
// =============================================================================
// La regla del armador (../tipos.ts, «Cómo se enchufa un bloque», punto 3): lo que no viene en `LeadFullData` lo pide
// el bloque con SU acción, en un efecto al montarse. Así nadie paga la lectura de un bloque que no está puesto, y
// `getLeadFullAction` no crece.
//   · `tiempo-en-etapa`: desde cuándo está en su etapa (el historial, `lead_audit`) y el plazo de la etapa.
//   · `posibles-duplicados`: otras fichas con el mismo email o teléfono.
//
// ⚠️ SIN SESIÓN NO SE LEE NADA: sin cookie, `getWorkspaceActual()` cae al ws1, que es un cliente (AGENTS.md). Y el lead
//    se lee con `getLead`, que es del workspace: un id ajeno no existe.
// ⚠️ EN UN ARCHIVO 'use server' SÓLO SE EXPORTAN FUNCIONES ASYNC (AGENTS.md, la frontera).
// ⚠️ NUNCA TIRAN: un bloque que no pudo leer se calla o dice «sin dato», no rompe la ficha.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { getLead, duplicadosDeLead } from '@/lib/leads';
import { instagramComparable } from '@/lib/leads-duplicados';
import { getTenantDb } from '@/lib/workspace';
import { funnelsConUmbrales, listarFunnels } from '@/lib/funnels';
import { productosDelLead } from '@/lib/lead-funnel';
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import { etapaVigenteDe } from '@/lib/funnel-etapas';
import { CAMPO_ETAPA } from '@/lib/etapa-historial';
import { entradaALaEtapa, plazosValidos } from '@/lib/lead-quieto';
import { exigirSesion } from '@/lib/sesion-accion';

const idValido = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0;
const conSesion = async (): Promise<boolean> => { try { return Boolean(await getUsuarioActual()); } catch { return false; } };

/** Desde cuándo está el lead en su etapa de hoy y el plazo de esa etapa. null = no se pudo leer. */
export async function tiempoEnEtapaAction(leadId: number): Promise<{ etapa: string; desde: string | null; plazo: number | null } | null> {
  await exigirSesion();
  if (!idValido(leadId) || !(await conSesion())) return null;
  try {
    const lead = await getLead(leadId);
    if (!lead) return null;
    const funnels = await funnelsConUmbrales();
    // La casa del lead; una casa que no está (borrada, NULL) es la del negocio (mig 0181, `apagadosDeLaCasa`).
    const funnel = funnels?.find((f) => lead.funnel_id != null && f.id === Number(lead.funnel_id)) ?? funnels?.find((f) => f.esDefault) ?? funnels?.[0] ?? null;
    const stages = funnel?.cfg.stages ?? [];
    const etapa = etapaVigenteDe(lead, stages);
    const db = await getTenantDb();
    const { data, error } = await db.from('lead_audit').select('valor_nuevo, created_at')
      .eq('lead_id', leadId).eq('campo', CAMPO_ETAPA)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1);
    if (error) return { etapa, desde: null, plazo: null };
    const f = ((data ?? []) as Array<{ valor_nuevo: string | null; created_at: string }>)[0];
    const desde = entradaALaEtapa({
      etapa, etapaVista: lead.etapa_vista, ultimaEtapa: f ? { valor: f.valor_nuevo, at: f.created_at } : null, creadoEn: lead.created_at,
    });
    const plazo = plazosValidos(funnel?.umbrales?.porEtapa, stages).plazos[etapa] ?? null;
    return { etapa, desde, plazo };
  } catch {
    return null;
  }
}

/** Un CRM donde está una ficha parecida, con su etapa ahí (null = no se pudo ubicar). */
export type DondeEsta = { crm: string; etapa: string | null; casa: boolean };

/**
 * Una ficha que parece la misma persona. Desde el 23/10/2026 (Martín: «ese bloque en el detail requiere más info... ¿En
 * qué CRM aparece duplicada?»): en qué CRM está (su casa y los que la tienen agregada, cada uno con su etapa), desde
 * cuándo existe (`desde`, su alta) y por qué se parece (`porque`: «mismo teléfono», «mismo email», «mismo @»).
 */
export type FichaParecida = { id: number; nombre: string; porque: string; desde: string | null; donde: DondeEsta[] };

/** Dónde está una ficha: su casa primero y después los CRM donde está agregada, con el nombre de la etapa de cada uno. */
async function dondeEstaLaFicha(leadId: number, cache: {
  nombres: Map<number, string>; etapas: Map<number, Array<{ key: string; label: string }>>; delNegocio: number | null;
}): Promise<{ desde: string | null; donde: DondeEsta[] }> {
  const lead = await getLead(leadId);
  if (!lead) return { desde: null, donde: [] };
  const { productos } = await productosDelLead(leadId);
  const etiqueta = (funnelId: number, key: string | null | undefined): string | null =>
    (key ? cache.etapas.get(funnelId)?.find((s) => s.key === key)?.label : null) ?? key ?? null;
  const donde = productos
    .map((p) => {
      const fid = p.funnelId ?? cache.delNegocio;
      const stages = fid != null ? cache.etapas.get(fid) ?? [] : [];
      const key = p.esCasa ? etapaVigenteDe(lead, stages as never) : p.etapa;
      return { crm: (fid != null ? cache.nombres.get(fid) : null) ?? 'otro CRM', etapa: fid != null ? etiqueta(fid, key) : key ?? null, casa: !!p.esCasa };
    })
    .sort((a, b) => Number(b.casa) - Number(a.casa));
  return { desde: lead.created_at ?? null, donde };
}

/**
 * Otras fichas con el mismo email, teléfono o @ de Instagram (la comparación de siempre, `duplicadosDeLead`). ⚠️ SIN
 * NINGUNO DE LOS TRES NO SE BUSCA: por el nombre solo, la búsqueda lee la tabla entera (un nombre de pila corto no filtra),
 * y eso al abrir cada ficha es caro y casi siempre un falso parecido. null = no se pudo leer.
 */
export async function duplicadosDelLeadAction(leadId: number): Promise<FichaParecida[] | null> {
  await exigirSesion();
  if (!idValido(leadId) || !(await conSesion())) return null;
  try {
    const lead = await getLead(leadId);
    if (!lead) return null;
    if (!lead.email?.trim() && !lead.telefono?.trim() && !lead.telefono_normalizado?.trim() && !instagramComparable(lead.instagram)) return [];
    const r = await duplicadosDeLead({ email: lead.email, telefono: lead.telefono, telefonoNormalizado: lead.telefono_normalizado, instagram: lead.instagram });
    const otras = r.filter((c) => c.lead.id !== leadId).slice(0, 5);
    if (!otras.length) return [];
    // Los nombres y las etapas de los CRM, UNA lectura para todas las fichas parecidas (son hasta cinco).
    const [funnels, conEtapas] = await Promise.all([listarFunnels(), funnelsConUmbrales()]);
    const cache = {
      nombres: new Map(funnels.map((f) => [f.id, nombreVisible(f)] as const)),
      etapas: new Map((conEtapas ?? []).map((f) => [f.id, f.cfg.stages.map((s) => ({ key: s.key, label: s.label }))] as const)),
      delNegocio: funnels.find((f) => f.esDefault)?.id ?? funnels[0]?.id ?? null,
    };
    return Promise.all(otras.map(async (c) => {
      // Si una no se puede ubicar, igual se dice que existe (sin dónde): el aviso es lo que importa.
      const d = await dondeEstaLaFicha(c.lead.id, cache).catch(() => ({ desde: null, donde: [] as DondeEsta[] }));
      return { id: c.lead.id, nombre: c.lead.nombre?.trim() || `Lead ${c.lead.id}`, porque: c.texto, ...d };
    }));
  } catch {
    return null;
  }
}
