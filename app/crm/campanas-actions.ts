'use server';

// =============================================================================
// campanas-actions — asignar campañas y conjuntos de Meta a un PRODUCTO
// =============================================================================
// Lo que llaman la sección de «Lead entrante» (app/crm/CampanasDelProducto.tsx) y la
// tabla de campañas (app/crm/CampanasModal.tsx). La regla de ruteo vive en
// lib/campana-funnel.ts, el saneo en lib/campana-config.ts y la atribución de los leads
// que ya existen en lib/campana-atribucion.ts; acá sólo hay puertas: quién puede, qué se
// valida, qué se devuelve.
//
// ⚠️ EN UN ARCHIVO `'use server'` SÓLO SE EXPORTAN FUNCIONES ASYNC (y tipos, que se
// borran al compilar). Un `export const` tipa perfecto y TIRA EL BUILD — ya pasó el
// 05/10/2026 en app/crm/actions.ts. Ver AGENTS.md.
// =============================================================================

import { revalidatePath, updateTag } from 'next/cache';
import { getRolWsEfectivo } from '@/lib/workspace';
import { campanasYConjuntos } from '@/lib/meta-health';
import { productosAsignables } from '@/lib/landing-funnel';
import { leerCampanasAsignadasEstricto, guardarCampanasAsignadas } from '@/lib/campana-funnel';
import { conCampana, sinCampana, esIdMeta, type CampanaAsignada } from '@/lib/campana-config';
import { conteoPorCampana, campanasDeMetricas } from '@/lib/campana-atribucion';
import { leadsYMetricas, planDeTraida, moverEnLote } from '@/lib/campana-traer';
import { TAG } from '@/lib/cache';

export type ProductoNombre = { id: number | null; nombre: string };

/** Una fila de la tabla: lo que dice Meta, lo que dicen las métricas y cuántos leads trae. */
export type FilaCampana = {
  id: string;
  nombre: string;
  /**
   * El `effective_status` de Meta, o `null` si Meta no la nombró. `null` NO es «borrada»:
   * puede ser una campaña que sólo conocen las métricas, o que Meta no contestó. La
   * pantalla decide qué decir mirando `metaError`.
   */
  estado: string | null;
  /** Cuántos leads del CRM son de esta campaña o conjunto — TODOS, no sólo los nuevos. */
  leads: number;
};
export type FilaConjunto = FilaCampana & { campanaId: string };

export type EstadoCampanas = {
  ok: true;
  /** TODAS las asignaciones del workspace: la tabla necesita saber cuáles están en
   *  OTRO producto para decirlo, no sólo las de éste. */
  asignadas: CampanaAsignada[];
  campanas: FilaCampana[];
  conjuntos: FilaConjunto[];
  /** Los productos, con el del negocio como `id: null` —que es como se asigna—. */
  productos: ProductoNombre[];
  /**
   * Por qué no se pudo leer Meta, o null. NO es un fallo de la acción: las
   * asignaciones y las campañas que conocen las métricas se leen igual, porque mostrarlas
   * —y poder asignarlas— no depende de que Meta conteste.
   */
  metaError: string | null;
};

const SOLO_ADMIN = 'Solo el administrador del workspace puede asignar campañas.';

/** Invalida la caché de leads. Copia de la de app/crm/actions.ts, que no se puede
 *  importar: un archivo 'use server' sólo exporta acciones. En try/catch porque el
 *  movimiento ya ocurrió, y la caché vence sola por su TTL. */
function bust() {
  try { updateTag(TAG.leads); } catch { /* vence por TTL */ }
}

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
 *  puede llevarse puesta la tabla: las campañas que conocen las métricas, lo asignado y
 *  los conteos no dependen de Meta. */
const TOPE_META_MS = 20_000;

/** Lo que la sección de «Lead entrante» necesita para dibujarse: sin Meta y sin leads,
 *  así aparece al instante. La tabla completa es `campanasDelProductoAction`. */
export async function campanasAsignadasAction(): Promise<
  { ok: true; asignadas: CampanaAsignada[]; productos: ProductoNombre[] } | { ok: false; error: string }
