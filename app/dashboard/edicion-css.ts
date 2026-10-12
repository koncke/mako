// =============================================================================
// edicion-css — la hoja de estilos de LO QUE EDITA el Dashboard (tanda v5, paquete «Edición»)
// =============================================================================
// El cromo del editor vive en ./editor-css.ts (otro paquete). Acá va lo que agregó la tanda v5 del lado de la
// edición: el panel de propiedades SUPERPUESTO (punto 19), la sección y su fondo (12 y 24), la capa de los
// conectores (11), el pop-up (7), la sección «Filtros» del panel (9) y la rueda de «Otro color» (17).
// La monta app/dashboard/EditorInforme.tsx DESPUÉS de la de editor-css: con la misma especificidad gana la de
// abajo, que es lo que el panel superpuesto necesita para pisar el `flex` de antes.
//
// ⚠️ SÓLO TOKENS (como editor-css): ni un hex. La rueda de colores es la única excepción de la casa y va como
//    constante de TS en el `style` (app/_ui/rueda-color.ts), nunca acá. Lo fija tests/dashboard-pantalla.test.ts.
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni en un comentario, ni el signo de pesos
//    seguido de llave.
// ⚠️ EL PANEL SUPERPUESTO ES SÓLO EN LA COMPU (min-width 761 px). En el celular sigue la hoja que sube desde
//    abajo de editor-css: ahí ya se superponía.

