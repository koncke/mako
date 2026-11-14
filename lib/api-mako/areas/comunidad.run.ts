// =============================================================================
// api-mako / comunidad — los cuerpos de las operaciones (ver comunidad.def.ts)
// =============================================================================
// Llaman a lib/comunidad-*, nunca a las server actions de la pantalla: una server action lee la
// sesión de la cookie, y por la API no hay cookie. Cada función de lib/ recibe un `Actor` y vuelve a
// preguntar su regla (`puedeFijar`, `puedeConfigurar`, `puedeEditar`…); lo que se arma acá es el actor.
//
// DOS ACTORES, y la diferencia es lo que más importa de este archivo:
//   · el LECTOR (`lector`): equipo, con la clave neutral `CLAVE_API` (comunidad.helpers.ts). Lee, modera
//     y configura; no figura en ningún lado, no suma «en línea» ni puntos, y la base rebotaría cualquier
//     fila que lo nombrara como autor (CHECK `^(u|l):N` de la 0217).
//   · el FIRMADO (`firmado`): una persona del equipo con su `u:N`. Lo que se PUBLICA (post, comentario,
//     like, voto, seguir, la campana y el perfil propios) sale con su nombre o no sale. Quién es lo dice
//     `personaDe` (la bandeja de MaKo, o el creador del token cuando el registro lo pase en el Ctx), y
//     `firmaDelEquipo` decide si esa cuenta firma en ESTE negocio.
//
// ⚠️ LA PERTENENCIA AL NEGOCIO: un producto por `productoDelWorkspace`, un post por `productoDelPost`, un
//    comentario por `productoDelComentario`, una clase por `claseDeId` (inquilino del contexto), un evento
//    por `eventoParaEditar` (con el producto del actor). Todas leen con el workspace a mano: las tablas de
//    la 0217 no están en TENANT_TABLES.
// ⚠️ NINGUNA CONSULTA A `comunidad_posts` ACÁ: tests/curso-comentarios-clase.test.ts barre lib/ y exige
//    que cada lector decida qué hace con los hilos de las clases. Contar los fijados va por `feedComunidad`.
// ⚠️ LOS PATCH MEZCLAN: las funciones de lib/ revalidan el objeto ENTERO. En una acción de PANTALLA la
//    mezcla va en preparar() (que vuelve a correr al confirmar, con la base de ese momento); en una de CHAT
//    el payload lleva sólo lo pedido y la mezcla se repite en ejecutar(): una pendiente vive dos horas y
//    escribir la foto de cuando se propuso pisaría lo que alguien cambió en el medio.
// =============================================================================

import 'server-only';
import type { Ctx, Ejecutado, Preparado, Runners } from '../tipos';
import type { CategoriaVista } from '@/lib/comunidad-tipos';
import { productosDeLaEntrega } from '@/app/customer-success/entrega';
import { TAB_COMUNIDAD, pasosDeLosDatos, lineaOnboarding } from '@/app/customer-success/comunidad/onboarding-comunidad';
import { buscarUsuarioPorEmail } from '@/lib/usuarios';
import {
  productoDelWorkspace, leerAjustes, categoriasDeLaComunidad, productoDelPost, productoDelComentario, postDe, tarjetas,
  inicioComunidad, aboutComunidad, feedComunidad, detallePost, buscarEnComunidad, publicarPost, editarPost, borrarPost,
  fijarPost, seguirPost, votar, cambiarLike, comentar, editarComentario, borrarComentario, hiloDeClase, comentarEnClase,
  guardarCategoria, borrarCategoria, ordenarCategorias, guardarNombresNivel, guardarAbout, guardarAjustesComunidad,
  rankingComunidad, miembrosComunidad, miembrosDeLaComunidad, perfilDe, guardarPerfil, infoDeMiembros, leadDe,
  hechosDeLaComunidad, candadoDeComunidad, type Actor, type FilaPost,
} from '@/lib/comunidad-datos';
import { cerrarComentarios, sacarAlumno, admitirAlumno, sacadosDeLaComunidad } from '@/lib/comunidad-moderacion';
import { calendarioComunidad, opcionesDeEvento, guardarEvento, borrarEvento, icsComunidad, eventoParaEditar } from '@/lib/comunidad-calendario';
import { campanaComunidad, marcarLeidas } from '@/lib/comunidad-campana';
import {
  validarPost, validarComentario, validarCategoria, sanearAbout, sanearPerfil, sanearTexto, encuestaGuardada,
  mencionesGuardadas, hayLugarParaFijar, claveDeLead, leerClave, extracto, MAX_FIJADOS, MIN_BUSQUEDA,
  type CategoriaRegla,
} from '@/lib/comunidad-reglas';
import { NIVEL_MAX, nombreDeNivel } from '@/lib/comunidad-niveles';
import { sanearEvento, esZonaValida, textoRecurrencia, leerFecha, rangoDeCalendario } from '@/lib/comunidad-eventos';
import { getEstadoTab, tabOnboardingDef } from '@/lib/tab-onboarding-state';
import { claseDeId } from '@/lib/curso-datos';
import { estilosLeidos } from '@/lib/curso-estilo-datos';
import { comentariosDeClase } from '@/lib/curso-estilo';
import { modulosDelCurso } from '@/lib/curso-modulos-datos';
import { DURACION_DEFAULT_API } from './comunidad.def';
import {
  CLAVE_API, VACIAR, personaDe, firmaDelEquipo, nombreDeQuien, textoMezclado, ordenPedido, nombresDeNivel,
  eventoMezclado, perfilMezclado, msDeFecha, postPublico, detallePublico, comentarioPublico, comentarioEn,
  type UsuarioFirma, type EventoBase,
} from './comunidad.helpers';

type In = Record<string, unknown>;
type Firma = { clave: string; nombre: string };

const J = (o: unknown): string => JSON.stringify(o);
const fallo = (error: string) => ({ content: J({ ok: false, error }), isError: true });
const msg = (e: unknown) => (e instanceof Error && e.message ? e.message : String(e));
const num = (input: In, k: string): number | null => {
  const n = Number(input[k]);
  return input[k] != null && Number.isInteger(n) && n > 0 ? n : null;
};
const str = (input: In, k: string): string | undefined => (typeof input[k] === 'string' ? (input[k] as string) : undefined);
const corto = (t: string) => extracto(t, 120);

/** preparar() no lanza: «no pude leer» se dice como lo que es. */
const revisando = (fn: (input: In, ctx: Ctx) => Promise<Preparado>) =>
  async (input: In, ctx: Ctx): Promise<Preparado> => {
    try { return await fn(input, ctx); } catch (e) { return { error: `No pude revisar la comunidad (${msg(e)}). Reintenta en un momento.`, falla: true }; }
  };

/** ejecutar() no lanza (tipos.ts): si algo falla, ok:false con el motivo. */
const sinLanzar = (que: string, fn: (payload: In, ctx: Ctx) => Promise<Ejecutado>) =>
  async (payload: In, ctx: Ctx): Promise<Ejecutado> => {
    try { return await fn(payload, ctx); } catch (e) {
      console.error(`[api-mako comunidad] ${que}:`, msg(e));
      return { ok: false, resumen: `No se pudo ${que} (${msg(e)}).` };
    }
  };

// ── Los dos actores ───────────────────────────────────────────────────────────────

/** El actor NEUTRAL del equipo (ver la cabecera). `nombre` es lo que queda escrito como «quién» en lo que no se firma. */
const lector = (ctx: Ctx, productoId: number, nombre = 'API de MaKo'): Actor =>
  ({ ws: ctx.ws, productoId, clave: CLAVE_API, leadId: null, nombre, equipo: true, adminWs: ctx.rol === 'admin' });

/** El actor de una persona del equipo que FIRMA. */
const firmado = (ctx: Ctx, productoId: number, f: Firma): Actor =>
  ({ ws: ctx.ws, productoId, clave: f.clave, leadId: null, nombre: f.nombre, equipo: true, adminWs: ctx.rol === 'admin' });

const SIN_PERSONA = 'Esto sale con el nombre de una persona del equipo y este pedido no trae a ninguna. Confírmalo en MaKo (la bandeja de pendientes o el link de revisión), o usa un token creado por una persona del equipo.';
const NO_FIRMA = 'La cuenta que confirma no firma en la comunidad de este negocio: no es del equipo o está suspendida.';

/** Quién firma: la persona, `null` si el pedido no trae ninguna, o el porqué de que esa cuenta no firme. */
async function quienFirma(ctx: Ctx): Promise<{ firma: Firma | null } | { error: string }> {
  const email = personaDe(ctx);
  if (!email) return { firma: null };
  const u = await buscarUsuarioPorEmail(email);
  const firma = firmaDelEquipo(u as UsuarioFirma | null, ctx.ws);
  return firma ? { firma } : { error: NO_FIRMA };
}

/**
 * Al PROPONER: la firma si ya se sabe. Un token detallado escribe en el acto (lib/api-mako/rutas-http.ts):
 * sin persona va a fallar al escribir, así que falla acá. Un token clásico propone y la persona que
 * confirma en la bandeja es la que firma.
 */
async function firmaAlProponer(ctx: Ctx): Promise<{ firma: Firma | null } | { error: string }> {
  const q = await quienFirma(ctx);
  if ('error' in q) return q;
  if (!q.firma && ctx.token) return { error: SIN_PERSONA };
  return q;
}

