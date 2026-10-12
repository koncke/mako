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
import { parseEstrategia, hitoYaHecho, silencioCumplido, type Desenlace } from './setting-estrategia';
import { leerTodo } from './supabase-paginado';
import { enTandas } from './ids-con-filas';
import { enviosPorInscripcion } from './nutricion-envios-resumen';
import { preparaReunion } from './nutricion-familias';
import { reunionQuePreparaMs, type JuntasLead } from './nutricion-reinscripcion';
import { agendoLead, pagoLead, logroCierraLaInscripcion, textoFechaReunion, desenlaceEsperaAlCarril } from './nutricion-grafo-motor';
import { proximoDeEntrada } from './nutricion-hilos';
import { tzDeWorkspace, TZ_DEFAULT } from './timezone';
import { esFlujoExplicito } from './flujo-legado';
import type { PasoGrafo } from './flujo-grafo';

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
  /** Con 'respondio' y el próximo envío puesto, el carril del recordatorio sigue vivo (M4, `desenlaceEsperaAlCarril`). */
  proximo_envio_at?: string | null;
};

/** Horas transcurridas desde un ISO. El umbral del desenlace se mide acá. */

/**
 * La fecha de la reunión del lead, en texto corto para el aviso, EN LA ZONA DEL NEGOCIO
 * (`textoFechaReunion`). Se escribía en la del servidor (UTC): «sábado 10, 01:00 a.m.» para una
 * reunión del viernes 9 a las 18 de Tijuana (medido el 08/10/2026 en el grupo de Mauricio).
 */
function fechaReunion(lead: Record<string, unknown>, tz: string): string {
  return textoFechaReunion(lead, tz);
}
/**
 * ¿Se cumplió lo que la secuencia buscaba?
 *
 * «Agendó» y «pagó» salen de lib/nutricion-grafo-motor.ts y no de una cuenta propia: son las
 * MISMAS preguntas que la condición «Agendó» / «Pagó» de una tarjeta, y el conversor pasa
 * «Termina si agenda» a esa condición. Con dos reglas, una secuencia convertida terminaría en
 * otro momento que antes de convertirla.
 */
