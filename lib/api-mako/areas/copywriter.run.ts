// =============================================================================
// api-mako/areas/copywriter.run — los cuerpos de las operaciones del Copywriter (área `contenido`, archivo propio)
// =============================================================================
// Las definiciones (qué es cada una, sus canales, cómo se confirma) en ./copywriter.def.ts. Todo lo que lee o escribe
// pasa por lib/copywriter/server.ts: la MISMA puerta que la pantalla (compare-and-set, el negocio de la pestaña o del
// token, la Papelera). Nada escribe `app_settings` por su cuenta acá.
// La puerta de la tab (`veCopywriterEnApi`, lib/copywriter/puerta-api.ts) se pregunta en CADA runner: el gating de la API
// mira la capa del negocio, no que la tab todavía sea sólo del super admin.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Preparado, Runners } from '../tipos';
import { abrir, crear, guardar, listar, papelera, renombrar, restaurar } from '@/lib/copywriter/server';
import { bloquesDelDoc, docDeEstructura, textoDelDoc } from '@/lib/copywriter/doc';
import { bloquesDeTexto, docDeTexto } from '@/lib/copywriter/texto';
import { escondida } from '@/lib/copywriter/arbol';
import { esTipoGuion, INFO_TIPO, SIN_TITULO, type PaginaCopy } from '@/lib/copywriter/tipos';
import { catalogosDelCopywriter } from '@/lib/copywriter/catalogos-server';
import { veCopywriterEnApi } from '@/lib/copywriter/puerta-api';

const str = (o: Record<string, unknown>, k: string): string => (typeof o[k] === 'string' ? (o[k] as string).trim() : '');
const json = (v: unknown) => JSON.stringify(v, null, 2);
const error = (m: string) => ({ content: m, isError: true });
const CERRADA = 'El Copywriter todavía no está abierto para este negocio.';

/** El link a un documento en la app (lo escribe el código, nunca el modelo). */
const linkDoc = (id: string) => `/copywriter/${id}`;
const nombreDe = (p: PaginaCopy) => `«${p.titulo}» (${INFO_TIPO[p.tipo].label})`;

async function paginaViva(id: string): Promise<{ p: PaginaCopy; todas: PaginaCopy[] } | { error: string }> {
  if (!id) return { error: 'Falta documentoId (de listar_documentos_copywriter).' };
  const r = await listar();
  if (!r.ok) return { error: r.error };
  const p = r.paginas.find((x) => x.id === id);
  if (!p) return { error: `No hay ningún documento con id «${id}» en este negocio. Pide listar_documentos_copywriter.` };
  return { p, todas: r.paginas };
}

const cerrada = async (ctx: Ctx) => !(await veCopywriterEnApi(ctx.ws));

