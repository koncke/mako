// =============================================================================
// POST /api/closing/analizar-lead — analiza las llamadas de UN lead, en background
// =============================================================================
// Body: { lead_id: number }. Responde AL TOQUE (202) y hace el trabajo pesado en
// `after()`: barrer Fathom y correr el Closing Analyst tarda minutos.
//
// Por qué una ruta y no una server action: el pedido era «que por más que me
// salga de la página se siga analizando». Con `after()` el trabajo corre después
// de mandada la respuesta y ya no depende de que el navegador siga escuchando —
// es el mismo patrón que el webhook de Fathom, que existe justamente porque el
// análisis no entra en el timeout de quien llama.
//
// El estado NO viaja en esta respuesta: vive en `closing_jobs` (lib/closing-job)
// y lo lee la pantalla al renderizar. Si viajara acá, cerrar la pestaña lo
// perdería, que es exactamente lo que hay que evitar.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { analizarLlamadasDeLead } from '@/lib/closing';
import { arrancarAnalisis, cerrarAnalisis } from '@/lib/closing-job';
import { resumenDeCorrida } from '@/lib/closing-job-estado';
import { integracionConectada } from '@/lib/credenciales';
import { getLead } from '@/lib/leads';
import { getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
// El trabajo de `after()` vive dentro de esta invocación: el techo es de la ruta,
// no del request. Es el mismo que el webhook de Fathom, que hace lo mismo.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!(await integracionConectada('fathom'))) {
    return Response.json({ ok: false, error: 'Fathom no está conectado en este workspace.' }, { status: 403 });
  }

  let body: { lead_id?: number | string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const leadId = Number(body.lead_id);
  if (!Number.isFinite(leadId) || leadId <= 0) {
    return Response.json({ ok: false, error: 'lead_id requerido' }, { status: 400 });
  }

  // El lead se lee con el cliente TENANT: si es de otro workspace no existe para
  // este request, y el 404 sale antes de gastar un peso de IA.
  const lead = await getLead(leadId).catch(() => null);
  if (!lead) return Response.json({ ok: false, error: 'lead no encontrado' }, { status: 404 });

  // El candado y el estado son la misma fila: si ya hay uno corriendo, no se
  // arranca otro (dos corridas pagarían dos veces la misma grabación).
  if (!(await arrancarAnalisis(leadId))) {
    return Response.json({ ok: true, yaCorriendo: true });
  }

  // `after()` corre fuera del request: el AsyncLocalStorage del workspace ya no
  // está, así que se re-entra explícitamente con el ws capturado ACÁ. Sin esto,
  // getTenantDb resolvería el workspace por cookies que ya no existen.
  const ws = await getWorkspaceActual();
  after(() => runWithWorkspace(ws, async () => {
    try {
      // Cómo se cuenta el desenlace vive en `resumenDeCorrida` (sin server-only,
      // testeado): es el texto que ve el usuario, y acá no se decide nada.
      const { estado, detalle } = resumenDeCorrida(await analizarLlamadasDeLead(leadId));
      await cerrarAnalisis(leadId, estado, detalle);
      console.log(`[closing:analizar-lead] lead=${leadId} ${estado}: ${detalle}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Cerrar SIEMPRE, también en el error: una excepción que no cierra la fila
      // deja el candado puesto y la pantalla en «Revisando» hasta que vence.
      await cerrarAnalisis(leadId, 'error', `No pude analizarla: ${message}`);
      console.error(`[closing:analizar-lead] lead=${leadId} falló: ${message}`);
    }
  }));

  return Response.json({ ok: true, arrancado: true }, { status: 202 });
}
