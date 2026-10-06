// =============================================================================
// CRON: los mensajes de antes y después de cada llamada de la entrega (cada hora)
// =============================================================================
// Pedido de Mauricio (8/9/2026), en sus palabras: «mandarle un WhatsApp a mis clientes… te
// recuerdo que ya viene la junta con Mauricio y están estas pendientes», y «después de la junta
// le mande un WhatsApp a mi cliente con las tareas que quedamos». Y que le llegue también a él.
// Lo implementó el curso el 06/10/2026: las llamadas viven en `curso_sesiones` (mig 0202) y lo
// que le falta al cliente sale de las tareas de su etapa.
//
// Cada hora, porque las ventanas son de horas (el previo, hasta 24 h antes; el posterior, de 2 a
// 48 h después) y fuera del horario del negocio no se manda: una corrida por hora alcanza para
// que nada se pierda y nada salga de madrugada. El cuerpo entero —quién, cuándo, la marca con
// compare-and-set que impide mandar dos veces— vive en lib/curso-mensajes.ts.
//
// ⚠️ POR QUÉ NO USA `correrPorWorkspace`: ese helper itera los workspaces con una INTEGRACIÓN
// conectada, y acá no corresponde ninguna. Se pregunta al revés, como avisos-programados: la
// TABLA dice quién tiene una llamada en ventana, y se visita sólo a ésos. Un tick sin llamadas
// cuesta una consulta.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrAvisosDeSesiones } from '@/lib/curso-mensajes';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const r = await correrAvisosDeSesiones(new Date());
  // 500 sólo si no se pudo hacer NADA (la lectura, o todos los negocios visitados fallaron), para
  // que el monitoreo del cron lo vea. Una sesión que falla sola va en `errores` y no tumba la hora.
  const visitados = r.workspaces ?? 0;
  const fallidos = r.workspacesFallidos?.length ?? 0;
  const ok = !r.lecturaFallida && !(visitados > 0 && fallidos === visitados);
  if (r.errores.length) console.error('[cron:curso-sesiones]', r.errores.join(' · '));
  return Response.json({ ok, ...r }, { status: ok ? 200 : 500 });
}
