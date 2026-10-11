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
// ⚠️ TRAER LOS LEADS DE UNA CAMPAÑA LOS AGREGA AL PRODUCTO, NO LOS MUEVE (06/10/2026).
// Hasta ese día `asignarLoteAction` con `traer` reescribía `leads.funnel_id` y sacaba a
// cada lead del producto donde estaba. Martín: «Le acabo de dar a un lead a "Mover a
// prueba" y se desapareció del producto principal de Mauricio. Eso JAMÁS debe pasar... No
// se debe "Mover" se debe agregar al otro producto». Ahora es `agregarLoteAProducto`
// (lib/lead-funnel.ts): la casa queda donde estaba y el destino gana una fila de
// `lead_funnel` en su etapa de entrada. Y el deshacer borra SÓLO las filas que agregó.
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
import { leadsYMetricas, planDeTraidaLote } from '@/lib/campana-traer';
import { agregarLoteAProducto, quitarLoteDeProducto } from '@/lib/lead-funnel';
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
 *
 * Devuelve además el id REAL (`real`, también el del negocio) y el nombre: el mapa de
 * campañas guarda el del negocio como `null`, pero las filas de `lead_funnel` —que es
 * donde se agregan los leads— lo guardan con su id (mig 0207).
 */
async function destino(funnelId: number | null): Promise<{ ok: true; id: number | null; real: number; nombre: string } | { ok: false }> {
  const vivos = await productosAsignables();
  const f = funnelId == null ? vivos.find((x) => x.esDefault) : vivos.find((x) => x.id === funnelId);
  if (!f) return { ok: false };
  return { ok: true, id: f.esDefault ? null : f.id, real: f.id, nombre: f.nombre };
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

/** Lo que había antes en el mapa para cada id que se tocó: lo que necesita el deshacer. */
export type Previo = { id: string; antes: CampanaAsignada | null };

/**
 * Un lead que se AGREGÓ a un producto, para poder sacarlo con el deshacer: el lead y el id
 * REAL del producto (el del negocio también va con su id, como en `lead_funnel`).
 *
 * ⚠️ SE SIGUE LLAMANDO `Movido` (y el campo `movidos`) SÓLO POR COMPATIBILIDAD: lo importan
 * la tabla de Ads Manager (app/ads-manager/CampanasBrowser.tsx) y su celda
 * (ProductoCelda.tsx), que lo devuelven tal cual al deshacer. Desde el 06/10/2026 NO es un
 * movimiento: la casa del lead no cambia. La forma vieja (`{ id, desde }`) que pueda traer
 * una pestaña abierta antes del deploy no tiene `a`, y el deshacer la IGNORA — no saca a
 * nadie de ningún lado por un payload que no dice de dónde.
 */
export type Movido = { id: number; a: number };

type PorProducto = { id: number | null; nombre: string; n: number };

/** Tope de un lote: el mismo del mapa, que no guarda más de eso. */
const TOPE_LOTE = 200;

/** Los ítems que se pueden tocar: id de Meta, sin repetir, y con tope. Lo que no pasa se
 *  descarta acá y no llega a escribir nada. */
function sanear(items: unknown): Item[] {
  const out: Item[] = [];
  for (const x of Array.isArray(items) ? items : []) {
    const it = x as Partial<Item> | null;
    if (!it || !esIdMeta(it.id) || out.some((o) => o.id === it.id)) continue;
    out.push({
      tipo: it.tipo === 'conjunto' ? 'conjunto' : 'campana',
      id: it.id.trim(),
      nombre: String(it.nombre ?? '').slice(0, 200),
      ...(it.campanaId && esIdMeta(it.campanaId) ? { campanaId: it.campanaId.trim() } : {}),
    });
    if (out.length >= TOPE_LOTE) break;
  }
  return out;
}

/** El mapa como quedaría con `items` asignados a `dest`. */
function conItems(actuales: CampanaAsignada[], items: Item[], dest: number | null): CampanaAsignada[] {
  let lista = actuales;
  for (const it of items) lista = conCampana(lista, { ...it, funnelId: dest }) ?? lista;
  return lista;
}

/**
 * Cuántos leads traería asignar estas campañas o conjuntos a un producto, en qué productos
 * están HOY (su casa: no salen de ahí, se suman al destino), y de qué productos se les saca
 * la campaña. Es lo que decide si la pantalla pregunta (con cero no hay nada que decidir) y
 * lo que dice la pregunta. Los que ya están en el destino —por casa o por fila— no cuentan.
 */
export async function previaLoteAction(
  funnelId: number | null,
  items: Item[],
): Promise<{ ok: true; aTraer: number; porProducto: PorProducto[]; desde: string[] } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  const lote = sanear(items);
  if (!lote.length) return { ok: false, error: 'Ese id no es de Meta.' };
  try {
    const d = await destino(funnelId);
    if (!d.ok) return { ok: false, error: 'Ese funnel ya no existe.' };
    const [asignadas, productos] = await Promise.all([leerCampanasAsignadasEstricto(), productosConNull()]);
    // ⚠️ CON EL MAPA COMO QUEDARÍA, no con el de hoy: si en el mismo lote va una campaña y
    // un conjunto suyo que hoy está en otro producto, el conjunto pasa a ser de éste y sus
    // leads también vienen. Contar con el mapa de hoy diría un número menor que el real.
    const plan = await planDeTraidaLote(d.id, lote, conItems(asignadas, lote, d.id));
    const cuenta = new Map<number | null, number>();
    let aTraer = 0;
    for (const grupo of plan.values()) {
      for (const l of grupo) { cuenta.set(l.funnel_id ?? null, (cuenta.get(l.funnel_id ?? null) ?? 0) + 1); aTraer += 1; }
    }
    // Un `funnel_id` de un embudo archivado no está entre los vivos: se dice así y no se
    // inventa un nombre.
    const nombreDe = (id: number | null) => productos.find((p) => p.id === id)?.nombre ?? 'un funnel archivado';
    const porProducto = [...cuenta].map(([id, n]) => ({ id, n, nombre: nombreDe(id) })).sort((a, b) => b.n - a.n);
    const desde = [...new Set(lote
      .map((it) => asignadas.find((a) => a.id === it.id))
      .filter((a): a is CampanaAsignada => !!a && a.funnelId !== d.id)
      .map((a) => nombreDe(a.funnelId)))];
    return { ok: true, aTraer, porProducto, desde };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo contar' };
  }
}

