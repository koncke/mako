'use client';

// =============================================================================
// ProgramaPartners — MaKo Partners para el super admin: el programa entero, directo (24/10/2026; rehecho el 25/10/2026)
// =============================================================================
// Martín (25/10): «En SuperAdmin, directo ver el dashboard, y copia el dashboard de otras apps que usen referidos, tanto para
// superadmin como para los clientes, que se vea epico». COPIADO DEL ADMIN DE FIRSTPROMOTER (firstpromoter.com, mirado el
// 25/10; la captura en docs/partners/referencias/): los números del programa arriba con lo que hay que pagar destacado (su «To
// be paid · Total unpaid · Total paid»), lo ganado por mes, y la tabla de partners con lo que se le debe a cada uno, dónde
// cobra y «Marcar pagado». La landing, con «Ver la landing» arriba (como la ve un cliente que todavía no es partner).
//
// «Marcar pagado» NO mueve plata: anota la transferencia que Martín ya hizo (`marcarPagoPartnerAction`), con un «¿seguro?»
// que dice cuánto y a dónde.
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Pagina, PageHeader, ErrorState, ButtonLink, useConfirm, Toast, useToast } from '@/app/_ui';
import { RUTA_LANDING_PARTNERS, textoProgramaSinReferidos } from '@/lib/partners-reglas';
import type { ResumenPrograma } from '@/lib/partners-programa';
import { BarrasPorMes } from './BarrasPorMes';
import { CSS_PANEL, fecha, usd } from './PanelPartner';
import { marcarPagoPartnerAction } from './actions';
import { MenuContextual } from '@/app/_ui/MenuContextual';
import { useMenuContextual } from '@/app/_ui/useMenuContextual';
import { itemsPartnerPrograma } from './menu-contextual-partners';

