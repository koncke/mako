// =============================================================================
// La comparación con la competencia, app por app (14/11/2026)
// =============================================================================
// Martín (14/11/2026), sobre /vsl/comparaciones: «no es como la referencia: que sea scrolleable, una tabla de lo que la competencia
// tiene o no tiene, con comentarios, y las tarjetas de MaKo vs tal cosa abajo». El molde es beehiiv.com/comparisons (relevado en
// la carpeta de notas, referencias-comparar/beehiiv-comparisons.md): MaKo fijo y los competidores en columnas que se deslizan; ✓ en
// su círculo si la app lo tiene, la celda VACÍA si no, un valor corto si hay un matiz; sin notas dentro de la tabla (el porqué va
// en las tarjetas y en la página de cada uno).
//
// LO QUE SE DICE DE OTRA APP ES PÚBLICO: cada celda de los competidores sale de una investigación con su fuente (la web oficial de
// la app: precios, funciones, ayuda), en ./competencia-datos.ts. Lo que no se pudo confirmar queda «sin dato», nunca como un «no».
// Las de MaKo salen del código: lo que es sólo de Pro (lib/topes-plan.ts) dice «En Pro», y el precio es el de Esencial.
// =============================================================================

import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako';
import { FUNCIONES_SOLO_PRO, TABS_SOLO_PRO } from '@/lib/topes-plan';
import { COMPETIDORES_RELEVADOS, RELEVADO_EL } from './competencia-datos';

export type ClaveFila =
  | 'precio' | 'landings' | 'landings_ia' | 'copiar_landing' | 'spy' | 'dominio'
  | 'crm' | 'tracking' | 'agenda' | 'cuotas' | 'llamadas_ia'
  | 'whatsapp' | 'instagram_dm' | 'setter_ia' | 'automatizaciones' | 'email'
  | 'copy_ia' | 'editor_imagen' | 'editor_video' | 'video_ia' | 'ads_ia' | 'calendario'
  | 'cursos' | 'comunidad' | 'asistente_ia' | 'espanol';

/** Una celda: 'si' (✓), 'no' (vacía), '?' (sin dato: no se pudo confirmar) o un valor corto. */
export type Celda = { v: string; fuente?: string };

export type Competidor = {
  nombre: string;
  slug: string;
  web: string;
  /** El logo original (public/vsl-assets/logos/apps). */
  logo: string;
  celdas: Partial<Record<ClaveFila, Celda>>;
  /** «Elige {X} si»: su mejor caso, reconocido con honestidad. */
  eligeSi: readonly string[];
  /** Una frase: la limitación concreta y lo que le cuesta a quien vende High Ticket. */
  comentario: string;
};

/** Los grupos y sus filas, de lo que más se compara (el precio) a lo que menos, con nombres de marketing de 1 a 4 palabras. */
export const GRUPOS_MATRIZ: ReadonlyArray<{ titulo: string; filas: ReadonlyArray<{ clave: ClaveFila; nombre: string }> }> = [
  { titulo: 'Precio', filas: [{ clave: 'precio', nombre: 'Precio para empezar' }] },
  { titulo: 'Captación de leads', filas: [
    { clave: 'landings', nombre: 'Landings' },
    { clave: 'landings_ia', nombre: 'Landings con IA' },
    { clave: 'copiar_landing', nombre: 'Copiar landings de otros' },
    { clave: 'spy', nombre: 'Espiar a la competencia' },
    { clave: 'dominio', nombre: 'Dominio propio' },
  ] },
  { titulo: 'CRM y ventas', filas: [
    { clave: 'crm', nombre: 'CRM con pipelines' },
    { clave: 'tracking', nombre: 'Tracking de cada lead' },
    { clave: 'agenda', nombre: 'Agenda de llamadas' },
    { clave: 'cuotas', nombre: 'Cobros en cuotas' },
    { clave: 'llamadas_ia', nombre: 'Análisis de llamadas con IA' },
  ] },
  { titulo: 'Chats y automatizaciones', filas: [
    { clave: 'whatsapp', nombre: 'Bandeja de WhatsApp' },
    { clave: 'instagram_dm', nombre: 'DMs de Instagram' },
    { clave: 'setter_ia', nombre: 'Setter con IA' },
    { clave: 'automatizaciones', nombre: 'Automatizaciones' },
    { clave: 'email', nombre: 'Email marketing' },
  ] },
  { titulo: 'Contenido y anuncios', filas: [
    { clave: 'copy_ia', nombre: 'Copywriting con IA' },
    { clave: 'editor_imagen', nombre: 'Editor de imágenes' },
    { clave: 'editor_video', nombre: 'Editor de video' },
    { clave: 'video_ia', nombre: 'Edición de video con IA' },
    { clave: 'ads_ia', nombre: 'Anuncios de Meta con IA' },
    { clave: 'calendario', nombre: 'Calendario de contenido' },
  ] },
  { titulo: 'Entrega', filas: [
    { clave: 'cursos', nombre: 'Cursos' },
    { clave: 'comunidad', nombre: 'Comunidad' },
  ] },
  { titulo: 'IA e idioma', filas: [
    { clave: 'asistente_ia', nombre: 'Asistente con IA de tu negocio' },
    { clave: 'espanol', nombre: 'En español' },
  ] },
];

/** Lo que es sólo de MaKo Pro, de la tabla de los planes (lib/topes-plan.ts): en la columna de MaKo dice «En Pro». */
const SOLO_PRO: Partial<Record<ClaveFila, boolean>> = {
  copiar_landing: (FUNCIONES_SOLO_PRO as readonly string[]).includes('replicar-landing'),
  video_ia: (FUNCIONES_SOLO_PRO as readonly string[]).includes('ia-editores'),
  comunidad: (FUNCIONES_SOLO_PRO as readonly string[]).includes('comunidad'),
  llamadas_ia: (TABS_SOLO_PRO as readonly string[]).includes('closing-analyst'),
};

/** La columna de MaKo: todo, con el precio de Esencial y «En Pro» en lo que es de Pro. */
export function celdaDeMaKo(clave: ClaveFila): Celda {
  if (clave === 'precio') return { v: `US$ ${PLANES_MAKO_DEFAULT.find((p) => p.id === 'esencial')?.precioUsd ?? 47}` };
  return { v: SOLO_PRO[clave] ? 'En Pro' : 'si' };
}

export const COMPETIDORES: readonly Competidor[] = COMPETIDORES_RELEVADOS;
export { RELEVADO_EL };

export const competidorDeSlug = (slug: string): Competidor | undefined => COMPETIDORES.find((c) => c.slug === slug);

export const rutaVs = (c: Pick<Competidor, 'slug'>): string => `/vsl/comparaciones/${c.slug}`;

/** «Elige MaKo si»: las mismas cinco en todas las páginas (como beehiiv). */
export const ELIGE_MAKO_SI: readonly string[] = [
  'Vendes servicios, mentorías o programas de ticket alto.',
  'Quieres tu CRM, tu WhatsApp y tus landings en una sola app.',
  'Quieres que la IA conteste, haga el seguimiento y agende por ti.',
  'Quieres ver lo que le funciona a tu competencia y replicarlo.',
  'Trabajas en español, con personas reales del otro lado.',
];
