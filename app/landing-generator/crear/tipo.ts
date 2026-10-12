// =============================================================================
// crear/tipo — QUÉ se crea (landing o presentación) y lo que eso cambia al crear
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 6), textual: «Al momento de crear nuevo tengo
// que elegir si crear landing, presentación... Sería bueno que ahí aparezcan los templates
// (deberías hacer más templates de presentaciones)... Y también quiero ahí mismo agregar la
// funcionalidad que tenemos en "nueva automatización", donde le escribo a la IA o le mando un
// audio, pero me gusta el formato que hiciste de "¿Qué vas a crear hoy?", solo falta agregar
// la funcionalidad de dictarle con audio, como lo tenemos en donde te mencioné.»
// Decisión T4 de docs/diseno-editor-landing.md.
//
// Lo PURO de elegir el tipo, en un módulo sin 'use client' para que tenga test
// (tests/editor-landing-crear.test.ts): la caja del Panel (CajaCrear.tsx) y el generador
// (crear/CrearConIA.tsx) lo llaman tal cual, así las dos puertas crean lo MISMO.
//
// ⚠️ UNA PRESENTACIÓN CREADA SIN `formato` NACE COMO PÁGINA: `sanearConfig` completa lo que
//    falta con 'pagina' y nada avisa. Por eso el `config` del alta sale SIEMPRE de
//    `configDeCreacion` / `pedidoDePlantilla`, nunca de un objeto armado en la pantalla.
// ⚠️ Y `params.formato` es lo único que le dice a la IA que escriba diapositivas (ia.ts lo lee
//    del pedido CRUDO: `normalizarParams` no lo conoce). Todo pedido de esquema y de secciones
//    pasa por `paramsDeTipo`; si uno se olvida, esa tanda sale con el copy largo de una landing.
// =============================================================================

import {
  terminoTarjeta, type ConfigLanding, type FormatoDoc, type ParamsGeneracion, type PedidoDocs, type Proporcion,
} from '@/lib/editor-landing/api-tipos';
import type { LandingContenido } from '@/lib/editor-landing/doc';
import { PLANTILLAS } from '@/lib/editor-landing/plantillas';
import { PLANTILLAS_PRESENTACION } from '@/lib/editor-landing/plantillas-presentaciones';

export const TIPOS_CREAR = ['landing', 'presentacion'] as const;
export type TipoCrear = (typeof TIPOS_CREAR)[number];

/** El tipo de la query (`?tipo=presentacion`); cualquier otra cosa es una landing. */
export function tipoValido(v: string | null | undefined): TipoCrear {
  return v === 'presentacion' ? 'presentacion' : 'landing';
}

/** El formato del documento que crea cada tipo (api-tipos.ts, T3). */
export const formatoDeTipo = (t: TipoCrear): FormatoDoc => (t === 'presentacion' ? 'presentacion' : 'pagina');

/** La proporción con la que nace una presentación de la IA (la de Gamma por default). */
export const PROPORCION_IA: Proporcion = '16:9';

/** Rótulo de la pastilla y nombre del documento en las frases de la pantalla. */
export const NOMBRE_TIPO: Record<TipoCrear, string> = { landing: 'Landing', presentacion: 'Presentación' };
export const ICONO_TIPO: Record<TipoCrear, string> = { landing: 'paginas', presentacion: 'presentar' };

/** «landing» / «presentación», en minúscula, para el medio de una frase. */
export const docDe = (t: TipoCrear): string => (t === 'presentacion' ? 'presentación' : 'landing');

/**
 * «sección» o «diapositiva» (con `plural` y `mayuscula`): es `terminoTarjeta` de api-tipos, la
 * MISMA palabra que dice el editor, así crear y editar no llaman distinto a lo mismo.
 */
export function termino(t: TipoCrear, op: { plural?: boolean; mayuscula?: boolean } = {}): string {
  return terminoTarjeta({ formato: formatoDeTipo(t) }, op);
}

/** «8 secciones» / «1 diapositiva». */
export function cuantas(n: number, t: TipoCrear): string {
  return `${n} ${termino(t, { plural: n !== 1 })}`;
}

/**
 * Los parámetros que viajan a la IA. Con una presentación, `formato` pide diapositivas, y la
 * landing de base («Sobre cuál») se suelta: el diagnóstico de una PÁGINA no es contexto de una
 * presentación, y se lo mandaría al prompt sin que la pantalla lo muestre. Con una landing,
 * `formato: 'pagina'` explícito: si la persona volvió de Presentación, no queda pegado.
 */
