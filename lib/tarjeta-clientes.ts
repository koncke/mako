// =============================================================================
// tarjeta-clientes — lo PURO de la tarjeta de un cliente personalizable (21/10/2026)
// =============================================================================
// Martín, 21/10/2026: «el pop-up debe ser mucho más grueso y poder ver TEMPLATES de estilos de tarjeta… como las que
// tenemos en CLIENTES y puedes crear otras más, como otra que no tenga foto de perfil, piensa en varios diseños» y
// «Revisa estos feedbacks que te doy en otros lugares para implementar lo mismo, la personalización de las tarjetas en
// clientes, plan, etc.». El molde es el del CRM (lib/tarjeta-kanban.ts → PLANTILLAS_TARJETA_LEAD): UNA plantilla = una
// FORMA + los DATOS que lleva; lo genérico (cuál está puesta, las propias) vive en lib/plantillas-tarjeta.ts.
//
// Qué sabe mostrar la tarjeta de un cliente (app/customer-success/ClienteCard.tsx, sobre `TarjetaPersona`):
//   · foto     — la cara (su foto, o las iniciales con su color);
//   · empresa  — el subtítulo (su empresa, o «Cliente N» si no la tiene);
//   · avance   — la barra de la etapa del servicio y su aviso en rojo (./aviso-tarjeta.ts);
//   · trabajo  — el chip de los tres números del tablero (proyectos · tareas · recurrentes).
// El NOMBRE va siempre.
//
// ⚠️ ACÁ EL ORDEN ES EL DEL CATÁLOGO, NO EL DE LA PERSONA, y es la diferencia con el CRM. En la tarjeta de un lead la
// plata y el canal comparten el subtítulo y los chips van en fila, así que acomodarlos cambia lo que se ve; en la de un
// cliente cada dato tiene SU lugar (la cara a la izquierda, la empresa debajo del nombre, la barra, el chip), y un orden
// guardado que no cambia nada sólo serviría para que «Completa» dejara de reconocerse («Personalizada» con lo mismo).
// El pop-up se abre con `ordenFijo` (app/_ui/PersonalizarTarjetas.tsx) y no ofrece arrastrar.
//
// Se guarda POR PERSONA (`usuarios.perfil.clientesTarjeta`, lib/perfil.ts), como la del CRM: es cómo mira cada uno.
// Sin `server-only` ni `'use client'`: lo importan la pantalla, el perfil, la API de MaKo y los tests.
// =============================================================================

import { plantillasPropiasDe, type PlantillaTarjeta } from './plantillas-tarjeta';

export const CAMPOS_TARJETA_CLIENTE = ['foto', 'empresa', 'avance', 'trabajo'] as const;
export type CampoTarjetaCliente = (typeof CAMPOS_TARJETA_CLIENTE)[number];
export const NOMBRE_CAMPO_TARJETA_CLIENTE: Readonly<Record<CampoTarjetaCliente, string>> = {
  foto: 'Foto o iniciales', empresa: 'Empresa', avance: 'La etapa y su aviso', trabajo: 'Proyectos · tareas · recurrentes',
};
/** Lo de siempre: la tarjeta del 17/10 (la familia de tarjetas), con todo. */
export const CAMPOS_TARJETA_CLIENTE_DEFAULT: readonly CampoTarjetaCliente[] = ['foto', 'empresa', 'avance', 'trabajo'];

/**
 * LAS FORMAS (cómo se DIBUJA; los datos van aparte):
 *   · completa: la de la familia (17/10), con la cara y «Ver info»;
 *   · compacta: la cara chica y menos aire, para ver más clientes por columna;
 *   · portada: una banda de color arriba con la cara montada, como la tarjeta de /admin (TarjetaEntidad).
 */
export const FORMAS_TARJETA_CLIENTE = ['completa', 'compacta', 'portada'] as const;
export type FormaTarjetaCliente = (typeof FORMAS_TARJETA_CLIENTE)[number];
export const NOMBRE_FORMA_TARJETA_CLIENTE: Readonly<Record<FormaTarjetaCliente, string>> = {
  completa: 'Completa', compacta: 'Compacta', portada: 'Con portada',
};
export const DETALLE_FORMA_TARJETA_CLIENTE: Readonly<Record<FormaTarjetaCliente, string>> = {
  completa: 'La de siempre.', compacta: 'Más clientes por columna.', portada: 'Una banda de color arriba, con la cara.',
};

