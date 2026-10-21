'use client';

// =============================================================================
// El comprobante que la persona adjuntó en el chat con MaKo (20/10/2026, Ops Center = lo principal, la 2.28)
// =============================================================================
// El estado de cuenta del hilo (app/_chat/bloques/EstadoCuentaHilo.tsx) monta la pieza de la tab Pagos tal cual, y le
// pasa por acá el archivo del mensaje. «Cobrar la cuota» lo usa: el modal «Marcar pagada» (./piezas.tsx) lo lee solo al
// abrirse, con el MISMO camino que «Subir el comprobante» de la ficha (/api/extract-receipt: lo guarda en la cuota y
// lee monto, fecha y hora), y deja los campos listos para revisar y guardar. Sin chat (la ficha, Clients), es null.

import { createContext } from 'react';

export type ComprobanteDelChat = {
  nombre: string;
  /** Baja el archivo del chat (`/api/mako/chat?adjunto=`) como un `File`, el mismo que daría el selector de archivos. */
  leer: () => Promise<File>;
};

export const ComprobanteDelChatCtx = createContext<ComprobanteDelChat | null>(null);
