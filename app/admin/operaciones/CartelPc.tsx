'use client';

// =============================================================================
// El cartel rojo de arriba del Ops Center: la PC no da noticias, o nadie entrega (30/10/2026)
// =============================================================================
// El Runner estuvo parado del 24/10 al 30/10 y nadie se enteró: lo único que lo decía era un renglón gris, sólo en la computadora. Sale
// en la computadora y en el teléfono, al lado del cartel de los mensajes sin entregar (CartelLimbo.tsx). Lo decide MaKo con sus propios
// datos (`cartelDeLaPc`, lib/centro-chats.ts), sin pedirle nada a la PC.

import { Icon } from '@/app/_components/icons';
import { COMANDO_TERMINAL, tieneTerminal } from '@/lib/runner';
import type { Centro } from './useCentro';

/** `conComando`: la computadora copia el comando que abre el Runner, el mismo del panel de Runners. En el teléfono no hay dónde pegarlo. */
export function CartelPc({ centro: k, conComando }: { centro: Centro; conComando?: boolean }) {
  const c = k.cartelPc;
  if (!c) return null;
  const comando = conComando && c.cuenta && tieneTerminal(c.cuenta) ? COMANDO_TERMINAL(c.cuenta) : null;
  return (
    <div className="co-cartel-pc" role="alert">
      <p className="co-cartel-pc__texto">{c.texto}</p>
      <p className="co-cartel-pc__hacer">{c.hacer}</p>
      {comando && (
        <button type="button" className="co-chip" onClick={() => void k.copiarConAviso(comando, 'Copiado: pégalo en PowerShell')}><Icon name="copy" size={14} />Copiar comando</button>
      )}
    </div>
  );
}