/** Al ESCRIBIR: la firma de quien confirma, o el porqué. */
async function firmaAlEscribir(ctx: Ctx): Promise<Firma | { error: string }> {
  const q = await quienFirma(ctx);
  if ('error' in q) return q;
  return q.firma ?? { error: SIN_PERSONA };
}

/**
 * `faltaParaConfirmar` de las que firman: quien confirma tiene que poder FIRMAR. Se mira ANTES de reclamar la pendiente
 * (acciones.ts): fallar recién en `ejecutar` la dejaba quemada (`error`) para el admin que sí la podía confirmar en la
 * bandeja, por ejemplo cuando un «sí» llegaba por un token clásico o por WhatsApp.
 */
async function faltaFirma(_payload: In, ctx: Ctx): Promise<string | null> {
  const q = await quienFirma(ctx);
  if ('error' in q) return q.error;
  return q.firma ? null : SIN_PERSONA;
}

/** El nombre que queda escrito en lo que no se firma (un baneo, un evento, los ajustes). Nunca tira. */
async function nombreRegistro(ctx: Ctx): Promise<string> {
  try {
    const q = await quienFirma(ctx);
    return nombreDeQuien('firma' in q ? q.firma : null, ctx);
  } catch {
    return nombreDeQuien(null, ctx);
  }
}

const comoFirma = (f: Firma | null) => (f ? `firmado por ${f.nombre}` : 'firmado por la persona que lo confirme');

// ── La pertenencia ────────────────────────────────────────────────────────────────

/** El producto, si es de este negocio. */
async function productoDe(ctx: Ctx, input: In): Promise<{ id: number; nombre: string } | { error: string }> {
  const id = num(input, 'productoId');
  if (id == null) return { error: 'Falta el productoId.' };
  const p = await productoDelWorkspace(ctx.ws, id);
  return p ?? { error: `El producto #${id} no es de este negocio. Pide la lista con listar_comunidades.` };
}

/** Un post de este negocio: su producto y su fila (con `clase_id`: el hilo de una clase). */
async function postDeId(ctx: Ctx, postId: number | null): Promise<{ productoId: number; fila: FilaPost } | { error: string }> {
  if (postId == null) return { error: 'Falta el postId.' };
  const productoId = await productoDelPost(ctx.ws, postId);
  const fila = productoId ? await postDe(lector(ctx, productoId), postId) : null;
  if (!productoId || !fila) return { error: `El post #${postId} no existe en este negocio.` };
  return { productoId, fila };
}

/** Un comentario de este negocio. */
type ComentarioDeAca = NonNullable<Awaited<ReturnType<typeof productoDelComentario>>> & { id: number };
async function comentarioDeId(ctx: Ctx, id: number | null): Promise<ComentarioDeAca | { error: string }> {
  if (id == null) return { error: 'Falta el comentarioId.' };
  const c = await productoDelComentario(ctx.ws, id);
  return c ? { id, ...c } : { error: `El comentario #${id} no existe en este negocio.` };
}

const aRegla = (c: CategoriaVista): CategoriaRegla => ({ id: c.id, nombre: c.nombre, permiso: c.permiso });
const categoriasDisponibles = (cs: readonly CategoriaVista[]) => cs.map((c) => ({ categoriaId: c.id, nombre: c.nombre, permiso: c.permiso }));
const queEs = (f: FilaPost) => (f.clase_id != null ? `el hilo de la clase «${f.titulo}»` : `el post «${f.titulo}»`);

// ── Posts ─────────────────────────────────────────────────────────────────────────

/** Lo que `publicarPost` / `editarPost` leen de un pedido (sólo lo declarado). */
const postCrudo = (x: In): In => {
  const out: In = {};
  for (const k of ['titulo', 'cuerpo', 'categoriaId', 'videoUrl', 'menciones', 'encuesta']) if (x[k] !== undefined && x[k] !== null) out[k] = x[k];
  return out;
};

/** La misma lista de menciones, sin importar el orden (para «ya está así»). */
const mismasMenciones = (a: unknown, b: readonly string[]) => {
  const x = (Array.isArray(a) ? a : []).map((k) => leerClave(k)?.clave).filter(Boolean).sort();
  return J(x) === J([...b].sort());
};

// ── Eventos ───────────────────────────────────────────────────────────────────────

/** Valida un evento crudo como lo va a validar `guardarEvento`, más lo que ahí recién se sabe al escribir. */
async function eventoValido(productoId: number, crudo: In): Promise<{ v: ReturnType<typeof sanearEvento> & { ok: true } } | { error: string; disponibles?: unknown }> {
  const v = sanearEvento(crudo);
  if (!v.ok) return { error: v.error };
  // `saneaPortada` (lib/portadas.ts) deja SIN portada lo que no va, sin decirlo: por la API se rechaza.
  if (typeof crudo.portada === 'string' && crudo.portada.trim() && v.evento.portada == null) {
    return { error: 'La portada no va: usa un degradado del catálogo (grad:<id>) o el link https de una imagen de un origen permitido.' };
  }
  if (v.evento.acceso.tipo === 'modulo') {
    // La lectura ESTRICTA: con la base caída no se decide con las etapas de fábrica.
    const cur = await modulosDelCurso(productoId, { estricta: true });
    if (!cur) return { error: 'No pude leer los módulos del curso. Reintenta en un momento.' };
    const clave = v.evento.acceso.clave;
    if (!cur.modulos.some((m) => m.clave === clave)) {
      return { error: `El módulo «${clave}» no es de este curso.`, disponibles: cur.modulos.map((m) => ({ clave: m.clave, nombre: m.nombre })) };
    }
  }
  return { v };
}

const cuandoEs = (e: { fecha: string; hora: string; zona: string; duracionMin: number; recurrencia: Parameters<typeof textoRecurrencia>[0] }) => {
  const rep = textoRecurrencia(e.recurrencia, leerFecha(e.fecha));
  return `${e.fecha} a las ${e.hora} (${e.zona}), ${e.duracionMin} min${rep ? `, ${rep}` : ''}`;
};

const CAMPOS_EVENTO = ['titulo', 'descripcion', 'fecha', 'hora', 'zona', 'duracionMin', 'lugarTipo', 'lugar', 'portada', 'acceso', 'recurrencia'] as const;

/** El alcance y la ocurrencia de una edición o un borrado, validados contra la serie. */
function alcanceDe(input: In, e: { serie: boolean; esOcurrencia: (f: string) => boolean }): { alcance: string; ocurrencia: string | null } | { error: string } {
  const alcance = str(input, 'alcance') ?? 'todos';
  const ocurrencia = str(input, 'ocurrencia')?.trim() || null;
  if (!e.serie) return { alcance: 'todos', ocurrencia: null };
  if (alcance !== 'todos' && !ocurrencia) return { error: `Con alcance «${alcance}» hace falta la ocurrencia (YYYY-MM-DD, de ver_calendario_comunidad).` };
  if (ocurrencia && !e.esOcurrencia(ocurrencia)) return { error: `El ${ocurrencia} no es una ocurrencia de esta serie.` };
  return { alcance, ocurrencia };
}

