// =============================================================================
// /api/experimentos — el experimento de un elemento de la hoja: leerlo, arrancarlo y concluirlo
// =============================================================================
// Desde el 17/10/2026 los experimentos viven en el Dashboard (Martín: «Quiero que "Experiments" la simplifiques
// completamente… puede vivir dentro del chat de MaKo de "Dashboard"»). «Editar con MaKo» propone uno («probemos X»),
// la hoja lo muestra como un elemento «Experimento» (app/dashboard/ElementoExperimento.tsx) y éstas son sus puertas:
//
//   GET  ?elemento=E | ?id=N  → el experimento con su medición en vivo (el de ese elemento, o uno por su id);
//                               `experimento: null` = ese elemento todavía no arrancó.
//   POST { action: 'arrancar', elemento, propuesta } → lo crea ACTIVO con su baseline medido, atado al elemento
//                               (`config.elemento`). Si ese elemento ya tiene uno, devuelve ése: arrancar dos veces
//                               (dos pestañas, un doble clic) es UN experimento.
//   POST { action: 'concluir', id } → mide el resultado y MaKo dicta el veredicto y el aprendizaje.
//
// La propuesta que manda el navegador se re-sanea acá (`sanearPropuesta`): la misma regla que la IA.
// La puerta es la del Dashboard (`graphics`): sólo el admin del negocio con la tab en su capa. El proxy sólo pide sesión.
// =============================================================================

import type { NextRequest } from 'next/server';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { cerrarExperimento, crearExperimento, experimentoConMedicion, experimentoDeElemento } from '@/lib/experimentos';
import { sanearPropuesta } from '@/lib/experimentos-catalogo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120; // arrancar y concluir miden contra el dato real (y concluir llama a MaKo)

const err = (status: number, error: string) => Response.json({ ok: false, error }, { status });
const idDe = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
/** El id de un elemento de la hoja (`nuevoId`, lib/graficos-catalogo.ts): corto y sin nada raro. */
const elementoDe = (v: unknown): string | null => (typeof v === 'string' && /^[a-z0-9_-]{1,40}$/i.test(v) ? v : null);

export async function GET(req: NextRequest) {
  const cerrada = await soloAdminDeTab('graphics');
  if (cerrada) return cerrada;
  const sp = req.nextUrl.searchParams;
  const elemento = elementoDe(sp.get('elemento'));
  const id = idDe(sp.get('id'));
  if (!elemento && !id) return err(400, 'Falta el experimento.');
  try {
    const experimento = elemento ? await experimentoDeElemento(elemento) : await experimentoConMedicion(id as number);
    if (!experimento && id) return err(404, 'Ese experimento ya no está.');
    return Response.json({ ok: true, experimento });
  } catch (e) {
    return err(500, e instanceof Error ? e.message : String(e));
  }
}

export async function POST(req: NextRequest) {
  const cerrada = await soloAdminDeTab('graphics');
  if (cerrada) return cerrada;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'Pedido inválido.'); }
  try {
    if (body.action === 'arrancar') {
      const elemento = elementoDe(body.elemento);
      const p = sanearPropuesta(body.propuesta);
      if (!elemento) return err(400, 'Falta el elemento de la hoja.');
      if (!p) return err(400, 'Al experimento le falta la hipótesis o una métrica que se pueda medir.');
      const ya = await experimentoDeElemento(elemento);
      if (ya) return Response.json({ ok: true, experimento: ya });
      const exp = await crearExperimento({
        titulo: p.titulo, hipotesis: p.hipotesis, cambio: p.cambio || null, metrica: p.metrica, direccion: p.direccion,
        ventana_dias: p.ventana_dias, criterio_exito: p.criterio_exito || null, objetivo_valor: p.objetivo_valor,
        origen: 'mako', arrancar: true, config: { elemento },
      });
      return Response.json({ ok: true, experimento: await experimentoConMedicion(exp.id) });
    }
    if (body.action === 'concluir') {
      const id = idDe(body.id);
      if (!id) return err(400, 'Falta el experimento.');
      await cerrarExperimento(id);
      return Response.json({ ok: true, experimento: await experimentoConMedicion(id) });
    }
    return err(400, 'Acción inválida.');
  } catch (e) {
    return err(500, e instanceof Error ? e.message : String(e));
  }
}
