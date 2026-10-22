// =============================================================================
// hilo-agente — la charla del agente del Web Generator queda en la BASE y sobrevive a recargar (22/10/2026; puro)
// =============================================================================
// Hasta el 22/10/2026 vivía en la memoria de la pestaña (el store de paneles/PanelAgente.tsx): se perdía al recargar y
// nunca llegaba al Ops Center. Martín: «¿Todos esos chats regresan y se quedan registrados en Ops Center?». Ahora cada
// turno se guarda en `chart_sessions` con la clave `landing:<id>` (lib/hilo-de-tab-reglas.ts, /api/hilo-de-tab), y al
// abrir una landing sin charla en la pestaña se trae la guardada.
//
// ⚠️ SE GUARDA LO QUE SE DIJO, NO LA PROPUESTA. La propuesta («Original | Modificado») trae secciones enteras y es de ESA
//    página en ESE momento: después de recargar, lo aceptado ya está en el documento y lo pendiente se vuelve a pedir. Las
//    burbujas de pedidos de otra landing tampoco (sus botones navegan desde ESTA sesión).
// ⚠️ UN MENSAJE ES UN SOLO TEXTO EN LA BASE: los archivos que viajaron con el pedido van en un renglón «Adjuntos: …», y
//    al volver se separan de nuevo en sus chips.
// =============================================================================

import { filaDeError, textoDeError, type FilaHilo } from '@/lib/hilo-de-tab-reglas';

/** Lo que este módulo necesita de un mensaje del panel (el tipo entero vive en paneles/PanelAgente.tsx). */
export type MensajeAgente =
  | { de: 'yo'; texto: string; adjuntos?: readonly string[] }
  | { de: 'mako'; texto: string; error?: boolean }
  | { de: 'pedido' };

/** Un mensaje que vuelve de la base, sin id (lo pone el panel). */
export type MensajeGuardado =
  | { de: 'yo'; texto: string; seccion: null; adjuntos?: string[] }
  | { de: 'mako'; texto: string; error?: boolean };

const ADJUNTOS = 'Adjuntos: ';

/** Los mensajes del panel como se guardan. Las burbujas de pedido no se guardan. */
export function filasDeAgente(ms: readonly MensajeAgente[]): FilaHilo[] {
  return ms.flatMap((m): FilaHilo[] => {
    if (m.de === 'yo') {
      const content = [m.texto.trim(), m.adjuntos?.length ? `${ADJUNTOS}${m.adjuntos.join(', ')}` : ''].filter(Boolean).join('\n');
      return content ? [{ role: 'user', content }] : [];
    }
    if (m.de === 'mako') {
      const t = m.texto.trim();
      if (!t) return [];
      return [m.error ? filaDeError(t) : { role: 'assistant', content: t }];
    }
    return [];
  });
}

/** Lo guardado, de vuelta como mensajes del panel. */
export function mensajesDeFilas(filas: readonly FilaHilo[]): MensajeGuardado[] {
  return filas.flatMap((f): MensajeGuardado[] => {
    const c = typeof f?.content === 'string' ? f.content : '';
    if (!c) return [];
    if (f.role === 'user') {
      const renglones = c.split('\n');
      const ultimo = renglones[renglones.length - 1];
      if (renglones.length && ultimo.startsWith(ADJUNTOS)) {
        const adjuntos = ultimo.slice(ADJUNTOS.length).split(', ').filter(Boolean);
        return [{ de: 'yo', texto: renglones.slice(0, -1).join('\n'), seccion: null, ...(adjuntos.length ? { adjuntos } : {}) }];
      }
      return [{ de: 'yo', texto: c, seccion: null }];
    }
    const err = textoDeError(c);
    return [err != null ? { de: 'mako', texto: err, error: true } : { de: 'mako', texto: c }];
  });
}

/** El título de la charla en el Ops Center. */
export const tituloDeLanding = (titulo: string | null | undefined): string => `Web Generator · ${(titulo ?? '').trim() || 'Landing'}`;
