// =============================================================================
// ficha/galeria — lo que decide la galería de una tab, PURO: cuándo se abre sola, qué se mira y qué se guarda
// =============================================================================
// Martín, 16/10/2026: «Si nunca configuró una tab, y entra por primera vez al detail de un lead, que le salten los
// templates y el ¿Qué vas a crear hoy?... Y que pueda elegir». El dibujo es ./GaleriaTab.tsx; esto se prueba
// ejecutándolo (tests/ficha-galeria.test.ts).
//
// ⚠️ MIRAR NO GUARDA NADA; ELEGIR SÍ. Lo que se mira es un CAMBIO (`VistaGaleria`) que todavía no se mandó: la tab de
//    abajo se dibuja con la ficha que QUEDARÍA (`fichaConVista`: el mismo `aplicarCambio` y `fichaEfectiva` que corren al
//    guardar), así lo que se ve es exactamente lo que se guarda. «Usar» manda ese mismo cambio.
// ⚠️ SE ABRE SOLA sólo para quien personaliza (el admin con la ficha del funnel leída), en una tab que nadie configuró
//    en ese funnel (`configuradas`, lib/ficha/config.ts), que no cerró en este navegador («Ahora no») y fuera de
//    «Personalizar» (ahí se abre con «Plantillas»). Un no-admin nunca la ve: ve la sugerida, que es lo que ya se dibuja.
// ⚠️ «AHORA NO» SE RECUERDA EN EL NAVEGADOR (por funnel y tab), no en el funnel: cerrar no es elegir, y escribirlo en
//    la ficha le cambiaría la ficha a todos. La tab se queda con la sugerida.
// ⚠️ UNA HOJA PROPIA (17/10/2026) TAMBIÉN TIENE GALERÍA: «En blanco» y las plantillas de TODAS las tabs (en una hoja
//    propia va cualquier bloque), sin «Sugerido» (una hoja nueva no tiene un tipo que la sugiera). Elegir una COPIA sus
//    bloques una vez: la hoja no la sigue después (lib/ficha/config.ts). «Nueva hoja» es esta misma galería antes de
//    que la hoja exista: lo que se elige la crea (`cambioDeNueva`).
// ⚠️ NADA DE ESTO PASA EN UN CELULAR: «Personalizar» no va en el celular (decisión de b1) y la galería tampoco
//    (./ficha-css.ts la esconde a lo ancho de un teléfono; la tab sigue con la sugerida debajo).
// =============================================================================

import { aplicarCambio, fichaEfectiva, listaDeEntradaTab, type BloquePuesto, type CambioFicha, type FichaEfectiva, type FichaGuardada, type RespaldoNegocio } from '@/lib/ficha/config';
import { bloqueDef, esTabFicha, TABS_FICHA, type BloqueId, type IdHoja, type LugarFicha, type TabFicha } from '@/lib/ficha/catalogo';
import type { PlantillaId } from '@/lib/ficha/plantillas';
import { galeriaDeTab, plantillaTabPorId, type PlantillaTab, type PlantillaTabEnGaleria } from '@/lib/ficha/plantillas-tab';
import { spansPorDispositivo } from './armar';

/** Lo que se está mirando en la galería: una plantilla de la tab, o lo que armó MaKo con un pedido. */
export type VistaGaleria =
  | { tipo: 'plantilla'; id: string }
  | { tipo: 'mako'; bloques: BloquePuesto[]; epica: boolean };

/** «En blanco» de una hoja propia: no es una plantilla de ninguna tab (no trae el contacto del Resumen). */
export const EN_BLANCO_HOJA: PlantillaTab = { id: 'hoja-en-blanco', tab: 'resumen', nombre: 'En blanco', bajada: 'Arma la hoja desde cero.', bloques: [] };

/** El cambio que guarda lo que se mira («Usar»). En una hoja propia, «En blanco» es la plantilla vacía (null). */
export function cambioDeVista(v: VistaGaleria, tab: LugarFicha): CambioFicha {
  if (v.tipo === 'mako') return { op: 'armar', tab, bloques: v.bloques, epica: v.epica };
  return { op: 'plantilla', tab, plantilla: v.id === EN_BLANCO_HOJA.id ? null : v.id };
}

/** El cambio que CREA la hoja nueva con lo que se eligió en «Nueva hoja» (sin nombre: el motor pone el de la plantilla). */
export function cambioDeNueva(v: VistaGaleria, hoja: IdHoja): CambioFicha {
  if (v.tipo === 'mako') return { op: 'hoja', hoja, nombre: null, bloques: v.bloques, epica: v.epica };
  return v.id === EN_BLANCO_HOJA.id ? { op: 'hoja', hoja, nombre: null } : { op: 'hoja', hoja, nombre: null, plantilla: v.id };
}

/**
 * La galería de un lugar, en su orden: la de la tab (./plantillas-tab.ts, `galeriaDeTab`), o, en una hoja propia,
 * «En blanco» y las de TODAS las tabs con bloques, sin sugerencias.
 */
