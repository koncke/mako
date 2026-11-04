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
import type { BloqueCreado } from '@/lib/chat-bloques';
import { linkApp } from '@/lib/app-url';
import { borrarDiseno, crearDiseno, duplicarDiseno, guardarDiseno, leerDiseno, listarDisenos } from '@/lib/image-editor/server';
import { cambiarTextos, documentoEnBlanco, textosDe, uuidValido } from '@/lib/image-editor/reglas';
import { TAMANOS_API } from '@/lib/image-editor/tamanos';
import { catalogoPlantillas, documentoDePlantilla } from '@/app/image-editor/mako/plantillas';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';
import { guardarCarrusel, leerExplorador } from '@/lib/carruseles/explorar-servidor';
import { crearCarruselDesdeReferencia, referenciaDelNegocio } from '@/lib/carruseles/crear-servidor';
import { estructuraDe, frasesDe, planDeReferencia } from '@/lib/carruseles/referencia';
import { esTipoCarrusel } from '@/lib/carruseles/tipos';
import {
  FILTROS_INICIALES, OUTLIER_MINIMOS, filtrarCarruseles, filtrosDeQuery, queryDeFiltros, rotuloFormato, rotuloOutlier, type Carrusel,
} from '@/lib/carruseles/explorar';

const str = (input: Record<string, unknown>, k: string): string | null => {
  const v = input[k];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};
const QUIEN = 'MaKo (API)';
const link = (id: string, ws: number) => linkApp(`/image-editor/${id}`, ws);

/** El G5 de un diseño (lib/chat-bloques.ts): lo que el chat dibuja al confirmar, con la ruta de la app (sin `?ws=`: la pone
 *  el `Link` de quien mira). Sin miniatura, el chat dibuja un marco con la forma del diseño. */
function bloqueDiseno(id: string, d: { titulo: string; ancho?: number; alto?: number; miniatura?: string | null; estado: string; nota?: string }): BloqueCreado {
  return {
    t: 'creado', titulo: d.titulo, estado: d.estado, abrir: { titulo: 'Abrir en Image Editor', href: `/image-editor/${id}` },
    ...(d.miniatura ? { miniatura: d.miniatura } : {}), ...(d.ancho && d.alto ? { ancho: d.ancho, alto: d.alto } : {}),
    ...(d.nota ? { nota: d.nota } : {}),
  };
}

/** El diseño nuevo que pide la entrada: de una plantilla, de un tamaño con nombre o a medida. `miniatura` es la de la
 *  plantilla (la de Doory, en `public/cv/plantillas/`): el diseño recién creado todavía no tiene la suya. */