export type PlantillaTarjetaCliente = PlantillaTarjeta<FormaTarjetaCliente, CampoTarjetaCliente>;
export type PrefsTarjetaCliente = { forma: FormaTarjetaCliente; campos: CampoTarjetaCliente[]; plantillas: PlantillaTarjetaCliente[] };

/**
 * Lo guardado, limpio y EN EL ORDEN DEL CATÁLOGO (el porqué, arriba): sin lo desconocido ni repetidos. Sin nada
 * guardado (o algo que no es una lista): lo de siempre. Una lista vacía es una elección (sólo el nombre).
 */
export function camposTarjetaClienteDe(raw: unknown): CampoTarjetaCliente[] {
  if (!Array.isArray(raw)) return [...CAMPOS_TARJETA_CLIENTE_DEFAULT];
  return CAMPOS_TARJETA_CLIENTE.filter((c) => raw.includes(c));
}

/**
 * LAS PLANTILLAS DE FÁBRICA de Clientes (21/10/2026). La primera es la de siempre. Cada una contesta una pregunta de
 * quien mira la entrega: ¿quién es y cómo va? (Completa), ¿cuántos hay? (Compacta, Sólo el nombre), ¿en qué etapa está?
 * (Sólo la etapa), ¿cuánto trabajo tiene? (Sin avance). Sin foto y Con portada son lo mismo con otro peso visual.
 * En el orden del catálogo, todas: si no, `plantillaPuesta` no las reconocería (`camposTarjetaClienteDe` ordena).
 */
export const PLANTILLAS_TARJETA_CLIENTE: readonly PlantillaTarjetaCliente[] = [
  { id: 'fabrica:completa', nombre: 'Completa', forma: 'completa', campos: CAMPOS_TARJETA_CLIENTE_DEFAULT },
  { id: 'fabrica:compacta', nombre: 'Compacta', forma: 'compacta', campos: ['foto', 'avance'] },
  { id: 'fabrica:sin-foto', nombre: 'Sin foto', forma: 'completa', campos: ['empresa', 'avance', 'trabajo'] },
  { id: 'fabrica:portada', nombre: 'Con portada', forma: 'portada', campos: CAMPOS_TARJETA_CLIENTE_DEFAULT },
  { id: 'fabrica:sin-avance', nombre: 'Sin avance', forma: 'completa', campos: ['foto', 'empresa', 'trabajo'] },
  { id: 'fabrica:etapa', nombre: 'Sólo la etapa', forma: 'compacta', campos: ['avance'] },
  { id: 'fabrica:nombre', nombre: 'Sólo el nombre', forma: 'compacta', campos: [] },
];

/** Lo guardado en el perfil (`{ forma, campos, plantillas }`), limpio. Lo que no se entiende, lo de siempre. */
export function prefsTarjetaClientesDe(raw: unknown): PrefsTarjetaCliente {
  if (Array.isArray(raw)) return { forma: 'completa', campos: camposTarjetaClienteDe(raw), plantillas: [] };
  if (raw && typeof raw === 'object') {
    const o = raw as { forma?: unknown; campos?: unknown; plantillas?: unknown };
    const forma = (FORMAS_TARJETA_CLIENTE as readonly unknown[]).includes(o.forma) ? (o.forma as FormaTarjetaCliente) : 'completa';
    // Las propias, limpias con la MISMA regla que la tarjeta de todos los días.
    return { forma, campos: camposTarjetaClienteDe(o.campos), plantillas: plantillasPropiasDe(o.plantillas, FORMAS_TARJETA_CLIENTE, camposTarjetaClienteDe) };
  }
  return { forma: 'completa', campos: [...CAMPOS_TARJETA_CLIENTE_DEFAULT], plantillas: [] };
}
