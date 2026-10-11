'use client';

// =============================================================================
// piezas — lo que comparten los bloques de Comercial: la caja, el pop-up de desglose, la KPI
// =============================================================================
// El diseño es el de la tab vieja de Comercial (app/comercial/page.tsx hasta 7527b8c2), con los TOKENS
// de la app para que se dé vuelta en el tema oscuro y con la letra de la hoja (var(--dash-letra)).

import { useCallback, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '@/app/_ui';
import { DesgloseModal, type DesgloseData, type DesgloseItem } from '@/app/_components/Desglose';
import { fmtValor } from '@/lib/graficos-agregar';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { RevItem } from '@/lib/pagos';
import type { EstiloEfectivo } from '@/lib/graficos-temas';

export const MONO = "'Geist Mono', monospace";

/** Un monto: el mismo formato que las KPI genéricas de la hoja (US$, y compacto si el tema lo pide). */
export const usd = (n: number | null | undefined, compacto = false) => fmtValor(n ?? null, 'usd', compacto);
export const num = (n: number | null | undefined) => fmtValor(n ?? null, 'numero');
export const pct = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : `${Math.round(n)}%`);
export const fecha = fmtDDMMYYYY;
export const plural = (n: number, uno: string, muchos: string) => `${n} ${n === 1 ? uno : muchos}`;

/**
 * La clase que le dice a la grilla «acá no se arrastra» (el `cancel` de react-grid-layout en
 * app/dashboard/EditorInforme.tsx). Va en todo lo que se aprieta: sin ella, en modo edición, un clic en
 * «Marcar cobrado» empieza a mover la tarjeta.
 */
export const NO_ARRASTRAR = 'lk-no-arrastrar';

/**
 * El CSS de los bloques. Va en una hoja propia (y no en estilos en línea) por tres cosas que un `style`
 * no puede: el hover de los botones, las consultas de contenedor (una tarjeta angosta apila sus
 * columnas) y el movimiento reducido del tintineo de lo vencido.
 */
export const CSS = `
.bq-raiz { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 16px; overflow: auto; container-type: inline-size; font-family: var(--dash-letra, 'Geist', system-ui, sans-serif); color: var(--ink); }
.bq-msg { flex: 1; display: grid; place-items: center; color: var(--faint); font-size: 13.5px; text-align: center; padding: 8px; }
.bq-abrible { display: block; width: 100%; text-align: inherit; background: none; border: none; padding: 0; margin: 0; font: inherit; color: inherit; cursor: pointer; }
.bq-abrible:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: 10px; }
.bq-kpi { display: flex; flex-direction: column; gap: 0; background: var(--surface-2); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; transition: border-color .15s, box-shadow .15s; container-type: inline-size; min-width: 0; }
.bq-abrible:hover .bq-kpi { border-color: var(--border-strong); box-shadow: 0 4px 16px rgba(18,21,27,.08); }
.bq-kpi-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.bq-kpi-rot { color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bq-kpi-rot--mono { font-family: ${MONO}; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; }
.bq-kpi-rot--letra { font-size: 13px; font-weight: 500; }
.bq-kpi-ver { flex: none; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
.bq-kpi-val { font-weight: 600; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.bq-kpi-sub { font-size: 12.5px; color: var(--faint); margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bq-boton { flex: none; border-radius: 999px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; border: 1px solid var(--good); background: var(--good-bg); color: var(--good); font-family: inherit; white-space: nowrap; cursor: pointer; transition: box-shadow .15s; }
.bq-boton:hover:not(:disabled) { box-shadow: inset 0 0 0 999px var(--velo-hover); }
.bq-boton:disabled { cursor: wait; opacity: .6; }
.bq-boton:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.bq-link { color: var(--primary); font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.bq-abrible:hover .bq-link { text-decoration: underline; }
.bq-scroll { flex: 1; min-height: 0; overflow: auto; border: 1px solid var(--border); border-radius: 13px; }
.bq-tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
.bq-tabla th { position: sticky; top: 0; z-index: 1; background: var(--surface-2); text-align: left; padding: 12px 14px; font-family: ${MONO}; font-size: 11px; letter-spacing: .07em; text-transform: uppercase; color: var(--dim); font-weight: 600; white-space: nowrap; }
.bq-tabla td { padding: 12px 14px; border-top: 1px solid var(--border); font-variant-numeric: tabular-nums; }
.bq-tabla .bq-der { text-align: right; }
.bq-punto { width: 9px; height: 9px; flex: none; border-radius: 50%; }
.bq-punto--vencida { background: var(--bad); animation: blinkRed 1.1s infinite; }
.bq-punto--pronto { background: var(--mako); animation: blinkAmber 1.1s infinite; }
@media (prefers-reduced-motion: reduce) { .bq-punto--vencida, .bq-punto--pronto { animation: none; } }
.bq-kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.bq-funnel { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 28px; align-items: stretch; }
.bq-funnel-kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-content: stretch; }
.bq-funnel-kpis > * { display: flex; }
.bq-funnel-kpis > * > .bq-kpi, .bq-funnel-kpis > .bq-kpi { flex: 1; justify-content: center; }
@container (max-width: 640px) {
  .bq-kpis { grid-template-columns: minmax(0, 1fr); }
  .bq-funnel { grid-template-columns: minmax(0, 1fr); }
}
`;

