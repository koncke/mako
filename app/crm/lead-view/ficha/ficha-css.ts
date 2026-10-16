// =============================================================================
// ficha-css — la hoja de estilos de la ficha por bloques (la grilla, el marco de edición y el panel)
// =============================================================================
// ⚠️ SÓLO TOKENS DE LA APP (var(--surface), var(--ink), var(--border)…): se dan vuelta solos en oscuro.
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va ninguna comilla invertida, ni el signo de pesos seguido de llave.
// ⚠️ NADA DE `container-type`, `transform` NI `filter` EN UN ANCESTRO DE LAS TARJETAS: los tres vuelven a un
//    `position: fixed` relativo a ESE elemento, y las tarjetas abren modales y toasts fijos (el WhatsApp no
//    oficial de InfoPrincipalCard, el toast de guardado). Por eso lo angosto va por @media y no por @container.
// ⚠️ El ESTILO de la ficha (tema y densidad) pisa las tarjetas de siempre, que llevan su caja en `style`:
//    por eso va con !important y sólo sobre la caja de cada bloque (`.fb-cuerpo > section`), no adentro.
//    Lo que dibuja un bloque con color propio (el «Va bien») lleva `fb-propio` y no se pisa.
// =============================================================================

export const CSS_FICHA = `
.fb { --fb-gap: 18px; }
.fb-dens-compacta { --fb-gap: 10px; }
.fb-dens-amplia { --fb-gap: 26px; }
.fb-grilla { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--fb-gap); align-items: stretch; }
.fb-bloque { min-width: 0; position: relative; display: flex; flex-direction: column; }
.fb-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--fb-gap); }
.fb-cuerpo > section:only-of-type { flex: 1 1 auto; }
.fb-nada { margin: 4px 0; font-size: 13.5px; color: var(--faint); }
@media (max-width: 720px) { .fb-bloque { grid-column: 1 / -1 !important; } }

.fb-dens-compacta .fb-cuerpo > section:not(.fb-propio) { padding: 14px 16px !important; border-radius: 12px; }
.fb-dens-amplia .fb-cuerpo > section:not(.fb-propio) { padding: 28px 30px !important; }
.fb--tema .fb-cuerpo > section:not(.fb-propio) { background: var(--dash-tarjeta-fondo) !important; border-color: var(--dash-tarjeta-borde) !important; border-radius: var(--dash-tarjeta-radio) !important; box-shadow: var(--dash-tarjeta-sombra) !important; }
.fb--letra .fb-cuerpo, .fb--letra .fb-cuerpo *:not([style*="Mono"]) { font-family: var(--dash-letra) !important; }

/* LA EDICIÓN: cada bloque con su marco, su rótulo y, el elegido, su barra (como una tarjeta del Dashboard). */
.fb--editando .fb-grilla { gap: calc(var(--fb-gap) + 12px); padding-top: 14px; }
.fb-bloque--editando { cursor: grab; }
.fb-bloque--editando > .fb-cuerpo { user-select: none; }
.fb-marco { position: absolute; inset: -6px; border: 1.5px dashed var(--border-strong); border-radius: 18px; pointer-events: none; z-index: 1; }
.fb-bloque--editando:hover > .fb-marco { border-color: var(--primary); }
.fb-bloque--sel > .fb-marco { border: 2px solid var(--primary); }
.fb-bloque--arrastrado > .fb-marco { border: 2px solid var(--primary); box-shadow: 0 6px 18px rgba(18, 21, 27, .14); }
.fb-bloque--antes::before, .fb-bloque--despues::after { content: ''; position: absolute; z-index: 3; background: var(--primary); border-radius: 3px; }
.fb-bloque--antes.fb-bloque--fila::before { left: -10px; top: 0; bottom: 0; width: 4px; }
.fb-bloque--despues.fb-bloque--fila::after { right: -10px; top: 0; bottom: 0; width: 4px; }
.fb-bloque--antes.fb-bloque--columna::before { top: -12px; left: 0; right: 0; height: 4px; }
.fb-bloque--despues.fb-bloque--columna::after { bottom: -12px; left: 0; right: 0; height: 4px; }
.fb-rotulo { position: absolute; top: -17px; left: 12px; z-index: 2; display: inline-flex; align-items: center; gap: 6px; max-width: calc(100% - 24px);
  padding: 2px 9px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); font-size: 12px; font-weight: 600; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fb-bloque--sel > .fb-rotulo { color: var(--primary); border-color: var(--primary); }
.fb-vacio { display: flex; align-items: center; justify-content: center; min-height: 64px; border-radius: 14px; background: var(--surface-2); color: var(--faint); font-size: 13px; }
.fb-barra-bloque { position: absolute; top: -19px; right: 10px; z-index: 4; display: flex; align-items: center; gap: 2px; flex-wrap: wrap; justify-content: flex-end;
  max-width: calc(100% - 20px); padding: 3px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); box-shadow: 0 6px 18px rgba(18, 21, 27, .14); cursor: default; }
.fb-herr { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 28px; min-width: 28px; padding: 0 8px; border: none; border-radius: 8px;
  background: transparent; color: var(--ink); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.fb-herr:hover:not(:disabled), .fb-herr[aria-expanded="true"] { background: var(--velo-hover); }
.fb-herr[aria-pressed="true"], .fb-herr[aria-checked="true"] { background: var(--primary-bg); color: var(--primary); }
.fb-herr:disabled { color: var(--faint); cursor: default; }
.fb-herr:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.fb-herr--mover { cursor: grab; color: var(--dim); }
.fb-sep { width: 1px; height: 18px; background: var(--border); margin: 0 3px; flex: none; }
.fb-agregar-celda { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; border: 1.5px dashed var(--border-strong);
  border-radius: 14px; background: transparent; color: var(--dim); font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
.fb-agregar-celda:hover { border-color: var(--primary); color: var(--primary); }

/* La barra de la edición (arriba de la grilla) y el panel de la derecha: el de propiedades del Dashboard. */
.fb-barra { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; padding: 4px 6px; border-radius: 12px; background: var(--surface-2); margin-bottom: 6px; }
.fb-barra .fb-herr { height: 32px; font-size: 13px; }
.fb-edicion { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; align-items: start; }
@media (max-width: 900px) { .fb-edicion { grid-template-columns: minmax(0, 1fr); } .fb-panel { position: static !important; max-height: none !important; } }
.fb-panel { position: sticky; top: 58px; max-height: calc(100dvh - 120px); overflow-y: auto; box-sizing: border-box; border: 1px solid var(--border); border-radius: 14px;
  background: var(--surface); color: var(--ink); font-family: 'Geist', sans-serif; }
.fb-panel-cab { padding: 12px 14px 10px; border-bottom: 1px solid var(--border); }
.fb-panel-tit { font-size: 14.5px; font-weight: 650; }
.fb-panel-linea { margin: 3px 0 0; font-size: 12.5px; color: var(--dim); line-height: 1.4; }
.fb-panel-sec { padding: 10px 14px 12px; border-bottom: 1px solid var(--border); }
.fb-panel-sec:last-child { border-bottom: none; }
.fb-panel-sub { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--dim); font-family: 'Geist Mono', monospace; margin: 2px 0 8px; }
.fb-panel-grupo { font-size: 12px; font-weight: 600; color: var(--dim); margin: 10px 0 2px; }
.fb-aviso { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 34px; border-top: 1px solid var(--border); font-size: 13.5px; }
.fb-aviso-fijo { font-size: 12px; color: var(--faint); }
.fb-segmentos { display: flex; gap: 2px; padding: 2px; border-radius: 10px; background: var(--surface-2); }
.fb-segmentos .fb-herr { flex: 1; }
.fb-boton-texto { border: none; background: none; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--primary); cursor: pointer; }
.fb-boton-texto:disabled { color: var(--faint); cursor: default; }
.fb-error { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--bad); }
.fb-personalizar { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--border-strong);
  background: var(--surface); color: var(--ink); font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.fb-personalizar:hover { border-color: var(--primary); color: var(--primary); }
.fb-personalizar[aria-pressed="true"] { background: var(--primary); border-color: var(--primary); color: var(--surface); }

/* El menú anclado (Flotante) y sus listas. */
.fb-flotante { position: fixed; background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, .18);
  padding: 6px 0; overflow-y: auto; box-sizing: border-box; max-width: calc(100vw - 16px); font-family: 'Geist', sans-serif; }
.fb-buscar { display: block; width: calc(100% - 20px); margin: 4px 10px 6px; box-sizing: border-box; height: 34px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--border-strong);
  background: var(--surface-2); color: var(--ink); font: inherit; font-size: 13.5px; outline: none; }
.fb-buscar:focus { border-color: var(--primary); }
.fb-opcion { display: flex; align-items: center; gap: 10px; width: 100%; border: none; background: transparent; padding: 8px 14px; font: inherit; font-size: 14px; color: var(--ink); text-align: left; cursor: pointer; }
.fb-opcion:hover:not(:disabled) { background: var(--velo-hover); }
.fb-opcion[aria-checked="true"] { background: var(--primary-bg); color: var(--primary); }
.fb-opcion-linea { margin-left: auto; font-size: 12px; color: var(--dim); }
.fb-vacio-menu { padding: 10px 14px; font-size: 13px; color: var(--faint); }
.fb-iconos { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding: 4px 8px 8px; }
.fb-iconos .fb-herr { height: 32px; }

/* El estilo de toda la ficha es el PanelEstilo del Dashboard (app/dashboard/PanelEstilo.tsx): sus reglas, copiadas de app/dashboard/editor-css.ts y edicion-css.ts. */
.fb-panel .lk-estilo { padding: 0; display: flex; flex-direction: column; gap: 4px; }
.lk-estilo-tit { font-size: 12px; font-weight: 600; color: var(--dim); margin: 8px 0 4px; }
.lk-plantillas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.lk-plantilla { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); padding: 8px; cursor: pointer; text-align: left; color: var(--ink); font: inherit; }
.lk-plantilla:hover { border-color: var(--primary); }
.lk-plantilla[aria-pressed="true"] { border-color: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
.lk-plantilla-nom { font-size: 13px; font-weight: 600; }
.lk-muestra { height: 58px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; padding: 7px 8px; overflow: hidden; }
.lk-muestra-tit { font-size: 10px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lk-muestra-barras { display: flex; align-items: flex-end; gap: 3px; height: 26px; }
.lk-muestra-barras span { flex: 1; display: block; }
.lk-colores { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.lk-color { width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--border); cursor: pointer; padding: 0; }
.lk-color[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--ink); }
.lk-color--rueda { position: relative; overflow: hidden; display: inline-grid; place-items: center; }
.lk-color--rueda input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; padding: 0; border: 0; cursor: pointer; }
.lk-color--rueda[data-elegido] { box-shadow: 0 0 0 2px var(--ink); }
.lk-color-punto { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 2px var(--surface); pointer-events: none; }
.lk-letras { display: flex; flex-direction: column; }
.lk-letra { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; width: 100%; border: none; background: transparent; padding: 7px 8px; border-radius: 8px; cursor: pointer; color: var(--ink); text-align: left; font: inherit; }
.lk-letra:hover { background: var(--velo-hover); }
.lk-letra[aria-pressed="true"] { background: var(--primary-bg); color: var(--primary); }
.lk-letra-nom { font-size: 16px; }
.lk-letra-tipo { font-size: 11.5px; color: var(--dim); }
`;
