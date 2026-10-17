// =============================================================================
// GET /api/flujos/opciones — con qué se llenan los controles del paso «⚡ Acción»
// =============================================================================
// Tercera tanda (09/10/2026, punto 16): «Le puse "Mover un lead de etapa" y me pide un campo abierto
// para colocar el nombre de la etapa? En lugar de un desplegable…». Cada parámetro que es un id del
// negocio se ELIGE (lib/editor-acciones.ts → `controlDe`), y esto trae las listas: los productos con
// las etapas de su kanban (y qué pide mover a cada una), los nombres asignables del equipo y las
// automatizaciones del negocio. Las etiquetas no: ésas ya las trae `SelectorEtiqueta`.
//
// ⚠️ CADA LISTA EN `null` QUIERE DECIR «NO SE PUDO LEER», no «no hay» (AGENTS.md). El editor lo dice y
// conserva lo puesto; con `[]` ofrecería un desplegable vacío que se lee como que el negocio no tiene.
// Sólo el admin del workspace, como el catálogo de acciones (app/api/flujos/acciones/route.ts).
// =============================================================================

import { getRolWsEfectivo, getWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { leerFunnels, getFunnelDe, getFunnelDefault } from '@/lib/funnels';
import { nombreVisible } from '@/lib/lead-funnel-reglas';
import { nombresAsignables } from '@/lib/api-mako/areas/crm.helpers';
import { datosQuePideLaEtapa, type OpcionesAccion, type ProductoDeAccion, type SecuenciaDeAccion, type CursoDeAccion } from '@/lib/editor-acciones';
import { listProductos } from '@/lib/productos';

/** Los productos del CRM con TODAS las etapas de su kanban, incluidas las salidas (perdido, descalificado). */
async function productos(): Promise<ProductoDeAccion[] | null> {
  const funnels = await leerFunnels();
  if (!funnels) return null;
  const out: ProductoDeAccion[] = [];
  for (const f of funnels) {
    // El default por `getFunnelDefault`, el resto por id: el mismo camino que `productosConEtapas`
    // (lib/setting-secuencias.ts). Son pocas filas y se piden una vez por editor.
    const cfg = f.esDefault ? await getFunnelDefault() : await getFunnelDe(f.id);
    // Una lectura fallida devuelve el pipeline de FÁBRICA: ofrecerlo sería ofrecer etapas que este
    // negocio quizás no tiene (AGENTS.md: una lectura que cae al default sirve para dibujar, no para decidir).
    if (cfg.origen === 'error') return null;
    out.push({
      embudoId: f.id, nombre: nombreVisible(f), esDefault: f.esDefault,
      etapas: cfg.stages.map((st) => ({ value: st.key, label: st.label, pide: datosQuePideLaEtapa(cfg.stages, st.key) })),
    });
  }
  return out;
}

/** Los cursos (#874): los productos con al menos una clase viva, con su nombre del catálogo. */
async function cursos(): Promise<CursoDeAccion[] | null> {
  const db = await getTenantDb();
  const [{ data: clases, error }, catalogo] = await Promise.all([
    db.from('curso_clases').select('producto_id').is('borrada_at', null).limit(5000),
    listProductos(false),
  ]);
  if (error) return null;
  const conClases = new Set(((clases ?? []) as Array<{ producto_id: number | null }>).map((c) => Number(c.producto_id)).filter((n) => n > 0));
  return catalogo.filter((p) => conClases.has(Number(p.id))).map((p) => ({ productoId: Number(p.id), nombre: String(p.nombre ?? '').trim() || `Curso ${p.id}` }));
}

async function secuencias(): Promise<SecuenciaDeAccion[] | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('nutricion_secuencias').select('id, nombre').is('archivada_at', null).order('id');
  if (error) return null;
  return ((data ?? []) as Array<{ id: number; nombre: string | null }>).map((s) => ({ id: Number(s.id), nombre: String(s.nombre ?? '').trim() || `Automatización ${s.id}` }));
}

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null) return Response.json({ ok: false, error: 'Entra al workspace de un cliente.' }, { status: 400 });
  if (rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del workspace configura acciones.' }, { status: 403 });
  const nulo = (etiqueta: string) => (e: unknown) => {
    console.error(`[api/flujos/opciones] ${etiqueta}:`, e instanceof Error ? e.message : String(e));
    return null;
  };
  const [p, equipo, s, c] = await Promise.all([
    productos().catch(nulo('productos')),
    nombresAsignables(ws).catch(nulo('equipo')),
    secuencias().catch(nulo('secuencias')),
    cursos().catch(nulo('cursos')),
  ]);
  const opciones: OpcionesAccion = { productos: p, equipo, secuencias: s, cursos: c };
  return Response.json({ ok: true, ...opciones });
}
