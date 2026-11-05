'use client';

// =============================================================================
// ErroresAdmin — Admin › Errors: cuándo se cae la app y lo que reportan las personas (5/11/2026)
// =============================================================================
// Martín: «cuándo la app se crashea o los bugs que tienen, el reporte». Copiado de la lista de problemas de Sentry (las
// pestañas Sin resolver · Nuevos · Volvieron · Resueltos, el orden por «visto por última vez») y de la fila de GlitchTip
// (MIT): el título, y en una segunda línea dónde pasó, «hace N días · visto hace X»; las veces y a cuántos negocios les pasó.
// Abrir uno despliega el detalle en el orden de Sentry: el mensaje, el primero y el último, la pantalla, los negocios y el
// stack. Debajo, los reportes de las personas (tickets), como el perfil de cliente de PostHog los pone junto a sus errores.
// Las reglas, en lib/admin-errores-reglas.ts.
//
// ⚠️ NO HAY MINI-GRÁFICO DE TENDENCIA: `errores_app` guarda sólo el total y la primera y la última vez, no cuántas veces por
//    día. Dibujar una curva sería inventarla.
// ⚠️ NINGÚN BACKTICK EN EL CSS DE ABAJO.

import { Fragment, useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Banner, EmptyState } from '@/app/_ui';
import type { VistaErrores } from '@/lib/admin-errores';
import {
  ESTADO_TICKET_TXT, ROTULO_ESTADO_ERROR, ROTULO_VISTA_ERROR, VISTAS_ERROR, conteosDeErrores, erroresVisibles, estadoDeError,
  haceTxtCorto, origenTxt, type VistaError,
} from '@/lib/admin-errores-reglas';

const TIPO_TICKET: Record<string, string> = { bug: 'Bug', pedido: 'Pedido', pregunta: 'Pregunta' };

