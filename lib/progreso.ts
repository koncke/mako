import 'server-only';

// =============================================================================
// Progreso del Centro de Operaciones — las lecturas (Vercel y las bitácoras)
// =============================================================================
// Las reglas viven en lib/progreso-reglas.ts. Acá sólo se lee:
//   · las bitácoras de /admin/dev, que viajan DENTRO del build (no hay red: es el código desplegado);
//   · la lista de deployments de producción de Vercel, con el token que producción ya tiene
//     (`VERCEL_API_TOKEN`, el mismo que usa lib/editor-landing/dominios.ts).
//
// ⚠️ Ninguna depende del cartero ni del token del Centro: «En curso», «Pedidos» y «Pushes» tienen
// datos desde el primer minuto. Lo que suma el cartero (los chats vivos y lo que está sin subir en la
// PC) va encima, cuando esté instalado.
// ⚠️ La lista de commits de CADA push necesita GitHub, y el token de GitHub de la plataforma no ve el
// repo desde que pasó a `hola-mako` (medido el 15/10/2026: 404). Por eso un push dice su commit y su
// mensaje, no la lista entera: docs/hallazgos-operaciones.md.

import { REGISTROS_SLUGS, registroDe } from '@/app/admin/dev/registros';
import { AREAS } from '@/app/admin/dev/areas';
import { pushesDeVercel, type AreaP, type PushP } from './progreso-reglas';

/** Todas las áreas con bitácora, con su nombre de /admin/dev. */
export function areasDeProgreso(): AreaP[] {
  return REGISTROS_SLUGS.map((slug) => ({
    slug,
    titulo: AREAS.find((a) => a.slug === slug)?.titulo ?? slug,
    verEnApp: AREAS.find((a) => a.slug === slug)?.verEnApp ?? null,
    bitacora: registroDe(slug).bitacora,
  }));
}

export type LecturaPushes = { ok: true; pushes: PushP[] } | { ok: false; motivo: string };

/** Los últimos pushes a producción. Si Vercel no contesta, lo dice (nunca una lista vacía que parezca «no hubo»). */
export async function leerPushes(limite = 30): Promise<LecturaPushes> {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const equipo = process.env.VERCEL_TEAM_SLUG?.trim();
  const proyecto = process.env.VERCEL_PROJECT_ID?.trim() || 'mako';
  if (!token) return { ok: false, motivo: 'Falta el token de Vercel en el servidor.' };
  const q = new URLSearchParams({ projectId: proyecto, target: 'production', limit: String(limite) });
  if (equipo) q.set('slug', equipo);
  try {
    const r = await fetch(`https://api.vercel.com/v6/deployments?${q}`, {
      headers: { authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return { ok: false, motivo: `Vercel contestó ${r.status}.` };
    const j = (await r.json()) as { deployments?: Record<string, unknown>[] };
    return { ok: true, pushes: pushesDeVercel(j.deployments ?? []) };
  } catch {
    return { ok: false, motivo: 'Vercel no contestó a tiempo.' };
  }
}
