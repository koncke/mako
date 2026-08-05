import 'server-only';

// =============================================================================
// plan-senales — lo que MaKo YA SABE del cliente, para no pedirle lo que ya hizo
// =============================================================================
// El plan de arranque se sembraba IGUAL para todos y con las tareas "ya hechas"
// marcadas por un `if (slug === 'mauricio')` hardcodeado. Resultado: a cada cliente
// nuevo le caían 34 tareas, varias de cosas que ya tenía resueltas ("Conectar la
// cuenta de Meta Ads" cuando la conectó en el onboarding) y otras de un negocio que
// no es el suyo ("Escalar la campaña ganadora" a quien no corre ads).
//
// Acá se lee UNA VEZ el estado real del workspace y se responden dos preguntas por
// tarea: ¿esto YA ESTÁ HECHO? y ¿esto le APLICA? Todo sale de datos que la app ya
// tiene — ninguna integración nueva.
//
// REGLA: una señal solo dice "sí" con evidencia POSITIVA (hay filas, hay credencial,
// hay artefacto). Ante la duda, dice que no: marcar por error una tarea como hecha
// esconde trabajo real; dejarla pendiente solo cuesta un clic.
// =============================================================================

import { getTenantDb, getWorkspaceActual } from './workspace';
import { integracionConectada } from './credenciales';
import { getSetting } from './settings';
import { getDiagnosticoFase } from './fase-store';
import type { CanalId } from './fase-diagnostico';

/** Cada señal responde "¿esto ya está resuelto en el negocio del cliente?". */
export type SenalId =
  | 'meta-conectado' | 'calendly-conectado' | 'whatsapp-conectado' | 'fathom-conectado'
  | 'funnel-cargado' | 'crm-con-leads' | 'llamadas-analizadas' | 'metricas-meta'
  | 'avatares-definidos' | 'razones-definidas' | 'oferta-definida' | 'vsl-con-visitas'
  | 'nutricion-activa';

export type Senales = Record<SenalId, boolean>;

const NINGUNA: Senales = {
  'meta-conectado': false, 'calendly-conectado': false, 'whatsapp-conectado': false, 'fathom-conectado': false,
  'funnel-cargado': false, 'crm-con-leads': false, 'llamadas-analizadas': false, 'metricas-meta': false,
  'avatares-definidos': false, 'razones-definidas': false, 'oferta-definida': false, 'vsl-con-visitas': false,
  'nutricion-activa': false,
};

/** ¿Hay al menos UNA fila en esa tabla del workspace? (head:true = no trae datos).
 *
 *  ⚠️ SOLO sirve para tablas que estén en TENANT_TABLES: el filtro por workspace lo
 *  pone el proxy de getTenantDb, y para una tabla que no está en esa lista hace
 *  passthrough (lib/workspace.ts) — o sea, cuenta las filas de TODOS los inquilinos.
 *  Eso fue exactamente el bug de `funnel_config`: la tabla tenía 4 filas de otros
 *  workspaces y la señal salía verde para los 6, así que todo cliente nuevo nacía
 *  con «Cargar el funnel» y «Definir las métricas norte» ya tildadas y con la
 *  evidencia mintiendo en el historial. Antes de agregar una señal nueva acá:
 *  chequeá que la tabla esté en TENANT_TABLES, o usá `hayFilasWs`. */
async function hayFilas(tabla: string): Promise<boolean> {
  try {
    const db = await getTenantDb();
    const { count, error } = await db.from(tabla).select('*', { count: 'exact', head: true }).limit(1);
    return !error && (count ?? 0) > 0;
  } catch { return false; }
}

/** Igual que `hayFilas` pero con el `.eq('workspace_id', …)` puesto a mano, para las
 *  tablas que quedaron fuera de TENANT_TABLES a propósito. Falla CERRADO: sin
 *  workspace devuelve false (una señal solo dice sí con evidencia positiva). */
async function hayFilasWs(tabla: string): Promise<boolean> {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return false;
    const db = await getTenantDb();
    const { count, error } = await db.from(tabla).select('*', { count: 'exact', head: true }).eq('workspace_id', ws).limit(1);
    return !error && (count ?? 0) > 0;
  } catch { return false; }
}

