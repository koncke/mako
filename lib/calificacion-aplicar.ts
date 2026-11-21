// =============================================================================
// calificacion-aplicar — mover al lead a su etapa según lo que contestó, y dejar escrito por qué (server, 20/11/2026)
// =============================================================================
// Lo llaman las puertas por donde entra un formulario —el opt-in de una página (app/api/track/optin/route.ts) y un lead de
// Meta (lib/meta-lead-nuevo.ts y el poll)— y el «REAPLICAR» de «Asignar fuentes» (app/crm/fuentes-actions.ts). Las reglas
// son de cada funnel (lib/fuentes-formularios.ts) y el motor es puro (lib/calificacion-formulario.ts).
//
// QUÉ MUEVE Y QUÉ NO:
//   · Mira cada funnel donde está el lead (su casa y los agregados) y, en cada uno, las reglas de ESE formulario.
//   · Sólo mueve al que está en la etapa de entrada o en una de las que esas reglas reparten (`puedeMoverDesde`): uno que
//     alguien ya llevó a «Agenda R1» no vuelve atrás.
//   · La casa se mueve con `setPipelineStage` (la puerta única, con su historial y su estado) y un agregado con
//     `moverEtapaEnProducto`. Y en los dos queda una línea «Calificación automática» con la regla y el porqué.
//   · Nunca tira: un fallo queda en el log y el lead se queda donde entró, que es lo que pasaba sin reglas.
// =============================================================================

import 'server-only';
import { getSetting, getSettingEstricto, setSetting } from './settings';
import { getTenantDb } from './workspace';
import { CLAVE_REGLAS, parsearMapaReglas, serializarMapaReglas, reglasDe, hayReglasPara, tipoDeClave, type MapaReglas } from './fuentes-formularios';
import { calificar, puedeMoverDesde, type Respuestas } from './calificacion-formulario';
import { pipelineStageOf } from './pipeline';
import { AUTOR_SISTEMA } from './etapa-historial';
import { etapaDeEntrada } from './lead-funnel-reglas';
import { faltaLaTabla } from './lead-formularios';
import type { MetaFieldData } from './meta-leads-campos';

export const CAMPO_CALIFICACION = 'Calificación automática';

export async function leerMapaReglas(): Promise<MapaReglas> {
  return parsearMapaReglas(await getSetting(CLAVE_REGLAS).catch(() => null));
}
/** ESTRICTA para escribir encima: con una lectura caída leída como «nada», guardar borraría las reglas de los otros formularios. */
export async function leerMapaReglasEstricto(): Promise<MapaReglas> {
  return parsearMapaReglas(await getSettingEstricto(CLAVE_REGLAS));
}
export async function guardarMapaReglas(m: MapaReglas): Promise<void> {
  await setSetting(CLAVE_REGLAS, serializarMapaReglas(m));
}

/** Las respuestas de un formulario de Meta (`field_data`) como pregunta → respuestas. */
export function respuestasDeMeta(fd: MetaFieldData | null | undefined): Respuestas {
  const out: Record<string, string[]> = {};
  for (const f of Array.isArray(fd) ? fd : []) if (f?.name) out[f.name] = Array.isArray(f.values) ? f.values.map(String) : [];
  return out;
}
/** Las de una página (`[{pregunta, respuesta}]`). */
export function respuestasDeOptin(rs: ReadonlyArray<{ pregunta: string; respuesta: string }> | unknown): Respuestas {
  const out: Record<string, string> = {};
  for (const r of Array.isArray(rs) ? rs : []) {
    const x = r as { pregunta?: unknown; respuesta?: unknown } | null;
    if (x && typeof x.pregunta === 'string' && x.pregunta.trim()) out[x.pregunta] = String(x.respuesta ?? '');
  }
  return out;
}

export type Movimiento = { funnelId: number; antes: string | null; etapa: string; etiqueta: string; porque: string };

type Etapa = { key: string; label: string; kind?: string | null };

/**
 * Aplica las reglas de los formularios `claves` (la primera que tenga reglas prendidas en un funnel gana en ese funnel) al
 * lead. `simular` sólo cuenta lo que haría (el «REAPLICAR» pregunta con el número). `soloFunnel` = sólo en ese funnel (el
 * del modal). Adentro de `runWithWorkspace`.
 */
