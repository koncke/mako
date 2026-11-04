'use client';

// =============================================================================
// ReportarRespuesta — denunciar una respuesta de MaKo desde el mismo mensaje (Play, contenido generado por IA, 3/11/2026)
// =============================================================================
// Play: las apps que generan contenido con IA tienen que dejar marcar lo ofensivo «without needing to exit the app», y usar esos
// reportes para moderar (support.google.com/googleplay/android-developer/answer/13985936). Sale por el «Reportar a Soporte» de
// siempre: un ticket en la Ticketera con un solo pedazo del mensaje, saneado en el servidor (lib/soporte-reporte.ts: sin claves,
// sin emails ni teléfonos, sin nombres).
//
// EN EL MENÚ DEL MENSAJE, NO DEBAJO (4/11/2026, ticket #57; Martín: «Debajo del mensaje de funnel coach me aparecia un botón de
// "reportar" eso no tiene sentido»). Una respuesta de MaKo se reporta con clic derecho o manteniéndola apretada, como «Reportar»
// en el menú de un mensaje de WhatsApp o de Gemini: `useReportarRespuesta` lo usan el menú de la casa
// (app/admin/operaciones/MensajeWA.tsx → `reportable`) y el mínimo de los chats embebidos (./HiloMako.tsx). Al tocarlo, un
// aviso abajo dice «Lo mandamos al equipo».
//
// El botón suelto (`ReportarRespuesta`) queda para lo que publica OTRA persona en Community (`que`): Apple (1.2) y Play piden
// las dos cosas, y una publicación no tiene menú de mensaje.

import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { reportarASoporte } from '@/app/_ui/ReportarASoporte';
import { Toast, useToast } from '@/app/_ui/Toast';
import { ROTULO_MANDADO, TOPE_ERROR } from '@/lib/soporte-reporte';

/** Lo que se dice cuando el reporte no salió: qué hacer, no el estado. */
export const REPORTE_NO_SALIO = 'No salió el reporte: vuelve a tocar «Reportar» en el mensaje.';

/** Manda el reporte: un pedazo del mensaje, por el mismo camino que «Reportar a Soporte». */
export async function mandarReporte(texto: string, que = 'una respuesta de MaKo'): Promise<{ ok: boolean }> {
  const r = await reportarASoporte({ error: `Reportó ${que}: ${texto}`.slice(0, TOPE_ERROR), accion: `Reportar ${que}`.slice(0, 60) });
  return { ok: !!r.ok };
}

/**
 * Reportar desde el menú de un mensaje: `reportar(texto)` manda y `aviso` dice cómo salió. El aviso va por portal al `body`
 * (el menú vive adentro de hojas con `transform`, donde un `position: fixed` queda encerrado).
 */
export function useReportarRespuesta(que = 'una respuesta de MaKo'): { reportar: (texto: string) => Promise<void>; aviso: ReactNode } {
  const { toast, show, clear } = useToast();
  const reportar = useCallback(async (texto: string) => {
    const r = await mandarReporte(texto, que);
    show(r.ok ? ROTULO_MANDADO : REPORTE_NO_SALIO, undefined, r.ok ? undefined : 'warn');
  }, [que, show]);
  const aviso = toast && typeof document !== 'undefined' ? createPortal(<Toast state={toast} onClose={clear} />, document.body) : null;
  return { reportar, aviso };
}

// Estilo en línea: lo dibuja Community, con SU hoja.
const S: CSSProperties = { display: 'block', marginTop: 4, padding: 0, border: 0, background: 'none', color: 'var(--dim)', font: 'inherit', fontSize: 12, cursor: 'pointer' };

/** El «Reportar» suelto de lo que publica otra persona en Community (una publicación no tiene menú de mensaje). */
export function ReportarRespuesta({ texto, que = 'una respuesta de MaKo' }: { texto: string; que?: string }) {
  const [estado, setEstado] = useState<'listo' | 'mandando' | 'mandado' | 'fallo'>('listo');
  const mandar = async () => {
    setEstado('mandando');
    const r = await mandarReporte(texto, que);
    setEstado(r.ok ? 'mandado' : 'fallo');
  };
  if (estado === 'mandado') return <span style={S} role="status">{ROTULO_MANDADO}</span>;
  return (
    <button type="button" style={S} data-soporte disabled={estado === 'mandando'} onClick={() => { void mandar(); }}>
      {estado === 'fallo' ? 'No salió. Reportar otra vez' : 'Reportar'}
    </button>
  );
}