/** ¿El setting existe y tiene contenido de verdad (no '[]' ni '{}')? */
async function haySetting(key: string): Promise<boolean> {
  try {
    const raw = (await getSetting(key))?.trim();
    if (!raw || raw === '[]' || raw === '{}' || raw === 'null') return false;
    return raw.length > 2;
  } catch { return false; }
}

/**
 * Lee el estado REAL del workspace actual. Todo en paralelo y best-effort: si una
 * consulta falla, esa señal queda en false (no se inventa que algo está hecho).
 */
export async function leerSenales(): Promise<Senales> {
  try {
    const [
      meta, calendly, whatsapp, fathom,
      funnel, leads, llamadas, metricas,
      avatares, razones, oferta, vsl, nutricion,
    ] = await Promise.all([
      integracionConectada('meta').catch(() => false),
      integracionConectada('calendly').catch(() => false),
      integracionConectada('whatsapp').catch(() => false),
      integracionConectada('fathom').catch(() => false),
      hayFilasWs('funnel_config'),  // NO está en TENANT_TABLES: el filtro va a mano
      hayFilas('leads'),
      hayFilas('closing_analyses'),
      hayFilas('marketing_metrics_daily'),
      haySetting('mako.avatares'),
      haySetting('mako.razones'),
      haySetting('mako.entregable'),
      hayFilas('vsl_events'),
      hayFilas('nutricion_secuencias'),
    ]);
    return {
      'meta-conectado': meta, 'calendly-conectado': calendly, 'whatsapp-conectado': whatsapp, 'fathom-conectado': fathom,
      'funnel-cargado': funnel, 'crm-con-leads': leads, 'llamadas-analizadas': llamadas, 'metricas-meta': metricas,
      'avatares-definidos': avatares, 'razones-definidas': razones, 'oferta-definida': oferta, 'vsl-con-visitas': vsl,
      'nutricion-activa': nutricion,
    };
  } catch { return { ...NINGUNA }; }
}

// ── ¿Qué le APLICA a este negocio? ───────────────────────────────────────────
// El diagnóstico del onboarding dice en qué fase está (1 a 5) y por qué canal
// vende. Sembrar "Escalar la campaña ganadora" a alguien de fase 1 que todavía no
// encontró un anuncio ganador es ruido: le llena el tablero de trabajo que no le
// toca todavía y entierra lo que sí.
// `fase: null` = todavía no hizo el diagnóstico. En ese caso NO se recorta nada:
// personalizar sin datos sería adivinar, y adivinando se le esconde trabajo real.
// OJO — `fase` acá es la fase que se MUESTRA (1 a 5). En el diagnóstico guardado
// es un índice 0-based (FASES[fase], ver faseDef): confundirlos corre todo un
// lugar y le esconde al cliente el proyecto de su fase real.
export type ContextoNegocio = { fase: number | null; canal: CanalId | null };

export async function contextoDelNegocio(): Promise<ContextoNegocio> {
  try {
    const d = await getDiagnosticoFase();
    const idx = typeof d?.fase === 'number' ? d.fase : null;
    return { fase: idx == null ? null : Math.max(1, Math.min(5, idx + 1)), canal: d?.canal ?? null };
  } catch { return { fase: null, canal: null }; }
}

/** Log legible para el server (qué encontró MaKo antes de armar el plan). */
export function resumenSenales(s: Senales, ctx: ContextoNegocio, ws: number | null): string {
  const si = (Object.keys(s) as SenalId[]).filter((k) => s[k]);
  return `[plan-seed] ws=${ws ?? '?'} fase=${ctx.fase ?? 'sin diagnóstico'} canal=${ctx.canal ?? '—'} · ya resuelto: ${si.length ? si.join(', ') : '(nada)'}`;
}

export async function estadoParaSeed(): Promise<{ senales: Senales; ctx: ContextoNegocio; ws: number | null }> {
  const [senales, ctx, ws] = await Promise.all([leerSenales(), contextoDelNegocio(), getWorkspaceActual()]);
  console.log(resumenSenales(senales, ctx, ws));
  return { senales, ctx, ws };
}
