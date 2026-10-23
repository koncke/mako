// =============================================================================
// pregunta-grafico — el MaKo de un gráfico pregunta en la ESTRELLA, no en un modal propio (22/10/2026, TB3; puro)
// =============================================================================
// Martín, 21/10: «el chat de MaKo en las otras tabs se debe abrir siempre a la izquierda… se envía lo que sea que envíen al
// cerebro y ya el cerebro se encarga de repartir». Y el 22/10: «quiero que todos los chats de MaKo en las tabs sean el del
// Ops Center». El botón de MaKo de cada gráfico (`ChatMakoGrafico`, ./PanelAnalista.tsx) y el «Preguntarle a MaKo» del clic
// derecho abrían un modal con su chat propio (`MakoChat`, /api/chart-insights). Ahora le mandan el gráfico a la estrella de
// la tab (app/_chat/MakoEnLaTab.tsx, que monta EditorInforme.tsx): la pregunta sale al Cerebro de la persona con lo que el
// gráfico muestra, la hoja como entidad (OC6, lib/chat-desde.ts) y en modo «analizar» (en vista, MaKo asesora: no toca nada).
//
// ⚠️ POR UN EVENTO DE LA VENTANA y no por props: el botón vive adentro de cada tarjeta (y lo dibuja un test en node), y la
//    estrella una sola vez en el editor. El botón no importa la estrella (que trae su CSS y no carga en node).
// ⚠️ LO QUE VIAJA ES `contextoDeGrafico` (./exportar.ts): los números con las personas ya reemplazadas por alias. Es lo mismo
//    que le llegaba al modelo por el chat de antes; ahora además se ve en el mensaje.
// SIN imports de valores: lo usan la tarjeta, el editor y los tests.
// =============================================================================

/** El nombre del evento con que un gráfico le pide a la estrella. */
export const EVENTO_PREGUNTA_GRAFICO = 'mako:pregunta-grafico';

export type PreguntaGrafico = { titulo: string; contexto: string };

const TOPE_CONTEXTO = 6000;

/** Lo que sale al Cerebro: qué se pide y, abajo, lo que el gráfico muestra (sin personas). */
export function textoDePregunta(p: PreguntaGrafico): string {
  const titulo = p.titulo.trim().replace(/\s+/g, ' ').slice(0, 120) || 'este gráfico';
  const contexto = p.contexto.trim().slice(0, TOPE_CONTEXTO);
  const pedido = `Analiza el gráfico «${titulo}»: qué es lo más importante y qué haría esta semana.`;
  return contexto ? `${pedido}\n\n${contexto}` : pedido;
}

/** La hoja abierta como entidad de la estrella (OC6: `hoja` → `hojaId` por defecto en las herramientas). */
export const entidadDeHoja = (h: { id: string; nombre?: string | null }) =>
  ({ tipo: 'hoja' as const, id: h.id, titulo: (h.nombre ?? '').trim() || 'Hoja' });

/** El botón de un gráfico le pide a la estrella. Sin ventana (el server, un test), no hace nada. */
export function preguntarDelGrafico(p: PreguntaGrafico): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PreguntaGrafico>(EVENTO_PREGUNTA_GRAFICO, { detail: p }));
}

/** Lo que llegó en el evento, si es una pregunta (cualquiera puede despachar un evento con ese nombre). */
export function preguntaDelEvento(e: Event): PreguntaGrafico | null {
  const d = (e as CustomEvent<unknown>).detail as Partial<PreguntaGrafico> | null | undefined;
  return d && typeof d.titulo === 'string' && typeof d.contexto === 'string' ? { titulo: d.titulo, contexto: d.contexto } : null;
}
