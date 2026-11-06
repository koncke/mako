// =============================================================================
// Lo que decide la pantalla del Lead Magnet Generator sin dibujar nada (PURO, con tests/lead-magnets-tab.test.ts)
// =============================================================================
// La tab es la pantalla de Create (app/_crear/PantallaCrear.tsx): la lista de la izquierda son los lead magnets del negocio
// (`mako.entregable`) y «Nuevo lead magnet» son las plantillas. Acá vive cómo se ven unos y otros, y qué le falta a cada lead
// magnet para llegarle a un lead.
// =============================================================================

import type { PlantillaCrear, ProyectoCrear } from '@/app/_crear/reglas';
import { PLANTILLAS_LEAD_MAGNET, chipsDeLeadMagnet, extractoDeLeadMagnet, plantillaLeadMagnet, NOMBRE_HERRAMIENTA } from '@/lib/lead-magnets/plantillas';
import type { PiezaLM } from '@/lib/lead-magnets/pieza';

/** Lo que la pantalla sabe de un lead magnet (lo de lib/entregable.ts que viaja al navegador). */
export type LeadMagnetVista = {
  id: string;
  nombre: string;
  tipo: string;
  enlace?: string;
  pieza?: PiezaLM;
  plantilla?: string;
  pagina?: number;
};

export const RUTA_TAB = '/lead-magnet-generator';
export const RUTA_API = '/api/lead-magnet-generator';

/** El link de un lead magnet en la lista de la izquierda. */
export const rutaDeLeadMagnet = (id: string): string => `${RUTA_TAB}?lm=${encodeURIComponent(id)}`;

/** Las tarjetas de «Nuevo lead magnet»: la estructura de cada plantilla, con su ejemplo en la hoja y «Ver ejemplo» aparte. */
export function plantillasParaCrear(): PlantillaCrear[] {
  return PLANTILLAS_LEAD_MAGNET.map((pl) => ({
    id: pl.id,
    nombre: pl.nombre,
    grupo: pl.grupo,
    insignia: pl.insignia,
    ayuda: pl.ayuda,
    ejemplo: pl.ejemplo.negocio,
    extracto: extractoDeLeadMagnet(pl),
    chips: chipsDeLeadMagnet(pl),
    verEjemplo: true,
  }));
}

/** La lista de la izquierda: un renglón por lead magnet, en el orden de la lista. */
export function proyectosDe(lista: readonly LeadMagnetVista[]): Omit<ProyectoCrear, 'menu'>[] {
  return lista.map((lm) => ({ id: lm.id, nombre: lm.nombre, href: rutaDeLeadMagnet(lm.id) }));
}

/** Qué tiene y qué le falta a un lead magnet para llegarle a un lead, en el orden en que se hace. */
export type EstadoLM = {
  /** Dónde se edita la pieza (null: el lead magnet es sólo su texto, de antes de la tab). */
  herramienta: string | null;
  /** ¿Se puede crear su link público desde acá? Sólo una página del Copywriter. */
  puedeCompartir: boolean;
  /** ¿Puede tener una página de captura propia? La clase grabada ya es una página con su formulario. */
  puedeCaptar: boolean;
  /** Lo que falta, en una frase, o null si ya le llega. */
  falta: string | null;
};

export function estadoDe(lm: LeadMagnetVista): EstadoLM {
  const herramienta = lm.pieza ? NOMBRE_HERRAMIENTA[lm.pieza.herramienta] : null;
  const esPagina = lm.pieza?.herramienta === 'web';
  const puedeCompartir = lm.pieza?.herramienta === 'copywriter';
  const puedeCaptar = !esPagina;
  let falta: string | null = null;
  if (esPagina) falta = null;
  else if (!lm.enlace) falta = puedeCompartir ? 'Falta su link: escríbela y créalo.' : 'Falta su link: pégalo abajo.';
  else if (!lm.pagina) falta = 'Falta la página donde la piden.';
  return { herramienta, puedeCompartir, puedeCaptar, falta };
}

/** El nombre de la plantilla de la que nació, o null. */
export function nombreDePlantilla(lm: LeadMagnetVista): string | null {
  return plantillaLeadMagnet(lm.plantilla)?.nombre ?? null;
}

/** Lo que se escribe solo en la caja de «¿Qué vas a crear hoy?»: va al chat de MaKo. */
export const EJEMPLOS_LEAD_MAGNET: readonly string[] = [
  'Una guía con los 5 errores que comete mi cliente',
  'Un checklist para que mi cliente se revise solo',
  'Un quiz que le diga a mi cliente en qué nivel está',
  'Una clase grabada de 20 minutos',
];
