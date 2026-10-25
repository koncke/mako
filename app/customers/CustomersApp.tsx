'use client';

// =============================================================================
// CustomersApp — la pestaña Customers: los números, los segmentos y la grilla de los clientes de MaKo (25/10/2026)
// =============================================================================
// Copiado de lo que se miró (docs/hallazgos-agencias.md, las capturas en la carpeta de notas del Cerebro):
//   · ARRIBA, LAS TARJETAS DE BAREMETRICS: el número grande y lo que lo explica abajo en gris. El MRR sale de los cobros
//     reales de la plataforma (lib/clientes-plataforma-reglas.ts), nunca del precio del plan.
//   · AL LADO, SU «BREAKDOWN»: cuántos hay en cada segmento, con su barra, y los últimos negocios que llegaron.
//   · LOS SEGMENTOS EN PILLS CON SU CONTEO, como Stripe › Customers (Todos · Clientes · Partners · Agencies · Clientes de
//     agencias). Elegir uno filtra la grilla de abajo.
//   · LA GRILLA ES LA DE SIEMPRE (AdminView: alta, plan, equipo, ficha, entrar), en tabla por defecto y con su segmento y
//     su MRR. No se rehízo: si dos cosas tienen que verse igual, tienen que ser el mismo componente.

import { useMemo, useState } from 'react';
import { Banner } from '@/app/_ui';
import { Marca } from '@/app/_components/Marca';
import { colorDe } from '@/app/_components/TarjetaEntidad';
import { AdminView, type ExtraDeCliente, type SegmentoAdmin } from '@/app/admin/AdminView';
import type { VistaClientes } from '@/lib/clientes-plataforma';
import { ROTULO_SEGMENTO, SEGMENTOS, type Segmento } from '@/lib/clientes-plataforma-reglas';
import type { TrabajoDeCliente } from '@/app/customer-success/trabajo';
import type { ClienteRef } from '@/lib/plan-clientes';
import type { BoardUser } from '@/app/plan/board/types';

type Pill = 'todos' | Segmento;

const PILLS: ReadonlyArray<{ id: Pill; rotulo: string }> = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'cliente', rotulo: 'Clientes' },
  { id: 'partner', rotulo: 'Partners' },
  { id: 'agency', rotulo: 'Agencies' },
  { id: 'de-agencia', rotulo: 'Clientes de agencias' },
];

