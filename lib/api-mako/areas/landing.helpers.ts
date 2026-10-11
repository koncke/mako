// =============================================================================
// api-mako/areas/landing.helpers — lo que el área `landing` necesita y no exporta lib/
// =============================================================================
// Todo esto es DEUDA con las libs del área, y cada bloque dice con cuál:
//
//  1. Leer y escribir las listas del negocio (landings declaradas, videos
//     nombrados, videos ocultos) vive SOLO en las server actions de
//     app/integraciones (landing-config-actions.ts, landing-actions.ts), gateadas
//     con requireRolWs, que no existe fuera de una request con sesión. Lo puro
//     (conLanding, conVideo…) sí está en lib; aquí queda el acceso al setting.
//     ⚠️ Se lee con getSettingEstricto, NO con getSetting: estas listas se
//     escriben con read-modify-write del JSON entero, y getSetting convierte un
//     5xx de Supabase en null → lista vacía → la escritura BORRA todo lo demás.
//  2. Un diagnóstico por URL y la lista compacta de diagnósticos: lib/landing-analyst
//     solo tiene getLandingViewData (barre landing_visits entero) y listarAnalizadas
//     (esconde los que fallaron).
//  3. Una versión guardada por id: lib/landing-writer solo lista.
//  4. (Acá vivía el caché del resumen de Clarity, que se fue el 06/10/2026.)
//  5. El visitante y la última actividad de un lead, para sus grabaciones: la
//     ficha del CRM lo arma inline en app/crm/actions.ts.
//
// Todo pasa por getTenantDb() / settings: corre adentro de runWithWorkspace(ctx.ws).
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { getSettingEstricto, setSetting, getSetting } from '@/lib/settings';
import { credWs } from '@/lib/credenciales';
import { CONFIG_KEY, parsearConfig, type LandingConfig } from '@/lib/landing-config';
import { PAGINAS_KEY, parsearPaginas } from '@/lib/landing-paginas';
import { VIDEOS_KEY, VIDEOS_OCULTOS_KEY, parsearVideos, parsearOcultos, type VideoLanding } from '@/lib/landing-videos';
import { LANDING_TOKEN_KEY } from '@/lib/landing-token';
import type { LandingAnalysisRow } from '@/lib/landing-analyst';
import type { LandingDraft } from '@/lib/landing-writer';
import { programarAnalisisDeclaradas } from '@/lib/landing-analyst-auto';

// ── 1. Las listas del negocio ────────────────────────────────────────────────

/** Las landings declaradas, con la MISMA migración perezosa que la action: si el
 *  formato nuevo está vacío, se leen las páginas del viejo. Sin esto, un negocio
 *  que nunca guardó en el formato nuevo se ve sin landings. */
export async function leerLandings(): Promise<{ landings: LandingConfig[]; formato: 'nuevo' | 'viejo' }> {
  const nuevo = parsearConfig(await getSettingEstricto(CONFIG_KEY));
  if (nuevo.length) return { landings: nuevo, formato: 'nuevo' };
  const viejo = parsearConfig(JSON.stringify(parsearPaginas(await getSettingEstricto(PAGINAS_KEY))));
  return { landings: viejo, formato: 'viejo' };
}

export async function escribirLandings(lista: LandingConfig[]): Promise<void> {
  await setSetting(CONFIG_KEY, JSON.stringify(lista));
  // Una página que MaKo declara se analiza sola, igual que desde la pantalla.
  await programarAnalisisDeclaradas();
}

export async function leerVideosEstricto(): Promise<VideoLanding[]> {
  return parsearVideos(await getSettingEstricto(VIDEOS_KEY));
}

export async function escribirVideos(lista: VideoLanding[]): Promise<void> {
  await setSetting(VIDEOS_KEY, JSON.stringify(lista));
}

export async function leerOcultosEstricto(): Promise<string[]> {
  return parsearOcultos(await getSettingEstricto(VIDEOS_OCULTOS_KEY));
}

export async function escribirOcultos(lista: string[]): Promise<void> {
  await setSetting(VIDEOS_OCULTOS_KEY, JSON.stringify(lista));
}

/** El token del Pixel SIN acuñarlo. getOrCreateLandingToken escribe la primera
 *  vez (y espeja webhook_routing): una lectura no puede hacer eso. */
export async function tokenPixelExistente(): Promise<string | null> {
  return (await getSettingEstricto(LANDING_TOKEN_KEY))?.trim() || null;
}

