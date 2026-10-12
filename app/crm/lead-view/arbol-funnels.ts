// =============================================================================
// El ÁRBOL de la cabecera de la ficha: cada funnel con sus etapas adentro
// =============================================================================
// Pedido de Martín (12/10/2026, punto 9), sobre la cabecera de la ficha del lead —que tenía
// DOS desplegables, «PROSPECCIÓN» (el funnel) y «Círculo ROJO» (la etapa)—: «Que sea solo 1
// desplegable de "PROSPECCIÓN" que es el funnel, y que sea un desplegable tipo arbol, que dentro
// de "PROSPECCIÓN" tenga mis etapas, y que ahí se configure eso... O le pueda agregar a otros
// funnel, etc...».
//
// El dibujo es el `Dropdown` de la casa con `secciones` (app/components/Dropdown.tsx): la raíz
// lista los funnels, cada uno se abre con sus etapas, y el menú abre PARADO en el funnel que se
// está mirando (`caminoDe`). No se escribió un árbol nuevo: ése ya navega, busca aplanando con el
// camino como rótulo y pinta la sección donde está lo elegido.
//
// ⚠️ PURO Y SIN 'use client', a propósito: es la parte que decide QUÉ se ofrece en cada funnel
// (sus etapas, «Agregar», «Quitar») y vive afuera del componente para que un test la EJECUTE
// (tests/lead-funnel-ficha.test.ts). El componente (`FunnelYEtapa`, ProductoDelLead.tsx) trae
// server actions y no se puede importar en un test.
//
// Las decisiones de siempre no cambian (mig 0207, lib/lead-funnel*.ts):
//   · en la CASA la etapa es la del lead y se mueve por el camino de siempre (con su wizard
//     cuando la etapa lo pide): por eso sus etapas son las que la PANTALLA ya tiene, no una copia
//     que trajo el server — mover con otras escribiría una clave que el wizard no conoce;
//   · en un funnel AGREGADO la etapa es la de su fila de `lead_funnel`, y moverla escribe sólo esa;
//   · donde NO está se ofrece agregarlo (entra en la etapa de entrada de ese funnel);
//   · quitarlo, sólo con dos o más: sacarlo del único lo dejaría en ningún tablero (el server lo
//     vuelve a contar; esconder la opción no protege nada).
// =============================================================================

import type { DropdownGroup, DropdownOption } from '@/app/components/Dropdown';

/** Una etapa como la dibuja el árbol. `col` sólo la traen las de la pantalla (la casa). */
export type EtapaDelArbol = { key: string; label: string; band?: string | null; dot?: string; col?: number };

/** Un funnel del árbol: dónde está el lead y con qué etapa. */
export type FunnelDelArbol = {
  id: number;
  nombre: string;
  esta: boolean;
  esCasa: boolean;
  /** Su etapa en ese funnel; `null` = su fila apunta a una etapa que ya no existe. */
  etapa: string | null;
  etapas: readonly EtapaDelArbol[];
};

/** Lo que el server contestó de cada funnel (`ProductoFicha`, lead-funnel-actions.ts). */
type FunnelDelServer = { id: number; nombre: string; esta: boolean; esCasa: boolean; etapa: string | null; etapas: readonly EtapaDelArbol[] };

/** Qué botón lleva un funnel: «Quitar» donde está (sólo con dos o más), «Agregar» donde no. */
export function accionDelRenglon(esta: boolean, puedeQuitar: boolean): 'quitar' | 'agregar' | null {
  if (!esta) return 'agregar';
  return puedeQuitar ? 'quitar' : null;
}

// ── El valor de cada renglón ──────────────────────────────────────────────────
// El desplegable devuelve UN string: el renglón tiene que decir QUÉ funnel y QUÉ hacer. El id va
// primero y es un número, así que el primer «:» después del prefijo corta sin ambigüedad aunque
// la clave de una etapa traiga dos puntos.

export type EleccionDelArbol =
  | { tipo: 'etapa'; funnelId: number; etapa: string }
  | { tipo: 'agregar'; funnelId: number }
  | { tipo: 'quitar'; funnelId: number };

export const valorEtapa = (funnelId: number, etapa: string) => `e:${funnelId}:${etapa}`;
const valorAgregar = (funnelId: number) => `a:${funnelId}`;
const valorQuitar = (funnelId: number) => `q:${funnelId}`;

/** Lo que eligió la persona, o `null` si el valor no es de este árbol. */
export function leerEleccion(v: string): EleccionDelArbol | null {
  const m = /^([eaq]):(\d+)(?::([\s\S]+))?$/.exec(v);
  if (!m) return null;
  const funnelId = Number(m[2]);
  if (!Number.isSafeInteger(funnelId)) return null;
  if (m[1] === 'e') return m[3] ? { tipo: 'etapa', funnelId, etapa: m[3] } : null;
  if (m[3] != null) return null;
  return m[1] === 'a' ? { tipo: 'agregar', funnelId } : { tipo: 'quitar', funnelId };
}

// ── Los funnels ───────────────────────────────────────────────────────────────

