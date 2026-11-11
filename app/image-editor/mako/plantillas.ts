// =============================================================================
// El panel «Diseño» del editor de imágenes: las plantillas REALES de MaKo (11/11/2026)
// =============================================================================
// Hasta el 6/11/2026 este panel servía las 10 plantillas de Doory (`backend/data/templates` del commit de
// `_doory/COMMIT-DOORY`). **Se borraron**, con sus 10 JSON, sus 10 WebP y sus etiquetas: eran material ajeno
// adentro del producto. La licencia del código portado (Attribution Assurance License) aplica «in whole or part,
// with or without modification», así que que Martín haya sacado el crédito visible el 29/10/2026
// (`editor/CreditoDoory.tsx`) no la desactivaba; borrarlas sí. ⚠️ **Una de Doory no vuelve a entrar** (lo fija el test 3 de
// tests/api-mako-imagen.test.ts).
//
// Del 6/11 al 11/11 el panel quedó VACÍO, con un buscador y un «Todas las plantillas» que nunca encontraban nada («Ninguna
// plantilla coincide con “lista”»). La prueba de Image del 10/11 lo marcó (docs/pruebas/image-10-11.md, caso 17) y el Cerebro,
// con Martín: una pantalla vacía en producción es una falla. La referencia es Canva: su panel «Diseño» lista las plantillas.
//
// Ahora sirve las plantillas REALES de MaKo, las mismas de «Nuevo diseño» (`lib/image-editor/plantillas-reales.ts`), generadas
// por código y propias. Las categorías son sus grupos (Miniaturas de YouTube, Publicaciones, Historias, Anuncios,
// Presentaciones). La tarjeta dibuja la ESTRUCTURA que se aplica (`muestra`, con `MiniaturaDiseno`, como la tarjeta de «Nuevo
// diseño»), y aplicarla pone esa estructura, como al crear. Los carruseles por tipo no están acá: su documento sale con la marca
// y el kit del negocio, que se leen en el server (`crearDisenoNuevoAction`).
//
// Puro y sólo con lo que el navegador puede armar: lo lee también el test.

import type { EditorServices } from '../_doory/types/adapter';
import type { Page, TemplateCategory, TemplateDetail, TemplateSummary } from '../_doory/types/api';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { PLANTILLAS_IMAGEN, type PlantillaImagen } from '@/lib/image-editor/plantillas-reales';

/** El slug de un grupo, para las categorías del panel. */
const slugDe = (grupo: string): string => grupo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sinTildes = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const orientacion = (p: Pick<PlantillaImagen, 'ancho' | 'alto'>): TemplateSummary['orientation'] =>
  (p.ancho === p.alto ? 'square' : p.ancho > p.alto ? 'landscape' : 'portrait');
const GRUPOS = [...new Set(PLANTILLAS_IMAGEN.map((p) => p.grupo))];

/** La tarjeta de una plantilla. `muestra`: la estructura con ids fijos, sólo para dibujarla. */
function resumen(p: PlantillaImagen): TemplateSummary {
  let n = 0;
  return {
    id: p.id, slug: p.id, title: p.nombre, category: { id: slugDe(p.grupo), slug: slugDe(p.grupo), name: p.grupo },
    tags: [...p.chips], width: p.ancho, height: p.alto, orientation: orientacion(p), preset: '', page_count: p.paginas,
    thumbnail_url: null, is_featured: false, use_count: 0, created_at: '2026-11-06T00:00:00.000Z',
    muestra: p.estructura(() => `muestra-${p.id}-${++n}`),
  };
}

/** El servicio `templates` del adaptador de MaKo. `senales` se recibe y no se usa todavía (ordenar las sugeridas). */
export function servicioPlantillas(_senales?: SenalesNegocio | null): EditorServices['templates'] {
  return {
    async categories(): Promise<TemplateCategory[]> {
      return GRUPOS.map((g, i) => ({
        id: slugDe(g), slug: slugDe(g), name: g, icon: '', sort_order: i,
        template_count: PLANTILLAS_IMAGEN.filter((p) => p.grupo === g).length,
      }));
    },
    async list(q = {}): Promise<Page<TemplateSummary>> {
      const texto = sinTildes(q.q?.trim() ?? '');
      const todas = PLANTILLAS_IMAGEN.filter((p) =>
        (!q.category || slugDe(p.grupo) === q.category)
        && (!q.orientation || orientacion(p) === q.orientation)
        && (!texto || sinTildes(`${p.nombre} ${p.cuando} ${p.grupo} ${p.chips.join(' ')}`).includes(texto)));
      const tam = Math.max(1, q.page_size ?? 24);
      const pagina = Math.max(1, q.page ?? 1);
      const results = todas.slice((pagina - 1) * tam, pagina * tam).map(resumen);
      return {
        count: todas.length,
        next: pagina * tam < todas.length ? String(pagina + 1) : null,
        previous: pagina > 1 ? String(pagina - 1) : null,
        results,
      };
    },
    async get(id: string): Promise<TemplateDetail> {
      const p = PLANTILLAS_IMAGEN.find((x) => x.id === id);
      if (!p) throw new Error('Esa plantilla no existe.');
      // Aplicarla pone la ESTRUCTURA (como «Nuevo diseño» al crear), con ids nuevos: el motor no repite los de otra página.
      return { ...resumen(p), description: p.cuando, document: p.estructura() };
    },
  };
}
