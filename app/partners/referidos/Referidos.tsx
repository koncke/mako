'use client';

// El tablero de MaKo Partners (23/10/2026): tu link para compartir, lo acumulado y en qué va cada referido. Sólo dibuja
// lo que trae `tableroDe` (lib/partners-programa.ts). Desde el 24/10 NO muestra «disponible», «meses gratis» ni «a cobrar
// en plata» (`resumenDelLibro` los cuenta, pero nada consume el crédito todavía: `CREDITO_HOY`).
//
// Desde la noche del 24/10 se ve SÓLO después de unirse (Martín: «solo cuando se registre ahi aparece el dashboard»): lo
// que vende la idea es la landing (app/mako-partners/LandingPartners.tsx), así que acá arriba va lo primero que necesita
// un partner, su link, como el «Your referral link» de los paneles de afiliados (LLM Pulse, Kit). Lo demás, debajo.

import { useState } from 'react';
import Link from '@/app/_ui/Link';
import { Pagina, PageHeader, EmptyState, ErrorState, Tabs } from '@/app/_ui';
import { COMISION_GRUPAL, COMISION_HOY, CREDITO_HOY, TEXTO_ESTADO_REFERIDO, PAGOS_PARA_ACREDITAR, comisionDelAcelerador, textoSinReferidos } from '@/lib/partners-reglas';
import { PROGRAMA_ACELERADOR } from '@/lib/planes-mako';
import type { Tablero } from '@/lib/partners-programa';

const CSS = `
.pr-cabeza { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: 20px; padding: 24px 26px 22px; margin: 4px 0 22px;
  background: radial-gradient(800px 320px at 100% 0%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%),
    linear-gradient(180deg, var(--primary-bg) 0%, var(--surface) 100%); }
.pr-cabeza-etq { font-size: 12px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--primary); }
.pr-cabeza h2 { margin: 8px 0 6px; font-size: 24px; line-height: 1.2; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
.pr-cabeza p { margin: 0 0 16px; color: var(--dim); max-width: 620px; line-height: 1.5; }
.pr-cabeza p a { color: var(--primary); font-weight: 600; }
.pr-grilla { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin: 0 0 24px; }
.pr-kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; }
.pr-kpi.destacado { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary), 0 14px 34px color-mix(in srgb, var(--primary) 16%, transparent); }
.pr-kpi b { display: block; font-size: 30px; line-height: 1.1; font-weight: 800; letter-spacing: -.03em; color: var(--ink); }
.pr-kpi span { font-size: var(--fs-sm); color: var(--dim); }
.pr-link { display: flex; gap: 8px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 8px 8px 8px 16px;
  max-width: 640px; scroll-margin-top: 80px; }
.pr-link input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ink); font: inherit; font-weight: 600; }
.pr-link button { border: 0; border-radius: 10px; background: var(--primary); color: var(--on-primary, #fff); font-weight: 700; padding: 11px 20px; cursor: pointer;
  box-shadow: 0 6px 16px color-mix(in srgb, var(--primary) 26%, transparent); }
.pr-lista { list-style: none; padding: 0; margin: 0 0 8px; }
.pr-fila { display: flex; justify-content: space-between; gap: 12px; padding: 12px 4px; border-bottom: 1px solid var(--border); }
.pr-fila b { color: var(--ink); }
.pr-fila span { color: var(--dim); font-size: var(--fs-sm); }
.pr-reglas { color: var(--dim); font-size: var(--fs-sm); line-height: 1.6; padding-left: 18px; }
.pr-titulo { margin: 0 0 12px; font-size: 18px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
@media (max-width: 860px) { .pr-cabeza { padding: 20px 18px 18px; } }
`;

