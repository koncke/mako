// =============================================================================
// /api/admin/plantillas — CRUD de plantillas de aviso (editar/activar/crear/borrar)
// =============================================================================
// Solo admin. GET → lista completa (catálogo + custom, con enabled). GET ?id →
// una. POST { action }: 'texto' | 'enabled' | 'reset' | 'crear' | 'borrar' |
// 'probar' (genera un ejemplo con IA desde la referencia).

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  listarPlantillas, getPlantilla, setTextoPlantilla, setEnabledPlantilla,
  borrarPlantilla, crearPlantilla, generarMensajeAviso,
} from '@/lib/plantillas';
import type { CategoriaAviso } from '@/lib/avisos-catalogo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (id) { const p = await getPlantilla(id); return p ? NextResponse.json({ ok: true, plantilla: p }) : NextResponse.json({ ok: false, error: 'no existe' }, { status: 404 }); }
  return NextResponse.json({ ok: true, plantillas: await listarPlantillas() });
}

type Body = {
  action?: string; id?: string; texto?: string; enabled?: boolean; contexto?: string;
  titulo?: string; categoria?: CategoriaAviso; requiereRespuesta?: boolean;
};

export async function POST(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  let b: Body;
  try { b = (await req.json()) as Body; } catch { return NextResponse.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  switch (b.action) {
    case 'crear': {
      if (!b.titulo?.trim() || !b.categoria) return NextResponse.json({ ok: false, error: 'faltan título/categoría' }, { status: 400 });
      const p = await crearPlantilla({ titulo: b.titulo, categoria: b.categoria, requiereRespuesta: b.requiereRespuesta, texto: b.texto });
      return NextResponse.json({ ok: true, plantilla: p });
    }
    case 'texto': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); await setTextoPlantilla(b.id, b.texto ?? ''); return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) }); }
    case 'reset': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); await setTextoPlantilla(b.id, ''); return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) }); }
    case 'enabled': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); await setEnabledPlantilla(b.id, b.enabled !== false); return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) }); }
    case 'borrar': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); return NextResponse.json({ ok: true, ...(await borrarPlantilla(b.id)) }); }
    case 'probar': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); return NextResponse.json({ ok: true, texto: await generarMensajeAviso(b.id, b.contexto || 'Usá datos de ejemplo realistas.') }); }
    default: return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  }
}
