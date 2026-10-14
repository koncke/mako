// =============================================================================
// Los catálogos del editor del lado de MaKo (fuentes, elementos, plantillas)
// =============================================================================
// En Doory los sirve su backend Django (`/api/fonts`, `/api/elements`,
// `/api/templates`). MaKo no tiene ese backend: en la etapa «plantilla para ir
// trabajando» (14/10) salen de acá, estáticos.
//
// · FUENTES: familias de Google Fonts (OFL/Apache) servidas por la copia de
//   jsDelivr de los paquetes `@fontsource/<id>` (la misma fuente de archivos que usa
//   el backend de Doory, backend/apps/fonts/sources.py). Sólo pesos que existen:
//   un peso que no existe da 404 y el texto cae a la fuente del sistema.
// · ELEMENTOS y PLANTILLAS: por ahora los catálogos de prueba de Doory
//   (_doory/editor/dev/), en inglés. Los packs de íconos (Lucide, Tabler,
//   Phosphor…) y las 10 plantillas de Doory llegan con el catálogo propio.

import type { EditorServices } from '../_doory/types/adapter';
import type { FontCategory, FontFamily, Page } from '../_doory/types/api';
import { createMemoryAdapter } from '../_doory/editor/dev/memoryAdapter';

const CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';

type Fam = [family: string, id: string, category: FontCategory, weights: number[]];

// Orden = popularidad (la del catálogo de Doory, backend/data/popular_fonts.json).
const FAMILIAS: Fam[] = [
  ['Roboto', 'roboto', 'sans-serif', [300, 400, 500, 700, 900]],
  ['Open Sans', 'open-sans', 'sans-serif', [300, 400, 600, 700, 800]],
  ['Montserrat', 'montserrat', 'sans-serif', [300, 400, 500, 600, 700, 800, 900]],
  ['Inter', 'inter', 'sans-serif', [300, 400, 500, 600, 700, 800, 900]],
  ['Poppins', 'poppins', 'sans-serif', [300, 400, 500, 600, 700, 800, 900]],
  ['Lato', 'lato', 'sans-serif', [300, 400, 700, 900]],
  ['Oswald', 'oswald', 'sans-serif', [300, 400, 500, 600, 700]],
  ['Raleway', 'raleway', 'sans-serif', [300, 400, 500, 600, 700, 800, 900]],
  ['Nunito', 'nunito', 'sans-serif', [300, 400, 600, 700, 800, 900]],
  ['Work Sans', 'work-sans', 'sans-serif', [300, 400, 500, 600, 700]],
  ['Quicksand', 'quicksand', 'sans-serif', [300, 400, 500, 600, 700]],
  ['Josefin Sans', 'josefin-sans', 'sans-serif', [300, 400, 600, 700]],
  ['Space Grotesk', 'space-grotesk', 'sans-serif', [300, 400, 500, 600, 700]],
  ['League Spartan', 'league-spartan', 'sans-serif', [300, 400, 500, 600, 700, 800, 900]],
  ['Bebas Neue', 'bebas-neue', 'display', [400]],
  ['Anton', 'anton', 'sans-serif', [400]],
  ['Archivo Black', 'archivo-black', 'sans-serif', [400]],
  ['Playfair Display', 'playfair-display', 'serif', [400, 500, 600, 700, 800, 900]],
  ['Merriweather', 'merriweather', 'serif', [300, 400, 700, 900]],
  ['Lora', 'lora', 'serif', [400, 500, 600, 700]],
  ['DM Serif Display', 'dm-serif-display', 'serif', [400]],
  ['Abril Fatface', 'abril-fatface', 'display', [400]],
  ['Lobster', 'lobster', 'display', [400]],
  ['Pacifico', 'pacifico', 'handwriting', [400]],
  ['Dancing Script', 'dancing-script', 'handwriting', [400, 500, 600, 700]],
  ['Caveat', 'caveat', 'handwriting', [400, 500, 600, 700]],
  ['Great Vibes', 'great-vibes', 'handwriting', [400]],
  ['Roboto Mono', 'roboto-mono', 'monospace', [300, 400, 500, 700]],
];

const FUENTES: FontFamily[] = FAMILIAS.map(([family, id, category, weights], i) => ({
  id: `fs-${id}`,
  family,
  category,
  scripts: ['latin'],
  is_variable: false,
  is_user_font: false,
  variants: weights.map((weight) => ({ weight, style: 'normal' as const, url: `${CDN}/${id}/files/${id}-latin-${weight}-normal.woff2` })),
  popularity: i + 1,
}));

function pagina<T>(todo: T[], q?: { page?: number; page_size?: number }): Page<T> {
  const tam = q?.page_size ?? 50;
  const desde = ((q?.page ?? 1) - 1) * tam;
  return { count: todo.length, next: desde + tam < todo.length ? 'next' : null, previous: null, results: todo.slice(desde, desde + tam) };
}

/** Fuentes, elementos y plantillas para el adaptador de MaKo. */
export function serviciosCatalogo(): Pick<EditorServices, 'fonts' | 'elements' | 'templates'> {
  const prueba = createMemoryAdapter().adapter.services;
  return {
    fonts: {
      async list(q) {
        const aguja = q.q?.toLowerCase().trim();
        return pagina(FUENTES.filter((f) => (!aguja || f.family.toLowerCase().includes(aguja)) && (!q.category || f.category === q.category)), q);
      },
    },
    elements: prueba.elements,
    templates: prueba.templates,
  };
}
