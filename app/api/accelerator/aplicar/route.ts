// =============================================================================
// POST /api/accelerator/aplicar — la aplicación a MaKo Accelerator (16/11/2026)
// =============================================================================
// Lo postea el formulario de /accelerator/aplicar (app/accelerator/aplicar/FormularioAplicacion.tsx): `{ respuestas, web, origen }`.
// Las respuestas se vuelven a validar TODAS acá (`leerAplicacion`, lib/aplicacion-accelerator.ts: el navegador no manda nada que
// se crea), y se guardan con `aplicarAlAccelerator` (lib/aplicacion-accelerator-servidor.ts): el lead en el CRM de MaKo, su
// historial, «Quieren entrar» y el correo a Martín. Contesta `{ ok: true, califica }`: con `califica`, el formulario abre la
// agenda de Martín ahí mismo; si no, «la leo personalmente».
//
// ⚠️ PÚBLICA Y DE ESCRITURA: va EXACTA en PUBLICOS y PUBLICOS_ESCRITURA (lib/rutas-publicas.ts). NO LEE LA COOKIE DE SESIÓN
//    (quien aplica no tiene cuenta): el workspace es el de la plataforma, siempre. Como el early-return del proxy saltea el
//    chequeo de Origin, acá se mira a mano y en positivo: sólo desde un host de MaKo (`origenDelPago`, como /api/planes/comprar).
// ⚠️ CADA ENVÍO DEJA UN LEAD Y UN CORREO: topes por IP y por email (lib/limite-publico.ts), un tope al tamaño del cuerpo ANTES de
//    leerlo (lo que dice que mide) y después (lo que midió), y el campo trampa: un bot recibe el mismo «ok» que una persona que
//    no califica, y no se guarda nada.
// =============================================================================

import type { NextRequest } from 'next/server';
import { APP_BASE_URL } from '@/lib/app-url';
import { limitePorClave, limitePorIp } from '@/lib/limite-publico';
import { origenDelPago } from '@/lib/editor-landing/pago-pedido';
import { origenLimpio } from '@/lib/compra-plan-reglas';
import { leerAplicacion } from '@/lib/aplicacion-accelerator';
import { aplicarAlAccelerator } from '@/lib/aplicacion-accelerator-servidor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const HORA = 3600_000;
/** El cuerpo más grande que se lee: 26 campos, cinco de hasta 2.000 caracteres (con tildes y emojis, unos 40 KB en el peor caso). */
const TOPE_BYTES = 64 * 1024;
const MUY_LARGA = 'Tu aplicación es demasiado larga. Acórtala un poco y vuelve a enviarla.';

export async function POST(req: NextRequest) {
  const desde = origenDelPago(req.headers.get('origin'), { appBaseUrl: APP_BASE_URL, propio: req.nextUrl.origin });
  if (!desde || desde.tipo !== 'mako') return Response.json({ error: 'Origen no permitido.' }, { status: 403 });
  // Generoso: detrás del NAT de un operador móvil mucha gente comparte la IP, y una aplicación frenada es un cliente perdido.
  const porIp = limitePorIp(req, 'accelerator-aplicar:ip', 10, HORA);
  if (porIp) return porIp;

  if (Number(req.headers.get('content-length') ?? 0) > TOPE_BYTES) return Response.json({ error: MUY_LARGA }, { status: 413 });
  let crudo: string;
  try { crudo = await req.text(); } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }
  if (crudo.length > TOPE_BYTES) return Response.json({ error: MUY_LARGA }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(crudo); } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }

  const leido = leerAplicacion(body);
  // El campo trampa: lo mismo que ve quien no califica, para que el bot no aprenda nada, y no se guarda nada.
  if (!leido.ok) return leido.bot ? Response.json({ ok: true, califica: false }) : Response.json({ error: leido.error, campo: leido.campo }, { status: 400 });
  const aplicacion = leido.aplicacion;
  const porEmail = limitePorClave('accelerator-aplicar:email', aplicacion.email, 4, HORA);
  if (porEmail) return porEmail;

  const origen = origenLimpio(body && typeof body === 'object' ? (body as Record<string, unknown>).origen : null);
  const r = await aplicarAlAccelerator(aplicacion, origen);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ ok: true, califica: r.califica });
}
