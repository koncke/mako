'use client';

// =============================================================================
// IngresosAdmin — Admin › Revenue: lo que entra a MaKo (5/11/2026)
// =============================================================================
// Martín: «¿Cuánto es lo que me pagaron totalmente? ¿Cuánto me van pagando mes a mes?». Las cuentas, en
// lib/admin-ingresos-reglas.ts; el lector, en lib/admin-ingresos.ts. Qué se copió de dónde, en docs/investigacion-admin.md:
//   · arriba, la foto de hoy (Baremetrics Control Center y el «photo of today» de Lago): el MRR grande con su «desde», lo
//     cobrado este mes, lo cobrado desde siempre y cuántos pagan con su promedio;
//   · el MRR mes a mes con el mes en curso RAYADO (ChartMogul: «estimado hasta que cierre»; AGENTS.md: el rayado es lo no
//     medido), y debajo la tabla de saldos de Lago: al empezar, cada movimiento, al cerrar;
//   · lo cobrado por mes con la MISMA barra (un solo sistema), aparte y con su nombre (Lago: un gráfico de plata que entró
//     no es un saldo);
//   · lo que viene (los vencimientos), el feed de movimientos de ProfitWell (captura 02), la lista de clientes de Stripe y
//     Baremetrics con lo que pagó cada uno en total, y los últimos pagos con su medio real.
//
// ⚠️ SIN TARJETAS EN CERO: sin un solo pago, la pantalla dice qué hacer y no dibuja nada en «US$ 0».
// ⚠️ NINGÚN BACKTICK EN EL CSS DE ABAJO, ni en un comentario: cierra la cadena a la mitad.

import { useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Banner, EmptyState } from '@/app/_ui';
import { Marca } from '@/app/_components/Marca';
import { colorDe } from '@/app/_components/TarjetaEntidad';
import type { VistaIngresos } from '@/lib/admin-ingresos';
import {
  ROTULO_ESTADO_CLIENTE, ROTULO_MOVIMIENTO, diaTxt, diasEntre, medioTxt, mesTxt, usd, usdConSigno,
  type ClienteResumen, type MesIngresos,
} from '@/lib/admin-ingresos-reglas';
import { mesesVisibles, cambioPct, filasDeSaldos } from './ingresos-vista';

/** A dónde lleva un cliente: su ficha de negocio si tiene cuenta, si no su ficha del CRM de la plataforma. */
const rutaCliente = (c: { ws: number | null; leadId: number | null }): string | null =>
  c.ws != null ? `/admin?tab=customers&cliente=${c.ws}` : c.leadId != null ? `/crm/${c.leadId}` : null;

