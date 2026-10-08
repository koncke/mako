// =============================================================================
// POST /api/compartido/comunidad  {t, p, a, ...}
// =============================================================================
// La comunidad del producto `p`, desde el portal del ALUMNO, sin sesión (D8 de
// docs/diseno-curso-skool.md). Una sola ruta y una acción por pedido (`a`): leer el feed, abrir un
// post, publicar, comentar, dar like, votar, el ranking, los miembros y su perfil; y desde la segunda
// mitad, el calendario (con su .ics), la campana, el About, la búsqueda y seguir un post. La pinta
// <ComunidadAlumno token productoId /> (app/_comunidad/ComunidadAlumno.tsx).
//
// ⚠️ UNA RUTA Y NO DIEZ, A PROPÓSITO: toda ruta de ESCRITURA bajo /api/compartido tiene que estar,
//    exacta, en PUBLICOS_ESCRITURA (lib/rutas-publicas.ts) — el proxy le contesta 405 a cualquier POST
//    que no esté ahí. Una ruta es UNA excepción escrita a mano, y por eso las LECTURAS también van por
//    POST: el token viaja en el CUERPO y no en la URL (que queda en los logs, a diferencia de
//    /api/compartido/curso/video, que lo lleva en la query porque lo pide un `<video>`).
//
// ⚠️ EL WORKSPACE SALE DE LA FIRMA DEL TOKEN (`leerTokenPortal(t).ws`), nunca de un parámetro, y todo
//    corre adentro de `runWithWorkspace`. Quién es y si puede entrar a ESTA comunidad lo decide
//    `actorDelAlumno` (lib/comunidad-datos.ts): token vigente, NO un líder de área, el producto es suyo
//    y no está baneado. Cualquier rechazo es un 404 genérico, igual que un token inválido.
//
// ⚠️ LO QUE PUEDE EL ALUMNO LO VUELVE A DECIDIR lib/comunidad-datos.ts con el actor de la firma: acá
//    no se expone «fijar» ni «configurar» (son del equipo), y aunque se expusieran, contestarían que no.
//    Lo mismo con lo de la segunda mitad que es del equipo: crear o borrar eventos, sacar a alguien,
//    cerrar comentarios, editar el About. El alumno LEE el calendario (y baja su .ics), la campana, el
//    About y la búsqueda; y ESCRIBE sólo lo suyo: marcar sus avisos leídos y seguir un post.
//
// ⚠️ UN ALUMNO SACADO DE LA COMUNIDAD NO ENTRA A NINGUNA ACCIÓN, NI A LEER: `actorDelAlumno` lo devuelve
//    `null` (404) antes del `switch` (tests/comunidad-moderacion.test.ts). Su curso sigue abierto: esa es
//    otra ruta y otra tabla.

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { leerTokenPortal } from '@/lib/curso-acceso';
import { leerJsonTopeado } from '@/lib/curso-portal';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { idValido } from '@/lib/comunidad-reglas';
import {
  actorDelAlumno, inicioComunidad, feedComunidad, detallePost, publicarPost, editarPost, borrarPost,
  comentar, editarComentario, borrarComentario, cambiarLike, votar, rankingComunidad, miembrosComunidad,
  perfilDe, guardarPerfil, urlSubidaAdjunto, descartarAdjunto, marcarActividad, seguirPost, aboutComunidad,
  buscarEnComunidad,
} from '@/lib/comunidad-datos';
import { calendarioComunidad, icsComunidad } from '@/lib/comunidad-calendario';
import { campanaComunidad, marcarLeidas } from '@/lib/comunidad-campana';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Publicar lee la entrega (para validar menciones) y escribe; el ranking cuenta los likes. 30 s sobran.
export const maxDuration = 30;

const SIN_CACHE = { 'Cache-Control': 'private, no-store' };
const NO = () => Response.json({ ok: false }, { status: 404, headers: SIN_CACHE });
const MUCHO = () => Response.json({ ok: false, error: 'Vas muy rápido. Espera un momento.' }, { status: 429, headers: SIN_CACHE });
const OK = (cuerpo: object) => Response.json(cuerpo, { headers: SIN_CACHE });

/** Un post entero (10.000 letras), su encuesta y un adjunto ya subido entran holgados. */
const TOPE_PEDIDO = 64_000;

/** Las acciones que LEEN y las que ESCRIBEN: tienen topes distintos por alumno. */
const LECTURAS = new Set(['inicio', 'feed', 'post', 'ranking', 'miembros', 'perfil', 'latido', 'calendario', 'ics', 'campana', 'about', 'buscar']);
const ESCRITURAS = new Set([
  'publicar', 'editar', 'borrar', 'comentar', 'editarComentario', 'borrarComentario',
  'like', 'votar', 'guardarPerfil', 'subida', 'descartar', 'leerCampana', 'seguir',
]);

