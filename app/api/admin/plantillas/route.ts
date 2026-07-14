// =============================================================================
// /api/admin/plantillas — editar el texto de una plantilla de aviso (override)
// =============================================================================
// Solo admin. El override se guarda en app_settings (mako.plantilla.<id>) del
// dueño y lo usa emitirDelCatalogo como texto por defecto. GET ?id → texto
// efectivo. POST { id, texto } guarda; POST { id, reset:true } vuelve al ejemplo.

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import { runWithWorkspace, OWNER_WS } from '@/lib/workspace';
import { getSetting, setSetting } from '@/lib/settings';
import { KEY_PLANTILLA, textoPlantilla, avisoDelCatalogo } from '@/lib/avisos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!avisoDelCatalogo(id)) return NextResponse.json({ ok: false, error: 'plantilla no existe' }, { status: 404 });
  const override = await runWithWorkspace(OWNER_WS, () => getSetting(KEY_PLANTILLA(id)));
  return NextResponse.json({ ok: true, texto: await textoPlantilla(id), esOverride: !!(override && override.trim()) });
}

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let b: { id?: string; texto?: string; reset?: boolean };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const id = (b.id || '').trim();
  if (!avisoDelCatalogo(id)) return NextResponse.json({ ok: false, error: 'plantilla no existe' }, { status: 404 });
  await runWithWorkspace(OWNER_WS, () => setSetting(KEY_PLANTILLA(id), b.reset ? '' : (b.texto ?? '')));
  return NextResponse.json({ ok: true, texto: await textoPlantilla(id) });
}
