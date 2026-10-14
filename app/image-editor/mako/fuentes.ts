// =============================================================================
// Las fuentes del editor (Google Fonts por la copia de jsDelivr de `@fontsource/*`)
// =============================================================================
// ⚠️ ARCHIVO GENERADO: no se edita a mano. Lo arma un script que lee la API de
// Fontsource sin key (`https://api.fontsource.org/v1/fonts/<id>`) y verifica con
// HEAD que CADA archivo latin exista en jsDelivr (14/10/2026). Un peso que no existe
// da 404 y el texto cae a la fuente del sistema EN SILENCIO: por eso no se escribe a mano.
// ⚠️ Un archivo «frío» de jsDelivr tardó 12,6 s en contestar (medido) y el motor corta a los 8 s
// (`LOAD_TIMEOUT_MS` de engine/fonts.ts): la primera vez puede caer a la del sistema. Alojarlas es lo
// que recomienda el relevamiento (§4.3).
//
// La lista es la curada de docs/editor-imagen/relevamiento-contenido-licencias.md §4.6
// (64 familias), + Archivo y Pinyon Script (las usan las plantillas de Doory), + Space
// Grotesk, Josefin Sans, Quicksand y Roboto Mono (estaban antes: un diseño guardado puede usarlas).
// Licencias (de Fontsource): OFL-1.1, Apache-2.0. Orden = popularidad (la de Doory).
//
// Formato compacto para no inflar el bundle: [familia, id, categoría, variantes, latin-ext,
// rango latin, rango latin-ext]. Sólo se sirven latin y latin-ext (el español entra en latin). «400i» = 400 itálica. Los rangos son índices en RANGOS.

import type { FontCategory, FontFamily } from '../_doory/types/api';

const CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';

type Fila = [family: string, id: string, category: FontCategory, variantes: string, ext: 0 | 1, rLatin: number, rExt: number];

/** Los `unicode-range` de Fontsource, sin repetir. */
const RANGOS: string[] = [
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
];

