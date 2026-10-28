'use client';

// =============================================================================
// PanelPartner — el panel de MaKo Partners de quien ya se hizo partner (23/10/2026; rehecho el 25/10/2026)
// =============================================================================
// Martín (25/10): «Luego de eso, en la misma url, ahora si ven el dashboard, con un botón arriba para ver la landing
// nuevamente por si quieren... copia el dashboard de otras apps que usen referidos... que se vea epico». COPIADO DEL
// PORTAL DE TOLT (tolt.com/platform/affiliate-portal, mirado el 25/10; la captura en docs/partners/referencias/): el saludo,
// cuatro números arriba (visitas, negocios, lo ganado y lo próximo a cobrar, como su «Clicks · Customers · Earned · Next
// payout»), lo ganado por mes al lado de «Comparte» (el link y el código), y la tabla de los negocios. De FirstPromoter, el
// trío de los cobros (a cobrar, cobrado) con dónde se transfiere.
//
// Sólo dibuja lo que trae `tableroDe` (lib/partners-programa.ts). Nada de «meses» ni de crédito: Partners paga en dinero.
// =============================================================================

import { useState } from 'react';
import { Pagina, PageHeader, ErrorState, ButtonLink } from '@/app/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { DIAS_COOKIE_REF, PAGO_HOY, PAGOS_PARA_ACREDITAR, RUTA_LANDING_PARTNERS, TEXTO_ESTADO_REFERIDO, TOPE_COBRO, textoSinReferidos } from '@/lib/partners-reglas';
import type { Tablero } from '@/lib/partners-programa';
import { BarrasPorMes } from './BarrasPorMes';
import { RecursosPartner } from './RecursosPartner';
import { cambiarCobroPartnerAction, cambiarCodigoPartnerAction } from './actions';

export const CSS_PANEL = `
.pp-hola { margin: 2px 0 18px; }
.pp-hola h2 { margin: 0 0 4px; font-size: 28px; line-height: 1.15; font-weight: 800; letter-spacing: -.025em; color: var(--ink); }
.pp-hola p { margin: 0; color: var(--dim); }
.pp-kpis { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0 0 14px; }
.pp-kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 16px 18px; min-width: 0; }
.pp-kpi-etq { font-size: 13px; color: var(--dim); font-weight: 600; }
.pp-kpi b { display: block; margin: 6px 0 4px; font-size: 30px; line-height: 1.05; font-weight: 800; letter-spacing: -.03em; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp-kpi small { display: block; font-size: 12.5px; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp-kpi small.bien { color: var(--good); font-weight: 600; }
.pp-kpi.destacado { background: linear-gradient(140deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 78%, #000) 100%); border-color: transparent;
  box-shadow: 0 16px 36px color-mix(in srgb, var(--primary) 26%, transparent); }
.pp-kpi.destacado .pp-kpi-etq, .pp-kpi.destacado b, .pp-kpi.destacado small { color: var(--on-primary, #fff); }
.pp-kpi.destacado small { opacity: .88; }
.pp-fila { display: grid; gap: 14px; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); margin: 0 0 14px; }
.pp-caja { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; padding: 18px 20px; min-width: 0; }
.pp-caja-cab { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin: 0 0 12px; }
.pp-caja h3 { margin: 0; font-size: 16px; font-weight: 800; color: var(--ink); }
.pp-caja-cab span { font-size: 12.5px; color: var(--dim); }
.pp-campo { margin: 0 0 10px; border: 1px solid var(--border); border-radius: 12px; padding: 8px 8px 8px 12px; display: flex; align-items: center; gap: 8px; background: var(--surface-2); }
.pp-campo div { flex: 1; min-width: 0; }
.pp-campo small { display: block; font-size: 11.5px; color: var(--dim); }
.pp-campo input { width: 100%; border: 0; background: transparent; padding: 0; color: var(--ink); font: inherit; font-size: 14.5px; font-weight: 700; }
.pp-copiar { flex: none; border: 0; border-radius: 9px; background: var(--primary); color: var(--on-primary, #fff); font: inherit; font-size: 13px; font-weight: 700; padding: 8px 14px; cursor: pointer; }
.pp-wa { display: block; text-align: center; margin-top: 4px; border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; font-weight: 700; color: var(--ink); text-decoration: none; background: var(--surface); }
.pp-wa:hover { border-color: var(--primary); }
.pp-tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
.pp-tabla th { text-align: left; font-size: 12px; font-weight: 600; color: var(--dim); padding: 0 10px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
.pp-tabla td { padding: 12px 10px; border-bottom: 1px solid var(--border); color: var(--ink); }
.pp-tabla tr:last-child td { border-bottom: 0; }
.pp-tabla td.num, .pp-tabla th.num { text-align: right; white-space: nowrap; }
.pp-tabla td b { font-weight: 700; }
.pp-tabla td span { color: var(--dim); }
.pp-pild { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; white-space: nowrap; background: var(--surface-2); color: var(--dim); }
.pp-pild.good { background: var(--good-bg); color: var(--good); }
.pp-pild.warn { background: var(--warn-bg); color: var(--warn); }
.pp-vacio { text-align: center; padding: 26px 12px 18px; color: var(--dim); }
.pp-vacio b { display: block; font-size: 17px; color: var(--ink); margin-bottom: 6px; }
.pp-cobro { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; background: var(--surface-2); margin: 0 0 12px; }
.pp-cobro small { display: block; font-size: 12px; color: var(--dim); }
.pp-cobro b { color: var(--ink); overflow-wrap: anywhere; }
.pp-texto { background: none; border: 0; padding: 4px; font: inherit; font-size: 14px; font-weight: 700; color: var(--primary); cursor: pointer; flex: none; }
.pp-edit { display: flex; gap: 8px; margin: 0 0 12px; }
.pp-edit input { flex: 1; min-width: 0; border: 1px solid var(--border); border-radius: 10px; padding: 9px 12px; font: inherit; background: var(--surface); color: var(--ink); }
.pp-pagos { list-style: none; margin: 0; padding: 0; }
.pp-pagos li { display: flex; justify-content: space-between; gap: 10px; padding: 9px 2px; border-bottom: 1px solid var(--border); font-size: 14px; color: var(--ink); }
.pp-pagos li:last-child { border-bottom: 0; }
.pp-pagos li span { color: var(--dim); }
.pp-nota { margin: 8px 0 0; font-size: 12.5px; color: var(--dim); }
.pp-error { margin: 0 0 10px; color: var(--bad); font-weight: 600; font-size: 14px; }
@media (max-width: 980px) { .pp-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .pp-fila { grid-template-columns: 1fr; } }
@media (max-width: 560px) {
  .pp-tabla .ocultable { display: none; } .pp-kpi b { font-size: 24px; } .pp-hola h2 { font-size: 23px; }
  .pp-caja { padding: 16px 14px; } .pp-tabla th, .pp-tabla td { padding-left: 4px; padding-right: 4px; } .pp-pild { white-space: normal; }
  .pp-caja-cab { flex-wrap: wrap; }
}
`;

