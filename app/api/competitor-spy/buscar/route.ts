// =============================================================================
// /api/competitor-spy/buscar — la búsqueda de «Mirar a alguien más», por red (4/11/2026)
// =============================================================================
// Una ruta, cinco pedidos chicos, y la pantalla los pide EN PARALELO: cada grupo (Instagram, YouTube) se llena cuando
// llega lo suyo, y lo rápido no espera a lo lento (Martín, 4/11: «tarda en buscar… para que el usuario no crea que
// se trabó»).
//   GET ?fuente=ig&u=<usuario>          → { ok, perfil | null, vacio }     el @ exacto (Apify por @, ~5-10 s)
//   GET ?fuente=google&q=<nombre>       → { ok, instagram[], youtube[], vacio }  Google, una corrida (~6-11 s)
//   GET ?fuente=ig-nombre&q=<nombre>    → { ok, perfiles[], vacio }        el buscador de Instagram (~20 s)
//   GET ?fuente=yt&ref=<UC…|@x|user:x>  → { ok, canal | null }             un canal de YouTube (1 unidad, <1 s)
//   GET ?fuente=completar&u=<a,b,c>     → { ok, perfiles[], vacio }        las primeras filas, en UNA corrida
// `vacio` dice POR QUÉ una lista llegó vacía cuando no es «no había nadie»: 'sin-clave', 'limite' o 'fallo'.
//
// ⚠️ ES UNA RUTA Y NO UNA SERVER ACTION, A PROPÓSITO: Next pone en FILA las actions de una pantalla, y estas lecturas
// tardan segundos. Un `fetch` no hace fila, y se cancela cuando la persona sigue escribiendo.
//
// ⚠️ NUNCA ESCRIBE: lo que devuelve son candidatos, y sólo el «Sí, agregar» guarda. La sesión se mira acá y no sólo en
// el proxy: sin AUTH_SECRET el proxy queda inactivo y `getWorkspaceActual()` sin cookie caería al ws 1, un cliente.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { usuarioDeTexto, MAX_LARGO } from '@/lib/instagram-buscar';
import { buscarEnGoogle, buscarEnInstagram, completarPerfiles, leerCanalHallado, leerExacto } from '@/lib/spy-buscar';
import { PRIMERAS_QUE_SE_COMPLETAN } from '@/lib/spy-buscar-reglas';
import { RESERVA_DEL_ALTA } from '@/lib/spy-alta-reglas';

export const dynamic = 'force-dynamic';
/** El tope de Apify (`TOPE_APIFY_MS`, 60 s) es el más largo de los cinco pedidos. */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const s = await getUsuarioActual();
  const ws = s && (await getRolWsEfectivo()) ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const fuente = sp.get('fuente');
  const q = (sp.get('q') ?? '').trim().slice(0, MAX_LARGO);

  if (fuente === 'ig') {
    const u = usuarioDeTexto(sp.get('u') ?? '');
    if (!u) return Response.json({ ok: true, perfil: null, vacio: null });
    return Response.json({ ok: true, ...(await leerExacto(ws, u)) });
  }
  if (fuente === 'google') {
    if (q.length < 3) return Response.json({ ok: true, instagram: [], youtube: [], vacio: null });
    return Response.json({ ok: true, ...(await buscarEnGoogle(ws, q)) });
  }
  if (fuente === 'ig-nombre') {
    if (q.length < 3) return Response.json({ ok: true, perfiles: [], vacio: null });
    return Response.json({ ok: true, ...(await buscarEnInstagram(ws, q)) });
  }
  if (fuente === 'yt') {
    const l = await leerCanalHallado((sp.get('ref') ?? '').trim().slice(0, 200));
    return Response.json({ ok: true, canal: l.canal, vacioYoutube: l.vacio });
  }
  if (fuente === 'completar') {
    // Sólo usuarios válidos, sin repetidos y no más de los que se completan: el cupo no se gasta por un pedido armado a mano.
    const usuarios = [...new Set((sp.get('u') ?? '').split(',').map((x) => usuarioDeTexto(x)).filter((x): x is string => !!x))].slice(0, PRIMERAS_QUE_SE_COMPLETAN);
    if (!usuarios.length) return Response.json({ ok: true, perfiles: [], vacio: null });
    const r = await completarPerfiles(ws, usuarios, RESERVA_DEL_ALTA);
    return Response.json({ ok: true, perfiles: r.perfiles, vacio: r.limite ? 'limite' : null });
  }
  return Response.json({ ok: false, error: 'Falta qué buscar' }, { status: 400 });
}