const usdTxt = (n: number) => `US$ ${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
};

export function CustomersApp({ vista, trabajo, clientes, user, verComputadoras }: {
  vista: VistaClientes;
  trabajo: { dueno: boolean; porCliente: Record<number, TrabajoDeCliente> } | null;
  clientes: ClienteRef[];
  user: BoardUser;
  verComputadoras: boolean;
}) {
  const [pill, setPill] = useState<Pill>('todos');
  const { kpis, filas } = vista;

  const extra = useMemo(() => Object.fromEntries(filas.map((f) => [f.ws, {
    segmentos: f.segmentos, mrrUsd: f.mrrUsd, sinDolares: f.sinDolares, prueba: f.prueba, riesgo: f.riesgo, agencia: f.agencia,
  } satisfies ExtraDeCliente])), [filas]);
  const segmento = useMemo<SegmentoAdmin | null>(() => (pill === 'todos' ? null : {
    ws: new Set(filas.filter((f) => f.segmentos.includes(pill)).map((f) => f.ws)),
    conDeAgencias: pill === 'de-agencia',
  }), [pill, filas]);
  const recientes = useMemo(() => [...filas].filter((f) => !f.segmentos.includes('de-agencia'))
    .sort((a, b) => b.creado.localeCompare(a.creado)).slice(0, 5), [filas]);
  const total = filas.length || 1;

  return (
    <div className="cu-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {vista.avisos.length > 0 && (
        <Banner tono="warn" alcance="local">Algún número puede quedarse corto: no pude leer {vista.avisos.join(' · ')}.</Banner>
      )}

      <div className="cu-arriba">
        <div className="cu-kpis">
          <div className="cu-kpi">
            <span className="cu-kpi-t">Ingreso mensual (MRR)</span>
            <b>{usdTxt(kpis.mrrUsd)}{kpis.sinDolares ? <small> +{kpis.sinDolares} sin dólares</small> : null}</b>
            <span className="cu-kpi-s">{kpis.pagan} {kpis.pagan === 1 ? 'negocio paga' : 'negocios pagan'} por la pasarela</span>
          </div>
          <div className="cu-kpi">
            <span className="cu-kpi-t">Clientes activos</span>
            <b>{kpis.activos}</b>
            <span className="cu-kpi-s">Sin contar los de las agencias</span>
          </div>
          <div className="cu-kpi">
            <span className="cu-kpi-t">Nuevos en 30 días</span>
            <b>{kpis.nuevos30}</b>
            <span className="cu-kpi-s">Cuentas que se dieron de alta</span>
          </div>
          <div className="cu-kpi" data-tono={kpis.enRiesgo ? 'warn' : undefined}>
            <span className="cu-kpi-t">En riesgo</span>
            <b>{kpis.enRiesgo}</b>
            <span className="cu-kpi-s">Pausados o con un cobro que falló</span>
          </div>
        </div>
        <aside className="cu-lado">
          <h3>Por segmento</h3>
          <ul className="cu-barras">
            {SEGMENTOS.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => setPill(s)} aria-label={`Ver ${ROTULO_SEGMENTO[s]}`}>
                  <span className="cu-barra-t">{PILLS.find((p) => p.id === s)?.rotulo}</span>
                  <span className="cu-barra"><i data-s={s} style={{ width: `${Math.round((kpis.porSegmento[s] / total) * 100)}%` }} /></span>
                  <b>{kpis.porSegmento[s]}</b>
                </button>
              </li>
            ))}
          </ul>
          <h3>Recién llegados</h3>
          <ul className="cu-recientes">
            {recientes.map((f) => (
              <li key={f.ws}>
                <Marca icono={null} foto={null} nombre={f.nombre} tam={24} color={colorDe(f.nombre)} />
                <span>{f.nombre}</span>
                <em>{fechaCorta(f.creado)}</em>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <div className="cu-pills" role="tablist" aria-label="Qué clientes ver">
        {PILLS.map((p) => {
          const n = p.id === 'todos' ? filas.filter((f) => !f.segmentos.includes('de-agencia')).length : kpis.porSegmento[p.id];
          return (
            <button key={p.id} type="button" role="tab" aria-selected={pill === p.id} className="cu-pill" data-on={pill === p.id} onClick={() => setPill(p.id)}>
              {p.rotulo}<span>{n}</span>
            </button>
          );
        })}
      </div>

      <AdminView incrustado trabajo={trabajo} clientes={clientes} user={user} verComputadoras={verComputadoras}
        segmento={segmento} extra={extra} />
    </div>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.cu-root{ display:flex; flex-direction:column; gap:18px; }
.cu-arriba{ display:grid; grid-template-columns:minmax(0, 2fr) minmax(260px, 1fr); gap:16px; align-items:stretch; }
.cu-kpis{ display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px; }
.cu-kpi{ background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:18px 20px; display:flex; flex-direction:column; gap:6px; min-width:0; }
.cu-kpi-t{ font-size:13.5px; color:var(--dim); font-weight:600; }
.cu-kpi b{ font-size:34px; line-height:1.05; font-weight:800; letter-spacing:-.03em; color:var(--ink); }
.cu-kpi b small{ font-size:13px; font-weight:600; color:var(--warn); letter-spacing:0; }
.cu-kpi[data-tono="warn"] b{ color:var(--warn); }
.cu-kpi-s{ font-size:12.5px; color:var(--faint); }
.cu-lado{ background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:16px 18px; display:flex; flex-direction:column; gap:8px; min-width:0; }
.cu-lado h3{ margin:4px 0 2px; font-size:14px; font-weight:750; color:var(--ink); }
.cu-barras, .cu-recientes{ list-style:none; margin:0 0 6px; padding:0; display:flex; flex-direction:column; gap:4px; }
.cu-barras button{ width:100%; display:grid; grid-template-columns:130px 1fr 34px; gap:10px; align-items:center; border:0; background:none;
  padding:5px 4px; border-radius:8px; font:inherit; cursor:pointer; color:var(--ink); }
.cu-barras button:hover{ background:var(--surface-2); }
.cu-barra-t{ font-size:13px; text-align:left; color:var(--dim); }
.cu-barra{ height:8px; border-radius:999px; background:var(--surface-2); overflow:hidden; }
.cu-barra i{ display:block; height:100%; border-radius:999px; background:var(--primary); min-width:4px; }
.cu-barra i[data-s="partner"]{ background:var(--good); }
.cu-barra i[data-s="cliente"]{ background:var(--dim); }
.cu-barra i[data-s="de-agencia"]{ background:var(--warn); }
.cu-barras b{ font-size:13.5px; text-align:right; font-variant-numeric:tabular-nums; }
.cu-recientes li{ display:flex; align-items:center; gap:9px; font-size:13.5px; padding:4px; min-width:0; }
.cu-recientes span{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink); }
.cu-recientes em{ font-style:normal; font-size:12px; color:var(--faint); white-space:nowrap; }
.cu-pills{ display:flex; gap:8px; flex-wrap:wrap; }
.cu-pill{ border:1px solid var(--border); background:var(--surface); border-radius:999px; padding:7px 14px; font:inherit; font-size:13.5px;
  font-weight:600; color:var(--dim); cursor:pointer; display:inline-flex; gap:8px; align-items:center; }
.cu-pill span{ font-size:12px; font-weight:700; color:var(--faint); }
.cu-pill[data-on="true"]{ border-color:var(--ink); color:var(--ink); box-shadow:0 0 0 1px var(--ink) inset; }
.cu-pill[data-on="true"] span{ color:var(--ink); }
@media (max-width: 980px){
  .cu-arriba{ grid-template-columns:1fr; }
}
@media (max-width: 560px){
  .cu-kpis{ grid-template-columns:1fr; }
  .cu-kpi b{ font-size:28px; }
}
`;
