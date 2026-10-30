// =============================================================================
// POST /api/operaciones/cartero — la única puerta del cartero de la PC de Martín
// =============================================================================
// El cartero (scripts/operaciones/cartero.mjs) no tiene sesión de MaKo: se autentica con SU token
// (`mkop_…`, acuñado en /admin/operaciones y guardado por hash). Por eso esta ruta está en
// `PUBLICOS` (lib/rutas-publicas.ts) y **no mira la cookie de sesión para nada**: se hace cargo de
// su propia auth, como el puente de Flow.
//
// Es UNA llamada por vuelta: el cartero sube lo que ve (chats vivos, claves que acepta), los
// acuses y cierres de la vuelta anterior, y se lleva lo que puede entregar ahora.
//
// ⚠️ QUÉ PUEDE HACER QUIEN ROBE ESTE TOKEN: leer los pedidos que estén por entregarse y marcar
// estados. NO puede hacer que la PC ejecute nada: el cartero sólo entrega pedidos firmados con una
// clave que vive en el navegador de Martín, y la verifica él (docs/diseno-centro-de-operaciones.md
// §3.1). Por eso el token alcanza como credencial de esta ruta.
// Y con el Plan (`?plan=1`, cartero 1.15.7): LEER las abiertas del proyecto del jefe al que Martín le mandó un pedido
// firmado de menos de un día (lib/centro-plan-chat.ts). Nada más: un chat no cierra tareas.
// Y escribir la foto de los pasos en vivo de una cuenta (`?pasos=1`, 1.15.3): texto corto que se ve en el Ops Center.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { cicloCartero, hayParaElCartero, servicioListoEnMako, tokenDelCarteroValido } from '@/lib/operaciones';
import { adjuntoParaElCartero, firmarAdjuntoDeTurno, urlParaElCartero } from '@/lib/operaciones-adjuntos';
import { guardarPasos } from '@/lib/centro-pasos-db';
import { planDesdeElChat } from '@/lib/centro-plan-chat';
import { CUENTA_RE } from '@/lib/operaciones-reglas';
import { retirarPregunta } from '@/lib/centro-preguntas-chat-db';

export const dynamic = 'force-dynamic';
/** La vuelta contesta en segundos; lo que sigue (el Plan de los chats, lib/centro-plan-auto.ts) corre en `after()`, y cada
 *  paso del Perro tarda hasta un minuto. */
export const maxDuration = 300;

