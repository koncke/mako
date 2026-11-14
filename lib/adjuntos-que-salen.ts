// =============================================================================
// Los ADJUNTOS que salen, con su nombre: en la tarjeta del lienzo y en «Probar» antes de mandar (14/11/2026)
// =============================================================================
// La llamada de Martín con Julio (13/11, min 00:43): al probar el envío de una automatización salió un archivo que Martín no
// reconocía («¿qué te estoy mandando? Debe ser un guion de algo»). Dos cosas lo dejaban pasar sin verse:
//   · la tarjeta del lienzo dibuja las DOS primeras burbujas; un archivo tercero quedaba detrás de «+N mensajes…»;
//   · «Probar en WhatsApp» pide a quién mandar, y no dice qué archivos van.
// Ahora los dos lo dicen con el nombre de cada uno. Y la otra punta (cómo se coló): el borrador de la barra del editor se
// reinyectaba en otra automatización hecha con la misma plantilla (`claveDeTarjeta`, app/automations/EditorMensajeWhatsApp.tsx).
// PURO: lo usan el lienzo, «Probar» y el test.
// =============================================================================

import { partesDe, type ParteMensaje, type PasoConPartes } from './mensaje-partes';

export type AdjuntoQueSale = { tipo: 'archivo' | 'audio'; nombre: string };
type Archivos = ReadonlyArray<{ id: number; nombre: string | null }>;
type Audios = ReadonlyArray<{ id: number; titulo?: string | null }>;

/** Los archivos y audios de estas partes, en orden y sin repetir, con su nombre (el de la biblioteca, o el genérico). */
export function adjuntosDePartes(partes: readonly ParteMensaje[], archivos: Archivos, audios: Audios): AdjuntoQueSale[] {
  const out: AdjuntoQueSale[] = [];
  const vistos = new Set<string>();
  for (const pt of partes) {
    if (pt.tipo === 'texto') continue;
    const clave = `${pt.tipo}:${pt.tipo === 'media' ? pt.media_id : pt.audio_id}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    if (pt.tipo === 'media') {
      const a = archivos.find((x) => x.id === pt.media_id);
      out.push({ tipo: 'archivo', nombre: a?.nombre?.trim() || `Archivo #${pt.media_id}` });
    } else {
      const a = audios.find((x) => x.id === pt.audio_id);
      out.push({ tipo: 'audio', nombre: a?.titulo?.trim() || `Audio #${pt.audio_id}` });
    }
  }
  return out;
}

/** Los de todos estos pasos (cada uno con sus partes, o lo de antes: `partesDe`). */
export function adjuntosQueSalen(pasos: readonly PasoConPartes[], archivos: Archivos, audios: Audios): AdjuntoQueSale[] {
  return adjuntosDePartes(pasos.flatMap((p) => partesDe(p)), archivos, audios);
}

/** «📎 guion.pdf · 🎤 Bienvenida»: cada uno con su nombre, en una línea. Vacío sin adjuntos. */
export function textoAdjuntos(lista: readonly AdjuntoQueSale[]): string {
  return lista.map((a) => `${a.tipo === 'archivo' ? '📎' : '🎤'} ${a.nombre}`).join(' · ');
}

/** Lo que dice «Probar» antes de mandar: qué va adjunto, o null si no va nada. */
export function avisoDeAdjuntos(lista: readonly AdjuntoQueSale[]): string | null {
  if (!lista.length) return null;
  return `${lista.length === 1 ? 'Va adjunto' : `Van ${lista.length} adjuntos`}: ${textoAdjuntos(lista)}`;
}
