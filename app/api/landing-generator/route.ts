// =============================================================================
// POST /api/landing-generator — los documentos del editor de landings copiado de Gamma
// =============================================================================
// Un `accion` por operación, exactamente `PedidoDocs` (lib/editor-landing/api-tipos.ts). Toda
// respuesta es `{ ok: true, … }` (la forma de cada una: `RespuestasDocs`, lib/editor-landing/server.ts)
// o `{ ok: false, error, conflicto?, versionActual? }` con su código HTTP. La lógica vive en
// lib/editor-landing/server.ts y publicar.ts; acá sólo están la puerta y el reparto. Diseño:
// docs/diseno-editor-landing.md.
//
// Una ruta y no server actions: el editor autoguarda seguido y las actions se ENCOLAN de a una
// (AGENTS.md, «Antes de optimizar una consulta…»), y además topean el cuerpo en 1 MB — una landing
// con varias páginas lo pasa. El `?ws=` lo pega solo el parche de fetch (app/_components/WsFetch.tsx).
//
// LA PUERTA es la misma que la de la página (`requireRolWs([], { nav: 'landing-writer' })`): admin
// del workspace y la tab en su capa. `tabEnCapa` mira la CAPA, no a la persona: sin el rol, un
// closer haría por acá lo que su pantalla le esconde.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import * as docs from '@/lib/editor-landing/server';
import { publicar, despublicar, sitioActivo } from '@/lib/editor-landing/publicar';
import type { PedidoDocs } from '@/lib/editor-landing/api-tipos';

export const dynamic = 'force-dynamic';
// Publicar renderiza todas las páginas y la analítica pagina las visitas de 30 días: holgado, pero
// lejos de los 300 s de un cron. Nada acá llama a un modelo.
export const maxDuration = 60;

async function puerta(): Promise<Response | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (rol == null) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  if (ws == null || rol !== 'admin') return Response.json({ ok: false, error: 'Solo el admin del negocio' }, { status: 403 });
  if (!tabEnCapa('landing-writer', await getCapaActual())) return Response.json({ ok: false, error: 'No existe' }, { status: 404 });
  return null;
}

/**
 * Las acciones que existen. Un `Record` y no una lista: si `PedidoDocs` suma una acción, esto deja
 * de tipar hasta que alguien la agregue (y el `switch` de abajo, hasta que alguien la atienda).
 */
const ACCIONES: Record<docs.AccionDocs, true> = {
  listar: true, abrir: true, crear: true, guardar: true, duplicar: true, renombrar: true,
  papelera: true, restaurar: true, borrar: true,
  versiones: true, version: true, guardarVersion: true, restaurarVersion: true,
  slugDisponible: true, publicar: true, despublicar: true, sitioActivo: true, vistaPrevia: true,
  comentarios: true, comentar: true, resolverComentario: true, borrarComentario: true,
  analitica: true, temas: true, guardarTema: true, borrarTema: true,
  borradoresViejos: true, importarBorrador: true,
};

const esAccion = (v: unknown): v is docs.AccionDocs => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ACCIONES, v);

function ejecutar(p: PedidoDocs): Promise<docs.Resultado<docs.AccionDocs>> {
  switch (p.accion) {
    case 'listar': return docs.listar();
    case 'abrir': return docs.abrir(p.id);
    case 'crear': return docs.crear(p);
    case 'guardar': return docs.guardar(p);
    case 'duplicar': return docs.duplicar(p.id);
    case 'renombrar': return docs.renombrar(p.id, p.titulo);
    case 'papelera': return docs.mandarAPapelera(p.id);
    case 'restaurar': return docs.restaurarDePapelera(p.id);
    case 'borrar': return docs.borrar(p.id);
    case 'versiones': return docs.versiones(p.id);
    case 'version': return docs.verVersion(p.id, p.versionId);
    case 'guardarVersion': return docs.guardarVersion(p.id, p.motivo);
    case 'restaurarVersion': return docs.restaurarVersion(p.id, p.versionId);
    case 'slugDisponible': return docs.slugDisponible(p.id, p.slug);
    case 'publicar': return publicar(p.id, p.version, p.slug);
    case 'despublicar': return despublicar(p.id);
    case 'sitioActivo': return sitioActivo(p.id, p.valor);
    case 'vistaPrevia': return docs.vistaPrevia(p.id, p.regenerar);
    case 'comentarios': return docs.comentarios(p.id);
    case 'comentar': return docs.comentar(p);
    case 'resolverComentario': return docs.resolverComentario(p.id, p.comentarioId, p.valor);
    case 'borrarComentario': return docs.borrarComentario(p.id, p.comentarioId);
    case 'analitica': return docs.analitica(p.id);
    case 'temas': return docs.temas();
    case 'guardarTema': return docs.guardarTema(p.tema);
    case 'borrarTema': return docs.borrarTema(p.temaId);
    case 'borradoresViejos': return docs.borradoresViejos();
    case 'importarBorrador': return docs.importarBorrador(p.draftId);
    default: {
      const nunca: never = p;
      return Promise.resolve(docs.falla(`Acción desconocida: ${String((nunca as { accion?: unknown }).accion)}`));
    }
  }
}

export async function POST(req: NextRequest) {
  const cerrada = await puerta();
  if (cerrada) return cerrada;

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const accion = body && typeof body === 'object' ? (body as { accion?: unknown }).accion : undefined;
  if (!esAccion(accion)) return Response.json({ ok: false, error: 'Acción desconocida' }, { status: 400 });

  // Los parámetros los valida cada operación (ids, versiones, textos): el tipo de `PedidoDocs` es lo
  // que la pantalla PROMETE mandar, no lo que llega.
  try {
    const r = await ejecutar(body as PedidoDocs);
    if (r.ok) return Response.json(r);
    const { status, ...cuerpo } = r;
    if (status >= 500) console.error(`[api:landing-generator ${accion}] ${cuerpo.error}`);
    return Response.json(cuerpo, { status });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[api:landing-generator ${accion}] ${error}`);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
