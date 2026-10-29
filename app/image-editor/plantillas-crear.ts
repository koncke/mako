// =============================================================================
// «Nuevo diseño»: las plantillas de «¿Qué vas a crear hoy?» del Image Editor, en la computadora Y en el teléfono
// =============================================================================
// Martín, 29/10/2026: «En "nueva" dependiendo de qué tab, deberías ponerme TEMPLATES con la sección de ¿Qué vas a crear
// hoy?». UNA lista para los dos lados: la computadora la pasa a `PantallaCrear` (app/_crear/PantallaCrear.tsx, desde
// ../ImageEditorCliente.tsx) y el teléfono la dibuja en su hoja (app/m/image-editor/InicioImagenM.tsx). Las dos crean por
// la MISMA acción (./actions.ts → `crearDisenoNuevoAction`), que arma el documento en el server.
//
//   · los TAMAÑOS en blanco son los que la API de MaKo ofrece por nombre (lib/image-editor/tamanos.ts → TAMANOS_API: los
//     de Canva más pedidos). Los otros 30 de Canva siguen en «Redimensionar» del editor (_doory/editor/dialogs/resizeSizes.ts);
//   · el CARRUSEL de Instagram (1080 × 1350, varias páginas): la tab Carousels se deprecó el 29/10/2026 y el DISEÑO de un
//     carrusel vive acá (su texto se le pide a MaKo en el mismo chat);
//   · las PLANTILLAS con diseño (las de Doory en español, ./mako/plantillas.ts), con su miniatura.
//
// Módulo PURO: lo leen el server (la acción), los dos clientes y los tests. Nada del motor (`_doory/`) más que tipos.
// El test: tests/image-editor-plantillas-crear.test.ts.
// =============================================================================

import type { PlantillaCrear } from '@/app/_crear/reglas';
import { TAMANOS_API } from '@/lib/image-editor/tamanos';
import { catalogoPlantillas } from './mako/plantillas';

/** Una tarjeta de «¿Qué vas a crear hoy?» con lo que hace falta para crear el diseño. */
export type PlantillaNuevoDiseno = PlantillaCrear & {
  /** En px (como guarda el motor). */
  ancho: number;
  alto: number;
  /** Cuántas páginas trae el diseño nuevo. */
  paginas: number;
  /** El slug de la plantilla con diseño (./mako/plantillas.ts). Sin esto, el diseño nace en blanco. */
  plantilla?: string;
};

/** Las páginas de un carrusel nuevo: la portada, tres de contenido y el cierre. Se agregan o se sacan en el editor. */
export const PAGINAS_CARRUSEL = 5;

export const ID_CARRUSEL = 'carrusel_instagram';

const formato = (ancho: number, alto: number) => `${ancho} / ${alto}`;
const rotulo = (ancho: number, alto: number) => `${ancho} × ${alto}`;

function enBlanco(id: string, nombre: string, ancho: number, alto: number, paginas = 1): PlantillaNuevoDiseno {
  return { id, nombre, ancho, alto, paginas, formato: formato(ancho, alto), rotulo: rotulo(ancho, alto) };
}

const TAMANOS = Object.entries(TAMANOS_API).map(([id, t]) => enBlanco(id, t.nombre, t.ancho, t.alto));
const CARRUSEL = enBlanco(ID_CARRUSEL, 'Carrusel de Instagram', 1080, 1350, PAGINAS_CARRUSEL);

/** El carrusel va al lado de las publicaciones de Instagram (después de la de 4:5, que es su tamaño). */
const conCarrusel = (lista: PlantillaNuevoDiseno[]): PlantillaNuevoDiseno[] => {
  const i = lista.findIndex((p) => p.ancho === CARRUSEL.ancho && p.alto === CARRUSEL.alto);
  return i < 0 ? [CARRUSEL, ...lista] : [...lista.slice(0, i + 1), CARRUSEL, ...lista.slice(i + 1)];
};

const CON_DISENO: PlantillaNuevoDiseno[] = catalogoPlantillas().map((p) => ({
  id: `plantilla-${p.slug}`,
  nombre: p.titulo,
  ancho: p.ancho,
  alto: p.alto,
  paginas: p.paginas,
  plantilla: p.slug,
  formato: formato(p.ancho, p.alto),
  // La miniatura es la de Doory, en public/cv/plantillas/ (la misma que usa el panel «Diseño» del editor).
  imagen: `/cv/plantillas/${p.slug}.webp`,
}));

/** Todas, en el orden en que se ven: primero en blanco (con el carrusel), después las que traen diseño. */
export const PLANTILLAS_NUEVO_DISENO: readonly PlantillaNuevoDiseno[] = [...conCarrusel(TAMANOS), ...CON_DISENO];

/** La plantilla con ese id, o null (la acción no confía en lo que llega del navegador). */
export function plantillaNueva(id: string): PlantillaNuevoDiseno | null {
  return PLANTILLAS_NUEVO_DISENO.find((p) => p.id === id) ?? null;
}

/** Lo que se escribe solo en la caja de «¿Qué vas a crear hoy?»: va al chat de MaKo, que crea el diseño. */
export const EJEMPLOS_NUEVO_DISENO: readonly string[] = [
  'Un post para anunciar mi promo de esta semana',
  'Un carrusel con 5 consejos de mi rubro',
  'Una historia para invitar a mi evento',
  'Una miniatura de YouTube que dé ganas de hacer clic',
];