function seLogro(d: Desenlace, lead: Record<string, unknown>, estado: string): boolean {
  switch (d.logrado) {
    case 'respondio':
      return estado === 'respondio';
    case 'agendo':
      // Cualquier reunión agendada cuenta, sea la primera o la segunda.
      return agendoLead(lead);
    case 'pago':
      return pagoLead(lead);
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
  let tzNegocio: string | undefined;

  // La cola ENTERA de inscripciones sin desenlace, paginada por `id`. Antes era
  // un `.limit(500)` sin ORDER BY: pasadas las 500 pendientes, cuáles entraban
  // lo decidía el orden físico de Postgres, que tiende a repetir las mismas —
  // así que las del final podían no evaluarse NUNCA (ni logradas ni fallidas, y
  // el lead sin moverse de etapa), sin un solo error. Las activas no salen de
  // la cola hasta que se definen, así que ese tope se llenaba con las mismas.
  const inscs = await leerTodo<FilaInsc>(
    supabase, 'nutricion_inscripciones', 'id, lead_id, secuencia_id, estado, ultimo_paso_at, inscripto_at, proximo_envio_at',
    { orden: 'id', filtros: (q) => q.is('desenlace', null) },
  );
  if (!inscs.length) return res;

  const secIds = [...new Set(inscs.map((i) => i.secuencia_id))];
  // `pasos` para saber si es un flujo de TARJETAS (`logroCierraLaInscripcion`, más abajo).
  const { data: secData } = await supabase
    .from('nutricion_secuencias').select('id, nombre, estrategia, pasos').in('id', secIds);
  const secs = new Map(((secData ?? []) as Array<{ id: number; nombre: string; estrategia: unknown; pasos: unknown }>).map((s) => [s.id, s]));

  // Los leads, en tandas de 200 ids: una fila por id, así que cada tanda queda
  // lejos del techo de 1000 y la URL del `.in()` no crece con la cola.
  const leads = new Map<number, Record<string, unknown>>();
  for (const tanda of enTandas([...new Set(inscs.map((i) => i.lead_id))], 200)) {
    const { data: leadData, error: leadErr } = await supabase
      .from('leads')
      .select('id, nombre, telefono, fecha_junta_1, junta_1_at, fecha_junta_2, junta_2_at, fecha_agenda, fecha_primer_pago, cerro, calificado')
      .in('id', tanda);
    // Un lead que no se pudo leer se saltea abajo (`if (!lead) continue`): mejor
    // no decidir que decidir sin el dato.
    if (leadErr) console.error('[desenlace] leer leads:', leadErr.message);
    for (const l of (leadData ?? []) as Array<Record<string, unknown>>) leads.set(Number(l.id), l);
  }

  // `moverLeadAuto` y no `setPipelineStage` pelado: acá no hay formulario ni
  // nadie a quien preguntarle, y `logradoEtapa`/`falloEtapa` las CONFIGURA cada
  // workspace — un cliente que apunte el logro a su etapa de cierre escribía la
  // venta sin monto, justo lo que el resto de los caminos ya no deja pasar. El
  // helper valida, y si falta un dato no mueve y lo deja escrito en el historial
  // (antes ese fallo se iba a un console.error que no lee nadie).
  const { moverLeadAuto } = await import('./leads');
  const ahora = new Date().toISOString();

  // Lo que SALIÓ de verdad, por inscripción: cuántos mensajes y cuándo el
  // último. Es la única base honesta para «no contestó». `ultimo_paso_at` no
  // sirve: el motor lo escribe también cuando el paso quedó como borrador que
  // nadie mandó. Ver `silencioCumplido` (lib/setting-estrategia.ts).
  //
  // Paginado y en tandas (ver lib/nutricion-envios-resumen.ts): con la cola
  // llena son miles de envíos, y un `.in()` suelto cortado en 1000 dejaba a las
  // últimas inscripciones sin su envío más reciente → el silencio se medía desde
  // uno anterior y se marcaba FALLO (y se movía al lead) antes de tiempo. Si la
  // lectura falla, LANZA: decidir fallos sin saber qué salió es justo el daño.
  const enviados = await enviosPorInscripcion(supabase, inscs.map((i) => i.id));

  // Todas las secuencias del workspace por CLAVE: el encadenamiento apunta a la
  // clave (estable y legible) y no al id (que cambia entre workspaces).
  const { data: todasSec } = await supabase
    // `etapa, etapas, disparadores`: lo que mira `preparaReunion` (la forma del flujo, undécima tanda M2).
    .from('nutricion_secuencias').select('id, clave, nombre, activa, archivada_at, estrategia, pasos, trigger_tipo, etapa, etapas, disparadores')
    .is('archivada_at', null);
  type FilaSiguiente = {
    id: number; clave: string; nombre: string; activa: boolean; estrategia: unknown; pasos: unknown; trigger_tipo: string;
    etapa?: string | null; etapas?: unknown[] | null;
    disparadores?: Array<{ trigger_tipo: string; etapa?: string | null; etapas?: unknown[] | null }> | null;
  };
  const porClave = new Map(((todasSec ?? []) as FilaSiguiente[]).map((x) => [x.clave, x]));

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
    //
    // ⚠️ Y ACÁ NO SE REUSA LA FILA VIEJA (#789), a propósito. El reuso de una inscripción
    // terminada vive en el cohorte y en el evento de agenda (lib/nutricion.ts), que son los
    // que se enteran de que el lead tiene una reunión NUEVA; encadenar corre por el desenlace
    // de OTRA secuencia, no porque haya vuelto a agendar. Y reusando acá, una secuencia cuyo
    // desenlace encadena consigo misma —una clave mal puesta en el editor— volvería a arrancar
    // en cada pasada del cron, para siempre. Si la siguiente prepara una reunión y el lead
    // está en su cohorte con una reunión nueva, el cohorte la reusa en la corrida siguiente.
    const { data: ya } = await supabase
      .from('nutricion_inscripciones').select('id').eq('lead_id', leadId).eq('secuencia_id', sig.id).maybeSingle();
    if (ya) return 'ya-estuvo-en-la-siguiente';
    // El paso de ENTRADA, no el índice 0: con el flujo con ramas, «Si responde» puede estar
    // primero en el array y la salida arrancar más abajo.
    // Con flechas en paralelo desde el CRON, el mínimo entre las raíces (`proximoDeEntrada`).
    const pasos = Array.isArray(sig.pasos) ? (sig.pasos as PasoGrafo[]) : [];
    const primero = proximoDeEntrada(pasos, (p) => new Date(Date.now() + (Number(p?.delay_horas ?? 0) || 0) * 3_600_000).toISOString());
    // La reunión que esta inscripción prepara (mig 0205), igual que al inscribir por el
    // cohorte: sin ella, el reuso de mañana no sabría si la próxima agenda es otra reunión.
    // Por la FORMA del flujo (`preparaReunion`, undécima tanda M2), no sólo por el trigger de antes.
    const prepara = preparaReunion({ ...sig, pasos });
    const reunion = prepara ? reunionQuePreparaMs(lead as JuntasLead) : null;
    const { error } = await supabase.from('nutricion_inscripciones').insert({
      lead_id: leadId, secuencia_id: sig.id, paso_actual: 0, estado: 'activa',
      proximo_envio_at: primero,
      ...(prepara ? { reunion_at: reunion == null ? null : new Date(reunion).toISOString() } : {}),
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
    // EL CARRIL DEL RECORDATORIO SIGUE VIVO (undécima tanda, M4): el lead contestó, pero los recordatorios de su
    // reunión siguen saliendo. Cerrarla ahora como lograda los apagaba; cuando el carril termina, el motor la deja
    // en 'respondio' sin próximo envío y ésta la cierra como siempre.
    if (desenlaceEsperaAlCarril({ estado: insc.estado, proximo_envio_at: insc.proximo_envio_at ?? null })) continue;

    const sec = secs.get(insc.secuencia_id);
    const est = sec ? parseEstrategia(sec.estrategia) : null;
    if (!sec || !est) continue;
    const d = est.desenlace;

    const lead = leads.get(insc.lead_id);
    if (!lead) continue;

    // ── ¿Se logró? ──
    // En un flujo de TARJETAS, «agendó» y «pagó» no cierran acá: lo hacen sus condiciones
    // (decisión del 08/10/2026, `logroCierraLaInscripcion`). «Respondió» sí.
    const flujo = esFlujoExplicito(Array.isArray(sec.pasos) ? (sec.pasos as PasoGrafo[]) : []);
    if (logroCierraLaInscripcion(d.logrado, flujo) && seLogro(d, lead, insc.estado)) {
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
    // Solo cuando la secuencia YA MANDÓ TODO (completada) y desde el último
    // mensaje que SALIÓ. La regla entera, y las tres formas en que la versión
    // inline de acá fallaba, en `silencioCumplido`.
    //
    // En HORAS y no en días: «confirmá la reunión de mañana» y «reactivación
    // de un lead de hace tres meses» no pueden compartir umbral.
    const salio = enviados.get(insc.id) ?? null;
    {
      if (silencioCumplido({ falloHoras: d.falloHoras, estado: insc.estado, ultimoEnviadoAt: salio?.ultimo ?? null, ahoraMs: Date.now() })) {
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
            // La zona del negocio, UNA vez por corrida y sólo si hay que avisar.
            tzNegocio ??= await tzDeWorkspace(ws).catch(() => TZ_DEFAULT);
            const cuando = fechaReunion(lead, tzNegocio);
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
                // Lo que dice que se hizo sale de lo que SALIÓ, no de lo que la
                // secuencia tenía escrito. La versión anterior afirmaba «le mandé
                // el audio y le insistí» siempre — y llegó a dispararse sobre
                // leads a los que no les había salido nada.
                (salio?.n ?? 0) >= 2
                  ? `Le escribí ${salio!.n} veces (el audio y el recordatorio) y no contestó ninguna.`
                  : 'Le mandé el audio y no contestó.',
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
