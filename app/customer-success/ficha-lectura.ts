import 'server-only';

// =============================================================================
// ficha-lectura — lo que el Resumen y las Llamadas de cada cliente necesitan leer
// =============================================================================
// DOS lecturas para la cartera ENTERA, en paralelo, y no una por cliente al abrir la
// ficha: es la regla de esta pantalla (ver `filasDeTodos` en ./trabajo.ts). Un modal que
// consulta al abrirse tiene estado de carga por más rápida que sea la consulta.
//
// ⚠️ NO VA EN `clientesGanados` (lib/clientes-ganados.ts), que sería el lugar obvio. Esa
// lista la usan también los pickers del tablero (`/plan`, `/plan/agencia`), y su propio
// comentario explica por qué enumera columnas: no bajarle teléfono, montos ni historial a
// una pantalla que sólo quiere catorce nombres. El teléfono, la plata y los links de las
// grabaciones son de ESTA pantalla y se leen acá.
//
// ⚠️ Y CADA LECTURA FALLA POR SU CUENTA. Si la de leads se cae, las llamadas igual se
// pueden mostrar, y al revés; lo que no se pudo leer viaja como `null` (ver `FichaExtra`),
// nunca como un vacío que afirme «no tiene».

import { getTenantDb } from '@/lib/workspace';
import { leerTodo } from '@/lib/supabase-paginado';
import { analisisDeFila, type FilaAnalisisEntrega } from '@/lib/closing-entrega-contrato';
import { llamadasDe, type ContactoFicha, type FilaGrabacion, type LlamadaCliente } from './ficha-datos';

type FilaLead = {
  id: number;
  telefono: string | null;
  web: string | null;
  foto_auto_url: string | null;
  fathom_links: unknown;
  fecha_junta_1: string | null;
  fecha_junta_2: string | null;
};

type FilaClosing = Omit<FilaGrabacion, 'analisis'> & FilaAnalisisEntrega & { recording_id: number; lead_id: number };

const tandas = <T,>(xs: readonly T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

/** `fathom_links` es `jsonb`: se valida la forma en vez de confiar en el tipo. */
const linksDe = (v: unknown): Array<{ label: string | null; url: string | null }> =>
  Array.isArray(v)
    ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({
          label: typeof x.label === 'string' ? x.label : null,
          url: typeof x.url === 'string' ? x.url : null,
        }))
    : [];

export type LecturaFicha = {
  contacto: Record<number, ContactoFicha> | null;
  llamadas: Record<number, LlamadaCliente[]> | null;
};

/**
 * Contacto, plata y llamadas de los clientes ganados del workspace.
 *
 * Las mismas filas que `clientesGanados` (`estado_lead = 'ganado'`, paginado por `id`): un
 * universo distinto dejaría a un cliente de la grilla sin su Resumen, o leería de más.
 */
export async function lecturaDeFichas(leadIds: readonly number[]): Promise<LecturaFicha> {
  if (!leadIds.length) return { contacto: {}, llamadas: {} };
  const db = await getTenantDb();
  const ids = [...new Set(leadIds)];

  const [leads, grabaciones] = await Promise.all([
    leerTodo<FilaLead>(db, 'leads',
      'id, telefono, web, foto_auto_url, fathom_links, fecha_junta_1, fecha_junta_2',
      { orden: 'id', eq: { estado_lead: 'ganado' } })
      .catch((e) => { console.error('[cs-ficha] no pude leer los leads:', e instanceof Error ? e.message : e); return null; }),
    // ⚠️ `test` AFUERA y nada más: es la única categoría que el propio Closing Analyst
    // declara que no es una llamada de verdad. Las de `entrega_servicio` son justo las que
    // esta tab existe para mostrar.
    //
    // De a TANDAS de ids: un `.in()` viaja en la URL, y una cartera grande la haría pasar
    // el tope del servidor — que contesta un error de la consulta entera, no la mitad.
    //
    // ⚠️ `summary`, `riesgos` y `proximos_pasos` son el análisis de las sesiones de ENTREGA
    // (#107, mig 0209 — se aplica ANTES del deploy: con una columna que no existe PostgREST
    // rechaza la consulta entera y la pestaña diría «No pude leer sus llamadas» a todos).
    // Viajan con el HTML como el resto de la ficha; los topes del saneo acotan cuánto pesan.
    Promise.all(tandas(ids, 150).map((tanda) => leerTodo<FilaClosing>(db, 'closing_analyses',
      'recording_id, lead_id, title, call_date, started_at, duration_min, share_url, call_url, category, ' +
      'status, analysis_version, summary, riesgos, proximos_pasos',
      { orden: 'recording_id', filtros: (q) => q.in('lead_id', tanda).neq('category', 'test') })))
      .then((xs) => xs.flat())
      .catch((e) => { console.error('[cs-ficha] no pude leer las grabaciones:', e instanceof Error ? e.message : e); return null; }),
  ]);

  const quiero = new Set(ids);
  const contacto: Record<number, ContactoFicha> | null = leads ? {} : null;
  const crudos = new Map<number, FilaLead>();
  for (const l of leads ?? []) {
    const id = Number(l.id);
    if (!quiero.has(id)) continue;
    crudos.set(id, l);
    contacto![id] = {
      telefono: l.telefono?.trim() || null,
      web: l.web?.trim() || null,
      fotoGuardada: l.foto_auto_url?.trim() || null,
    };
  }

  // ⚠️ LAS LLAMADAS NECESITAN LAS DOS LECTURAS. Sin la de leads no hay `fathom_links` ni la
  // fecha de cada reunión, y una lista armada sólo con la otra mitad se leería como completa.
  let llamadas: Record<number, LlamadaCliente[]> | null = null;
  if (leads && grabaciones) {
    const porLead = new Map<number, FilaGrabacion[]>();
    for (const g of grabaciones) {
      const id = Number(g.lead_id);
      // El análisis sale SANEADO de acá (el `jsonb` se valida, no se confía en el tipo) y
      // sólo para una sesión de entrega analizada: las tres condiciones del contrato.
      const fila: FilaGrabacion = {
        title: g.title, call_date: g.call_date, started_at: g.started_at, duration_min: g.duration_min,
        share_url: g.share_url, call_url: g.call_url, category: g.category,
        analisis: analisisDeFila(g),
      };
      (porLead.get(id) ?? porLead.set(id, []).get(id)!).push(fila);
    }
    llamadas = {};
    for (const id of ids) {
      const l = crudos.get(id);
      llamadas[id] = llamadasDe({
        grabaciones: porLead.get(id) ?? [],
        links: linksDe(l?.fathom_links),
        fechaJ1: l?.fecha_junta_1 ?? null,
        fechaJ2: l?.fecha_junta_2 ?? null,
      });
    }
  }

  return { contacto, llamadas };
}
