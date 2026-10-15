// =============================================================================
// api-mako/areas/imagen.run — los cuerpos del área `imagen` (el Image Editor)
// =============================================================================
// Cruzados por id con imagen.def.ts. Leen y escriben por lib/image-editor/server.ts, el MISMO camino que la pantalla
// (/api/image-editor/*): el documento se valida igual (forma de diseño, sin `idb://` ni `blob:`, tope de bytes) y el
// guardado es compare-and-set por versión. Corren dentro de runWithWorkspace(ctx.ws) (lib/api-mako/ejecutar.ts).
// Nada de esto importa el motor de Doory (es sólo de cliente): el documento se arma y se lee con lib/image-editor/reglas.ts.

import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Runners, Preparado, Ejecutado } from '../tipos';
import { linkApp } from '@/lib/app-url';
import { borrarDiseno, crearDiseno, duplicarDiseno, guardarDiseno, leerDiseno, listarDisenos } from '@/lib/image-editor/server';
import { cambiarTextos, documentoEnBlanco, textosDe, uuidValido } from '@/lib/image-editor/reglas';
import { TAMANOS_API } from '@/lib/image-editor/tamanos';
import { catalogoPlantillas, documentoDePlantilla } from '@/app/image-editor/mako/plantillas';

const str = (input: Record<string, unknown>, k: string): string | null => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const QUIEN = 'MaKo (API)';
const link = (id: string, ws: number) => linkApp(`/image-editor/${id}`, ws);

/** El diseño nuevo que pide la entrada: de una plantilla, de un tamaño con nombre o a medida. */
async function docNuevo(input: Record<string, unknown>): Promise<{ doc: unknown; que: string } | { error: string; faltan?: string[] }> {
  const plantilla = str(input, 'plantilla');
  if (plantilla) {
    const doc = await documentoDePlantilla(plantilla);
    if (!doc) return { error: `No existe la plantilla «${plantilla}». Usa listar_plantillas_imagen.`, faltan: ['plantilla'] };
    const t = catalogoPlantillas().find((p) => p.slug === plantilla);
    return { doc, que: `a partir de la plantilla «${t?.titulo ?? plantilla}»` };
  }
  const ancho = input.ancho;
  const alto = input.alto;
  if (typeof ancho === 'number' || typeof alto === 'number') {
    if (typeof ancho !== 'number' || typeof alto !== 'number') return { error: 'Para un tamaño a medida van ancho y alto.', faltan: ['ancho', 'alto'] };
    return { doc: documentoEnBlanco(ancho, alto, randomUUID()), que: `en blanco, ${ancho} × ${alto} px` };
  }
  const t = TAMANOS_API[str(input, 'tamano') ?? 'publicacion_instagram'];
  if (!t) return { error: 'Ese tamaño no existe.', faltan: ['tamano'] };
  return { doc: documentoEnBlanco(t.ancho, t.alto, randomUUID()), que: `en blanco, ${t.nombre} (${t.ancho} × ${t.alto} px)` };
}

/** Los cambios de textos que pasó el modelo, saneados (sin vacíos ni repetidos). */
function cambiosDe(input: Record<string, unknown>): { actual: string; nuevo: string }[] {
  const crudo = Array.isArray(input.cambios) ? input.cambios : [];
  const out: { actual: string; nuevo: string }[] = [];
  for (const c of crudo) {
    const actual = typeof (c as { actual?: unknown })?.actual === 'string' ? String((c as { actual: string }).actual) : '';
    const nuevo = typeof (c as { nuevo?: unknown })?.nuevo === 'string' ? String((c as { nuevo: string }).nuevo) : '';
    if (actual.trim() && nuevo.trim() && !out.some((o) => o.actual === actual)) out.push({ actual, nuevo });
  }
  return out;
}