export function paramsDeTipo(p: ParamsGeneracion, t: TipoCrear): ParamsGeneracion {
  return { ...p, formato: formatoDeTipo(t), basadoEnUrl: t === 'presentacion' ? null : p.basadoEnUrl };
}

/** El `config` con el que nace un documento de la IA: el tema, el origen y su formato. */
export function configDeCreacion(t: TipoCrear, tema: string, origen: NonNullable<ConfigLanding['origen']>): Partial<ConfigLanding> {
  return t === 'presentacion'
    ? { tema, origen, formato: 'presentacion', proporcion: PROPORCION_IA }
    : { tema, origen, formato: 'pagina' };
}

/** Lo común de las plantillas de landing y de presentación (la misma forma, T3). */
export type PlantillaCrear = {
  id: string;
  nombre: string;
  descripcion: string;
  tema: string;
  contenido: () => LandingContenido;
  /** Sólo las de presentación: viene en la plantilla y viaja al `config`. */
  formato?: FormatoDoc;
  proporcion?: Proporcion;
};

/** Las plantillas que se ofrecen debajo de la caja, según el tipo elegido. */
export function plantillasDe(t: TipoCrear): readonly PlantillaCrear[] {
  return t === 'presentacion' ? PLANTILLAS_PRESENTACION : PLANTILLAS;
}

/**
 * El alta de una plantilla. El formato y la proporción salen de la PLANTILLA (las de
 * presentación los traen): una presentación sin ellos nacería como página.
 */
export function pedidoDePlantilla(p: PlantillaCrear): Extract<PedidoDocs, { accion: 'crear' }> {
  const origen = { modo: 'plantilla' as const, plantilla: p.id };
  const config: Partial<ConfigLanding> = p.formato === 'presentacion'
    ? { tema: p.tema, origen, formato: 'presentacion', proporcion: p.proporcion ?? PROPORCION_IA }
    : { tema: p.tema, origen, formato: 'pagina' };
  return { accion: 'crear', titulo: p.nombre, contenido: p.contenido(), config };
}

/** Tope del pedido cuando viaja en la URL (sin sessionStorage): el mismo del Panel. */
export const TOPE_PROMPT_URL = 1_500;
const RUTA_CREAR = '/landing-generator/crear';

/**
 * A dónde manda la caja al enviar. El pedido va por sessionStorage (`dejarCaja`); si no se pudo
 * guardar (ventana privada estricta), viaja en la URL, recortado. El tipo va en la URL SIEMPRE
 * que sea una presentación: `PedidoCaja` (MiniaturaLanding.tsx) no lo lleva, y sin él el
 * generador crearía una landing.
 */
export function rutaCaja(t: TipoCrear, modo: 'plan' | 'express', prompt: string, guardado: boolean): string {
  const q = new URLSearchParams({ desde: 'caja', modo });
  if (t === 'presentacion') q.set('tipo', t);
  if (!guardado) q.set('prompt', prompt.trim().slice(0, TOPE_PROMPT_URL));
  return `${RUTA_CREAR}?${q.toString()}`;
}

/** Un paso del generador (Importar archivo o URL), con el tipo elegido. */
export function rutaPaso(t: TipoCrear, paso: 'generar' | 'pegar' | 'importar'): string {
  const q = new URLSearchParams({ paso });
  if (t === 'presentacion') q.set('tipo', t);
  return `${RUTA_CREAR}?${q.toString()}`;
}

/**
 * Los ejemplos que se escriben solos en la caja (`useEjemploQueSeEscribe`). GENÉRICOS a
 * propósito: un nombre de negocio o de persona real en la pantalla de otro cliente se lee como
 * un dato (AGENTS.md, «un ejemplo de UI es ficticio por regla»).
 */
export const EJEMPLOS_CAJA: Record<TipoCrear, readonly string[]> = {
  landing: [
    'Una landing para agendar una llamada de diagnóstico',
    'El registro a un webinar en vivo sobre finanzas personales',
    'La venta de un curso online con precio y garantía',
    'Una guía gratis a cambio del correo',
    'La lista de espera para el lanzamiento de una app',
  ],
  presentacion: [
    'El pitch de mi negocio para inversionistas',
    'Una propuesta comercial para un cliente nuevo',
    'El informe mensual de resultados de marketing',
    'Una clase de un curso sobre ventas por WhatsApp',
    'El onboarding para un cliente que empieza',
  ],
};
