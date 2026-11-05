'use client';

// =============================================================================
// ActividadAdmin — Admin › Activity: quién entra, qué usa, qué no, y qué hace MaKo (5/11/2026)
// =============================================================================
// Martín: «qué acciones hacen los usuarios dentro de MaKo, cuándo es que se conectan, qué no están utilizando, qué se están
// utilizando». Copiado de PostHog (docs/investigacion-admin.md, «Activity y Usage»): arriba los activos del día, la semana y
// el mes; el ciclo de vida por semana (los nuevos, los que siguen y los que volvieron arriba del eje; los que dejaron de
// entrar, abajo); el uso por tab con las que nadie abrió; el uso por negocio; quién dejó de venir, y lo último que hizo MaKo.
// Las cuentas, en lib/actividad-reglas.ts; la medición, en app/_components/MedidorDeUso.tsx (mig 0398).
//
// ⚠️ SIN LA MEDICIÓN (la migración sin aplicar, o recién aplicada) se dice, y lo que sale de `ultimo_login` (quién dejó de
//    venir) se muestra igual: tiene la historia entera.
// ⚠️ LOS COLORES DEL CICLO DE VIDA SE VALIDARON con el validador de la guía de gráficos, en ese orden y en los dos temas
//    (azul, verde, violeta, rojo: todos los chequeos en verde). Cambiar uno o el orden es volver a correrlo.
// ⚠️ NINGÚN BACKTICK EN EL CSS DE ABAJO.

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { Banner, EmptyState } from '@/app/_ui';
import type { VistaActividad } from '@/lib/actividad';
import {
  activos, canalTxt, cicloDeVida, dejaronDeEntrar, nombreDeTab, semanaTxt, tabsSinUso, usoPorNegocio, usoPorTab, ventanaDeUso,
  type SemanaCiclo,
} from '@/lib/actividad-reglas';
import { haceTxtCorto } from '@/lib/admin-errores-reglas';

/** El orden y los colores del ciclo de vida (validados juntos: ver la cabecera). */
const SERIES = [
  { id: 'siguen', rotulo: 'Siguen', color: '#3B6FB0' },
  { id: 'nuevos', rotulo: 'Nuevos', color: '#1E9E57' },
  { id: 'volvieron', rotulo: 'Volvieron', color: '#6A4BD8' },
  { id: 'dejaron', rotulo: 'Dejaron de entrar', color: '#D0504A' },
] as const;

const num = (n: number) => n.toLocaleString('es-AR');

