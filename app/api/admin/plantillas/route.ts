// =============================================================================
// /api/admin/plantillas — CRUD de plantillas de aviso (editar/activar/crear/borrar)
// =============================================================================
// Solo admin. GET → lista completa (catálogo + custom, con enabled). GET ?id →
// una. POST { action }: 'texto' | 'enabled' | 'reset' | 'crear' | 'borrar' |
// 'probar' (genera un ejemplo con IA desde la referencia).

import { NextResponse, type NextRequest } from 'next/server';
import { getSesionAdmin } from '@/lib/auth';
import {
  listarPlantillas, getPlantilla, setTextoPlantilla, setEnabledPlantilla, setCanalesPlantilla, setFrecuenciaPlantilla,
  borrarPlantilla, crearPlantilla, generarMensajeAviso, getFlujo, setFlujo,
} from '@/lib/plantillas';
import type { CategoriaAviso } from '@/lib/avisos-catalogo';
import { esFlujoValido } from '@/lib/flujos-tipos';
import { sanearFrecuencia } from '@/lib/disparador-mensaje';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!(await getSesionAdmin())) return NextResponse.json({ ok: false, error: 'solo admin' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (id) { const p = await getPlantilla(id); return p ? NextResponse.json({ ok: true, plantilla: p }) : NextResponse.json({ ok: false, error: 'no existe' }, { status: 404 }); }
  return NextResponse.json({ ok: true, plantillas: await listarPlantillas({ vista: 'agencia' }) });
}

type Body = {
  action?: string; id?: string; texto?: string; enabled?: boolean; canales?: { wa?: boolean; email?: boolean }; contexto?: string;
  titulo?: string; categoria?: CategoriaAviso; requiereRespuesta?: boolean; flujo?: unknown;
  frecuenciaMin?: number;
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
    case 'canales': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      const c = (b.canales ?? {}) as { wa?: unknown; email?: unknown };
      await setCanalesPlantilla(b.id, {
        ...(typeof c.wa === 'boolean' ? { wa: c.wa } : {}),
        ...(typeof c.email === 'boolean' ? { email: c.email } : {}),
      });
      return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
    }
    case 'frecuencia': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      await setFrecuenciaPlantilla(b.id, sanearFrecuencia(b.frecuenciaMin));
      return NextResponse.json({ ok: true, plantilla: await getPlantilla(b.id) });
    }
    case 'borrar': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); return NextResponse.json({ ok: true, ...(await borrarPlantilla(b.id)) }); }
    case 'probar': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); return NextResponse.json({ ok: true, texto: await generarMensajeAviso(b.id, b.contexto || 'Usa datos de ejemplo realistas.') }); }
    case 'flujo-get': { if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 }); return NextResponse.json({ ok: true, flujo: await getFlujo(b.id) }); }
    case 'flujo-set': {
      if (!b.id) return NextResponse.json({ ok: false, error: 'falta id' }, { status: 400 });
      const flujo = b.flujo == null ? null : (esFlujoValido(b.flujo) ? b.flujo : null);
      if (b.flujo != null && !flujo) return NextResponse.json({ ok: false, error: 'flujo inválido' }, { status: 400 });
      await setFlujo(b.id, flujo);
      return NextResponse.json({ ok: true, flujo: await getFlujo(b.id) });
    }
    default: return NextResponse.json({ ok: false, error: 'action inválida' }, { status: 400 });
  }
}
