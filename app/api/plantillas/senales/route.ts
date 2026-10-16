// GET /api/plantillas/senales → { ok, senales } — lo que se sabe del negocio para que una galería de plantillas ponga
// primero las que le sirven, con un «Sugerido» sutil (Martín, 16/10/2026; lib/plantillas-sugeridas.ts).
//
// Es para las galerías que viven en el navegador y no tienen una página del server que se las pase (la de Automations
// se abre en un modal). La galería ordena con `ordenarConSugeridas` y su tabla de etiquetas: docs/plantillas-sugeridas.md.
//
// QUIÉN: cualquiera del negocio con sesión (las galerías son de quien crea). Lo que sale son ids de catálogo —el canal,
// las entradas, cómo cobra y el cuello de botella—, ni un nombre ni un número del negocio. Sin IA: lo guardado.

import { NextResponse } from 'next/server';
import { getRolWsEfectivo } from '@/lib/workspace';
import { senalesDelNegocio } from '@/lib/plantillas-sugeridas-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  if ((await getRolWsEfectivo()) == null) return NextResponse.json({ ok: false, error: 'no autenticado' }, { status: 401 });
  return NextResponse.json({ ok: true, senales: await senalesDelNegocio().catch(() => null) });
}
