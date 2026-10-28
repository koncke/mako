'use client';

// =============================================================================
// «Nuevo chat»: la caja de escribir, la ÚNICA (28/10/2026; el motor está en ChatNuevo.tsx y lo demás en ChatNuevoPiezas.tsx)
// =============================================================================
// Martín (28/10): «Revisa... que esté unificado, que se pueda utilizar el chat de la misma manera en todos lados». Hasta acá el
// chat nuevo tenía su propia caja (un campo, los emojis y el micrófono, sin adjuntar): ahora es la de todos los chats del Centro
// (app/_chat/CajaChat.tsx), con el «+» (Documento, Fotos, Cámara y Pegar), arrastrar, pegar una captura, los emojis y el
// micrófono. Sólo para el primer mensaje: después de mandarlo, el chat de verdad toma su lugar.
// ⚠️ APARTE DE LAS PIEZAS: CajaChat trae su CSS, y ChatNuevoPiezas.tsx se dibuja en un test (en node un `.css` no carga).
// La nota de voz sale EN EL ACTO (`onGrabada` → ChatNuevo.tsx → mandarNota); lo adjuntado sale con el mensaje (→ salir).

import { CajaChat } from '@/app/_chat/CajaChat';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import type { ChatNuevo } from './ChatNuevoPiezas';

/** `movil` usa las clases de la hoja del teléfono, y ahí Enter baja de renglón (se manda con el botón). */
export function CajaChatNuevo({ n, movil = false }: { n: ChatNuevo; movil?: boolean }) {
  const caja = (
    <CajaChat texto={n.texto} onTexto={n.setTexto} onMandar={() => void n.mandar()} onGrabada={n.mandarNota}
      enviando={n.fase === 'pasando' || n.fase === 'decidiendo'} apagado={n.fase !== 'escribiendo'}
      placeholder="Escribe lo que necesitas" tituloMandar="Mandar (Enter)" enterManda={!movil}
      adjuntos={n.adjuntos} campo={n.caja} altoMax={movil ? null : undefined} fila={movil ? 'm-operaciones-caja__fila' : 'co-caja__fila'} />
  );
  const error = n.errorNota && <p className="co-caja__estado" role="alert">{n.errorNota}<ReportarASoporte /></p>;
  return movil
    ? <div className="m-operaciones-caja">{caja}{error}</div>
    : <div className="co-caja-wrap"><div className="co-caja">{caja}{error}</div></div>;
}
