// =============================================================================
// POST /api/copywriter — los guiones del Copywriter: listar, abrir, crear, guardar, renombrar, mover, Papelera
// =============================================================================
// Diseño: docs/diseno-copywriter.md (D4). El trabajo vive en lib/copywriter/server.ts; acá, la puerta y el pase de
// campos (una `accion` por operación, como /api/landing-generator).
//
// LA PUERTA son DOS cortes y los dos hacen falta (AGENTS.md, «Un flag de visibilidad protege la PANTALLA; la API hay
// que cerrarla aparte»): `soloAdminDeTab('copywriter')` (el admin del negocio con la tab en su capa, el mismo corte que
// `requireRolWs` de la página) y `veCopywriter()` (hoy, sólo el super admin: app/copywriter/acceso.ts). A quien no le
// corresponde, 404: la tab no existe.
// =============================================================================

import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { veCopywriter } from '@/app/copywriter/acceso';
import { abrir, crear, guardar, listar, mover, papelera, renombrar, restaurar } from '@/lib/copywriter/server';
import { esTipoGuion } from '@/lib/copywriter/tipos';
import { listFiles } from '@/lib/archivero';
import { getUsuarioActual } from '@/lib/auth';
import { nombreDeVisita } from '@/lib/copywriter/editado';
import { leerOutliersCopy, outlierCopyPorId, replicarOutlier } from '@/lib/copywriter/outliers-servidor';
import { consultaDeTanda, tandaDeOutliersCopy } from '@/lib/copywriter/outliers';

export const dynamic = 'force-dynamic';

const falla = (status: number, error: string) => Response.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });

/** La respuesta de una operación: la falla con su código (el `status` no viaja en el cuerpo; un 409 lleva `conflicto`,
 *  que es lo que la pantalla necesita para ofrecer «Recargar» en vez de «Reintentar»). */
function responder(r: { ok: true } | { ok: false; error: string; status: number }): Response {
  if (!r.ok) {
    if (r.status === 409) return Response.json({ ok: false, error: r.error, conflicto: true }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    return falla(r.status, r.error);
  }
  return Response.json(r, { headers: { 'Cache-Control': 'no-store' } });
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '');

export async function POST(req: Request) {
  const cerrada = await soloAdminDeTab('copywriter');
  if (cerrada) return cerrada;
  if (!(await veCopywriter())) return falla(404, 'No existe');

  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return falla(400, 'Pedido inválido'); }
  if (!b || typeof b !== 'object') return falla(400, 'Pedido inválido');

  try {
    switch (b.accion) {
      case 'listar':
        return responder(await listar());
      case 'abrir':
        return responder(await abrir(texto(b.id)));
      case 'crear': {
        if (!esTipoGuion(b.tipo)) return falla(400, 'Falta el tipo de guion');
        return responder(await crear({
          tipo: b.tipo,
          titulo: texto(b.titulo),
          padre: typeof b.padre === 'string' ? b.padre : null,
          posicion: typeof b.posicion === 'number' ? b.posicion : undefined,
          props: b.props && typeof b.props === 'object' ? b.props as Record<string, unknown> : undefined,
          contenido: b.contenido && typeof b.contenido === 'object' ? b.contenido as never : undefined,
          emoji: typeof b.emoji === 'string' ? b.emoji : null,
        }));
      }
      case 'guardar': {
        if (!Number.isInteger(b.version)) return falla(400, 'Falta la versión');
        // La marca de quién guardó (D9): desde la tab, el usuario de la sesión. Es la que tapa la de alguien de afuera.
        const yo = await getUsuarioActual();
        const por = nombreDeVisita(yo?.nombre) ?? nombreDeVisita(yo?.email) ?? 'El equipo';
        return responder(await guardar({ id: texto(b.id), version: b.version as number, contenido: b.contenido, props: b.props }, { por, afuera: false }));
      }
      case 'renombrar':
        return responder(await renombrar(texto(b.id), {
          ...(typeof b.titulo === 'string' ? { titulo: b.titulo } : {}),
          ...(b.emoji === null || typeof b.emoji === 'string' ? { emoji: b.emoji as string | null } : {}),
        }));
      case 'mover':
        return responder(await mover(texto(b.id), typeof b.padre === 'string' ? b.padre : null, typeof b.posicion === 'number' ? b.posicion : Number.MAX_SAFE_INTEGER));
      case 'papelera':
        return responder(await papelera(texto(b.id)));
      case 'restaurar':
        return responder(await restaurar(texto(b.id)));
      // Lo que se puede citar con «@» además de los guiones (que la pantalla ya tiene): los archivos de El Archivero.
      // Sólo id y nombre; lo que El Archivero sacó de cada uno se lee al mandar (lib/copywriter/referencias.ts).
      // Los outliers de copy (D18): «Replicar» crea la página que replica uno; `outlier` es el original entero («Ver el original»).
      // Los dos leen en el negocio de la pestaña: una pieza de Spy de otro negocio no se encuentra.
      case 'replicar':
        return responder(await replicarOutlier(texto(b.outlier)));
      // La portada por tandas (13/11/2026): la página trae la primera; las demás (al bajar, con «Ver más» o con otro filtro) salen
      // de acá, filtradas y ordenadas con la misma función que usa la pantalla (lib/copywriter/outliers.ts, `tandaDeOutliersCopy`).
      case 'outliers': {
        const portada = await leerOutliersCopy();
        return responder({ ok: true as const, ...tandaDeOutliersCopy(portada.outliers, consultaDeTanda(b)) });
      }
      case 'outlier': {
        const o = await outlierCopyPorId(texto(b.outlier));
        const leido = { ok: true as const, outlier: o };
        return o ? responder(leido) : falla(404, 'Ese original ya no está.');
      }
      case 'citables': {
        const archivos = await listFiles().then(
          (fs) => ({ ok: true as const, archivos: fs.map((f) => ({ id: f.id, nombre: f.nombre })) }),
          (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e), status: 500 }),
        );
        return responder(archivos);
      }
      default:
        return falla(400, 'Acción desconocida');
    }
  } catch (err) {
    console.error(`[copywriter:${String(b.accion ?? '?')}]`, err instanceof Error ? err.message : err);
    return falla(500, 'Algo falló. Vuelve a intentar.');
  }
}