export const RUNNERS: Runners = {
  listar_disenos_imagen: {
    leer: async (input, ctx) => {
      const r = await listarDisenos(ctx.ws);
      if (!r.ok) return JSON.stringify({ error: r.error });
      const aguja = (str(input, 'buscar') ?? '').toLocaleLowerCase('es');
      const disenos = r.disenos.filter((d) => !aguja || d.titulo.toLocaleLowerCase('es').includes(aguja));
      return JSON.stringify({
        total: disenos.length,
        disenos: disenos.slice(0, 100).map((d) => ({
          id: d.id, titulo: d.titulo, ancho: d.ancho, alto: d.alto, paginas: d.paginas, actualizado: d.actualizado, link: link(d.id, ctx.ws),
        })),
      });
    },
  },

  ver_diseno_imagen: {
    leer: async (input, ctx) => {
      const id = str(input, 'disenoId') ?? '';
      if (!uuidValido(id)) return JSON.stringify({ error: 'Falta el id del diseño (de listar_disenos_imagen).' });
      const r = await leerDiseno(ctx.ws, id);
      if (!r.ok) return JSON.stringify({ error: r.error });
      const d = r.diseno;
      return JSON.stringify({ id: d.id, titulo: d.titulo, ancho: d.ancho, alto: d.alto, actualizado: d.actualizado, paginas: textosDe(d.doc), link: link(d.id, ctx.ws) });
    },
  },

  listar_plantillas_imagen: {
    leer: async () => JSON.stringify({ plantillas: catalogoPlantillas() }),
  },

  crear_diseno_imagen: {
    preparar: async (input): Promise<Preparado> => {
      const n = await docNuevo(input);
      if ('error' in n) return { error: n.error, faltan: n.faltan };
      const titulo = str(input, 'titulo') ?? 'Diseño sin título';
      return { payload: { ...input }, resumen: `Crear el diseño «${titulo}» en el Image Editor, ${n.que}.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const n = await docNuevo(payload);
      if ('error' in n) return { ok: false, resumen: n.error };
      const r = await crearDiseno(ctx.ws, QUIEN, { titulo: str(payload, 'titulo') ?? 'Diseño sin título', doc: n.doc });
      if (!r.ok) return { ok: false, resumen: `No se pudo crear (${r.error}).` };
      const url = link(r.id, ctx.ws);
      return { ok: true, resumen: `Creado. Ábrelo acá: ${url}`, datos: { disenoId: r.id, link: url } };
    },
  },

  cambiar_textos_diseno_imagen: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = str(input, 'disenoId') ?? '';
      if (!uuidValido(id)) return { error: 'Falta el id del diseño.', faltan: ['disenoId'] };
      const cambios = cambiosDe(input);
      if (!cambios.length) return { error: 'Faltan los cambios (texto actual y nuevo).', faltan: ['cambios'] };
      // Lo que se puede saber sin escribir falla ACÁ: que el diseño exista y que los textos estén.
      const r = await leerDiseno(ctx.ws, id);
      if (!r.ok) return { error: r.error };
      const c = cambiarTextos(r.diseno.doc, cambios);
      if (!c.cambiados) return { error: `Ninguno de esos textos está en «${r.diseno.titulo}». Mira los textos con ver_diseno_imagen.` };
      const faltan = c.noEncontrados.length ? ` No están: ${c.noEncontrados.map((t) => `«${t.slice(0, 40)}»`).join(', ')}.` : '';
      return { payload: { disenoId: id, cambios }, resumen: `Cambiar ${c.cambiados} texto(s) en «${r.diseno.titulo}».${faltan}` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = str(payload, 'disenoId') ?? '';
      const r = await leerDiseno(ctx.ws, id);
      if (!r.ok) return { ok: false, resumen: r.error };
      const c = cambiarTextos(r.diseno.doc, cambiosDe(payload));
      if (!c.cambiados) return { ok: false, resumen: 'Esos textos ya no están en el diseño.' };
      const g = await guardarDiseno(ctx.ws, id, { version: r.diseno.version, doc: c.doc });
      if (!g.ok) return { ok: false, resumen: g.conflicto ? 'Alguien lo está editando en este momento: vuelve a intentar en un rato.' : `No se pudo guardar (${g.error}).` };
      return { ok: true, resumen: `Listo: ${c.cambiados} texto(s) cambiados.`, datos: { disenoId: id, link: link(id, ctx.ws) } };
    },
  },

  duplicar_diseno_imagen: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = str(input, 'disenoId') ?? '';
      if (!uuidValido(id)) return { error: 'Falta el id del diseño.', faltan: ['disenoId'] };
      const r = await leerDiseno(ctx.ws, id);
      if (!r.ok) return { error: r.error };
      return { payload: { disenoId: id }, resumen: `Hacer una copia de «${r.diseno.titulo}».` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const r = await duplicarDiseno(ctx.ws, QUIEN, str(payload, 'disenoId') ?? '');
      if (!r.ok) return { ok: false, resumen: `No se pudo copiar (${r.error}).` };
      const url = link(r.id, ctx.ws);
      return { ok: true, resumen: `Copia hecha: ${url}`, datos: { disenoId: r.id, link: url } };
    },
  },

  borrar_diseno_imagen: {
    preparar: async (input, ctx): Promise<Preparado> => {
      const id = str(input, 'disenoId') ?? '';
      if (!uuidValido(id)) return { error: 'Falta el id del diseño.', faltan: ['disenoId'] };
      const r = await leerDiseno(ctx.ws, id);
      if (!r.ok) return { error: r.error };
      return { payload: { disenoId: id }, resumen: `Eliminar el diseño «${r.diseno.titulo}» del Image Editor.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const r = await borrarDiseno(ctx.ws, str(payload, 'disenoId') ?? '');
      if (!r.ok) return { ok: false, resumen: `No se pudo eliminar (${r.error}).` };
      return { ok: true, resumen: 'Eliminado.', datos: { disenoId: str(payload, 'disenoId') } };
    },
  },
};
