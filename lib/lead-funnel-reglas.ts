// =============================================================================
// lead-funnel-reglas — en qué productos está un lead, y qué se puede hacer (puro)
// =============================================================================
// «No se debe "Mover" se debe agregar al otro producto» (Martín, 06/10/2026). El modelo vive
// en la mig 0207: la CASA es leads.funnel_id (NULL = el producto del negocio) y cada OTRO
// producto es una fila de `lead_funnel` con su propia etapa. Acá están las reglas, sin base,
// para que un test las EJECUTE (tests/lead-funnel.test.ts). La escritura vive en
// lib/lead-funnel.ts.
//
// Sin 'use client' ni 'server-only': lo leen el server, el tablero, la ficha y la bandeja de
// WhatsApp (el producto del «+ Agregar al CRM», `destinoDelAlta`).

/** Un producto donde está el lead. `funnelId` es SIEMPRE un id real (la casa NULL ya resuelta al del negocio). */
export type ProductoDelLead = {
  funnelId: number;
  /** ¿Es su casa (leads.funnel_id)? La casa no tiene fila: su etapa es la del lead. */
  esCasa: boolean;
  /** La etapa EN ESE producto. Para la casa, `null`: la decide el lead (pipeline_stage o derivada). */
  etapa: string | null;
  /** Para ordenar y para elegir a quién se promueve si se quita la casa. */
  desde: string | null;
};

export type FilaLeadFunnel = { funnel_id: number | string; etapa: string; etapa_desde?: string | null; created_at?: string | null; id?: number | string };

/**
 * ⚠️ EL ID DEL PRODUCTO DEL NEGOCIO SE ESCRIBE COMO NULL EN `leads.funnel_id`. El tablero del
 * negocio pide sus leads con `.is('funnel_id', null)`, así que un lead con el id del default
 * escrito no aparecía en NINGÚN tablero (lo hacía el desplegable de la ficha al «devolver» un
 * lead, y el rescate de eliminarFunnelDefinitivo). Toda escritura de la casa pasa por acá.
 */
export function casaParaEscribir(funnelId: number | null, defaultId: number | null): number | null {
  if (funnelId == null) return null;
  return defaultId != null && funnelId === defaultId ? null : funnelId;
}

/** La casa como id real: NULL es el producto del negocio. */
export function casaReal(funnelIdDelLead: number | null | undefined, defaultId: number | null): number | null {
  return funnelIdDelLead == null ? defaultId : Number(funnelIdDelLead);
}

/**
 * Los productos de UN lead: la casa primero, después las filas por antigüedad. Una fila que
 * nombra a la casa se ignora (no debería existir: la regla es «nunca hay fila para la casa»).
 */
export function productosDe(
  funnelIdDelLead: number | null | undefined,
  filas: readonly FilaLeadFunnel[],
  defaultId: number | null,
): ProductoDelLead[] {
  const casa = casaReal(funnelIdDelLead, defaultId);
  const out: ProductoDelLead[] = [];
  if (casa != null) out.push({ funnelId: casa, esCasa: true, etapa: null, desde: null });
  const vistas = new Set(out.map((p) => p.funnelId));
  const ordenadas = [...filas].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || Number(a.id ?? 0) - Number(b.id ?? 0));
  for (const f of ordenadas) {
    const id = Number(f.funnel_id);
    if (!Number.isFinite(id) || vistas.has(id)) continue;
    vistas.add(id);
    out.push({ funnelId: id, esCasa: false, etapa: f.etapa, desde: f.etapa_desde ?? f.created_at ?? null });
  }
  return out;
}

/** La X aparece sólo con DOS productos o más: sacarlo del único lo dejaría sin tablero. */
export const puedeQuitar = (productos: readonly ProductoDelLead[]): boolean => productos.length >= 2;

/**
 * Si se quita la CASA, otra fila pasa a ser la casa: la más vieja. La casa no se puede dejar
 * vacía con una marca de «fuera» (como hace Customer Success): leads.funnel_id es lo que leen la
 * nutrición, las confirmaciones de MaKo, Customer Success y el dedup, y todos lo seguirían
 * tratando como de ese producto.
 */
export function aQuienPromover(productos: readonly ProductoDelLead[]): ProductoDelLead | null {
  return productos.find((p) => !p.esCasa) ?? null;
}

/** La etapa por la que se entra a un producto: la declarada como entrada, o la primera. */
export function etapaDeEntrada(stages: readonly { key: string; kind?: string | null }[]): string | null {
  return (stages.find((s) => s.kind === 'entrada') ?? stages[0])?.key ?? null;
}

