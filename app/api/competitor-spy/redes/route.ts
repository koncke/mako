// =============================================================================
// /api/competitor-spy/redes — sus otras redes, buscadas solas (4/11/2026)
// =============================================================================
// Martín, 4/11: «Lo de "Buscar sus otras redes" debe ser automático, no un botón, de última que te muestre opciones y te
// pregunte si es ese o no».
//
//   POST { id } → { ok, sumadas[], candidatos[] }   o   { ok: false, error }
//
// Lo SEGURO (se enlazan entre ellos, o misma foto y mismo nombre: `veredictoDe`, lib/spy-otras-redes-reglas.ts) se agrega
// acá, por el mismo camino que pegarlo a mano (`agregarCompetidor`), y la pantalla ofrece deshacerlo. Lo dudoso vuelve
// como candidato y sólo el «Es» de la persona lo escribe.
//
// ⚠️ ES UNA RUTA Y NO UNA SERVER ACTION: tarda de 10 a 40 s (Google, y leer cada candidato), y una action haría esperar
// en FILA a la lectura de las piezas o a cambiar de competidor.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { agregarCompetidor, leerCompetidor, ponerWebEncontrada } from '@/lib/spy';
import { marcarActosSpy } from '@/lib/spy-actos';
import { buscarOtrasRedes, type CandidatoVerificado } from '@/lib/spy-otras-redes';
import { sinCanalesRepetidos } from '@/lib/spy-otras-redes-reglas';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
/** Dos búsquedas de Google seguidas hasta 35 s cada una (si no terminan, se retoman en el pedido siguiente), más leer a los candidatos. */
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const s = await getUsuarioActual();
  const ws = s && (await getRolWsEfectivo()) ? await getWorkspaceActual() : null;
  if (!s || ws == null) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });

  const cuerpo = (await req.json().catch(() => ({}))) as { id?: unknown };
  const id = Number(cuerpo.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'Falta el competidor.' }, { status: 400 });

  try {
    const c = await leerCompetidor(id);
    if (!c) return Response.json({ ok: false, error: 'No encontré a ese competidor.' });
    const r = await buscarOtrasRedes(ws, c);
    if (!r.ok) return Response.json(r);
    const sumadas: CandidatoVerificado[] = [];
    const candidatos = [...r.candidatos];
    for (const k of r.seguros) {
      const a = await agregarCompetidor(k.url, c.nombre);
      if (a.ok) sumadas.push(k);
      else candidatos.unshift(k);
    }
    if (sumadas.length) await marcarActosSpy(['spy_primero', 'spy_canales']);
    // Su web de verdad (sacada de su bio o de su página de enlaces): se pone sola, y la pantalla la lee con su funnel.
    const web = r.web && (await ponerWebEncontrada(id, r.web)) ? r.web : null;
    // Un canal, una pastilla: el mismo canal por dos caminos se manda una vez (`sinCanalesRepetidos`).
    return Response.json({ ok: true, sumadas, candidatos: sinCanalesRepetidos(candidatos), web, ...(r.pendiente ? { pendiente: true } : {}) });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
