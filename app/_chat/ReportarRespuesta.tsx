'use client';

// =============================================================================
// ReportarRespuesta — denunciar una respuesta de MaKo desde el mismo mensaje (Play, contenido generado por IA, 3/11/2026)
// =============================================================================
// Play: las apps que generan contenido con IA tienen que dejar marcar lo ofensivo «without needing to exit the app», y usar esos
// reportes para moderar (support.google.com/googleplay/android-developer/answer/13985936). Referencia: el «Reportar» debajo de una
// respuesta de ChatGPT, chico y sin caja. Sale por el «Reportar a Soporte» de siempre: un ticket en la Ticketera con un solo
// pedazo del mensaje, saneado en el servidor (lib/soporte-reporte.ts: sin claves, sin emails ni teléfonos, sin nombres).
// La misma pieza denuncia lo que publica OTRA persona en Community (`que`): Apple (1.2) y Play piden las dos cosas.

import { useState, type CSSProperties } from 'react';
import { reportarASoporte } from '@/app/_ui/ReportarASoporte';
import { ROTULO_MANDADO, TOPE_ERROR } from '@/lib/soporte-reporte';

// Estilo en línea: lo dibujan el chat y Community, cada uno con SU hoja.
const S: CSSProperties = { display: 'block', marginTop: 4, padding: 0, border: 0, background: 'none', color: 'var(--dim)', font: 'inherit', fontSize: 12, cursor: 'pointer' };

export function ReportarRespuesta({ texto, que = 'una respuesta de MaKo' }: { texto: string; que?: string }) {
  const [estado, setEstado] = useState<'listo' | 'mandando' | 'mandado' | 'fallo'>('listo');
  const mandar = async () => {
    setEstado('mandando');
    const r = await reportarASoporte({ error: `Reportó ${que}: ${texto}`.slice(0, TOPE_ERROR), accion: `Reportar ${que}`.slice(0, 60) });
    setEstado(r.ok ? 'mandado' : 'fallo');
  };
  if (estado === 'mandado') return <span style={S} role="status">{ROTULO_MANDADO}</span>;
  return (
    <button type="button" style={S} data-soporte disabled={estado === 'mandando'} onClick={() => { void mandar(); }}>
      {estado === 'fallo' ? 'No salió. Reportar otra vez' : 'Reportar'}
    </button>
  );
}
