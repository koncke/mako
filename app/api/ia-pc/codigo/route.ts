// =============================================================================
// POST /api/ia-pc/codigo { acepto: <versión> } — una persona pide el código para emparejar SU computadora
// GET  /api/ia-pc/codigo?codigo=XXXXXXXX     — cómo quedó ese código (para el tutorial)
// =============================================================================
// PRIVADA (con sesión, no está en lib/rutas-publicas.ts). El código ata la PC a ESTE negocio y a ESTA persona: sólo sus
// turnos van a su Claude, porque la cuenta es suya y compartirla está prohibido (docs/ia-del-cliente.md §10). Y sólo
// después de aceptar con un toque TEXTO_CONSENTIMIENTO, en su versión de hoy (el Cerebro, 21/10/2026; mig 0321).
// Con tope por persona: cada código nuevo anula el anterior, y nadie pide cien.
//
// `duraMs` en vez de sólo `venceAt`: el tutorial cuenta desde que le llegó, con SU reloj. Comparar la hora del servidor
// con el reloj de una PC adelantada hacía nacer «vencido» cada código (segunda revisión, 21/10/2026).
// El GET dice si el código se gastó sin conectar (la persona dijo que no, o cerró la ventana): sin eso, el tutorial
// seguía «Esperando…» con una línea que ya no servía.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { personaDelRequest } from '@/lib/mako-turno-app';
import { getUsuarioActual } from '@/lib/auth';
import { crearCodigo, estadoDelCodigo } from '@/lib/ia-pc';
import { CODIGO_MS, iaDelConsentimiento } from '@/lib/ia-pc-reglas';
import { CHATGPT_EN_LA_PC } from '@/lib/conectar-ia-reglas';
import { limitePorClave } from '@/lib/limite-publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  // La cuenta de revisión de las tiendas no conecta una computadora (4/11/2026): el token de la PC no se entera de que la contraseña
  // rotó, así que quien la tuvo una vez seguiría adentro. El proxy ya lo corta (lib/cuenta-revision-reglas.ts); esto es por si cambia.
  if ((await getUsuarioActual())?.mfa === 'revision') return NextResponse.json({ ok: false, error: 'La cuenta de demostración no puede conectar una computadora.' }, { status: 403 });
  const persona = await personaDelRequest();
  if ('error' in persona) return NextResponse.json({ ok: false, error: persona.error }, { status: persona.status });
  const frenado = limitePorClave('ia-pc-codigo', `${persona.ws}:${persona.actor}`, 10, 10 * 60_000);
  if (frenado) return frenado;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* abajo: sin aceptar no hay código */ }
  // La versión que aceptó dice también con qué IA (la ola 3: `CONSENTIMIENTO_DE`). Su ChatGPT, recién con el programa que lo corre.
  const ia = iaDelConsentimiento(body?.acepto);
  if (!ia) return NextResponse.json({ ok: false, error: 'Primero acepta cómo funciona.' }, { status: 400 });
  if (ia === 'chatgpt' && !CHATGPT_EN_LA_PC) return NextResponse.json({ ok: false, error: 'Tu ChatGPT en tu computadora todavía no está: por ahora, con su clave.' }, { status: 400 });
  const r = await crearCodigo(persona.ws, persona.actor, String(body.acepto)).catch((e) => {
    console.error('[ia-pc/codigo]', e instanceof Error ? e.message : String(e));
    return null;
  });
  if (!r) return NextResponse.json({ ok: false, error: 'No pude crear el código. Intenta de nuevo.' }, { status: 500 });
  return NextResponse.json({ ok: true, codigo: r.codigo, venceAt: r.venceAt, duraMs: CODIGO_MS }, { headers: { 'cache-control': 'no-store' } });
}

export async function GET(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return NextResponse.json({ ok: false, error: persona.error }, { status: persona.status });
  const frenado = limitePorClave('ia-pc-codigo-estado', `${persona.ws}:${persona.actor}`, 60, 60_000);
  if (frenado) return frenado;
  try {
    const estado = await estadoDelCodigo(persona.ws, persona.actor, req.nextUrl.searchParams.get('codigo'));
    return NextResponse.json({ ok: true, estado }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    console.error('[ia-pc/codigo]', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: 'No pude leer el código.' }, { status: 503 });
  }
}