/**
 * El nombre que ve la persona: el del PRODUCTO si lo hay, si no el del embudo.
 *
 * ⚠️ UNA REGLA, UN LUGAR. Estaba copiada en 11 lugares (el selector del tablero, la ficha, el
 * registro de la API, el Pixel, las secuencias…), dos de ellos sin el `trim` —un producto con
 * nombre en blanco salía en blanco—. «Funnel principal» es el nombre que puso la migración 0170
 * y es el MISMO en todos los workspaces: no le dice nada a nadie, por eso manda el producto.
 */
export function nombreVisible(f: { nombre: string; producto?: string | null }): string {
  return f.producto?.trim() || f.nombre;
}

/** Un producto tal como lo ofrece el alta desde una conversación de WhatsApp. */
export type ProductoParaAlta = { id: number; nombre: string; esDefault: boolean };

/** Lo mínimo de un embudo que hace falta para decidir el alta (`FunnelResumen` lo cumple). */
type EmbudoDelAlta = { id: number; nombre: string; producto?: string | null; esDefault: boolean };

/** La lista del «+ Agregar al CRM». `null` entra y `null` sale: «no pude leer» no es «no hay». */
export function productosParaAlta(funnels: readonly EmbudoDelAlta[] | null): ProductoParaAlta[] | null {
  return funnels ? funnels.map((f) => ({ id: f.id, nombre: nombreVisible(f), esDefault: f.esDefault })) : null;
}

/** ¿El alta tiene que preguntar el producto? Sólo con DOS o más: con uno no hay nada que elegir. */
export function pideProducto(productos: readonly unknown[]): boolean {
  return productos.length >= 2;
}

/** Dónde nace un lead del alta desde WhatsApp. */
export type DestinoDelAlta = {
  /** Lo que se escribe en `leads.funnel_id`: ya pasado por `casaParaEscribir` (el default va NULL). */
  casa: number | null;
  /** El id real del elegido, para AGREGAR a una persona que ya existía. `null` = no se eligió. */
  real: number | null;
  /** Su nombre visible, para decirlo en la pantalla. */
  nombre: string | null;
};

/**
 * El producto del alta desde una conversación (pedido de Leila, ws11, 08/10/2026: «Primero de
 * por sí me entra al funnel principal, o sea que la tengo que eliminar de funnel principal»).
 *
 * `funnels` es la lectura del workspace —`null` si FALLÓ— y `funnelId` lo que eligió la
 * pantalla —`null` si no eligió—. Decide el SERVER, no la pantalla:
 *   · la lectura falló             → error, y no se crea. «No pude leer» no es «no existe»: un
 *                                    id válido con la base caída no merece un «no existe».
 *   · no eligió y hay 2+ productos → error con la lista para preguntar. Nunca se crea a ciegas
 *                                    en el principal: es el bug, y pasaría con una pantalla vieja
 *                                    o con una que no pudo leer la lista al cargar.
 *   · no eligió y hay 0-1          → el del negocio (casa NULL), sin preguntar nada.
 *   · eligió uno que no está       → error (un id ajeno, archivado o inventado).
 *   · eligió uno de la lista       → ése, con la casa por `casaParaEscribir`.
 *
 * ⚠️ EL DEFAULT SALE DE LA MISMA LISTA, no de `idDelFunnelDefault()`. Si esa otra lectura
 * fallara devolvería `null`, `casaParaEscribir(idDelDefault, null)` escribiría el id del
 * default, y el lead quedaría invisible en TODOS los tableros (ver `casaParaEscribir`).
 */
export function destinoDelAlta(
  funnels: readonly EmbudoDelAlta[] | null,
  funnelId: number | null | undefined,
): DestinoDelAlta | { error: string; elegir?: ProductoParaAlta[] } {
  if (!funnels) return { error: 'No pude leer tus funnels.' };
  if (funnelId == null) {
    if (pideProducto(funnels)) return { error: 'Elige el funnel.', elegir: productosParaAlta(funnels) ?? [] };
    return { casa: null, real: null, nombre: null };
  }
  const f = funnels.find((x) => x.id === funnelId);
  if (!f) return { error: 'Ese funnel no existe.' };
  const def = funnels.find((x) => x.esDefault)?.id ?? null;
  return { casa: casaParaEscribir(f.id, def), real: f.id, nombre: nombreVisible(f) };
}
