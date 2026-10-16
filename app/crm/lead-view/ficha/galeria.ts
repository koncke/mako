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
// ⚠️ NADA DE ESTO PASA EN UN CELULAR: «Personalizar» no va en el celular (decisión de b1) y la galería tampoco
//    (./ficha-css.ts la esconde a lo ancho de un teléfono; la tab sigue con la sugerida debajo).
// =============================================================================

import { aplicarCambio, fichaEfectiva, listaDeEntradaTab, type BloquePuesto, type CambioFicha, type FichaEfectiva, type FichaGuardada, type RespaldoNegocio } from '@/lib/ficha/config';
import { bloqueDef, type BloqueId, type TabFicha } from '@/lib/ficha/catalogo';
import type { PlantillaId } from '@/lib/ficha/plantillas';
import { plantillaTabPorId, type PlantillaTab } from '@/lib/ficha/plantillas-tab';
import { spansPorDispositivo } from './armar';

/** Lo que se está mirando en la galería: una plantilla de la tab, o lo que armó MaKo con un pedido. */
export type VistaGaleria =
  | { tipo: 'plantilla'; id: string }
  | { tipo: 'mako'; bloques: BloquePuesto[]; epica: boolean };

/** El cambio que guarda lo que se mira («Usar»). */
export function cambioDeVista(v: VistaGaleria, tab: TabFicha): CambioFicha {
  return v.tipo === 'plantilla' ? { op: 'plantilla', tab, plantilla: v.id } : { op: 'armar', tab, bloques: v.bloques, epica: v.epica };
}

/** La ficha del funnel tal como está. */
type Base = { eleccion: { id: PlantillaId }; guardada: FichaGuardada; respaldo: RespaldoNegocio; efectiva: FichaEfectiva };

/**
 * LA FICHA QUE QUEDARÍA si se usa lo que se mira: el mismo motor que guarda, sin guardar. Si el cambio no se puede
 * aplicar (una plantilla que ya no existe), la de hoy.
 */
export function fichaConVista(f: Base, v: VistaGaleria, tab: TabFicha): FichaEfectiva {
  const r = aplicarCambio(f.guardada, cambioDeVista(v, tab), f.eleccion.id, f.respaldo);
  return r.ok ? fichaEfectiva(f.eleccion.id, r.ficha, f.respaldo) : f.efectiva;
}

/**
 * ¿Lo que se mira es lo que la tab ya tiene? La plantilla en uso, sin bloques tocados y con la épica de la plantilla.
 * Si la tab se tocó, mirar su plantilla muestra la plantilla LIMPIA, y «Usar» la devuelve a eso.
 */
export function esLaDeHoy(f: Pick<Base, 'efectiva'>, v: VistaGaleria, tab: TabFicha): boolean {
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
