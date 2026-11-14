// =============================================================================
// piezas-web — las landings publicadas del Web Generator como fuentes del lead entrante (server, 14/11/2026)
// =============================================================================
// La regla pura y por qué existe: lib/editor-landing/piezas.ts. Acá, lo que toca la base:
//   · `landingsConPiezas()`: las landings PUBLICADAS del negocio, cada una con sus piezas (formularios, encuestas, quizzes,
//     agendas y pagos) por nombre. Las lee de la foto publicada (`publicado.piezas`, desde el 14/11); una publicada antes no
//     las trae y se calculan del contenido guardado (sus formularios tienen el id derivado de validar.ts, el mismo que
//     sale al publicar de nuevo).
//   · `asignacionesDelNegocio()` / `asignarPieza()`: el ajuste `landing.piezas` (qué pieza entra a qué CRM).
//   · `crmsDelOptin()`: lo que mira /api/track/optin ANTES de la URL.
// =============================================================================
import 'server-only';
import { getSetting, setSetting } from './settings';
import { getTenantDb, getWorkspaceActual } from './workspace';
import { leerTodo, type ConsultaPaginada } from './supabase-paginado';
import { urlPublicaLanding } from './app-url';
import { listarFunnels } from './funnels';
import { sanearContenido } from './editor-landing/validar';
import {
  CLAVE_AJUSTE_PIEZAS, ajusteDePiezas, asignacionesDe, conAsignacion, crmsDePieza, piezasDeContenido, piezasGuardadas,
  type AsignacionesPiezas, type PiezaWeb,
} from './editor-landing/piezas';

export type LandingConPiezas = { docId: number; titulo: string; url: string | null; piezas: PiezaWeb[] };

type Fila = { id: number; titulo: string | null; slug: string | null; dominio: string | null; piezas: unknown; plantilla: unknown; papelera_at: string | null };

/**
 * Las landings publicadas del negocio actual (sin las de la papelera), con sus piezas. Las que no traen ninguna, también.
 * ⚠️ SÓLO `publicado->piezas`, no la foto: la foto lleva el HTML de TODAS las páginas, y esto se lee cada vez que se abre
 * «Asignar fuentes» o el CRON «Formulario». El contenido se pide aparte y sólo de las publicadas antes del 14/11 (sin piezas).
 */
export async function landingsConPiezas(): Promise<LandingConPiezas[]> {
  const ws = await getWorkspaceActual();
  if (ws == null) return [];
  const db = await getTenantDb();
  const filas = (await leerTodo<Fila>(db, 'landing_docs', 'id, titulo, slug, dominio, piezas:publicado->piezas, plantilla:config->origen->>plantilla, papelera_at', {
    eq: { workspace_id: ws }, orden: 'id', filtros: (q) => q.not('publicado_at', 'is', null) as unknown as ConsultaPaginada,
  })).filter((f) => !f.papelera_at);
  const sinPiezas = filas.filter((f) => !Array.isArray(f.piezas)).map((f) => f.id);
  const contenidos = new Map<number, unknown>();
  for (let i = 0; i < sinPiezas.length; i += 50) {
    const tanda = sinPiezas.slice(i, i + 50);
    const { data, error } = await db.from('landing_docs').select('id, contenido').in('id', tanda);
    if (error) throw new Error(`No pude leer el contenido de las landings: ${error.message}`);
    for (const r of (data ?? []) as Array<{ id: number; contenido: unknown }>) contenidos.set(Number(r.id), r.contenido);
  }
  return filas.map((f) => {
    const titulo = (f.titulo ?? '').trim() || 'Landing';
    const piezas = Array.isArray(f.piezas)
      ? piezasGuardadas(f.piezas)
      : piezasDeContenido(f.id, titulo, sanearContenido(contenidos.get(f.id)).contenido, typeof f.plantilla === 'string' ? f.plantilla : null);
    const url = f.dominio ? `https://${f.dominio}` : f.slug ? urlPublicaLanding(f.slug) : null;
    return { docId: f.id, titulo, url, piezas };
  });
}

/** Lo asignado por el negocio actual. Ilegible = nada asignado (el opt-in sigue con la URL, como antes). */
export async function asignacionesDelNegocio(): Promise<AsignacionesPiezas> {
  return asignacionesDe(await getSetting(CLAVE_AJUSTE_PIEZAS).catch(() => null));
}

/**
 * Prende o apaga un CRM para una pieza del negocio actual. Valida que el CRM exista en este negocio (un id de otro no se
 * guarda). Devuelve lo asignado después del cambio.
 */
export async function asignarPieza(clave: string, funnelId: number, prendido: boolean): Promise<AsignacionesPiezas> {
  if (prendido) {
    const funnels = await listarFunnels();
    if (!funnels.some((f) => f.id === funnelId)) throw new Error('Ese CRM no existe en este negocio.');
  }
  const antes = await asignacionesDelNegocio();
  const despues = conAsignacion(antes, clave, funnelId, prendido);
  await setSetting(CLAVE_AJUSTE_PIEZAS, ajusteDePiezas(despues));
  return despues;
}

/**
 * Los CRM de un opt-in según lo asignado (adentro de `runWithWorkspace`), con el formato de `funnelsDeLanding`: el funnel
 * PRINCIPAL del negocio va como null (así lo escribe `casaParaEscribir`). [] = nada asignado: sigue la URL.
 */
export async function crmsDelOptin(e: Parameters<typeof crmsDePieza>[1]): Promise<{ clave: string; funnels: Array<number | null> } | null> {
  const r = crmsDePieza(await asignacionesDelNegocio(), e);
  if (!r) return null;
  const vivos = await listarFunnels().catch(() => []);
  const out: Array<number | null> = [];
  for (const id of r.funnels) {
    const f = vivos.find((x) => x.id === id);
    if (!f) continue;
    const valor = f.esDefault ? null : id;
    if (!out.includes(valor)) out.push(valor);
  }
  return out.length ? { clave: r.clave, funnels: out } : null;
}

/**
 * El CRM de un pago desde un «Botón de pago» de una landing (adentro de `runWithWorkspace`): si la página del botón que cobra
 * ese producto está asignada («Asignar fuentes», `pago:<docId>:<paginaId>`), su CRM; si no, undefined (y sigue la URL, como
 * siempre). El CRM del negocio va como null, igual que `funnelPrincipalDeLanding`.
 */
export async function crmDePago(docId: number, productoId?: number): Promise<number | null | undefined> {
  try {
    const db = await getTenantDb();
    // Sólo las piezas de la foto, no la foto (lleva el HTML de todas las páginas).
    const { data, error } = await db.from('landing_docs').select('piezas:publicado->piezas').eq('id', docId).maybeSingle();
    if (error || !data) return undefined;
    const piezas = piezasGuardadas((data as { piezas?: unknown }).piezas)
      // Con el producto, la página del botón que lo cobra; sin él, cualquier página de pago de la landing (casi siempre hay una).
      .filter((p) => p.tipo === 'pago' && (productoId == null || p.productoId === productoId));
    if (!piezas.length) return undefined;
    const asignadas = await asignacionesDelNegocio();
    const ids = piezas.flatMap((p) => asignadas[p.clave] ?? []);
    if (!ids.length) return undefined;
    const vivos = await listarFunnels().catch(() => []);
    const f = vivos.find((x) => x.id === ids[0]);
    if (!f) return undefined;
    return f.esDefault ? null : f.id;
  } catch {
    return undefined;
  }
}
