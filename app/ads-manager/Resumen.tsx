'use client';

// =============================================================================
// Media Buyer — Resumen (el «Overview» de AdAmigo, adamigo-3) (25/10/2026)
// =============================================================================
// Cómo va el mes de un vistazo: las metas (lo cobrado contra la meta de ventas, el gasto contra el previsto, el costo por
// resultado contra el objetivo), lo que hizo MaKo (cada cambio, de quién y cuándo, con su deshacer en Autopilot), la cuenta
// por producto y los agentes. En el teléfono, el resumen de agentes reemplaza al botón «N activos» de la barra de arriba.
// Una sección sin nada no se dibuja.
// =============================================================================

import type { ConfigMediaBuyer, Decision, MetasDelMes } from '@/lib/media-buyer/tipos';
import type { TacticasResueltas } from '@/lib/media-buyer/tacticas';
import type { AgentePropio } from '@/lib/media-buyer/agentes-propios';
import { fmtDinero } from '@/lib/format';
import { Criatura } from '@/app/_components/Criatura';
import { iniciales } from '@/lib/unicode-seguro';
import { EtiquetaAgente, PanelCuenta, type ProductoEnCuenta } from './Autopilot';
import { estadoDeAgente, hace, queSeHizo } from './mb-modelo';

const AGENTES = [['estratega', 'calidad'], ['media_buyer', 'surf'], ['disenador', 'ganador'], ['protect', 'stop_loss']] as const;

export function Resumen({ metas, config, productos, implementadas, tacticas, propios, onAgentes, onVerHechas }: {
  metas: MetasDelMes | null;
  config: Pick<ConfigMediaBuyer, 'kpi' | 'objetivo' | 'metaVentasMes' | 'metaGastoMes' | 'encendido'>;
  productos: ProductoEnCuenta[];
  implementadas: Decision[];
  tacticas: TacticasResueltas;
  propios: AgentePropio[];
  onAgentes: () => void;
  onVerHechas: () => void;
}) {
  const fmt = (u: number) => (metas && !metas.convierte ? fmtDinero(u, metas.moneda) : fmtDinero(u));
  const res = !metas ? 0 : config.kpi === 'venta' ? metas.resultados.ventas : config.kpi === 'agenda' ? metas.resultados.agendas : metas.resultados.leads;
  const costo = metas && res > 0 ? metas.gasto / res : null;
  const nombreCosto = config.kpi === 'venta' ? 'Costo por venta' : config.kpi === 'agenda' ? 'Costo por agenda' : 'Costo por lead';
  const barra = (a: number, b: number | null) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
  return (
    <div className="aa-grid">
      <div className="aa-lista">
        {metas && (
          <section className="aa-panel" aria-label="Metas del mes">
            <h2>Metas del mes</h2>
            <p>{metas.diasQuedan === 1 ? 'Queda 1 día' : `Quedan ${metas.diasQuedan} días`}</p>
            <div className="aa-metas">
              <div className="aa-meta">
                <span>Cobrado</span><b>{fmt(metas.caja)}{config.metaVentasMes ? <small> / {fmt(config.metaVentasMes)}</small> : null}</b>
                {config.metaVentasMes ? <i className="aa-meta-barra"><i style={{ width: `${barra(metas.caja, config.metaVentasMes)}%` }} /></i> : <small className="aa-meta-sin">Sin meta</small>}
              </div>
              <div className="aa-meta">
                <span>Gasto en Meta</span><b>{fmt(metas.gasto)}{config.metaGastoMes ? <small> / {fmt(config.metaGastoMes)}</small> : null}</b>
                {config.metaGastoMes ? <i className="aa-meta-barra"><i style={{ width: `${barra(metas.gasto, config.metaGastoMes)}%` }} /></i> : <small className="aa-meta-sin">Sin meta</small>}
              </div>
              <div className="aa-meta">
                <span>{nombreCosto}</span>
                <b data-tono={costo != null && config.objetivo ? (costo <= config.objetivo ? 'bien' : 'mal') : undefined}>{costo != null ? fmt(costo) : '—'}{config.objetivo ? <small> / {fmt(config.objetivo)}</small> : null}</b>
                {config.objetivo && costo != null ? <i className="aa-meta-barra" data-tono={costo <= config.objetivo ? 'bien' : 'mal'}><i style={{ width: `${Math.min(100, Math.round((config.objetivo / costo) * 100))}%` }} /></i> : <small className="aa-meta-sin">MaKo recomienda el objetivo</small>}
              </div>
            </div>
          </section>
        )}
        {implementadas.length > 0 && (
          <section className="aa-panel" aria-label="Lo que hizo MaKo">
            <div className="aa-panel-cab"><h2>Lo que hizo MaKo</h2><button type="button" className="aa-link" onClick={onVerHechas}>Ver todo</button></div>
            <ul className="aa-actividad">
              {implementadas.slice(0, 8).map((d) => {
                const piloto = d.origen === 'piloto';
                const quien = piloto ? 'Piloto automático' : d.aplicadaPor ?? 'Tu equipo';
                return (
                  <li key={d.id}>
                    <span className="aa-act-av" aria-hidden>{piloto ? <Criatura nombre="MaKo" size={18} estrella /> : iniciales(quien).toUpperCase()}</span>
                    <span className="aa-act-txt"><b>{queSeHizo(d)}</b><small>{quien} · {hace(d.aplicadaAt)}{d.estado === 'deshecha' ? ' · deshecho' : ''}</small></span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
      <aside className="aa-rail">
        {metas && <PanelCuenta metas={metas} kpi={config.kpi} objetivo={config.objetivo} productos={productos} />}
        <section className="aa-panel" aria-label="Agentes">
          <div className="aa-panel-cab"><h2>Agentes</h2><button type="button" className="aa-link" onClick={onAgentes}>Ajustar</button></div>
          <ul className="aa-ag-mini">
            {AGENTES.map(([a, t]) => {
              const e = config.encendido ? estadoDeAgente(a, tacticas) : 'pausado';
              return <li key={a}><EtiquetaAgente d={{ tactica: t }} /><span className="aa-ag-estado" data-e={e}>{e === 'pausado' ? 'Pausado' : e === 'automatico' ? 'Automático' : 'Activo'}</span></li>;
            })}
            {propios.length > 0 && <li><span className="aa-agente">Propios</span><span className="aa-ag-estado" data-e="propone">{propios.filter((p) => p.estado === 'activo').length} de {propios.length}</span></li>}
          </ul>
        </section>
      </aside>
    </div>
  );
}
