// =============================================================================
// mako-tarjeta-envio — las partes de una tarjeta «MaKo en WhatsApp», listas para el grupo (server)
// =============================================================================
// Lo puro (qué es una parte preparada, en qué orden se baja y se manda) vive en lib/mako-tarjeta.ts, con
// test. Acá están las lecturas de la base: los audios y los archivos de ESTE negocio (`getTenantDb`: un id de
// otro negocio da null). Lo usan el registro (`avisar_al_equipo`, chatbot.run.ts) y, desde la ola 2, la fila
// de un Evento de MaKo con partes (lib/flujos.ts).
//
// Corre adentro del workspace del aviso (`runWithWorkspace`): `ejecutarDesdeFlujo` y el registro ya lo fijan.
// =============================================================================

import 'server-only';
import { getAudio, getAudioConOrigen, audioBase64 } from './setting-audios';
import { getAdjunto, adjuntoBase64 } from './setting-adjuntos';
import { mediaDeAdjunto } from './nutricion-grafo-motor';
import { prepararPartes, type PartePreparada } from './mako-tarjeta';
import { ORIGEN_VOZ_MAKO } from './voz-mako-reglas';
import type { ParteMensaje } from './mensaje-partes';

/**
 * Las partes listas para salir: TODOS los binarios bajados antes de mandar nada, y cada texto resuelto con
 * `resolver` (los datos «{ }» del aviso al equipo: `textoDelAviso`, chatbot.run.ts).
 */
export async function prepararPartesGrupo(
  lista: readonly ParteMensaje[],
  resolver: (t: string) => Promise<string>,
): Promise<{ ok: true; partes: PartePreparada[] } | { ok: false; error: string }> {
  return prepararPartes(lista, {
    audio: async (id) => {
      const a = await getAudio(id);
      if (!a) return 'no-existe';
      const b64 = await audioBase64(a);
      return b64 ? { base64: b64, mime: a.media_mime || 'audio/mpeg' } : null;
    },
    archivo: async (id) => {
      const a = await getAdjunto(id);
      if (!a) return 'no-existe';
      const b64 = await adjuntoBase64(a);
      return b64 ? { base64: b64, media: mediaDeAdjunto(a) } : null;
    },
    texto: resolver,
  });
}

/**
 * Por qué las partes de una tarjeta no se pueden mandar desde ESTE negocio, o null. Lo pregunta el registro
 * al PREPARAR (antes del «sí» y antes de correr en un flujo):
 *   · un audio o un archivo que no es de este negocio (`getTenantDb`: el de otro da null);
 *   · un audio que no es la Voz de MaKo: el grupo no recibe la voz del dueño, sería suplantarlo.
 */
export async function problemaDePartesGrupo(lista: readonly ParteMensaje[]): Promise<string | null> {
  for (const p of lista) {
    if (p.tipo === 'audio') {
      const a = await getAudioConOrigen(p.audio_id);
      if (!a) return `No existe el audio #${p.audio_id} en este negocio.`;
      if (a.origen !== ORIGEN_VOZ_MAKO) return `El audio #${p.audio_id} no es la Voz de MaKo.`;
    } else if (p.tipo === 'media') {
      if (!(await getAdjunto(p.media_id))) return `No existe el archivo #${p.media_id} en este negocio.`;
    }
  }
  return null;
}
