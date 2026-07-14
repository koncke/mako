// =============================================================================
// SOLO-DEV: setear la foto de un grupo de WhatsApp (Evolution) desde el navegador
// =============================================================================
// El navegador (autenticado) rinde el logo a base64 y lo POSTea acá same-origin;
// esta ruta lo reenvía a Evolution server-side (sin exponer EVOLUTION_API_KEY al
// browser ni depender de CORS). INERTE en cualquier deploy (404 en prod/Vercel).
// POST { groupJid, image (data URL o base64), instance? }

import { NextResponse, type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

function habilitado(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') return false;
  return true;
}

export async function POST(req: NextRequest) {
  if (!habilitado()) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  const BASE = (process.env.EVOLUTION_BASE_URL || '').replace(/\/$/, '');
  const KEY = process.env.EVOLUTION_API_KEY || '';
  if (!BASE || !KEY) return NextResponse.json({ ok: false, error: 'EVOLUTION no configurado' }, { status: 500 });

  let body: { groupJid?: string; image?: string; instance?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const { groupJid, image, instance = 'mako_ws1' } = body;
  if (!groupJid || !image) return NextResponse.json({ ok: false, error: 'faltan groupJid o image' }, { status: 400 });

  const r = await fetch(`${BASE}/group/updateGroupPicture/${encodeURIComponent(instance)}?groupJid=${encodeURIComponent(groupJid)}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  });
  const txt = await r.text();
  return NextResponse.json({ ok: r.ok, status: r.status, evolution: txt.slice(0, 400) });
}