const FILAS: Fila[] = [
  ['Roboto', 'roboto', 'sans-serif', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Open Sans', 'open-sans', 'sans-serif', '300 300i 400 400i 500 500i 600 600i 700 700i 800 800i', 1, 0, 1],
  ['Montserrat', 'montserrat', 'sans-serif', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Inter', 'inter', 'sans-serif', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Poppins', 'poppins', 'sans-serif', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Lato', 'lato', 'sans-serif', '100 100i 300 300i 400 400i 700 700i 900 900i', 1, 0, 1],
  ['Oswald', 'oswald', 'sans-serif', '200 300 400 500 600 700', 1, 0, 1],
  ['Roboto Mono', 'roboto-mono', 'monospace', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i', 1, 0, 1],
  ['Raleway', 'raleway', 'sans-serif', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Nunito', 'nunito', 'sans-serif', '200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Playfair Display', 'playfair-display', 'serif', '400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Merriweather', 'merriweather', 'serif', '300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Rubik', 'rubik', 'sans-serif', '300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Work Sans', 'work-sans', 'sans-serif', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Lora', 'lora', 'serif', '400 400i 500 500i 600 600i 700 700i', 1, 0, 1],
  ['DM Sans', 'dm-sans', 'sans-serif', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Quicksand', 'quicksand', 'sans-serif', '300 400 500 600 700', 1, 0, 1],
  ['Josefin Sans', 'josefin-sans', 'sans-serif', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i', 1, 0, 1],
  ['Libre Baskerville', 'libre-baskerville', 'serif', '400 400i 500 500i 600 600i 700 700i', 1, 0, 1],
  ['Anton', 'anton', 'sans-serif', '400', 1, 0, 1],
  ['Bebas Neue', 'bebas-neue', 'sans-serif', '400', 1, 0, 1],
  ['Archivo', 'archivo', 'sans-serif', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Manrope', 'manrope', 'sans-serif', '200 300 400 500 600 700 800', 1, 0, 1],
  ['Pacifico', 'pacifico', 'handwriting', '400', 1, 0, 1],
  ['Dancing Script', 'dancing-script', 'handwriting', '400 500 600 700', 1, 0, 1],
  ['Lobster', 'lobster', 'display', '400', 1, 0, 1],
  ['Caveat', 'caveat', 'handwriting', '400 500 600 700', 1, 0, 1],
  ['Shadows Into Light', 'shadows-into-light', 'handwriting', '400', 1, 0, 1],
  ['Permanent Marker', 'permanent-marker', 'handwriting', '400', 0, 0, -1],
  ['Great Vibes', 'great-vibes', 'handwriting', '400', 1, 0, 1],
  ['Indie Flower', 'indie-flower', 'handwriting', '400', 1, 0, 1],
  ['Amatic SC', 'amatic-sc', 'handwriting', '400 700', 1, 0, 1],
  ['Sacramento', 'sacramento', 'handwriting', '400', 1, 0, 1],
  ['Yellowtail', 'yellowtail', 'handwriting', '400', 1, 0, 1],
  ['Parisienne', 'parisienne', 'handwriting', '400', 1, 0, 1],
  ['Allura', 'allura', 'handwriting', '400', 1, 0, 1],
  ['Alex Brush', 'alex-brush', 'handwriting', '400', 1, 0, 1],
  ['Pinyon Script', 'pinyon-script', 'handwriting', '400', 1, 0, 1],
  ['Patrick Hand', 'patrick-hand', 'handwriting', '400', 1, 0, 1],
  ['Architects Daughter', 'architects-daughter', 'handwriting', '400', 1, 0, 1],
  ['Kalam', 'kalam', 'handwriting', '300 400 700', 1, 0, 1],
  ['Space Grotesk', 'space-grotesk', 'sans-serif', '300 400 500 600 700', 1, 0, 1],
  ['Space Mono', 'space-mono', 'monospace', '400 400i 700 700i', 1, 0, 1],
  ['Outfit', 'outfit', 'sans-serif', '100 200 300 400 500 600 700 800 900', 1, 0, 1],
  ['Plus Jakarta Sans', 'plus-jakarta-sans', 'sans-serif', '200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i', 1, 0, 1],
  ['Figtree', 'figtree', 'sans-serif', '300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Cormorant Garamond', 'cormorant-garamond', 'serif', '300 300i 400 400i 500 500i 600 600i 700 700i', 1, 0, 1],
  ['EB Garamond', 'eb-garamond', 'serif', '400 400i 500 500i 600 600i 700 700i 800 800i', 1, 0, 1],
  ['Roboto Slab', 'roboto-slab', 'serif', '100 200 300 400 500 600 700 800 900', 1, 0, 1],
  ['DM Serif Display', 'dm-serif-display', 'serif', '400 400i', 1, 0, 1],
  ['Abril Fatface', 'abril-fatface', 'display', '400', 1, 0, 1],
  ['Bodoni Moda', 'bodoni-moda', 'serif', '400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Cinzel', 'cinzel', 'serif', '400 500 600 700 800 900', 1, 0, 1],
  ['Righteous', 'righteous', 'display', '400', 1, 0, 1],
  ['Fredoka', 'fredoka', 'sans-serif', '300 400 500 600 700', 1, 0, 1],
  ['Press Start 2P', 'press-start-2p', 'display', '400', 1, 0, 1],
  ['Archivo Black', 'archivo-black', 'sans-serif', '400', 1, 0, 1],
  ['Alfa Slab One', 'alfa-slab-one', 'display', '400', 1, 0, 1],
  ['Monoton', 'monoton', 'display', '400', 1, 0, 1],
  ['Bungee', 'bungee', 'display', '400', 1, 0, 1],
  ['Special Elite', 'special-elite', 'display', '400', 1, 0, 1],
  ['Courier Prime', 'courier-prime', 'monospace', '400 400i 700 700i', 1, 0, 1],
  ['JetBrains Mono', 'jetbrains-mono', 'monospace', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i', 1, 0, 1],
  ['IBM Plex Mono', 'ibm-plex-mono', 'monospace', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i', 1, 0, 1],
  ['Fraunces', 'fraunces', 'serif', '100 100i 200 200i 300 300i 400 400i 500 500i 600 600i 700 700i 800 800i 900 900i', 1, 0, 1],
  ['Instrument Serif', 'instrument-serif', 'serif', '400 400i', 1, 0, 1],
  ['Unbounded', 'unbounded', 'sans-serif', '200 300 400 500 600 700 800 900', 1, 0, 1],
  ['League Spartan', 'league-spartan', 'sans-serif', '100 200 300 400 500 600 700 800 900', 1, 0, 1],
  ['Titan One', 'titan-one', 'display', '400', 1, 0, 1],
  ['DM Mono', 'dm-mono', 'monospace', '300 300i 400 400i 500 500i', 1, 0, 1],
];

const archivo = (id: string, subset: string, peso: number, estilo: string): string => `${CDN}/${id}/files/${id}-${subset}-${peso}-${estilo}.woff2`;

/** El catálogo, armado una vez (`popularity` 1 = la más usada). */
export const FUENTES: FontFamily[] = FILAS.map(([family, id, category, variantes, ext, rLatin, rExt], i) => {
  const unicode_ranges: Record<string, string> = {};
  if (rLatin >= 0) unicode_ranges.latin = RANGOS[rLatin];
  if (rExt >= 0) unicode_ranges['latin-ext'] = RANGOS[rExt];
  return {
    id: `fs-${id}`,
    family,
    category,
    scripts: ext ? ['latin', 'latin-ext'] : ['latin'],
    is_variable: false,
    is_user_font: false,
    variants: variantes.split(' ').map((v) => {
      const peso = Number.parseInt(v, 10);
      const estilo = v.endsWith('i') ? ('italic' as const) : ('normal' as const);
      return { weight: peso, style: estilo, url: archivo(id, 'latin', peso, estilo), ...(ext ? { subsets: [{ subset: 'latin-ext', url: archivo(id, 'latin-ext', peso, estilo) }] } : {}) };
    }),
    popularity: i + 1,
    unicode_ranges,
  };
});

/** Una combinación de fuentes (título + cuerpo) de §4.7; todas las familias y pesos están en FUENTES. */
export interface CombinacionFuentes {
  id: string;
  nombre: string;
  titulo: { family: string; category: FontCategory; weight: number };
  cuerpo: { family: string; category: FontCategory; weight: number };
}

export const COMBINACIONES_FUENTES: readonly CombinacionFuentes[] = [
  { id: 'elegante', nombre: 'Elegante', titulo: { family: 'Playfair Display', category: 'serif', weight: 700 }, cuerpo: { family: 'Lato', category: 'sans-serif', weight: 400 } },
  { id: 'editorial', nombre: 'Editorial', titulo: { family: 'DM Serif Display', category: 'serif', weight: 400 }, cuerpo: { family: 'DM Sans', category: 'sans-serif', weight: 400 } },
  { id: 'impacto', nombre: 'Impacto', titulo: { family: 'Bebas Neue', category: 'sans-serif', weight: 400 }, cuerpo: { family: 'Montserrat', category: 'sans-serif', weight: 500 } },
  { id: 'moderno', nombre: 'Moderno', titulo: { family: 'Montserrat', category: 'sans-serif', weight: 800 }, cuerpo: { family: 'Inter', category: 'sans-serif', weight: 400 } },
  { id: 'lujo', nombre: 'Lujo', titulo: { family: 'Cinzel', category: 'serif', weight: 600 }, cuerpo: { family: 'Cormorant Garamond', category: 'serif', weight: 400 } },
  { id: 'boda', nombre: 'Boda', titulo: { family: 'Great Vibes', category: 'handwriting', weight: 400 }, cuerpo: { family: 'Cormorant Garamond', category: 'serif', weight: 400 } },
  { id: 'divertido', nombre: 'Divertido', titulo: { family: 'Fredoka', category: 'sans-serif', weight: 700 }, cuerpo: { family: 'Nunito', category: 'sans-serif', weight: 400 } },
  { id: 'tecnologico', nombre: 'Tecnológico', titulo: { family: 'Unbounded', category: 'sans-serif', weight: 700 }, cuerpo: { family: 'Manrope', category: 'sans-serif', weight: 400 } },
  { id: 'cartel-retro', nombre: 'Cartel retro', titulo: { family: 'Alfa Slab One', category: 'display', weight: 400 }, cuerpo: { family: 'Work Sans', category: 'sans-serif', weight: 400 } },
  { id: 'cercano', nombre: 'Cercano', titulo: { family: 'Caveat', category: 'handwriting', weight: 700 }, cuerpo: { family: 'Outfit', category: 'sans-serif', weight: 400 } },
  { id: 'callejero', nombre: 'Callejero', titulo: { family: 'Permanent Marker', category: 'handwriting', weight: 400 }, cuerpo: { family: 'Rubik', category: 'sans-serif', weight: 400 } },
  { id: 'corporativo', nombre: 'Corporativo', titulo: { family: 'Archivo Black', category: 'sans-serif', weight: 400 }, cuerpo: { family: 'Roboto', category: 'sans-serif', weight: 400 } },
  { id: 'clasico', nombre: 'Clásico', titulo: { family: 'Libre Baskerville', category: 'serif', weight: 700 }, cuerpo: { family: 'Montserrat', category: 'sans-serif', weight: 400 } },
  { id: 'fresco', nombre: 'Fresco', titulo: { family: 'Fraunces', category: 'serif', weight: 600 }, cuerpo: { family: 'Figtree', category: 'sans-serif', weight: 400 } },
];