/** La de a una, para la celda de cada fila: es el lote de uno. */
export async function previaCampanaAction(
  funnelId: number | null,
  item: Item,
): Promise<{ ok: true; aTraer: number; porProducto: PorProducto[] } | { ok: false; error: string }> {
  const r = await previaLoteAction(funnelId, [item]);
  return r.ok ? { ok: true, aTraer: r.aTraer, porProducto: r.porProducto } : r;
}

/**
 * Asigna campañas o conjuntos a un producto. Si alguno estaba en otro, la ASIGNACIÓN se
 * mueve (la clave es el id: una campaña no puede rutear a dos). El mapa se escribe UNA vez
 * para todo el lote.
 *
 * Con `traer`, además AGREGA al producto TODOS sus leads que ya están en el CRM: «si
 * selecciono una campaña, me traiga todos los leads. No solo los futuros» (Martín,
 * 05/10/2026). Agregar, no mover: cada lead sigue en su casa y suma una fila de
 * `lead_funnel` en la etapa de entrada del destino («No se debe "Mover" se debe agregar al
 * otro producto», 06/10/2026). Lo que eso NO toca —etapa de la casa, estado, monto, CAPI,
 * nutrición, etiqueta de WhatsApp— está escrito en lib/lead-funnel.ts.
 */
export async function asignarLoteAction(
  funnelId: number | null,
  items: Item[],
  traer = false,
): Promise<
  | { ok: true; asignadas: CampanaAsignada[]; previos: Previo[]; movidos: Movido[]; fallaron: number }
  | { ok: false; error: string }
> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  const lote = sanear(items);
  if (!lote.length) return { ok: false, error: 'Ese id no es de Meta.' };
  try {
    // ⚠️ SE VALIDA EL DESTINO contra los productos VIVOS. Guardar un id de un embudo
    // archivado no rompería nada hoy —el ruteo lo descarta—, pero dejaría una fila que
    // dice «va a X» sobre algo que no va a ningún lado.
    const d = await destino(funnelId);
    if (!d.ok) return { ok: false, error: 'Ese funnel ya no existe.' };
    // Lectura ESTRICTA: con una tolerante, una lectura caída se leería como «no hay
    // ninguna» y este guardado borraría todas las demás (ver lib/campana-funnel.ts).
    const actuales = await leerCampanasAsignadasEstricto();
    const previos = lote.map((it) => ({ id: it.id, antes: actuales.find((a) => a.id === it.id) ?? null }));
    const nueva = conItems(actuales, lote, d.id);
    await guardarCampanasAsignadas(nueva);

    let movidos: Movido[] = [];
    let fallaron = 0;
    if (traer) {
      // ⚠️ SE CALCULA CON LA CONFIGURACIÓN YA GUARDADA: si una campaña tiene un conjunto en
      // otro producto, sus leads se quedan allá — igual que los que entren mañana.
      const plan = await planDeTraidaLote(d.id, lote, nueva);
      for (const it of lote) {
        const grupo = plan.get(it.id) ?? [];
        if (!grupo.length) continue;
        const nombre = String(it.nombre || it.id).slice(0, 120);
        // Se agrega con el id REAL del destino (el del negocio también: en `lead_funnel` va
        // con su id). `agregarLoteAProducto` vuelve a saltear a los que ya están —por casa o
        // por fila—, así que una carrera con otra pestaña no duplica, y devuelve SÓLO los que
        // la base confirmó: el deshacer no puede sacar a alguien que no agregó este lote.
        // ⚠️ UN `try` POR ÍTEM: `agregarLoteAProducto` TIRA (producto sin etapas, archivado
        // en el medio) y `moverEnLote` no tiraba nunca. Sin esto, el error del segundo ítem
        // se lleva puesto el `movidos` del primero —que ya se escribió— y su deshacer
        // desaparece. Se cuenta como fallado y la pantalla lo dice.
        try {
          const r = await agregarLoteAProducto(
            grupo.map((l) => l.id), d.real,
            `Agregado a «${d.nombre}» por ${it.tipo === 'conjunto' ? 'el conjunto' : 'la campaña'} «${nombre}»`,
          );
          movidos = movidos.concat(r.agregados.map((id) => ({ id, a: d.real })));
          fallaron += r.fallaron;
        } catch (e) {
          console.error('[campanas] no se pudieron agregar los leads de', it.id, e instanceof Error ? e.message : e);
          fallaron += grupo.length;
        }
      }
      if (movidos.length) { bust(); revalidatePath('/crm'); }
    }
    return { ok: true, asignadas: nueva, previos, movidos, fallaron };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo guardar' };
  }
}

/** La de a una. Mantiene su forma (`antes`) porque la usa la tabla de Ads Manager. */
export async function asignarCampanaAction(
  funnelId: number | null,
  item: Item,
  traer = false,
): Promise<
  | { ok: true; asignadas: CampanaAsignada[]; antes: CampanaAsignada | null; movidos: Movido[]; fallaron: number }
  | { ok: false; error: string }
> {
  const r = await asignarLoteAction(funnelId, [item], traer);
  return r.ok ? { ok: true, asignadas: r.asignadas, antes: r.previos[0]?.antes ?? null, movidos: r.movidos, fallaron: r.fallaron } : r;
}

/** Tope del deshacer. Un lote de campañas grandes del cliente más grande trae cientos. */
const TOPE_DESHACER = 5000;

/**
 * Deshace una asignación (de una o de un lote): devuelve cada campaña a donde estaba (o la
 * saca) y saca de ese producto a cada lead que el lote AGREGÓ. Con `agregados` vacío, es el
 * deshacer de QUITAR.
 *
 * ⚠️ «DONDE ESTABA», NO «SIN ASIGNAR». Si la campaña venía de otro producto, deshacer
 * tiene que devolvérsela; sacarla la dejaría sin dueño y sus leads nuevos caerían al
 * principal, que es un estado que nadie eligió.
 *
 * ⚠️ SÓLO LAS FILAS QUE ESE LOTE CREÓ. `quitarLoteDeProducto` borra la fila de
 * `lead_funnel` de cada id que se le pasa, y los ids son los que `agregarLoteAProducto`
 * confirmó haber escrito: un lead que ya estaba agregado antes no viaja en la lista y no
 * se toca. Nunca toca una casa: deshacer no puede dejar a nadie sin producto.
 */
