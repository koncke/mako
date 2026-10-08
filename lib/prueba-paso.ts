// =============================================================================
// prueba-paso — «Probar en mi WhatsApp / mi email»: UN mensaje del panel, de verdad
// =============================================================================
// Pedido de Martín (08/10/2026, punto 10): «tampoco veo la opción de probarlo realmente, con el
// número o email del usuario». Molde de ManyChat («In messengers»): con el interruptor prendido,
// cada mensaje que APARECE en el panel de «Probar» sale de verdad al destino escrito ahí.
//
// Qué forma tiene un mensaje y qué envíos produce vive en lib/simulador-grafo.ts (puro, con
// tests: `planDePrueba`). Acá sólo se manda, con los helpers de siempre —los mismos que usa
// `probarSecuencia`—: texto, audio de la biblioteca (+ su pie como segundo mensaje), archivo de la
// biblioteca con su caption, y email.
//
// ⚠️ EL DESTINO NO SE GUARDA. `user_telefono` / `user_email` son el destino de los REPORTES del
// workspace (lib/notif-destinatarios.ts): precargan el campo, pero lo que se escribe en el panel
// es de esta prueba. Guardarlo cambiaría a dónde le llegan los reportes al dueño.
//
// ⚠️ NO TOCA INSCRIPCIONES NI `nutricion_envios`: cero contaminación de las métricas y del freno
// anti-ban, igual que `probarSecuencia`. Lo único que queda es el espejo del saliente en
// `wa_mensajes`, que es lo que hace cualquier envío por la línea.
//
// ⚠️ SALE POR LA LÍNEA DE LA SECUENCIA (`instance_name`): probarla por otra sería probar otra
// cosa. Se lee de la fila guardada (la línea se guarda al elegirla, no con «Publicar»).
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { enviarYEspejar, enviarAudioYEspejar, enviarMediaYEspejar } from './evolution-envio';
import { getAudio, audioBase64 } from './setting-audios';
import { getAdjunto, adjuntoBase64 } from './setting-adjuntos';
import { sendEmail, renderEmailHtml, remitenteEsSandbox } from './resend';
import { planDePrueba, type DestinoPrueba, type MensajePrueba } from './simulador-grafo';

export type ResultadoPruebaPaso = { ok: true; enviados: number } | { ok: false; error: string };

/** image | video | document, como lo pide Evolution `sendMedia`. */
const tipoDeMime = (mime: string): 'image' | 'video' | 'document' =>
  mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'document';

export async function enviarPasoDePrueba(p: {
  secuenciaId: number;
  destino: DestinoPrueba;
  mensaje: MensajePrueba;
  /** Es el primero que sale en esta prueba: lleva el aviso. */
  primero: boolean;
}): Promise<ResultadoPruebaPaso> {
  const { mensaje, destino } = p;
  if (mensaje.canal === 'whatsapp' && !destino.telefono) return { ok: false, error: 'Falta tu número' };
  if (mensaje.canal === 'email' && !destino.email) return { ok: false, error: 'Falta tu email' };

  // La secuencia tiene que ser de ESTE workspace (getTenantDb filtra): un id ajeno no manda nada.
  const { data: sec, error } = await (await getTenantDb())
    .from('nutricion_secuencias').select('id, instance_name').eq('id', p.secuenciaId).maybeSingle();
  if (error) return { ok: false, error: 'No pude leer la automatización' };
  if (!sec) return { ok: false, error: 'Esa automatización no existe' };
  const linea = ((sec as { instance_name?: string | null }).instance_name ?? null) || null;

  if (mensaje.canal === 'email' && await remitenteEsSandbox()) {
    return { ok: false, error: 'Verifica tu dominio para mandar emails' };
  }

  let enviados = 0;
  for (const envio of planDePrueba(mensaje, p.primero)) {
    if (envio.via === 'email') {
      const r = await sendEmail({
        to: destino.email!, subject: envio.asunto,
        html: renderEmailHtml({ subject: envio.asunto, bodyText: envio.texto }), text: envio.texto,
      });
      if (!r.ok) return { ok: false, error: r.error || 'El email no salió' };
      enviados += 1;
      continue;
    }
    const telefono = destino.telefono!;
    if (envio.via === 'wa-texto') {
      const r = await enviarYEspejar({ telefono, texto: envio.texto, linea });
      if (!r.ok) return { ok: false, error: r.error || 'No salió' };
    } else if (envio.via === 'wa-audio') {
      const audio = await getAudio(envio.audioId);
      const b64 = audio ? await audioBase64(audio) : null;
      if (!audio || !b64) return { ok: false, error: 'No pude bajar el audio' };
      const r = await enviarAudioYEspejar({ telefono, base64: b64, mimetype: audio.media_mime, linea });
      if (!r.ok) return { ok: false, error: r.error || 'El audio no salió' };
    } else {
      const adj = await getAdjunto(envio.mediaId);
      const b64 = adj ? await adjuntoBase64(adj) : null;
      if (!adj || !b64) return { ok: false, error: 'No pude bajar el archivo' };
      const r = await enviarMediaYEspejar({
        telefono, linea, caption: envio.caption || undefined,
        media: { base64: b64, mimetype: adj.media_mime, fileName: adj.nombre_archivo || adj.titulo || 'archivo', tipo: tipoDeMime(adj.media_mime) },
      });
      if (!r.ok) return { ok: false, error: r.error || 'El archivo no salió' };
    }
    enviados += 1;
  }
  return { ok: true, enviados };
}
