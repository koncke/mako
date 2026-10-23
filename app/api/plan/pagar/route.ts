// =============================================================================
// /api/plan/pagar — pagar la deuda del plan de MaKo, o reactivarlo (23/10/2026)
// =============================================================================
//   · GET: cómo está el plan del negocio de la sesión (el aviso de la mora en la app, /cuenta-pausada).
//   · POST { accion: 'deuda' | 'reactivar' }: el link para pagar (lib/plan-deuda.ts `pagarDeuda`, lib/compra-plan.ts
//     `reactivarPlan`). Devuelve `{ url }` (la factura de Stripe, el cobro de MaKo o Mercado Pago) o el texto que va.
//
// ⚠️ EL NEGOCIO ES EL PROPIO DE LA SESIÓN (`sesion.ws`), no el del contexto: un negocio PAUSADO no resuelve workspace
// (lib/workspace.ts) y justo ése es el que tiene que poder pagar. Sólo su ADMIN paga; el super admin no (no es su plan).
// Con sesión: el proxy chequea el Origin del POST como en toda ruta de la app.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { avisoDeMora, deudaDe, pagarDeuda } from '@/lib/plan-deuda';
import { reactivarPlan } from '@/lib/compra-plan';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function wsDelAdmin(): Promise<{ ws: number; email: string; nombre: string | null } | null> {
  const s = await getUsuarioActual();
  if (!s || s.legacy || s.rol === 'admin' || s.ws == null) return null;
  if ((s.rolWs ?? 'admin') !== 'admin') return null;
  return { ws: Number(s.ws), email: String(s.email ?? ''), nombre: s.nombre ?? null };
}

export async function GET() {
  const a = await wsDelAdmin();
  if (!a) return Response.json({ mora: null, deuda: null });
  const [mora, d] = await Promise.all([avisoDeMora(a.ws).catch(() => null), deudaDe(a.ws).catch(() => null)]);
  return Response.json({ mora, deuda: d?.deuda ? { monto: d.deuda.monto, moneda: d.deuda.moneda, ciclos: d.deuda.ciclos } : null });
}

export async function POST(req: NextRequest) {
  const a = await wsDelAdmin();
  if (!a) return Response.json({ error: 'Sólo el admin del negocio paga su plan.' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { accion?: string };
  if (body.accion === 'deuda') {
    const r = await pagarDeuda(a.ws, { crear: true });
    if (r.tipo === 'link' && r.url) return Response.json({ url: r.url });
    if (r.tipo === 'tarjeta-mp') return Response.json({ url: r.url, texto: r.texto });
    if (r.tipo === 'reactivar') return Response.json({ reactivar: true });
    return Response.json({ error: r.tipo === 'nada' ? r.texto : 'No pudimos abrir el pago.' }, { status: 409 });
  }
  if (body.accion === 'reactivar') {
    // Con deuda, primero la deuda (Martín: «le tiene que quedar una deuda pendiente»).
    const d = await deudaDe(a.ws).catch(() => null);
    if (d?.deuda) return Response.json({ error: 'Primero paga lo que quedó pendiente.', deuda: true }, { status: 409 });
    if (!a.email) return Response.json({ error: 'Tu sesión no tiene email.' }, { status: 400 });
    const r = await reactivarPlan(a.ws, { email: a.email, nombre: a.nombre });
    return r.ok ? Response.json({ url: r.link }) : Response.json({ error: r.error }, { status: r.status });
  }
  return Response.json({ error: 'Acción inválida.' }, { status: 400 });
}
