// =============================================================================
// GET /api/ia-pc/estado — lo que ve «Tus cuentas de IA» (docs/ia-del-cliente.md §6, ola 2)
// =============================================================================
// PRIVADA (con sesión). Las computadoras del negocio con su estado y sus cuentas (el admin ve todas; los demás, las
// suyas), y el modelo que eligió el negocio. Nunca un secreto: las cuentas ya llegaron saneadas del latido.
// ⚠️ Si no pudo leer las PC contesta 503, no una lista vacía: «Todavía no conectaste ninguna» sería mentira, y la
// pantalla se queda con lo que ya mostraba.
// =============================================================================

import { NextResponse } from 'next/server';
import { personaDelRequest } from '@/lib/mako-turno-app';
import { listarDispositivos } from '@/lib/ia-pc';
import { CLAVE_MODELO_PC, modeloPc } from '@/lib/ia-pc-reglas';
import { getSetting } from '@/lib/settings';
import { runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const persona = await personaDelRequest();
  if ('error' in persona) return NextResponse.json({ ok: false, error: persona.error }, { status: persona.status });
  const esAdmin = persona.rol === 'admin';
  let pcs: Awaited<ReturnType<typeof listarDispositivos>>;
  try { pcs = await listarDispositivos(persona.ws, persona.actor, esAdmin); } catch (e) {
    console.error('[ia-pc/estado]', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: 'No pude leer tus computadoras. Intenta de nuevo.' }, { status: 503 });
  }
  const modelo = await runWithWorkspace(persona.ws, () => getSetting(CLAVE_MODELO_PC)).catch(() => null);
  return NextResponse.json({
    ok: true, esAdmin, modelo: modeloPc(modelo),
    pcs: pcs.map((d) => ({
      id: d.id, nombre: d.nombre, esMia: d.esMia, ...(esAdmin && !d.esMia ? { de: d.persona } : {}),
      enLinea: d.enLinea, ultimoLatido: d.ultimoLatido, version: d.version, cuentas: d.cuentas,
    })),
  }, { headers: { 'cache-control': 'no-store' } });
}