export function IngresosAdmin({ vista }: { vista: VistaIngresos }) {
  const { hoy } = vista;
  const quien = useMemo(() => new Map(vista.clientes.map((c) => [c.clave, c])), [vista.clientes]);
  const nombre = (clave: string) => quien.get(clave)?.nombre ?? clave;
  const meses = useMemo(() => mesesVisibles(vista.meses), [vista.meses]);
  const [verTodos, setVerTodos] = useState(false);

  if (vista.cobradoTotal <= 0 && vista.pagos.length === 0) {
    return (
      <div className="ing">
        <style>{CSS}</style>
        {vista.avisos.length > 0 && <Banner tono="warn">No pude leer {vista.avisos.join(' · ')}.</Banner>}
        <EmptyState
          titulo="Todavía no entró ningún pago"
          detalle="Carga cada pago en la ficha del cliente en el CRM, o vende un plan por la pasarela: aparecen aquí solos."
          accion={{ label: 'Vender un plan', href: '/admin?tab=billing' }}
        />
      </div>
    );
  }

  const pct = cambioPct(vista.mrr, vista.mrrMesPasado);
  const mesPasado = vista.meses[vista.meses.length - 2]?.mes;
  const movs = verTodos ? vista.movimientos : vista.movimientos.slice(0, 8);
  return (
    <div className="ing">
      <style>{CSS}</style>
      {vista.avisos.length > 0 && <Banner tono="warn">No pude leer {vista.avisos.join(' · ')}: lo que ves puede quedarse corto.</Banner>}

      {/* La foto de hoy. */}
      <section className="ing-hoy" aria-label="Hoy">
        <div className="ing-kpi ing-kpi--grande">
          <span>Ingreso mensual (MRR)</span>
          <b>{usd(vista.mrr)}</b>
          {mesPasado && (
            <small data-tono={pct == null ? 'neutral' : pct >= 0 ? 'good' : 'bad'}>
              {pct == null ? `Desde ${usd(vista.mrrMesPasado)} en ${mesTxt(mesPasado, hoy)}` : `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% desde ${usd(vista.mrrMesPasado)} en ${mesTxt(mesPasado, hoy)}`}
            </small>
          )}
        </div>
        <div className="ing-kpi"><span>Cobrado en {mesTxt(hoy.slice(0, 7), hoy)}</span><b>{usd(vista.cobradoEsteMes)}</b>
          {mesPasado && <small>{usd(vista.cobradoMesPasado)} en {mesTxt(mesPasado, hoy)}</small>}</div>
        <div className="ing-kpi"><span>Cobrado desde siempre</span><b>{usd(vista.cobradoTotal)}</b>
          {vista.sinDolares > 0 && <small data-tono="warn">{vista.sinDolares} {vista.sinDolares === 1 ? 'pago' : 'pagos'} sin su valor en dólares</small>}</div>
        <div className="ing-kpi"><span>Clientes que pagan</span><b>{vista.pagando}</b>
          {vista.arpu != null && <small>{usd(vista.arpu)} por cliente</small>}</div>
      </section>

      <div className="ing-dos">
        {/* El MRR mes a mes, con la tabla de saldos. */}
        <section className="ing-caja" aria-label="MRR mes a mes">
          <h2>MRR mes a mes</h2>
          <Barras meses={meses} valor={(m) => m.mrr} hoy={hoy} />
          <TablaSaldos meses={meses.slice(-6)} hoy={hoy} />
        </section>
        <div className="ing-col">
          <section className="ing-caja" aria-label="Cobrado por mes">
            <h2>Cobrado por mes</h2>
            <Barras meses={meses} valor={(m) => m.cobrado} hoy={hoy} />
            <p className="ing-gris">Todo lo que entró: mensualidades, pagos sueltos y ventas de pago único.</p>
          </section>
          <section className="ing-caja" aria-label="Lo que viene">
            <h2>Lo que viene <span>{vista.porCobrar.length}</span></h2>
            {vista.porCobrar.length === 0 ? <p className="ing-gris">No hay vencimientos en los próximos 31 días.</p> : (
              <ul className="ing-lista">
                {vista.porCobrar.map((p) => {
                  const dias = diasEntre(hoy, p.fecha);
                  return (
                    <li key={`${p.cliente}-${p.fecha}`}>
                      <span className="ing-etq" data-tono={p.atrasado ? 'bad' : dias <= 5 ? 'warn' : 'info'}>{p.atrasado ? `Atrasado ${-dias} d` : dias === 0 ? 'Hoy' : `En ${dias} d`}</span>
                      <span className="ing-txt"><b>{nombre(p.cliente)}</b><small>{p.atrasado ? 'Venció' : 'Vence'} el {diaTxt(p.fecha, hoy)}</small></span>
                      <span className="ing-monto">{usd(p.usd)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section className="ing-caja" aria-label="Movimientos">
        <h2>Movimientos <span>{vista.movimientos.length}</span></h2>
        {vista.movimientos.length === 0 ? <p className="ing-gris">Todavía ninguna mensualidad: los movimientos salen de los pagos registrados como la mensualidad.</p> : (
          <>
            <ul className="ing-lista">
              {movs.map((m) => {
                const r = ROTULO_MOVIMIENTO[m.tipo];
                return (
                  <li key={`${m.cliente}-${m.fecha}-${m.tipo}`}>
                    <span className="ing-etq" data-tono={r.tono}>{r.rotulo}</span>
                    <span className="ing-txt"><b>{nombre(m.cliente)}</b><small>{diaTxt(m.fecha, hoy)} · {m.despues > 0 ? `paga ${usd(m.despues)} por mes` : `pagaba ${usd(m.antes)} por mes`}</small></span>
                    <span className="ing-monto" data-tono={m.delta >= 0 ? 'good' : 'bad'}>{usdConSigno(m.delta)}</span>
                  </li>
                );
              })}
            </ul>
            {vista.movimientos.length > 8 && <button type="button" className="ing-mas" onClick={() => setVerTodos((v) => !v)}>{verTodos ? 'Ver menos' : `Ver los ${vista.movimientos.length}`}</button>}
          </>
        )}
      </section>

      <section aria-label="Clientes">
        <h2 className="ing-titulo">Lo que pagó cada cliente</h2>
        <div className="ing-tabla" role="table">
          <div className="ing-fila ing-cab" role="row">
            <span role="columnheader">Cliente</span><span role="columnheader">Estado</span>
            <span role="columnheader" className="ing-num">Por mes</span><span role="columnheader" className="ing-num">Pagó en total</span>
            <span role="columnheader">Desde</span><span role="columnheader">Próximo cobro</span>
          </div>
          {vista.clientes.map((c) => <FilaCliente key={c.clave} c={c} hoy={hoy} />)}
        </div>
      </section>

      <section aria-label="Últimos pagos">
        <h2 className="ing-titulo">Últimos pagos</h2>
        <div className="ing-tabla" role="table">
          <div className="ing-fila ing-fila--pago ing-cab" role="row">
            <span role="columnheader">Fecha</span><span role="columnheader">Cliente</span><span role="columnheader" className="ing-num">Monto</span>
            <span role="columnheader">Medio</span><span role="columnheader">Qué fue</span>
          </div>
          {vista.pagos.map((p) => (
            <div key={p.id} className="ing-fila ing-fila--pago" role="row">
              <span>{diaTxt(p.fecha, hoy)}</span>
              <span className="ing-quien-txt">{p.nombre}</span>
              <span className="ing-num">{p.usd == null ? '—' : usd(p.usd)}</span>
              <span>{medioTxt(p.medio)}</span>
              <span className="ing-gris ing-corta">{p.recurrente ? 'Mensualidad' : p.concepto || 'Pago suelto'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FilaCliente({ c, hoy }: { c: ClienteResumen; hoy: string }) {
  const e = ROTULO_ESTADO_CLIENTE[c.estado];
  const ruta = rutaCliente(c);
  const cuerpo = (
    <>
      <span className="ing-quien"><Marca icono={null} foto={null} nombre={c.nombre} tam={32} color={colorDe(c.nombre)} />
        <span><b>{c.nombre}</b><small>{c.pagos} {c.pagos === 1 ? 'pago' : 'pagos'}{c.ws == null ? ' · sin cuenta en MaKo' : ''}</small></span></span>
      <span><span className="ing-estado" data-tono={e.tono}>{e.rotulo}{c.estado === 'atrasado' && c.diasAtraso != null ? ` ${c.diasAtraso} d` : ''}</span></span>
      <span className="ing-num">{c.mrr > 0 ? usd(c.mrr) : '—'}</span>
      <span className="ing-num"><b>{usd(c.total)}</b></span>
      <span>{c.primerPago ? diaTxt(c.primerPago, hoy) : '—'}</span>
      <span>{c.proximo ? diaTxt(c.proximo, hoy) : '—'}</span>
    </>
  );
  return ruta ? <Link href={ruta} className="ing-fila ing-fila--link" role="row">{cuerpo}</Link> : <div className="ing-fila" role="row">{cuerpo}</div>;
}

/** Una barra por mes con su valor arriba; el mes en curso, rayado (todavía no cerró). */
function Barras({ meses, valor, hoy }: { meses: readonly MesIngresos[]; valor: (m: MesIngresos) => number; hoy: string }) {
  const maximo = Math.max(1, ...meses.map(valor));
  return (
    <div className="ing-barras" role="img" aria-label={meses.map((m) => `${mesTxt(m.mes, hoy)}: ${usd(valor(m))}`).join(', ')}>
      {meses.map((m) => {
        const v = valor(m);
        return (
          <div key={m.mes} className="ing-barra" title={`${usd(v)} en ${mesTxt(m.mes, hoy)}${m.enCurso ? ' (en curso)' : ''}`}>
            <em>{v > 0 ? usd(Math.round(v)) : ''}</em>
            <i style={{ height: `${v > 0 ? Math.max(4, Math.round((v / maximo) * 100)) : 2}%` }} data-cero={v === 0} data-curso={m.enCurso} />
            <span>{mesTxt(m.mes, hoy)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** La tabla de saldos de Lago: el MRR al empezar, cada movimiento y al cerrar, por mes. */
function TablaSaldos({ meses, hoy }: { meses: readonly MesIngresos[]; hoy: string }) {
  const filas = filasDeSaldos(meses);
  return (
    <div className="ing-saldos" role="table" aria-label="Cómo cambió el MRR cada mes">
      <div role="row" className="ing-saldos-fila ing-saldos-cab" style={{ gridTemplateColumns: `minmax(110px, 1.4fr) repeat(${meses.length}, minmax(0, 1fr))` }}>
        <span role="columnheader" />
        {meses.map((m) => <span key={m.mes} role="columnheader">{mesTxt(m.mes, hoy)}{m.enCurso ? '*' : ''}</span>)}
      </div>
      {filas.map((f) => (
        <div key={f.id} role="row" className="ing-saldos-fila" data-total={f.total} style={{ gridTemplateColumns: `minmax(110px, 1.4fr) repeat(${meses.length}, minmax(0, 1fr))` }}>
          <span role="rowheader">{f.rotulo}</span>
          {f.valores.map((v, i) => (
            <span key={meses[i].mes} data-tono={f.signo === 0 || v === 0 ? 'neutral' : f.signo > 0 ? 'good' : 'bad'}>
              {v === 0 ? '—' : f.signo === 0 ? usd(Math.round(v)) : `${f.signo > 0 ? '+' : '−'}${usd(Math.round(v)).replace('US$ ', '')}`}
            </span>
          ))}
        </div>
      ))}
      {meses.some((m) => m.enCurso) && <p className="ing-gris">* El mes en curso todavía no cerró.</p>}
    </div>
  );
}

const CSS = `
.ing{ display:flex; flex-direction:column; gap:18px; }
.ing h2{ margin:0; font-size:14px; font-weight:650; color:var(--dim); display:flex; align-items:center; gap:8px; }
.ing h2 span{ font-size:12px; font-weight:700; color:var(--ink); background:var(--surface-2); padding:1px 8px; border-radius:999px; }
.ing-titulo{ margin:0 0 10px !important; }
.ing-gris{ margin:0; font-size:13px; color:var(--faint); line-height:1.5; }
.ing-hoy{ display:grid; grid-template-columns:minmax(0, 1.5fr) repeat(3, minmax(0, 1fr)); gap:12px; }
.ing-kpi{ background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px 18px; display:flex; flex-direction:column; gap:4px; min-width:0; }
.ing-kpi span{ font-size:13px; color:var(--dim); font-weight:600; }
.ing-kpi b{ font-size:26px; font-weight:800; letter-spacing:-.02em; color:var(--ink); font-variant-numeric:tabular-nums; }
.ing-kpi--grande b{ font-size:36px; letter-spacing:-.03em; }
.ing-kpi small{ font-size:13px; color:var(--faint); font-weight:600; }
.ing-kpi small[data-tono="good"]{ color:var(--good); }
.ing-kpi small[data-tono="bad"]{ color:var(--bad); }
.ing-kpi small[data-tono="warn"]{ color:var(--warn); }
.ing-dos{ display:grid; grid-template-columns:minmax(0, 1.35fr) minmax(300px, 1fr); gap:16px; align-items:start; }
.ing-col{ display:flex; flex-direction:column; gap:16px; min-width:0; }
.ing-caja{ background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:18px 20px; min-width:0; display:flex; flex-direction:column; gap:14px; }
.ing-barras{ display:flex; align-items:flex-end; gap:8px; height:150px; }
.ing-barra{ flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:5px; min-width:0; }
.ing-barra em{ font-style:normal; font-size:11px; font-weight:650; color:var(--dim); white-space:nowrap; font-variant-numeric:tabular-nums; }
.ing-barra i{ display:block; width:100%; max-width:44px; background:var(--primary); border-radius:6px 6px 2px 2px; }
.ing-barra i[data-cero="true"]{ background:var(--border); }
.ing-barra i[data-curso="true"]{ background:repeating-linear-gradient(135deg, var(--primary) 0 5px, color-mix(in srgb, var(--primary) 45%, transparent) 5px 10px); }
.ing-barra span{ font-size:11.5px; color:var(--faint); }
.ing-saldos{ display:flex; flex-direction:column; border-top:1px solid var(--border); padding-top:6px; }
.ing-saldos-fila{ display:grid; gap:8px; padding:6px 0; font-size:13px; font-variant-numeric:tabular-nums; }
.ing-saldos-fila > span{ text-align:right; white-space:nowrap; color:var(--ink); }
.ing-saldos-fila > span:first-child{ text-align:left; color:var(--dim); }
.ing-saldos-fila > span[data-tono="good"]{ color:var(--good); }
.ing-saldos-fila > span[data-tono="bad"]{ color:var(--bad); }
.ing-saldos-fila > span[data-tono="neutral"]{ color:var(--faint); }
.ing-saldos-fila[data-total="true"]{ border-top:1px solid var(--border); font-weight:700; }
.ing-saldos-fila[data-total="true"] > span[data-tono="neutral"]{ color:var(--ink); }
.ing-saldos-cab > span{ font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); font-weight:700; }
.ing-lista{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; }
.ing-lista li{ display:flex; align-items:center; gap:12px; padding:9px 2px; border-bottom:1px solid var(--border); min-width:0; }
.ing-lista li:last-child{ border-bottom:0; }
.ing-etq{ flex:none; width:100px; font-size:10.5px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; padding:4px 0; border-radius:6px; text-align:center; }
.ing-etq[data-tono="bad"]{ background:var(--bad-bg); color:var(--bad); }
.ing-etq[data-tono="warn"]{ background:var(--warn-bg); color:var(--warn); }
.ing-etq[data-tono="info"]{ background:var(--primary-bg); color:var(--primary); }
.ing-etq[data-tono="good"]{ background:var(--good-bg); color:var(--good); }
.ing-txt{ flex:1; min-width:0; display:flex; flex-direction:column; }
.ing-txt b{ font-size:14px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ing-txt small{ font-size:12.5px; color:var(--dim); }
.ing-monto{ flex:none; font-size:14px; font-weight:700; font-variant-numeric:tabular-nums; color:var(--ink); }
.ing-monto[data-tono="good"]{ color:var(--good); }
.ing-monto[data-tono="bad"]{ color:var(--bad); }
.ing-mas{ align-self:flex-start; border:0; background:none; padding:0; font:inherit; font-size:13px; font-weight:650; color:var(--primary); cursor:pointer; }
.ing-tabla{ background:var(--surface); border:1px solid var(--border); border-radius:16px; overflow:hidden; }
.ing-fila{ display:grid; grid-template-columns:minmax(200px, 2fr) 130px 100px 120px 100px 120px; gap:14px; align-items:center; padding:10px 18px;
  border-bottom:1px solid var(--border); color:inherit; text-decoration:none; font-size:14px; }
.ing-fila > span{ min-width:0; }
.ing-fila--pago{ grid-template-columns:90px minmax(160px, 2fr) 110px 130px minmax(120px, 1.5fr); }
.ing-fila:last-child{ border-bottom:0; }
.ing-fila--link:hover{ background:var(--surface-2); }
.ing-cab{ background:var(--surface-2); font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); font-weight:700; padding-block:9px; }
.ing-num{ text-align:right; font-variant-numeric:tabular-nums; }
.ing-quien{ display:flex; align-items:center; gap:11px; min-width:0; }
.ing-quien > span{ display:flex; flex-direction:column; min-width:0; }
.ing-quien b, .ing-quien-txt{ font-size:14px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ing-quien small{ font-size:12px; color:var(--faint); }
.ing-corta{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ing-estado{ display:inline-block; font-size:12px; font-weight:650; padding:3px 10px; border-radius:999px; white-space:nowrap; }
.ing-estado[data-tono="good"]{ background:var(--good-bg); color:var(--good); }
.ing-estado[data-tono="warn"]{ background:var(--warn-bg); color:var(--warn); }
.ing-estado[data-tono="bad"]{ background:var(--bad-bg); color:var(--bad); }
.ing-estado[data-tono="info"]{ background:var(--primary-bg); color:var(--primary); }
.ing-estado[data-tono="neutral"]{ background:var(--surface-2); color:var(--dim); }
@media (max-width: 1080px){
  .ing-dos{ grid-template-columns:1fr; }
  .ing-hoy{ grid-template-columns:repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px){
  .ing-cab{ display:none; }
  .ing-fila{ grid-template-columns:1fr auto; row-gap:4px; padding:12px 14px; }
  .ing-fila > span:nth-child(n+3){ display:none; }
  .ing-fila--pago > span:nth-child(3){ display:block; grid-column:2; grid-row:1; }
  .ing-hoy{ grid-template-columns:1fr; }
}
`;