export const usd = (n: number) => `US$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const mas = (n: number) => (n > 0 ? `+${n} este mes` : 'Este mes, todavía ninguno');

/** El tono de la píldora de cada negocio: verde lo ganado, ámbar lo que está por ganarse, gris lo demás. */
export const tonoDelEstado = (e: keyof typeof TEXTO_ESTADO_REFERIDO): '' | 'good' | 'warn' => (e === 'acreditado' ? 'good' : e === 'primer-pago' ? 'warn' : '');

/** Un campo de sólo lectura con «Copiar» (el link, el código), y una acción al lado si la tiene («Cambiar»). */
function Copiable({ etiqueta, valor, accion }: { etiqueta: string; valor: string; accion?: { texto: string; onClick: () => void } }) {
  const [ok, setOk] = useState(false);
  const copiar = async () => { try { await navigator.clipboard.writeText(valor); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* seleccionable */ } };
  return (
    <div className="pp-campo">
      <div><small>{etiqueta}</small><input readOnly value={valor} aria-label={etiqueta} onFocus={(e) => e.currentTarget.select()} /></div>
      {accion && <button type="button" className="pp-texto" onClick={accion.onClick}>{accion.texto}</button>}
      <button type="button" className="pp-copiar" onClick={copiar}>{ok ? 'Copiado' : 'Copiar'}</button>
    </div>
  );
}

/**
 * El código, con «Cambiar» (27/10/2026, Leila en la llamada con Martín). El nuevo es único (lo dice la base) y lo de antes
 * sigue contando: el link y el código viejos le acreditan igual (lib/partners-programa.ts, `cambiarCodigoPartner`).
 */
function CodigoEditable({ codigo, onCambio }: { codigo: string; onCambio: (r: { codigo: string; link: string }) => void }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(codigo);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!editando) {
    return <Copiable etiqueta="Tu código, para poner al pagar" valor={codigo} accion={{ texto: 'Cambiar', onClick: () => { setValor(codigo); setError(null); setEditando(true); } }} />;
  }
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true); setError(null);
    const r = await cambiarCodigoPartnerAction(valor).catch(() => ({ ok: false as const, error: 'No pudimos conectarnos. Prueba otra vez.' }));
    setGuardando(false);
    if (r.ok) { onCambio({ codigo: r.codigo, link: r.link }); setEditando(false); } else setError(r.error);
  };
  return (
    <form onSubmit={guardar}>
      <div className="pp-edit">
        <input value={valor} maxLength={32} onChange={(e) => setValor(e.target.value)} placeholder="tu-codigo" aria-label="Tu código nuevo" autoFocus />
        <button type="submit" className="pp-copiar" disabled={guardando || !valor.trim()}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        <button type="button" className="pp-texto" onClick={() => setEditando(false)} disabled={guardando}>Cancelar</button>
      </div>
      {error ? <p className="pp-error" role="alert">{error} <ReportarASoporte /></p> :<p className="pp-nota" style={{ margin: '-4px 0 10px' }}>Tu link y tu código de antes siguen contando para ti.</p>}
    </form>
  );
}

/** Dónde le transfiere MaKo, con «Cambiar». */
function DondeCobra({ cobro }: { cobro: string | null }) {
  const [editando, setEditando] = useState(!cobro);
  const [valor, setValor] = useState(cobro ?? '');
  const [actual, setActual] = useState(cobro);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true); setError(null);
    const r = await cambiarCobroPartnerAction(valor).catch(() => ({ ok: false as const, error: 'No pudimos conectarnos. Prueba otra vez.' }));
    setGuardando(false);
    if (r.ok) { setActual(r.cobro); setEditando(!r.cobro); } else setError(r.error);
  };
  if (!editando && actual) {
    return (
      <div className="pp-cobro">
        <div><small>Te transferimos a</small><b>{actual}</b></div>
        <button type="button" className="pp-texto" onClick={() => setEditando(true)}>Cambiar</button>
      </div>
    );
  }
  return (
    <form onSubmit={guardar}>
      <div className="pp-edit">
        <input value={valor} maxLength={TOPE_COBRO} onChange={(e) => setValor(e.target.value)} placeholder="Tu alias, CBU o email de PayPal" aria-label="Dónde te transferimos" />
        <button type="submit" className="pp-copiar" disabled={guardando || !valor.trim()}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
      {error && <p className="pp-error" role="alert">{error} <ReportarASoporte /></p>}
    </form>
  );
}

export function PanelPartner({ tablero, nombreNegocio, agencia = false, cobraEnLinea = true, emailMako }: {
  tablero: Tablero | null;
  nombreNegocio: string | null;
  /** Una agencia: arriba, el botón a su Agency Dashboard (su cartera de clientes vive allá, no acá). */
  agencia?: boolean;
  /** ¿MaKo cobra en línea? Sin eso no se registra ningún referido solo, y el panel en cero lo dice (`textoSinReferidos`). */
  cobraEnLinea?: boolean;
  emailMako: string;
}) {
  // El link y el código vivos: «Cambiar» el código cambia los dos sin recargar (y los recursos de abajo, que los llevan).
  const [ref, setRef] = useState<{ codigo: string | null; link: string | null }>({ codigo: tablero?.codigo ?? null, link: tablero?.link ?? null });
  const acciones = (
    <>
      {agencia && <ButtonLink href="/agency" variant="secondary">Agency Dashboard</ButtonLink>}
      <ButtonLink href={RUTA_LANDING_PARTNERS} variant="secondary">Ver la landing</ButtonLink>
    </>
  );
  if (!tablero) {
    return <Pagina><PageHeader titulo="MaKo Partners" acciones={acciones} /><ErrorState titulo="No pude leer tu panel" detalle="Prueba otra vez en un minuto." /></Pagina>;
  }
  const r = tablero.resumen;
  const mes = PAGOS_PARA_ACREDITAR === 2 ? 'segundo' : `${PAGOS_PARA_ACREDITAR}º`;
  const textoWa = ref.link ? `Te recomiendo MaKo para vender más con tu negocio: ${ref.link}` : '';
  return (
    <Pagina>
      <style dangerouslySetInnerHTML={{ __html: CSS_PANEL }} />
      <PageHeader titulo="MaKo Partners" acciones={acciones} />
      <div className="pp-hola">
        <h2>{nombreNegocio ? `Hola, ${nombreNegocio}` : 'Tu panel de partner'}</h2>
        <p>Te llevas el 100% del primer mes de cada negocio que traes.</p>
      </div>
      <div className="pp-kpis">
        <div className="pp-kpi"><span className="pp-kpi-etq">Visitas a tu link</span><b>{tablero.visitas.total}</b><small className={tablero.visitas.esteMes ? 'bien' : ''}>{mas(tablero.visitas.esteMes)}</small></div>
        <div className="pp-kpi"><span className="pp-kpi-etq">Negocios que trajiste</span><b>{tablero.referidos.length}</b><small className={tablero.nuevosEsteMes ? 'bien' : ''}>{mas(tablero.nuevosEsteMes)}</small></div>
        <div className="pp-kpi"><span className="pp-kpi-etq">Ganaste</span><b>{usd(r.ganadoUsd)}</b><small>{r.porGanarUsd > 0 ? `${usd(r.porGanarUsd)} más en camino` : r.pagadoUsd > 0 ? `Ya cobraste ${usd(r.pagadoUsd)}` : 'El 100% de cada primer mes'}</small></div>
        <div className="pp-kpi destacado"><span className="pp-kpi-etq">A cobrar</span><b>{usd(r.aCobrarUsd)}</b><small>{tablero.alta?.cobro ? `A ${tablero.alta.cobro}` : 'Carga dónde te transferimos'}</small></div>
      </div>
      <div className="pp-fila">
        <section className="pp-caja" aria-labelledby="pp-ganado">
          <div className="pp-caja-cab"><h3 id="pp-ganado">Lo que ganaste</h3><span>Últimos 6 meses</span></div>
          <BarrasPorMes datos={tablero.porMes} vacio={`Cuando un negocio que trajiste pague su ${mes} mes, lo que ganaste aparece aquí.`} />
        </section>
        <section className="pp-caja" aria-labelledby="pp-comparte">
          <div className="pp-caja-cab"><h3 id="pp-comparte">Comparte</h3><span>Tu link dura {DIAS_COOKIE_REF} días</span></div>
          {ref.link && ref.codigo
            ? (
              <>
                <Copiable etiqueta="Tu link" valor={ref.link} />
                <CodigoEditable codigo={ref.codigo} onCambio={setRef} />
                <a className="pp-wa" href={`https://wa.me/?text=${encodeURIComponent(textoWa)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
              </>
            )
            : <ErrorState titulo="Todavía no tienes tu link" detalle="Prueba otra vez en un minuto." />}
        </section>
      </div>
      {/* Los recursos para revender (27/10/2026, compromiso de Martín con Leila): el PDF de venta y los mensajes, con su link. */}
      {ref.link && ref.codigo && <RecursosPartner link={ref.link} codigo={ref.codigo} nombreNegocio={nombreNegocio} />}
      <section className="pp-caja" aria-labelledby="pp-negocios" style={{ marginBottom: 14 }}>
        <div className="pp-caja-cab"><h3 id="pp-negocios">Tus negocios</h3><span>Ganas su primer mes cuando pagan el {mes}</span></div>
        {tablero.referidos.length === 0
          ? <div className="pp-vacio"><b>Tu primer negocio aparece aquí</b>{textoSinReferidos({ cobraEnLinea, emailMako })}</div>
          : (
            <table className="pp-tabla">
              <thead><tr><th>Negocio</th><th className="ocultable">Plan</th><th className="ocultable">Desde</th><th>Estado</th><th className="num">Te deja</th></tr></thead>
              <tbody>
                {tablero.referidos.map((x) => (
                  <tr key={x.ws}>
                    <td><b>{x.nombre}</b></td>
                    <td className="ocultable"><span>{x.plan ?? '—'}</span></td>
                    <td className="ocultable"><span>{fecha(x.desde)}</span></td>
                    <td><span className={`pp-pild ${tonoDelEstado(x.estado)}`}>{TEXTO_ESTADO_REFERIDO[x.estado]}</span></td>
                    <td className="num"><b>{x.gananciaUsd != null && x.estado !== 'se-fue' ? usd(x.gananciaUsd) : '—'}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </section>
      <section className="pp-caja" aria-labelledby="pp-cobros">
        <div className="pp-caja-cab"><h3 id="pp-cobros">Tus cobros</h3><span>Cobrado: {usd(r.pagadoUsd)}</span></div>
        <DondeCobra cobro={tablero.alta?.cobro ?? null} />
        {tablero.pagos.length === 0
          ? <p className="pp-nota">Todavía no te transferimos nada. Cuando tengas algo a cobrar, {PAGO_HOY.charAt(0).toLowerCase() + PAGO_HOY.slice(1)}</p>
          : (
            <ul className="pp-pagos">
              {tablero.pagos.map((p, i) => <li key={i}><span>{fecha(p.fecha)}</span><b>{usd(p.montoUsd)}</b></li>)}
            </ul>
          )}
      </section>
    </Pagina>
  );
}
