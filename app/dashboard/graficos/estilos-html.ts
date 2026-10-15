// =============================================================================
// estilos-html — el CSS de los tipos de gráfico que se dibujan en HTML y no en recharts
// =============================================================================
// La tabla (también la de las dinámicas de Grafico.tsx: comparten .gr-tabla), las barras gordas, los paneles, la barra
// de proporción, la línea de tiempo (tramos), las tarjetas y el mapa. Se reparte así para que dos chats puedan
// rediseñar en paralelo sin tocar el mismo archivo (14/10/2026): esto lo incluye CSS_GRAFICOS (./estilos.tsx) adentro
// de SU template literal, que es lo que monta la página una sola vez.
//
// Las mismas reglas que estilos.tsx: nada por debajo de 13 px (var(--fs-sm)), cifras tabulares, sólo tokens y ningún
// hex. ⚠️ Sin comillas invertidas adentro de la cadena: cortan la hoja a la mitad (AGENTS.md).

export const CSS_HTML = `
.gr-tabla { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; container-type: inline-size; }
.gr-tabla table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: var(--fs-md); font-variant-numeric: tabular-nums; }
.gr-tabla th { text-align: right; font-size: var(--fs-sm); font-weight: 600; color: var(--dim); padding: 8px 14px; border-bottom: 1px solid var(--border); background: var(--dash-tarjeta-fondo, var(--surface)); position: sticky; top: 0; z-index: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gr-tabla td { text-align: right; padding: 12px 14px; border-bottom: 1px solid var(--border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--dim); }
.gr-tabla .gr-izq { text-align: left; }
.gr-tabla td.gr-nombre { color: var(--ink); font-size: var(--fs-card); font-weight: 500; }
.gr-tabla td.gr-extra { text-align: left; color: var(--dim); }
.gr-tabla td.gr-fuerte { color: var(--ink); font-weight: 600; }
.gr-tabla tbody tr:hover td { background: var(--surface-2); }
.gr-tabla tbody tr[tabindex]:focus-visible td { background: var(--surface-2); }
.gr-tabla .gr-total td { font-weight: 600; color: var(--ink); border-bottom: none; border-top: 1px solid var(--border-strong); }
.gr-celda-barra { display: flex; align-items: center; gap: 10px; min-width: 0; }
.gr-celda-barra .gr-num { flex: none; color: var(--ink); font-size: var(--fs-card); font-weight: 600; min-width: 4ch; text-align: right; }
.gr-pista { flex: 1; min-width: 40px; height: 14px; border-radius: 7px; background: var(--surface-2); overflow: hidden; display: flex; }
.gr-pista > span { display: block; height: 100%; border-radius: 7px; }
.gr-mas { margin: 10px 14px 0; font-size: var(--fs-sm); color: var(--faint); }

.gr-barras { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
.gr-barras-fila { display: grid; grid-template-columns: minmax(0, 34%) minmax(0, 1fr); align-items: center; gap: 14px; padding: 6px 4px; border-radius: 10px; }
.gr-barras-fila[tabindex] { cursor: pointer; }
.gr-barras-fila[tabindex]:hover, .gr-barras-fila[tabindex]:focus-visible { background: var(--velo-hover); outline: none; }
.gr-barras-rot { font-size: var(--fs-card); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-barras-par { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.gr-barras-linea { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; min-width: 0; }
.gr-barras-pista { position: relative; height: 26px; border-radius: 8px; overflow: hidden; }
.gr-barras-pista--doble { height: 16px; }
.gr-barras-pista > span { position: absolute; inset: 0 auto 0 0; border-radius: 8px; }
.gr-barras-val { font-size: var(--fs-card); font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.gr-barras-val--chico { font-size: var(--fs-sm); color: var(--dim); }
.gr-barras-leyenda { display: flex; gap: 14px; flex-wrap: wrap; font-size: var(--fs-md); color: var(--ink); padding: 0 4px 6px; }

.gr-paneles { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 14px 22px; container-type: inline-size; }
.gr-paneles--uno { grid-template-columns: minmax(0, 1fr); }
@container (max-width: 560px) { .gr-paneles { grid-template-columns: minmax(0, 1fr); } }
.gr-panel { display: flex; flex-direction: column; min-height: 0; min-width: 0; gap: 2px; }
.gr-panel-cab { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: var(--fs-md); font-weight: 600; color: var(--dim); }
.gr-panel-cab > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-panel-num { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.gr-panel-num > b { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }

.gr-prop { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 14px; }
.gr-prop-barra { display: flex; height: 28px; border-radius: 8px; overflow: hidden; background: var(--surface-2); gap: 2px; }
.gr-prop-barra > button { border: none; padding: 0; margin: 0; min-width: 0; height: 100%; cursor: default; }
.gr-prop-barra > button[data-abre] { cursor: pointer; }
.gr-prop-ley { display: flex; flex-wrap: wrap; gap: 8px 22px; }
.gr-prop-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; border: none; background: none; padding: 4px 6px; margin: -4px -6px; border-radius: 8px; text-align: left; color: inherit; font: inherit; cursor: default; }
.gr-prop-item[data-abre] { cursor: pointer; }
.gr-prop-item[data-abre]:hover, .gr-prop-item[data-abre]:focus-visible { background: var(--velo-hover); outline: none; }
.gr-prop-nom { font-size: var(--fs-md); color: var(--dim); white-space: nowrap; }
.gr-prop-val { font-size: 22px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.gr-prop-val small { font-size: var(--fs-sm); font-weight: 500; color: var(--faint); margin-left: 6px; letter-spacing: 0; }
/* Una tarjeta baja (3 filas de la grilla): la barra más fina y cada parte en UN renglón (nombre, número, %). */
.gr-prop--compacta { gap: 8px; }
.gr-prop--compacta .gr-prop-barra { height: 18px; border-radius: 6px; }
.gr-prop--compacta .gr-prop-item { flex-direction: row; align-items: baseline; gap: 8px; }
.gr-prop--compacta .gr-prop-val { font-size: var(--fs-card); }

.gr-tramos { flex: 1; min-height: 0; display: flex; align-items: center; gap: 6px; container-type: inline-size; overflow: hidden; }
.gr-tramo { display: flex; flex-direction: column; gap: 8px; min-width: 64px; border: none; background: none; padding: 6px 4px; border-radius: 10px; text-align: left; color: inherit; font: inherit; cursor: default; }
.gr-tramo[data-abre] { cursor: pointer; }
.gr-tramo[data-abre]:hover, .gr-tramo[data-abre]:focus-visible { background: var(--velo-hover); outline: none; }
.gr-tramo-val { font-size: var(--fs-card); font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.gr-tramo-pista { height: 14px; border-radius: 7px; }
.gr-tramo-nom { font-size: var(--fs-sm); color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-tramo--largo .gr-tramo-val, .gr-tramo--largo .gr-tramo-nom { color: var(--bad); font-weight: 600; }
@container (max-width: 520px) {
  .gr-tramos { flex-direction: column; align-items: stretch; justify-content: center; }
  .gr-tramo { flex: none !important; display: grid; grid-template-columns: minmax(0, 40%) minmax(0, 1fr) auto; align-items: center; gap: 10px; }
  .gr-tramo .gr-tramo-nom { order: 1; }
  .gr-tramo .gr-tramo-pista { order: 2; }
  .gr-tramo .gr-tramo-val { order: 3; }
}

.gr-tarjetas { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; align-content: start; }
.gr-tarjeta { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); text-align: left; color: inherit; font: inherit; }
.gr-tarjeta[tabindex] { cursor: pointer; }
.gr-tarjeta[tabindex]:hover, .gr-tarjeta[tabindex]:focus-visible { border-color: var(--border-strong); background: var(--surface-2); outline: none; }
.gr-tarjeta-cab { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: start; }
.gr-tarjeta-cab--sin { grid-template-columns: minmax(0, 1fr); }
.gr-tarjeta-mini { width: 64px; height: 64px; border-radius: 8px; object-fit: cover; background: var(--surface-2); display: block; }
.gr-tarjeta-nom { font-size: var(--fs-card); font-weight: 600; color: var(--ink); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.gr-tarjeta-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.gr-tarjeta-chips > span { font-size: var(--fs-sm); color: var(--dim); background: var(--surface-2); border-radius: 7px; padding: 2px 8px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-tarjeta-nums { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px 10px; }
.gr-tarjeta-nums > div { display: flex; flex-direction: column; min-width: 0; }
.gr-tarjeta-nums span { font-size: var(--fs-sm); color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-tarjeta-nums b { font-size: var(--fs-md); font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }

.gr-mapa { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.gr-mapa-caja { flex: 1; position: relative; }
.gr-mapa-msj { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 10px; color: var(--faint); font-size: var(--fs-sm); text-align: center; padding: 8px; }
.gr-mapa-tip { position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: var(--fs-sm); color: var(--ink); box-shadow: 0 6px 20px rgba(18,21,27,.08); white-space: nowrap; z-index: 1; }
.gr-mapa-chips { display: flex; flex-wrap: wrap; gap: 6px; flex: none; }
.gr-mapa-chips > span { font-size: var(--fs-sm); color: var(--dim); background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 3px 9px; }
.gr-mapa-nota { flex: none; font-size: var(--fs-sm); color: var(--faint); }

@media print {
  .gr-tabla, .gr-barras, .gr-tarjetas { overflow: visible !important; }
}
`;
