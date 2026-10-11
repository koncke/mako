// =============================================================================
// /offer — la hoja de estilos de la pantalla
// =============================================================================
// Vive en una hoja y no en style={{}} por lo de siempre: :hover, :focus-visible y
// las media queries no existen en un estilo en línea, y sin ellos las pastillas de
// respuesta y las filas del diagnóstico no reaccionan al cursor ni muestran el foco
// del teclado. Todo con el prefijo of- para no pisar a nadie.
//
// Sólo tokens que existen en claro Y en oscuro (app/globals.css → [data-tema="oscuro"]).
// El dorado es SÓLO de MaKo: lo usan la estrella, la pastilla de «Armar mi oferta»
// y el borde de una pieza que MaKo ya sabía. Lo del dueño va en azul o en gris.

export const CSS_OFFER = `
.of-btn-reset { font: inherit; color: inherit; }

.of-pill {
  min-height: 44px; padding: 10px 18px; border-radius: 999px;
  border: 1px solid var(--border-strong); background: var(--surface); color: var(--ink);
  font: inherit; font-size: var(--fs-md); font-weight: 600; line-height: 1.3; text-align: left;
  cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
  transition: background .14s ease, border-color .14s ease, color .14s ease, box-shadow .14s ease;
}
.of-pill:hover:not(:disabled) { border-color: var(--primary); background: var(--primary-bg); color: var(--primary-strong); }
.of-pill:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.of-pill:disabled { opacity: .5; cursor: not-allowed; }
.of-pill--mako { border-color: var(--mako-border); background: var(--mako-bg); color: var(--mako-ink); }
.of-pill--mako:hover:not(:disabled) { border-color: var(--mako); background: var(--mako-bg); color: var(--mako-ink); }

.of-herr {
  flex: none; width: 42px; height: 42px; border-radius: 11px;
  border: 1px solid var(--border-strong); background: var(--surface); color: var(--dim);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  transition: background .14s ease, color .14s ease, box-shadow .14s ease;
}
.of-herr:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
.of-herr:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.of-herr:disabled { opacity: .45; cursor: not-allowed; }

.of-iconbtn-borde { border-color: var(--border-strong) !important; }

.of-composer { border-color: var(--border-strong); box-shadow: 0 1px 2px rgba(18,21,27,.05); transition: border-color .14s ease, box-shadow .14s ease; }
.of-reintento { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; margin: 4px auto 10px; max-width: 760px; padding: 8px 12px; border-radius: 12px; background: var(--warn-bg); color: var(--warn); font-size: 13.5px; }
.of-composer:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }
.of-composer[data-encima] { border-color: var(--primary); background: var(--primary-bg) !important; }
.of-campo::placeholder { color: var(--faint); }

.of-quitar {
  flex: none; width: 22px; height: 22px; border-radius: 999px; border: 0; padding: 0;
  background: transparent; color: var(--faint); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.of-quitar:hover { background: var(--surface); color: var(--ink); }
.of-quitar:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.of-menu-fila {
  width: 100%; display: flex; align-items: center; gap: 10px; padding: 11px 14px;
  border: 0; border-radius: 10px; background: transparent; color: var(--ink);
  font: inherit; font-size: var(--fs-md); text-align: left; cursor: pointer;
}
.of-menu-fila:hover:not(:disabled) { background: var(--surface-2); }
.of-menu-fila:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.of-menu-fila[aria-current="true"] { background: var(--primary-bg); }
.of-menu-fila:disabled { cursor: default; }

.of-seg { display: inline-flex; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 13px; padding: 5px; gap: 3px; max-width: 100%; }
.of-seg__op {
  border: 0; border-radius: 10px; background: transparent; padding: 11px 22px; cursor: pointer;
  font: inherit; font-size: var(--fs-card); font-weight: 600; color: var(--dim); white-space: nowrap;
}
.of-seg__op[aria-selected="true"] { background: var(--primary-bg); color: var(--primary); }
.of-seg__op:hover:not([aria-selected="true"]) { color: var(--ink); }
.of-seg__op:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.of-fila {
  width: 100%; display: grid; align-items: center; column-gap: 14px; row-gap: 8px;
  grid-template-columns: minmax(120px, 190px) minmax(0, 1fr) 30px 16px;
  grid-template-areas: "label barra nota flecha";
  padding: 13px 14px; border: 0; border-radius: 12px; background: transparent;
  color: var(--ink); font: inherit; text-align: left; cursor: pointer;
}
.of-fila:hover:not(:disabled) { background: var(--surface-2); }
.of-fila:disabled { cursor: default; }
.of-fila:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.of-fila__label { grid-area: label; font-size: var(--fs-md); font-weight: 600; min-width: 0; }
.of-fila__barra { grid-area: barra; }
.of-fila__nota { grid-area: nota; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.of-fila__flecha { grid-area: flecha; color: var(--faint); display: flex; transition: transform .16s ease; }
.of-fila[aria-expanded="true"] .of-fila__flecha { transform: rotate(180deg); }

.of-plegable {
  width: 100%; display: flex; align-items: center; gap: 12px; padding: 16px 20px;
  border: 0; background: transparent; color: var(--ink); font: inherit; text-align: left; cursor: pointer;
  border-radius: 16px;
}
.of-plegable:hover { background: var(--surface-2); }
.of-plegable:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.of-plegable__flecha { color: var(--faint); display: flex; transition: transform .16s ease; }
.of-plegable[aria-expanded="true"] .of-plegable__flecha { transform: rotate(180deg); }
.of-plegable--aviso:hover { background: transparent; }

.of-completar {
  display: inline-flex; align-items: center; padding: 1px 9px; margin: 0 2px; border-radius: 999px;
  background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-fill);
  font-size: .86em; font-weight: 600; line-height: 1.5; white-space: nowrap; vertical-align: baseline;
}

.of-riel { display: flex; }
.of-barra-movil { display: none; }
@media (max-width: 900px) {
  .of-riel { display: none !important; }
  .of-barra-movil { display: flex; }
}
@media (max-width: 640px) {
  .of-fila {
    grid-template-columns: minmax(0, 1fr) 30px 16px;
    grid-template-areas: "label nota flecha" "barra barra barra";
  }
  .of-heroe-frase { font-size: 23px !important; }
  .of-seg__op { padding: 10px 14px; }
}

@keyframes of-latido { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
.of-puntos span { animation: of-latido 1.2s ease-in-out infinite; }
.of-puntos span:nth-child(2) { animation-delay: .2s; }
.of-puntos span:nth-child(3) { animation-delay: .4s; }
@media (prefers-reduced-motion: reduce) {
  .of-puntos span { animation: none; opacity: .7; }
  .of-fila__flecha, .of-plegable__flecha { transition: none; }
}
`;
