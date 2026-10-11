'use client';

// =============================================================================
// DialogoAnalitica — «Análisis» de la landing publicada (el modal de Gamma)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Diseño:
// docs/diseno-editor-landing.md (D8: visitas, visitantes y leads de 30 días de las URLs
// publicadas, el alcance por sección si el Pixel lo midió y el link al Landing Analyst).
// Gamma (relevo gamma-ui §5.12.4): el modal «Análisis» con el gráfico de barras celeste de los
// últimos 30 días y la interacción por sección («% visualizada»). Lo que se mide acá es lo que
// mide el Pixel de MaKo en la página publicada (`analitica` de lib/editor-landing/server.ts), no
// las personas que abrieron el documento, que es lo que mide Gamma.
//
// ⚠️ EL ALCANCE NO MEDIDO ES «No medido», NUNCA 0. `alcancePorSeccion: null` (o el `pct: null` de
//    una sección) dice que el Pixel no lo midió; un 0 % afirmaría que nadie llegó, que es otra
//    cosa y es falsa. Todo lo que dibuja un alcance pasa por `textoDeAlcance` y el ancho de su
//    barra por `anchoDeAlcance`: lo fija tests/editor-landing-agente.test.ts.
// ⚠️ Sin publicar, los ceros del server son ciertos (no hubo página que visitar), pero dibujarlos
//    como un tablero en cero se lee como «no vino nadie». Se dice qué falta y se ofrece Publicar.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/app/_ui/Link';
import { Modal } from '@/app/_ui/Modal';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import { useEditorLanding } from '../contexto';
import type { Analitica } from '@/lib/editor-landing/api-tipos';
import { tarjetasDe, tituloDeTarjeta } from '@/lib/editor-landing/doc';
import { EstilosPanelesB, Ico, pedirDocs, useAncho } from '../paneles/PanelAgente';
import { idDe, recortar } from '../diff-tarjetas';

export const NO_MEDIDO = 'No medido';

/** El texto del alcance de una sección: el % redondeado, o «No medido». Nunca «0 %» por un null. */
export function textoDeAlcance(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return NO_MEDIDO;
  return `${Math.round(Math.max(0, Math.min(100, pct)))} %`;
}

/** El ancho de la barra de alcance (0..100), o null si no se mide: sin barra, no una barra vacía. */
export function anchoDeAlcance(pct: number | null | undefined): number | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return Math.max(0, Math.min(100, pct));
}

const numero = (n: number) => n.toLocaleString('es');
const diaCorto = (dia: string) => {
  const t = Date.parse(`${dia}T12:00:00`);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : dia;
};

