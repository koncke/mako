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
import { estadoDeSusClaves } from '@/lib/su-clave';
import { nombreAdminDelNegocio } from '@/lib/usuarios';
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
  // Las claves de API del negocio y si anduvieron o fallaron (IA3): sólo al admin, que es quien las guarda y las prueba.
  // `null` = no se pudo leer (la tarjeta no inventa «Todavía no se usó»).
  const claves = esAdmin ? await estadoDeSusClaves(persona.ws) : undefined;
  // A quien no es admin, la clave no se le ofrece: «Pídele a <admin> que conecte la IA del negocio» (IA4).
  const admin = esAdmin ? undefined : await nombreAdminDelNegocio(persona.ws).catch(() => '');
  return NextResponse.json({
    ok: true, esAdmin, modelo: modeloPc(modelo), ...(esAdmin ? { claves } : { admin }),
    pcs: pcs.map((d) => ({
      id: d.id, nombre: d.nombre, esMia: d.esMia, ...(esAdmin && !d.esMia ? { de: d.persona } : {}),
      enLinea: d.enLinea, ultimoLatido: d.ultimoLatido, version: d.version, cuentas: d.cuentas,
      // Varias computadoras (22/10/2026): cuándo se conectó y su sistema (desde la 0.4.0), para saber cuál es cuál.
      conectadaAt: d.conectadaAt, sistema: d.sistema,
      // En esa PC no hay Claude Code (mig 0322): la tarjeta y el tutorial mandan al paso 2, no al 3.
      ...(d.claudeFalta ? { sinClaude: true } : {}),
    })),
  }, { headers: { 'cache-control': 'no-store' } });
}