/** ¿El Pixel vio alguna vez este video? Conteo exacto, sin traer filas. */
export async function videoVisto(id: string): Promise<boolean> {
  const db = await getTenantDb();
  const { count, error } = await db.from('vsl_events').select('*', { count: 'exact', head: true }).eq('video_id', id);
  if (error) throw new Error(`api-mako: videoVisto falló: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function pandaConectado(): Promise<boolean> {
  const k = (await credWs('PANDA_API_KEY').catch(() => null))?.trim();
  return !!k && !k.startsWith('PENDING');
}

// ── 2. Los diagnósticos (Landing Generator → Diagnóstico; el módulo sigue siendo lib/landing-analyst)

const COLS_DIAG =
  'url, url_final, titulo, status, score, veredicto, veredicto_tone, resumen, promesa, avatar, ' +
  'secciones, hallazgos, dims, recomendaciones, comportamiento, palabras, bloqueada, error, model, analyzed_at';

/** El diagnóstico de UNA url, ya normalizada con lib/landing-fetch (la identidad de
 *  landing_analyses: sin query y sin www). null si nunca se analizó. */
export async function analisisDe(urlNormalizada: string): Promise<LandingAnalysisRow | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_analyses').select(COLS_DIAG).eq('url', urlNormalizada).maybeSingle();
  if (error) throw new Error(`api-mako: analisisDe falló: ${error.message}`);
  if (!data) return null;
  const fila = data as unknown as LandingAnalysisRow;
  // PostgREST serializa NUMERIC como string.
  const n = Number(fila.score);
  return { ...fila, score: fila.score != null && Number.isFinite(n) ? n : null };
}

export type AnalisisCompacto = { url: string; titulo: string | null; status: string; score: number | null; veredicto: string | null; error: string | null; analyzed_at: string | null };

/** TODOS los diagnósticos (incluidos los que fallaron), compactos. Una fila por URL
 *  declarada o analizada: no llega a los 1000 de PostgREST, y se dice si llegara. */
export async function listarAnalisisCompacto(): Promise<{ filas: AnalisisCompacto[]; recortado: boolean }> {
  const db = await getTenantDb();
  const TOPE = 500;
  const { data, error } = await db.from('landing_analyses')
    .select('url, titulo, status, score, veredicto, error, analyzed_at')
    .order('analyzed_at', { ascending: false, nullsFirst: false })
    .limit(TOPE);
  if (error) throw new Error(`api-mako: listarAnalisisCompacto falló: ${error.message}`);
  const filas = ((data ?? []) as Array<AnalisisCompacto & { score: unknown }>).map((f) => {
    const n = Number(f.score);
    return { ...f, score: f.score != null && Number.isFinite(n) ? n : null };
  });
  return { filas, recortado: filas.length >= TOPE };
}

// ── 3. Una versión guardada del Landing Generator ───────────────────────────

export async function borradorPorId(id: number): Promise<LandingDraft | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('landing_drafts')
    .select('id, pedido, objetivo, basado_en_url, spec, titulo, created_at').eq('id', id).maybeSingle();
  if (error) throw new Error(`api-mako: borradorPorId falló: ${error.message}`);
  return (data as unknown as LandingDraft | null) ?? null;
}

// ── 5. El visitante de un lead ──────────────────────────────────────────────

/** El visitor_id del lead y su ÚLTIMA actividad en la landing (el evento más
 *  nuevo; sin eventos, el alta del lead: el mismo criterio que la ficha). */
export async function visitaDeLead(leadId: number): Promise<{ existe: boolean; visitorId: string | null; ultimaActividad: string | null }> {
  const db = await getTenantDb();
  const { data, error } = await db.from('leads').select('id, visitor_id, created_at').eq('id', leadId).maybeSingle();
  if (error) throw new Error(`api-mako: visitaDeLead falló: ${error.message}`);
  if (!data) return { existe: false, visitorId: null, ultimaActividad: null };
  const lead = data as { visitor_id: string | null; created_at: string | null };
  const vid = lead.visitor_id?.trim() || null;
  if (!vid) return { existe: true, visitorId: null, ultimaActividad: lead.created_at };
  const [ev, vi] = await Promise.all([
    db.from('vsl_events').select('created_at').eq('visitor_id', vid).order('created_at', { ascending: false }).limit(1),
    db.from('landing_visits').select('created_at').eq('visitor_id', vid).order('created_at', { ascending: false }).limit(1),
  ]);
  const fechas = [
    (ev.data?.[0] as { created_at?: string } | undefined)?.created_at,
    (vi.data?.[0] as { created_at?: string } | undefined)?.created_at,
  ].filter((x): x is string => !!x).sort();
  return { existe: true, visitorId: vid, ultimaActividad: fechas.at(-1) ?? lead.created_at };
}
