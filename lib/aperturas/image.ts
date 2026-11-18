// =============================================================================
// Las aperturas del Image Editor: el diseño en blanco, su plantilla sugerida y la marca que falta (PURO; 5/11 y 18/11/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §4 («Image»), T12. Con el diseño EN BLANCO (una página sin nada) y la charla vacía, el chat del
// editor pregunta un HECHO, «¿Dónde lo vas a publicar?», y cada respuesta pone el lienzo a la medida de ese lugar, sin IA
// (`editor.pages.resize`, el mismo del panel de tamaño). Lo contestado vale para ESE diseño (alcance `entidad`).
//
// El plan nombra cuatro lugares (Historia, Carrusel, Anuncio, Miniatura): con el botón de callar obligatorio entran tres
// (`MAX_BOTONES`), y la miniatura de YouTube no es de las piezas de un negocio que vende por Instagram y anuncios. Queda en el
// panel de tamaño, donde ya está.
//
// LA SUGERIDA DE ESA FAMILIA (18/11/2026, F18 de docs/pendientes-verificados-17-11.md; plan.md §4: «la sugerida de esa familia
// llega con las plantillas reales»). Elegido el lugar, si hay una plantilla real de ese grupo (lib/image-editor/plantillas-reales.ts),
// el paso que sigue la ofrece: «Usar la plantilla» la pone en la página (la misma `applyTemplate` del panel «Diseño», sin IA) y
// «Lo edito yo» deja la página en blanco. El carrusel no tiene plantilla real (los de MaKo por tipo nacen en el server, con la
// marca del negocio): ahí no hay segundo paso. Es la PRIMERA plantilla del grupo, en el orden del catálogo: ninguna señal del
// negocio la mueve (la apertura no lee el negocio).
// ⚠️ Los botones `hacer` no se anotan (lib/aperturas/reglas.ts): qué lugar se eligió lo dice el panel como un HECHO (`familia`),
//    no la memoria. Sin elegir, la página en blanco sigue preguntando dónde.
//
// LA MARCA QUE FALTA (18/11/2026, F44; reemplaza el link «Todavía no tengo tu marca. Sube tu manual de marca» del saludo de
// PanelMakoIA.tsx): con algo en la página, la charla vacía y el negocio SIN ningún kit de marca (lib/marca/kits.ts; «no pude
// leer» no cuenta), pregunta el hecho, «¿Tienes un manual de marca o un logo?». «Sí, lo subo» lleva a la sección de la marca del
// Second Brain; «Todavía no» lo contesta (no vuelve a preguntar en ningún diseño: es del negocio, alcance `negocio`); «Ahora
// no» calla 14 días. Con el diseño EN BLANCO va primero la medida: un paso por pantalla, y una página vacía todavía no tiene en
// qué usar la marca.
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';
import { PLANTILLAS_IMAGEN, type GrupoImagen, type PlantillaImagen } from '../image-editor/plantillas-reales';
import { rutaSeccion } from '../secciones-negocio';

export type HechosImage = {
  diseno: string | null;
  enBlanco: boolean;
  charlaVacia: boolean;
  /** El negocio no tiene ningún kit de marca (leído: con la lectura caída es `false`). */
  sinMarca: boolean;
  /** El lugar que la persona eligió en «¿Dónde lo vas a publicar?», en esta visita (null: todavía ninguno). */
  familia: AccionImage | null;
};

export const ACCIONES_IMAGE = ['historia', 'carrusel', 'anuncio', 'usar-sugerida'] as const;
export type AccionImage = Exclude<(typeof ACCIONES_IMAGE)[number], 'usar-sugerida'>;
export type AccionAperturaImage = (typeof ACCIONES_IMAGE)[number];
/** Los lugares de «¿Dónde lo vas a publicar?», en el orden de sus botones. */
export const LUGARES_IMAGE: readonly AccionImage[] = ['historia', 'carrusel', 'anuncio'];

/** La medida de cada lugar, en píxeles: la historia 9:16, el carrusel 4:5 (Instagram), el anuncio 1:1 (el feed de Meta). */
export const MEDIDA_DE: Readonly<Record<AccionImage, { ancho: number; alto: number }>> = {
  historia: { ancho: 1080, alto: 1920 },
  carrusel: { ancho: 1080, alto: 1350 },
  anuncio: { ancho: 1080, alto: 1080 },
};

/** El grupo de plantillas reales de cada lugar. El carrusel no tiene (los de MaKo por tipo se arman en el server). */
const GRUPO_DE: Readonly<Record<AccionImage, GrupoImagen | null>> = { historia: 'Historias', carrusel: null, anuncio: 'Anuncios' };
const PALABRA_DE: Readonly<Record<AccionImage, string>> = { historia: 'una historia', carrusel: 'un carrusel', anuncio: 'un anuncio' };

