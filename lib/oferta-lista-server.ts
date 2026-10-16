// =============================================================================
// oferta-lista-server — emite el evento de la plataforma `oferta_lista` al terminar el armado
// =============================================================================
// Lo llama el armado en el servidor (app/api/offer/route.ts, `armarPorDetras`). Los datos, puros y con test, en
// lib/oferta-lista.ts. Lo corre la automatización del SuperAdmin (la fila del ws 9 que crea
// scripts/mudanza-avisos-plataforma.mts) y su tarjeta «MaKo en WhatsApp» le llega al grupo del negocio.

import 'server-only';
import { emitirEventoDePlataforma } from './avisos';
import { linkApp } from './app-url';
import { datosOfertaLista, RUTA_OFERTA_LISTA } from './oferta-lista';
import type { FilaOffer } from './offer-sesiones';

/**
 * El aviso de la oferta que quedó lista. NUNCA tira: la oferta ya está guardada y en el chat, y un aviso que no
 * salió no la deshace. Sin fila de la plataforma (`filas: 0`, antes de correr la mudanza) no manda nada: no hay un
 * camino viejo al que volver, y mandar algo por fuera sería MaKo por detrás.
 */
export async function avisarOfertaLista(ws: number, fila: FilaOffer): Promise<void> {
  try {
    const ultima = fila.conclusiones[fila.conclusiones.length - 1];
    if (!ultima) return;
    const datos = datosOfertaLista({ nombre: ultima.propuesta?.nombre, version: ultima.version, link: linkApp(RUTA_OFERTA_LISTA, ws) });
    const r = await emitirEventoDePlataforma('oferta-lista', { ws, datos });
    if (r.filas === 0) console.warn(`[offer:aviso] la oferta de #${fila.id} quedó lista, pero la plataforma todavía no tiene la automatización «oferta_lista»`);
  } catch (e) {
    console.error(`[offer:aviso] no pude avisar la oferta lista de #${fila.id}:`, e instanceof Error ? e.message : e);
  }
}
