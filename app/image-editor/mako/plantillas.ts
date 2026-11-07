// =============================================================================
// El panel «Diseño» del editor de imágenes: sin plantillas
// =============================================================================
// Hasta el 6/11/2026 este panel servía las 10 plantillas de Doory (`backend/data/templates` del commit de
// `_doory/COMMIT-DOORY`). **Se borraron**, con sus 10 JSON, sus 10 WebP y sus etiquetas: eran material ajeno
// adentro del producto. La licencia del código portado (Attribution Assurance License) aplica «in whole or part,
// with or without modification», así que que Martín haya sacado el crédito visible el 29/10/2026
// (`editor/CreditoDoory.tsx`) no la desactivaba; borrarlas sí.
//
// ⚠️ **Acá no vuelve a entrar una plantilla.** Las plantillas de MaKo son propias y viven en otro lado:
//   · las REALES, generadas por código, en `lib/image-editor/plantillas-reales.ts`, y se eligen en «Nuevo diseño»
//     (`app/image-editor/plantillas-crear.ts`), con su estructura y su «Ver ejemplo»;
//   · las PROPIAS del negocio y las de la comunidad, en `app/creaciones/usePlantillasPropias.ts`, también en
//     «Nuevo diseño».
// Una plantilla nueva va por ahí. El código de Doory que quedó (el motor, `_doory/`) sigue con su crédito en
// `LICENSE-DOORY`: lo que se fue es su CONTENIDO, no su motor.
//
// Este módulo queda porque el adaptador del editor exige el servicio `templates` (`EditorServices`): sirve una
// galería vacía y el panel dibuja su mensaje (`strings.ts`, `templates.empty`, que manda a «Nuevo diseño»). El día
// que las plantillas propias se sirvan DESDE el panel, se llena acá; mientras tanto no miente con categorías que
// no llevan a nada.
//
// Puro y sólo con tipos: lo puede leer el server.

import type { EditorServices } from '../_doory/types/adapter';
import type { Page, TemplateCategory, TemplateDetail, TemplateSummary } from '../_doory/types/api';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';

/** Vacío, como `list` lo pagina: sin plantillas no hay página siguiente. */
function sinNada<T>(): Page<T> {
  return { count: 0, next: null, previous: null, results: [] };
}

/**
 * El servicio `templates` del adaptador de MaKo, sin plantillas. `senales` se recibe y no se usa: ordenar las
 * sugeridas para el negocio (`ordenarConSugeridas`) necesita plantillas que sugerir, y acá no hay. El parámetro se
 * queda porque el cableado que lo baja desde la page sí vale (lo fija tests/plantillas-sugeridas-editores.test.ts) y
 * lo primero que hará falta al volver a servir plantillas propias es esto mismo.
 */
export function servicioPlantillas(_senales?: SenalesNegocio | null): EditorServices['templates'] {
  return {
    async categories(): Promise<TemplateCategory[]> {
      return [];
    },
    async list(): Promise<Page<TemplateSummary>> {
      return sinNada();
    },
    async get(): Promise<TemplateDetail> {
      throw new Error('Esa plantilla no existe.');
    },
  };
}