export const RUNNERS: Runners = {
  // ── La comunidad ────────────────────────────────────────────────────────────────
  listar_comunidades: {
    leer: async (_input, ctx) => {
      const productos = await productosDeLaEntrega();
      const comunidades = await Promise.all(productos.map(async (p) => {
        try {
          const a = await leerAjustes(ctx.ws, p.id);
          return { productoId: p.id, nombre: a.nombre ?? p.nombre, producto: p.nombre };
        } catch (e) {
          return { productoId: p.id, producto: p.nombre, error: `No pude leer su comunidad (${msg(e)}).` };
        }
      }));
      return J({ comunidades, nota: 'Una comunidad con error NO está vacía: no se pudo leer. Para su contenido, ver_comunidad y listar_posts_comunidad.' });
    },
  },

  ver_comunidad: {
    leer: async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return fallo(p.error);
      const a = lector(ctx, p.id);
      const [inicio, about] = await Promise.all([inicioComunidad(a), aboutComunidad(a)]);
      return J({
        productoId: p.id, producto: p.nombre, nombre: about.nombre, nombrePropio: about.nombrePropio,
        descripcion: about.descripcion, texto: about.texto, reglas: about.reglas,
        categorias: inicio.categorias.map((c) => ({ id: c.id, nombre: c.nombre, permiso: c.permiso, ordenDefault: c.ordenDefault })),
        nivelParaPostear: about.nivelParaPostear, zona: about.zona,
        niveles: Array.from({ length: NIVEL_MAX }, (_, i) => ({ nivel: i + 1, nombre: nombreDeNivel(inicio.nombresNivel, i + 1), propio: !!inicio.nombresNivel[i] })),
        conteos: inicio.conteos, top30: inicio.top30,
        notas: [
          'conteos y top30 en null = no se pudieron leer (no es cero).',
          'zona null = el calendario usa la zona del negocio.',
          'Con categorías, publicar exige elegir una (categoriaId).',
        ],
      });
    },
  },

  estado_onboarding_comunidad: {
    leer: async (_input, ctx) => {
      const def = tabOnboardingDef(TAB_COMUNIDAD);
      if (!def) return fallo('La Comunidad no tiene onboarding declarado.');
      const [estado, hechos] = await Promise.all([getEstadoTab(TAB_COMUNIDAD), hechosDeLaComunidad(ctx.ws)]);
      const datos = pasosDeLosDatos(hechos) as Record<string, boolean | null>;
      const pasos = def.pasos.map((p) => ({
        key: p.key, paso: p.label, opcional: !!p.opcional,
        hecho: !!estado.steps[p.key]?.done, hecho_el: estado.steps[p.key]?.at ?? null,
        segun_los_datos: datos[p.key] ?? null,
      }));
      return J({
        lista: estado.status === 'done',
        pasos,
        faltan: pasos.filter((p) => !p.hecho && !p.opcional).map((p) => p.paso),
        linea_a_la_vista: lineaOnboarding(estado.steps) != null,
        hechos,
        notas: [
          'hecho = lo anotado; lo anota la tab Comunidad cuando la abre un admin. segun_los_datos es lo que dicen las tablas hoy (null = no se pudo leer).',
          'Es del negocio entero: cuenta las categorías, los posts y la participación de todas sus comunidades.',
        ],
      });
    },
  },

  // ── Posts: leer ─────────────────────────────────────────────────────────────────
  listar_posts_comunidad: {
    leer: async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return fallo(p.error);
      const categoriaId = num(input, 'categoriaId');
      if (categoriaId != null) {
        const cats = await categoriasDeLaComunidad(ctx.ws, p.id);
        if (!cats.some((c) => c.id === categoriaId)) {
          return fallo(`La categoría #${categoriaId} no es de esta comunidad. Las que hay: ${cats.map((c) => `#${c.id} «${c.nombre}»`).join(', ') || 'ninguna'}.`);
        }
      }
      const pagina = Number.isInteger(input.pagina) ? (input.pagina as number) : 0;
      const feed = await feedComunidad(lector(ctx, p.id), { categoriaId, orden: str(input, 'orden'), pagina });
      return J({
        productoId: p.id, pagina: feed.pagina, hayMas: feed.hayMas,
        fijados: feed.fijados.map(postPublico), posts: feed.posts.map(postPublico),
        nota: 'Los fijados van sólo en la página 0. El adjunto viaja sin link; el post completo, con ver_post_comunidad.',
      });
    },
  },

  ver_post_comunidad: {
    leer: async (input, ctx) => {
      const r = await postDeId(ctx, num(input, 'postId'));
      if ('error' in r) return fallo(r.error);
      const d = await detallePost(lector(ctx, r.productoId), r.fila.id);
      if (!d) return fallo(`El post #${r.fila.id} ya no está.`);
      return J({ productoId: r.productoId, claseId: r.fila.clase_id ?? null, ...detallePublico(d) });
    },
  },

  buscar_en_comunidad: {
    leer: async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return fallo(p.error);
      const q = str(input, 'q') ?? '';
      const b = await buscarEnComunidad(lector(ctx, p.id), q);
      return J({
        productoId: p.id, q, posts: b.posts.map(postPublico), miembros: b.miembros,
        ...(sanearTexto(q, { unaLinea: true }).length < MIN_BUSQUEDA ? { nota: `Con menos de ${MIN_BUSQUEDA} letras no se busca.` } : {}),
      });
    },
  },

  // ── Posts: escribir ─────────────────────────────────────────────────────────────
  publicar_post_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      // La comunidad es SÓLO de MaKo Pro (14/11/2026): se dice antes de proponer; `publicarPost` lo vuelve a preguntar.
      const candado = await candadoDeComunidad({ ws: ctx.ws, equipo: true });
      if (candado) return { error: candado };
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      const cats = await categoriasDeLaComunidad(ctx.ws, p.id);
      const crudo = postCrudo(input);
      // Las menciones no se validan acá (piden leer la comunidad entera): las filtra `publicarPost`.
      const v = validarPost(crudo, {
        actor: { clave: f.firma?.clave ?? CLAVE_API, equipo: true, adminWs: ctx.rol === 'admin' },
        categorias: cats.map(aRegla), ws: ctx.ws, productoId: p.id, nombreDe: () => undefined,
      });
      if (!v.ok) return { error: v.error, ...(cats.length ? { disponibles: categoriasDisponibles(cats) } : {}) };
      const cat = cats.find((c) => c.id === v.post.categoriaId);
      const menc = Array.isArray(crudo.menciones) ? crudo.menciones.length : 0;
      return {
        payload: { productoId: p.id, ...crudo },
        resumen: `Publicar en la comunidad de «${p.nombre}» el post «${v.post.titulo}»${cat ? ` en «${cat.nombre}»` : ''}, ${comoFirma(f.firma)}`
          + `${v.post.videoUrl ? ', con video' : ''}${v.post.encuesta ? `, con una encuesta de ${v.post.encuesta.opciones.length} opciones` : ''}`
          + `${menc ? `, mencionando a ${menc}` : ''}.${v.post.cuerpo ? ` Texto: «${corto(v.post.cuerpo)}»` : ''}`,
      };
    }),
    ejecutar: sinLanzar('publicar el post', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const r = await publicarPost(firmado(ctx, Number(pl.productoId), f), postCrudo(pl));
      if (!r.ok) return { ok: false, resumen: `No se pudo publicar: ${r.error}` };
      return { ok: true, resumen: `Listo: post «${r.post.titulo}» publicado, firmado por ${f.nombre} (#${r.post.id}).`, datos: { postId: r.post.id } };
    }),
  },

  editar_post_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const r = await postDeId(ctx, num(input, 'postId'));
      if ('error' in r) return r;
      const { fila, productoId } = r;
      if (fila.clase_id != null) return { error: 'Es el hilo de una clase: no tiene texto propio. Se editan sus comentarios (editar_comentario_comunidad).' };
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      if (f.firma && f.firma.clave !== fila.miembro) {
        return { error: 'Sólo quien lo escribió edita un post, y la persona que firma no es la autora. Para moderarlo está borrar_post_comunidad.' };
      }
      const pedidos = ['titulo', 'cuerpo', 'categoriaId', 'videoUrl', 'menciones'].filter((k) => input[k] !== undefined);
      if (!pedidos.length) return { error: 'No pasaste nada para cambiar: titulo, cuerpo, categoriaId, videoUrl o menciones.', faltan: ['titulo'] };
      const guardadas = mencionesGuardadas(fila.menciones);
      const crudo: In = {
        titulo: str(input, 'titulo') ?? fila.titulo,
        cuerpo: textoMezclado(input.cuerpo, fila.cuerpo),
        categoriaId: num(input, 'categoriaId') ?? fila.categoria_id,
        videoUrl: textoMezclado(input.videoUrl, fila.video_url ?? ''),
        menciones: Array.isArray(input.menciones) ? input.menciones : guardadas,
      };
      const cats = await categoriasDeLaComunidad(ctx.ws, productoId);
      const v = validarPost(crudo, {
        actor: { clave: f.firma?.clave ?? CLAVE_API, equipo: true, adminWs: ctx.rol === 'admin' },
        categorias: cats.map(aRegla), ws: ctx.ws, productoId, nombreDe: () => undefined, soloTexto: true,
      });
      if (!v.ok) return { error: v.error, ...(cats.length ? { disponibles: categoriasDisponibles(cats) } : {}) };
      const igual = v.post.titulo === fila.titulo && v.post.cuerpo === sanearTexto(fila.cuerpo)
        && v.post.categoriaId === (fila.categoria_id == null ? null : Number(fila.categoria_id))
        && v.post.videoUrl === (fila.video_url ?? null) && mismasMenciones(crudo.menciones, guardadas);
      if (igual) return { error: 'El post ya está así.', yaEstaba: true };
      return {
        payload: { postId: fila.id, productoId, ...crudo },
        resumen: `Editar el post «${fila.titulo}» (${pedidos.join(', ')}), ${comoFirma(f.firma)}.${v.post.titulo !== fila.titulo ? ` Título nuevo: «${v.post.titulo}».` : ''}`,
      };
    }),
    ejecutar: sinLanzar('editar el post', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const r = await editarPost(firmado(ctx, Number(pl.productoId), f), Number(pl.postId), postCrudo(pl));
      if (!r.ok) return { ok: false, resumen: `No se pudo editar: ${r.error}` };
      return { ok: true, resumen: `Listo: post «${r.post.titulo}» editado.`, datos: { postId: r.post.id } };
    }),
  },

  borrar_post_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const r = await postDeId(ctx, num(input, 'postId'));
      if ('error' in r) return r;
      if (r.fila.clase_id != null) {
        return { error: `El post #${r.fila.id} es el hilo de una clase: no se borra entero (se llevaría los comentarios de todos). Borra sus comentarios con borrar_comentario_comunidad o ciérralo con cerrar_comentarios_post_comunidad.` };
      }
      const [t] = await tarjetas(lector(ctx, r.productoId), [r.fila]);
      return {
        payload: { postId: r.fila.id, productoId: r.productoId },
        resumen: `Borrar el post «${r.fila.titulo}» de ${t?.autor.nombre ?? r.fila.autor_nombre}, con sus ${t?.comentarios ?? 0} comentarios y ${t?.likes ?? 0} likes. No se puede deshacer.`,
      };
    }),
    ejecutar: sinLanzar('borrar el post', async (pl, ctx) => {
      const id = Number(pl.postId);
      const r = await borrarPost(lector(ctx, Number(pl.productoId)), id);
      if (!r.ok) return { ok: false, resumen: `No se pudo borrar: ${r.error}` };
      return { ok: true, resumen: `Listo: post #${id} borrado.`, datos: { postId: id } };
    }),
  },

  fijar_post_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const r = await postDeId(ctx, num(input, 'postId'));
      if ('error' in r) return r;
      const { fila, productoId } = r;
      if (fila.clase_id != null) return { error: 'Es el hilo de una clase: no sale en el feed, y no se fija.' };
      const fijar = input.fijado === true;
      if ((fila.fijado_at != null) === fijar) return { error: fijar ? 'El post ya está fijado.' : 'El post no está fijado.', yaEstaba: true };
      if (fijar) {
        // Los fijados, por la misma lectura que el feed (que ya saca los hilos de las clases).
        const feed = await feedComunidad(lector(ctx, productoId), {});
        if (!hayLugarParaFijar(feed.fijados.length, false)) {
          return {
            error: `Ya hay ${MAX_FIJADOS} posts fijados: suelta uno antes (fijar_post_comunidad con fijado false).`,
            disponibles: feed.fijados.map((x) => ({ postId: x.id, titulo: x.titulo })),
          };
        }
      }
      return { payload: { postId: fila.id, productoId, fijado: fijar }, resumen: `${fijar ? 'Fijar arriba del feed' : 'Soltar'} el post «${fila.titulo}».` };
    }),
    ejecutar: sinLanzar('fijar el post', async (pl, ctx) => {
      const fijar = pl.fijado === true;
      const r = await fijarPost(lector(ctx, Number(pl.productoId)), Number(pl.postId), fijar);
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      return { ok: true, resumen: fijar ? 'Listo: post fijado.' : 'Listo: post soltado.', datos: { postId: Number(pl.postId), fijado: r.fijado } };
    }),
  },

  cerrar_comentarios_post_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const r = await postDeId(ctx, num(input, 'postId'));
      if ('error' in r) return r;
      const cerrar = input.cerrados === true;
      if ((r.fila.comentarios_cerrados_at != null) === cerrar) {
        return { error: cerrar ? 'Los comentarios ya están cerrados.' : 'Los comentarios ya están abiertos.', yaEstaba: true };
      }
      return {
        payload: { postId: r.fila.id, productoId: r.productoId, cerrados: cerrar },
        resumen: `${cerrar ? 'Cerrar' : 'Abrir'} los comentarios de ${queEs(r.fila)}.`,
      };
    }),
    ejecutar: sinLanzar('cambiar los comentarios', async (pl, ctx) => {
      const r = await cerrarComentarios(lector(ctx, Number(pl.productoId)), Number(pl.postId), pl.cerrados === true);
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      return { ok: true, resumen: r.cerrado ? 'Listo: comentarios cerrados.' : 'Listo: comentarios abiertos.', datos: { postId: Number(pl.postId), cerrado: r.cerrado } };
    }),
  },

  seguir_post_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const r = await postDeId(ctx, num(input, 'postId'));
      if ('error' in r) return r;
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      const seguir = input.seguir === true;
      if (f.firma) {
        const d = await detallePost(firmado(ctx, r.productoId, f.firma), r.fila.id);
        if (d && d.sigo === seguir) return { error: seguir ? 'Ya sigue ese post.' : 'No sigue ese post.', yaEstaba: true };
      }
      return {
        payload: { postId: r.fila.id, productoId: r.productoId, seguir },
        resumen: `${f.firma ? f.firma.nombre : 'Quien lo confirme'} ${seguir ? 'empieza a seguir' : 'deja de seguir'} ${queEs(r.fila)}.`,
      };
    }),
    ejecutar: sinLanzar('seguir el post', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const r = await seguirPost(firmado(ctx, Number(pl.productoId), f), Number(pl.postId), pl.seguir === true);
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      return { ok: true, resumen: r.sigo ? `Listo: ${f.nombre} sigue el post.` : `Listo: ${f.nombre} dejó de seguir el post.`, datos: { postId: Number(pl.postId), sigo: r.sigo } };
    }),
  },

  votar_encuesta_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const r = await postDeId(ctx, num(input, 'postId'));
      if ('error' in r) return r;
      const enc = encuestaGuardada(r.fila.encuesta);
      if (!enc) return { error: `El post «${r.fila.titulo}» no tiene encuesta.` };
      const opcion = (str(input, 'opcion') ?? '').trim();
      const o = enc.opciones.find((x) => x.id === opcion);
      if (!o) return { error: `La opción «${opcion}» no existe en esa encuesta.`, disponibles: enc.opciones };
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      if (f.firma) {
        const [t] = await tarjetas(firmado(ctx, r.productoId, f.firma), [r.fila]);
        if (t?.encuesta?.miVoto === opcion) return { error: `Ya votó «${o.texto}».`, yaEstaba: true };
      }
      return {
        payload: { postId: r.fila.id, productoId: r.productoId, opcion },
        resumen: `Votar «${o.texto}» en la encuesta del post «${r.fila.titulo}», como ${f.firma ? f.firma.nombre : 'la persona que lo confirme'}.`,
      };
    }),
    ejecutar: sinLanzar('votar', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const r = await votar(firmado(ctx, Number(pl.productoId), f), Number(pl.postId), String(pl.opcion));
      if (!r.ok) return { ok: false, resumen: `No se pudo votar: ${r.error}` };
      return { ok: true, resumen: `Listo: voto de ${f.nombre} guardado (${r.encuesta.total} votos en total).`, datos: { postId: Number(pl.postId), opciones: r.encuesta.opciones, total: r.encuesta.total } };
    }),
  },

  cambiar_like_post_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const r = await postDeId(ctx, num(input, 'postId'));
      if ('error' in r) return r;
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      const meGusta = input.meGusta === true;
      if (f.firma) {
        if (f.firma.clave === r.fila.miembro) return { error: 'Es un post de la persona que firma: nadie se da like a sí mismo.' };
        const [t] = await tarjetas(firmado(ctx, r.productoId, f.firma), [r.fila]);
        if (t && t.meGusta === meGusta) return { error: meGusta ? 'Ya le había dado like.' : 'No le había dado like.', yaEstaba: true };
      }
      return {
        payload: { postId: r.fila.id, productoId: r.productoId, meGusta },
        resumen: `${meGusta ? 'Darle like' : 'Sacarle el like'} a ${queEs(r.fila)}, como ${f.firma ? f.firma.nombre : 'la persona que lo confirme'}.`,
      };
    }),
    ejecutar: sinLanzar('cambiar el like', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const r = await cambiarLike(firmado(ctx, Number(pl.productoId), f), `p:${Number(pl.postId)}`, pl.meGusta === true);
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      return { ok: true, resumen: `Listo: el post tiene ${r.likes} likes.`, datos: { postId: Number(pl.postId), likes: r.likes, meGusta: r.meGusta } };
    }),
  },

  // ── Comentarios ─────────────────────────────────────────────────────────────────
  comentar_post_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const r = await postDeId(ctx, num(input, 'postId'));
      if ('error' in r) return r;
      if (r.fila.comentarios_cerrados_at != null) {
        return { error: 'Los comentarios están cerrados: nadie comenta, tampoco el equipo. Para abrirlos, cerrar_comentarios_post_comunidad con cerrados false.' };
      }
      const v = validarComentario({ cuerpo: input.cuerpo }, () => undefined);
      if (!v.ok) return { error: v.error };
      const responderA = num(input, 'responderA');
      if (responderA != null) {
        const c = await productoDelComentario(ctx.ws, responderA);
        if (!c || c.postId !== Number(r.fila.id)) return { error: `El comentario #${responderA} no es de este post (ver_post_comunidad da los de su hilo).` };
      }
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      return {
        payload: { postId: r.fila.id, productoId: r.productoId, cuerpo: input.cuerpo, responderA, ...(Array.isArray(input.menciones) ? { menciones: input.menciones } : {}) },
        resumen: `Comentar en ${queEs(r.fila)}${responderA ? `, respondiendo al comentario #${responderA}` : ''}, ${comoFirma(f.firma)}: «${corto(v.cuerpo)}».`,
      };
    }),
    ejecutar: sinLanzar('comentar', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const r = await comentar(firmado(ctx, Number(pl.productoId), f), Number(pl.postId), { cuerpo: pl.cuerpo, menciones: pl.menciones, responderA: pl.responderA ?? null });
      if (!r.ok) return { ok: false, resumen: `No se pudo comentar: ${r.error}` };
      return { ok: true, resumen: `Listo: comentario de ${f.nombre} publicado (#${r.comentario.id}).`, datos: { comentarioId: r.comentario.id, postId: Number(pl.postId) } };
    }),
  },

  editar_comentario_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const c = await comentarioDeId(ctx, num(input, 'comentarioId'));
      if ('error' in c) return { error: c.error };
      const v = validarComentario({ cuerpo: input.cuerpo }, () => undefined);
      if (!v.ok) return { error: v.error };
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      if (f.firma && f.firma.clave !== c.miembro) {
        return { error: 'Sólo quien lo escribió edita un comentario, y la persona que firma no es la autora. Para moderarlo está borrar_comentario_comunidad.' };
      }
      const menciones = Array.isArray(input.menciones) ? input.menciones : c.menciones;
      if (v.cuerpo === c.cuerpo && mismasMenciones(menciones, c.menciones)) return { error: 'El comentario ya dice eso.', yaEstaba: true };
      return {
        payload: { comentarioId: c.id, productoId: c.productoId, cuerpo: input.cuerpo, ...(Array.isArray(input.menciones) ? { menciones: input.menciones } : {}) },
        resumen: `Cambiar el texto del comentario #${c.id} por «${corto(v.cuerpo)}».`,
      };
    }),
    ejecutar: sinLanzar('editar el comentario', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const id = Number(pl.comentarioId);
      // Sin menciones pedidas, las que ya tenía: `editarComentario` guarda las que recibe (sin ellas, ninguna).
      const c = Array.isArray(pl.menciones) ? null : await productoDelComentario(ctx.ws, id);
      const menciones = Array.isArray(pl.menciones) ? pl.menciones : (c?.menciones ?? []);
      const r = await editarComentario(firmado(ctx, Number(pl.productoId), f), id, { cuerpo: pl.cuerpo, menciones });
      if (!r.ok) return { ok: false, resumen: `No se pudo editar: ${r.error}` };
      return { ok: true, resumen: `Listo: comentario #${id} editado.`, datos: { comentarioId: id } };
    }),
  },

  borrar_comentario_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const c = await comentarioDeId(ctx, num(input, 'comentarioId'));
      if ('error' in c) return { error: c.error };
      const d = await detallePost(lector(ctx, c.productoId), c.postId);
      const vista = d ? comentarioEn(d.hilo, c.id) : null;
      const respuestas = vista?.respuestas.length ?? 0;
      return {
        payload: { comentarioId: c.id, productoId: c.productoId },
        resumen: `Borrar el comentario de ${vista?.autor.nombre ?? 'un miembro'} en «${d?.titulo ?? `el post #${c.postId}`}»: «${corto(c.cuerpo)}»${respuestas ? `, con sus ${respuestas} respuestas` : ''}. No se puede deshacer.`,
      };
    }),
    ejecutar: sinLanzar('borrar el comentario', async (pl, ctx) => {
      const id = Number(pl.comentarioId);
      const r = await borrarComentario(lector(ctx, Number(pl.productoId)), id);
      if (!r.ok) return { ok: false, resumen: `No se pudo borrar: ${r.error}` };
      return { ok: true, resumen: `Listo: comentario #${id} borrado.`, datos: { comentarioId: id } };
    }),
  },

  cambiar_like_comentario_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const c = await comentarioDeId(ctx, num(input, 'comentarioId'));
      if ('error' in c) return { error: c.error };
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      const meGusta = input.meGusta === true;
      if (f.firma) {
        if (f.firma.clave === c.miembro) return { error: 'Es un comentario de la persona que firma: nadie se da like a sí mismo.' };
        const d = await detallePost(firmado(ctx, c.productoId, f.firma), c.postId);
        const vista = d ? comentarioEn(d.hilo, c.id) : null;
        if (vista && vista.meGusta === meGusta) return { error: meGusta ? 'Ya le había dado like.' : 'No le había dado like.', yaEstaba: true };
      }
      return {
        payload: { comentarioId: c.id, productoId: c.productoId, meGusta },
        resumen: `${meGusta ? 'Darle like' : 'Sacarle el like'} al comentario #${c.id} («${corto(c.cuerpo)}»), como ${f.firma ? f.firma.nombre : 'la persona que lo confirme'}.`,
      };
    }),
    ejecutar: sinLanzar('cambiar el like', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const id = Number(pl.comentarioId);
      const r = await cambiarLike(firmado(ctx, Number(pl.productoId), f), `c:${id}`, pl.meGusta === true);
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      return { ok: true, resumen: `Listo: el comentario tiene ${r.likes} likes.`, datos: { comentarioId: id, likes: r.likes, meGusta: r.meGusta } };
    }),
  },

  // ── Los comentarios de una clase ────────────────────────────────────────────────
  ver_comentarios_clase_comunidad: {
    leer: async (input, ctx) => {
      const id = num(input, 'claseId');
      if (id == null) return fallo('Falta el claseId.');
      const cl = await claseDeId(id);
      if (!cl) return fallo(`La clase #${id} no existe en este negocio (o está en la papelera).`);
      const [r, est] = await Promise.all([hiloDeClase(lector(ctx, cl.productoId), id), estilosLeidos([cl.productoId])]);
      if (!r.ok) return fallo(r.error);
      return J({
        claseId: id, clase: cl.titulo, productoId: cl.productoId, postId: r.hilo.postId, cerrado: r.hilo.cerrado,
        comentarios_prendidos: est.error ? null : comentariosDeClase(est.estilos.get(cl.productoId), id),
        hilo: r.hilo.hilo.map(comentarioPublico),
        notas: [
          'postId null = nadie comentó todavía: comentar_clase_comunidad abre el hilo.',
          'comentarios_prendidos false = los alumnos no ven los comentarios de ESTA clase (se prenden en el «…» de la clase); null = no se pudo leer.',
        ],
      });
    },
  },

  comentar_clase_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const id = num(input, 'claseId');
      if (id == null) return { error: 'Falta el claseId.' };
      const cl = await claseDeId(id);
      if (!cl) return { error: `La clase #${id} no existe en este negocio (o está en la papelera).` };
      const v = validarComentario({ cuerpo: input.cuerpo }, () => undefined);
      if (!v.ok) return { error: v.error };
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      const est = await estilosLeidos([cl.productoId]);
      const apagados = !est.error && !comentariosDeClase(est.estilos.get(cl.productoId), id);
      return {
        payload: { claseId: id, productoId: cl.productoId, cuerpo: input.cuerpo, ...(Array.isArray(input.menciones) ? { menciones: input.menciones } : {}) },
        resumen: `Comentar la clase «${cl.titulo}», ${comoFirma(f.firma)}: «${corto(v.cuerpo)}».${apagados ? ' Ojo: esa clase tiene los comentarios apagados, así que ningún alumno lo va a ver.' : ''}`,
      };
    }),
    ejecutar: sinLanzar('comentar la clase', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const r = await comentarEnClase(firmado(ctx, Number(pl.productoId), f), Number(pl.claseId), { cuerpo: pl.cuerpo, menciones: pl.menciones });
      if (!r.ok) return { ok: false, resumen: `No se pudo comentar: ${r.error}` };
      return { ok: true, resumen: `Listo: comentario de ${f.nombre} en la clase (#${r.comentario.id}).`, datos: { comentarioId: r.comentario.id, postId: r.postId } };
    }),
  },

  // ── Configurar: categorías, niveles, About y ajustes ────────────────────────────
  crear_categoria_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const cats = await categoriasDeLaComunidad(ctx.ws, p.id);
      const v = validarCategoria({ nombre: input.nombre, permiso: input.permiso, ordenDefault: input.ordenDefault }, cats, null);
      if (!v.ok) return { error: v.error, disponibles: categoriasDisponibles(cats) };
      const c = v.categoria;
      return {
        payload: { productoId: p.id, nombre: c.nombre, permiso: c.permiso, ordenDefault: c.ordenDefault },
        resumen: `Crear la categoría «${c.nombre}» en la comunidad de «${p.nombre}» (publica ${c.permiso === 'equipo' ? 'sólo el equipo' : 'cualquiera'}).`
          + `${cats.length ? '' : ' Es la primera: desde ahora, publicar pide elegir una categoría.'}`,
      };
    }),
    ejecutar: sinLanzar('crear la categoría', async (pl, ctx) => {
      const nombre = String(pl.nombre);
      const r = await guardarCategoria(lector(ctx, Number(pl.productoId)), { nombre, permiso: pl.permiso, ordenDefault: pl.ordenDefault });
      if (!r.ok) return { ok: false, resumen: `No se pudo crear: ${r.error}` };
      // `guardarCategoria` devuelve la lista entera; la nueva es la que se llama así (el nombre no se repite).
      const nueva = r.categorias.find((c) => c.nombre === nombre) ?? r.categorias[r.categorias.length - 1];
      return { ok: true, resumen: `Listo: categoría «${nombre}» creada (#${nueva?.id}).`, datos: { categoriaId: nueva?.id ?? null, categorias: categoriasDisponibles(r.categorias) } };
    }),
  },

  editar_categoria_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const id = num(input, 'categoriaId');
      const cats = await categoriasDeLaComunidad(ctx.ws, p.id);
      const c = cats.find((x) => x.id === id);
      if (!c) return { error: `La categoría #${id} no es de esta comunidad.`, disponibles: categoriasDisponibles(cats) };
      const pedidos = ['nombre', 'permiso', 'ordenDefault'].filter((k) => input[k] !== undefined);
      if (!pedidos.length) return { error: 'No pasaste nada para cambiar: nombre, permiso u ordenDefault.', faltan: ['nombre'] };
      const v = validarCategoria({ nombre: input.nombre ?? c.nombre, permiso: input.permiso ?? c.permiso, ordenDefault: input.ordenDefault ?? c.ordenDefault }, cats, c.id);
      if (!v.ok) return { error: v.error };
      const n = v.categoria;
      if (n.nombre === c.nombre && n.permiso === c.permiso && n.ordenDefault === c.ordenDefault) return { error: 'La categoría ya está así.', yaEstaba: true };
      const cambios: In = {};
      for (const k of pedidos) cambios[k] = input[k];
      return {
        payload: { productoId: p.id, categoriaId: c.id, ...cambios },
        resumen: `Editar la categoría «${c.nombre}»: ${pedidos.map((k) => `${k} → «${String(n[k as keyof typeof n])}»`).join(', ')}.${n.permiso === 'equipo' && c.permiso !== 'equipo' ? ' Los alumnos dejan de poder publicar ahí.' : ''}`,
      };
    }),
    ejecutar: sinLanzar('editar la categoría', async (pl, ctx) => {
      const productoId = Number(pl.productoId);
      const id = Number(pl.categoriaId);
      // La mezcla otra vez, sobre la categoría de AHORA (una pendiente vive dos horas).
      const c = (await categoriasDeLaComunidad(ctx.ws, productoId)).find((x) => x.id === id);
      if (!c) return { ok: false, resumen: 'La categoría ya no está.' };
      const r = await guardarCategoria(lector(ctx, productoId), {
        id, nombre: pl.nombre ?? c.nombre, permiso: pl.permiso ?? c.permiso, ordenDefault: pl.ordenDefault ?? c.ordenDefault,
      });
      if (!r.ok) return { ok: false, resumen: `No se pudo editar: ${r.error}` };
      return { ok: true, resumen: 'Listo: categoría editada.', datos: { categoriaId: id, categorias: categoriasDisponibles(r.categorias) } };
    }),
  },

  borrar_categoria_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const id = num(input, 'categoriaId');
      const cats = await categoriasDeLaComunidad(ctx.ws, p.id);
      const c = cats.find((x) => x.id === id);
      if (!c) return { error: `La categoría #${id} no es de esta comunidad.`, disponibles: categoriasDisponibles(cats) };
      return {
        payload: { productoId: p.id, categoriaId: c.id },
        resumen: `Borrar la categoría «${c.nombre}» de la comunidad de «${p.nombre}». Sus posts quedan sin categoría.${cats.length === 1 ? ' Es la última: publicar deja de pedir categoría.' : ''}`,
      };
    }),
    ejecutar: sinLanzar('borrar la categoría', async (pl, ctx) => {
      const r = await borrarCategoria(lector(ctx, Number(pl.productoId)), Number(pl.categoriaId));
      if (!r.ok) return { ok: false, resumen: `No se pudo borrar: ${r.error}` };
      return { ok: true, resumen: 'Listo: categoría borrada.', datos: { categoriaId: Number(pl.categoriaId), categorias: categoriasDisponibles(r.categorias) } };
    }),
  },

  ordenar_categorias_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const cats = await categoriasDeLaComunidad(ctx.ws, p.id);
      const o = ordenPedido(cats.map((c) => c.id), Array.isArray(input.categoriaIds) ? (input.categoriaIds as unknown[]).map(String) : []);
      if ('error' in o) return { ...o, disponibles: categoriasDisponibles(cats) };
      const nombre = new Map(cats.map((c) => [c.id, c.nombre]));
      return { payload: { productoId: p.id, categoriaIds: o.ids }, resumen: `Ordenar las categorías: ${o.ids.map((id) => `«${nombre.get(id)}»`).join(', ')}.` };
    }),
    ejecutar: sinLanzar('ordenar las categorías', async (pl, ctx) => {
      const r = await ordenarCategorias(lector(ctx, Number(pl.productoId)), pl.categoriaIds);
      if (!r.ok) return { ok: false, resumen: `No se pudo ordenar: ${r.error}` };
      return { ok: true, resumen: 'Listo: categorías ordenadas.', datos: { orden: categoriasDisponibles(r.categorias) } };
    }),
  },

  nombrar_niveles_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const pedidos = Array.isArray(input.niveles) ? (input.niveles as Array<{ nivel?: unknown; nombre?: unknown }>) : [];
      const n = nombresDeNivel((await leerAjustes(ctx.ws, p.id)).nombresNivel, pedidos);
      if ('error' in n) return n;
      if (!n.cambiados.length) return { error: 'Los niveles ya se llaman así.', yaEstaba: true };
      return {
        payload: { productoId: p.id, niveles: pedidos },
        resumen: `Nombrar los niveles de la comunidad de «${p.nombre}»: ${n.cambiados.map((k) => `nivel ${k} → «${nombreDeNivel(n.nombres, k)}»`).join(', ')}.`,
      };
    }),
    ejecutar: sinLanzar('nombrar los niveles', async (pl, ctx) => {
      const productoId = Number(pl.productoId);
      // Sobre los nombres de AHORA: sólo cambia lo pedido.
      const n = nombresDeNivel((await leerAjustes(ctx.ws, productoId)).nombresNivel, Array.isArray(pl.niveles) ? pl.niveles : []);
      if ('error' in n) return { ok: false, resumen: n.error };
      const r = await guardarNombresNivel(lector(ctx, productoId, await nombreRegistro(ctx)), n.nombres);
      if (!r.ok) return { ok: false, resumen: `No se pudo guardar: ${r.error}` };
      return { ok: true, resumen: 'Listo: niveles nombrados.', datos: { niveles: r.nombresNivel.map((_, i) => nombreDeNivel(r.nombresNivel, i + 1)) } };
    }),
  },

  editar_about_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const pedidos = ['nombre', 'descripcion', 'texto', 'reglas'].filter((k) => input[k] !== undefined);
      if (!pedidos.length) return { error: 'No pasaste nada para cambiar: nombre, descripcion, texto o reglas.', faltan: ['texto'] };
      const about = await aboutComunidad(lector(ctx, p.id));
      const antes = { nombre: about.nombrePropio ?? '', descripcion: about.descripcion, texto: about.texto, reglas: about.reglas };
      const crudo = {
        nombre: textoMezclado(input.nombre, antes.nombre), descripcion: textoMezclado(input.descripcion, antes.descripcion),
        texto: textoMezclado(input.texto, antes.texto), reglas: textoMezclado(input.reglas, antes.reglas),
      };
      const v = sanearAbout(crudo);
      if (!v.ok) return { error: v.error };
      const nuevo = v.about;
      const cambiados = (['nombre', 'descripcion', 'texto', 'reglas'] as const).filter((k) => (nuevo[k] ?? '') !== antes[k]);
      if (!cambiados.length) return { error: 'El About ya está así.', yaEstaba: true };
      const rotulo: Record<string, string> = { nombre: 'el nombre', descripcion: 'la descripción corta', texto: 'el texto', reglas: 'las reglas' };
      return {
        payload: { productoId: p.id, ...crudo, antes },
        resumen: `Cambiar el About de la comunidad de «${p.nombre}»: ${cambiados.map((k) => rotulo[k]).join(', ')}.`
          + `${cambiados.includes('nombre') ? ` El nombre pasa de «${antes.nombre || about.nombre}» a «${nuevo.nombre ?? p.nombre}».` : ''}`,
      };
    }),
    ejecutar: sinLanzar('guardar el About', async (pl, ctx) => {
      const productoId = Number(pl.productoId);
      const r = await guardarAbout(lector(ctx, productoId, await nombreRegistro(ctx)), { nombre: pl.nombre, descripcion: pl.descripcion, texto: pl.texto, reglas: pl.reglas });
      if (!r.ok) return { ok: false, resumen: `No se pudo guardar: ${r.error}` };
      return { ok: true, resumen: `Listo: About de «${r.about.nombre}» guardado. Lo que había vuelve en datos.antes.`, datos: { antes: pl.antes ?? null } };
    }),
  },

  ajustar_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const nivel = typeof input.nivelParaPostear === 'number' ? input.nivelParaPostear : undefined;
      const zonaPedida = str(input, 'zona')?.trim();
      if (nivel === undefined && zonaPedida === undefined) return { error: 'Pasa nivelParaPostear, zona o los dos.', faltan: ['nivelParaPostear'] };
      if (zonaPedida && zonaPedida !== VACIAR && !esZonaValida(zonaPedida)) return { error: `La zona «${zonaPedida}» no existe. Usa una IANA, como America/Bogota.` };
      const about = await aboutComunidad(lector(ctx, p.id));
      const nuevoNivel = nivel ?? about.nivelParaPostear;
      const nuevaZona = zonaPedida === undefined ? about.zona : zonaPedida === VACIAR ? null : zonaPedida;
      if (nuevoNivel === about.nivelParaPostear && nuevaZona === about.zona) return { error: 'La comunidad ya está así.', yaEstaba: true };
      return {
        payload: { productoId: p.id, ...(nivel !== undefined ? { nivelParaPostear: nivel } : {}), ...(zonaPedida !== undefined ? { zona: zonaPedida } : {}) },
        resumen: `Ajustar la comunidad de «${p.nombre}»:`
          + `${nuevoNivel !== about.nivelParaPostear ? ` publican los alumnos desde el nivel ${nuevoNivel}${nuevoNivel === 1 ? ' (todos)' : ''}.` : ''}`
          + `${nuevaZona !== about.zona ? ` El calendario pasa a la zona ${nuevaZona ?? 'del negocio'}.` : ''}`,
      };
    }),
    ejecutar: sinLanzar('ajustar la comunidad', async (pl, ctx) => {
      const productoId = Number(pl.productoId);
      // Sobre los ajustes de AHORA: `guardarAjustesComunidad` escribe los dos (y pisa la zona si no viene).
      const about = await aboutComunidad(lector(ctx, productoId));
      const zona = typeof pl.zona === 'string' ? (pl.zona.trim() === VACIAR ? null : pl.zona.trim()) : about.zona;
      const r = await guardarAjustesComunidad(lector(ctx, productoId, await nombreRegistro(ctx)), {
        nivelParaPostear: typeof pl.nivelParaPostear === 'number' ? pl.nivelParaPostear : about.nivelParaPostear, zona,
      });
      if (!r.ok) return { ok: false, resumen: `No se pudo guardar: ${r.error}` };
      return { ok: true, resumen: 'Listo: comunidad ajustada.', datos: { nivelParaPostear: r.about.nivelParaPostear, zona: r.about.zona } };
    }),
  },

  // ── Miembros, ranking y moderación ──────────────────────────────────────────────
  ver_ranking_comunidad: {
    leer: async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return fallo(p.error);
      const r = await rankingComunidad(lector(ctx, p.id));
      return J({ productoId: p.id, niveles: r.niveles, semana: r.semana, mes: r.mes, total: r.total, actualizado: r.actualizado });
    },
  },

  listar_miembros_comunidad: {
    leer: async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return fallo(p.error);
      const m = await miembrosComunidad(lector(ctx, p.id), { filtro: str(input, 'filtro'), q: str(input, 'q') });
      return J({
        productoId: p.id, conteos: m.conteos, miembros: m.miembros,
        nota: 'clave u:N = del equipo; l:N = un alumno (N es su leadId). Los conteos son de la comunidad entera, no de lo filtrado.',
      });
    },
  },

  ver_miembro_comunidad: {
    leer: async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return fallo(p.error);
      const clave = str(input, 'clave') ?? '';
      if (!leerClave(clave)) return fallo(`«${clave}» no es una clave de miembro: es u:N o l:N (de listar_miembros_comunidad).`);
      const x = await perfilDe(lector(ctx, p.id), clave);
      if (!x) return fallo(`${clave} no es miembro de esta comunidad (o lo sacaron: listar_sacados_comunidad).`);
      return J({
        productoId: p.id, clave: x.clave, nombre: x.nombre, foto: x.foto, nivel: x.nivel, nombreNivel: x.nombreNivel,
        puntos: x.puntos, equipo: x.equipo, bio: x.bio, links: x.links, ubicacion: x.ubicacion,
        enLinea: x.enLinea, ultimaActividad: x.ultimaActividad, desde: x.desde,
      });
    },
  },

  listar_sacados_comunidad: {
    leer: async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return fallo(p.error);
      const r = await sacadosDeLaComunidad(lector(ctx, p.id));
      if (!r.ok) return fallo(r.error);
      return J({
        productoId: p.id,
        sacados: r.sacados.map((s) => ({ leadId: leadDe(s.miembro.clave), clave: s.miembro.clave, nombre: s.miembro.nombre, foto: s.miembro.foto, desde: s.desde, motivo: s.motivo, por: s.por })),
      });
    },
  },

  sacar_alumno_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const leadId = num(input, 'leadId');
      if (leadId == null) return { error: 'Falta el leadId.' };
      const clave = claveDeLead(leadId);
      // PRIMERO los sacados: `miembrosDeLaComunidad` ya no los cuenta, y un sacado no es «no es alumno».
      const s = await sacadosDeLaComunidad(lector(ctx, p.id));
      if (!s.ok) return { error: s.error };
      if (s.sacados.some((x) => x.miembro.clave === clave)) return { error: 'Ese alumno ya está fuera de la comunidad.', yaEstaba: true };
      const com = await miembrosDeLaComunidad(ctx.ws, p.id);
      if (!com.alumnos.has(clave)) return { error: `${clave} no es un alumno de esta comunidad (al equipo no se lo saca; ver listar_miembros_comunidad).` };
      const nombre = (await infoDeMiembros(ctx.ws, [clave])).get(clave)?.nombre ?? clave;
      const borrar = input.borrarContenido === true;
      const motivo = str(input, 'motivo') ?? '';
      return {
        payload: { productoId: p.id, leadId, motivo, borrarContenido: borrar },
        resumen: `Sacar a ${nombre} del curso de «${p.nombre}» y de su comunidad${motivo.trim() ? ` (motivo: «${corto(motivo)}»)` : ''}. Si es su único curso, se le corta el acceso.`
          + `${borrar ? ' Y borrar sus posts y comentarios de los últimos 7 días: eso NO se puede deshacer.' : ''}`,
      };
    }),
    ejecutar: sinLanzar('sacar al alumno', async (pl, ctx) => {
      const productoId = Number(pl.productoId);
      const r = await sacarAlumno(lector(ctx, productoId, await nombreRegistro(ctx)), claveDeLead(Number(pl.leadId)), { motivo: pl.motivo, borrarContenido: pl.borrarContenido === true });
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      const b = r.borrados;
      const curso = r.curso === 'cortado' ? ' Era su único curso: su acceso quedó cortado.' : r.curso === 'quitado' ? ' Ya no ve ese curso.' : '';
      return {
        ok: true,
        resumen: `Listo: quedó fuera de la comunidad.${curso}${pl.borrarContenido === true ? ` Se borraron ${b.posts} posts y ${b.comentarios} comentarios.` : ''}`,
        datos: { leadId: Number(pl.leadId), borrados: b, curso: r.curso },
      };
    }),
  },

  admitir_alumno_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const leadId = num(input, 'leadId');
      if (leadId == null) return { error: 'Falta el leadId.' };
      const clave = claveDeLead(leadId);
      const s = await sacadosDeLaComunidad(lector(ctx, p.id));
      if (!s.ok) return { error: s.error };
      const x = s.sacados.find((y) => y.miembro.clave === clave);
      if (!x) return { error: 'Ese alumno no está fuera de la comunidad.', yaEstaba: true };
      return { payload: { productoId: p.id, leadId }, resumen: `Volver a admitir a ${x.miembro.nombre} en la comunidad de «${p.nombre}».` };
    }),
    ejecutar: sinLanzar('admitir al alumno', async (pl, ctx) => {
      const r = await admitirAlumno(lector(ctx, Number(pl.productoId)), claveDeLead(Number(pl.leadId)));
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      return {
        ok: true,
        resumen: r.cursoCortado
          ? 'Listo: volvió a la comunidad. Su acceso al curso lo cortó otra persona y sigue cortado: se habilita desde su ficha.'
          : 'Listo: volvió al curso y a la comunidad.',
        datos: { leadId: Number(pl.leadId), cursoCortado: r.cursoCortado },
      };
    }),
  },

  // ── El calendario ───────────────────────────────────────────────────────────────
  ver_calendario_comunidad: {
    leer: async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return fallo(p.error);
      const desde = msDeFecha(input.desde);
      const hasta = msDeFecha(input.hasta);
      if (desde === null || hasta === null) return fallo('desde y hasta van como YYYY-MM-DD o como una fecha ISO.');
      const a = lector(ctx, p.id);
      const [cal, op] = await Promise.all([calendarioComunidad(a, { desde, hasta }), opcionesDeEvento(a)]);
      const rango = rangoDeCalendario(desde, hasta, Date.now());
      return J({
        productoId: p.id,
        rango: { desde: new Date(rango.desde).toISOString(), hasta: new Date(rango.hasta).toISOString() },
        eventos: cal.eventos.map((e) => ({
          id: e.id, titulo: e.titulo, descripcion: e.descripcion, zona: e.zona, duracionMin: e.duracionMin, inicio: e.inicio,
          local: e.local, recurrente: e.recurrente, textoRecurrencia: e.textoRecurrencia, recurrencia: e.recurrencia,
          lugarTipo: e.lugarTipo, lugar: e.lugar, portada: e.portada, acceso: e.acceso, esReemplazo: e.esReemplazo,
        })),
        ocurrencias: cal.ocurrencias,
        opciones: op.ok ? { modulos: op.modulos, zona: op.zona } : null,
        notas: ['El rango se acota a 130 días.', 'Una ocurrencia se nombra por su fecha local (ocurrencias[].fecha): es lo que piden editar y borrar con alcance este o siguientes.'],
      });
    },
  },

  exportar_evento_ics_comunidad: {
    leer: async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return fallo(p.error);
      const r = await icsComunidad(lector(ctx, p.id), { id: num(input, 'eventoId'), fecha: str(input, 'fecha'), serie: input.serie === true });
      if (!r.ok) return fallo(r.error);
      return {
        content: r.ics,
        headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${r.nombre}"` },
      };
    },
  },

  crear_evento_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      // La comunidad es SÓLO de MaKo Pro (14/11/2026): se dice antes de proponer; `guardarEvento` lo vuelve a preguntar.
      const candado = await candadoDeComunidad({ ws: ctx.ws, equipo: true });
      if (candado) return { error: candado };
      const op = await opcionesDeEvento(lector(ctx, p.id));
      if (!op.ok) return { error: op.error };
      const crudo: In = {
        titulo: input.titulo, descripcion: input.descripcion ?? '', fecha: input.fecha, hora: input.hora,
        zona: str(input, 'zona') ?? op.zona, duracionMin: typeof input.duracionMin === 'number' ? input.duracionMin : DURACION_DEFAULT_API,
        lugarTipo: input.lugarTipo ?? 'link', lugar: input.lugar ?? '', portada: input.portada ?? null,
        acceso: input.acceso ?? { tipo: 'todos' }, recurrencia: input.recurrencia ?? null,
      };
      const e = await eventoValido(p.id, crudo);
      if ('error' in e) return e;
      const v = e.v.evento;
      return {
        payload: { productoId: p.id, ...crudo },
        resumen: `Crear en el calendario de «${p.nombre}» el evento «${v.titulo}»: ${cuandoEs(v)}.${v.acceso.tipo !== 'todos' ? ` Entra ${v.acceso.tipo === 'nivel' ? `desde el nivel ${v.acceso.nivel}` : 'quien tiene ese módulo'}.` : ''}`,
      };
    }),
    ejecutar: sinLanzar('crear el evento', async (pl, ctx) => {
      const productoId = Number(pl.productoId);
      const { productoId: _p, ...crudo } = pl;
      void _p;
      const r = await guardarEvento(lector(ctx, productoId, await nombreRegistro(ctx)), crudo);
      if (!r.ok) return { ok: false, resumen: `No se pudo crear: ${r.error}` };
      return { ok: true, resumen: `Listo: evento «${String(pl.titulo)}» creado (#${r.id}).`, datos: { eventoId: r.id } };
    }),
  },

  editar_evento_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const id = num(input, 'eventoId');
      const e = await eventoParaEditar(lector(ctx, p.id), id);
      if (!e) return { error: `El evento #${id} no existe en esta comunidad.` };
      const al = alcanceDe(input, e);
      if ('error' in al) return al;
      const pedidos = CAMPOS_EVENTO.filter((k) => input[k] !== undefined);
      if (!pedidos.length) return { error: `No pasaste nada para cambiar: ${CAMPOS_EVENTO.join(', ')}.`, faltan: ['titulo'] };
      const ev = e.evento;
      const base: EventoBase = {
        titulo: ev.titulo, descripcion: ev.descripcion, zona: ev.zona, duracionMin: ev.duracionMin, local: ev.local,
        lugarTipo: ev.lugarTipo, lugar: ev.lugar, portada: ev.portada, acceso: ev.acceso, recurrencia: ev.recurrencia, serie: e.serie,
      };
      const crudo = eventoMezclado(base, { ...input, ocurrencia: al.ocurrencia ?? undefined });
      // Como lo va a validar `guardarEvento`: «este» nace sin repetición, y una ocurrencia movida tampoco se repite.
      const sinRepetir = (e.serie && al.alcance === 'este') || ev.esReemplazo;
      const ok = await eventoValido(p.id, sinRepetir ? { ...crudo, recurrencia: null } : crudo);
      if ('error' in ok) return ok;
      const antes = sanearEvento(eventoMezclado(base, { ocurrencia: al.ocurrencia ?? undefined }));
      if (antes.ok && J(antes.evento) === J(ok.v.evento)) return { error: 'El evento ya está así.', yaEstaba: true };
      const queParte = !e.serie ? '' : al.alcance === 'este' ? ` (sólo la del ${al.ocurrencia})` : al.alcance === 'siguientes' ? ` (desde la del ${al.ocurrencia}: la serie se parte)` : ' (la serie entera)';
      return {
        payload: { productoId: p.id, id: ev.id, alcance: al.alcance, ocurrencia: al.ocurrencia, ...crudo },
        resumen: `Editar el evento «${ev.titulo}»${queParte}: ${pedidos.join(', ')}. Queda: «${ok.v.evento.titulo}», ${cuandoEs(ok.v.evento)}.`,
      };
    }),
    ejecutar: sinLanzar('editar el evento', async (pl, ctx) => {
      const productoId = Number(pl.productoId);
      const { productoId: _p, ...crudo } = pl;
      void _p;
      const r = await guardarEvento(lector(ctx, productoId, await nombreRegistro(ctx)), crudo);
      if (!r.ok) return { ok: false, resumen: `No se pudo editar: ${r.error}` };
      const nuevo = r.id !== Number(pl.id);
      return { ok: true, resumen: nuevo ? `Listo: nació el evento #${r.id} con lo editado.` : 'Listo: evento editado.', datos: { eventoId: r.id, nuevo } };
    }),
  },

  borrar_evento_comunidad: {
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const id = num(input, 'eventoId');
      const e = await eventoParaEditar(lector(ctx, p.id), id);
      if (!e) return { error: `El evento #${id} no existe en esta comunidad.` };
      const al = alcanceDe(input, e);
      if ('error' in al) return al;
      const que = !e.serie ? '' : al.alcance === 'este' ? `, sólo la del ${al.ocurrencia}` : al.alcance === 'siguientes' ? `, desde la del ${al.ocurrencia} en adelante` : ', con todas sus fechas';
      return {
        payload: { productoId: p.id, id: e.evento.id, alcance: al.alcance, ocurrencia: al.ocurrencia },
        resumen: `Borrar el evento «${e.evento.titulo}»${que}. No se puede deshacer.`,
      };
    }),
    ejecutar: sinLanzar('borrar el evento', async (pl, ctx) => {
      const r = await borrarEvento(lector(ctx, Number(pl.productoId)), { id: pl.id, alcance: pl.alcance, ocurrencia: pl.ocurrencia });
      if (!r.ok) return { ok: false, resumen: `No se pudo borrar: ${r.error}` };
      return { ok: true, resumen: 'Listo: evento borrado.', datos: { eventoId: Number(pl.id) } };
    }),
  },

  // ── La campana y el perfil de quien firma ───────────────────────────────────────
  ver_avisos_comunidad: {
    leer: async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return fallo(p.error);
      const q = await quienFirma(ctx);
      if ('error' in q) return fallo(q.error);
      if (!q.firma) return fallo('La campana es de una persona, y este pedido no trae a ninguna: hace falta un token creado por una persona del equipo.');
      // `sinEscribir`: leer la campana por la API NO anota los avisos de los eventos próximos (la pantalla sí, al abrirla):
      // un token «Solo lectura» no puede escribir filas en la campana de su creador.
      const c = await campanaComunidad(firmado(ctx, p.id, q.firma), { sinEscribir: true });
      return J({
        productoId: p.id, de: q.firma.nombre, sinLeer: c.sinLeer,
        avisos: c.items.map((i) => ({
          ids: i.ids.map(String), tipo: i.tipo, quienes: i.quienes.map((x) => ({ clave: x.clave, nombre: x.nombre })), total: i.total,
          postId: i.postId, postTitulo: i.postTitulo, comentarioId: i.comentarioId, eventoId: i.eventoId, eventoTitulo: i.eventoTitulo,
          ocurrencia: i.ocurrencia, creado: i.creado, leida: i.leida,
        })),
      });
    },
  },

  marcar_avisos_leidos_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const todas = input.todas === true;
      const crudos = Array.isArray(input.ids) ? (input.ids as unknown[]).map(String) : [];
      const malos = crudos.filter((s) => !/^\d{1,15}$/.test(s.trim()));
      if (malos.length) return { error: `Estos ids no son números: ${malos.slice(0, 5).join(', ')}.` };
      const ids = crudos.map((s) => Number(s.trim()));
      if (!todas && !ids.length) return { error: 'Pasa los ids (de ver_avisos_comunidad) o todas: true.', faltan: ['ids'] };
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      return {
        payload: { productoId: p.id, todas, ids },
        resumen: `Marcar leídos ${todas ? 'todos los avisos' : `${ids.length} avisos`} de la campana de ${f.firma ? f.firma.nombre : 'la persona que lo confirme'} en la comunidad de «${p.nombre}».`,
      };
    }),
    ejecutar: sinLanzar('marcar los avisos', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const r = await marcarLeidas(firmado(ctx, Number(pl.productoId), f), pl.todas === true ? 'todas' : pl.ids);
      if (!r.ok) return { ok: false, resumen: `No se pudo: ${r.error}` };
      return { ok: true, resumen: 'Listo: avisos marcados como leídos.' };
    }),
  },

  editar_perfil_comunidad: {
    faltaParaConfirmar: faltaFirma,
    preparar: revisando(async (input, ctx) => {
      const p = await productoDe(ctx, input);
      if ('error' in p) return p;
      const pedidos = ['bio', 'ubicacion', 'links'].filter((k) => input[k] !== undefined);
      if (!pedidos.length) return { error: 'No pasaste nada para cambiar: bio, ubicacion o links.', faltan: ['bio'] };
      // Lo pedido, solo, ya tiene que valer (un link que no es una dirección se rechaza ahora, no al confirmar).
      const solo = sanearPerfil(perfilMezclado({ bio: '', ubicacion: '', links: {} }, input));
      if (!solo.ok) return { error: solo.error };
      const f = await firmaAlProponer(ctx);
      if ('error' in f) return f;
      if (f.firma) {
        const actual = await perfilDe(firmado(ctx, p.id, f.firma), f.firma.clave);
        if (actual) {
          const v = sanearPerfil(perfilMezclado(actual, input));
          if (!v.ok) return { error: v.error };
          if (v.perfil.bio === actual.bio && v.perfil.ubicacion === actual.ubicacion && J(v.perfil.links) === J(actual.links)) {
            return { error: 'El perfil ya está así.', yaEstaba: true };
          }
        }
      }
      const cambios: In = {};
      for (const k of pedidos) cambios[k] = input[k];
      return {
        payload: { productoId: p.id, ...cambios },
        resumen: `Cambiar ${pedidos.map((k) => (k === 'bio' ? 'la bio' : k === 'ubicacion' ? 'la ubicación' : 'los links')).join(', ')} del perfil de ${f.firma ? f.firma.nombre : 'la persona que lo confirme'} en la comunidad.`,
      };
    }),
    ejecutar: sinLanzar('guardar el perfil', async (pl, ctx) => {
      const f = await firmaAlEscribir(ctx);
      if ('error' in f) return { ok: false, resumen: f.error };
      const a = firmado(ctx, Number(pl.productoId), f);
      // Sobre el perfil de AHORA: `guardarPerfil` escribe la bio, la ubicación y los links juntos.
      const actual = await perfilDe(a, f.clave);
      const r = await guardarPerfil(a, perfilMezclado(actual ?? { bio: '', ubicacion: '', links: {} }, pl));
      if (!r.ok) return { ok: false, resumen: `No se pudo guardar: ${r.error}` };
      return { ok: true, resumen: `Listo: perfil de ${f.nombre} guardado.`, datos: { bio: r.perfil.bio, ubicacion: r.perfil.ubicacion, links: r.perfil.links } };
    }),
  },
};
