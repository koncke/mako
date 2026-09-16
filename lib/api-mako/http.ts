// =============================================================================
// api-mako/http — lo que comparten las rutas de app/api/v1: auth, contexto, respuesta
// =============================================================================
// Todas las rutas de /api/v1 se autentican con el bearer del agente
// (`Authorization: Bearer mkoag_…`, lib/agente-token.ts) y NO leen la cookie de
// sesión ni el header interno del workspace: el `ws` sale SOLO del token. Por eso
// pueden estar en `PUBLICOS` (lib/rutas-publicas.ts) como prefijo sin abrir un
// CSRF —el navegador nunca manda ese header solo—.
//
// ⚠️ `wsDeHeaders` es la única puerta y mira UN solo header. Está separada y sin
// lógica de Next para que un test la ejercite con una cookie y un `x-mako-ws`
// puestos y compruebe que sin bearer devuelve null.
//
// ⚠️ Si una ruta de acá NO está en `PUBLICOS`, el middleware la corta con «no
// autenticado» antes de que nadie mire el bearer, y en local no se nota.
// =============================================================================

import 'server-only';
import { NextResponse } from 'next/server';
import { bearerDe, wsPorAgenteToken } from '@/lib/agente-token';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { alcanceDeToken } from './alcance';
import { canalKeyDe } from './canal';
import type { Ctx, Formato, Resultado } from './tipos';

/** Pedidos por minuto. Best-effort (memoria por instancia): corta un bucle
 *  descontrolado de un agente o un escaneo de tokens, no un ataque distribuido. */
const TOPE_POR_MINUTO_WS = 120;
const TOPE_POR_MINUTO_IP = 240;

/** Tope del cuerpo ANTES de parsear. Vercel corta en 4,5 MB; 256 KB alcanza para
 *  un lote de 200 leads con holgura y no para un transcript entero. */
export const TOPE_CUERPO_BYTES = 256 * 1024;

export type Autenticado = { ctx: Ctx };

/** El workspace de un pedido, mirando SOLO `authorization`. `null` = no autorizado. */
export async function wsDeHeaders(h: Headers, resolver: (token: string) => Promise<number | null> = wsPorAgenteToken): Promise<{ ws: number; token: string } | null> {
  const token = bearerDe({ headers: h } as Request);
  if (!token) return null;
  const ws = await resolver(token);
  return ws == null ? null : { ws, token };
}

/** Resuelve el contexto del bearer, o la respuesta 401/429 lista para devolver. */
export async function autenticar(req: Request): Promise<Autenticado | NextResponse> {
  // Por IP ANTES de tocar la base: un escaneo de tokens inválidos no puede costar
  // dos lecturas por intento.
  if (!rateLimit(`api-v1:ip:${clientIp(req)}`, TOPE_POR_MINUTO_IP, 60_000)) {
    return NextResponse.json({ ok: false, error: 'demasiados pedidos; espera un minuto' }, { status: 429 });
  }
  const auth = await wsDeHeaders(req.headers);
  if (!auth) return NextResponse.json({ ok: false, error: 'token inválido o revocado' }, { status: 401 });
  // Por workspace, nunca por el token: un secreto no es una clave de un Map.
  if (!rateLimit(`api-v1:ws:${auth.ws}`, TOPE_POR_MINUTO_WS, 60_000)) {
    return NextResponse.json({ ok: false, error: `más de ${TOPE_POR_MINUTO_WS} pedidos por minuto; espera un poco` }, { status: 429 });
  }
  return {
    ctx: {
      ws: auth.ws, canal: 'http', canalKey: canalKeyDe('http', auth.ws),
      alcance: alcanceDeToken(auth.token),
      // Solo el admin del workspace acuña el token (app/api/agente/token/route.ts).
      rol: 'admin',
    },
  };
}

export const esRespuesta = (x: unknown): x is NextResponse => x instanceof NextResponse;

const CONTENT_TYPE: Record<string, string> = {
  json: 'application/json; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  texto: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
};

/** De un `Resultado` a la respuesta HTTP. Las lecturas salen en su formato nativo. */
export function responder(r: Resultado): NextResponse {
  if (!r.ok) {
    const cuerpo: Record<string, unknown> = { ok: false, error: r.error };
    if (r.faltan) cuerpo.faltan = r.faltan;
    if (r.disponibles) cuerpo.disponibles = r.disponibles;
    return NextResponse.json(cuerpo, { status: r.status });
  }
  if (r.tipo === 'lectura') {
    const formato: Formato | 'markdown' | 'texto' = r.formato ?? r.salida;
    if (formato === 'json') {
      try { return NextResponse.json({ ok: true, resultado: JSON.parse(r.resultado) }); }
      catch { return NextResponse.json({ ok: true, formato: 'texto', resultado: r.resultado }); }
    }
    return new NextResponse(r.resultado, {
      status: 200,
      headers: { 'Content-Type': CONTENT_TYPE[formato] ?? CONTENT_TYPE.texto, 'Cache-Control': 'no-store', ...(r.headers ?? {}) },
    });
  }
  if (r.tipo === 'control') {
    try { return NextResponse.json({ ok: true, resultado: JSON.parse(r.resultado) }); }
    catch { return NextResponse.json({ ok: true, resultado: r.resultado }); }
  }
  if (r.tipo === 'pendiente') {
    return NextResponse.json({
      ok: true, pendiente: r.pendiente,
      mensaje: 'Todavía no se hizo nada. La persona la confirma en MaKo (bandeja de pendientes) o por WhatsApp; con un token de alcance «ejecutar», POST /api/v1/mako/confirmar_accion con el id.',
    });
  }
  return NextResponse.json({
    ok: true, propuesta: r.propuesta.id, nueva: r.propuesta.nueva, url: r.propuesta.url, ...(r.propuesta.extra ?? {}),
    mensaje: r.propuesta.nueva
      ? 'Quedó para confirmar. Pásale el link ENTERO a la persona: entra en MaKo recién cuando lo confirma ahí.'
      : 'Ya había una propuesta pendiente igual y es el mismo link; no se creó otra.',
  });
}

/** El body JSON de un POST, o `{}` si no vino. Un JSON roto es un 400 del que llama. */
export async function bodyJson(req: Request): Promise<Record<string, unknown> | NextResponse> {
  const largo = Number(req.headers.get('content-length') ?? 0);
  if (largo > TOPE_CUERPO_BYTES) return NextResponse.json({ ok: false, error: `cuerpo demasiado grande (tope ${TOPE_CUERPO_BYTES} bytes)` }, { status: 413 });
  const texto = await req.text();
  if (texto.length > TOPE_CUERPO_BYTES) return NextResponse.json({ ok: false, error: `cuerpo demasiado grande (tope ${TOPE_CUERPO_BYTES} bytes)` }, { status: 413 });
  if (!texto.trim()) return {};
  try {
    const j = JSON.parse(texto);
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : NextResponse.json({ ok: false, error: 'el cuerpo tiene que ser un objeto JSON' }, { status: 400 });
  } catch { return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
}
