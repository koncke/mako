import 'server-only';

// =============================================================================
// plan-avisos — el aviso que faltaba: un proyecto que vence, o que ya venció
// =============================================================================
// El reporte, textual (22/09/2026): «las notificaciones de WhatsApp son demasiadas, y
// NINGUNA avisa que un proyecto está por vencer o atrasado». Las dos mitades importan, y
// por eso esto manda UN SOLO MENSAJE con todos los proyectos adentro:
//
//  · Con 70 proyectos, un aviso por proyecto sería exactamente el problema que él nombró.
//  · Y un aviso por proyecto además NO se puede leer: lo que se quiere saber es «cuántos
//    estoy debiendo y cuál vence primero», que es una sola pregunta.
//
// La condición y el texto viven en `plan-vencimientos.ts` (sin `server-only`, con test).
// Acá está lo que no se puede testear: leer el tablero y mandarlo.
// =============================================================================

import { createHash } from 'node:crypto';
import { emitirAviso } from '@/lib/avisos';
import { enPlan, listPlanBoard } from '@/lib/plan-board';
import { clasificarVencimientos, textoVencimientos, huellaVencimientos, type ResumenVencimientos } from '@/lib/plan-vencimientos';
import { sinRecurrentes, soloRecurrentes } from '@/lib/plan-recurrentes';

/** Sin cambios, no se repite en 3 días. Cuando cambia algo, sale al otro día. */
const TTL_MIN = 60 * 24 * 3;

/** Qué proyectos del tablero deben fecha hoy, con cuántas tareas abiertas arrastran. */
export async function vencimientosDelPlan(hoyISO: string): Promise<ResumenVencimientos> {
  return enPlan(async () => {
    const { proyectos, tareas } = await listPlanBoard();
    return clasificarVencimientos(
      proyectos.map((p) => {
        const suyas = tareas.filter((t) => t.labels.includes(p.id) && t.progress < 100);
        // ⚠️ LAS QUE SE REPITEN NO SON TRABAJO ABIERTO, PERO SÍ SON SEÑAL DE VIDA (mig 0163).
        // Contarlas en `abiertas` manda un WhatsApp que dice «3 tareas abiertas» cuando las
        // tres son la reunión de los miércoles; no mandarlas en absoluto hace que un
        // proyecto de puras recurrentes caiga en `abiertas === 0` y deje de avisar su
        // vencimiento. Las dos son mentiras distintas, así que viajan por separado y quien
        // redacta el renglón decide (`carga`, en plan-vencimientos.ts).
        return {
          nombre: p.name,
          deadline: p.deadline ?? '',
          abiertas: sinRecurrentes(suyas).length,
          recurrentes: soloRecurrentes(suyas).length,
        };
      }),
      hoyISO,
    );
  });
}

/**
 * Lo manda. Devuelve qué se avisó (o por qué no), para que el cron lo logee: un cron que
 * audita y se guarda el resultado es un cron que no auditó.
 */
export async function avisarVencimientosDelPlan(hoyISO: string, ws: number): Promise<{ atrasados: number; porVencer: number; enviado: boolean; motivo?: string }> {
  const r = await vencimientosDelPlan(hoyISO);
  const msg = textoVencimientos(r);
  if (!msg) return { atrasados: 0, porVencer: 0, enviado: false, motivo: 'nada que avisar' };
  const huella = createHash('sha1').update(huellaVencimientos(r)).digest('base64url').slice(0, 16);
  const res = await emitirAviso({
    tipo: 'plan-proyecto-vence',
    dedupKey: huella,
    dedupTtlMin: TTL_MIN,
    titulo: msg.titulo,
    texto: msg.texto,
    categoria: 'aviso',
    semaforo: r.atrasados.length ? 'rojo' : 'amarillo',
    link: '/plan/agencia',
    ws,
    alDueno: true,
  });
  return {
    atrasados: r.atrasados.length,
    porVencer: r.porVencer.length,
    enviado: res.wa,
    motivo: res.deduped ? 'ya avisado (sin cambios)' : res.apagado ? 'apagado en Configuraciones' : res.waError,
  };
}
