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
// ⚠️ EL DESTINO ES DE QUIEN PRUEBA, NUNCA DEL NEGOCIO. El desplegable ofrece el teléfono y el email de
// su fila de `usuarios` y los que ESA persona guardó como «Nuevo número» (quinta tanda, punto 1:
// `guardarDestinoDeQuienPrueba`, en su `perfil`); nunca el contacto de reportes del workspace
// (lib/simulador-grafo.ts, `destinoDelQueMira`, `destinosGuardados`).
//
// ⚠️ NO TOCA INSCRIPCIONES NI `nutricion_envios`: cero contaminación de las métricas y del freno
// anti-ban, igual que `probarSecuencia`. Lo único que queda es el espejo del saliente en
// `wa_mensajes`, que es lo que hace cualquier envío por la línea.
//
// ⚠️ SALE POR LA LÍNEA DE LA SECUENCIA (`instance_name`): probarla por otra sería probar otra
// cosa. Se lee de la fila guardada (la línea se guarda al elegirla, no con «Publicar»).
//
// ⚠️ Y CON TOPE POR DESTINO (revisión adversarial del 08/10/2026, datos-4). El panel corre en el
// navegador y no espera las esperas: un «Ir a» que vuelve sobre un mensaje mandaba ~21 WhatsApp
// iguales en segundos por la línea NO oficial. El panel ya no repite una tarjeta, pero el freno
// que no depende del navegador es éste: `TOPE_PRUEBA_REAL` mensajes del panel cada
// `VENTANA_PRUEBA_MIN` minutos por (workspace, destino). Se reclama DESPUÉS de los chequeos que
// pueden cortar —un pedido rechazado no gasta un lugar— y ANTES de mandar.
//
// ⚠️ EL AVISO «🧪 Prueba de MaKo» LO DECIDE TAMBIÉN EL SERVER: el primero a ese destino en la
// ventana lo lleva siempre, diga lo que diga el navegador (`primero` lo sigue pidiendo ↻).
// =============================================================================

import 'server-only';
import { getTenantDb } from './workspace';
import { getSupabaseServer } from './supabase';
import { buscarUsuarioPorEmail } from './usuarios';
import { enviarYEspejar, enviarAudioYEspejar, enviarMediaYEspejar } from './evolution-envio';
import { getAudio, audioBase64 } from './setting-audios';
import { getAdjunto, adjuntoBase64 } from './setting-adjuntos';
import { sendEmail, renderEmailHtml, remitenteEsSandbox } from './resend';
import { reclamarEspaciado } from './espaciado';
import {
  planDePrueba, claveDestinoPrueba, reclamarCupoPrueba, tipoDeMime, VENTANA_PRUEBA_MIN, destinosGuardados, perfilConDestino,
  type DestinoPrueba, type MensajePrueba, type DestinosGuardados,
} from './simulador-grafo';

/**
 * Suma un destino a los GUARDADOS de quien prueba (quinta tanda, punto 1: «primero el desplegable me
 * debe ofrecer los números que ya tiene guardado, y abajo un botón de "Nuevo número"»).
 *
 * ⚠️ EN SU FILA, POR SU EMAIL DE SESIÓN, nunca «viendo como cliente» (`getPerfil` devuelve el admin
 * del cliente) ni en el workspace: son SUS números de prueba. Y el jsonb `perfil` se reescribe desde
 * lo que ya tenía (`perfilConDestino`): adentro viven los campos del formulario y `notifInApp`.
 */
export async function guardarDestinoDeQuienPrueba(email: string, destino: unknown):
  Promise<{ ok: true; guardados: DestinosGuardados } | { ok: false; error: string }> {
  const u = await buscarUsuarioPorEmail(email);
  if (!u) return { ok: false, error: 'Sin usuario propio' };
  const perfil = perfilConDestino((u as { perfil?: unknown }).perfil, (destino && typeof destino === 'object' ? destino : {}) as { telefono?: unknown; email?: unknown });
  if (!perfil) return { ok: false, error: 'Ese destino no sirve' };
  const { error } = await getSupabaseServer().from('usuarios')
    .update({ perfil, updated_at: new Date().toISOString() }).eq('id', (u as { id: number }).id);
  if (error) return { ok: false, error: 'No se guardó' };
  return { ok: true, guardados: destinosGuardados({ email: (u as { email?: unknown }).email, perfil }) };
}

export type ResultadoPruebaPaso = { ok: true; enviados: number } | { ok: false; error: string };

export async function enviarPasoDePrueba(p: {
  /** El workspace del request: el tope se cuenta por (workspace, destino). */
  ws: number;
  secuenciaId: number;
  destino: DestinoPrueba;
  mensaje: MensajePrueba;
  /** Es el primero que sale en esta prueba: lleva el aviso. */
  primero: boolean;
}): Promise<ResultadoPruebaPaso> {
  const { mensaje, destino } = p;
  if (mensaje.canal === 'whatsapp' && !destino.telefono) return { ok: false, error: 'Falta tu número' };
  if (mensaje.canal === 'email' && !destino.email) return { ok: false, error: 'Falta tu email' };
  const clave = claveDestinoPrueba(mensaje, destino);
  if (!clave) return { ok: false, error: 'Falta el destino' };

  // La secuencia tiene que ser de ESTE workspace (getTenantDb filtra): un id ajeno no manda nada.
  const { data: sec, error } = await (await getTenantDb())
    .from('nutricion_secuencias').select('id, instance_name').eq('id', p.secuenciaId).maybeSingle();
  if (error) return { ok: false, error: 'No pude leer la automatización' };
  if (!sec) return { ok: false, error: 'Esa automatización no existe' };
  const linea = ((sec as { instance_name?: string | null }).instance_name ?? null) || null;

  if (mensaje.canal === 'email' && await remitenteEsSandbox()) {
    return { ok: false, error: 'Verifica tu dominio para mandar emails' };
  }

  // El tope. Sin poder contar, no se manda: es la línea no oficial del cliente.
  let hayLugar: boolean;
  try {
    hayLugar = await reclamarCupoPrueba((i) => reclamarEspaciado(p.ws, `prueba-real:${i}`, VENTANA_PRUEBA_MIN, clave));
  } catch (e) {
    console.error(`[prueba-paso] no pude contar el tope: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, error: 'No pude comprobar el tope' };
  }
  if (!hayLugar) return { ok: false, error: 'Muchas pruebas: espera unos minutos' };

  // El aviso: si no se puede saber si ya salió uno, va (un aviso de más no daña a nadie).
  const primeroEnVentana = await reclamarEspaciado(p.ws, 'prueba-aviso', VENTANA_PRUEBA_MIN, clave).catch(() => true);
  const primero = p.primero || primeroEnVentana;

  let enviados = 0;
  for (const envio of planDePrueba(mensaje, primero)) {
    if (envio.via === 'email') {
      // Con el HTML del editor rico (parte C de la tercera tanda): sin `bodyHtml`, la prueba mandaba el
      // texto plano de respaldo y no el email que se ve en la bandeja. `renderEmailHtml` lo vuelve a sanear.
      const r = await sendEmail({
        to: destino.email!, subject: envio.asunto,
        html: renderEmailHtml({ subject: envio.asunto, bodyText: envio.texto, bodyHtml: envio.html || undefined }), text: envio.texto,
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
