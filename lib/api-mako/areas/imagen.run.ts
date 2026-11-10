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
import { PLANTILLAS_IMAGEN, plantillaImagen } from '@/lib/image-editor/plantillas-reales';
import { guardarCarrusel, leerExplorador } from '@/lib/carruseles/explorar-servidor';
import { crearCarruselDesdeReferencia, referenciaDelNegocio } from '@/lib/carruseles/crear-servidor';
import { replicarCarrusel, replicarEjemplo } from '@/lib/carruseles/replica-servidor';
import { FILTROS_THUMBNAIL, filtrarThumbnails, filtrosThumbnailDeQuery, imagenDeVideo, queryDeThumbnails, urlDeVideo, type Thumbnail } from '@/lib/thumbnails/explorar';
import { guardarThumbnail, leerThumbnails, thumbnailPorId } from '@/lib/thumbnails/servidor';
import { ENMIENDA_III_L, FALTA_LA_ENMIENDA, LEYENDA_DERIVADA } from '@/lib/spy-reglas';
import { rotuloAire } from '@/lib/carruseles/anuncios';
import { estructuraDe, frasesDe, planDeReferencia } from '@/lib/carruseles/referencia';
import { esTipoCarrusel } from '@/lib/carruseles/tipos';
import { bibliotecaParaEditar, cambiarBiblioteca, puedeEditarBiblioteca } from '@/lib/carruseles/biblioteca-servidor';
import type { CambioBiblioteca } from '@/lib/carruseles/biblioteca';
import {
  FILTROS_INICIALES, OUTLIER_MINIMOS, filtrarCarruseles, filtrosDeQuery, imagenesDe, queryDeFiltros, rotuloCta, rotuloFormato, rotuloOutlier, type Carrusel,
} from '@/lib/carruseles/explorar';
import { explicarMultiplo } from '@/lib/multiplo-rendimiento';

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

/** El diseño nuevo que pide la entrada: de una plantilla real, de un tamaño con nombre o a medida. Sin miniatura: la
 *  traían las 10 de Doory (`public/cv/plantillas/<slug>.webp`, borradas el 6/11/2026) y un diseño recién creado todavía
 *  no tiene la suya, así que el chat dibuja el marco con «ancho × alto». */
