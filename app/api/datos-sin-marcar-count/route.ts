// =============================================================================
// GET /api/datos-sin-marcar-count — total de "datos sin marcar" para el badge
// del CRM (rediseño). Es el MISMO universo que la lista "Datos sin marcar"
// (getPendientesDeMarcar), no la cola de acción completa.
// =============================================================================

import { getPendientesDeMarcar } from '@/lib/queries';
import { hoyEnTijuana } from '@/lib/date-utils';
import { getTenantDb } from '@/lib/workspace';
import { urlGravatar } from '@/lib/gravatar';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Cuántos LEADS dibuja «A revisar». La cola entera sigue en su vista (`/crm?pendientes=1`). */
const TOPE_LISTA = 12;

type Paso = { id: string; label: string };

/**
 * Lo que hace falta para dibujar la cara del lead, con la MISMA cadena que la cabecera de su ficha
 * (app/crm/lead-view/CaraDelLead.tsx): lo elegido → la foto guardada → Gravatar → iniciales.
 */
type Cara = { icono: string | null; avatarUrl: string | null; avatarY: number | null; fotoGuardada: string | null; fotoEmail: string | null };

/**
 * Una fila de «A revisar»: UN LEAD, con todos sus datos sin marcar (14/10/2026, Martín: «No pongas
 * muchas filas del mismo lead, en todo caso un número de cuantos datos sin revisar tiene»). Hasta el
 * 13/10 era una fila por dato, y un lead con cinco datos ocupaba cinco renglones. `pasos` vacío es
 * el lead que está en la lista por otra cosa (una nutrición manual vencida, la reunión pasada sin
 * desenlace): se abre la ficha y no hay nada que ignorar.
 *
 * `porOtraCosa` es ese mismo caso CON datos (tipo 'R' y 'M' del worklist): ignorar sus datos no lo
 * saca de la lista, y la pantalla no lo puede deducir. Sin la marca, la ✕ lo borraba de la vista y
 * la relectura lo traía de vuelta un segundo después.
 */
type FilaLead = { lead_id: number; lead_nombre: string; pasos: Paso[]; cara?: Cara; porOtraCosa?: true };

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function GET(req: Request) {
  try {
    const { total, items, ignorados } = await getPendientesDeMarcar(hoyEnTijuana());
    // `?lista=1`: también los primeros, para resolverlos SIN IR A OTRA TAB (tercer feedback del
    // 12/10/2026, punto 4: «A revisar» abre la ficha en el lugar). Sin el parámetro, el conteo
    // de siempre: lo pide el Sidebar en cada página y no necesita nombres.
    if (new URL(req.url).searchParams.get('lista') === '1') {
      // `total` cuenta LEADS (un item por lead) y las filas también: el número del panel y lo
      // que se ve abajo hablan de lo mismo.
      const filas: FilaLead[] = [];
      for (const i of items ?? []) {
        if (filas.length >= TOPE_LISTA) break;
        filas.push({
          lead_id: i.lead_id, lead_nombre: i.lead_nombre, pasos: (i.faltantes ?? []).map((f) => ({ id: f.id, label: f.label })),
          ...(i.tipo === 'R' || i.tipo === 'M' ? { porOtraCosa: true as const } : {}),
        });
      }
      // Los ignorados llegan UNO POR DATO (lib/queries.ts los topea en 50): se juntan por lead, en
      // el orden en que aparecen, para el «Ver más» y su «volver a avisar» por lead.
      const ocultos: FilaLead[] = [];
      for (const x of ignorados ?? []) {
        const ya = ocultos.find((o) => o.lead_id === x.lead_id);
        if (ya) { if (!ya.pasos.some((p) => p.id === x.paso.id)) ya.pasos.push({ id: x.paso.id, label: x.paso.label }); continue; }
        if (ocultos.length >= TOPE_LISTA) continue;
        ocultos.push({ lead_id: x.lead_id, lead_nombre: x.lead_nombre, pasos: [{ id: x.paso.id, label: x.paso.label }] });
      }
      await ponerCaras([...filas, ...ocultos]);
      return Response.json({ total, items: filas, ignorados: ocultos });
    }
    return Response.json({ total });
  } catch (err) {
    console.error('[datos-sin-marcar-count]', err instanceof Error ? err.message : err);
    return Response.json({ total: 0 });
  }
}

/**
 * La foto de cada fila: UNA lectura más, sólo de los leads que se van a dibujar (≤ 24), DESPUÉS de
 * armar las filas. `getPendientesDeMarcar` no trae estas columnas y no se tocan: es la lectura del
 * worklist entero, cacheada, y la comparten el Sidebar, /hoy y los avisos de MaKo.
 *
 * ⚠️ EL GRAVATAR SE ARMA ACÁ, no en el navegador: el hash usa `node:crypto` (lib/gravatar.ts), y es
 * el mismo reparto que la ficha (app/crm/[id]/page.tsx le pasa `fotoEmail` ya armado).
 *
 * Si la lectura falla, las filas salen sin cara y se dibujan las iniciales: la lista no se cae
 * por una foto.
 */
async function ponerCaras(filas: FilaLead[]): Promise<void> {
  const ids = [...new Set(filas.map((f) => f.lead_id))];
  if (!ids.length) return;
  try {
    const db = await getTenantDb();
    const { data, error } = await db.from('leads').select('id, icono, avatar_url, avatar_y, foto_auto_url, email').in('id', ids);
    if (error) { console.error('[datos-sin-marcar-count] caras', error.message); return; }
    const porId = new Map<number, Cara>();
    for (const l of (data ?? []) as Array<Record<string, unknown>>) {
      const email = texto(l.email);
      const y = l.avatar_y == null ? NaN : Number(l.avatar_y);
      porId.set(Number(l.id), {
        icono: texto(l.icono),
        avatarUrl: texto(l.avatar_url),
        avatarY: Number.isFinite(y) ? y : null,
        fotoGuardada: texto(l.foto_auto_url),
        fotoEmail: email ? urlGravatar(email, 64) : null,
      });
    }
    for (const f of filas) { const c = porId.get(f.lead_id); if (c) f.cara = c; }
  } catch (e) {
    console.error('[datos-sin-marcar-count] caras', e instanceof Error ? e.message : e);
  }
}
