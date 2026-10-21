// =============================================================================
// GET /api/ia-pc/estado — lo que ve «Tus cuentas de IA» (docs/ia-del-cliente.md §6, ola 2)
// =============================================================================
// PRIVADA (con sesión). Las computadoras del negocio con su estado y sus cuentas (el admin ve todas; los demás, las
// suyas), y el modelo que eligió el negocio. Nunca un secreto: las cuentas ya llegaron saneadas del latido.
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
  const [pcs, modelo] = await Promise.all([
    listarDispositivos(persona.ws, persona.actor, esAdmin).catch(() => []),
    runWithWorkspace(persona.ws, () => getSetting(CLAVE_MODELO_PC)).catch(() => null),
  ]);
  return NextResponse.json({
    ok: true, esAdmin, modelo: modeloPc(modelo),
    pcs: pcs.map((d) => ({
      id: d.id, nombre: d.nombre, esMia: d.esMia, ...(esAdmin && !d.esMia ? { de: d.persona } : {}),
      enLinea: d.enLinea, ultimoLatido: d.ultimoLatido, version: d.version, cuentas: d.cuentas,
    })),
  }, { headers: { 'cache-control': 'no-store' } });
}
