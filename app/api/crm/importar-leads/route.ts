// =============================================================================
// /api/crm/importar-leads — leer el archivo y devolver los contactos detectados
// =============================================================================
// POST multipart { file } → { ok, filas:[…], viaIA, aviso? }
//
// Es un route y no una server action por una razón dura: el body de una server
// action tope en 1 MB, y acá suben PDFs escaneados y fotos de listas de contactos
// de varios megas. Este endpoint SOLO LEE: no crea ningún lead. La creación pasa
// por importarLeadsRevisadosAction, que vuelve a validar todo contra la base.
//
// El contenido del archivo es dato NO confiable: se muestra en una tabla para que
// el usuario lo revise, nunca se ejecuta ni se inserta sin pasar por la validación.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { filasDesdeArchivo, marcarExistentes } from '@/app/crm/importar-server';

export const dynamic = 'force-dynamic';
// 300s: un PDF escaneado va por visión y después por la IA que arma el JSON. Con el
// default de 120 la función muere antes de que la cascada termine de reintentar.
export const maxDuration = 300;

/** 8 MB, el mismo tope que muestra el modal. Arriba de eso ya no es una lista de contactos. */
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const sesion = await getUsuarioActual();
  if (!sesion) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ ok: false, error: 'Falta el archivo.' }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ ok: false, error: 'El archivo pesa más de 8 MB.' }, { status: 400 });

    const { filas, viaIA, aviso, error } = await filasDesdeArchivo(file);
    if (error) return Response.json({ ok: false, error }, { status: 400 });

    // El duplicado se resuelve ACÁ (contra la base, tenant-scoped) y no en el
    // navegador: mandar todos los emails del CRM al cliente para que compare sería
    // filtrar la base entera por una funcionalidad de conveniencia.
    return Response.json({ ok: true, filas: await marcarExistentes(filas), viaIA, aviso });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error(`[api:importar-leads] ${m}`);
    return Response.json({ ok: false, error: `No pude leer el archivo: ${m}` }, { status: 500 });
  }
}
