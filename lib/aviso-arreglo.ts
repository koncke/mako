// =============================================================================
// aviso-arreglo — «ya quedó arreglado», firmado por el Desarrollador, al grupo de MaKo de UN cliente
// =============================================================================
// El pedido de Martín y las reglas: lib/aviso-arreglo-reglas.ts. Lo llaman:
//   · un jefe (una sesión de Claude) cuando su arreglo llegó a producción: scripts/avisar-arreglo-al-grupo.mts, que
//     PRUEBA la producción (git + Vercel) antes de llamar;
//   · la Ticketera, desde su cron, cuando un ticket con un negocio afectado quedó resuelto en producción.
//
// ⚠️ NO es una operación del registro de la API, a propósito: una operación la puede pedir el modelo en un chat o un
//    paso ⚡ Acción de una automatización, y «firmar como el equipo de MaKo en el grupo de un cliente» no puede estar al
//    alcance de ninguno de los dos. Es un envío de la plataforma, como los avisos del catálogo (lib/avisos.ts).
//
// Lo que hace, en orden, y por qué en ese orden:
//   1. valida el negocio, la clave, el texto (firma, sin promesas ni groserías) y que venga la PRUEBA de producción;
//   2. el tope del día (TOPE_AVISOS_POR_DIA), contando el registro del negocio;
//   3. RESERVA el aviso con un compare-and-set atómico (`cambiarSettingSi(key, null, …)`): de dos llamadas con la misma
//      clave sale UNA. Reservar antes de mandar es lo que hace que «un aviso por arreglo» se cumpla con un reintento;
//   4. manda por la línea de MaKo (`enviarAlGrupoMaKo`, como cualquier aviso al grupo);
//   5. si NO salió, BORRA la reserva («una marca de dedup no es un acuse de recibo», docs/hallazgos-comunicacion.md):
//      sin eso, un Evolution caído dejaba el arreglo «avisado» para siempre sin que nadie lo leyera;
//   6. si salió, deja el registro (qué se dijo, cuándo, con qué prueba, quién lo mandó) y anota el id en el anti-eco del
//      doer, para que MaKo no le conteste a su propio aviso.
// =============================================================================

import 'server-only';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { cambiarSettingSi, setSetting } from '@/lib/settings';
import { enviarAlGrupoMaKo, grupoJidEstricto } from '@/lib/mako-grupo';
import { anotarEnviadoAlGrupo } from '@/lib/mako-doer-in';
import {
  claveDelAviso, textoDelAviso, bloqueoDelWs, avisosDelDia, PREFIJO_REGISTRO_AVISO, TOPE_AVISOS_POR_DIA,
} from '@/lib/aviso-arreglo-reglas';

export type PedidoAviso = {
  /** El negocio al que le falló. */
  ws: number;
  /** UN arreglo: «conv:<id>» (incidente del vigía), «ticket:<n>», «commit:<sha>». */
  clave: string;
  /** Qué falló y que ya anda, en palabras del cliente. La firma la pone esto. */
  texto: string;
  /** Lo que PRUEBA que está en producción («deploy https://… Ready, main 57e27c4 contiene 618c79c4»). Queda escrito. */
  prueba: string;
  /** Quién lo manda («MaKo en WhatsApp», «ticketera»): queda escrito. */
  origen: string;
  /** El ws1 es de Mauricio: sólo a propósito. */
  ws1Seguro?: boolean;
};

export type ResultadoAviso =
  | { ok: true; id: string; clave: string; texto: string }
  | { ok: false; motivo: 'invalido' | 'tope' | 'ya-avisado' | 'sin-grupo' | 'envio' | 'base'; detalle: string };

/** El texto final, sin mandar nada: lo usa el script para mostrar qué saldría. */
export function vistaPrevia(texto: string) {
  return textoDelAviso(texto);
}

