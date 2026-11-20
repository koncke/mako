'use client';

// =============================================================================
// Lo que le falta para que MaKo conteste, en UNA línea debajo de la cabecera (13/11/2026)
// =============================================================================
// Medido en producción a 375 (13/11, ws3): en el chat con MaKo del teléfono, el chip «Conectar tu IA» y la franja «Descarga MaKo
// en tu computadora…» iban apilados ARRIBA DE LA CAJA, dos bloques que le comían ~90 px a la conversación. El prototipo aprobado
// (docs/prototipos/mako-mobile-chat.html, `.falta-ia`) lo pone como WhatsApp pone sus avisos: una línea fina pegada a la cabecera,
// el texto a la izquierda y la acción a la derecha. Lo dice lo mismo que la caja de escritorio (PiezasCliente.tsx → CajaDelCliente):
// sin su IA, «Conectar». La caja, con `avisosArriba`, deja de dibujarlo. La franja de la app de escritorio se fue el 20/11/2026:
// ningún chat la pide (lib/chat-mako-reglas.ts).

import { ancla } from '@/app/_ui/guia/ancla';
import { avisoDeIA } from './pantalla-chat';

export const FALTA_IA = 'Conecta tu IA para que MaKo conteste';

export function AvisoDeIA({ iaConectada, onConectar }: {
  iaConectada: boolean | null | undefined;
  onConectar: () => void;
}) {
  if (!avisoDeIA(iaConectada)) return null;
  return (
    <div className="m-chat__aviso" role="note">
      <span className="m-chat__aviso-texto">{FALTA_IA}</span>
      <button type="button" className="m-chat__aviso-boton" onClick={onConectar} {...ancla('mk-conectar')}>Conectar</button>
    </div>
  );
}
