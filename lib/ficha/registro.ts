// =============================================================================
// ficha/registro — el CONTRATO de un bloque: lo que el armador le pasa y lo que cada bloque declara
// =============================================================================
// La ficha del lead tiene UN armador para las dos puertas (el pop-up del tablero y /crm/[id]), que hoy
// repiten el armado a mano (docs/diseno-ficha-bloques.md §3, «Para implementar»). Cada frente que hace
// bloques (la tanda B2) los enchufa con ESTA forma, sin tocar el armador:
//
//   · del lado del server, un CARGADOR por bloque: lee lo que el bloque necesita del lead y devuelve
//     `null` si no hay nada (el bloque se calla, si su `sinDatos` es 'se-calla');
//   · del lado del navegador, un COMPONENTE que recibe `PropsBloque`.
//
// El armador (la segunda etapa de este frente) es el único que recorre `bloquesDeTab` (lib/ficha/config.ts),
// llama a los cargadores de los bloques puestos y dibuja la grilla de 12 columnas con `puesto.ancho`.
//
// Sólo tipos y dos funciones puras, sin `server-only` ni `'use client'`: lo importan los dos lados.
// =============================================================================

import type { ComponentType } from 'react';
import type { BloqueDef, BloqueId, TabBloque } from './catalogo';
import type { BloquePuesto, EstiloFicha } from './config';
import { reunionesDe } from '../funnel-etapas';

/** Quién mira, en lo que le importa a un bloque (decisión 5: el coaching lo ven el admin y el closer del lead). */
export type RolFicha = 'admin' | 'closer' | 'setter' | 'otro';

/** Lo que el armador sabe de la ficha que está armando. Igual para todos los bloques de esa ficha. */
export type CtxBloque = {
  leadId: number;
  /** La casa del lead (`leads.funnel_id`; null = el producto del negocio). */
  funnelId: number | null;
  tab: TabBloque;
  rol: RolFicha;
  /** ¿Quien mira puede escribir en este lead? Un bloque editable sin permiso se dibuja de sólo lectura. */
  puedeEditar: boolean;
  /** La zona del negocio (lib/timezone.ts): las fechas y horas se dibujan en esta. */
  tz: string;
  estilo: EstiloFicha;
};

/** Lo que recibe el componente de un bloque. `datos` es lo que devolvió su cargador (null = sin datos). */
export type PropsBloque<D = unknown> = {
  puesto: BloquePuesto;
  def: BloqueDef;
  /** El título que se dibuja (`tituloDeBloque`): el de la etapa en las reuniones. */
  titulo: string;
  datos: D | null;
  ctx: CtxBloque;
};

/** El componente de un bloque, para el registro del navegador. */
export type RegistroBloque<D = unknown> = {
  id: BloqueId;
  Componente: ComponentType<PropsBloque<D>>;
  /** ¿Hay algo que dibujar? Sin esto, «hay datos» es `datos != null`. Sólo lo mira un bloque que se calla. */
  hayDatos?: (datos: D | null) => boolean;
};

/**
 * El cargador de un bloque, para el registro del server. `C` es lo que el armador ya leyó de la ficha (el
 * lead, su funnel, los pagos…): un cargador NO vuelve a leer lo que ya viene ahí.
 */
export type CargadorBloque<C, D = unknown> = {
  id: BloqueId;
  cargar: (contexto: C, puesto: BloquePuesto) => Promise<D | null>;
};

/** ¿Se dibuja? Un bloque que se calla sin datos no; uno con «—» siempre. */
export function seDibuja<D>(def: Pick<BloqueDef, 'sinDatos'>, datos: D | null, hayDatos?: (d: D | null) => boolean): boolean {
  if (def.sinDatos === 'raya') return true;
  return hayDatos ? hayDatos(datos) : datos != null;
}

/**
 * El título que se DIBUJA. En Reuniones «cada bloque toma su título del nombre de la etapa y nunca dice
 * "Reunión 1"» (§3): `reunion-1` es la primera etapa de reunión del funnel (la que guarda su fecha en el
 * primer lugar, `slotPorIndice`) y `reunion-2` la segunda. Sin esa etapa, el título del catálogo.
 */
export function tituloDeBloque(def: Pick<BloqueDef, 'id' | 'titulo'>, etapas: ReadonlyArray<{ key: string; label?: string; kind?: string }> | null | undefined): string {
  const i = def.id === 'reunion-1' ? 0 : def.id === 'reunion-2' ? 1 : -1;
  if (i < 0 || !etapas?.length) return def.titulo;
  const key = reunionesDe(etapas)[i];
  return etapas.find((e) => e.key === key)?.label?.trim() || def.titulo;
}