export async function avisarArregloAlGrupo(p: PedidoAviso): Promise<ResultadoAviso> {
  const bloqueo = bloqueoDelWs(p.ws, !!p.ws1Seguro);
  if (bloqueo) return { ok: false, motivo: 'invalido', detalle: bloqueo };
  const clave = claveDelAviso(p.clave);
  if (!clave) return { ok: false, motivo: 'invalido', detalle: `la clave «${p.clave}» no sirve (letras, números y :_.-)` };
  const t = textoDelAviso(p.texto);
  if (!t.ok) return { ok: false, motivo: 'invalido', detalle: t.error };
  if (!(p.prueba ?? '').trim()) return { ok: false, motivo: 'invalido', detalle: 'falta la prueba de que el arreglo está en producción' };
  if (!(p.origen ?? '').trim()) return { ok: false, motivo: 'invalido', detalle: 'falta quién lo manda' };
  const key = `${PREFIJO_REGISTRO_AVISO}${clave}`;

  return runWithWorkspace(p.ws, async () => {
    const db = getSupabaseServer();
    // 2. El tope: lo que hay en el registro de las últimas 24 h, también lo que se está mandando.
    const { data: filas, error: eTope } = await db.from('app_settings').select('key, updated_at')
      .eq('workspace_id', p.ws).like('key', `${PREFIJO_REGISTRO_AVISO}%`);
    if (eTope) return { ok: false, motivo: 'base', detalle: `no pude leer el registro: ${eTope.message}` } as const;
    if (avisosDelDia((filas ?? []) as Array<{ key: string; updated_at: string }>, Date.now()) >= TOPE_AVISOS_POR_DIA) {
      return { ok: false, motivo: 'tope', detalle: `ya salieron ${TOPE_AVISOS_POR_DIA} avisos de arreglo a este negocio en 24 h: júntalo con el próximo` } as const;
    }

    // 3. La reserva: atómica, gana una.
    const at = new Date().toISOString();
    const base = { at, origen: p.origen.trim(), prueba: p.prueba.trim().slice(0, 300), texto: t.texto };
    let gano: boolean;
    try { gano = await cambiarSettingSi(key, null, JSON.stringify({ ...base, estado: 'enviando' })); }
    catch (e) { return { ok: false, motivo: 'base', detalle: e instanceof Error ? e.message : String(e) } as const; }
    if (!gano) return { ok: false, motivo: 'ya-avisado', detalle: `este arreglo ya se avisó (o se está avisando) en el ws${p.ws}` } as const;

    // 4. El envío, por la línea de MaKo.
    const env = await enviarAlGrupoMaKo(p.ws, t.texto);
    if (!env.ok) {
      // 5. No salió: la reserva se borra, para que se pueda volver a intentar. Si no se puede borrar, queda
      //    reservada: fail-closed (un aviso de menos, nunca uno de más).
      const { error: eBorrar } = await db.from('app_settings').delete().eq('workspace_id', p.ws).eq('key', key);
      if (eBorrar) console.error(`[aviso-arreglo] ws${p.ws} ${clave}: no salió y no pude soltar la reserva: ${eBorrar.message}`);
      return { ok: false, motivo: env.sinGrupo ? 'sin-grupo' : 'envio', detalle: env.error } as const;
    }

    // 6. Salió: el registro y el anti-eco. Si alguna de las dos falla, el aviso ya salió: se loguea y no se repite.
    await setSetting(key, JSON.stringify({ ...base, estado: 'enviado', id: env.id }))
      .catch((e) => console.error(`[aviso-arreglo] ws${p.ws} ${clave}: salió y no pude escribir el registro: ${e instanceof Error ? e.message : String(e)}`));
    const jid = await grupoJidEstricto(p.ws).catch(() => null);
    if (jid && env.id) await anotarEnviadoAlGrupo(jid, env.id).catch(() => {});
    console.log(`[aviso-arreglo] ws${p.ws} ${clave}: avisado por ${p.origen} (${env.id})`);
    return { ok: true, id: env.id, clave, texto: t.texto } as const;
  });
}