> {
  try {
    const [asignadas, productos] = await Promise.all([leerCampanasAsignadasEstricto(), productosConNull()]);
    return { ok: true, asignadas, productos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo leer' };
  }
}

/** Lo que la tabla necesita para dibujarse. */
export async function campanasDelProductoAction(): Promise<EstadoCampanas | { ok: false; error: string }> {
  try {
    const metaP = (async () => {
      try {
        const r = await Promise.race([
          campanasYConjuntos(),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('tardó más de 20 segundos')), TOPE_META_MS)),
        ]);
        return { ...r, error: null as string | null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Sin credenciales no es «Meta falló»: es que este negocio no conectó Meta. Son
        // dos frases distintas porque son dos cosas que hacer distintas.
        return {
          campanas: [], conjuntos: [],
          error: /no definida|placeholder/i.test(msg)
            ? 'sin-meta'
            : `Meta no contestó: ${msg.replace(/^Meta API error:\s*/i, '').slice(0, 160)}`,
        };
      }
    })();
    const [asignadas, productos, datos, meta] = await Promise.all([
      leerCampanasAsignadasEstricto(), productosConNull(), leadsYMetricas(), metaP,
    ]);
    const conteo = conteoPorCampana(datos.leads, datos.anuncios);
    const historicas = campanasDeMetricas(datos.metricas);

    // ⚠️ META PRIMERO, Y LAS MÉTRICAS COMPLETAN. Meta dice el estado y el nombre de hoy
    // (una campaña renombrada se ve con su nombre nuevo); las métricas agregan las que
    // Meta ya no nombra, que siguen teniendo leads en el CRM.
    const campanas: FilaCampana[] = meta.campanas.map((c) => ({ ...c, leads: conteo.get(c.id) ?? 0 }));
    const vistas = new Set(campanas.map((c) => c.id));
    for (const c of historicas.campanas) {
      if (vistas.has(c.id)) continue;
      campanas.push({ id: c.id, nombre: c.nombre, estado: null, leads: conteo.get(c.id) ?? 0 });
      vistas.add(c.id);
    }
    const conjuntos: FilaConjunto[] = meta.conjuntos.map((s) => ({ ...s, leads: conteo.get(s.id) ?? 0 }));
    const vistosS = new Set(conjuntos.map((s) => s.id));
    for (const s of historicas.conjuntos) {
      if (vistosS.has(s.id)) continue;
      conjuntos.push({ id: s.id, nombre: s.nombre, campanaId: s.campanaId, estado: null, leads: conteo.get(s.id) ?? 0 });
    }
    return { ok: true, asignadas, campanas, conjuntos, productos, metaError: meta.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo leer' };
  }
}

type Item = { tipo: 'campana' | 'conjunto'; id: string; nombre: string; campanaId?: string };

/**
 * Cuántos leads traería asignar esta campaña, y de qué productos salen. Es lo que decide
 * si la pantalla pregunta (con cero no hay nada que decidir) y lo que dice la pregunta.
 */
export async function previaCampanaAction(
  funnelId: number | null,
  item: Item,
): Promise<{ ok: true; aTraer: number; porProducto: { id: number | null; nombre: string; n: number }[] } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  if (!esIdMeta(item?.id)) return { ok: false, error: 'Ese id no es de Meta.' };
  try {
    const d = await destino(funnelId);
    if (!d.ok) return { ok: false, error: 'Ese producto ya no existe.' };
    const [asignadas, productos] = await Promise.all([leerCampanasAsignadasEstricto(), productosConNull()]);
    const mover = await planDeTraida(d.id, item, asignadas);
    const cuenta = new Map<number | null, number>();
    for (const l of mover) cuenta.set(l.funnel_id ?? null, (cuenta.get(l.funnel_id ?? null) ?? 0) + 1);
    const porProducto = [...cuenta].map(([id, n]) => ({
      id, n,
      // Un `funnel_id` de un embudo archivado no está entre los vivos: se dice así y no
      // se inventa un nombre.
      nombre: productos.find((p) => p.id === id)?.nombre ?? 'un producto archivado',
    })).sort((a, b) => b.n - a.n);
    return { ok: true, aTraer: mover.length, porProducto };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo contar' };
  }
}

/** Lo que se movió, para poder devolverlo. */
export type Movido = { id: number; desde: number | null };

/**
 * Asigna una campaña o un conjunto a un producto. Si estaba en otro, se MUEVE (la
 * clave es el id: no puede quedar en dos).
 *
 * Con `traer`, además trae TODOS sus leads que ya están en el CRM: «si selecciono una
 * campaña, me traiga todos los leads. No solo los futuros» (Martín, 05/10/2026). Sin
 * esto, asignar una campaña que lleva meses corriendo dejaba el producto nuevo vacío y
 * todo su historial en el principal.
 */