export async function POST(req: NextRequest) {
  // Por IP antes de leer nada: corta el barrido de tokens sin tocar la base.
  if (!rateLimit(`comunidad:ip:${clientIp(req)}`, 240, 60_000)) return MUCHO();

  const cuerpo = await leerJsonTopeado(req, TOPE_PEDIDO);
  if (!cuerpo.ok) return Response.json({ ok: false }, { status: cuerpo.status, headers: SIN_CACHE });
  const b = (cuerpo.valor && typeof cuerpo.valor === 'object' ? cuerpo.valor : {}) as Record<string, unknown>;
  const token = typeof b.t === 'string' ? b.t : '';
  const productoId = idValido(b.p);
  const accion = typeof b.a === 'string' ? b.a : '';
  if (!productoId || (!LECTURAS.has(accion) && !ESCRITURAS.has(accion))) return NO();

  const firma = leerTokenPortal(token);
  if (!firma) return NO();

  return runWithWorkspace(firma.ws, async () => {
    try {
      const actor = await actorDelAlumno(token, productoId);
      if (!actor) return NO();
      // Por ALUMNO, aparte del de la IP: un feed que se scrollea pide bastante; escribir, mucho menos.
      const escribe = ESCRITURAS.has(accion);
      if (!rateLimit(`comunidad:lead:${actor.ws}:${actor.leadId}:${escribe ? 'w' : 'r'}`, escribe ? 40 : 150, 60_000)) return MUCHO();
      // Una SUBIDA firma 25 MB que van directo al bucket: el tope de escrituras (40 por minuto) son
      // 1 GB por minuto. Un post lleva UN archivo; seis por minuto sobran para quien publica de verdad.
      if (accion === 'subida' && !rateLimit(`comunidad:lead:${actor.ws}:${actor.leadId}:subida`, 6, 60_000)) return MUCHO();

      switch (accion) {
        case 'inicio': {
          const [comunidad, feed] = await Promise.all([inicioComunidad(actor), feedComunidad(actor, {})]);
          return OK({ ok: true, comunidad, feed });
        }
        case 'feed':
          return OK({ ok: true, feed: await feedComunidad(actor, { categoriaId: b.categoriaId, orden: b.orden, pagina: b.pagina }) });
        case 'post': {
          const post = await detallePost(actor, b.id);
          return OK(post ? { ok: true, post } : { ok: false, error: 'Ese post ya no está.' });
        }
        case 'ranking':
          return OK({ ok: true, ranking: await rankingComunidad(actor) });
        case 'miembros':
          return OK({ ok: true, miembros: await miembrosComunidad(actor, { filtro: b.filtro, q: b.q }) });
        case 'perfil': {
          const perfil = await perfilDe(actor, b.clave);
          return OK(perfil ? { ok: true, perfil } : { ok: false, error: 'Esa persona ya no está.' });
        }
        case 'latido':
          await marcarActividad(actor.ws, actor.clave);
          return OK({ ok: true });
        case 'calendario':
          return OK({ ok: true, calendario: await calendarioComunidad(actor, { desde: b.desde, hasta: b.hasta }) });
        case 'ics': return OK(await icsComunidad(actor, { id: b.id, fecha: b.fecha, serie: b.serie }));
        case 'campana':
          return OK({ ok: true, campana: await campanaComunidad(actor) });
        case 'about':
          return OK({ ok: true, about: await aboutComunidad(actor) });
        case 'buscar':
          return OK({ ok: true, busqueda: await buscarEnComunidad(actor, b.q) });
        case 'leerCampana': return OK(await marcarLeidas(actor, b.ids));
        case 'seguir': return OK(await seguirPost(actor, b.id, b.si === true));
        case 'publicar': return OK(await publicarPost(actor, b.post));
        case 'editar': return OK(await editarPost(actor, b.id, b.post));
        case 'borrar': return OK(await borrarPost(actor, b.id));
        case 'comentar': return OK(await comentar(actor, b.postId, b.comentario));
        case 'editarComentario': return OK(await editarComentario(actor, b.id, b.comentario));
        case 'borrarComentario': return OK(await borrarComentario(actor, b.id));
        case 'like': return OK(await cambiarLike(actor, b.objetivo, b.si === true));
        case 'votar': return OK(await votar(actor, b.postId, b.opcion));
        case 'guardarPerfil': return OK(await guardarPerfil(actor, b.perfil));
        case 'subida': return OK(await urlSubidaAdjunto(actor, b.mime, b.bytes));
        case 'descartar': return OK(await descartarAdjunto(actor, b.path));
      }
      return NO();
    } catch (e) {
      console.error('[comunidad] el pedido del alumno falló:', accion, e instanceof Error ? e.message : e);
      return Response.json({ ok: false, error: 'No pude cargar eso. Intenta de nuevo.' }, { status: 500, headers: SIN_CACHE });
    }
  });
}
