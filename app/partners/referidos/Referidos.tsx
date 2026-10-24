'use client';

// El tablero de MaKo Partners (23/10/2026): tu link para compartir, lo acumulado, los meses gratis (o la plata a cobrar
// si sos revendedor) y en qué va cada referido. Sólo dibuja lo que trae `tableroDe` (lib/partners-programa.ts).

import { useState } from 'react';
import { Pagina, PageHeader, EmptyState, ErrorState, Tabs } from '@/app/_ui';
import { TEXTO_ESTADO_REFERIDO, PAGOS_PARA_ACREDITAR, textoSinReferidos } from '@/lib/partners-reglas';
import type { Tablero } from '@/lib/partners-programa';
import { PresentacionPartners } from '../PresentacionPartners';

const CSS = `
.pr-grilla { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin: 16px 0 22px; }
.pr-kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
.pr-kpi b { display: block; font-size: 24px; color: var(--ink); }
.pr-kpi span { font-size: var(--fs-sm); color: var(--dim); }
.pr-link { display: flex; gap: 8px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; }
.pr-link input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ink); font: inherit; }
.pr-link button { border: 0; border-radius: 10px; background: var(--accent); color: #fff; font-weight: 600; padding: 8px 14px; cursor: pointer; }
.pr-lista { list-style: none; padding: 0; margin: 10px 0 0; }
.pr-fila { display: flex; justify-content: space-between; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--border); }
.pr-fila b { color: var(--ink); }
.pr-fila span { color: var(--dim); font-size: var(--fs-sm); }
.pr-reglas { color: var(--dim); font-size: var(--fs-sm); line-height: 1.6; padding-left: 18px; }
.pr-titulo { margin: 0 0 12px; font-size: var(--fs-md); color: var(--ink); }
`;

const usd = (n: number) => `US$ ${n.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function Referidos({ tablero, agencia, cobraEnLinea = true, emailMako }: {
  tablero: Tablero | null; agencia: boolean;
  /** ¿MaKo cobra en línea? Sin eso no se registra ningún referido, y el tablero en cero lo dice (`textoSinReferidos`). */
  cobraEnLinea?: boolean; emailMako: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const tabs = agencia
    ? <Tabs tabs={[{ id: 'clients', label: 'Clients' }, { id: 'program', label: 'Program' }, { id: 'referidos', label: 'Referidos' }]} activa="referidos"
        onCambio={(id) => { if (id !== 'referidos') window.location.assign(`/partners?tab=${id}${location.search.includes('ws=') ? `&${location.search.slice(1)}` : ''}`); }} />
    : null;
  if (!tablero) {
    return <Pagina><PageHeader titulo="MaKo Partners" />{tabs}<ErrorState titulo="No pude leer tu tablero" detalle="Prueba otra vez en un minuto." /></Pagina>;
  }
  const r = tablero.resumen;
  const copiar = async () => {
    if (!tablero.link) return;
    try { await navigator.clipboard.writeText(tablero.link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* el input queda seleccionable */ }
  };
  return (
    <Pagina>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PageHeader titulo="MaKo Partners" />
      {tabs}
      {/* Primero lo que vende la idea, después el tablero (Martín, 24/10/2026). */}
      <PresentacionPartners vista="cliente" />
      <h3 className="pr-titulo">Tu panel</h3>
      {tablero.link
        ? (
          <div className="pr-link">
            <input readOnly value={tablero.link} aria-label="Tu link de MaKo Partners" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
        )
        : <ErrorState titulo="Todavía no tienes tu link" detalle="Prueba otra vez en un minuto." />}
      <div className="pr-grilla">
        <div className="pr-kpi"><b>{usd(r.acumuladoUsd)}</b><span>Acumulado</span></div>
        <div className="pr-kpi"><b>{usd(r.saldoUsd)}</b><span>Disponible</span></div>
        {tablero.revendedor
          ? <div className="pr-kpi"><b>{usd(r.aCobrarUsd)}</b><span>A cobrar en plata</span></div>
          : <div className="pr-kpi"><b>{r.mesesGratis}</b><span>{r.mesesGratis === 1 ? 'Mes gratis ganado' : 'Meses gratis ganados'}</span></div>}
        <div className="pr-kpi"><b>{tablero.referidos.length}</b><span>{tablero.referidos.length === 1 ? 'Referido' : 'Referidos'}</span></div>
      </div>
      {tablero.referidos.length === 0
        ? <EmptyState titulo="Todavía no tienes referidos" detalle={textoSinReferidos({ cobraEnLinea, emailMako })} />
        : (
          <ul className="pr-lista">
            {tablero.referidos.map((x) => (
              <li key={x.ws} className="pr-fila">
                <span><b>{x.nombre}</b><br />desde {fecha(x.desde)}</span>
                <span>{TEXTO_ESTADO_REFERIDO[x.estado]}{x.estado === 'primer-pago' ? ` · ${x.mesesPagados}/${PAGOS_PARA_ACREDITAR} meses` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      <h3 style={{ marginTop: 26, fontSize: 'var(--fs-md)', color: 'var(--ink)' }}>Cómo funciona</h3>
      <ol className="pr-reglas">
        <li>Cada negocio nuevo que entra con tu link y paga su <b>segundo mes</b> te suma su <b>primer mes</b> como crédito.</li>
        <li>{tablero.revendedor ? 'Primero se descuenta tu suscripción; lo que sobra se te paga en plata por transferencia.' : 'El crédito se acumula y se descuenta de tus próximos meses.'}</li>
        <li>Por cada programa grupal que traigas, el 20% de cada cuota cobrada, en plata.</li>
      </ol>
    </Pagina>
  );
}