/**
 * La caja de un bloque: estira en la tarjeta y scrollea por dentro si no entra. La hoja va con
 * `href` + `precedence` (React 19 la sube al <head> y la pone UNA vez aunque haya seis bloques), como
 * app/customer-success/curso/LeccionEditable.tsx.
 */
export function Raiz({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="bq-raiz" style={style}>
      <style href="dash-bloques-comercial" precedence="medium">{CSS}</style>
      {children}
    </div>
  );
}

export function Mensaje({ children }: { children: ReactNode }) {
  return <div className="bq-msg">{children}</div>;
}

/** Lo que se ve mientras no hay datos: el giro, o el error tal cual llegó. */
export function Aviso({ cargando, error }: { cargando: boolean; error?: string }) {
  return <Mensaje>{error ? error : cargando ? <Spinner size={20} /> : 'Sin datos'}</Mensaje>;
}

const parar = (e: SyntheticEvent) => e.stopPropagation();

/**
 * Monta algo en el `body`. Hace falta por DOS cosas de la tarjeta, y ninguna da error:
 * react-grid-layout la ubica con `transform` —con eso un `position: fixed` de adentro deja de ser
 * relativo a la ventana y queda pegado a la tarjeta— y la tarjeta lleva `overflow: hidden`, que lo
 * recorta. El pop-up de desglose y el toast se verían cortados adentro de la caja.
 *
 * ⚠️ Un portal de React sigue BURBUJEANDO por el árbol de React: un clic adentro del pop-up llegaría al
 *    `onClick` de la tarjeta (que la selecciona en modo edición) y un mousedown, a la grilla (que
 *    empezaría a arrastrarla). Por eso la envoltura frena los eventos y lleva la clase de no arrastrar.
 */
export function Capa({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={NO_ARRASTRAR} onClick={parar} onMouseDown={parar} onPointerDown={parar} onTouchStart={parar}>{children}</div>,
    document.body,
  );
}

/** Algo que se aprieta y abre el desglose de lo que hay atrás (el `DesgloseModal` de siempre, con «✎ Editar lead»). */
export function Abrible({ data, children, style, titulo }: { data: DesgloseData; children: ReactNode; style?: CSSProperties; titulo?: string }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  return (
    <>
      <button type="button" className={`bq-abrible ${NO_ARRASTRAR}`} style={style} title={titulo} onClick={() => setAbierto(true)}>
        {children}
      </button>
      {abierto && <Capa><DesgloseModal data={data} onClose={cerrar} /></Capa>}
    </>
  );
}

/**
 * Las filas de un desglose de plata (Sold, Cash, Outstanding): monto, la cuota y su fecha. El monto va
 * entero aunque el tema sea compacto: el desglose es justo donde se va a mirar el número exacto.
 */
export function itemsDePlata(items: readonly RevItem[], fechaLabel: string): DesgloseItem[] {
  return items.map((it) => ({
    nombre: it.nombre,
    valor: usd(it.monto),
    detalle: `${it.detalle ? `${it.detalle} · ` : ''}${fechaLabel} ${fecha(it.fecha)}`,
    leadId: it.leadId,
    focus: 'plan-pagos',
  }));
}

/**
 * La KPI de las tabs viejas: el rótulo (en mono y mayúsculas, o en la letra de la hoja según el tema),
 * el número grande y la línea de abajo. El número se achica para entrar en la tarjeta, nunca se corta.
 */
export function Kpi({ rotulo, valor, color, sub, estilo, ver, tam = 32, filete }: {
  rotulo: string; valor: string; color: string; sub?: string; estilo: EstiloEfectivo; ver?: string | null; tam?: number;
  /** El color del filete de arriba; si no viene, el del número (gris si el número va en tinta). */
  filete?: string;
}) {
  const t = Math.min(tam, estilo.kpiTamValor || tam);
  const caracteres = Math.max(4, valor.length);
  const borde = filete ?? (color === 'var(--ink)' ? 'var(--border-strong)' : color);
  return (
    <div className="bq-kpi" style={estilo.filete ? { borderTop: `3px solid ${borde}` } : undefined}>
      <div className="bq-kpi-cab">
        <span className={`bq-kpi-rot bq-kpi-rot--${estilo.kpiEtiqueta}`}>{rotulo}</span>
        {ver && <span className="bq-kpi-ver" style={{ color: color === 'var(--ink)' ? 'var(--primary)' : color }}>{ver}</span>}
      </div>
      <div className="bq-kpi-val" style={{ color, fontSize: `min(${t}px, calc(100cqw / ${(caracteres * 0.62).toFixed(2)}))` }}>{valor}</div>
      {sub && <div className="bq-kpi-sub" title={sub}>{sub}</div>}
    </div>
  );
}