/**
 * Los funnels del árbol, armados con lo que la pantalla ya tiene y lo que contestó el server.
 *
 * ⚠️ MIENTRAS EL SERVER NO CONTESTÓ (o con un solo funnel, donde ni se pregunta) el árbol tiene
 * SÓLO LA CASA, con las etapas de la pantalla: mover de etapa es lo que más se hace y no puede
 * esperar a una consulta. Los otros funnels no se dibujan sin saber si el lead está: pintar
 * «Agregar» en uno donde ya está sería afirmar algo que no se midió.
 *
 * ⚠️ Y LA ETAPA DE LA CASA ES LA DE LA PANTALLA, no la del server: el server sólo se relee después
 * de agregar, quitar o mover en un agregado, así que tras mover la casa con el wizard su respuesta
 * guardada queda vieja. La pantalla se relee después de cada movimiento (ficha-cambio.tsx).
 */
export function funnelsDelArbol(o: {
  /** Los funnels del workspace (la foto con la que la pantalla se dibuja al toque). */
  foto: ReadonlyArray<{ id: number; nombre: string; esDefault: boolean }>;
  productos: readonly FunnelDelServer[] | null;
  /** La casa según la pantalla (`leads.funnel_id`, con el NULL ya resuelto al del negocio). */
  casaId: number | null;
  etapasCasa: readonly EtapaDelArbol[];
  etapaCasa: string | null;
}): FunnelDelArbol[] {
  const casa = (id: number, nombre: string): FunnelDelArbol => ({
    id, nombre, esta: true, esCasa: true, etapa: o.etapaCasa, etapas: o.etapasCasa,
  });
  if (!o.productos) {
    const id = o.casaId ?? o.foto.find((f) => f.esDefault)?.id ?? 0;
    return [casa(id, o.foto.find((f) => f.id === id)?.nombre ?? 'Funnel')];
  }
  return o.productos.map((p) => (p.id === o.casaId && p.esCasa
    ? casa(p.id, p.nombre)
    : { id: p.id, nombre: p.nombre, esta: p.esta, esCasa: p.esCasa, etapa: p.etapa, etapas: p.etapas }));
}

const BANDAS = ['pipeline', 'nutricion', 'salidas'] as const;
const bandaDe = (s: EtapaDelArbol) => {
  const i = BANDAS.indexOf((s.band ?? 'pipeline') as (typeof BANDAS)[number]);
  return i < 0 ? 0 : i;
};

/**
 * Las etapas en el orden del tablero: Pipeline, después Nutrición, después Salida, y adentro de
 * cada banda por columna (si la trae) o en el orden en que llegaron.
 */
export function etapasEnOrden(etapas: readonly EtapaDelArbol[]): EtapaDelArbol[] {
  return etapas
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (bandaDe(a.s) - bandaDe(b.s))
      || ((a.s.col ?? a.i) - (b.s.col ?? b.i))
      || (a.i - b.i))
    .map((x) => x.s);
}

/**
 * Las SECCIONES del desplegable: una por funnel.
 *
 *   · Donde está: sus etapas —con una línea entre bandas en vez de un rótulo por renglón: «Nutrición»
 *     debajo de cada etapa de nutrición era ruido— y, al fondo, «Quitar de este funnel» si se puede.
 *     La fila de la raíz dice su etapa actual (`resumen`), así se lee en qué etapa está en cada
 *     funnel sin entrar.
 *   · Donde no está: una sola opción, «Agregar a este funnel», y la fila dice «No está».
 *
 * ⚠️ EL TÍTULO DE UNA SECCIÓN ES SU IDENTIDAD en el Dropdown (la navegación va por títulos), así que
 * dos funnels con el mismo nombre se desambiguan acá: con el mismo título, entrar a uno abriría el
 * otro.
 *
 * Sin íconos en los funnels ni en las etapas: los nombra cada negocio (regla de la casa, «un
 * desplegable lleva ícono en las opciones estandarizables»). Sí en «Agregar» y «Quitar», que son
 * acciones.
 */
export function seccionesDelArbol(funnels: readonly FunnelDelArbol[], puedeQuitar: boolean): DropdownGroup[] {
  const vistos = new Map<string, number>();
  return funnels.map((f) => {
    const n = (vistos.get(f.nombre) ?? 0) + 1;
    vistos.set(f.nombre, n);
    const title = n > 1 ? `${f.nombre} (${n})` : f.nombre;
    if (!f.esta) {
      return {
        title, resumen: 'No está', activo: false,
        options: [{ value: valorAgregar(f.id), label: 'Agregar a este funnel', icono: 'agregar', buscar: f.nombre }],
      };
    }
    const orden = etapasEnOrden(f.etapas);
    const options: DropdownOption[] = orden.map((s, i) => ({
      value: valorEtapa(f.id, s.key), label: s.label, color: s.dot, buscar: f.nombre,
      ...(i > 0 && bandaDe(s) !== bandaDe(orden[i - 1]) ? { lineaArriba: true } : {}),
    }));
    if (accionDelRenglon(true, puedeQuitar) === 'quitar') {
      options.push({ value: valorQuitar(f.id), label: 'Quitar de este funnel', icono: 'quitar', lineaArriba: true, buscar: f.nombre });
    }
    const actual = f.etapas.find((s) => s.key === f.etapa)?.label ?? 'Etapa borrada';
    return { title, resumen: actual, activo: true, options };
  });
}

/** El funnel que nombra el botón: el que se mira, o la casa, o el primero. */
export function funnelEnVista(funnels: readonly FunnelDelArbol[], idEnVista: number | null): FunnelDelArbol | null {
  return funnels.find((f) => f.id === idEnVista && f.esta) ?? funnels.find((f) => f.esCasa) ?? funnels[0] ?? null;
}
