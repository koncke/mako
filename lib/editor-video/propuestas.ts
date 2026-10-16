// =============================================================================
// editor-video/propuestas — lo que la API PROPONE en un proyecto del Video Editor (`video_editor_propuestas`, 0302)
// =============================================================================
// Etapa 3 del diseño AI-native: las operaciones del chat pasan a la API (./chat-api.ts), pero el proyecto vive en el
// navegador. Cada acción deja su operación en una PROPUESTA del proyecto; el editor la muestra en su chat y una persona
// la acepta con el mismo «Aceptar» (chat/aplicar.ts → aceptarPropuesta, que la revisa contra la línea de tiempo de
// ESE momento con las refs de la propuesta). La base: ./propuestas-server.ts; el editor: chat/propuestas.ts.
//
// Lo que gobierna, y no se ve en las firmas:
//   · SE REVISA CONTRA LA COPIA AL PROPONER (`revisarContraCopia`): una ref que no está en la línea de tiempo (o que
//     no agregó una operación anterior de la MISMA propuesta) se rechaza en el momento, con el motivo, para que el
//     modelo se corrija; no se descubre recién en el editor. Al aceptar se vuelve a revisar contra lo de ahora.
//   · LO DEL MISMO CANAL SE JUNTA: un pedido («corta las muletillas y pon karaoke») son dos acciones y UNA propuesta,
//     que se acepta de una vez. Hasta el tope del chat, y por un rato (`VENTANA_JUNTAR_MS`): un pedido de mañana no se
//     suma a uno de ayer que nadie miró.
//   · UNA PLANTILLA VA SOLA y con la línea de tiempo VACÍA, como en el chat.
//
// Puro y sin `server-only`: lo leen el server, el editor y los tests.
// =============================================================================

import { TOPES_CHAT, type OperacionChat } from './chat-catalogo';

/** Lo que se junta en una propuesta abierta: lo que llega por el mismo canal en este rato. */
export const VENTANA_JUNTAR_MS = 2 * 60 * 60 * 1000;
/** Las operaciones de una propuesta: el tope del chat (lo que se acepta de una vez). */
export const TOPE_OPERACIONES = TOPES_CHAT.operaciones;

/** Las refs que una operación USA (de la línea de tiempo y de Multimedia) y las que DEFINE («n1»). */
export function refsDeOperacion(op: OperacionChat): { usa: string[]; medios: string[]; define: string[] } {
  const usa: string[] = [];
  const medios: string[] = [];
  const define: string[] = [];
  const o = op as Record<string, unknown>;
  if (op.op === 'agregar_texto' || op.op === 'capa_efecto') {
    if (typeof o.ref === 'string') define.push(o.ref);
  } else if (typeof o.ref === 'string') usa.push(o.ref);
  if (op.op === 'borrar') usa.push(...op.refs);
  if (op.op === 'reemplazar_clip') medios.push(op.medio);
  if (op.op === 'usar_plantilla') medios.push(...Object.values(op.clips));
  return { usa, medios, define };
}

/** Lo que se lee de la vista de la copia (lib/editor-video/espejo.ts): cada ref con cómo se llama, y si está vacía. */
export type LeidoDeVista = { elementos: Map<string, string>; medios: Map<string, string>; vacia: boolean };

export function leerVista(vista: unknown): LeidoDeVista {
  const elementos = new Map<string, string>();
  const medios = new Map<string, string>();
  const v = (vista && typeof vista === 'object' ? vista : {}) as { pistas?: unknown; medios?: unknown };
  for (const p of Array.isArray(v.pistas) ? v.pistas : []) {
    for (const e of Array.isArray((p as { elementos?: unknown })?.elementos) ? (p as { elementos: unknown[] }).elementos : []) {
      const x = e as { ref?: unknown; texto?: unknown; nombre?: unknown };
      if (typeof x.ref !== 'string') continue;
      const nombre = typeof x.texto === 'string' ? `«${x.texto.slice(0, 40)}»` : typeof x.nombre === 'string' ? x.nombre.slice(0, 40) : x.ref;
      elementos.set(x.ref, nombre);
    }
  }
  for (const m of Array.isArray(v.medios) ? v.medios : []) {
    const x = m as { ref?: unknown; nombre?: unknown };
    if (typeof x.ref === 'string') medios.set(x.ref, typeof x.nombre === 'string' ? x.nombre.slice(0, 40) : x.ref);
  }
  return { elementos, medios, vacia: elementos.size === 0 };
}

