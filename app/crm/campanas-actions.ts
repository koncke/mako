'use server';

// =============================================================================
// campanas-actions — asignar campañas y conjuntos de Meta a un PRODUCTO
// =============================================================================
// Lo que llama el selector de «Lead entrante» (app/crm/CampanasDelProducto.tsx).
// La regla de ruteo vive en lib/campana-funnel.ts y el saneo en lib/campana-config.ts;
// acá sólo hay puertas: quién puede, qué se valida, qué se devuelve.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (y tipos, que se
// borran al compilar). Un `export const` tipa perfecto y TIRA EL BUILD — ya pasó el
// 05/10/2026 en app/crm/actions.ts. Ver AGENTS.md.
// =============================================================================

import { getRolWsEfectivo } from '@/lib/workspace';
import { campanasYConjuntos, type CampanaMeta, type ConjuntoMeta } from '@/lib/meta-health';
import { productosAsignables } from '@/lib/landing-funnel';
import { leerCampanasAsignadasEstricto, guardarCampanasAsignadas } from '@/lib/campana-funnel';
import { conCampana, sinCampana, esIdMeta, type CampanaAsignada } from '@/lib/campana-config';

export type ProductoNombre = { id: number | null; nombre: string };

export type EstadoCampanas = {
  ok: true;
  /** TODAS las asignaciones del workspace: el selector necesita saber cuáles están en
   *  OTRO producto para decirlo, no sólo las de éste. */
  asignadas: CampanaAsignada[];
  campanas: CampanaMeta[];
  conjuntos: ConjuntoMeta[];
  /** Los productos, con el del negocio como `id: null` —que es como se asigna—. */
  productos: ProductoNombre[];
  /**
   * Por qué no se pudo leer Meta, o null. NO es un fallo de la acción: las
   * asignaciones se leen igual, porque mostrarlas —y poder quitarlas— no depende de
   * que Meta conteste. Lo que no se puede sin Meta es AGREGAR.
   */
  metaError: string | null;
};

const SOLO_ADMIN = 'Solo el administrador del workspace puede asignar campañas.';

async function productosConNull(): Promise<ProductoNombre[]> {
  const vivos = await productosAsignables();
  // El del negocio va como `null`: es como se guarda (ver lib/campana-config.ts) y
  // como el CRM escribe ese embudo en `leads.funnel_id`.
  return vivos.map((f) => ({ id: f.esDefault ? null : f.id, nombre: f.nombre }));
}

/**
 * El embudo de destino, con el del negocio traducido a `null`.
 *
 * ⚠️ DEFENSA EN EL SERVER, aunque el pop-up ya normaliza al montar. El selector del
 * tablero abre el pop-up del producto principal con su id NUMÉRICO (`onEditarEtapas(f.id)`
 * en todas las filas), y con ese número esta acción contestaba «Ese producto ya no
 * existe» — o sea que desde el lápiz no se podía asignar nada al principal. Lo encontró
 * la revisión adversarial del 05/10/2026. Si mañana otra pantalla monta el selector sin
 * normalizar, el server no se deja confundir.
 */
async function destino(funnelId: number | null): Promise<{ ok: true; id: number | null } | { ok: false }> {
  const vivos = await productosAsignables();
  if (funnelId == null) return vivos.some((f) => f.esDefault) ? { ok: true, id: null } : { ok: false };
  const f = vivos.find((x) => x.id === funnelId);
  if (!f) return { ok: false };
  return { ok: true, id: f.esDefault ? null : f.id };
}

/** Tope de la rama de Meta. La acción entera corta a los 60 s, y un Meta colgado no
 *  puede llevarse puesta la lista de lo ya asignado: mostrarla y poder quitarla no
 *  depende de Meta. */
const TOPE_META_MS = 20_000;

/** Lo que el selector necesita para dibujarse. */
export async function campanasDelProductoAction(): Promise<EstadoCampanas | { ok: false; error: string }> {
  try {
    const [asignadas, productos] = await Promise.all([leerCampanasAsignadasEstricto(), productosConNull()]);
    let campanas: CampanaMeta[] = [];
    let conjuntos: ConjuntoMeta[] = [];
    let metaError: string | null = null;
    try {
      ({ campanas, conjuntos } = await Promise.race([
        campanasYConjuntos(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('tardó más de 20 segundos')), TOPE_META_MS)),
      ]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Sin credenciales no es «Meta falló»: es que este negocio no conectó Meta. Son
      // dos frases distintas porque son dos cosas que hacer distintas.
      metaError = /no definida|placeholder/i.test(msg)
        ? 'sin-meta'
        : `Meta no contestó: ${msg.replace(/^Meta API error:\s*/i, '').slice(0, 160)}`;
    }
    return { ok: true, asignadas, campanas, conjuntos, productos, metaError };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo leer' };
  }
}

/**
 * Asigna una campaña o un conjunto a un producto. Si estaba en otro, se MUEVE (la
 * clave es el id: no puede quedar en dos). Devuelve la lista entera para que el
 * selector se redibuje sin volver a preguntarle a Meta.
 */
export async function asignarCampanaAction(
  funnelId: number | null,
  item: { tipo: 'campana' | 'conjunto'; id: string; nombre: string; campanaId?: string },
): Promise<{ ok: true; asignadas: CampanaAsignada[] } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  if (!esIdMeta(item?.id)) return { ok: false, error: 'Ese id no es de Meta.' };
  try {
    // ⚠️ SE VALIDA EL DESTINO contra los productos VIVOS. Guardar un id de un embudo
    // archivado no rompería nada hoy —el ruteo lo descarta—, pero dejaría una fila que
    // dice «va a X» sobre algo que no va a ningún lado.
    const d = await destino(funnelId);
    if (!d.ok) return { ok: false, error: 'Ese producto ya no existe.' };
    // Lectura ESTRICTA: con una tolerante, una lectura caída se leería como «no hay
    // ninguna» y este guardado borraría todas las demás (ver lib/campana-funnel.ts).
    const nueva = conCampana(await leerCampanasAsignadasEstricto(), {
      tipo: item.tipo === 'conjunto' ? 'conjunto' : 'campana',
      id: item.id,
      nombre: item.nombre,
      ...(item.campanaId ? { campanaId: item.campanaId } : {}),
      funnelId: d.id,
    });
    if (!nueva) return { ok: false, error: 'No se pudo guardar.' };
    await guardarCampanasAsignadas(nueva);
    return { ok: true, asignadas: nueva };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar' };
  }
}

/** Saca una campaña o un conjunto: sus leads nuevos vuelven a caer donde caían antes. */
export async function quitarCampanaAction(
  id: string,
): Promise<{ ok: true; asignadas: CampanaAsignada[] } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  try {
    // Estricta por lo mismo que al asignar, y acá es peor: con `[]` por una lectura
    // caída se guardaría «[]» y se borraría la configuración ENTERA.
    const nueva = sinCampana(await leerCampanasAsignadasEstricto(), id);
    await guardarCampanasAsignadas(nueva);
    return { ok: true, asignadas: nueva };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo quitar' };
  }
}