export function DialogoAnalitica({ onCerrar }: { onCerrar?: () => void } = {}) {
  const ctx = useEditorLanding();
  const { docId, paginas, paginaActual, editor, setDialogo } = ctx;
  const cerrar = useCerrarEstable(onCerrar ?? (() => setDialogo(null)));
  const [a, setA] = useState<Analitica | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await pedirDocs({ accion: 'analitica', id: docId });
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setA(r.analitica);
  }, [docId]);
  useEffect(() => { void cargar(); }, [cargar]);

  // Los títulos de las secciones: la página abierta del documento vivo, el resto de lo guardado.
  const secciones = useMemo(() => {
    const m = new Map<string, { titulo: string; orden: number }>();
    let orden = 0;
    for (const p of paginas) {
      if (p.id === paginaActual && editor && !editor.isDestroyed) {
        editor.state.doc.forEach((n) => {
          const id = typeof n.attrs?.id === 'string' ? n.attrs.id : '';
          if (!id) return;
          let h = '';
          n.forEach((b) => { if (!h && b.type.name === 'heading') h = b.textContent; });
          m.set(id, { titulo: recortar((h || n.textContent).trim(), 60) || 'Sin título', orden: orden++ });
        });
      } else {
        for (const t of tarjetasDe(p)) m.set(idDe(t), { titulo: recortar(tituloDeTarjeta(t), 60) || 'Sin título', orden: orden++ });
      }
    }
    return m;
  }, [paginas, paginaActual, editor]);

  const alcance = useMemo(() => {
    if (!a?.alcancePorSeccion) return null;
    return [...a.alcancePorSeccion].sort((x, y) => (secciones.get(x.tarjetaId)?.orden ?? 1e9) - (secciones.get(y.tarjetaId)?.orden ?? 1e9));
  }, [a, secciones]);

  return (
    <Modal titulo="Análisis" encabezado={<span className="gma-an-sub">Últimos 30 días</span>} onCerrar={cerrar} ancho={720}>
      <EstilosPanelesB />
      <style href="gma-analitica" precedence="medium">{CSS_ANALITICA}</style>
      <div className="gma gma-pb gma-an">
        {error && (
          <div className="gma-an-vacio" role="alert">
            <span>{error}</span>
            <button type="button" className="gma-pb-boton" data-v="contorno" data-t="s" onClick={() => { setError(null); void cargar(); }}>Reintentar</button>
          </div>
        )}
        {!error && !a && <div className="gma-an-vacio"><span className="gma-pb-giro" aria-label="Cargando" /></div>}

        {a && !a.publicada && (
          <div className="gma-an-vacio">
            <span>Publica la landing para medir sus visitas.</span>
            <button type="button" className="gma-pb-boton" data-v="primario" onClick={() => setDialogo('publicar')}><Ico n="subir" t={14} /> Publicar</button>
          </div>
        )}

        {a && a.publicada && (
          <>
            <div className="gma-an-kpis">
              <div className="gma-an-kpi"><span>Visitas</span><b>{numero(a.visitas30)}</b></div>
              <div className="gma-an-kpi"><span>Visitantes únicos</span><b>{numero(a.visitantes30)}</b></div>
              <div className="gma-an-kpi"><span>Leads</span><b>{numero(a.leads30)}</b></div>
            </div>

            <section className="gma-an-bloque">
              <h3 className="gma-an-h">Visitas por día</h3>
              <BarrasPorDia porDia={a.porDia} />
            </section>

            <section className="gma-an-bloque">
              <h3 className="gma-an-h">Alcance por sección</h3>
              {alcance === null || alcance.length === 0
                ? <p className="gma-an-nota">{NO_MEDIDO} todavía</p>
                : (
                  <ul className="gma-an-alcance">
                    {alcance.map((s) => {
                      const ancho = anchoDeAlcance(s.pct);
                      return (
                        <li key={s.tarjetaId} className="gma-an-fila">
                          <span className="gma-an-sec" title={secciones.get(s.tarjetaId)?.titulo}>{secciones.get(s.tarjetaId)?.titulo ?? 'Sección eliminada'}</span>
                          <span className="gma-an-carril" aria-hidden>{ancho !== null && <span className="gma-an-barra" style={{ width: `${ancho}%` }} />}</span>
                          <span className="gma-an-pct" data-sin={ancho === null ? '' : undefined}>{textoDeAlcance(s.pct)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
            </section>

            <div className="gma-an-pie">
              <Link href="/landing-analyst" className="gma-pb-boton" data-v="contorno"><Ico n="grafico" t={14} /> Abrir el Landing Analyst</Link>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default DialogoAnalitica;

/**
 * Una serie, una barra por día: un solo tono (#2c88f7, validado contra el fondo claro y el oscuro
 * con el validador de la skill de dataviz: contraste >= 3:1 en los dos), puntas redondeadas de
 * 4 px apoyadas en la base, 2 px de aire entre barras, y el número al pasar el mouse. Debajo, la
 * vista de tabla para quien no lee el gráfico.
 */
function BarrasPorDia({ porDia }: { porDia: { dia: string; visitas: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const ancho = useAncho(ref);
  const [sobre, setSobre] = useState<number | null>(null);
  const [tabla, setTabla] = useState(false);
  const ALTO = 150;
  const n = porDia.length;
  const max = Math.max(1, ...porDia.map((d) => d.visitas));
  const GAP = 2;
  const barra = n ? Math.max(1, (ancho - GAP * (n - 1)) / n) : 0;
  const total = porDia.reduce((s, d) => s + d.visitas, 0);

  return (
    <div className="gma-an-grafico">
      <div ref={ref} className="gma-an-lienzo" onMouseLeave={() => setSobre(null)}>
        {ancho > 0 && n > 0 && (
          <svg width={ancho} height={ALTO + 1} role="img" aria-label={`Visitas por día: ${numero(total)} en ${n} días`}>
            <line x1={0} x2={ancho} y1={ALTO + 0.5} y2={ALTO + 0.5} className="gma-an-base" />
            {porDia.map((d, i) => {
              const x = i * (barra + GAP);
              const h = d.visitas ? Math.max(2, (d.visitas / max) * (ALTO - 18)) : 0;
              const r = Math.min(4, barra / 2, h);
              const y = ALTO - h;
              return (
                <g key={d.dia} onMouseEnter={() => setSobre(i)}>
                  <rect x={x} y={0} width={barra + GAP} height={ALTO} fill="transparent" />
                  {h > 0 && (
                    <path
                      className="gma-an-col"
                      data-sobre={sobre === i ? '' : undefined}
                      d={`M${x},${ALTO} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barra - r},${y} Q${x + barra},${y} ${x + barra},${y + r} L${x + barra},${ALTO} Z`}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {sobre !== null && porDia[sobre] && (
          <div className="gma-an-tip" style={{ left: Math.min(Math.max(0, sobre * (barra + GAP) + barra / 2), ancho), bottom: ALTO + 8 }}>
            <b>{numero(porDia[sobre].visitas)}</b> {porDia[sobre].visitas === 1 ? 'visita' : 'visitas'} · {diaCorto(porDia[sobre].dia)}
          </div>
        )}
      </div>
      {n > 0 && (
        <div className="gma-an-ejes">
          <span>{diaCorto(porDia[0].dia)}</span>
          {n > 2 && <span>{diaCorto(porDia[Math.floor(n / 2)].dia)}</span>}
          <span>{diaCorto(porDia[n - 1].dia)}</span>
        </div>
      )}
      <button type="button" className="gma-an-vertabla" onClick={() => setTabla((v) => !v)} aria-expanded={tabla}>{tabla ? 'Ocultar tabla' : 'Ver tabla'}</button>
      {tabla && (
        <table className="gma-an-tabla">
          <thead><tr><th>Día</th><th>Visitas</th></tr></thead>
          <tbody>{porDia.map((d) => <tr key={d.dia}><td>{diaCorto(d.dia)}</td><td>{numero(d.visitas)}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

const CSS_ANALITICA = `
.gma-an{--pb-barra:#2c88f7;display:grid;gap:22px}
.gma-an-sub{font-size:12px;color:#8b8b90}
.gma-an-vacio{display:grid;justify-items:center;gap:12px;padding:36px 8px;color:var(--pb-tenue);font-size:14px;text-align:center}
.gma-an-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.gma-an-kpi{display:grid;gap:2px;padding:12px 14px;border-radius:12px;background:var(--pb-sup)}
.gma-an-kpi span{font-size:12.5px;color:var(--pb-tenue)}
.gma-an-kpi b{font-size:26px;font-weight:700;color:var(--pb-titulo);font-variant-numeric:tabular-nums;line-height:1.15}
.gma-an-bloque{display:grid;gap:10px}
.gma-an-h{margin:0;font-size:14px;font-weight:700;color:var(--pb-texto)}
.gma-an-nota{margin:0;font-size:13px;color:var(--pb-tenue)}
.gma-an-grafico{display:grid;gap:6px}
.gma-an-lienzo{position:relative;width:100%;min-height:151px}
.gma-an-lienzo svg{display:block;overflow:visible}
.gma-an-base{stroke:var(--pb-borde);stroke-width:1}
.gma-an-col{fill:var(--pb-barra);transition:opacity .12s ease}
.gma-an-lienzo:hover .gma-an-col{opacity:.55}
.gma-an-lienzo:hover .gma-an-col[data-sobre]{opacity:1}
.gma-an-tip{position:absolute;transform:translateX(-50%);padding:4px 8px;border-radius:6px;background:#38383c;color:#f5f5f6;font-size:12px;white-space:nowrap;pointer-events:none}
.gma-an-ejes{display:flex;justify-content:space-between;font-size:11.5px;color:var(--pb-suave);font-variant-numeric:tabular-nums}
.gma-an-vertabla{justify-self:start;padding:0;border:0;background:transparent;color:var(--pb-tenue);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.gma-an-vertabla:hover{color:var(--pb-azul)}
.gma-an-tabla{width:100%;border-collapse:collapse;font-size:12.5px}
.gma-an-tabla th{text-align:left;font-weight:600;color:var(--pb-tenue);padding:4px 6px;border-bottom:1px solid var(--pb-borde)}
.gma-an-tabla td{padding:4px 6px;border-bottom:1px solid var(--pb-sup2);font-variant-numeric:tabular-nums}
.gma-an-alcance{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.gma-an-fila{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) 84px;align-items:center;gap:10px;font-size:13px}
.gma-an-sec{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--pb-texto)}
.gma-an-carril{position:relative;height:8px;border-radius:999px;background:var(--pb-sup2);overflow:hidden}
.gma-an-barra{position:absolute;inset:0 auto 0 0;border-radius:999px;background:var(--pb-barra)}
.gma-an-pct{text-align:right;font-weight:600;font-variant-numeric:tabular-nums;color:var(--pb-texto)}
.gma-an-pct[data-sin]{font-weight:500;color:var(--pb-suave)}
.gma-an-pie{display:flex;justify-content:flex-end}
`;
