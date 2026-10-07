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
// Y DESPUÉS, el RECORDATORIO DE CLASES (#780, decisión de Martín del 06/10/2026): a los 3 días
// sin entrar al portal, los videos sin ver de su etapa. Va en este mismo cron y no en uno nuevo:
// es la misma familia (lo que el curso le escribe al cliente), con el mismo horario y el mismo
// interruptor, y un cron más en vercel.json es otra cosa que alguien tiene que acordarse de
// registrar. Va SEGUNDO porque es lo que menos apuro tiene: si las llamadas se comen el tiempo,
// el recordatorio espera a la hora siguiente (`hastaMs`) y no se pierde nada.
//
// ⚠️ EL ÚLTIMO RECORDATORIO SE EMPIEZA CON TIEMPO PARA LA COPIA A MAURICIO (revisión del
// 07/10/2026). Antes eran 90 s sobre 120 sin nada reservado para lo que viene después del último
// envío, y si la función se cortaba, la copia —que vive sólo en memoria— se perdía con los
// recordatorios ya mandados. La cuenta vive en `ultimoInicioDeRecordatorio`
// (lib/curso-mensajes-texto.ts) y se arma con `maxDuration`, así que subirlo la ajusta sola.
//
// ⚠️ POR QUÉ NO USA `correrPorWorkspace`: ese helper itera los workspaces con una INTEGRACIÓN
// conectada, y acá no corresponde ninguna. Se pregunta al revés, como avisos-programados: la
// TABLA dice quién tiene una llamada en ventana (o un recordatorio que le toca), y se visita sólo
// a ésos. Un tick sin nada cuesta dos consultas.

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrAvisosDeSesiones, correrRecordatoriosDeClases } from '@/lib/curso-mensajes';
import { ultimoInicioDeRecordatorio } from '@/lib/curso-mensajes-texto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;
  const inicio = Date.now();

  const r = await correrAvisosDeSesiones(new Date());
  const rc = await correrRecordatoriosDeClases(new Date(), { hastaMs: ultimoInicioDeRecordatorio(inicio, maxDuration) });

  // 500 sólo si no se pudo hacer NADA (la lectura, o todos los negocios visitados fallaron), para
  // que el monitoreo del cron lo vea. Una sesión o un cliente que falla solo va en `errores` y no
  // tumba la hora. Una base sin la mig 0211 (`sinColumna`) no es un fallo: el recordatorio espera.
  const visitados = r.workspaces ?? 0;
  const fallidos = r.workspacesFallidos?.length ?? 0;
  const okSesiones = !r.lecturaFallida && !(visitados > 0 && fallidos === visitados);
  const okRecordatorios = !rc.lecturaFallida && !(rc.workspaces > 0 && rc.workspacesFallidos.length === rc.workspaces);
  const ok = okSesiones && okRecordatorios;
  if (r.errores.length) console.error('[cron:curso-sesiones]', r.errores.join(' · '));
  if (rc.errores.length) console.error('[cron:curso-sesiones:recordatorios]', rc.errores.join(' · '));
  return Response.json({ ok, ...r, recordatorios: rc }, { status: ok ? 200 : 500 });
}