const usd = (n: number) => `US$ ${n.toLocaleString('es', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Las pestañas de la agencia (su cartera, su programa y sus referidos): las comparten la landing y el tablero. */
export function PestanasDeAgencia() {
  return (
    <Tabs tabs={[{ id: 'clients', label: 'Clients' }, { id: 'program', label: 'Program' }, { id: 'referidos', label: 'Referidos' }]} activa="referidos"
      onCambio={(id) => { if (id !== 'referidos') window.location.assign(`/partners?tab=${id}${location.search.includes('ws=') ? `&${location.search.slice(1)}` : ''}`); }} />
  );
}

export function Referidos({ tablero, agencia, cobraEnLinea = true, emailMako }: {
  tablero: Tablero | null; agencia: boolean;
  /** ¿MaKo cobra en línea? Sin eso no se registra ningún referido, y el tablero en cero lo dice (`textoSinReferidos`). */
  cobraEnLinea?: boolean; emailMako: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const tabs = agencia ? <PestanasDeAgencia /> : null;
  if (!tablero) {
    return <Pagina><PageHeader titulo="MaKo Partners" />{tabs}<ErrorState titulo="No pude leer tu tablero" detalle="Prueba otra vez en un minuto." /></Pagina>;
  }
  const r = tablero.resumen;
  const mes = PAGOS_PARA_ACREDITAR === 2 ? 'segundo' : `${PAGOS_PARA_ACREDITAR}º`;
  const acreditados = tablero.referidos.filter((x) => x.estado === 'acreditado').length;
  const esperando = tablero.referidos.filter((x) => x.estado === 'registrado' || x.estado === 'primer-pago').length;
  const copiar = async () => {
    if (!tablero.link) return;
    try { await navigator.clipboard.writeText(tablero.link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* el input queda seleccionable */ }
  };
  return (
    <Pagina>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <PageHeader titulo="MaKo Partners" />
      {tabs}
      <section className="pr-cabeza" aria-labelledby="pr-cabeza-titulo">
        <span className="pr-cabeza-etq">Ya eres partner</span>
        <h2 id="pr-cabeza-titulo">Tu link para compartir</h2>
        <p>
          Cada negocio nuevo que entra con él y paga su {mes} mes te suma su primer mes como crédito para tu plan.{' '}
          <Link href="/mako-partners">Cómo funciona</Link>
        </p>
        {tablero.link
          ? (
            <div className="pr-link" id="pr-link">
              <input readOnly value={tablero.link} aria-label="Tu link de MaKo Partners" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
            </div>
          )
          : <ErrorState titulo="Todavía no tienes tu link" detalle="Prueba otra vez en un minuto." />}
      </section>
      {/* Sólo lo que es verdad hoy (24/10/2026): lo acumulado y en qué va cada referido. Ni «disponible», ni «meses
          gratis», ni «a cobrar en plata»: nada consume el crédito todavía (`CREDITO_HOY`). */}
      <div className="pr-grilla">
        <div className="pr-kpi destacado"><b>{usd(r.acumuladoUsd)}</b><span>Crédito acumulado</span></div>
        <div className="pr-kpi"><b>{tablero.referidos.length}</b><span>{tablero.referidos.length === 1 ? 'Referido' : 'Referidos'}</span></div>
        <div className="pr-kpi"><b>{acreditados}</b><span>Ya te sumaron crédito</span></div>
        <div className="pr-kpi"><b>{esperando}</b><span>Todavía no suman crédito</span></div>
      </div>
      <h3 className="pr-titulo">Tus referidos</h3>
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
      <h3 className="pr-titulo" style={{ marginTop: 26 }}>Lo que hay que saber</h3>
      <ol className="pr-reglas">
        <li>Cada negocio nuevo que se suscribe con tu link y paga su <b>{mes} mes</b> te suma su <b>primer mes</b>, a precio de lista, como crédito para tu plan. {CREDITO_HOY}</li>
        {/* Meses Y dinero, según qué se refiere (25/10/2026): el Acelerador deja su comisión en efectivo (docs/referidos.md). */}
        <li>
          Cada negocio que entra al {PROGRAMA_ACELERADOR.nombre} con tu link te deja <b>{usd(comisionDelAcelerador(PROGRAMA_ACELERADOR.precioUsd))} en
          efectivo</b>: el {Math.round(COMISION_GRUPAL * 100)}% de cada cuota que paga. {COMISION_HOY}
        </li>
      </ol>
    </Pagina>
  );
}
