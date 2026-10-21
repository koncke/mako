'use client';

// =============================================================================
// El estado de cuenta de un lead en el hilo con MaKo (20/10/2026, Ops Center = lo principal, la 2.28)
// =============================================================================
// Qué debe, qué pagó y qué toca hacer, con LA pieza de la tab Pagos: el bloque «Estado de cuenta» (`cobrado`,
// app/crm/lead-view/ficha/pagos/bloques-cobro.tsx) montado como lo monta Clients (`BloquesDePagos`,
// app/customer-success/PagosCliente.tsx): la misma lectura (`getLeadFullAction`) y el mismo botón (cobrar la cuota,
// registrar el pago o la mensualidad). Muestra lo mismo que la ficha porque ES la ficha, y se lee al dibujarse: lo
// guardado en el hilo es sólo a quién mira. «Abrir la ficha» lleva a la tab Pagos para lo demás.
//
// ⚠️ EL COMPROBANTE DEL MENSAJE (`b.comprobante`) le llega al modal «Marcar pagada» por `ComprobanteDelChatCtx`: al
//    cobrar la cuota, se lee solo (monto, fecha y hora) y queda listo para revisar y guardar. Va atado a SU cuota
//    (`pagoId`, 21/10/2026): la marca de «ya usado» en memoria no sobrevivía una recarga, y el bloque que volvía del
//    historial subía el recibo viejo a la cuota siguiente. Ahora la pieza de la tab lo ofrece sólo para esa cuota, y
//    mientras siga impaga (./cobrar.tsx, `useCobrar`); la nota de que lo va a leer la dibuja ella, junto al botón.

import { useMemo } from 'react';
import Link, { useWs } from '@/app/_ui/Link';
import { BloquesDePagos } from '@/app/customer-success/PagosCliente';
import { ComprobanteDelChatCtx, type ComprobanteDelChat } from '@/app/crm/lead-view/ficha/pagos/comprobante-del-chat';
import { conWs } from '@/lib/ws-tab';
import { bloqueDef } from '@/lib/ficha/catalogo';
import type { BloquePuesto } from '@/lib/ficha/config';
import type { BloqueEstadoCuenta } from '@/lib/chat-bloques';
import { rutaDeArchivo } from '@/app/m/mako/chat-ui';

/** Sólo el «Estado de cuenta» de la tab Pagos, con su diseño de entrada (como `listaFijaDeCs`) y a todo el ancho del
 *  bloque: en la grilla de la ficha va a media fila (6 de 12), que en el hilo es la mitad de una burbuja. */
const LISTA: BloquePuesto[] = (() => {
  const def = bloqueDef('cobrado');
  return def ? [{ id: 'cobrado', ancho: 12, diseno: def.disenos[0]?.id ?? '' }] : [];
})();
const nada = () => {};

export default function EstadoCuentaHilo({ b }: { b: BloqueEstadoCuenta }) {
  const ws = useWs();
  const archivo = b.comprobante;
  const comprobante = useMemo<ComprobanteDelChat | null>(() => (!archivo ? null : {
    nombre: archivo.nombre,
    pagoId: archivo.pagoId,
    leer: async () => {
      const r = await fetch(conWs(rutaDeArchivo(archivo.ref), ws));
      if (!r.ok) throw new Error(r.status === 404 ? 'ya no está guardado' : `respondió ${r.status}`);
      const blob = await r.blob();
      return new File([blob], archivo.nombre, { type: blob.type || (archivo.tipo === 'document' ? 'application/pdf' : 'image/jpeg') });
    },
  }), [archivo, ws]);

  return (
    <div className="ch-bloque" data-bloque="estado_cuenta">
      <p className="ch-bloque__titulo">{b.nombre}</p>
      <ComprobanteDelChatCtx.Provider value={comprobante}>
        <BloquesDePagos leadId={b.leadId} lista={LISTA} que="su estado de cuenta" onCambio={nada} />
      </ComprobanteDelChatCtx.Provider>
      <div className="ch-tarjeta__botones"><Link className="ch-abrir" href={`/crm/${b.leadId}?tab=pagos`}>Abrir la ficha</Link></div>
    </div>
  );
}