const tokenDe = (req: NextRequest) => {
  const auth = req.headers.get('authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
};

/**
 * GET ?pedido=<id>&adjunto=<ref> — los bytes de un adjunto (cartero 1.9.0, 17/10/2026). Sólo de un trabajo `tomado` cuyo
 * texto firmado lo nombra (lib/operaciones-adjuntos.ts). La PC compara lo que baja con el sha256 firmado: esto no decide
 * qué se acepta allá.
 */
export async function GET(req: NextRequest) {
  const token = tokenDe(req);
  if (!token) return NextResponse.json({ error: 'falta el token del cartero' }, { status: 401 });
  try {
    if (!(await tokenDelCarteroValido(token))) return NextResponse.json({ error: 'token del cartero inválido' }, { status: 401 });
    const q = req.nextUrl.searchParams;
    // ?servicio-listo=1 (cartero 1.26.1): `instalar-servicio` pregunta si la migración y este deploy ya están. Un servidor de antes contesta 404, abajo.
    if (q.has('servicio-listo')) return NextResponse.json({ servicio: await servicioListoEnMako() }, { headers: { 'cache-control': 'no-store' } });
    // ?hay=<cuentas>&abre=<cuentas> (cartero 1.12.0, `vigilar`): ¿hay algo para entregar? SÓLO un número, sin escribir.
    if (q.has('hay')) {
      const lista = (k: string) => (q.get(k) ?? '').split(',').map((c) => c.trim()).filter(Boolean);
      const hay = await hayParaElCartero(lista('hay'), lista('abre'));
      return NextResponse.json({ hay }, { headers: { 'cache-control': 'no-store' } });
    }
    // &firmada=1 (cartero 1.16.0, 18/10/2026): una URL firmada de 5 minutos para bajarlo directo del storage. Un archivo
    // de más de ~4,5 MB no pasa por esta ruta (Vercel lo corta). Las MISMAS condiciones que los bytes.
    if (q.get('firmada') === '1') {
      const url = await urlParaElCartero(q.get('pedido') ?? '', q.get('adjunto') ?? '');
      if (!url) return NextResponse.json({ error: 'no hay ese adjunto para entregar' }, { status: 404 });
      return NextResponse.json({ url }, { headers: { 'cache-control': 'no-store' } });
    }
    const b = await adjuntoParaElCartero(q.get('pedido') ?? '', q.get('adjunto') ?? '');
    if (!b) return NextResponse.json({ error: 'no hay ese adjunto para entregar' }, { status: 404 });
    return new NextResponse(new Uint8Array(b), {
      headers: { 'content-type': 'application/octet-stream', 'content-length': String(b.length), 'cache-control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const token = tokenDe(req);
  if (!token) return NextResponse.json({ error: 'falta el token del cartero' }, { status: 401 });

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'el cuerpo no es JSON' }, { status: 400 });
  }

  try {
    // ?pasos=1 (cartero 1.15.3, la E): lo que están haciendo AHORA los chats ocupados de una cuenta, cada ~15 s desde
    // `vigilar`. Liviano: sólo pisa la foto de esa cuenta (lib/centro-pasos-db.ts), con el token del cartero.
    if (req.nextUrl.searchParams.has('pasos')) {
      if (!(await tokenDelCarteroValido(token))) return NextResponse.json({ error: 'token del cartero inválido' }, { status: 401 });
      const o = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as Record<string, unknown>;
      if (typeof o.cuenta !== 'string' || !CUENTA_RE.test(o.cuenta)) return NextResponse.json({ error: 'falta la cuenta' }, { status: 400 });
      const chats = await guardarPasos(o.cuenta, o.pasos);
      return NextResponse.json({ ok: true, chats });
    }
    // ?plan=1 (cartero 1.15.7): «tráeme las más prioritarias», de sólo lectura y atado a un pedido firmado de Martín.
    // Lo que puede y lo que no, en lib/centro-plan-chat.ts (⚠️ revisión de seguridad).
    if (req.nextUrl.searchParams.has('plan')) {
      if (!(await tokenDelCarteroValido(token))) return NextResponse.json({ error: 'token del cartero inválido' }, { status: 401 });
      const r = await planDesdeElChat(cuerpo);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    // ?adjunto-turno=1 (cartero 1.17.0, 20/10/2026): la URL firmada para subir lo que Martín adjuntó en la app de Claude
    // (lib/operaciones-adjuntos.ts → firmarAdjuntoDeTurno). Con el token del cartero; el archivo no pasa por acá.
    if (req.nextUrl.searchParams.has('adjunto-turno')) {
      if (!(await tokenDelCarteroValido(token))) return NextResponse.json({ error: 'token del cartero inválido' }, { status: 401 });
      const r = await firmarAdjuntoDeTurno(cuerpo);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    // ?retirar-pregunta=1 (cartero 1.17.4, 21/10/2026): el chat que hizo una pregunta dice que ya no hace falta
    // (`cartero.mjs retirar <id>`). Sólo en el chat que se nombra, con el token del cartero (lib/centro-preguntas-chat-db.ts).
    if (req.nextUrl.searchParams.has('retirar-pregunta')) {
      if (!(await tokenDelCarteroValido(token))) return NextResponse.json({ error: 'token del cartero inválido' }, { status: 401 });
      const o = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as Record<string, unknown>;
      const r = await retirarPregunta(typeof o.local === 'string' ? o.local : '', typeof o.id === 'string' ? o.id : '');
      return NextResponse.json(r, { status: r.ok ? 200 : 404 });
    }
    const salida = await cicloCartero(token, cuerpo);
    if (!salida) return NextResponse.json({ error: 'token del cartero inválido' }, { status: 401 });
    return NextResponse.json(salida);
  } catch (e) {
    // Lo que falla acá es la base: el cartero reintenta en la vuelta siguiente sin perder nada
    // (lo que reclamó lo tiene anotado él).
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 503 });
  }
}