/**
 * ¿Se puede sumar esta operación a la propuesta, contra la COPIA del proyecto? `previas` son las que ya tiene la
 * propuesta abierta (sus «n1» valen). `vista` null = el proyecto es demasiado grande para la copia: no se puede
 * revisar acá y se deja para el editor, que revisa al aceptar.
 */
export function revisarContraCopia(p: { op: OperacionChat; vista: LeidoDeVista | null; previas: readonly OperacionChat[] }): { ok: true } | { ok: false; motivo: string } {
  const { op, vista, previas } = p;
  if (previas.length >= TOPE_OPERACIONES) {
    return { ok: false, motivo: `la propuesta abierta ya tiene ${TOPE_OPERACIONES} cambios: hay que aceptarla o descartarla en el editor antes de proponer más` };
  }
  if (op.op === 'usar_plantilla') {
    if (previas.length) return { ok: false, motivo: 'una plantilla va sola: hay una propuesta abierta con otros cambios (que se acepte o se descarte en el editor)' };
    if (vista && !vista.vacia) return { ok: false, motivo: `una plantilla se arma con la línea de tiempo VACÍA, y el proyecto tiene ${vista.elementos.size} elementos` };
  }
  if (previas.some((x) => x.op === 'usar_plantilla')) return { ok: false, motivo: 'la propuesta abierta arma una plantilla, que va sola: que se acepte en el editor antes de cambiarle otra cosa' };
  if (!vista) return { ok: true };
  const nuevas = new Set(previas.flatMap((x) => refsDeOperacion(x).define));
  const { usa, medios, define } = refsDeOperacion(op);
  for (const r of usa) {
    if (!vista.elementos.has(r) && !nuevas.has(r)) return { ok: false, motivo: `«${r}» no está en la línea de tiempo (las refs salen de ver_proyecto_video)` };
  }
  for (const m of medios) {
    if (!vista.medios.has(m)) return { ok: false, motivo: `«${m}» no está en Multimedia (los medios salen de ver_proyecto_video)` };
  }
  for (const r of define) {
    if (vista.elementos.has(r) || nuevas.has(r)) return { ok: false, motivo: `«${r}» ya se usa: una ref nueva va con otro número («n2», «n3»…)` };
  }
  return { ok: true };
}

/** La operación en palabras, para la persona y para el modelo: «Cambiar un texto del video: «Hola»». */
export function lineaDeOperacion(titulo: string, op: OperacionChat, vista: LeidoDeVista | null): string {
  const { usa, medios } = refsDeOperacion(op);
  const nombres = [
    ...usa.map((r) => vista?.elementos.get(r) ?? r),
    ...medios.map((m) => vista?.medios.get(m) ?? m),
  ];
  const o = op as Record<string, unknown>;
  const detalle = typeof o.texto === 'string' ? ` → «${o.texto.slice(0, 60)}»` : typeof o.frase === 'string' ? ` «${o.frase.slice(0, 60)}»` : '';
  return `${titulo}${nombres.length ? `: ${nombres.join(', ')}` : ''}${detalle}`.slice(0, 200);
}

/** Por dónde llegó una propuesta, para la persona. */
export const CANAL_TEXTO: Record<string, string> = { whatsapp: 'WhatsApp', app: 'el chat de MaKo', http: 'la API' };