export const RUNNERS: Runners = {
  listar_documentos_copywriter: {
    leer: async (input, ctx) => {
      if (await cerrada(ctx)) return error(CERRADA);
      const r = await listar();
      if (!r.ok) return error(`No pude leer los documentos: ${r.error}`);
      const tipo = str(input, 'tipo');
      const conPapelera = input.conPapelera === true;
      const docs = r.paginas
        .filter((p) => (!tipo || p.tipo === tipo) && (conPapelera || !escondida(r.paginas, p.id)))
        .sort((a, b) => b.actualizado.localeCompare(a.actualizado))
        .map((p) => ({ documentoId: p.id, titulo: p.titulo, tipo: p.tipo, padreId: p.padre, actualizado: p.actualizado, ...(escondida(r.paginas, p.id) ? { enPapelera: true } : {}), link: linkDoc(p.id) }));
      return json({ documentos: docs, total: docs.length });
    },
  },

  leer_documento_copywriter: {
    leer: async (input, ctx) => {
      if (await cerrada(ctx)) return error(CERRADA);
      const id = str(input, 'documentoId');
      const r = await abrir(id);
      if (!r.ok) return error(r.status === 404 ? `No hay ningún documento con id «${id}» en este negocio. Pide listar_documentos_copywriter.` : `No pude leerlo: ${r.error}`);
      return json({
        documentoId: r.pagina.id, titulo: r.pagina.titulo, tipo: r.pagina.tipo, propiedades: r.doc.props, version: r.doc.version,
        texto: textoDelDoc(r.doc.contenido), bloques: bloquesDelDoc(r.doc.contenido), link: linkDoc(r.pagina.id),
        nota: 'version se copia tal cual para reemplazar_documento_copywriter. En el texto, cada etiqueta en MAYÚSCULA abre una sección.',
      });
    },
  },

  crear_documento_copywriter: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (await cerrada(ctx)) return { error: CERRADA };
      const titulo = str(input, 'titulo');
      const tipo = str(input, 'tipo');
      if (!titulo) return { error: 'Falta el título.', faltan: ['titulo'] };
      if (!esTipoGuion(tipo)) return { error: 'El tipo es ad, reel, story o youtube.', faltan: ['tipo'] };
      const estructuraId = str(input, 'estructuraId');
      if (estructuraId && !(await catalogosDelCopywriter()).estructuras.some((e) => e.id === estructuraId)) return { error: `No hay ninguna estructura «${estructuraId}» en la biblioteca (catalogo_estructuras_guion).` };
      const padreId = str(input, 'padreId');
      if (padreId) {
        const p = await paginaViva(padreId);
        if ('error' in p) return { error: p.error };
      }
      const texto = str(input, 'texto');
      return {
        payload: { titulo, tipo, estructuraId: estructuraId || null, texto, padreId: padreId || null },
        resumen: `Crear en el Copywriter ${INFO_TIPO[tipo].uno}: «${titulo}»${texto ? ` (${texto.split(/\s+/).length} palabras)` : estructuraId ? ' con las secciones de su estructura' : ''}.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const tipo = str(payload, 'tipo');
      if (!esTipoGuion(tipo)) return { ok: false, resumen: 'La acción quedó con un tipo inválido.' };
      const estructuraId = str(payload, 'estructuraId');
      const e = estructuraId ? (await catalogosDelCopywriter()).estructuras.find((x) => x.id === estructuraId) : null;
      const texto = str(payload, 'texto');
      const r = await crear({
        tipo, titulo: str(payload, 'titulo'), padre: str(payload, 'padreId') || null,
        props: { estructura: e?.id ?? null },
        contenido: texto ? docDeTexto(texto) : e ? docDeEstructura(e.etiquetas) : undefined,
      });
      if (!r.ok) return { ok: false, resumen: `No se pudo crear: ${r.error}` };
      return { ok: true, resumen: `Listo: ${nombreDe(r.pagina)} está en el Copywriter.`, datos: { documentoId: r.pagina.id, link: linkDoc(r.pagina.id) } };
    },
  },

  agregar_al_documento_copywriter: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (await cerrada(ctx)) return { error: CERRADA };
      const texto = str(input, 'texto');
      if (!texto) return { error: 'Falta el texto.', faltan: ['texto'] };
      const p = await paginaViva(str(input, 'documentoId'));
      if ('error' in p) return { error: p.error };
      return { payload: { documentoId: p.p.id, texto }, resumen: `Agregar al final de ${nombreDe(p.p)}: ${texto.slice(0, 160)}${texto.length > 160 ? '…' : ''}` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = str(payload, 'documentoId');
      // Lee lo de AHORA y escribe con su versión: si alguien lo cambió en el medio, se vuelve a leer una vez.
      for (let i = 0; i < 2; i++) {
        const r = await abrir(id);
        if (!r.ok) return { ok: false, resumen: r.status === 404 ? 'El documento ya no existe.' : `No pude leerlo: ${r.error}` };
        const contenido = { ...r.doc.contenido, content: [...(r.doc.contenido.content ?? []), ...bloquesDeTexto(str(payload, 'texto'))] };
        const g = await guardar({ id, version: r.doc.version, contenido });
        if (g.ok) return { ok: true, resumen: `Listo: lo agregué al final de ${nombreDe(r.pagina)}.`, datos: { documentoId: id, version: g.version, link: linkDoc(id) } };
        if (g.status !== 409) return { ok: false, resumen: `No se pudo guardar: ${g.error}` };
      }
      return { ok: false, resumen: 'El documento cambió mientras lo escribía. Vuelve a intentar.' };
    },
  },

  reemplazar_documento_copywriter: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (await cerrada(ctx)) return { error: CERRADA };
      const texto = str(input, 'texto');
      if (!texto) return { error: 'El documento no puede quedar vacío.', faltan: ['texto'] };
      const version = typeof input.version === 'number' ? input.version : NaN;
      if (!Number.isInteger(version)) return { error: 'Falta la versión que se leyó (leer_documento_copywriter).', faltan: ['version'] };
      const r = await abrir(str(input, 'documentoId'));
      if (!r.ok) return { error: r.status === 404 ? 'Ese documento no existe en este negocio.' : r.error };
      if (r.doc.version !== version) return { error: 'El documento cambió desde que se leyó. No se aplicó nada: vuelve a leerlo y propón de nuevo.' };
      const antes = textoDelDoc(r.doc.contenido);
      if (antes.trim() === texto) return { error: 'El texto nuevo es igual al actual: no hay nada que cambiar.' };
      const palabras = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
      return {
        payload: { documentoId: r.pagina.id, version, texto },
        resumen: `Reemplazar el texto de ${nombreDe(r.pagina)} (${palabras(antes)} → ${palabras(texto)} palabras). La versión anterior se pierde.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = str(payload, 'documentoId');
      const version = typeof payload.version === 'number' ? payload.version : NaN;
      const g = await guardar({ id, version, contenido: docDeTexto(str(payload, 'texto')) });
      if (!g.ok) return { ok: false, resumen: g.status === 409 ? 'El documento cambió desde que se leyó: no se aplicó.' : `No se pudo guardar: ${g.error}` };
      return { ok: true, resumen: 'Listo: el documento tiene el texto nuevo.', datos: { documentoId: id, version: g.version, link: linkDoc(id) } };
    },
  },

  renombrar_documento_copywriter: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (await cerrada(ctx)) return { error: CERRADA };
      const titulo = str(input, 'titulo');
      if (!titulo) return { error: 'Falta el título nuevo.', faltan: ['titulo'] };
      const p = await paginaViva(str(input, 'documentoId'));
      if ('error' in p) return { error: p.error };
      if (p.p.titulo === titulo) return { error: `Ya se llama «${titulo}».`, yaEstaba: true };
      return { payload: { documentoId: p.p.id, titulo }, resumen: `Renombrar ${nombreDe(p.p)} a «${titulo}».` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const r = await renombrar(str(payload, 'documentoId'), { titulo: str(payload, 'titulo') || SIN_TITULO });
      if (!r.ok) return { ok: false, resumen: `No se pudo renombrar: ${r.error}` };
      return { ok: true, resumen: `Listo: ahora se llama «${str(payload, 'titulo')}».`, datos: { documentoId: str(payload, 'documentoId') } };
    },
  },

  papelera_documento_copywriter: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (await cerrada(ctx)) return { error: CERRADA };
      const p = await paginaViva(str(input, 'documentoId'));
      if ('error' in p) return { error: p.error };
      if (p.p.papelera) return { error: `${nombreDe(p.p)} ya está en la Papelera.`, yaEstaba: true };
      return { payload: { documentoId: p.p.id }, resumen: `Mandar ${nombreDe(p.p)} a la Papelera (con lo que cuelga de él). Se puede restaurar.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const r = await papelera(str(payload, 'documentoId'));
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      return { ok: true, resumen: 'Listo: está en la Papelera. Se restaura con restaurar_documento_copywriter.', datos: { documentoId: str(payload, 'documentoId') } };
    },
  },

  restaurar_documento_copywriter: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (await cerrada(ctx)) return { error: CERRADA };
      const p = await paginaViva(str(input, 'documentoId'));
      if ('error' in p) return { error: p.error };
      if (!p.p.papelera) return { error: `${nombreDe(p.p)} no está en la Papelera.`, yaEstaba: true };
      return { payload: { documentoId: p.p.id }, resumen: `Sacar ${nombreDe(p.p)} de la Papelera.` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const r = await restaurar(str(payload, 'documentoId'));
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      return { ok: true, resumen: 'Listo: volvió a su lugar.', datos: { documentoId: str(payload, 'documentoId'), link: linkDoc(str(payload, 'documentoId')) } };
    },
  },
};
