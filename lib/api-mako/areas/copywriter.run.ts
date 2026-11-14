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
import { bloquesDelDoc, docDeEstructura, textoDeNodo, textoDelDoc } from '@/lib/copywriter/doc';
import { plantillaPorId, plantillasDe, plantillasVisibles } from '@/lib/copywriter/plantillas';
import { aplicarTodo, sanearOperaciones } from '@/lib/copywriter/operaciones';
import { editar as editarConIA } from '@/lib/copywriter/ia';
import { bloquesDeTexto, docDeTexto } from '@/lib/copywriter/texto';
import { escondida } from '@/lib/copywriter/arbol';
import { esTipoGuion, INFO_TIPO, SIN_TITULO, TIPOS_GUION, type PaginaCopy } from '@/lib/copywriter/tipos';
import { catalogosDelCopywriter } from '@/lib/copywriter/catalogos-server';
import { veCopywriterEnApi } from '@/lib/copywriter/puerta-api';
import { crearShare, getShare, listarInvitados, listarShares, revocarShare, RECURSO_GUION } from '@/lib/shares';
import { APP_BASE_URL } from '@/lib/app-url';
import { esFormatoCopy, esIdOutlierCopy, filtrarOutliersCopy, INFO_FORMATO, ROTULO_TEXTO } from '@/lib/copywriter/outliers';
import { leerOutliersCopy, outlierCopyPorId, replicarOutlier } from '@/lib/copywriter/outliers-servidor';

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
      if (!esTipoGuion(tipo)) return { error: `El tipo es uno de estos: ${TIPOS_GUION.join(', ')}.`, faltan: ['tipo'] };
      const plantillaId = str(input, 'plantillaId');
      if (plantillaId && !plantillaPorId(await catalogosDelCopywriter(), plantillaId)) return { error: `No hay ningún template «${plantillaId}» (listar_plantillas_copywriter).` };
      const estructuraId = str(input, 'estructuraId');
      if (estructuraId && !(await catalogosDelCopywriter()).estructuras.some((e) => e.id === estructuraId)) return { error: `No hay ninguna estructura «${estructuraId}» en la biblioteca (catalogo_estructuras_guion).` };
      const padreId = str(input, 'padreId');
      if (padreId) {
        const p = await paginaViva(padreId);
        if ('error' in p) return { error: p.error };
      }
      const texto = str(input, 'texto');
      return {
        payload: { titulo, tipo, estructuraId: estructuraId || null, plantillaId: plantillaId || null, texto, padreId: padreId || null },
        resumen: `Crear en el Copywriter ${INFO_TIPO[tipo].uno}: «${titulo}»${texto ? ` (${texto.split(/\s+/).length} palabras)` : plantillaId ? ' con las secciones de su template' : estructuraId ? ' con las secciones de su estructura' : ''}.`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const catalogos = await catalogosDelCopywriter();
      // Un template manda su tipo, su estructura y su ESQUELETO (si no viene texto ya escrito). ⚠️ Nunca su ejemplo
      // (`contenido`): es de un negocio ficticio, y un agente externo le dejaría a un cliente el anuncio de Cierre
      // Consultivo (docs/plantillas-reales/copywriter.md, trampa 4). El ejemplo sólo lo abre la galería.
      const pl = plantillaPorId(catalogos, str(payload, 'plantillaId'));
      const tipo = pl?.tipo ?? str(payload, 'tipo');
      if (!esTipoGuion(tipo)) return { ok: false, resumen: 'La acción quedó con un tipo inválido.' };
      const estructuraId = str(payload, 'estructuraId') || pl?.estructura || '';
      const e = estructuraId ? catalogos.estructuras.find((x) => x.id === estructuraId) : null;
      const texto = str(payload, 'texto');
      const r = await crear({
        tipo, titulo: str(payload, 'titulo'), padre: str(payload, 'padreId') || null,
        props: { estructura: e?.id ?? null, plantilla: pl?.id ?? null, ...(pl?.duracion ? { duracion: pl.duracion } : {}) },
        contenido: texto ? docDeTexto(texto) : pl ? pl.esqueleto() : e ? docDeEstructura(e.etiquetas) : undefined,
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

  // ── Compartir para editar (D9). Los links viven en `shares` (lib/shares.ts), en el workspace del pedido. ──
  enlaces_documento_copywriter: {
    leer: async (input, ctx) => {
      if (await cerrada(ctx)) return error(CERRADA);
      const p = await paginaViva(str(input, 'documentoId'));
      if ('error' in p) return error(p.error);
      let filas: Awaited<ReturnType<typeof listarShares>>;
      try { filas = await listarShares(ctx.ws, RECURSO_GUION, p.p.id); } catch (e) { return error(`No pude leer los links: ${e instanceof Error ? e.message : e}`); }
      const enlaces = await Promise.all(filas.map(async (s) => ({
        enlaceId: s.id,
        modo: s.modo === 'invitados' ? 'invitados' : 'abierto',
        creado: s.created_at,
        visitas: s.visitas ?? 0,
        ultimaVisita: s.ultima_visita ?? null,
        ...(s.revocado_at ? { revocado: s.revocado_at } : {}),
        ...(s.modo === 'invitados' ? { invitados: (await listarInvitados(s.id as number).catch(() => [])).filter((i) => !i.revocado_at).map((i) => i.email) } : {}),
      })));
      return json({ documento: nombreDe(p.p), enlaces, total: enlaces.length });
    },
  },

  compartir_documento_copywriter: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (await cerrada(ctx)) return { error: CERRADA };
      const p = await paginaViva(str(input, 'documentoId'));
      if ('error' in p) return { error: p.error };
      if (escondida(p.todas, p.p.id)) return { error: `${nombreDe(p.p)} está en la Papelera: un link a un documento borrado no abre.` };
      return { payload: { documentoId: p.p.id }, resumen: `Crear un link que deja EDITAR ${nombreDe(p.p)} sin cuenta, a cualquiera que lo tenga.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const id = str(payload, 'documentoId');
      const a = await abrir(id);
      if (!a.ok || a.pagina.papelera) return { ok: false, resumen: 'El documento ya no está (o está en la Papelera).' };
      const { id: enlaceId, token } = await crearShare({
        ws: ctx.ws, recurso: RECURSO_GUION, alcance: 'item', recursoId: id, modo: 'link', permiso: 'editar', etiqueta: a.pagina.titulo || SIN_TITULO,
      });
      const enlace = `${APP_BASE_URL}/compartido/${token}`;
      return { ok: true, resumen: `Listo: con este link se edita «${a.pagina.titulo}» sin cuenta: ${enlace}`, datos: { documentoId: id, enlaceId, enlace } };
    },
  },

  revocar_enlace_copywriter: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (await cerrada(ctx)) return { error: CERRADA };
      const enlaceId = typeof input.enlaceId === 'number' ? input.enlaceId : NaN;
      if (!Number.isInteger(enlaceId) || enlaceId <= 0) return { error: 'Falta enlaceId (de enlaces_documento_copywriter).', faltan: ['enlaceId'] };
      // Del workspace del pedido Y del Copywriter: con el id de un link de otro recurso no se revoca nada.
      const s = await getShare(ctx.ws, enlaceId);
      if (!s || s.recurso !== RECURSO_GUION) return { error: `No hay ningún link del Copywriter con id ${enlaceId} en este negocio.` };
      if (s.revocado_at) return { error: 'Ese link ya estaba revocado.', yaEstaba: true };
      return { payload: { enlaceId }, resumen: `Revocar el link ${enlaceId}: deja de abrir al instante, también para quien ya lo tiene.` };
    },
    ejecutar: async (payload, ctx): Promise<Ejecutado> => {
      const enlaceId = Number(payload.enlaceId);
      const s = await getShare(ctx.ws, enlaceId);
      if (!s || s.recurso !== RECURSO_GUION) return { ok: false, resumen: 'Ese link ya no está.' };
      await revocarShare(ctx.ws, enlaceId);
      return { ok: true, resumen: 'Listo: el link ya no abre.', datos: { enlaceId } };
    },
  },

  // ── «Copywriter = Notion» (29/10/2026, D12 y D13) ──────────────────────────────────────────────────────────────
  listar_plantillas_copywriter: {
    leer: async (_input, ctx) => {
      if (await cerrada(ctx)) return error(CERRADA);
      // Las de la galería, con su ejemplo como TEXTO (para ver la forma) y avisado: es de un negocio ficticio.
      const ps = plantillasVisibles(plantillasDe(await catalogosDelCopywriter()));
      return json({
        plantillas: ps.map((p) => ({
          plantillaId: p.id, nombre: p.nombre, grupo: p.grupo, tipo: p.tipo, cuando: p.descripcion, estructuraId: p.estructura,
          secciones: bloquesDelDoc(p.esqueleto()).filter((b) => b.tipo === 'seccion').map((b) => b.seccion),
          ...(p.ejemplo ? { ejemplo: { negocio: `${p.ejemplo.negocio} (ficticio)`, texto: textoDelDoc(p.contenido()).slice(0, 2_000) } } : {}),
        })),
        nota: 'plantillaId va en crear_documento_copywriter (con el tipo del template): la página nace con las secciones vacías. El ejemplo es de un negocio ficticio y solo muestra la forma: sus datos no se usan.',
      });
    },
  },

  editar_documento_copywriter: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (await cerrada(ctx)) return { error: CERRADA };
      const instruccion = str(input, 'instruccion');
      if (!instruccion) return { error: 'Falta qué escribir o cambiar.', faltan: ['instruccion'] };
      const id = str(input, 'documentoId');
      const r = await abrir(id);
      if (!r.ok) return { error: r.status === 404 ? `No hay ningún documento con id «${id}» en este negocio. Pide listar_documentos_copywriter.` : `No pude leerlo: ${r.error}`, ...(r.status === 404 ? {} : { falla: true }) };
      // La MISMA escritura que «Editar» en el chat de la página (lib/copywriter/ia.ts): las herramientas, ya validadas.
      const ia = await editarConIA({ instruccion, guion: { titulo: r.pagina.titulo, props: r.doc.props, contenido: r.doc.contenido } });
      if (!ia.ok) return { error: ia.error, ...(ia.status === 502 ? { falla: true } : {}) };
      const res = aplicarTodo(r.doc.contenido, ia.operaciones);
      const cambia = res.nuevos.length > 0 || res.titulo != null || Object.keys(res.props).length > 0 || JSON.stringify(res.doc) !== JSON.stringify(r.doc.contenido);
      if (!cambia) return { error: `MaKo no cambió nada: ${ia.respuesta}` };
      const nuevos = new Set(res.nuevos);
      const escrito = (res.doc.content ?? []).filter((b) => nuevos.has(b.attrs?.bid as string)).map(textoDeNodo).join('\n').trim();
      return {
        payload: { documentoId: id, operaciones: ia.operaciones },
        resumen: `MaKo en ${nombreDe(r.pagina)}: ${ia.respuesta.slice(0, 300)}${escrito ? `\n\n${escrito.slice(0, 1_200)}${escrito.length > 1_200 ? '…' : ''}` : ''}${ia.avisos.length ? `\n\n${ia.avisos.join(' ')}` : ''}`,
      };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const id = str(payload, 'documentoId');
      const catalogos = await catalogosDelCopywriter();
      const catalogo = { angulos: new Set(catalogos.angulos.map((a) => a.id)), estructuras: new Set(catalogos.estructuras.map((e) => e.id)) };
      // Sobre lo de AHORA, por id (AGENTS.md, «Un chat que edita lo abierto»): lo que se borró en el medio se descarta. Si
      // alguien guardó entre la lectura y la escritura, se vuelve a leer una vez.
      for (let i = 0; i < 2; i++) {
        const r = await abrir(id);
        if (!r.ok) return { ok: false, resumen: r.status === 404 ? 'El documento ya no existe.' : `No pude leerlo: ${r.error}` };
        const s = sanearOperaciones(payload.operaciones, r.doc.contenido, catalogo);
        const res = aplicarTodo(r.doc.contenido, s.ops);
        const props = Object.keys(res.props).length ? { ...r.doc.props, ...res.props } : undefined;
        const g = await guardar({ id, version: r.doc.version, contenido: res.doc, ...(props ? { props } : {}) });
        if (g.ok) {
          if (res.titulo) await renombrar(id, { titulo: res.titulo });
          const fuera = [...s.descartadas, ...res.descartadas];
          return {
            ok: true,
            resumen: `Listo: MaKo escribió en ${nombreDe(r.pagina)}${fuera.length ? ` (${fuera.length} cambio${fuera.length === 1 ? '' : 's'} no se aplicó: el documento cambió en el medio)` : ''}.`,
            datos: { documentoId: id, version: g.version, link: linkDoc(id) },
          };
        }
        if (g.status !== 409) return { ok: false, resumen: `No se pudo guardar: ${g.error}` };
      }
      return { ok: false, resumen: 'El documento cambió mientras lo escribía. Vuelve a intentar.' };
    },
  },

  // ── Los outliers de copy (D18): lo que Spy ya trajo, y una página que replica uno ──
  outliers_copywriter: {
    leer: async (input, ctx) => {
      if (await cerrada(ctx)) return error(CERRADA);
      const formato = esFormatoCopy(input.formato) ? input.formato : null;
      const limite = typeof input.limite === 'number' && input.limite >= 1 ? Math.min(50, Math.floor(input.limite)) : 12;
      const portada = await leerOutliersCopy();
      const vistos = filtrarOutliersCopy(portada.outliers, { formato, q: str(input, 'buscar'), tema: input.deTuTema === true }).slice(0, limite);
      return json({
        outliers: vistos.map((o) => ({
          outlierId: o.id, formato: o.formato, creador: o.creador.usuario ? `@${o.creador.usuario}` : o.creador.nombre, gancho: o.gancho,
          texto: o.texto, queTexto: ROTULO_TEXTO[o.deDonde], outlier: o.multiplo?.veces ?? null, diasAlAire: o.diasAlAire ?? null, link: o.url,
          tema: o.tema ?? null, idioma: o.idioma ?? null, deTuTema: o.deTuTema ?? null,
        })),
        total: vistos.length,
        temaDelNegocio: portada.tema?.negocio.nombre ?? null,
        ...(portada.caidas.length ? { noSePudoLeer: portada.caidas.map((c) => `${c.nombre}: ${c.motivo}`) } : {}),
      });
    },
  },

  replicar_outlier_copywriter: {
    preparar: async (input, ctx): Promise<Preparado> => {
      if (await cerrada(ctx)) return { error: CERRADA };
      const id = str(input, 'outlierId');
      if (!esIdOutlierCopy(id)) return { error: 'Falta el outlierId (de outliers_copywriter).', faltan: ['outlierId'] };
      const o = await outlierCopyPorId(id);
      if (!o) return { error: `No hay ningún outlier «${id}» para este negocio. Pide outliers_copywriter.` };
      const quien = o.creador.usuario ? `@${o.creador.usuario}` : o.creador.nombre;
      return { payload: { outlierId: id }, resumen: `Crear una página para replicar ${INFO_FORMATO[o.formato].label.toLowerCase()} de ${quien} («${o.gancho.slice(0, 80)}»).` };
    },
    ejecutar: async (payload): Promise<Ejecutado> => {
      const r = await replicarOutlier(str(payload, 'outlierId'));
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      return { ok: true, resumen: `Listo: ${nombreDe(r.pagina)}. Al abrirla, MaKo transcribe el original si es un video, pregunta para qué oferta y la escribe.`, datos: { documentoId: r.pagina.id, link: linkDoc(r.pagina.id) } };
    },
  },
};