const CSS = `
.pg-kpis { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.pg-quien b { display: block; }
.pg-quien span { font-size: 12.5px; }
.pg-cobro { max-width: 220px; overflow-wrap: anywhere; }
.pg-falta { color: var(--warn); font-weight: 600; }
.pg-pagar { border: 0; border-radius: 9px; background: var(--primary); color: var(--on-primary, #fff); font: inherit; font-size: 13px; font-weight: 700; padding: 7px 12px; cursor: pointer; white-space: nowrap; }
.pg-pagar[disabled] { opacity: .6; cursor: default; }
@media (max-width: 1200px) { .pg-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 700px) { .pg-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

export function ProgramaPartners({ programa, cobraEnLinea = true }: {
  /** El programa entero (lib/partners-programa.ts, `resumenDelPrograma`). null = no se pudo leer. */
  programa: ResumenPrograma | null;
  cobraEnLinea?: boolean;
}) {
  const router = useRouter();
  const { confirm, confirmNode } = useConfirm();
  const { toast, show, clear } = useToast();
  const [pagando, setPagando] = useState<number | null>(null);
  // El clic derecho (y mantener presionado) de una fila: su «Marcar pagado» (menu-contextual-partners.ts). Antes del return
  // temprano: un hook no puede quedar detrás de él.
  const menu = useMenuContextual<number>();
  const acciones = (
    <>
      <ButtonLink href="/agency" variant="secondary">Agencias</ButtonLink>
      <ButtonLink href={RUTA_LANDING_PARTNERS} variant="secondary">Ver la landing</ButtonLink>
    </>
  );
  if (!programa) {
    return <Pagina><PageHeader titulo="MaKo Partners" acciones={acciones} /><ErrorState titulo="No pude leer el programa" detalle="Reintenta en un momento." /></Pagina>;
  }
  const alMenos = programa.truncado ? 'al menos ' : '';
  const pagar = async (p: ResumenPrograma['lista'][number]) => {
    const ok = await confirm(
      <>¿Ya le transferiste <b>{usd(p.aCobrarUsd)}</b> a {p.nombre}{p.cobro ? <> ({p.cobro})</> : null}? Queda anotado en su panel y le avisamos por email.</>,
      { title: 'Marcar pagado', confirmLabel: 'Sí, marcar pagado', danger: false },
    );
    if (!ok) return;
    setPagando(p.ws);
    const r = await marcarPagoPartnerAction({ ws: p.ws, montoUsd: p.aCobrarUsd }).catch(() => ({ ok: false as const, error: 'No pudimos conectarnos. Prueba otra vez.' }));
    setPagando(null);
    show(r.ok ? r.resumen : r.error, undefined, r.ok ? 'good' : 'bad');
    if (r.ok) router.refresh();
  };
  const delMenu = menu.abierto ? programa.lista.find((x) => x.ws === menu.abierto?.de) ?? null : null;
  return (
    <Pagina>
      <style dangerouslySetInnerHTML={{ __html: CSS_PANEL + CSS }} />
      <PageHeader titulo="MaKo Partners" acciones={acciones} />
      <div className="pp-hola">
        <h2>El programa</h2>
        <p>Cada partner se lleva el 100% del primer mes de cada negocio que trae.</p>
      </div>
      <div className="pp-kpis pg-kpis">
        <div className="pp-kpi"><span className="pp-kpi-etq">Partners</span><b>{alMenos}{programa.partners}</b><small className={programa.partnersEsteMes ? 'bien' : ''}>{programa.partnersEsteMes ? `+${programa.partnersEsteMes} este mes` : 'Este mes, todavía ninguno'}</small></div>
        <div className="pp-kpi"><span className="pp-kpi-etq">Negocios referidos</span><b>{alMenos}{programa.referidos}</b><small>Con link o código</small></div>
        <div className="pp-kpi"><span className="pp-kpi-etq">Ganado por partners</span><b>{usd(programa.ganadoUsd)}</b><small>Ya cobrados por MaKo</small></div>
        <div className="pp-kpi destacado"><span className="pp-kpi-etq">A pagar</span><b>{usd(programa.aPagarUsd)}</b><small>{programa.lista.filter((p) => p.aCobrarUsd > 0).length} por transferir</small></div>
        <div className="pp-kpi"><span className="pp-kpi-etq">Pagado</span><b>{usd(programa.pagadoUsd)}</b><small>Ya transferido</small></div>
      </div>
      <section className="pp-caja" aria-labelledby="pg-ganado" style={{ marginBottom: 14 }}>
        <div className="pp-caja-cab"><h3 id="pg-ganado">Lo que ganaron los partners</h3><span>Últimos 6 meses</span></div>
        <BarrasPorMes datos={programa.porMes} vacio={textoProgramaSinReferidos(cobraEnLinea)} />
      </section>
      <section className="pp-caja" aria-labelledby="pg-lista">
        <div className="pp-caja-cab"><h3 id="pg-lista">Partners</h3><span>Primero a quién hay que pagarle</span></div>
        {programa.lista.length === 0
          ? <div className="pp-vacio"><b>Todavía nadie se hizo partner</b>Cuando un negocio se haga partner desde su MaKo, aparece aquí con lo que va ganando.</div>
          : (
            <table className="pp-tabla">
              <thead>
                <tr><th>Partner</th><th className="ocultable">Desde</th><th className="num">Negocios</th><th className="num ocultable">Ganado</th><th className="num ocultable">Pagado</th><th className="num">A pagar</th><th className="ocultable">Le transferimos a</th><th /></tr>
              </thead>
              <tbody>
                {programa.lista.map((p) => (
                  <tr key={p.ws} {...menu.propsDe(p.ws, itemsPartnerPrograma(p, pagando === p.ws).length > 0)}>
                    <td className="pg-quien"><b>{p.nombre}</b>{p.codigo && <span>/r/{p.codigo}</span>}</td>
                    <td className="ocultable"><span>{p.desde ? fecha(p.desde) : '—'}</span></td>
                    <td className="num">{p.referidos}</td>
                    <td className="num ocultable">{usd(p.ganadoUsd)}</td>
                    <td className="num ocultable"><span>{usd(p.pagadoUsd)}</span></td>
                    <td className="num"><b>{usd(p.aCobrarUsd)}</b></td>
                    <td className="ocultable pg-cobro">{p.cobro ?? <span className="pg-falta">Sin cargar</span>}</td>
                    <td className="num">
                      {p.aCobrarUsd > 0 && (
                        <button type="button" className="pg-pagar" disabled={pagando === p.ws} onClick={() => void pagar(p)}>{pagando === p.ws ? 'Anotando…' : 'Marcar pagado'}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </section>
      {menu.abierto && delMenu && itemsPartnerPrograma(delMenu, pagando === delMenu.ws).length > 0 && (
        <MenuContextual key={menu.abierto.n} punto={{ x: menu.abierto.x, y: menu.abierto.y }} porDedo={menu.abierto.porDedo}
          items={itemsPartnerPrograma(delMenu, pagando === delMenu.ws)} etiqueta={`Acciones de ${delMenu.nombre}`} onCerrar={menu.cerrar}
          onElegir={(id) => { if (id === 'marcar_pagado') void pagar(delMenu); }} />
      )}
      {confirmNode}
      <Toast state={toast} onClose={clear} />
    </Pagina>
  );
}
