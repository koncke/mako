// =============================================================================
// El hilo de UNA conversación en el teléfono, armado por día y con la zona del negocio (17/10/2026)
// =============================================================================
// Puro (sin React ni server-only): lo arma la página en el server y lo ejecuta tests/m-chats.test.ts.
// Los mensajes llegan de `hiloDeChat` (lib/chats.ts) ya ordenados del más viejo al más nuevo.
//
// ⚠️ EL DÍA Y LA HORA SALEN DE LA ZONA DEL NEGOCIO, NO DEL RELOJ DEL SERVER. Escritorio usa `armarHilo`
// (app/chats/ventana-reglas.ts), que mira la hora LOCAL del navegador porque dibuja en el cliente; acá se
// dibuja en el server (UTC en Vercel) y con esa función un mensaje de las 22 h de Buenos Aires caía en el
// día siguiente.
// =============================================================================

import type { CanalChat, MensajeChat } from '@/lib/chats-tipos';
import { previewDe } from '@/app/chats/lista-reglas';

export type MediaM =
  | { tipo: 'imagen' | 'audio' | 'video'; url: string }
  | { tipo: 'archivo'; url: string; nombre: string };

export type ItemHiloM = {
  id: string;
  tipo: MensajeChat['tipo'];
  saliente: boolean;
  autor: string | null;
  /** Lo que se lee. En un documento NO es el nombre del archivo (va en `media.nombre`). */
  texto: string | null;
  asunto: string | null;
  media: MediaM | null;
  adjuntos: Array<{ nombre: string; url: string | null }>;
  /** «WhatsApp», «Instagram»… sólo si el hilo trae más de un canal (si no, sobra en cada burbuja). */
  canal: string | null;
  hora: string;
  fallo: boolean;
};

export type DiaHiloM = { dia: string; etiqueta: string; items: ItemHiloM[] };

const NOMBRE_CANAL: Record<CanalChat, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', email: 'Email' };

/** `2026-10-17` en la zona del negocio. */
export function diaEnZona(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const horaEnZona = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);

/** «Hoy», «Ayer» o «vie 10 oct» (con el año si no es éste). */
export function etiquetaDiaM(d: Date, tz: string, ahora: Date): string {
  const dia = diaEnZona(d, tz);
  const hoy = diaEnZona(ahora, tz);
  if (dia === hoy) return 'Hoy';
  if (dia === diaEnZona(new Date(ahora.getTime() - 86_400_000), tz)) return 'Ayer';
  const mismoAnio = dia.slice(0, 4) === hoy.slice(0, 4);
  return new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', ...(mismoAnio ? {} : { year: 'numeric' }) })
    .format(d).replace(/\./g, '');
}

function mediaDe(m: MensajeChat): MediaM | null {
  if (!m.mediaUrl) return null;
  if (m.formato === 'image' || m.formato === 'sticker') return { tipo: 'imagen', url: m.mediaUrl };
  if (m.formato === 'audio') return { tipo: 'audio', url: m.mediaUrl };
  if (m.formato === 'video') return { tipo: 'video', url: m.mediaUrl };
  if (m.formato === 'document') return { tipo: 'archivo', url: m.mediaUrl, nombre: m.texto?.trim() || 'Archivo' };
  return null;
}

/** El texto de un evento, sin las marcas de negrita («Cerrada por **Martín**» → «Cerrada por Martín»). */
const textoEvento = (m: MensajeChat) => (m.partes?.length ? m.partes.map((p) => p.t).join('') : (m.texto ?? '')).trim();

export function diasDelHilo(mensajes: readonly MensajeChat[], tz: string, ahora: Date = new Date()): DiaHiloM[] {
  const canales = new Set(mensajes.filter((m) => m.tipo === 'mensaje' && m.canal).map((m) => m.canal));
  const variosCanales = canales.size > 1;
  const out: DiaHiloM[] = [];
  for (const m of mensajes) {
    const d = new Date(m.fecha);
    if (!Number.isFinite(d.getTime())) continue;
    const dia = diaEnZona(d, tz);
    let grupo = out[out.length - 1];
    if (!grupo || grupo.dia !== dia) { grupo = { dia, etiqueta: etiquetaDiaM(d, tz, ahora), items: [] }; out.push(grupo); }
    const media = m.tipo === 'mensaje' ? mediaDe(m) : null;
    let texto: string | null = m.tipo === 'evento' ? textoEvento(m) : (m.texto?.trim() || null);
    // Un documento trae el NOMBRE del archivo en `texto` (lib/evolution-mensajes.ts): va en el link, no como dicho.
    if (media?.tipo === 'archivo') texto = null;
    // Un adjunto que no se pudo bajar se dice por su tipo, con el rótulo de la lista (`previewDe`, el de escritorio).
    if (m.tipo === 'mensaje' && !texto && !media && !(m.adjuntos?.length) && m.formato !== 'text') texto = previewDe({ ultimoTexto: null, ultimoTipo: m.formato, ultimaFecha: m.fecha });
    grupo.items.push({
      id: m.id,
      tipo: m.tipo,
      saliente: m.saliente,
      autor: m.autor,
      texto,
      asunto: m.asunto?.trim() || null,
      media,
      adjuntos: (m.adjuntos ?? []).map((a) => ({ nombre: a.nombre, url: a.url })),
      canal: variosCanales && m.tipo === 'mensaje' && m.canal ? NOMBRE_CANAL[m.canal] : null,
      hora: horaEnZona(d, tz),
      fallo: m.status === 'failed',
    });
  }
  return out;
}