export async function aplicarCalificacion(
  leadId: number,
  claves: ReadonlyArray<string>,
  respuestas: Respuestas,
  opc: { mapa?: MapaReglas; soloFunnel?: number; simular?: boolean; cacheEtapas?: Map<number, Etapa[]> } = {},
): Promise<Movimiento[]> {
  const movs: Movimiento[] = [];
  try {
    const mapa = opc.mapa ?? await leerMapaReglas();
    if (!hayReglasPara(mapa, claves)) return movs;
    // Import dinámico: lib/leads.ts y lib/lead-funnel.ts son pesados y se importan entre sí; acá sólo hacen falta si hay reglas.
    const { getLead, setPipelineStage, logLeadEvent } = await import('./leads');
    const { productosDelLead, etapasDeProducto, moverEtapaEnProducto } = await import('./lead-funnel');
    const lead = await getLead(leadId);
    if (!lead) return movs;
    const { productos } = await productosDelLead(leadId);
    const cache = opc.cacheEtapas ?? new Map<number, Etapa[]>();
    for (const p of productos) {
      if (opc.soloFunnel != null && p.funnelId !== opc.soloFunnel) continue;
      const clave = claves.find((c) => reglasDe(mapa, p.funnelId, c)?.activa);
      if (!clave) continue;
      const reglas = reglasDe(mapa, p.funnelId, clave)!;
      const r = calificar(reglas, respuestas);
      if (!r.etapa) continue;
      let etapas = cache.get(p.funnelId);
      if (!etapas) { etapas = (await etapasDeProducto(p.funnelId)) as Etapa[]; cache.set(p.funnelId, etapas); }
      const actual = p.esCasa ? pipelineStageOf(lead) : p.etapa;
      if (r.etapa === actual) continue;
      if (!puedeMoverDesde(actual, reglas, etapaDeEntrada(etapas))) continue;
      const destino = etapas.find((s) => s.key === r.etapa);
      if (!destino) continue; // la etapa ya no existe en ese funnel: no se mueve a una columna fantasma
      const quien = reglas.nombre ? `«${reglas.nombre}»` : tipoDeClave(clave) === 'meta' ? 'el formulario de Meta' : 'el formulario';
      const porque = `${quien} · ${r.indice != null ? `regla ${r.indice + 1}` : 'ninguna regla se cumplió'}: ${r.porque}`;
      movs.push({ funnelId: p.funnelId, antes: actual, etapa: destino.key, etiqueta: destino.label, porque });
      if (opc.simular) continue;
      try {
        if (p.esCasa) {
          await setPipelineStage(leadId, destino.key, {
            autor: AUTOR_SISTEMA,
            ...(destino.key === 'descal' ? { motivo: `Calificación automática: ${r.porque}`.slice(0, 300) } : {}),
            requisitos: { omitir: 'Lo movió la calificación automática del formulario' },
          });
        } else {
          await moverEtapaEnProducto(leadId, p.funnelId, destino.key, { autor: AUTOR_SISTEMA });
        }
        await logLeadEvent(leadId, CAMPO_CALIFICACION, `${porque} → ${destino.label}`.slice(0, 900), AUTOR_SISTEMA);
      } catch (e) {
        movs.pop();
        console.error(`[calificacion] lead=${leadId} funnel=${p.funnelId} no se pudo mover a ${destino.key}:`, e instanceof Error ? e.message : e);
      }
    }
  } catch (e) {
    console.error(`[calificacion] lead=${leadId} no se pudo calificar:`, e instanceof Error ? e.message : e);
  }
  return movs;
}

// ── Los envíos de un formulario (para las preguntas, la vista previa y el «REAPLICAR») ─────────────────────────────────

export type EnvioDeFormulario = { leadId: number; respuestas: Respuestas; fecha: string | null };

const TOPE_ENVIOS = 2000;

/**
 * Los leads que llegaron por un formulario, del más nuevo al más viejo, con lo que contestaron:
 *   · `meta:<id>` → los `meta_lead_id` que Meta dice que son de ese formulario (`leadIdsMeta`, los trae quien llama de
 *     Graph), cruzados con `leads.meta_field_data`;
 *   · `form:<id>` → `lead_formularios` (mig 0415). Sin la tabla, los leads de la página de esa landing (`pagina`);
 *   · `web:<página>` → los leads con esa `pagina_registro` y sus `optin_respuestas`.
 */
export async function enviosDeFormulario(clave: string, extra: { leadIdsMeta?: string[]; pagina?: string | null } = {}): Promise<EnvioDeFormulario[]> {
  const db = await getTenantDb();
  const tipo = tipoDeClave(clave);
  if (tipo === 'meta') {
    const ids = (extra.leadIdsMeta ?? []).slice(0, TOPE_ENVIOS);
    const out: EnvioDeFormulario[] = [];
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await db.from('leads').select('id, meta_field_data, created_at').in('meta_lead_id', ids.slice(i, i + 300));
      if (error) throw new Error(error.message);
      for (const l of (data ?? []) as Array<{ id: number; meta_field_data: MetaFieldData | null; created_at: string | null }>) {
        out.push({ leadId: Number(l.id), respuestas: respuestasDeMeta(l.meta_field_data), fecha: l.created_at });
      }
    }
    return out.sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')));
  }
  if (tipo === 'wg') {
    const formId = clave.slice('form:'.length);
    const { data, error } = await db.from('lead_formularios').select('lead_id, respuestas, created_at')
      .eq('formulario_id', formId).order('created_at', { ascending: false }).limit(TOPE_ENVIOS);
    if (!error) {
      // Un lead que mandó dos veces cuenta una: el envío más nuevo.
      const vistos = new Set<number>();
      const out: EnvioDeFormulario[] = [];
      for (const r of (data ?? []) as Array<{ lead_id: number; respuestas: unknown; created_at: string }>) {
        const id = Number(r.lead_id);
        if (vistos.has(id)) continue;
        vistos.add(id);
        out.push({ leadId: id, respuestas: respuestasDeOptin(r.respuestas), fecha: r.created_at });
      }
      return out;
    }
    if (!faltaLaTabla(error)) throw new Error(error.message);
    if (!extra.pagina) return [];
    return enviosDePagina(extra.pagina);
  }
  if (tipo === 'web') return enviosDePagina(clave.slice('web:'.length));
  return [];
}

async function enviosDePagina(pagina: string): Promise<EnvioDeFormulario[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id, optin_respuestas, created_at')
    .eq('pagina_registro', pagina).order('created_at', { ascending: false }).limit(TOPE_ENVIOS);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ id: number; optin_respuestas: unknown; created_at: string | null }>)
    .map((l) => ({ leadId: Number(l.id), respuestas: respuestasDeOptin(l.optin_respuestas), fecha: l.created_at }));
}
