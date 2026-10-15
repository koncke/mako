// =============================================================================
// Los catálogos del editor del lado de MaKo (fuentes, elementos, plantillas)
// =============================================================================
// En Doory los sirve su backend Django (`/api/fonts`, `/api/elements`, `/api/templates`). MaKo no
// tiene ese backend: salen de acá.
//
// · FUENTES (`./fuentes.ts`, generado): ~70 familias de Google Fonts (OFL/Apache) por la copia de
//   jsDelivr de `@fontsource/<id>`, con los pesos e itálicas que EXISTEN (verificados uno por uno).
// · ELEMENTOS (`./elementos.ts`): íconos, emoji y gráficos de sets MIT/ISC/Apache por la API pública
//   de Iconify, con la búsqueda traducida al inglés.
// · PLANTILLAS (`./plantillas.ts`): las 10 de Doory, con títulos y categorías en español.

import type { EditorServices } from '../_doory/types/adapter';
import type { FontFamily, Page } from '../_doory/types/api';
import { servicioElementos } from './elementos';
import { FUENTES } from './fuentes';
import { servicioPlantillas } from './plantillas';

/** Minúsculas y sin tildes. */
const plano = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

function pagina<T>(todo: T[], q?: { page?: number; page_size?: number }): Page<T> {
  const tam = q?.page_size ?? 50;
  const desde = ((q?.page ?? 1) - 1) * tam;
  return { count: todo.length, next: desde + tam < todo.length ? 'next' : null, previous: null, results: todo.slice(desde, desde + tam) };
}

/** Fuentes, elementos y plantillas para el adaptador de MaKo. */
export function serviciosCatalogo(): Pick<EditorServices, 'fonts' | 'elements' | 'templates'> {
  return {
    fonts: {
      async list(q) {
        const aguja = q.q ? plano(q.q) : '';
        let todas: FontFamily[] = FUENTES.filter(
          (f) => (!aguja || plano(f.family).includes(aguja)) && (!q.category || f.category === q.category) && (!q.script || f.scripts.includes(q.script)),
        );
        // `popularity` (el orden de FUENTES) es el de siempre; `created_at` no existe acá y queda igual.
        if (q.ordering === 'family' || q.ordering === '-family') {
          todas = [...todas].sort((a, b) => a.family.localeCompare(b.family, 'es'));
          if (q.ordering === '-family') todas.reverse();
        } else if (q.ordering === '-popularity') {
          todas = [...todas].reverse();
        }
        return pagina(todas, q);
      },
    },
    elements: servicioElementos(),
    templates: servicioPlantillas(),
  };
}
