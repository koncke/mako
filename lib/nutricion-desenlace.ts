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

import { getTenantDb, getWorkspaceActual } from './workspace';
import { parseEstrategia, hitoYaHecho, type Desenlace } from './setting-estrategia';

export type ResultadoDesenlaces = {
  logrados: number;
  fallidos: number;
  movidos: number;
  /** Cuántos leads arrancaron la secuencia que sigue. */
  encadenados: number;
  /** Cuántos avisos se le mandaron al dueño para que llame él. */
  avisados: number;
  detalle: Array<{ leadId: number; secuencia: string; desenlace: 'logrado' | 'fallo'; etapa: string | null; siguiente?: string | null }>;
};

type FilaInsc = {
  id: number; lead_id: number; secuencia_id: number; estado: string;
  ultimo_paso_at: string | null; inscripto_at: string;
};

/** Horas transcurridas desde un ISO. El umbral del desenlace se mide acá. */
const horas = (desde: string): number => (Date.now() - new Date(desde).getTime()) / 3_600_000;

/** La fecha de la reunión del lead, en texto corto para el aviso. */
function fechaReunion(lead: Record<string, unknown>): string {
  const raw = [lead.junta_1_at, lead.fecha_junta_1, lead.fecha_agenda].find((x) => typeof x === 'string' && x);
  if (typeof raw !== 'string') return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00-06:00` : raw);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
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
  // El workspace, EXPLÍCITO, para los avisos. Sin él `emitirAviso` cae a
  // OWNER_WS y el lead de un cliente termina sonando en el grupo de la agencia.
  // Si no hay contexto no se avisa: mejor mudo que en el grupo equivocado.
  const ws = await getWorkspaceActual().catch(() => null);
  const res: ResultadoDesenlaces = { logrados: 0, fallidos: 0, movidos: 0, encadenados: 0, avisados: 0, detalle: [] };

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
    .select('id, nombre, telefono, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at, fecha_agenda, fecha_primer_pago, cerro, calificado')
    .in('id', leadIds);
  const leads = new Map(((leadData ?? []) as Array<Record<string, unknown>>).map((l) => [Number(l.id), l]));

  // `moverLeadAuto` y no `setPipelineStage` pelado: acá no hay formulario ni
  // nadie a quien preguntarle, y `logradoEtapa`/`falloEtapa` las CONFIGURA cada
  // workspace — un cliente que apunte el logro a su etapa de cierre escribía la
  // venta sin monto, justo lo que el resto de los caminos ya no deja pasar. El
  // helper valida, y si falta un dato no mueve y lo deja escrito en el historial
  // (antes ese fallo se iba a un console.error que no lee nadie).
  const { moverLeadAuto } = await import('./leads');
  const ahora = new Date().toISOString();

  // Todas las secuencias del workspace por CLAVE: el encadenamiento apunta a la
  // clave (estable y legible) y no al id (que cambia entre workspaces).
  const { data: todasSec } = await supabase
    .from('nutricion_secuencias').select('id, clave, nombre, activa, archivada_at, estrategia, pasos')
    .is('archivada_at', null);
  const porClave = new Map(((todasSec ?? []) as Array<{ id: number; clave: string; nombre: string; activa: boolean; estrategia: unknown; pasos: unknown }>).map((x) => [x.clave, x]));

  /**
   * Arranca la secuencia que sigue. Devuelve por qué NO arrancó, o null si sí.
   *
   * No hace falta guarda de tiempo acá: el motor ya no manda dos mensajes al
   * mismo lead en menos de 20 horas ni fuera de la ventana horaria, y esas
   * guardas viven en el ENVÍO — que es donde no se pueden saltear. Encadenar
   * solo crea la inscripción; cuándo sale el primer mensaje lo sigue decidiendo
   * el motor de siempre.
   */
  async function encadenar(clave: string | null, leadId: number, lead: Record<string, unknown>): Promise<string | null> {
    if (!clave) return 'sin-siguiente';
    const sig = porClave.get(clave);
    if (!sig) return 'la-siguiente-no-existe';
    if (!sig.activa) return 'la-siguiente-esta-pausada';
    // ¿El trabajo de la siguiente YA está hecho? Entonces no se repite.
    const estSig = parseEstrategia(sig.estrategia);
    if (estSig && hitoYaHecho(estSig.objetivo, lead) === true) return `ya-hizo-${estSig.objetivo}`;
    // Un lead no se re-inscribe en la misma secuencia: hay un unique
    // (lead_id, secuencia_id) y además volver a empezar lo mismo es ruido.
    const { data: ya } = await supabase
      .from('nutricion_inscripciones').select('id').eq('lead_id', leadId).eq('secuencia_id', sig.id).maybeSingle();
    if (ya) return 'ya-estuvo-en-la-siguiente';
    const pasos = Array.isArray(sig.pasos) ? (sig.pasos as Array<{ delay_horas?: number }>) : [];
    const delay = Number(pasos[0]?.delay_horas ?? 0) || 0;
    const { error } = await supabase.from('nutricion_inscripciones').insert({
      lead_id: leadId, secuencia_id: sig.id, paso_actual: 0, estado: 'activa',
      proximo_envio_at: new Date(Date.now() + delay * 3_600_000).toISOString(),
    });
    if (error) { console.error(`[desenlace] encadenar ${clave}:`, error.message); return `error-${error.code ?? ""}`; }
    res.encadenados += 1;
    return null;
  }

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
          if (await moverLeadAuto(insc.lead_id, d.logradoEtapa, { canal: 'Nutrición', motivo: `Logró el objetivo de «${sec.nombre}»` })) res.movidos += 1;
        } catch (e) { console.error(`[desenlace] mover lead ${insc.lead_id}:`, e); }
      }
      const motivo = await encadenar(d.logradoSecuencia, insc.lead_id, lead);
      res.detalle.push({ leadId: insc.lead_id, secuencia: sec.nombre, desenlace: 'logrado', etapa: d.logradoEtapa, siguiente: motivo ?? d.logradoSecuencia });
      continue;
    }

    // ── ¿Falló por silencio? ──
    // El reloj corre desde el ÚLTIMO mensaje enviado y solo mientras la
    // inscripción sigue activa. Una que quedó pausada o en hand-off no acumula
    // tiempo: nadie le está escribiendo.
    //
    // En HORAS y no en días: «confirmá la reunión de mañana» y «reactivación
    // de un lead de hace tres meses» no pueden compartir umbral.
    if (d.falloHoras > 0 && insc.estado === 'activa') {
      const desde = insc.ultimo_paso_at ?? insc.inscripto_at;
      if (horas(desde) >= d.falloHoras) {
        await supabase.from('nutricion_inscripciones').update({
          desenlace: 'fallo', desenlace_at: ahora, proximo_envio_at: null,
          estado: 'no_responde', updated_at: ahora,
        }).eq('id', insc.id);
        res.fallidos += 1;
        if (d.falloEtapa) {
          try {
            if (await moverLeadAuto(insc.lead_id, d.falloEtapa, { canal: 'Nutrición', motivo: `No respondió a «${sec.nombre}»` })) res.movidos += 1;
          } catch (e) { console.error(`[desenlace] mover lead ${insc.lead_id}:`, e); }
        }
        // AVISARLE AL DUEÑO. Es el pedido literal de Mauricio: «si no confirman
        // antes de 24 hrs entonces me diga para yo marcarles». El momento exacto
        // es este —la secuencia ya le escribió, ya le insistió y el lead no
        // contestó ninguna de las dos veces—, no antes: avisar apenas se agenda
        // sería llamarlo antes de darle la chance de responder solo.
        //
        // Se limita al objetivo 'preparar' (que el lead LLEGUE a la reunión y
        // llegue listo) para no convertir cada secuencia fallida del sistema en un
        // WhatsApp: una reactivación que no funciona no amerita interrumpir a nadie.
        if (est.objetivo === 'preparar' && ws != null) {
          try {
            const { emitirAviso } = await import('./avisos');
            const quien = String(lead.nombre ?? '').trim() || 'Un lead';
            const tel = String(lead.telefono ?? '').trim();
            const cuando = fechaReunion(lead);
            await emitirAviso({
              // `ws` EXPLÍCITO: sin esto cae a OWNER_WS y el lead de un cliente
              // suena en el grupo de la agencia.
              ws,
              tipo: 'lead-no-confirmo',
              titulo: `${quien} no confirmó la reunión`,
              categoria: 'accion',
              semaforo: 'amarillo',
              // El dedup es POR LEAD: sin `dedupKey` el primero se comería el
              // aviso de todos los demás durante la ventana.
              dedupKey: `lead:${insc.lead_id}`,
              dedupTtlMin: 60 * 24,
              texto: [
                `🟡 *${quien}* agendó${cuando ? ` para ${cuando}` : ''} y no confirmó.`,
                '',
                'Le mandé el audio y le insistí al día siguiente: no contestó ninguna de las dos veces.',
                tel ? `Conviene que le marques tú: ${tel}` : 'No tengo su teléfono para pasártelo.',
                '',
                '— MaKo',
              ].join('\n'),
            });
            res.avisados += 1;
          } catch (e) { console.error(`[desenlace] aviso no-confirmó lead ${insc.lead_id}:`, e); }
        }
        const motivo = await encadenar(d.falloSecuencia, insc.lead_id, lead);
        res.detalle.push({ leadId: insc.lead_id, secuencia: sec.nombre, desenlace: 'fallo', etapa: d.falloEtapa, siguiente: motivo ?? d.falloSecuencia });
      }
    }
  }

  return res;
}
