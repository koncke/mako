// =============================================================================
// /api/competitor-spy/perfil — completar UNA fila del buscador del alta (3/11/2026)
// =============================================================================
// GET ?usuario=<@> → { ok, perfil: { usuario, nombre, foto, seguidores, bio, web } | null, limite }
//
// La búsqueda de Instagram trae casi sólo arrobas: con «leila hormozi», 4 filas y ninguna foto (medido en
// producción el 3/11/2026). La pantalla pide esto para las primeras filas (`cualesCompletar`,
// lib/spy-alta-reglas.ts), y el mismo perfil le sirve después a la confirmación sin volver a pagarlo.
//
// ⚠️ ES UNA RUTA Y NO UNA SERVER ACTION, A PROPÓSITO. Next pone en FILA las actions de una misma pantalla: cinco
// lecturas de ~10 s en curso habrían dejado esperando el «Sí, agregar» de la persona, sin que nada lo explique.
// Un `fetch` no hace fila, y se puede cancelar.
//
// ⚠️ NO PUEDE AGOTAR EL TOPE DEL DÍA: va con `RESERVA_DEL_ALTA`. Nadie pidió estas lecturas con un clic, así que
// las últimas del día quedan para agregar a alguien. `limite: true` = ya no hay margen; la pantalla deja de pedir.
//
// Nunca escribe nada: lo que se ofrece es un candidato, y sólo el «sí» de la persona guarda.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo } from '@/lib/workspace';
import { usuarioDeTexto } from '@/lib/instagram-buscar';
import { leerPerfilParaElAlta } from '@/lib/spy';
import { RESERVA_DEL_ALTA } from '@/lib/spy-alta-reglas';

export const dynamic = 'force-dynamic';
/** Lo que puede tardar la lectura de Apify (`TOPE_APIFY_MS`, lib/instagram-perfil-server.ts). */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const s = await getUsuarioActual();
  if (!s || !(await getRolWsEfectivo())) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  const usuario = usuarioDeTexto(req.nextUrl.searchParams.get('usuario') ?? '');
  if (!usuario) return Response.json({ ok: true, perfil: null, limite: false });
  const l = await leerPerfilParaElAlta(usuario, { reserva: RESERVA_DEL_ALTA });
  if (!l.ok) return Response.json({ ok: true, perfil: null, limite: l.motivo === 'limite' });
  const { nombre, foto, seguidores, bio, web } = l.perfil;
  return Response.json({
    ok: true, limite: false,
    perfil: { usuario, nombre, foto, seguidores, bio: bio ? bio.slice(0, 220) : null, web },
  });
}
