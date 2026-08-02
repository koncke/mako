// =============================================================================
// ¿Sirvió esta secuencia? — el evaluador de desenlaces
// =============================================================================
// Una secuencia declara en su estrategia cuándo se considera lograda y a los
// cuántos días de silencio se da por fallida. Esto es lo que lo ejecuta: corre
// en el cron, cierra las inscripciones que ya se definieron y mueve al lead a la
// etapa que corresponda — que es lo que ENCADENA una secuencia con la siguiente.
//
// Dos cuidados que no son opcionales, porque el costo de equivocarse acá es
// mover leads de etapa por su cuenta:
//
//   1. UN LEAD EN HAND-OFF NO FALLA POR SILENCIO. Está hablando con una persona;
//      marcarlo como fallido lo movería de etapa y lo reinscribiría en otra
//      secuencia mientras el setter está en la conversación. El reloj del fallo
//      solo corre mientras la inscripción está 'activa'.
//   2. ARCHIVAR NO ES FALLAR. Las inscripciones que se cancelaron al archivar
//      una secuencia se marcan 'cancelado', no 'fallo': si no, el evaluador las
//      leería como silencio y les movería la etapa por haber limpiado la lista.

import 'server-only';

import { getTenantDb } from './workspace';
import { parseEstrategia, type Desenlace } from './setting-estrategia';

export type ResultadoDesenlaces = {
  logrados: number;
  fallidos: number;
  movidos: number;
  detalle: Array<{ leadId: number; secuencia: string; desenlace: 'logrado' | 'fallo'; etapa: string | null }>;
};

type FilaInsc = {
  id: number; lead_id: number; secuencia_id: number; estado: string;
  ultimo_paso_at: string | null; inscripto_at: string;
};

const dias = (desde: string): number => (Date.now() - new Date(desde).getTime()) / 86_400_000;

/** ¿Se cumplió lo que la secuencia buscaba? */
function seLogro(d: Desenlace, lead: Record<string, unknown>, estado: string): boolean {
  switch (d.logrado) {
    case 'respondio':
      return estado === 'respondio';
    case 'agendo': {
      // Cualquier reunión agendada cuenta, sea la primera o la segunda.
      const f = [lead.fecha_junta_1, lead.junta_1_at, lead.fecha_junta_2, lead.junta_2_at]
        .find((x) => typeof x === 'string' && x);
      return !!f;
    }
    case 'pago':
      return Boolean(lead.fecha_primer_pago) || lead.cerro === true;
    default:
      return false;
  }
}

/**
 * Cierra las inscripciones que ya se definieron y mueve al lead si corresponde.
 * Idempotente: solo mira las que todavía no tienen desenlace.
 */
export async function evaluarDesenlaces(): Promise<ResultadoDesenlaces> {
  const supabase = await getTenantDb();
  const res: ResultadoDesenlaces = { logrados: 0, fallidos: 0, movidos: 0, detalle: [] };

  const { data: inscData } = await supabase
    .from('nutricion_inscripciones')
    .select('id, lead_id, secuencia_id, estado, ultimo_paso_at, inscripto_at')
    .is('desenlace', null)
    .limit(500);
  const inscs = (inscData ?? []) as FilaInsc[];
  if (!inscs.length) return res;

  const secIds = [...new Set(inscs.map((i) => i.secuencia_id))];
  const { data: secData } = await supabase
    .from('nutricion_secuencias').select('id, nombre, estrategia').in('id', secIds);
  const secs = new Map(((secData ?? []) as Array<{ id: number; nombre: string; estrategia: unknown }>).map((s) => [s.id, s]));

  const leadIds = [...new Set(inscs.map((i) => i.lead_id))];
  const { data: leadData } = await supabase
    .from('leads')
    .select('id, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at, fecha_primer_pago, cerro')
    .in('id', leadIds);
  const leads = new Map(((leadData ?? []) as Array<Record<string, unknown>>).map((l) => [Number(l.id), l]));

  const { setPipelineStage } = await import('./leads');
  const ahora = new Date().toISOString();

  for (const insc of inscs) {
    // Cancelada (por archivar la secuencia) o ya cerrada: no es un desenlace del
    // trabajo, es que se sacó de en medio. Se sella y no se toca al lead.
    if (insc.estado === 'cancelada') {
      await supabase.from('nutricion_inscripciones')
        .update({ desenlace: 'cancelado', desenlace_at: ahora, updated_at: ahora }).eq('id', insc.id);
      continue;
    }
    // EN HAND-OFF NO SE DECIDE NADA. Hay una persona en esa conversación; el
    // reloj del fallo está congelado hasta que alguien resuelva el caso.
    if (insc.estado === 'handoff') continue;

    const sec = secs.get(insc.secuencia_id);
    const est = sec ? parseEstrategia(sec.estrategia) : null;
    if (!sec || !est) continue;
    const d = est.desenlace;

    const lead = leads.get(insc.lead_id);
    if (!lead) continue;

    // ── ¿Se logró? ──
    if (d.logrado !== 'ninguno' && seLogro(d, lead, insc.estado)) {
      await supabase.from('nutricion_inscripciones').update({
        desenlace: 'logrado', desenlace_at: ahora, proximo_envio_at: null,
        estado: 'completada', updated_at: ahora,
      }).eq('id', insc.id);
      res.logrados += 1;
      if (d.logradoEtapa) {
        try {
          await setPipelineStage(insc.lead_id, d.logradoEtapa, { motivo: `Logró el objetivo de «${sec.nombre}»` });
          res.movidos += 1;
        } catch (e) { console.error(`[desenlace] mover lead ${insc.lead_id}:`, e); }
      }
      res.detalle.push({ leadId: insc.lead_id, secuencia: sec.nombre, desenlace: 'logrado', etapa: d.logradoEtapa });
      continue;
    }

    // ── ¿Falló por silencio? ──
    // El reloj corre desde el ÚLTIMO mensaje enviado y solo mientras la
    // inscripción sigue activa. Una que quedó pausada o en hand-off no acumula
    // días: nadie le está escribiendo.
    if (d.falloDias > 0 && insc.estado === 'activa') {
      const desde = insc.ultimo_paso_at ?? insc.inscripto_at;
      if (dias(desde) >= d.falloDias) {
        await supabase.from('nutricion_inscripciones').update({
          desenlace: 'fallo', desenlace_at: ahora, proximo_envio_at: null,
          estado: 'no_responde', updated_at: ahora,
        }).eq('id', insc.id);
        res.fallidos += 1;
        if (d.falloEtapa) {
          try {
            await setPipelineStage(insc.lead_id, d.falloEtapa, { motivo: `No respondió a «${sec.nombre}»` });
            res.movidos += 1;
          } catch (e) { console.error(`[desenlace] mover lead ${insc.lead_id}:`, e); }
        }
        res.detalle.push({ leadId: insc.lead_id, secuencia: sec.nombre, desenlace: 'fallo', etapa: d.falloEtapa });
      }
    }
  }

  return res;
}