export function galeriaDeLugar(lugar: LugarFicha, o: { plantilla: PlantillaId; porque?: string }): PlantillaTabEnGaleria[] {
  if (esTabFicha(lugar)) return galeriaDeTab(lugar, o);
  return [
    { plantilla: EN_BLANCO_HOJA, porque: null },
    ...TABS_FICHA.flatMap((t) => galeriaDeTab(t, { plantilla: o.plantilla }).filter((x) => x.plantilla.bloques.length > 0).map((x) => ({ plantilla: x.plantilla, porque: null }))),
  ];
}

/** La ficha del funnel tal como está. */
type Base = { eleccion: { id: PlantillaId }; guardada: FichaGuardada; respaldo: RespaldoNegocio; efectiva: FichaEfectiva };

/**
 * LA FICHA QUE QUEDARÍA si se usa lo que se mira: el mismo motor que guarda, sin guardar. Si el cambio no se puede
 * aplicar (una plantilla que ya no existe), la de hoy.
 */
export function fichaConVista(f: Base, v: VistaGaleria, tab: LugarFicha): FichaEfectiva {
  const r = aplicarCambio(f.guardada, cambioDeVista(v, tab), f.eleccion.id, f.respaldo);
  return r.ok ? fichaEfectiva(f.eleccion.id, r.ficha, f.respaldo) : f.efectiva;
}

/**
 * ¿Lo que se mira es lo que la tab ya tiene? La plantilla en uso, sin bloques tocados y con la épica de la plantilla.
 * Si la tab se tocó, mirar su plantilla muestra la plantilla LIMPIA, y «Usar» la devuelve a eso.
 */
export function esLaDeHoy(f: Pick<Base, 'efectiva'>, v: VistaGaleria, tab: LugarFicha): boolean {
  // Una hoja propia no está «en» ninguna plantilla: elegir una siempre la vuelve a copiar.
  if (!esTabFicha(tab)) return false;
  const ef = f.efectiva;
  return v.tipo === 'plantilla' && v.id === ef.plantillasTab[tab] && !ef.tocadas.includes(tab)
    && ef.epica[tab] === !!plantillaTabPorId(v.id)?.epico;
}

/** El rótulo del botón que elige: «Usar la sugerida» si se mira la sugerida, si no «Usar esta». */
export function rotuloUsar(v: VistaGaleria, sugerida: string | null): string {
  return v.tipo === 'plantilla' && v.id === sugerida ? 'Usar la sugerida' : 'Usar esta';
}

/** Un rectángulo de la miniatura de una plantilla: el bloque, su título y las columnas que ocupa en escritorio. */
export type PiezaMiniatura = { id: BloqueId; titulo: string; span: number };

/**
 * LA MINIATURA de una plantilla (la tarjeta de la galería, como las de «Nueva hoja»): los bloques que se DIBUJARÍAN
 * (los que tienen componente: `registrado`), con el respaldo del negocio y la grilla de la tab (épica si la plantilla
 * lo es). Sin datos del lead: es la forma de la tab, no lo que dice.
 */
export function miniaturaDe(pt: PlantillaTab, respaldo: RespaldoNegocio, registrado: (id: BloqueId) => boolean): PiezaMiniatura[] {
  const lista = listaDeEntradaTab(pt, pt.tab, respaldo).filter((b) => registrado(b.id));
  const spans = spansPorDispositivo(lista.map((b) => b.ancho), !!pt.epico).escritorio;
  return lista.map((b, i) => ({ id: b.id, titulo: bloqueDef(b.id)?.titulo ?? b.id, span: spans[i] }));
}

/**
 * Los ejemplos de la caja, por tab (los que se escriben solos). GENÉRICOS a propósito (AGENTS.md: un ejemplo de UI es
 * ficticio por regla): lo que mira cualquier negocio, sin el nombre de un lead, un producto ni un cliente.
 */
/** Los de una hoja propia: mezclan bloques de varias tabs, que es para lo que existe. */
export const EJEMPLOS_HOJA: readonly string[] = [
  'Lo que necesito para cerrarle la venta',
  'Su contacto, sus reuniones y lo que pagó',
  'Todo lo que vio antes de agendar',
];

export const EJEMPLOS_TAB: Readonly<Record<TabFicha, readonly string[]>> = {
  resumen: [
    'Lo que tengo que hacer con este lead, en grande',
    'Su contacto y lo que contestó en el formulario',
    'Lo que necesita mi setter para llamarlo',
  ],
  reuniones: [
    'La próxima reunión y lo que salió de la última',
    'Sólo las reuniones, grandes',
  ],
  pagos: [
    'Cuánto pagó y cuánto le falta',
    'Las cuotas y los links de pago',
  ],
  tracking: [
    'Qué vio del video y de dónde vino',
    'Sus visitas a la página',
  ],
};