/** La plantilla real que se sugiere para un lugar: la primera de su grupo en el catálogo, o null. */
export function sugeridaDe(familia: AccionImage): PlantillaImagen | null {
  const g = GRUPO_DE[familia];
  return g ? PLANTILLAS_IMAGEN.find((p) => p.grupo === g) ?? null : null;
}

/** «Historia · Últimos lugares · Formación» → «Últimos lugares»: el nombre corto, el que va entre comillas. */
export const nombreCorto = (p: PlantillaImagen): string => p.nombre.split(' · ')[1]?.trim() || p.nombre;

export const ID_DONDE = 'image:donde';
export const ID_SUGERIDA = 'image:sugerida';
export const ID_MARCA = 'image:marca';

export function aperturaImage(h: HechosImage, r: Respuestas): Apertura<AccionAperturaImage> | null {
  if (!h.diseno || !h.charlaVacia) return null;
  if (h.enBlanco) {
    const s = h.familia ? sugeridaDe(h.familia) : null;
    if (h.familia && s) {
      return {
        id: ID_SUGERIDA, alcance: 'entidad', entidad: h.diseno,
        texto: `Quedó a la medida de ${PALABRA_DE[h.familia]}. Para eso tengo la plantilla «${nombreCorto(s)}».`,
        botones: [
          { tipo: 'hacer', rotulo: 'Usar la plantilla', accion: 'usar-sugerida' },
          { tipo: 'callar', rotulo: 'Lo edito yo' },
        ],
      };
    }
    return {
      id: ID_DONDE, alcance: 'entidad', entidad: h.diseno,
      texto: '¿Dónde lo vas a publicar?',
      botones: [
        { tipo: 'hacer', rotulo: 'En una historia', accion: 'historia' },
        { tipo: 'hacer', rotulo: 'En un carrusel', accion: 'carrusel' },
        { tipo: 'hacer', rotulo: 'En un anuncio', accion: 'anuncio' },
        { tipo: 'callar', rotulo: 'Lo edito yo' },
      ],
    };
  }
  if (h.sinMarca && r[ID_MARCA] == null) {
    return {
      id: ID_MARCA, alcance: 'negocio',
      texto: 'Todavía no tengo tu marca. ¿Tienes un manual de marca o un logo?',
      botones: [
        { tipo: 'ir', rotulo: 'Sí, lo subo', href: rutaSeccion('marca') },
        { tipo: 'respuesta', rotulo: 'Todavía no', valor: 'no' },
        { tipo: 'callar', rotulo: 'Ahora no' },
      ],
    };
  }
  return null;
}

export const SUPERFICIE_IMAGE: Superficie<HechosImage, AccionAperturaImage> = { id: 'image', acciones: ACCIONES_IMAGE, apertura: aperturaImage };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_DONDE, cuando: 'Un diseño con una página sin nada, y la charla vacía.' },
  { id: ID_SUGERIDA, cuando: 'Recién elegido el lugar (historia o anuncio) en la página en blanco: ofrece la primera plantilla real de ese grupo.' },
  { id: ID_MARCA, cuando: 'Con algo en la página, la charla vacía y el negocio sin ningún kit de marca.' },
];

const DISENO = '7c1e4a90-2b3d-4f5e-8a6b-9c0d1e2f3a4b';
const H: HechosImage = { diseno: DISENO, enBlanco: true, charlaVacia: true, sinMarca: false, familia: null };
export const EJEMPLOS: readonly { nombre: string; h: HechosImage; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'el diseño en blanco', h: H, r: {}, espera: ID_DONDE, primerPaso: true },
  { nombre: 'en blanco y sin marca: primero la medida', h: { ...H, sinMarca: true }, r: {}, espera: ID_DONDE, primerPaso: true },
  { nombre: 'eligió la historia: la plantilla de historias', h: { ...H, familia: 'historia' }, r: {}, espera: ID_SUGERIDA },
  { nombre: 'eligió el anuncio: la plantilla de anuncios', h: { ...H, familia: 'anuncio' }, r: {}, espera: ID_SUGERIDA },
  { nombre: 'eligió el carrusel: no hay plantilla real, sigue la medida', h: { ...H, familia: 'carrusel' }, r: {}, espera: ID_DONDE, primerPaso: true },
  { nombre: 'con algo en la página', h: { ...H, enBlanco: false }, r: {}, espera: null },
  { nombre: 'con algo en la página y sin marca', h: { ...H, enBlanco: false, sinMarca: true }, r: {}, espera: ID_MARCA, primerPaso: true },
  { nombre: 'sin marca, pero ya dijo «Todavía no»', h: { ...H, enBlanco: false, sinMarca: true }, r: { [ID_MARCA]: 'no' }, espera: null },
  { nombre: 'sin marca y con la charla empezada', h: { ...H, enBlanco: false, sinMarca: true, charlaVacia: false }, r: {}, espera: null },
  { nombre: 'con la charla empezada', h: { ...H, charlaVacia: false }, r: {}, espera: null },
  { nombre: 'sin diseño abierto', h: { ...H, diseno: null }, r: {}, espera: null },
];
