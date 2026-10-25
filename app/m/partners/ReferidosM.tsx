'use client';

// =============================================================================
// ReferidosM — MaKo Partners en el teléfono: el panel del partner y el del programa (24/10/2026; rehecho el 25/10/2026)
// =============================================================================
// En la computadora es /partners (app/partners/PanelPartner.tsx y ProgramaPartners.tsx). El teléfono lo DESTILA: lo que
// tiene a cobrar arriba y grande, el link con «Copiar» y «Compartir por WhatsApp», los números, sus negocios y dónde cobra.
// Los datos, los mismos (`tableroDe`, `resumenDelPrograma`). Partners paga en dinero: nada de «meses» ni de crédito.
// =============================================================================

import { CabeceraM, FilaDatoM, ListaM, PildoraM, SeccionM, VacioM, ComputadoraM, useToastM } from '@/app/m/_ui';
import { Button } from '@/app/_ui/Button';
import Link from '@/app/_ui/Link';
import { PAGO_HOY, PAGOS_PARA_ACREDITAR, RUTA_LANDING_PARTNERS, TEXTO_ESTADO_REFERIDO, textoProgramaSinReferidos, textoSinReferidos } from '@/lib/partners-reglas';
import type { ResumenPrograma, Tablero } from '@/lib/partners-programa';
import { RUTA_MAS } from '@/lib/movil-rutas';

const usd = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

export function ReferidosM({ tablero, agencia = false, cobraEnLinea = true, emailMako }: { tablero: Tablero; agencia?: boolean; cobraEnLinea?: boolean; emailMako: string }) {
  const toast = useToastM();
  const r = tablero.resumen;
  const copiar = async (que: string, valor: string | null) => {
    if (!valor) return;
    try { await navigator.clipboard.writeText(valor); toast(`${que} copiado`); } catch { toast('No pude copiarlo: mantén apretado el texto'); }
  };
  const mes = PAGOS_PARA_ACREDITAR === 2 ? 'segundo' : `${PAGOS_PARA_ACREDITAR}º`;
  const texto = tablero.link ? `Te recomiendo MaKo para vender más con tu negocio: ${tablero.link}` : '';
  return (
    <>
      <CabeceraM titulo="MaKo Partners" padre={{ href: RUTA_MAS, label: 'More' }} />
      <div className="m-partners-cobrar">
        <span>A cobrar</span>
        <b>{usd(r.aCobrarUsd)}</b>
        <small>{tablero.alta?.cobro ? `Te lo transferimos a ${tablero.alta.cobro}` : 'Carga dónde te transferimos en la computadora'}</small>
      </div>
      <SeccionM titulo="Tu link">
        {tablero.link
          ? (
            <div className="m-partners-form">
              <input className="m-partners-in" readOnly value={tablero.link} aria-label="Tu link de MaKo Partners" onFocus={(e) => e.currentTarget.select()} />
              <Button size="lg" full onClick={() => copiar('Link', tablero.link)}>Copiar el link</Button>
              <a className="m-partners-wa" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
              {tablero.codigo && <p className="m-partners-nota">Tu código para poner al pagar: <b>{tablero.codigo}</b></p>}
            </div>
          )
          : <VacioM frase="Todavía no tienes tu link. Prueba otra vez en un minuto." />}
      </SeccionM>
      <SeccionM titulo="Tu panel" accion={<Link className="m-lnk" href={RUTA_LANDING_PARTNERS}>Ver la landing</Link>}>
        <ListaM>
          <FilaDatoM k="Visitas a tu link" v={String(tablero.visitas.total)} />
          <FilaDatoM k="Negocios que trajiste" v={String(tablero.referidos.length)} />
          <FilaDatoM k="Ganaste" v={usd(r.ganadoUsd)} />
          {r.porGanarUsd > 0 && <FilaDatoM k="En camino" v={usd(r.porGanarUsd)} />}
          <FilaDatoM k="Ya cobraste" v={usd(r.pagadoUsd)} />
          {agencia && <FilaDatoM k="Tus clientes de agencia" v="Agency Dashboard" href="/m/agency" azul />}
        </ListaM>
      </SeccionM>
      <SeccionM titulo="Tus negocios">
        {tablero.referidos.length === 0
          ? <VacioM frase={textoSinReferidos({ cobraEnLinea, emailMako })} />
          : (
            <ListaM>
              {tablero.referidos.map((x) => (
                <FilaDatoM key={x.ws} k={x.nombre}
                  v={<PildoraM tono={x.estado === 'acreditado' ? 'good' : x.estado === 'primer-pago' ? 'warn' : 'neutro'}>{TEXTO_ESTADO_REFERIDO[x.estado]}{x.gananciaUsd != null && x.estado !== 'se-fue' ? ` · ${usd(x.gananciaUsd)}` : ''}</PildoraM>} />
              ))}
            </ListaM>
          )}
        <p className="m-partners-nota">Ganas el primer mes entero de cada negocio cuando paga su {mes} mes. {PAGO_HOY}</p>
      </SeccionM>
    </>
  );
}

/** El programa entero, para el super admin en el teléfono: los números y a quién hay que pagarle. «Marcar pagado», en la computadora. */
export function ProgramaM({ programa, cobraEnLinea = true }: { programa: ResumenPrograma; cobraEnLinea?: boolean }) {
  const deben = programa.lista.filter((p) => p.aCobrarUsd > 0);
  return (
    <>
      <CabeceraM titulo="MaKo Partners" padre={{ href: RUTA_MAS, label: 'More' }} />
      <div className="m-partners-cobrar">
        <span>A pagar a partners</span>
        <b>{usd(programa.aPagarUsd)}</b>
        <small>{deben.length ? `${deben.length} ${deben.length === 1 ? 'partner espera' : 'partners esperan'} su transferencia` : 'Nadie espera una transferencia'}</small>
      </div>
      <SeccionM titulo="El programa" accion={<Link className="m-lnk" href={RUTA_LANDING_PARTNERS}>Ver la landing</Link>}>
        <ListaM>
          <FilaDatoM k="Partners" v={String(programa.partners)} />
          <FilaDatoM k="Negocios referidos" v={String(programa.referidos)} />
          <FilaDatoM k="Ganado por partners" v={usd(programa.ganadoUsd)} />
          <FilaDatoM k="Ya transferido" v={usd(programa.pagadoUsd)} />
        </ListaM>
      </SeccionM>
      <SeccionM titulo="Partners">
        {programa.lista.length === 0
          ? <VacioM frase={textoProgramaSinReferidos(cobraEnLinea)} />
          : (
            <ListaM>
              {programa.lista.map((p) => (
                <FilaDatoM key={p.ws} k={p.nombre} v={p.aCobrarUsd > 0 ? <PildoraM tono="warn">A pagar {usd(p.aCobrarUsd)}</PildoraM> : `${p.referidos} ${p.referidos === 1 ? 'negocio' : 'negocios'}`} />
              ))}
            </ListaM>
          )}
      </SeccionM>
      <ComputadoraM que="Marcar pagado a un partner" />
    </>
  );
}