export async function deshacerLoteAction(
  previos: Previo[],
  agregados: Movido[],
): Promise<{ ok: true; asignadas: CampanaAsignada[] } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  const lista = (Array.isArray(previos) ? previos : []).filter((p) => esIdMeta(p?.id)).slice(0, TOPE_LOTE);
  if (!lista.length) return { ok: false, error: 'Ese id no es de Meta.' };
  try {
    let nueva = await leerCampanasAsignadasEstricto();
    for (const p of lista) {
      nueva = sinCampana(nueva, p.id);
      if (p.antes && p.antes.id === p.id) {
        const d = await destino(p.antes.funnelId);
        // Si el producto de antes se archivó en el medio, no se le devuelve: queda sin asignar.
        if (d.ok) nueva = conCampana(nueva, { ...p.antes, funnelId: d.id }) ?? nueva;
      }
    }
    await guardarCampanasAsignadas(nueva);

    // Cada lead sale del producto al que se lo AGREGÓ. Se agrupan por producto para borrar
    // en lote. Un payload sin `a` (la forma vieja, de una pestaña de antes del deploy) se
    // ignora: sin el producto no hay qué fila borrar, y adivinarlo sería sacarlo de otro.
    const ags = (Array.isArray(agregados) ? agregados : []).slice(0, TOPE_DESHACER)
      .filter((m) => Number.isInteger(m?.id) && m.id > 0 && Number.isInteger(m?.a) && m.a > 0);
    const porProducto = new Map<number, number[]>();
    for (const m of ags) {
      const ids = porProducto.get(m.a) ?? [];
      ids.push(m.id);
      porProducto.set(m.a, ids);
    }
    let alguno = false;
    for (const [a, ids] of porProducto) {
      const n = await quitarLoteDeProducto(ids, a, 'Se deshizo: lo había agregado una campaña');
      if (n) alguno = true;
    }
    if (alguno) { bust(); revalidatePath('/crm'); }
    return { ok: true, asignadas: nueva };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo deshacer' };
  }
}

/** La de a una. Mantiene su forma porque la usa la tabla de Ads Manager. */
export async function deshacerAsignacionAction(
  id: string,
  antes: CampanaAsignada | null,
  agregados: Movido[],
): Promise<{ ok: true; asignadas: CampanaAsignada[] } | { ok: false; error: string }> {
  return deshacerLoteAction([{ id, antes }], agregados);
}

/** Saca campañas o conjuntos: sus leads nuevos vuelven a caer donde caían antes. Los que
 *  ya trajeron siguen agregados — sacar una campaña no reordena el CRM. */
export async function quitarLoteAction(
  ids: string[],
): Promise<{ ok: true; asignadas: CampanaAsignada[]; previos: Previo[] } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') return { ok: false, error: SOLO_ADMIN };
  try {
    // Estricta por lo mismo que al asignar, y acá es peor: con `[]` por una lectura
    // caída se guardaría «[]» y se borraría la configuración ENTERA.
    const actuales = await leerCampanasAsignadasEstricto();
    const lista = [...new Set((Array.isArray(ids) ? ids : []).filter((x) => esIdMeta(x)))].slice(0, TOPE_LOTE);
    const previos = lista.map((id) => ({ id, antes: actuales.find((a) => a.id === id) ?? null }));
    let nueva = actuales;
    for (const id of lista) nueva = sinCampana(nueva, id);
    await guardarCampanasAsignadas(nueva);
    return { ok: true, asignadas: nueva, previos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No se pudo quitar' };
  }
}

/** La de a una. */
export async function quitarCampanaAction(
  id: string,
): Promise<{ ok: true; asignadas: CampanaAsignada[] } | { ok: false; error: string }> {
  const r = await quitarLoteAction([id]);
  return r.ok ? { ok: true, asignadas: r.asignadas } : r;
}
