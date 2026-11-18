// =============================================================================
// Admin › Products › Templates — las plantillas que los negocios compartieron con la comunidad: lo PURO (18/11/2026)
// =============================================================================
// Martín (13/10/2026, las estrellas): «Yo claro que puedo hacer ciertos templates en un inicio, pero luego la comunidad se va a
// encargar». Lo que la comunidad publica lo modera la PLATAFORMA (`puedeRetirar`, lib/creaciones-reglas.ts): esta pantalla es
// la puerta, con la lista y los filtros del Catalogue de Polar (app/admin/(polar)/products/ProductsPage.tsx) y «Retirar de la
// galería» en el menú de cada fila. Retirar no borra: quien ya la usó conserva su copia (lib/creaciones.ts → `retirarCreacion`).
//
// Las privadas no salen nunca: son de un negocio y no las ve nadie más, tampoco la plataforma.
// Sin `server-only`: lo importan la vista y el test (tests/admin-plantillas-moderar.test.ts). La lectura, en ./plantillas-server.ts.
// =============================================================================

/** Una plantilla publicada (o retirada), con el negocio que la publicó: lo ve SÓLO el super admin. */
export type PlantillaModerada = {
  id: number;
  tipo: string;
  /** El nombre del tipo, en singular («automatización», «hoja del Dashboard»…). */
  tipoTexto: string;
  titulo: string;
  descripcion: string;
  autor: string;
  deMako: boolean;
  estado: 'publicada' | 'retirada';
  estrellas: number;
  usos: number;
  publicada: string;
  negocio: { id: number; nombre: string };
};

export const MOSTRAR_PLANTILLAS = ['publicadas', 'retiradas', 'todas'] as const;
export type MostrarPlantillas = (typeof MOSTRAR_PLANTILLAS)[number];
export const ORDENES_PLANTILLAS = ['-estrellas', '-usos', '-publicada', 'titulo'] as const;
export type OrdenPlantillas = (typeof ORDENES_PLANTILLAS)[number];

/** Lo que dice la URL (`?show=`): por defecto, las publicadas (lo que hoy se ve en la galería). */
export const leerMostrarPlantillas = (x: string | null | undefined): MostrarPlantillas =>
  ((MOSTRAR_PLANTILLAS as readonly string[]).includes(x ?? '') ? x : 'publicadas') as MostrarPlantillas;
/** Lo que dice la URL (`?sorting=`): por defecto, las de más estrellas primero. */
export const leerOrdenPlantillas = (x: string | null | undefined): OrdenPlantillas =>
  ((ORDENES_PLANTILLAS as readonly string[]).includes(x ?? '') ? x : '-estrellas') as OrdenPlantillas;

const plano = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * La lista que se dibuja: lo que se muestra (publicadas, retiradas o todas), lo buscado (título, descripción, autor, negocio
 * y tipo, sin tildes ni mayúsculas) y el orden. El último criterio es el id: el orden no se mueve entre dos lecturas.
 */
export function filtrarPlantillas(
  lista: readonly PlantillaModerada[],
  f: { query?: string | null; show?: MostrarPlantillas; sorting?: OrdenPlantillas },
): PlantillaModerada[] {
  const show = f.show ?? 'publicadas';
  const q = plano((f.query ?? '').trim());
  const out = lista.filter((p) => {
    if (show === 'publicadas' && p.estado !== 'publicada') return false;
    if (show === 'retiradas' && p.estado !== 'retirada') return false;
    return !q || plano(`${p.titulo} ${p.descripcion} ${p.autor} ${p.negocio.nombre} ${p.tipoTexto}`).includes(q);
  });
  const orden = f.sorting ?? '-estrellas';
  const cmp = (a: PlantillaModerada, b: PlantillaModerada): number => {
    if (orden === '-estrellas') return b.estrellas - a.estrellas || b.usos - a.usos;
    if (orden === '-usos') return b.usos - a.usos || b.estrellas - a.estrellas;
    if (orden === '-publicada') return Date.parse(b.publicada) - Date.parse(a.publicada);
    return a.titulo.localeCompare(b.titulo, 'es');
  };
  return [...out].sort((a, b) => cmp(a, b) || b.id - a.id);
}

/** «★ 12 · 3 usos»: lo que una fila dice de cuánto gustó. */
export function cuantoGusto(p: Pick<PlantillaModerada, 'estrellas' | 'usos'>): string {
  return `★ ${p.estrellas} · ${p.usos} ${p.usos === 1 ? 'uso' : 'usos'}`;
}