export const CSS_EDICION = `
/* ── Punto 19: el panel de propiedades (y el AI Analyst) va ENCIMA del lienzo, no al lado. Al lado, el lienzo
   perdía 300 px, la grilla se volvía a medir y cada tarjeta se veía distinta de como se va a ver. El lado se
   decide al elegir (la pantalla pone data-lado), del lado opuesto a lo elegido. */
.lk-cuerpo { position: relative; }
@media (min-width: 761px) {
  .lk-props { position: absolute; top: 12px; bottom: 12px; width: 300px; z-index: 20; border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 14px 36px rgba(0,0,0,.16); }
  .lk-props[data-lado="der"] { right: 12px; }
  .lk-props[data-lado="izq"] { left: 12px; }
  .lk-cuerpo > .an { position: absolute; top: 12px; right: 12px; bottom: 12px; z-index: 21; border: 1px solid var(--border); border-radius: 14px; box-shadow: 0 14px 36px rgba(0,0,0,.16); }
}

/* ── La grilla y lo que va detrás y delante de ella: el fondo de las secciones y los conectores. */
.lk-grilla { position: relative; }
.lk-fondos { position: absolute; inset: 0; pointer-events: none; }
.lk-fondo { position: absolute; left: -12px; right: -12px; border-radius: 18px; }
.lk-conectores { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.lk-conectores svg { position: absolute; left: 0; top: 0; overflow: visible; }
.lk-con-halo { fill: none; stroke: var(--bg); stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
.lk-con { fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.lk-con-g[data-sel] .lk-con { stroke-width: 3.2; }
.lk-con-toque { fill: none; stroke: transparent; stroke-width: 16; pointer-events: stroke; cursor: pointer; }
.lk-con-temp { fill: none; stroke: var(--primary); stroke-width: 2; stroke-dasharray: 6 5; }
.lk-con-borrar { position: absolute; transform: translate(-50%, -50%); pointer-events: auto; background: var(--surface); border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,.18); }
.lk-tirador { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: var(--surface); border: 2px solid var(--primary); pointer-events: auto; cursor: crosshair; padding: 0; z-index: 6; }
.lk-tirador:hover { background: var(--primary); }
.lk-conectar-aviso { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 22; display: flex; align-items: center; gap: 10px; padding: 6px 8px 6px 14px; border-radius: 18px; background: var(--ink); color: var(--bg); font-size: 13.5px; box-shadow: 0 6px 20px rgba(0,0,0,.2); }
.lk-conectar-aviso button { border: none; background: transparent; color: inherit; font: inherit; font-weight: 600; cursor: pointer; padding: 4px 8px; border-radius: 12px; }
.lk-conectar-aviso button:hover { background: var(--velo-hover); }
.lk--conectando .lk-comp { cursor: crosshair; }

/* ── La sección (puntos 12 y 24): un título a lo ancho con su flecha de plegar, o un divisor. */
.lk-sec { flex: 1; min-height: 0; min-width: 0; display: flex; align-items: flex-end; gap: 8px; padding: 0 2px 6px; border-bottom: 1px solid var(--border); }
.lk-sec-tit { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lk-sec-btn { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border: none; border-radius: 8px; background: transparent; color: var(--dim); cursor: pointer; padding: 0; margin-bottom: 2px; }
.lk-sec-btn:hover { background: var(--velo-hover); color: var(--ink); }
.lk-sec-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.lk-sec-btn svg { transition: transform .15s; }
.lk-sec-btn[aria-expanded="false"] svg { transform: rotate(-90deg); }
.lk-sec-cuenta { flex: none; font-size: 12.5px; color: var(--faint); margin-bottom: 8px; }
.lk-sec-linea { flex: 1; min-height: 0; display: flex; align-items: center; }
.lk-sec-linea::before { content: ''; display: block; width: 100%; height: 1px; background: var(--border-strong); }

/* ── El pop-up (punto 7): la mini-hoja, en una grilla CSS con los mismos números que la del lienzo. */
.lk-popup-grilla { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-rows: 30px; gap: 16px; }
.lk-popup-grilla > .lk-comp { grid-column: var(--lk-col); grid-row: var(--lk-fila); }
.lk-popup-vacio { padding: 40px 0; text-align: center; color: var(--dim); font-size: 14px; }
.lk-miga { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 12px; font-size: 13.5px; color: var(--dim); }
.lk-miga button { border: none; background: transparent; font: inherit; color: var(--primary); font-weight: 600; cursor: pointer; padding: 4px 6px; border-radius: 8px; }
.lk-miga button:hover { background: var(--velo-hover); }
.lk-miga-actual { color: var(--ink); font-weight: 600; }
.lk-miga-muestra { color: var(--faint); }

/* ── La sección «Filtros» del panel (punto 9): el período de la hoja como primer renglón, y quién ve qué. */
.lk-fil-hoja { display: flex; align-items: center; gap: 8px; width: 100%; height: 34px; border: 1px dashed var(--border-strong); border-radius: 8px; background: transparent; color: var(--ink); font: inherit; font-size: 13.5px; padding: 0 10px; cursor: pointer; text-align: left; }
.lk-fil-hoja:hover { background: var(--surface-2); }
.lk-fil-tenue { margin-left: auto; color: var(--faint); font-size: 12.5px; }
.lk-fil-vista { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.lk-fil-rot { font-size: 12px; font-weight: 600; color: var(--dim); margin-right: 2px; }
.lk-chip { height: 28px; padding: 0 10px; border-radius: 14px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--dim); font: inherit; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.lk-chip[aria-pressed="true"] { background: var(--primary-bg); border-color: var(--primary); color: var(--primary); }
.lk-seg { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--border); }
.lk-seg button { flex: 1; min-width: 0; height: 30px; border: none; border-radius: 7px; background: transparent; color: var(--dim); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; padding: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lk-seg button[aria-pressed="true"] { background: var(--surface); color: var(--ink); box-shadow: 0 0 0 1px var(--border-strong); }
.lk-dos { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
.lk-dos .lk-campo-num { flex-direction: column; align-items: stretch; gap: 3px; font-size: 12.5px; color: var(--dim); }
.lk-dos .lk-campo-num .lk-input { width: 100%; }

/* ── Punto 17: «Otro color» es un círculo más, con la rueda (el fondo va en línea). */
.lk-color--rueda { position: relative; overflow: hidden; display: inline-grid; place-items: center; }
.lk-color--rueda input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; padding: 0; border: 0; cursor: pointer; }
.lk-color--rueda[data-elegido] { box-shadow: 0 0 0 2px var(--ink); }
.lk-color-punto { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 2px var(--surface); pointer-events: none; }

@media print {
  .lk-conectores .lk-tirador, .lk-con-borrar, .lk-conectar-aviso, .lk-miga { display: none !important; }
  .lk-sec-btn { display: none !important; }
}
`;
