'use client';

// =============================================================================
// Billing en el teléfono: los cobros y la hoja de cada uno (la lista de pagos de Stripe en el celular)
// =============================================================================
// Los rótulos de la computadora (`rotuloEstado`, `NOMBRE_PASARELA`, `formatoMonto`). Copiar el link devuelve si copió
// (`copiarTexto`): un «copiado» sobre algo que no se copió era un bug de la computadora (ListaCobrosMako.tsx).
// =============================================================================

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { NOMBRE_PASARELA, rotuloEstado, type EstadoCobro } from '@/lib/cobros-tipos';
import { formatoMonto } from '@/lib/pasarela-moneda';
import { ROTULO_ESTADO_RECIBO, numeroEnTexto, totalesEnTexto, type EstadoRecibo } from '@/lib/recibos-reglas';
import type { CobroMako } from '@/app/admin/cobros/actions';
import { copiarTexto } from '@/app/m/copywriting/api';
import { FilaDatoM, FilaM, ListaM, PieM, PildoraM, SeccionM, SheetM, VacioM, useToastM, type TonoPildora } from '@/app/m/_ui';
import { FilaEnComputadoraM } from '@/app/m/_ui/EnComputadoraM';

const TONO: Record<EstadoCobro, TonoPildora> = { pendiente: 'warn', pagado: 'good', fallido: 'bad', reembolsado: 'neutro', anulado: 'neutro' };
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Un recibo, lo justo para la fila del teléfono (lib/recibos.ts). */
export type ReciboM = { id: number; numero: number; aNombre: string; totales: Array<{ moneda: string; monto: number }>; fecha: string; estado: EstadoRecibo };
const TONO_RECIBO: Record<EstadoRecibo, TonoPildora> = { emitido: 'good', devuelto: 'warn', devuelto_parcial: 'warn', contracargo: 'bad', anulado: 'neutro' };

export function CobrosM({ cobros, truncado, conPasarela, recibos = null }: { cobros: CobroMako[]; truncado: boolean; conPasarela: boolean; recibos?: ReciboM[] | null }) {
  const toast = useToastM();
  const [abierto, setAbierto] = useState<CobroMako | null>(null);
  return (
    <>
      <ListaM>
        <FilaEnComputadoraM icono="tag" titulo="Vender un plan" href="/admin/cobros"
          motivo={conPasarela
            ? 'Arma el link de pago de un plan: se hace en la computadora, donde se elige la pasarela, el precio y quién lo recibe.'
            : 'Primero hay que conectar Stripe o Mercado Pago en Integraciones, con la cuenta de MaKo: se hace en la computadora.'} />
      </ListaM>
      {cobros.length === 0 ? <VacioM frase="Todavía no hay cobros. Cuando vendas un plan, aparece aquí con el estado de su cuenta." /> : (
        <SeccionM titulo={truncado ? `Los ${cobros.length} más nuevos` : 'Cobros'}>
          <ListaM>
            {cobros.map((c) => (
              <FilaM key={c.id} titulo={c.nombre || c.email || 'Sin nombre'} segunda={`${c.plan ?? c.concepto} · ${fecha(c.created_at)}`}
                riel={<span className="m-num">{formatoMonto(c.monto, c.moneda)}</span>}
                pill={<PildoraM tono={TONO[c.estado]}>{rotuloEstado(c.estado)}</PildoraM>} onClick={() => setAbierto(c)} />
            ))}
          </ListaM>
        </SeccionM>
      )}
      {recibos && (
        <SeccionM titulo="Recibos">
          <ListaM>
            <FilaEnComputadoraM icono="tag" titulo="Cargar un pago" href="/admin/cobros"
              motivo="El recibo de un pago que entró por fuera de la pasarela se arma en la computadora: se sube la foto del comprobante y se revisa antes de mandarlo." />
            {recibos.length === 0 ? <FilaM titulo="Todavía no hay recibos" segunda="Cuando entre un pago, su recibo aparece aquí." /> : recibos.map((r) => (
              <FilaM key={r.id} titulo={`N.º ${numeroEnTexto(r.numero)} · ${r.aNombre}`} segunda={fecha(r.fecha)}
                riel={<span className="m-num">{totalesEnTexto(r.totales)}</span>}
                pill={<PildoraM tono={TONO_RECIBO[r.estado]}>{ROTULO_ESTADO_RECIBO[r.estado]}</PildoraM>}
                onClick={() => { window.open(`/api/admin/recibos/${r.id}/pdf`, '_blank', 'noopener'); }} />
            ))}
          </ListaM>
        </SeccionM>
      )}
      <SheetM id="cobro" abierto={abierto != null} onCerrar={() => setAbierto(null)} titulo={abierto ? (abierto.nombre || abierto.email || 'Cobro') : ''}
        pie={abierto?.link ? (
          <PieM consecuencia="El link sigue sirviendo mientras el cobro esté pendiente.">
            <Button variant="primary" size="lg" full onClick={async () => { toast((await copiarTexto(abierto.link ?? '')) ? 'Link copiado' : 'No se pudo copiar'); }}>
              Copiar el link de pago
            </Button>
          </PieM>
        ) : undefined}>
        {abierto && (
          <>
            <ListaM>
              {abierto.email && <FilaDatoM k="Email" v={abierto.email} />}
              <FilaDatoM k="Plan" v={abierto.plan ?? abierto.concepto} />
              <FilaDatoM k="Monto" v={formatoMonto(abierto.monto, abierto.moneda)} />
              <FilaDatoM k="Pasarela" v={NOMBRE_PASARELA[abierto.proveedor]} />
              <FilaDatoM k="Estado" v={rotuloEstado(abierto.estado)} />
              {abierto.motivo && <FilaDatoM k="Motivo" v={abierto.motivo} />}
              <FilaDatoM k="Creado" v={fecha(abierto.created_at)} />
              {abierto.pagado_at && <FilaDatoM k="Pagado" v={fecha(abierto.pagado_at)} />}
              {abierto.alta_ws_nombre && <FilaDatoM k="Cuenta" v={abierto.alta_ws_nombre} />}
              {abierto.alta_motivo && <FilaDatoM k="La cuenta" v={abierto.alta_motivo} />}
            </ListaM>
            <ListaM>
              <FilaEnComputadoraM icono="tag" titulo="Anular o reembolsar" href="/admin/cobros"
                motivo="Mueven plata y la pasarela puede rechazarlas con un motivo que hay que leer entero: se hacen en la computadora, con su confirmación." />
            </ListaM>
          </>
        )}
      </SheetM>
    </>
  );
}