export async function asignarCampanaAction(
  funnelId: number | null,
  item: Item,
  traer = false,
): Promise<
  | { ok: true; asignadas: CampanaAsignada[]; antes: CampanaAsignada | null; movidos: Movido[]; fallaron: number }
  | { ok: false; error: string }
> {
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
    const actuales = await leerCampanasAsignadasEstricto();
    const antes = actuales.find((a) => a.id === item.id) ?? null;
    const nueva = conCampana(actuales, {
      tipo: item.tipo === 'conjunto' ? 'conjunto' : 'campana',
      id: item.id,
      nombre: String(item.nombre ?? '').slice(0, 200),
      ...(item.campanaId && esIdMeta(item.campanaId) ? { campanaId: item.campanaId } : {}),
      funnelId: d.id,
    });
    if (!nueva) return { ok: false, error: 'No se pudo guardar.' };
    await guardarCampanasAsignadas(nueva);

    let movidos: Movido[] = [];
    let fallaron = 0;
    if (traer) {
      // ⚠️ SE CALCULA CON LA CONFIGURACIÓN YA GUARDADA, no con la de antes: si esta campaña
      // tenía un conjunto en otro producto, sus leads se quedan allá — igual que los que
      // entren mañana.
      const mover = await planDeTraida(d.id, item, nueva);
      const desde = new Map(mover.map((l) => [l.id, l.funnel_id ?? null]));
      const nombre = String(item.nombre || item.id).slice(0, 120);
      const r = await moverEnLote(mover.map((l) => l.id), d.id, `Lo trajo la campaña «${nombre}»`);
      movidos = r.movidos.map((id) => ({ id, desde: desde.get(id) ?? null }));
      fallaron = r.fallaron;
      if (r.movidos.length) { bust(); revalidatePath('/crm'); }
    }
    return { ok: true, asignadas: nueva, antes, movidos, fallaron };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar' };
  }
}

/** Tope del deshacer. Una campaña grande del cliente más grande trae unos cientos. */
const TOPE_DESHACER = 5000;

/**
 * Deshace una asignación: devuelve la campaña a donde estaba (o la saca) y devuelve cada
 * lead que se trajo al producto de donde salió.
 *
 * ⚠️ «DONDE ESTABA», NO «SIN ASIGNAR». Si la campaña venía de otro producto, deshacer
 * tiene que devolvérsela; sacarla la dejaría sin dueño y sus leads nuevos caerían al
 * principal, que es un estado que nadie eligió.
 */
export async function deshacerAsignacionAction(
  id: string,
  antes: CampanaAsignada | null,
  movidos: Movido[],
): Promise<{ ok: true; asignadas: CampanaAsignada[] } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  if (!esIdMeta(id)) return { ok: false, error: 'Ese id no es de Meta.' };
  try {
    const actuales = await leerCampanasAsignadasEstricto();
    let nueva = sinCampana(actuales, id);
    if (antes && antes.id === id) {
      const d = await destino(antes.funnelId);
      // Si el producto de antes se archivó en el medio, no se le devuelve: queda sin asignar.
      if (d.ok) nueva = conCampana(nueva, { ...antes, funnelId: d.id }) ?? nueva;
    }
    await guardarCampanasAsignadas(nueva);

    // Cada lead vuelve a SU producto. Se agrupan por destino para mover en lote, y un
    // destino que ya no existe se saltea: esos leads se quedan donde están.
    const lista = (Array.isArray(movidos) ? movidos : []).slice(0, TOPE_DESHACER)
      .filter((m) => Number.isInteger(m?.id) && m.id > 0);
    const porDestino = new Map<number | null, number[]>();
    for (const m of lista) {
      const k = m.desde ?? null;
      porDestino.set(k, [...(porDestino.get(k) ?? []), m.id]);
    }
    let alguno = false;
    for (const [k, ids] of porDestino) {
      const d = await destino(k);
      if (!d.ok) continue;
      const r = await moverEnLote(ids, d.id, 'Volvió: se deshizo la asignación de la campaña');
      if (r.movidos.length) alguno = true;
    }
    if (alguno) { bust(); revalidatePath('/crm'); }
    return { ok: true, asignadas: nueva };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo deshacer' };
  }
}

/** Saca una campaña o un conjunto: sus leads nuevos vuelven a caer donde caían antes.
 *  Los que ya trajo se quedan donde están — sacar una campaña no reordena el CRM. */
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