export function ActividadAdmin({ vista, ahoraMs, agentes }: { vista: VistaActividad; ahoraMs: number; agentes?: ReactNode }) {
  const { hoy } = vista;
  const a = useMemo(() => activos(vista.filas, hoy), [vista.filas, hoy]);
  const ciclo = useMemo(() => cicloDeVida(vista.filas, vista.personas, hoy), [vista.filas, vista.personas, hoy]);
  const dias = ventanaDeUso(vista.desde, hoy);
  const tabs = useMemo(() => usoPorTab(vista.filas, hoy, Math.max(1, dias)), [vista.filas, hoy, dias]);
  const sinUso = useMemo(() => tabsSinUso(tabs), [tabs]);
  const negocios = useMemo(() => usoPorNegocio(vista.filas, hoy), [vista.filas, hoy]);
  const dejaron = useMemo(() => dejaronDeEntrar(vista.personas, ahoraMs), [vista.personas, ahoraMs]);
  const nombreNegocio = (ws: number | null) => (ws == null ? 'Sin negocio' : vista.nombres[ws] ?? `Workspace ${ws}`);
  const hayUso = vista.filas.length > 0;
  const maxTab = Math.max(1, ...tabs.map((t) => t.personas));

  return (
    <div className="act">
      <style>{CSS}</style>
      {vista.avisos.length > 0 && <Banner tono="warn">No pude leer {vista.avisos.join(' · ')}: lo que ves puede quedarse corto.</Banner>}
      {!vista.medido && (
        <Banner tono="info">Todavía no se mide el uso: falta aplicar la migración 0398. Quién dejó de venir sale de su último ingreso y ya se ve abajo.</Banner>
      )}

      {vista.medido && !hayUso ? (
        <EmptyState titulo="Todavía no hay uso medido" detalle="La medición arranca cuando alguien de un negocio abre la app. Vuelve en un rato." />
      ) : hayUso && (
        <>
          <div className="act-kpis">
            <Kpi rotulo="Activos hoy" valor={num(a.hoy)} />
            <Kpi rotulo="En 7 días" valor={num(a.semana)} />
            <Kpi rotulo="En 30 días" valor={num(a.mes)} pie={vista.desde ? `se mide desde el ${semanaTxt(vista.desde)}` : undefined} />
            <Kpi rotulo="Vuelven cada semana" valor={a.mes > 0 ? `${Math.round((a.semana / a.mes) * 100)}%` : '—'} pie="activos en 7 días ÷ en 30" />
          </div>

          <section aria-label="Ciclo de vida">
            <h2 className="act-h2">Quién entra cada semana</h2>
            <Ciclo semanas={ciclo} />
          </section>

          <section aria-label="Uso por tab">
            <h2 className="act-h2">Qué tabs se usan <span>{dias} {dias === 1 ? 'día' : 'días'}</span></h2>
            <div className="act-tabla" role="table" aria-label="Uso por tab">
              <div className="act-fila act-fila--tab act-cab" role="row">
                <span role="columnheader">Tab</span><span role="columnheader">Personas</span>
                <span role="columnheader" className="act-num">Negocios</span><span role="columnheader" className="act-num">Pantallas</span>
                <span role="columnheader" className="act-num">Acciones</span>
              </div>
              {tabs.map((t) => (
                <div key={t.tab} className="act-fila act-fila--tab" role="row">
                  <span className="act-fuerte">{t.nombre}</span>
                  <span className="act-riel" title={`${t.personas} ${t.personas === 1 ? 'persona' : 'personas'}`}>
                    <i style={{ width: `${Math.max(3, Math.round((t.personas / maxTab) * 100))}%` }} /><em>{num(t.personas)}</em>
                  </span>
                  <span className="act-num">{num(t.negocios)}</span>
                  <span className="act-num">{num(t.pantallas)}</span>
                  <span className="act-num">{num(t.acciones)}</span>
                </div>
              ))}
            </div>
            {sinUso.length > 0 && (
              <div className="act-sin">
                <b>Nadie las abrió en {dias === 1 ? 'el día' : `${dias} días`}:</b>
                <span>{sinUso.map((t) => <span key={t.key} className="act-chip">{t.label}</span>)}</span>
              </div>
            )}
          </section>

          <section aria-label="Uso por negocio">
            <h2 className="act-h2">Cada negocio <span>{negocios.length}</span></h2>
            <div className="act-tabla" role="table" aria-label="Uso por negocio">
              <div className="act-fila act-fila--neg act-cab" role="row">
                <span role="columnheader">Negocio</span><span role="columnheader" className="act-num">En 7 días</span>
                <span role="columnheader" className="act-num">En 30 días</span><span role="columnheader" className="act-num">Pantallas</span>
                <span role="columnheader">Lo más usado</span>
              </div>
              {negocios.map((n) => (
                <Link key={n.ws} href={`/admin?tab=customers&cliente=${n.ws}`} className="act-fila act-fila--neg act-fila--link" role="row">
                  <span className="act-fuerte">{nombreNegocio(n.ws)}</span>
                  <span className="act-num">{num(n.personas7)}</span>
                  <span className="act-num">{num(n.personas30)}</span>
                  <span className="act-num">{num(n.pantallas30)}</span>
                  <span className="act-gris">{n.tabs.map(nombreDeTab).join(' · ') || '—'}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      <section aria-label="Dejaron de entrar">
        <h2 className="act-h2">Dejaron de entrar <span>{dejaron.length}</span></h2>
        {dejaron.length === 0 ? <p className="act-gris">Nadie de los negocios dejó de entrar en las últimas semanas.</p> : (
          <div className="act-tabla" role="table" aria-label="Dejaron de entrar">
            {dejaron.map((p) => (
              <div key={p.id} className="act-fila act-fila--deja" role="row">
                <span className="act-que"><b>{p.nombre || p.email}</b><small>{p.email}</small></span>
                <span className="act-gris">{p.negocio ?? 'Sin negocio'}</span>
                <span className="act-gris">Entró por última vez {haceTxtCorto(p.ultimoLogin!, ahoraMs)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {vista.medido && (
        <section aria-label="Lo que hizo MaKo">
          <h2 className="act-h2">Lo último que hizo MaKo <span>{vista.acciones.length}</span></h2>
          {vista.acciones.length === 0 ? <p className="act-gris">MaKo todavía no hizo nada en un negocio desde que se mide.</p> : (
            <div className="act-tabla" role="table" aria-label="Lo que hizo MaKo">
              {vista.acciones.map((x, i) => (
                <div key={`${x.creado}-${i}`} className="act-fila act-fila--mako" role="row">
                  <span className="act-que"><b>{x.titulo}</b><small>{nombreNegocio(x.ws)} · {canalTxt(x.canal)}</small></span>
                  <span className="act-estado" data-ok={x.ok}>{x.ok ? 'Salió' : 'No salió'}</span>
                  <span className="act-gris">{haceTxtCorto(x.creado, ahoraMs)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {agentes}
    </div>
  );
}

function Kpi({ rotulo, valor, pie }: { rotulo: string; valor: string; pie?: string }) {
  return (
    <div className="act-kpi">
      <span>{rotulo}</span>
      <b>{valor}</b>
      {pie && <small>{pie}</small>}
    </div>
  );
}

/** El ciclo de vida de PostHog: arriba del eje los que entraron (siguen, nuevos, volvieron), abajo los que dejaron. */
function Ciclo({ semanas }: { semanas: readonly SemanaCiclo[] }) {
  const arriba = Math.max(1, ...semanas.map((s) => s.siguen + s.nuevos + s.volvieron));
  const abajo = Math.max(1, ...semanas.map((s) => s.dejaron));
  const total = arriba + abajo;
  const alto = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="act-ciclo">
      <div className="act-leyenda" aria-hidden>
        {SERIES.map((s) => <span key={s.id}><i style={{ background: s.color }} />{s.rotulo}</span>)}
      </div>
      <div className="act-ciclo-plot" role="img"
        aria-label={semanas.map((s) => `Semana del ${semanaTxt(s.semana)}: ${s.siguen} siguen, ${s.nuevos} nuevos, ${s.volvieron} volvieron, ${s.dejaron} dejaron`).join('. ')}>
        {semanas.map((s) => (
          <div key={s.semana} className="act-col" data-curso={s.enCurso}
            title={`Semana del ${semanaTxt(s.semana)}${s.enCurso ? ' (en curso)' : ''}: ${s.siguen} siguen · ${s.nuevos} nuevos · ${s.volvieron} volvieron · ${s.dejaron} dejaron de entrar`}>
            <div className="act-col-arriba" style={{ height: alto(arriba) }}>
              {(['volvieron', 'nuevos', 'siguen'] as const).map((k) => s[k] > 0 && (
                <i key={k} style={{ height: `${(s[k] / arriba) * 100}%`, background: SERIES.find((x) => x.id === k)!.color }} />
              ))}
            </div>
            <div className="act-col-abajo" style={{ height: alto(abajo) }}>
              {s.dejaron > 0 && <i style={{ height: `${(s.dejaron / abajo) * 100}%`, background: SERIES[3].color }} />}
            </div>
            <span>{semanaTxt(s.semana)}{s.enCurso ? '*' : ''}</span>
          </div>
        ))}
      </div>
      <div className="act-ciclo-tabla" role="table" aria-label="Quién entra cada semana, en números">
        {SERIES.map((serie) => (
          <div key={serie.id} role="row" className="act-ciclo-fila" style={{ gridTemplateColumns: `minmax(120px, 1.2fr) repeat(${semanas.length}, minmax(0, 1fr))` }}>
            <span role="rowheader">{serie.rotulo}</span>
            {semanas.map((s) => <span key={s.semana}>{s[serie.id] || '—'}</span>)}
          </div>
        ))}
      </div>
      {semanas.some((s) => s.enCurso) && <p className="act-gris">* La semana en curso todavía no cerró.</p>}
    </div>
  );
}

const CSS = `
.act{ display:flex; flex-direction:column; gap:20px; }
.act section{ display:flex; flex-direction:column; gap:12px; }
.act-h2{ margin:0; font-size:14px; font-weight:650; color:var(--dim); display:flex; align-items:center; gap:8px; }
.act-h2 span{ font-size:12px; font-weight:700; color:var(--ink); background:var(--surface-2); padding:1px 8px; border-radius:999px; }
.act-kpis{ display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:12px; }
.act-kpi{ background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:14px 18px; display:flex; flex-direction:column; gap:4px; min-width:0; }
.act-kpi span{ font-size:12.5px; color:var(--dim); }
.act-kpi b{ font-size:26px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
.act-kpi small{ font-size:12px; color:var(--faint); }
.act-ciclo{ background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:16px 18px; display:flex; flex-direction:column; gap:12px; }
.act-leyenda{ display:flex; flex-wrap:wrap; gap:14px; font-size:12.5px; color:var(--dim); }
.act-leyenda span{ display:inline-flex; align-items:center; gap:6px; }
.act-leyenda i{ width:10px; height:10px; border-radius:3px; display:inline-block; }
.act-ciclo-plot{ display:flex; gap:10px; height:190px; padding-bottom:18px; }
.act-col{ flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; position:relative; }
.act-col-arriba{ width:100%; max-width:40px; display:flex; flex-direction:column; justify-content:flex-end; gap:2px; border-bottom:1px solid var(--border-strong, var(--border)); }
.act-col-abajo{ width:100%; max-width:40px; display:flex; flex-direction:column; justify-content:flex-start; padding-top:2px; }
.act-col-arriba i{ display:block; width:100%; min-height:3px; }
.act-col-arriba i:first-child{ border-radius:4px 4px 0 0; }
.act-col-abajo i{ display:block; width:100%; min-height:3px; border-radius:0 0 4px 4px; }
.act-col[data-curso="true"] i{ opacity:.6; }
.act-col > span{ position:absolute; bottom:-18px; font-size:11.5px; color:var(--faint); white-space:nowrap; }
.act-ciclo-tabla{ display:flex; flex-direction:column; border-top:1px solid var(--border); padding-top:6px; }
.act-ciclo-fila{ display:grid; gap:6px; padding:3px 0; font-size:12.5px; font-variant-numeric:tabular-nums; }
.act-ciclo-fila > span{ text-align:right; color:var(--ink); min-width:0; }
.act-ciclo-fila > span:first-child{ text-align:left; color:var(--dim); }
.act-tabla{ background:var(--surface); border:1px solid var(--border); border-radius:16px; overflow:hidden; }
.act-fila{ display:grid; gap:14px; align-items:center; padding:11px 18px; border-bottom:1px solid var(--border); font-size:14px; color:inherit; text-decoration:none; }
.act-fila > span{ min-width:0; }
.act-tabla > :last-child{ border-bottom:0; }
.act-fila--tab{ grid-template-columns:minmax(0, 1.2fr) minmax(0, 1.6fr) 80px 90px 90px; }
.act-fila--neg{ grid-template-columns:minmax(0, 1.4fr) 80px 90px 90px minmax(0, 1.6fr); }
.act-fila--deja{ grid-template-columns:minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr); }
.act-fila--mako{ grid-template-columns:minmax(0, 1fr) 90px 120px; }
.act-fila--link:hover{ background:var(--surface-2); }
.act-cab{ background:var(--surface-2); font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); font-weight:700; padding-block:9px; }
.act-fuerte{ font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.act-num{ text-align:right; font-variant-numeric:tabular-nums; }
.act-gris{ margin:0; color:var(--dim); font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.act-riel{ display:flex; align-items:center; gap:8px; }
.act-riel i{ display:block; height:8px; border-radius:0 4px 4px 0; background:#3B6FB0; flex:none; }
.act-riel em{ font-style:normal; font-size:13px; font-variant-numeric:tabular-nums; color:var(--ink); }
.act-sin{ display:flex; flex-direction:column; gap:8px; font-size:13px; color:var(--dim); }
.act-sin b{ font-weight:650; color:var(--ink); }
.act-sin > span{ display:flex; flex-wrap:wrap; gap:6px; }
.act-chip{ border:1px solid var(--border); background:var(--surface); border-radius:999px; padding:4px 10px; font-size:12.5px; color:var(--dim); }
.act-que{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.act-que b{ font-size:14px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.act-que small{ font-size:12.5px; color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.act-estado{ justify-self:start; font-size:11px; font-weight:700; padding:3px 8px; border-radius:6px; background:var(--good-bg); color:var(--good); }
.act-estado[data-ok="false"]{ background:var(--bad-bg); color:var(--bad); }
@media (max-width: 760px){
  .act-cab{ display:none; }
  .act-fila--tab, .act-fila--neg{ grid-template-columns:1fr auto; }
  .act-fila--tab > span:nth-child(n+3), .act-fila--neg > span:nth-child(n+3){ display:none; }
  .act-fila--deja, .act-fila--mako{ grid-template-columns:1fr auto; }
  .act-fila--deja > span:nth-child(2){ display:none; }
}
`;