async function docNuevo(input: Record<string, unknown>): Promise<{ doc: unknown; que: string; ancho: number; alto: number; nota: string } | { error: string; faltan?: string[] }> {
  const plantilla = str(input, 'plantilla');
  // Una plantilla real (6/11/2026) nace con su ESTRUCTURA, como en «Nuevo diseño»: los textos dicen qué va en cada capa.
  const real = plantilla ? plantillaImagen(plantilla) : null;
  if (real) {
    return {
      doc: real.estructura(randomUUID), que: `con la estructura de la plantilla «${real.nombre}»`, ancho: real.ancho, alto: real.alto,
      nota: `Estructura de «${real.nombre}»: cambia sus textos con cambiar_textos_diseno_imagen`,
    };
  }
  // Las 10 de Doory se borraron (6/11/2026): no quedan plantillas de «diseño libre», sólo las reales de MaKo.
  if (plantilla) return { error: `No existe la plantilla «${plantilla}». Usa listar_plantillas_imagen.`, faltan: ['plantilla'] };
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

/** El link a los ejemplos con unos filtros (`/image-editor?…`: desde el 6/11/2026 son la portada de Image, sin `?ver=`). */
const linkExplorador = (query: string, ws: number) => linkApp(query ? `/image-editor?${query}` : '/image-editor', ws);

/** Un carrusel como lo devuelve la API: su creador y el link a SU publicación (es una referencia, no algo de MaKo). */
const carruselParaApi = (c: Carrusel) => ({
  id: c.id,
  creador: c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre,
  // De una cuenta que sigue el negocio, o de la biblioteca de ejemplos de la plataforma.
  origen: c.origen,
  original: c.url,
  outlier: c.outlier == null ? null : rotuloOutlier(c.outlier),
  // De qué mediana sale ese número, o por qué no hay («sin datos suficientes»): lib/multiplo-rendimiento.ts, como el chip.
  outlierDice: c.multiplo ? explicarMultiplo(c.multiplo) : null,
  laminas: c.laminas,
  formato: rotuloFormato(c.formato) || null,
  gancho: c.gancho,
  // Lo que se entendió de su estructura (lo mismo que dice «Hacer el mío»): con esto se elige con qué crear el del negocio.
  estructura: frasesDe(estructuraDe(c)),
  texto: c.texto ? c.texto.slice(0, 280) : null,
  megusta: c.megusta, comentarios: c.comentarios, publicado: c.publicada,
  // 6/11/2026: si pide comentar una palabra (el filtro CTA), un anuncio con sus días al aire, y cuántas láminas se pueden ver.
  cta: c.cta ? rotuloCta(c.cta) : null,
  ...(c.clase === 'anuncio' ? { clase: 'anuncio', alAire: rotuloAire(c), activo: c.activo ?? null } : {}),
  imagenes: imagenesDe(c).length,
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
    leer: async () => JSON.stringify({
      // Las de MaKo (6/11/2026, lib/image-editor/plantillas-reales.ts): se crean con su estructura; `ejemplo` son los textos
      // de la misma composición llena, de un negocio ficticio, para escribir los del negocio con esa forma.
      // Son las ÚNICAS: las 10 de Doory que salían en `plantillas` se borraron el 6/11/2026 (eran material ajeno).
      reales: PLANTILLAS_IMAGEN.map((p) => ({
        id: p.id, nombre: p.nombre, cuando: p.cuando, grupo: p.grupo, ancho: p.ancho, alto: p.alto, paginas: p.paginas,
        pide: p.pide, ejemplo: { negocio: `${p.negocio} (ficticio)`, textos: textosDe(p.ejemplo(randomUUID)) },
      })),
    }),
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
      const bloque = bloqueDiseno(r.id, { titulo, ancho: n.ancho, alto: n.alto, estado: 'Nuevo', nota: n.nota });
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
        // Los de la biblioteca de ejemplos (públicos, de la plataforma): se ven aunque el negocio todavía no siga a nadie.
        deLaBiblioteca: r.ejemplos,
        ...(r.paso === 'listo'
          ? { siguiente: 'Usa buscar_carruseles para ver los que mejor funcionan.', link: linkExplorador('', ctx.ws) }
          : {
            siguiente: r.ejemplos ? `Ya puede mirar los ejemplos de la biblioteca con buscar_carruseles. Para ver también los de su rubro: ${r.frase}` : r.frase,
            ...(r.accion ? { donde: linkApp(r.accion.ruta, ctx.ws) } : {}),
          }),
      });
    },
  },

  buscar_carruseles: {
    leer: async (input, ctx) => {
      const r = await leerExplorador();
      if (!r.ok) return JSON.stringify({ error: 'No pude leer los carruseles de las cuentas que sigue el negocio. Vuelve a intentar.' });
      // Sin carruseles todavía, lo que contesta es la guía (en qué paso está), nunca una lista vacía que parezca un cero.
      if (!r.carruseles.length) return JSON.stringify({ paso: r.paso, carruseles: [], siguiente: r.frase, ...(r.accion ? { donde: linkApp(r.accion.ruta, ctx.ws) } : {}) });
      const base = filtrosDeQuery(new URLSearchParams({
        q: str(input, 'buscar') ?? '', periodo: str(input, 'periodo') ?? '', orden: str(input, 'orden') ?? '', vista: str(input, 'vista') ?? '',
        origen: str(input, 'origen') ?? '', que: str(input, 'que') === 'anuncios' ? 'anuncios' : '',
      }));
      const f = { ...FILTROS_INICIALES, ...base, outlierMin: pisoDeOutlier(input.outlierMinimo) };
      const vistos = filtrarCarruseles(r.carruseles, f, new Set(r.guardados.map((g) => g.id)));
      const tope = typeof input.tope === 'number' ? Math.max(1, Math.min(30, Math.round(input.tope))) : 10;
      return JSON.stringify({
        total: vistos.length,
        carruseles: vistos.slice(0, tope).map(carruselParaApi),
        link: linkExplorador(queryDeFiltros(f), ctx.ws),
        nota: 'Son publicaciones públicas de otras cuentas (las que sigue el negocio, o la biblioteca de ejemplos): sirven de referencia, siempre con su creador. Para que el negocio tenga SU versión editable de uno, editar_ejemplo_carrusel. El outlier es cuántas veces lo que suele hacer su cuenta (frente a hasta 20 publicaciones suyas cercanas en el tiempo, con 7 como mínimo); sin datos suficientes es null y outlierDice dice por qué. Los que llegaron por un tema no lo llevan. Los anuncios no tienen outlier: alAire dice cuántos días llevan.',
      });
    },
  },

  guardar_carrusel: {
    preparar: async (input): Promise<Preparado> => {
      const id = typeof input.carruselId === 'number' ? input.carruselId : NaN;
      if (!Number.isSafeInteger(id) || id === 0) return { error: 'Falta el id del carrusel (de buscar_carruseles).', faltan: ['carruselId'] };
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
      return { ok: true, resumen: guardar ? 'Guardado.' : 'Sacado de los guardados.', datos: { carruselId: id, link: linkExplorador('vista=guardados', ctx.ws) } };
    },
  },

  // «Hacer el mío» por la API (4/11/2026): la MISMA función que la pantalla (lib/carruseles/crear-servidor.ts). La estructura,
  // nunca sus palabras: el diseño nace con una guía de qué escribir en cada lámina.
  crear_carrusel_desde_referencia: {
    preparar: async (input): Promise<Preparado> => {
      const id = typeof input.carruselId === 'number' ? input.carruselId : NaN;
      if (!Number.isSafeInteger(id) || id === 0) return { error: 'Falta el id del carrusel (de buscar_carruseles).', faltan: ['carruselId'] };
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

  // La biblioteca de ejemplos (4/11/2026): la misma puerta que la pantalla (`puedeEditarBiblioteca`), además de
  // `soloPlataforma` del registro. La lista y los temas los ven todos los negocios.
  ver_biblioteca_carruseles: {
    leer: async () => {
      if (!(await puedeEditarBiblioteca())) return JSON.stringify({ error: 'La biblioteca de ejemplos la edita la plataforma.' });
      const b = await bibliotecaParaEditar().catch(() => undefined);
      if (b === undefined) return JSON.stringify({ error: 'No pude leer la biblioteca. Vuelve a intentar.' });
      if (b === null) return JSON.stringify({ error: 'La biblioteca todavía no está creada (falta aplicar la migración 0392).' });
      return JSON.stringify({
        cuentas: b.cuentas.map((c) => ({ instagram: `@${c.instagram}`, nombre: c.nombre, estado: c.estado, motivo: c.motivo, publicaciones: c.piezas, leida: c.leida_en, ...(c.dudosa ? { aviso: 'Al leerla trajo casi nada: puede no ser la cuenta del creador.' } : {}) })),
        creadoresPorTema: b.porTema,
        temas: b.temas.map((t) => ({ hashtag: `#${t.hashtag}`, nombre: t.nombre, activo: t.activo, carruseles: t.piezas, leido: t.leido_en })),
        nota: 'Se lee con el script de la PC (scripts/carruseles-biblioteca.mts). Lo que se suma aparece la próxima vez que corre.',
      });
    },
  },

  cambiar_biblioteca_carruseles: {
    preparar: async (input): Promise<Preparado> => {
      if (!(await puedeEditarBiblioteca())) return { error: 'La biblioteca de ejemplos la edita la plataforma.' };
      const pedido = pedidoDeBiblioteca(input);
      if ('error' in pedido) return { error: pedido.error, faltan: pedido.faltan };
      const que = pedido.que === 'cuenta' ? `@${pedido.valor.replace(/^@/, '')}` : `#${pedido.valor.replace(/^#/, '')}`;
      const resumen = pedido.accion === 'sumar' ? `Sumar ${que} a la biblioteca de ejemplos.`
        : pedido.accion === 'volver' ? `Volver a sumar ${que} a la biblioteca de ejemplos.`
        : pedido.que === 'cuenta' ? `Sacar ${que} de la biblioteca de ejemplos («${pedido.motivo}»): sus carruseles dejan de verse en todos los negocios.`
        : `Apagar el tema ${que}: no se lee más (lo que ya trajo queda).`;
      return { payload: { ...pedido }, resumen };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      if (!(await puedeEditarBiblioteca())) return { ok: false, resumen: 'La biblioteca de ejemplos la edita la plataforma.' };
      const pedido = pedidoDeBiblioteca(payload);
      if ('error' in pedido) return { ok: false, resumen: pedido.error };
      const r = await cambiarBiblioteca(pedido, QUIEN);
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: r.ya ?? 'Listo. Se lee la próxima vez que corre el script de la PC.' };
    },
  },

  // «Editar» un ejemplo (6/11/2026): la MISMA función que el botón de la pantalla (lib/carruseles/replica-servidor.ts), sin el
  // armado en vivo. Con la IA del negocio (su Claude, su GPT o su Gemini); sin ella, sale con guías y lo dice.
  editar_ejemplo_carrusel: {
    preparar: async (input): Promise<Preparado> => {
      const id = typeof input.carruselId === 'number' ? input.carruselId : NaN;
      if (!Number.isSafeInteger(id) || id === 0) return { error: 'Falta el id del ejemplo (de buscar_carruseles).', faltan: ['carruselId'] };
      let c;
      try { c = await referenciaDelNegocio(id); } catch { return { error: 'No pude leer ese ejemplo. Vuelve a intentar.', falla: true }; }
      if (!c) return { error: 'Ese ejemplo no está entre los de las cuentas que sigue el negocio ni en la biblioteca. Búscalo con buscar_carruseles.' };
      const de = c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre;
      const pedido = str(input, 'pedido');
      const n = c.clase === 'anuncio' ? null : c.laminas;
      // La oferta (el guiado, 9/11/2026): se lee de la base del negocio AL PROPONER, así el resumen dice cuál es y una que no
      // existe falla acá, antes del «sí» (AGENTS.md: lo que se puede saber sin escribir falla en `preparar`).
      const ofertaId = typeof input.ofertaId === 'number' && Number.isSafeInteger(input.ofertaId) && input.ofertaId > 0 ? input.ofertaId : null;
      let oferta: string | null = null;
      if (ofertaId) {
        try {
          const { listarOfertas } = await import('@/lib/ofertas');
          oferta = (await listarOfertas(true)).find((x) => x.id === ofertaId)?.nombre ?? null;
        } catch { return { error: 'No pude leer las ofertas del negocio. Vuelve a intentar.', falla: true }; }
        if (!oferta) return { error: 'Esa oferta no está entre las activas del negocio: búscala con listar_ofertas.' };
      }
      const avatar = input.avatar === 'cara' || input.avatar === 'look' || input.avatar === 'ninguno' ? input.avatar : null;
      const cambio = input.cambio === 'marca' ? 'marca' : 'textos';
      const guiado = ofertaId || avatar || input.cambio ? { ofertaId, avatar, cambio } : null;
      const conQuien = avatar === 'ninguno' ? ', sin persona' : avatar === 'look' ? ', con tu último look' : avatar === 'cara' ? ', con tu cara de marca' : '';
      return {
        payload: { carruselId: id, ...(pedido ? { pedido: pedido.slice(0, 400) } : {}), ...(guiado ? { guiado } : {}) },
        resumen: `Armar tu versión editable del ${c.clase === 'anuncio' ? 'anuncio' : 'carrusel'} de ${de}${n ? ` (${n} láminas)` : ''}${oferta ? ` para «${oferta}»` : ''}${conQuien}: su diseño, con textos escritos para tu negocio por tu IA${cambio === 'marca' ? ' y los colores de tu marca' : ''}${pedido ? ` («${pedido.slice(0, 120)}»)` : ''}. Sus palabras no se copian.`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const { leerPedidoGuiado } = await import('@/lib/carruseles/guiado');
      const g = payload.guiado && typeof payload.guiado === 'object' ? payload.guiado as Record<string, unknown> : null;
      const guiado = g ? leerPedidoGuiado({ ...g, pedido: typeof payload.pedido === 'string' ? payload.pedido : null }) : null;
      const r = await replicarCarrusel(ctx.ws, QUIEN, Number(payload.carruselId), { pedido: typeof payload.pedido === 'string' ? payload.pedido : null, guiado });
      if (!r.ok) return { ok: false, resumen: r.error };
      const url = link(r.id, ctx.ws);
      const bloque = bloqueDiseno(r.id, { titulo: r.titulo, estado: 'Nuevo', nota: r.aviso ?? 'Tu versión, lista para editar.' });
      return {
        ok: true,
        resumen: `${r.sinIA ? 'Creado con guías en cada lámina' : 'Creado con tus textos'}. Ábrelo aquí: ${url}${r.aviso ? ` · ${r.aviso}` : ''}`,
        datos: { disenoId: r.id, link: url, bloque, sinIA: !!r.sinIA, ...(r.conectar ? { conectar: linkApp(r.conectar, ctx.ws) } : {}) },
      };
    },
  },

  // ── Thumbnails (6/11/2026): las MISMAS funciones que la pantalla (lib/thumbnails/). Lo que se lee, de la biblioteca global. ──
  buscar_thumbnails: {
    leer: async (input, ctx) => {
      const r = await leerThumbnails();
      if (!r.ok) return JSON.stringify({ error: 'No pude leer las miniaturas de ejemplo. Vuelve a intentar.' });
      if (!r.thumbnails.length) return JSON.stringify({ thumbnails: [], siguiente: 'La biblioteca de miniaturas todavía no tiene videos: se carga desde la plataforma.' });
      const f = { ...FILTROS_THUMBNAIL, ...filtrosThumbnailDeQuery(new URLSearchParams({
        q: str(input, 'buscar') ?? '', nicho: str(input, 'nicho') ?? '', idioma: str(input, 'idioma') ?? '', periodo: str(input, 'periodo') ?? '',
        orden: str(input, 'orden') ?? '', vista: str(input, 'vista') ?? '',
      })) };
      const vistos = filtrarThumbnails(r.thumbnails, f, new Set(r.guardados));
      const tope = typeof input.tope === 'number' ? Math.max(1, Math.min(30, Math.round(input.tope))) : 10;
      return JSON.stringify({
        total: vistos.length,
        thumbnails: vistos.slice(0, tope).map(thumbnailParaApi),
        link: linkExplorador(queryDeThumbnails(f), ctx.ws),
        nota: `Son miniaturas de videos públicos de YouTube (de su canal: siempre con su link). Para que el negocio tenga SU versión editable de una, editar_ejemplo_thumbnail. ${ENMIENDA_III_L ? `El múltiplo: ${LEYENDA_DERIVADA}` : `Sin múltiplo: ${FALTA_LA_ENMIENDA}`}`,
      });
    },
  },

  guardar_thumbnail: {
    preparar: async (input): Promise<Preparado> => {
      const id = typeof input.thumbnailId === 'number' ? input.thumbnailId : NaN;
      if (!Number.isSafeInteger(id) || id <= 0) return { error: 'Falta el id de la miniatura (de buscar_thumbnails).', faltan: ['thumbnailId'] };
      const guardar = input.guardar !== false;
      const r = await leerThumbnails();
      if (!r.ok) return { error: 'No pude leer las miniaturas. Vuelve a intentar.', falla: true };
      const t = r.thumbnails.find((x) => x.id === id);
      if (!t) return { error: 'Esa miniatura no está en la biblioteca. Búscala con buscar_thumbnails.' };
      if (r.guardados.includes(id) === guardar) return { error: guardar ? 'Esa miniatura ya está guardada.' : 'Esa miniatura no estaba guardada.', yaEstaba: true };
      const quien = t.canal.handle || t.canal.nombre;
      return { payload: { thumbnailId: id, guardar }, resumen: guardar ? `Guardar la miniatura de ${quien} en las referencias.` : `Sacar la miniatura de ${quien} de las referencias.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = Number(payload.thumbnailId);
      const guardar = payload.guardar !== false;
      const r = await guardarThumbnail(id, guardar);
      if (!r.ok) return { ok: false, resumen: r.error };
      return { ok: true, resumen: guardar ? 'Guardada.' : 'Sacada de los guardados.', datos: { thumbnailId: id, link: linkExplorador('que=thumbnails&vista=guardados', ctx.ws) } };
    },
  },

  // «Editar» una miniatura: la MISMA función que el botón (lib/carruseles/replica-servidor.ts, `replicarEjemplo`), sin el armado en
  // vivo, en 1280 × 720. Con la IA del negocio; sin ella, sale con una guía y lo dice.
  editar_ejemplo_thumbnail: {
    preparar: async (input): Promise<Preparado> => {
      const id = typeof input.thumbnailId === 'number' ? input.thumbnailId : NaN;
      if (!Number.isSafeInteger(id) || id <= 0) return { error: 'Falta el id de la miniatura (de buscar_thumbnails).', faltan: ['thumbnailId'] };
      let t: Thumbnail | null;
      try { t = await thumbnailPorId(id); } catch { return { error: 'No pude leer esa miniatura. Vuelve a intentar.', falla: true }; }
      if (!t) return { error: 'Esa miniatura no está en la biblioteca. Búscala con buscar_thumbnails.' };
      const pedido = str(input, 'pedido');
      return {
        payload: { thumbnailId: id, ...(pedido ? { pedido: pedido.slice(0, 400) } : {}) },
        resumen: `Armar tu versión editable (1280 × 720) de la miniatura de ${t.canal.handle || t.canal.nombre}${t.titulo ? ` («${t.titulo.slice(0, 80)}»)` : ''}: su diseño, con el texto escrito para tu negocio por tu IA${pedido ? ` («${pedido.slice(0, 120)}»)` : ''}. Sus palabras no se copian.`,
      };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const r = await replicarEjemplo(ctx.ws, QUIEN, { que: 'thumbnail', id: Number(payload.thumbnailId) }, { pedido: typeof payload.pedido === 'string' ? payload.pedido : null });
      if (!r.ok) return { ok: false, resumen: r.error };
      const url = link(r.id, ctx.ws);
      const bloque = bloqueDiseno(r.id, { titulo: r.titulo, ancho: 1280, alto: 720, estado: 'Nuevo', nota: r.aviso ?? 'Tu versión, lista para editar.' });
      return {
        ok: true,
        resumen: `${r.sinIA ? 'Creada con una guía' : 'Creada con tu texto'}. Ábrela aquí: ${url}${r.aviso ? ` · ${r.aviso}` : ''}`,
        datos: { disenoId: r.id, link: url, bloque, sinIA: !!r.sinIA, ...(r.conectar ? { conectar: linkApp(r.conectar, ctx.ws) } : {}) },
      };
    },
  },
};

/** Una miniatura como la devuelve la API: su canal, sus vistas y el link a SU video (es una referencia, no algo de MaKo). */
const thumbnailParaApi = (t: Thumbnail) => ({
  id: t.id,
  canal: t.canal.handle || t.canal.nombre,
  titulo: t.titulo,
  video: urlDeVideo(t.video),
  imagen: imagenDeVideo(t.video),
  vistas: t.vistas,
  publicado: t.publicado,
  rubro: t.nicho,
  idioma: t.idioma,
  // Sólo con la enmienda III.L (lib/spy-reglas.ts): sin ella es null.
  multiplo: t.outlier == null ? null : t.outlier,
});

/** El pedido de cambio de la biblioteca desde lo que mandó el modelo (o el payload confirmado). */
function pedidoDeBiblioteca(input: Record<string, unknown>): CambioBiblioteca | { error: string; faltan: string[] } {
  const que = input.que === 'tema' ? 'tema' : input.que === 'cuenta' ? 'cuenta' : null;
  const accion = input.accion === 'sumar' || input.accion === 'sacar' || input.accion === 'volver' ? input.accion : null;
  const valor = str(input, 'valor');
  if (!que || !accion || !valor) return { error: 'Falta qué (cuenta o tema), qué hacer y el @ o el #.', faltan: ['que', 'accion', 'valor'] };
  const nombre = str(input, 'nombre') ?? valor.replace(/^[@#]/, '');
  if (accion === 'sumar') return que === 'cuenta' ? { que, accion, valor, nombre } : { que, accion, valor, nombre };
  if (accion === 'sacar' && que === 'cuenta') {
    const motivo = str(input, 'motivo');
    return motivo ? { que, accion, valor, motivo } : { error: 'Falta por qué sale la cuenta (por ejemplo, «lo pidió»).', faltan: ['motivo'] };
  }
  return que === 'cuenta' ? { que, accion: 'volver', valor } : { que, accion, valor };
}
