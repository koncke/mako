// =============================================================================
// /api/admin/mako-canal — los dos WhatsApp del super admin: el de MaKo y el tuyo
// =============================================================================
// Solo admin.
//
// GET ?parte=canal|nuevo|personal → el estado de esa parte (para el sondeo mientras hay un
//   QR en pantalla: sondear las tres cada 3 s son tres sondas de WhatsApp por vuelta). Sin
//   `parte`, las tres juntas.
//
// POST { action }:
//   'conectar'       → el QR de la línea de MaKo (o la recupera si quedó trabada).
//   'usar'           → fija la línea vigente del canal como la voz de MaKo.
//   'desconectar'    → cierra sesión y borra la línea de MaKo (no toca la voz).
//   'nuevo-numero'   → el QR del número NUEVO de MaKo, sin tocar la línea que está hablando.
//   'descartar-nuevo'→ suelta ese número nuevo (se escaneó el teléfono equivocado).
//   'pasar' {forzar} → deja al número nuevo admin en los grupos y muda MaKo a él.
//   'personal'       → el QR de tu número, como línea de tu negocio.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  estadoCanalMaKo, conectarCanalMaKo, usarCanalComoVoz, desconectarCanalMaKo,
  estadoNumeroNuevo, vincularNumeroNuevo, descartarNumeroNuevo, pasarMaKoANumeroNuevo,
  estadoNumeroPersonal, vincularNumeroPersonal,
} from '@/lib/mako-canal';

export const dynamic = 'force-dynamic';
// Recuperar una línea trabada encadena sondeo + logout + reintentos + crear una nueva: puede
// pasar holgado los 15 s. Y la mudanza toca cada grupo con un respiro entre uno y otro (~5 s
// por grupo): con 60 s, cortada a la mitad, quedaban grupos hechos y la voz sin mudar.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const parte = req.nextUrl.searchParams.get('parte');
  if (parte === 'nuevo') return NextResponse.json({ ok: true, nuevo: await estadoNumeroNuevo() });
  if (parte === 'personal') return NextResponse.json({ ok: true, personal: await estadoNumeroPersonal().catch(() => null) });
  if (parte === 'canal') return NextResponse.json({ ok: true, ...(await estadoCanalMaKo()) });
  const [canal, nuevo, personal] = await Promise.all([
    estadoCanalMaKo(), estadoNumeroNuevo(), estadoNumeroPersonal().catch(() => null),
  ]);
  return NextResponse.json({ ok: true, ...canal, nuevo, personal });
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let body: { action?: string; forzar?: boolean };
  try { body = (await req.json()) as typeof body; } catch { body = {}; }

  switch (body.action) {
    case 'conectar': {
      const r = await conectarCanalMaKo();
      return NextResponse.json(r, { status: r.ok ? 200 : 500 });
    }
    case 'usar': {
      await usarCanalComoVoz();
      return NextResponse.json({ ok: true });
    }
    case 'desconectar': {
      return NextResponse.json(await desconectarCanalMaKo());
    }
    case 'nuevo-numero': {
      const r = await vincularNumeroNuevo();
      return NextResponse.json(r, { status: r.ok ? 200 : 500 });
    }
    case 'descartar-nuevo': {
      return NextResponse.json(await descartarNumeroNuevo());
    }
    case 'pasar': {
      return NextResponse.json(await pasarMaKoANumeroNuevo({ forzar: body.forzar === true }));
    }
    case 'personal': {
      const r = await vincularNumeroPersonal().catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
      return NextResponse.json(r, { status: r.ok ? 200 : 500 });
    }
    default:
      return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  }
}
