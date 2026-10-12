// =============================================================================
// /offer — la hoja de estilos de la pantalla
// =============================================================================
// Vive en una hoja y no en style={{}} por lo de siempre: :hover, :focus-visible y
// las media queries no existen en un estilo en línea, y sin ellos las pastillas de
// respuesta y las filas del diagnóstico no reaccionan al cursor ni muestran el foco
// del teclado. Todo con el prefijo of- para no pisar a nadie.
//
// Sólo tokens que existen en claro Y en oscuro (app/globals.css → [data-tema="oscuro"]).
// El dorado es SÓLO de MaKo: lo usan su foto, la estrella, la pastilla de «Armar mi
// oferta» y el borde de una pieza que MaKo ya sabía. Lo del dueño va en azul o en gris.
//
// ⚠️ `.of-hilo-lista > div` APLANA LA CAJA DE ChatHilo (app/whatsapp/_shared/ChatHilo.tsx): la
// tarjeta del chat es la de ChatOffer, con la barra de escribir adentro, y ChatHilo dibuja su
// propio borde y su radio en línea. Una regla con `!important` le gana a un estilo en línea sin
// tocar el componente compartido. Si ChatHilo cambia su nodo raíz, lo peor que pasa es un borde
// de más (se ve, no rompe nada).

export const CSS_OFFER = `
.of-sr { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.of-cabecera { flex: none; display: flex; align-items: center; gap: 12px; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid var(--border); }

.of-hilo-lista > div { border: 0 !important; border-radius: 0 !important; }
.of-hilo[data-encima] { outline: 2px dashed var(--primary); outline-offset: -4px; }
.of-error { flex: none; padding: 8px 16px; background: var(--warn-bg); color: var(--warn); font-size: 12.5px; line-height: 1.45; border-top: 1px solid var(--border); }

.of-pill {
  min-height: 40px; padding: 8px 16px; border-radius: 999px;
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

.of-reintento { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; padding: 8px 12px; border-radius: 12px; background: var(--warn-bg); color: var(--warn); font-size: 13.5px; }

.of-quitar {
  flex: none; width: 22px; height: 22px; border-radius: 999px; border: 0; padding: 0;
  background: transparent; color: var(--faint); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.of-quitar:hover { background: var(--surface); color: var(--ink); }
.of-quitar:focus-visible { outline: none; box-shadow: var(--focus-ring); }

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
@keyframes of-av-latido { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.16); } }
.of-av-latido { transform-box: fill-box; transform-origin: center; animation: of-av-latido 1.4s ease-in-out infinite; }
.of-puntos span { animation: of-latido 1.2s ease-in-out infinite; }
.of-puntos span:nth-child(2) { animation-delay: .2s; }
.of-puntos span:nth-child(3) { animation-delay: .4s; }
@media (prefers-reduced-motion: reduce) {
  .of-puntos span { animation: none; opacity: .7; }
  .of-av-latido { animation: none; }
  .of-fila__flecha, .of-plegable__flecha { transition: none; }
}
`;