export function ErroresAdmin({ vista, ahoraMs }: { vista: VistaErrores; ahoraMs: number }) {
  const [v, setV] = useState<VistaError>('abiertos');
  const [abierto, setAbierto] = useState<number | null>(null);
  const conteos = useMemo(() => conteosDeErrores(vista.errores, ahoraMs), [vista.errores, ahoraMs]);
  const visibles = useMemo(() => erroresVisibles(vista.errores, v, ahoraMs), [vista.errores, v, ahoraMs]);
  const negocio = (ws: number) => vista.nombres[ws] ?? `Workspace ${ws}`;

  return (
    <div className="err">
      <style>{CSS}</style>
      {vista.avisos.length > 0 && <Banner tono="warn">No pude leer {vista.avisos.join(' · ')}: lo que ves puede quedarse corto.</Banner>}

      <section aria-label="Errores de la app">
        <div className="err-chips" role="tablist" aria-label="Qué errores ver">
          {VISTAS_ERROR.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={v === id} data-on={v === id} className="err-chip" onClick={() => setV(id)}>
              {ROTULO_VISTA_ERROR[id]} <span>{conteos[id]}</span>
            </button>
          ))}
        </div>
        {vista.errores.length === 0 ? (
          <EmptyState titulo="La app no registró ningún error" detalle="Cuando una pantalla se caiga o una acción falle, aparece aquí con cuántas veces pasó y a quién." />
        ) : (
          <div className="err-tabla" role="table" aria-label="Errores">
            <div className="err-fila err-cab" role="row">
              <span role="columnheader">Error</span><span role="columnheader" className="err-num">Veces</span>
              <span role="columnheader" className="err-num">Negocios</span><span role="columnheader">Ticket</span>
            </div>
            {visibles.length === 0 && <p className="err-vacio">Nada en esta pestaña.</p>}
            {visibles.map((e) => {
              const est = ROTULO_ESTADO_ERROR[estadoDeError(e, ahoraMs)];
              const abre = abierto === e.id;
              return (
                <Fragment key={e.id}>
                  <button type="button" className="err-fila err-fila--btn" role="row" aria-expanded={abre} onClick={() => setAbierto(abre ? null : e.id)}>
                    <span className="err-que">
                      <span className="err-titulo"><span className="err-estado" data-tono={est.tono}>{est.rotulo}</span><b>{e.titulo}</b></span>
                      <small>{origenTxt(e.origen)}{e.ruta ? ` · ${e.ruta}` : ''} · empezó {haceTxtCorto(e.primeraVez, ahoraMs)} · visto {haceTxtCorto(e.ultimaVez, ahoraMs)}</small>
                    </span>
                    <span className="err-num">{e.veces.toLocaleString('es-AR')}</span>
                    <span className="err-num">{e.negocios.length || '—'}</span>
                    <span className="err-gris">{e.ticketId ? `#${e.ticketId} · ${ESTADO_TICKET_TXT[e.ticketEstado ?? ''] ?? '—'}` : '—'}</span>
                  </button>
                  {abre && (
                    <div className="err-detalle" role="row">
                      {e.mensaje && <p className="err-msj">{e.mensaje}</p>}
                      <dl>
                        <div><dt>La primera vez</dt><dd>{new Date(e.primeraVez).toLocaleString('es-AR')}</dd></div>
                        <div><dt>La última</dt><dd>{new Date(e.ultimaVez).toLocaleString('es-AR')}</dd></div>
                        {e.ruta && <div><dt>Pantalla</dt><dd>{e.ruta}</dd></div>}
                        {e.navegador && <div><dt>Navegador</dt><dd>{e.navegador}</dd></div>}
                        <div><dt>A quiénes</dt><dd>{e.negocios.length ? e.negocios.map(negocio).join(', ') : 'Sin negocio'}{e.personas ? ` · ${e.personas} ${e.personas === 1 ? 'persona' : 'personas'}` : ''}</dd></div>
                      </dl>
                      {e.stack && <pre className="err-stack">{e.stack}</pre>}
                      {e.ticketId && <Link className="err-link" href={`/tickets?t=${e.ticketId}`}>Abrir el ticket #{e.ticketId} →</Link>}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
        {vista.hayMas && <p className="err-gris">Se muestran los 500 vistos más recientes.</p>}
      </section>

      <section aria-label="Reportes">
        <h2 className="err-h2">Reportes de las personas <span>{vista.reportes.length}</span></h2>
        {vista.reportes.length === 0 ? <p className="err-gris">Nadie reportó nada todavía.</p> : (
          <div className="err-tabla" role="table" aria-label="Reportes">
            {vista.reportes.map((t) => (
              <Link key={t.id} href={`/tickets?t=${t.id}`} className="err-fila err-fila--rep" role="row">
                <span className="err-gris">#{t.id}</span>
                <span className="err-que"><b className="err-corta">{t.titulo}</b><small>{t.quien}{t.negocio ? ` · ${t.negocio}` : ''} · {haceTxtCorto(t.creado, ahoraMs)}</small></span>
                <span className="err-gris">{TIPO_TICKET[t.tipo] ?? t.tipo}</span>
                <span className="err-gris">{ESTADO_TICKET_TXT[t.estado] ?? t.estado}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const CSS = `
.err{ display:flex; flex-direction:column; gap:20px; }
.err section{ display:flex; flex-direction:column; gap:12px; }
.err-h2{ margin:0; font-size:14px; font-weight:650; color:var(--dim); display:flex; align-items:center; gap:8px; }
.err-h2 span{ font-size:12px; font-weight:700; color:var(--ink); background:var(--surface-2); padding:1px 8px; border-radius:999px; }
.err-chips{ display:flex; gap:8px; flex-wrap:wrap; }
.err-chip{ border:1px solid var(--border); background:var(--surface); border-radius:999px; padding:7px 14px; font:inherit; font-size:13.5px; font-weight:600; color:var(--dim); cursor:pointer; }
.err-chip span{ font-weight:700; color:var(--faint); margin-left:2px; }
.err-chip[data-on="true"]{ background:var(--ink); border-color:var(--ink); color:var(--surface); }
.err-chip[data-on="true"] span{ color:var(--surface); opacity:.75; }
.err-tabla{ background:var(--surface); border:1px solid var(--border); border-radius:16px; overflow:hidden; }
.err-fila{ width:100%; box-sizing:border-box; display:grid; grid-template-columns:minmax(0, 1fr) 80px 90px 190px; gap:14px; align-items:center; padding:11px 18px;
  border:0; border-bottom:1px solid var(--border); background:none; font:inherit; color:inherit; text-align:left; text-decoration:none; font-size:14px; }
.err-fila > span{ min-width:0; }
.err-fila--btn, .err-fila--rep{ cursor:pointer; }
.err-fila--btn:hover, .err-fila--rep:hover, .err-fila--btn[aria-expanded="true"]{ background:var(--surface-2); }
.err-fila--rep{ grid-template-columns:56px minmax(0, 1fr) 90px 170px; }
.err-tabla > :last-child{ border-bottom:0; }
.err-cab{ background:var(--surface-2); font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--faint); font-weight:700; padding-block:9px; }
.err-que{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.err-titulo{ display:flex; align-items:center; gap:8px; min-width:0; }
.err-titulo b, .err-corta{ font-size:14px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.err-que small{ font-size:12.5px; color:var(--faint); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.err-estado{ flex:none; font-size:10.5px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; padding:3px 8px; border-radius:6px; }
.err-estado[data-tono="bad"]{ background:var(--bad-bg); color:var(--bad); }
.err-estado[data-tono="warn"]{ background:var(--warn-bg); color:var(--warn); }
.err-estado[data-tono="good"]{ background:var(--good-bg); color:var(--good); }
.err-estado[data-tono="neutral"]{ background:var(--surface-2); color:var(--dim); }
.err-num{ text-align:right; font-variant-numeric:tabular-nums; }
.err-gris{ margin:0; color:var(--dim); font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.err-vacio{ margin:0; padding:18px; color:var(--faint); font-size:13.5px; }
.err-detalle{ padding:14px 18px 18px; border-bottom:1px solid var(--border); background:var(--surface-2); display:flex; flex-direction:column; gap:12px; }
.err-msj{ margin:0; font-size:14px; font-weight:600; color:var(--ink); word-break:break-word; }
.err-detalle dl{ margin:0; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px 18px; }
.err-detalle dt{ font-size:12px; color:var(--dim); }
.err-detalle dd{ margin:2px 0 0; font-size:13.5px; color:var(--ink); word-break:break-word; }
.err-stack{ margin:0; max-height:280px; overflow:auto; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px; font-size:12px; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
.err-link{ align-self:flex-start; font-size:13.5px; font-weight:650; color:var(--primary); text-decoration:none; }
.err-link:hover{ text-decoration:underline; }
@media (max-width: 760px){
  .err-cab{ display:none; }
  .err-fila, .err-fila--rep{ grid-template-columns:1fr auto; }
  .err-fila > span:nth-child(3), .err-fila > span:nth-child(4){ display:none; }
}
`;
