// =============================================================================
// /api/grupos/[ws]/miembros — quién está en el grupo, invitar y sacar (3/11/2026)
// =============================================================================
// GET: los participantes. POST { email }: invitar. DELETE { email }: sacar a un invitado; { salir: true }: salirse.
//
// ⚠️ NO SE PUEDE AVERIGUAR QUIÉN USA MaKo. Invitar es por email EXACTO, nunca un buscador. Con cuenta o sin ella, la respuesta es la misma. En Participantes, un invitado sale como su email hasta
// que abre el grupo, y recién ahí con su nombre. Los emails son sólo de quien administra: a un invitado no le llega ninguno.
// A quien no le toca, 404, siempre el mismo.

import { NextResponse, type NextRequest } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { equipoDe } from '@/lib/usuarios';
import { accesoAlGrupo, miembrosDelGrupo } from '@/lib/grupo-puerta';
import { invitarAlGrupo, sacarDelGrupo, salirDelGrupo } from '@/lib/grupo-app';
import { FRASE_AL_INVITAR, TOPE_INVITADOS, autorDePersona } from '@/lib/grupo-reglas';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ ws: string }> };
const NO_EXISTE = () => NextResponse.json({ ok: false, error: 'No existe.' }, { status: 404 });
const wsDe = (v: string): number | null => (/^\d{1,15}$/.test(v) ? Number(v) : null);

export async function GET(_req: NextRequest, { params }: Ctx) {
  const ws = wsDe((await params).ws);
  const quien = ws == null ? null : await accesoAlGrupo(ws);
  if (ws == null || !quien) return NO_EXISTE();
  const m = await miembrosDelGrupo(ws);
  const administra = quien.administra;
  const participantes = m.conCuenta.map((p) => ({
    // Hasta que abre, nadie sabe su nombre: decirlo revelaría que esa cuenta existe.
    nombre: p.tipo === 'invitado' && !p.abrio ? (administra ? p.email : 'Invitado') : autorDePersona(p.nombre, administra ? p.email : 'Alguien'),
    tipo: p.tipo, propio: p.usuarioId === quien.usuarioId,
    ...(administra ? { email: p.email } : {}),
    ...(p.tipo === 'invitado' ? {} : { porQue: p.tipo === 'agencia' ? 'Administra su agencia' : 'Administra el negocio' }),
    ...(p.fotoUrl && (p.tipo !== 'invitado' || p.abrio) ? { fotoUrl: p.fotoUrl } : {}),
  }));
  const sinCuenta = m.invitadosSinCuenta.map((email) => ({ nombre: administra ? email : 'Invitado', tipo: 'invitado' as const, propio: false, ...(administra ? { email } : {}) }));
  // Sugeridos: SÓLO closer y setter de este negocio, que entran invitados con un toque. Nunca una lista de otros negocios.
  let sugeridos: Array<{ nombre: string; email: string }> = [];
  if (administra) {
    const adentro = new Set(m.conCuenta.map((p) => p.email));
    const equipo = await equipoDe(ws).catch(() => []);
    sugeridos = equipo.filter((u) => (u.rol_ws === 'closer' || u.rol_ws === 'setter') && u.estado !== 'suspendido' && !adentro.has(String(u.email).toLowerCase()))
      .map((u) => ({ nombre: autorDePersona(u.nombre, u.email), email: String(u.email).toLowerCase() }));
  }
  return NextResponse.json({ ok: true, participantes: [...participantes, ...sinCuenta], administra, invitado: quien.invitado, sugeridos, frase: FRASE_AL_INVITAR, topeInvitados: TOPE_INVITADOS });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const ws = wsDe((await params).ws);
  const quien = ws == null ? null : await accesoAlGrupo(ws);
  // Un invitado nunca invita, aunque administre otro negocio. Y al grupo de la plataforma no entra nadie por invitación.
  if (ws == null || !quien || !quien.administra) return NO_EXISTE();
  if (!rateLimit(`grupo:invitar:${quien.usuarioId}`, 30, 3600_000)) return NextResponse.json({ ok: false, error: 'Son muchas invitaciones seguidas: prueba en un rato.' }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const r = await invitarAlGrupo(ws, String(b?.email ?? ''), { usuarioId: quien.usuarioId, nombre: quien.nombre });
  return r.ok ? NextResponse.json({ ok: true, frase: FRASE_AL_INVITAR }) : NextResponse.json({ ok: false, error: r.error }, { status: r.status });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ws = wsDe((await params).ws);
  const quien = ws == null ? null : await accesoAlGrupo(ws);
  if (ws == null || !quien) return NO_EXISTE();
  const b = (await req.json().catch(() => null)) as { email?: unknown; salir?: unknown } | null;
  if (b?.salir === true) {
    // Sólo se sale quien entró por invitación: quien entra por su rol no tiene de dónde salir.
    if (!quien.invitado) return NextResponse.json({ ok: false, error: 'Entras por administrar: no te puedes salir.' }, { status: 409 });
    const r = await salirDelGrupo(ws, quien);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  }
  if (!quien.administra) return NO_EXISTE();
  const r = await sacarDelGrupo(ws, String(b?.email ?? ''), { nombre: quien.nombre });
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ ok: false, error: r.error }, { status: r.status });
}