async function docNuevo(input: Record<string, unknown>): Promise<{ doc: unknown; que: string; ancho: number; alto: number; nota: string; miniatura?: string } | { error: string; faltan?: string[] }> {
  const plantilla = str(input, 'plantilla');
  if (plantilla) {
    const doc = await documentoDePlantilla(plantilla);
    if (!doc) return { error: `No existe la plantilla «${plantilla}». Usa listar_plantillas_imagen.`, faltan: ['plantilla'] };
    const t = catalogoPlantillas().find((p) => p.slug === plantilla);
    return {
      doc, que: `a partir de la plantilla «${t?.titulo ?? plantilla}»`, ancho: t?.ancho ?? 0, alto: t?.alto ?? 0,
      nota: `De la plantilla «${t?.titulo ?? plantilla}»`, miniatura: `/cv/plantillas/${plantilla}.webp`,
    };
  }
  const ancho = input.ancho;
  const alto = input.alto;
  if (typeof ancho === 'number' || typeof alto === 'number') {
    if (typeof ancho !== 'number' || typeof alto !== 'number') return { error: 'Para un tamaño a medida van ancho y alto.', faltan: ['ancho', 'alto'] };
    return { doc: documentoEnBlanco(ancho, alto, randomUUID()), que: `en blanco, ${ancho} × ${alto} px`, ancho, alto, nota: `En blanco, ${ancho} × ${alto} px` };
  }
  const t = TAMANOS_API[str(input, 'tamano') ?? 'publicacion_instagram'];
  if (!t) return { error: 'Ese tamaño no existe.', faltan: ['tamano'] };
  return {
    doc: documentoEnBlanco(t.ancho, t.alto, randomUUID()), que: `en blanco, ${t.nombre} (${t.ancho} × ${t.alto} px)`,
    ancho: t.ancho, alto: t.alto, nota: `${t.nombre}, ${t.ancho} × ${t.alto} px`,
  };
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

/** El link al explorador con unos filtros (`/image-editor?ver=carruseles&…`). */
const linkExplorador = (query: string, ws: number) => linkApp(`/image-editor?${query}`, ws);

/** Un carrusel como lo devuelve la API: su creador y el link a SU publicación (es una referencia, no algo de MaKo). */
const carruselParaApi = (c: Carrusel) => ({
  id: c.id,
  creador: c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre,
  original: c.url,
  outlier: c.outlier == null ? null : rotuloOutlier(c.outlier),
  laminas: c.laminas,
  formato: rotuloFormato(c.formato) || null,
  gancho: c.gancho,
  // Lo que se entendió de su estructura (lo mismo que dice «Hacer el mío»): con esto se elige con qué crear el del negocio.
  estructura: frasesDe(estructuraDe(c)),
  texto: c.texto ? c.texto.slice(0, 280) : null,
  megusta: c.megusta, comentarios: c.comentarios, publicado: c.publicada,
});

/** El piso del outlier que pidió el modelo, llevado al más cercano por debajo de los que ofrece la pantalla. */
const pisoDeOutlier = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return [...OUTLIER_MINIMOS].reverse().find((m) => m <= n) ?? 0;
};

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

  // Con las sugeridas para ESTE negocio primero, como en el panel del editor (lib/plantillas-sugeridas.ts).
  listar_plantillas_imagen: {
    leer: async () => JSON.stringify({ plantillas: catalogoPlantillas(await senalesDelNegocio().catch(() => null)) }),
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
      const titulo = str(payload, 'titulo') ?? 'Diseño sin título';
      const r = await crearDiseno(ctx.ws, QUIEN, { titulo, doc: n.doc });
      if (!r.ok) return { ok: false, resumen: `No se pudo crear (${r.error}).` };
      const url = link(r.id, ctx.ws);
      const bloque = bloqueDiseno(r.id, { titulo, ancho: n.ancho, alto: n.alto, miniatura: n.miniatura, estado: 'Nuevo', nota: n.nota });
      return { ok: true, resumen: `Creado. Ábrelo aquí: ${url}`, datos: { disenoId: r.id, link: url, bloque } };
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
      // El G4: cada texto, como estaba y como quedó (sólo los que se cambiaron).
      const filas = cambiosDe(payload).filter((x) => !c.noEncontrados.includes(x.actual)).map((x) => ({ antes: x.actual, despues: x.nuevo }));
      const bloque = { t: 'antes_despues' as const, titulo: r.diseno.titulo, filas, abrir: { titulo: 'Abrir en Image Editor', href: `/image-editor/${id}` } };
      return { ok: true, resumen: `Listo: ${c.cambiados} texto(s) cambiados.`, datos: { disenoId: id, link: link(id, ctx.ws), bloque } };
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
      const original = str(payload, 'disenoId') ?? '';
      const r = await duplicarDiseno(ctx.ws, QUIEN, original);
      if (!r.ok) return { ok: false, resumen: `No se pudo copiar (${r.error}).` };
      const url = link(r.id, ctx.ws);
      // La copia no tiene miniatura hasta que se abre: se ve la del original, que es igual.
      const o = await leerDiseno(ctx.ws, original).catch(() => null);
      const bloque = o?.ok
        ? bloqueDiseno(r.id, { titulo: `${o.diseno.titulo} (copia)`, ancho: o.diseno.ancho, alto: o.diseno.alto, miniatura: o.diseno.miniatura, estado: 'Copia' })
        : null;
      return { ok: true, resumen: `Copia hecha: ${url}`, datos: { disenoId: r.id, link: url, ...(bloque ? { bloque } : {}) } };
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

  // ── Los carruseles que funcionan (lib/carruseles/): lo que Spy ya trajo, sin gastar nada ──
  estado_carruseles: {
    leer: async (_input, ctx) => {
      const r = await leerExplorador();
      if (!r.ok) return JSON.stringify({ error: 'No pude leer los carruseles de las cuentas que sigue el negocio. Vuelve a intentar.' });
      const carruseles = r.carruseles.filter((c) => c.medio !== 'imagen');
      return JSON.stringify({
        paso: r.paso,
        cuentasSeguidas: r.cuentas.competidores, conInstagram: r.cuentas.conInstagram, carruseles: carruseles.length, guardados: r.guardados.length,
        ...(r.paso === 'listo'
          ? { siguiente: 'Usa buscar_carruseles para ver los que mejor funcionan.', link: linkExplorador('ver=carruseles', ctx.ws) }
          : { siguiente: r.frase, ...(r.accion ? { donde: linkApp(r.accion.ruta, ctx.ws) } : {}) }),
      });
    },
  },

  buscar_carruseles: {
    leer: async (input, ctx) => {
      const r = await leerExplorador();
      if (!r.ok) return JSON.stringify({ error: 'No pude leer los carruseles de las cuentas que sigue el negocio. Vuelve a intentar.' });
      // Sin carruseles todavía, lo que contesta es la guía (en qué paso está), nunca una lista vacía que parezca un cero.
      if (r.paso !== 'listo') return JSON.stringify({ paso: r.paso, carruseles: [], siguiente: r.frase, ...(r.accion ? { donde: linkApp(r.accion.ruta, ctx.ws) } : {}) });
      const base = filtrosDeQuery(new URLSearchParams({
        q: str(input, 'buscar') ?? '', periodo: str(input, 'periodo') ?? '', orden: str(input, 'orden') ?? '', vista: str(input, 'vista') ?? '',
      }));
      const f = { ...FILTROS_INICIALES, ...base, outlierMin: pisoDeOutlier(input.outlierMinimo) };
      const vistos = filtrarCarruseles(r.carruseles, f, new Set(r.guardados.map((g) => g.id)));
      const tope = typeof input.tope === 'number' ? Math.max(1, Math.min(30, Math.round(input.tope))) : 10;
      return JSON.stringify({
        total: vistos.length,
        carruseles: vistos.slice(0, tope).map(carruselParaApi),
        link: linkExplorador(queryDeFiltros(f), ctx.ws),
        nota: 'Son publicaciones de otras cuentas: sirven de referencia de estructura. El outlier es cuántas veces la mediana de su cuenta.',
      });
    },
  },

  guardar_carrusel: {
    preparar: async (input): Promise<Preparado> => {
      const id = typeof input.carruselId === 'number' ? input.carruselId : NaN;
      if (!Number.isSafeInteger(id) || id <= 0) return { error: 'Falta el id del carrusel (de buscar_carruseles).', faltan: ['carruselId'] };
      const guardar = input.guardar !== false;
      const r = await leerExplorador();
      if (!r.ok) return { error: 'No pude leer los carruseles. Vuelve a intentar.', falla: true };
      const c = r.carruseles.find((x) => x.id === id);
      if (!c) return { error: 'Ese carrusel no está entre los de las cuentas que sigue el negocio. Búscalo con buscar_carruseles.' };
      const ya = r.guardados.some((g) => g.id === id);
      if (ya === guardar) return { error: guardar ? 'Ese carrusel ya está guardado.' : 'Ese carrusel no estaba guardado.', yaEstaba: true };
      const quien = c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre;
      return { payload: { carruselId: id, guardar }, resumen: guardar ? `Guardar el carrusel de ${quien} en las referencias.` : `Sacar el carrusel de ${quien} de las referencias.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = Number(payload.carruselId);
      const guardar = payload.guardar !== false;
      const r = await guardarCarrusel(id, guardar);
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: guardar ? 'Guardado.' : 'Sacado de los guardados.', datos: { carruselId: id, link: linkExplorador('ver=carruseles&vista=guardados', ctx.ws) } };
    },
  },

  // «Hacer el mío» por la API (4/11/2026): la MISMA función que la pantalla (lib/carruseles/crear-servidor.ts). La estructura,
  // nunca sus palabras: el diseño nace con una guía de qué escribir en cada lámina.
  crear_carrusel_desde_referencia: {
    preparar: async (input): Promise<Preparado> => {
      const id = typeof input.carruselId === 'number' ? input.carruselId : NaN;
      if (!Number.isSafeInteger(id) || id <= 0) return { error: 'Falta el id del carrusel (de buscar_carruseles).', faltan: ['carruselId'] };
      if (input.tipo != null && !esTipoCarrusel(input.tipo)) return { error: 'Ese tipo de carrusel no existe en MaKo.', faltan: ['tipo'] };
      let c;
      try { c = await referenciaDelNegocio(id); } catch { return { error: 'No pude leer ese carrusel. Vuelve a intentar.', falla: true }; }
      if (!c) return { error: 'Ese carrusel no está entre los de las cuentas que sigue el negocio. Búscalo con buscar_carruseles.' };
      const e = estructuraDe(c);
      const plan = planDeReferencia(e, input.tipo, input.laminas);
      if ('error' in plan) return { error: plan.error, faltan: ['tipo'] };
      return {
        payload: { carruselId: id, tipo: plan.tipo.id, laminas: plan.laminas },
        resumen: `Crear un carrusel «${plan.tipo.nombre}» de ${plan.laminas} láminas con la estructura del de ${e.de} (${frasesDe(e).slice(2).join(', ') || 'sin gancho ni cierre leídos'}). Cada lámina trae una guía de qué escribir: sus palabras no se copian.`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const r = await crearCarruselDesdeReferencia(ctx.ws, QUIEN, Number(payload.carruselId), payload.tipo, payload.laminas);
      if (!r.ok) return { ok: false, resumen: r.error };
      const url = link(r.id, ctx.ws);
      const bloque = bloqueDiseno(r.id, { titulo: r.titulo, ancho: 1080, alto: 1350, estado: 'Nuevo', nota: `Con la estructura de ${r.de}: escribe lo tuyo en cada lámina.` });
      return { ok: true, resumen: `Creado (${r.laminas} láminas). Ábrelo aquí: ${url}`, datos: { disenoId: r.id, link: url, bloque } };
    },
  },
};
