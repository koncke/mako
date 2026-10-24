'use client';

// =============================================================================
// ReferidosM — MaKo Partners en el teléfono para el negocio que NO es agencia (24/10/2026)
// =============================================================================
// Desde el 24/10 la fila «MaKo Partners» la ve el admin de cualquier negocio (app/_components/nav.ts). En la computadora
// es /partners/referidos: arriba lo que vende la idea, abajo el tablero. El teléfono lo DESTILA: una frase que lo explica,
// el link con «Copiar», lo acumulado y en qué va cada referido. Los datos, los mismos (`tableroDe`).
// =============================================================================

import { CabeceraM, FilaDatoM, ListaM, PildoraM, SeccionM, VacioM, useToastM } from '@/app/m/_ui';
import { Button } from '@/app/_ui/Button';
import { TEXTO_ESTADO_REFERIDO, PAGOS_PARA_ACREDITAR, textoSinReferidos } from '@/lib/partners-reglas';
import type { Tablero } from '@/lib/partners-programa';
import { RUTA_MAS } from '@/lib/movil-rutas';

const usd = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export function ReferidosM({ tablero, cobraEnLinea = true, emailMako }: { tablero: Tablero; cobraEnLinea?: boolean; emailMako: string }) {
  const toast = useToastM();
  const r = tablero.resumen;
  const copiar = async () => {
    if (!tablero.link) return;
    try { await navigator.clipboard.writeText(tablero.link); toast('Link copiado'); } catch { toast('No pude copiarlo: mantén apretado el link'); }
  };
  return (
    <>
      <CabeceraM titulo="MaKo Partners" padre={{ href: RUTA_MAS, label: 'More' }} />
      <p className="m-partners-nota">
        Recomienda MaKo: cada negocio que entra con tu link y paga su {PAGOS_PARA_ACREDITAR === 2 ? 'segundo' : `${PAGOS_PARA_ACREDITAR}º`} mes
        te suma su primer mes como crédito.
      </p>
      <SeccionM titulo="Tu link">
        {tablero.link
          ? (
            <div className="m-partners-form">
              <input className="m-partners-in" readOnly value={tablero.link} aria-label="Tu link de MaKo Partners" onFocus={(e) => e.currentTarget.select()} />
              <Button size="lg" full onClick={copiar}>Copiar el link</Button>
            </div>
          )
          : <VacioM frase="Todavía no tienes tu link. Prueba otra vez en un minuto." />}
      </SeccionM>
      <SeccionM titulo="Tu panel">
        <ListaM>
          <FilaDatoM k="Acumulado" v={usd(r.acumuladoUsd)} />
          <FilaDatoM k="Disponible" v={usd(r.saldoUsd)} />
          {tablero.revendedor
            ? <FilaDatoM k="A cobrar en plata" v={usd(r.aCobrarUsd)} />
            : <FilaDatoM k="Meses gratis ganados" v={String(r.mesesGratis)} />}
          <FilaDatoM k="Referidos" v={String(tablero.referidos.length)} />
        </ListaM>
      </SeccionM>
      <SeccionM titulo="Tus referidos">
        {tablero.referidos.length === 0
          ? <VacioM frase={textoSinReferidos({ cobraEnLinea, emailMako })} />
          : (
            <ListaM>
              {tablero.referidos.map((x) => (
                <FilaDatoM key={x.ws} k={x.nombre}
                  v={<PildoraM tono={x.estado === 'acreditado' ? 'good' : 'neutro'}>{TEXTO_ESTADO_REFERIDO[x.estado]}{x.estado === 'primer-pago' ? ` · ${x.mesesPagados}/${PAGOS_PARA_ACREDITAR}` : ''}</PildoraM>} />
              ))}
            </ListaM>
          )}
      </SeccionM>
    </>
  );
}
