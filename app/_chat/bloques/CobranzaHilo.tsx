'use client';

// =============================================================================
// «A quién cobrar» en el hilo con MaKo (20/10/2026, Ops Center = lo principal, la 2.27)
// =============================================================================
// El G7 de Pagos (docs/ops-center-principal/mapa-pagos-cuenta.md): la lista de la tab General, con la MISMA pieza
// (app/general/Cobranza.tsx): la inicial en un círculo del color de su urgencia, lo que debe, cuándo vence, «Cobrada» con
// Deshacer en cada cuota y «Abrir» en una suscripción (se registra el mes en su ficha). Se ve igual en la computadora y en
// el teléfono: la dibuja app/_chat/BloqueHilo.tsx, que usan los dos.
//
// ⚠️ LO GUARDADO ES LA FOTO DEL MOMENTO: al montarse se vuelve a leer (./cobranza-actions.ts) y, hasta que llega, se ve
//    sin acciones. Marcar una fila vieja le reescribiría la fecha a un cobro que ya entró.
// ⚠️ SIN `router.refresh()`: en el chat no hay nada de la página que cambie con un cobro; después de marcar o deshacer
//    se vuelve a leer la lista (`alCambiar`), y el cliente vuelve si le queda otra cuota.
// ⚠️ La pieza trae los estilos de los bloques de General (`CSS_BLOQUES`, `gb-*`): se montan una sola vez por página
//    (`<style href precedence>` de React 19) y miden contra el ancho del bloque (`container-type`), no el de la pantalla.

import { useCallback, useEffect, useState } from 'react';
import { Cobranza } from '@/app/general/Cobranza';
import { CSS_BLOQUES } from '@/app/general/bloques/comun';
import { rotuloVentana } from '@/lib/pagos-bloque';
import type { BloqueCobranza, FilaCobranza } from '@/lib/chat-bloques';
import { leerCobranzaDelHilo } from './cobranza-actions';

/** La fecha de la foto («20/10»), para cuando la lista viva no se pudo leer. */
const diaMes = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

export default function CobranzaHilo({ b }: { b: BloqueCobranza }) {
  const [viva, setViva] = useState<{ filas: FilaCobranza[]; tz: string } | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const desde = b.ventana?.desde ?? null;
  const hasta = b.ventana?.hasta ?? null;

  const releer = useCallback(() => {
    leerCobranzaDelHilo(desde && hasta ? { desde, hasta } : null).then(
      (r) => { if (r.ok) { setViva({ filas: r.filas, tz: r.tz }); setFallo(null); } else setFallo(r.error); },
      () => setFallo('No pude leer la cobranza.'),
    );
  }, [desde, hasta]);
  useEffect(() => { releer(); }, [releer]);

  return (
    <div className="ch-bloque" data-bloque="cobranza" style={{ containerType: 'inline-size' }}>
      <style href="mako-gb-bloques" precedence="default">{CSS_BLOQUES}</style>
      <Cobranza filas={viva?.filas ?? b.filas} tz={viva?.tz ?? b.tz} error={null} alcance={rotuloVentana(b.ventana)}
        limite={5} muestra={!viva} total={viva ? undefined : b.total} alCambiar={releer} />
      {!viva && (
        <p className="ch-tarjeta__nota" role="status">
          {fallo ? `${fallo} Así estaba el ${diaMes(b.al)}.` : 'Actualizando la lista…'}
        </p>
      )}
    </div>
  );
}
