// =============================================================================
// API: cómo quiere el CLIENTE que le llegue UN aviso
// =============================================================================
// Lo que se puede tocar por aviso, además del interruptor que ya existía:
//   · QUÉ DICE   → el texto de referencia. No es un molde con slots: MaKo lo usa
//                  como guía y redacta con los datos reales (decisión de Martín).
//   · INSISTIR   → que vuelva hasta que alguien conteste «ok» en el grupo.
//
// QUÉ NO SE PUEDE TOCAR ACÁ, y es a propósito: el DISPARADOR. Cada uno de estos
// avisos existe PORQUE pasa algo concreto (entró un lead, se agendó, Meta frenó un
// anuncio) y ese enganche está cableado en su webhook. Reasignarle otro evento no lo
// configura: lo convierte en otro aviso. Para armar uno con su propio disparador está
// el FLUJO (lib/flujos-tipos.ts), que sí elige entre los 5 eventos con choke point.
//
// Guard: admin del workspace — decide qué mensajes salen por la línea del negocio.

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { referenciaPlantilla, setTextoPlantilla, getFlujo, setFlujo } from '@/lib/plantillas';
import { sanearInsistir, flujoVacio, type Flujo } from '@/lib/flujos-tipos';

export const dynamic = 'force-dynamic';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el administrador del workspace puede configurar los avisos.' }, { status: 403 });
  }
  return null;
}

/** El paso de insistencia de un flujo, si lo tiene. */
function insistirDe(f: Flujo | null): { activo: boolean; cadaMin: number; veces: number } {
  const p = f?.pasos.find((x) => x.tipo === 'insistir');
  if (!p || p.tipo !== 'insistir') return { activo: false, cadaMin: 60, veces: 3 };
  return { activo: f?.activo !== false, cadaMin: p.cadaMin, veces: p.veces };
}

export async function GET(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return Response.json({ ok: false, error: 'falta id' }, { status: 400 });
  try {
    const [texto, flujo] = await Promise.all([referenciaPlantilla(id), getFlujo(id)]);
    return Response.json({ ok: true, texto, insistir: insistirDe(flujo) });
  } catch (e) {
    console.error(`[api:perfil/aviso GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  let b: { id?: string; texto?: string; insistir?: { activo?: boolean; cadaMin?: number; veces?: number } };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const id = (b.id ?? '').trim();
  if (!id) return Response.json({ ok: false, error: 'falta id' }, { status: 400 });

  try {
    if (typeof b.texto === 'string') await setTextoPlantilla(id, b.texto.slice(0, 2000));

    if (b.insistir) {
      const actual = (await getFlujo(id)) ?? flujoVacio();
      // Se reemplaza el paso de insistencia, sin tocar los otros pasos que el flujo
      // pudiera tener: esta pantalla configura UNA cosa, no reescribe el flujo entero.
      const resto = actual.pasos.filter((p) => p.tipo !== 'insistir');
      if (b.insistir.activo) {
        // El texto que insiste es el mismo que el del aviso: si fueran dos, el cliente
        // editaría uno y seguiría saliendo el otro.
        const texto = typeof b.texto === 'string' ? b.texto : await referenciaPlantilla(id);
        // sanearInsistir aplica el techo del producto (5 veces, 30 min). Acá no se
        // valida a mano: UN solo lugar decide el tope.
        const paso = sanearInsistir({ texto, cadaMin: b.insistir.cadaMin, veces: b.insistir.veces });
        await setFlujo(id, { ...actual, activo: true, pasos: [...resto, paso] });
      } else if (resto.length) {
        await setFlujo(id, { ...actual, pasos: resto });
      } else {
        // Sin pasos no hay flujo que guardar: se borra en vez de dejar una cáscara
        // que después aparece en listarFlujosActivos sin hacer nada.
        await setFlujo(id, null);
      }
    }

    const [texto, flujo] = await Promise.all([referenciaPlantilla(id), getFlujo(id)]);
    return Response.json({ ok: true, texto, insistir: insistirDe(flujo) });
  } catch (e) {
    console.error(`[api:perfil/aviso POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
