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
/* La cabecera en dos renglones como mucho; abajo, pegada a la línea, para que las de un renglón y las de dos lean parejo. */
.gr-tabla th { vertical-align: bottom; }
.gr-tabla th .gr-th { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; white-space: normal; overflow: hidden; overflow-wrap: anywhere; line-height: 1.25; }
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
/* Angosta (el celular): menos aire, así entra una métrica más al lado del nombre (Tabla.tsx achica las columnas). */
@container (max-width: 480px) {
  .gr-tabla th { padding: 8px 8px; }
  .gr-tabla td { padding: 10px 8px; }
  .gr-tabla .gr-celda-barra { gap: 8px; }
  .gr-tabla .gr-pista { min-width: 28px; }
}

.gr-barras-caja { flex: 1; min-height: 0; display: flex; flex-direction: column; container-type: inline-size; }
/* Centrado con márgenes automáticos y no con justify-content: con más filas de las que entran, el centrado de flex deja
   las de arriba fuera del scroll. */
.gr-barras { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 4px; }
.gr-barras > :first-child { margin-top: auto; }
.gr-barras > :last-child { margin-bottom: auto; }
.gr-barras-fila { display: grid; grid-template-columns: minmax(0, 34%) minmax(0, 1fr); align-items: center; gap: 14px; padding: 6px 4px; border-radius: 10px; }
/* Las filas se REPARTEN el alto de la tarjeta, como las bandas de un gráfico de barras de Looker Studio: centradas,
   cinco barras en una tarjeta alta quedaban apretadas en el medio con media tarjeta en blanco arriba y abajo (capturas
   del arnés, 15/10/2026: «Leads por etapa», «Qué botón tocan»). Con tope, para que dos filas no queden lejísimos. Con más
   filas de las que entran no crecen (su mínimo es lo que dibujan) y el scroll sigue igual; en la pila del celular la
   tarjeta mide lo que dibuja y no hay alto que repartir. */
.gr-barras > .gr-barras-fila { flex: 1 1 auto; max-height: 72px; }
.gr-barras-fila[tabindex] { cursor: pointer; }
.gr-barras-fila[tabindex]:hover, .gr-barras-fila[tabindex]:focus-visible { background: var(--velo-hover); outline: none; }
.gr-barras-rot { font-size: var(--fs-card); color: var(--ink); line-height: 1.3; overflow: hidden; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.gr-barras-par { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.gr-barras-linea { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; min-width: 0; }
.gr-barras-pista { position: relative; height: 26px; border-radius: 8px; overflow: hidden; }
.gr-barras-pista--doble { height: 16px; }
.gr-barras-pista > span { position: absolute; inset: 0 auto 0 0; border-radius: 8px; }
/* Pocas filas (hasta siete): la barra engorda (punto 13 de la v5: «gordos, minimalistas»). */
.gr-barras:not(:has(> .gr-barras-fila:nth-child(8))) .gr-barras-pista { height: 32px; border-radius: 10px; }
.gr-barras:not(:has(> .gr-barras-fila:nth-child(8))) .gr-barras-pista > span { border-radius: 10px; }
.gr-barras:not(:has(> .gr-barras-fila:nth-child(8))) .gr-barras-pista--doble { height: 18px; }
.gr-barras-val { font-size: var(--fs-card); font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.gr-barras-val--chico { font-size: var(--fs-sm); color: var(--dim); }
.gr-barras-leyenda { display: flex; gap: 14px; flex-wrap: wrap; font-size: var(--fs-md); color: var(--ink); padding: 0 4px 6px; }
/* Angosta (el celular): el rótulo ARRIBA de su barra, entero en un renglón; al lado, la barra no tenía lugar y el nombre
   quedaba en «Campaña de …». */
@container (max-width: 440px) {
  .gr-barras-fila { grid-template-columns: minmax(0, 1fr); gap: 4px; padding: 4px 2px; }
  .gr-barras-rot { -webkit-line-clamp: 1; }
  .gr-barras-pista, .gr-barras:not(:has(> .gr-barras-fila:nth-child(8))) .gr-barras-pista { height: 24px; border-radius: 8px; }
  .gr-barras-pista > span, .gr-barras:not(:has(> .gr-barras-fila:nth-child(8))) .gr-barras-pista > span { border-radius: 8px; }
  .gr-barras-pista--doble, .gr-barras:not(:has(> .gr-barras-fila:nth-child(8))) .gr-barras-pista--doble { height: 14px; }
}

/* El container va en el envoltorio: un @container no estila al mismo elemento que lo declara (con el container-type en
   .gr-paneles, la regla de una columna no aplicaba nunca y el celular quedaba en dos). */
.gr-paneles-caja { flex: 1; min-height: 0; display: flex; container-type: inline-size; }
.gr-paneles { flex: 1; min-width: 0; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 14px 22px; }
.gr-paneles > .gr-panel:last-child:nth-child(odd) { grid-column: 1 / -1; }
.gr-paneles--uno { grid-template-columns: minmax(0, 1fr); }
@container (max-width: 560px) { .gr-paneles { grid-template-columns: minmax(0, 1fr); } }
.gr-panel { display: flex; flex-direction: column; min-height: 0; min-width: 0; gap: 2px; }
.gr-panel-cab { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: var(--fs-md); font-weight: 600; color: var(--dim); }
.gr-panel-cab > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-panel-num { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.gr-panel-num > b { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.1; }

/* Centrado con márgenes automáticos: si no entra (el celular con 3 filas de alto), lo que sobra se corta ABAJO; con
   justify-content: center subía la barra encima del título de la tarjeta. */
.gr-prop { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 14px; overflow: hidden; }
.gr-prop > :first-child { margin-top: auto; }
.gr-prop > :last-child { margin-bottom: auto; }
.gr-prop-barra { flex: none; display: flex; height: 28px; border-radius: 8px; overflow: hidden; background: var(--surface-2); gap: 2px; }
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

/* El container va en el envoltorio: con el container-type en .gr-tramos, la regla de renglones no le llegaba a él mismo
   y en angosto los tramos quedaban en fila con el adentro de un renglón. */
.gr-tramos-caja { flex: 1; min-height: 0; display: flex; container-type: inline-size; overflow: hidden; }
.gr-tramos { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.gr-tramo { display: flex; flex-direction: column; gap: 10px; min-width: 72px; border: none; background: none; padding: 8px 6px; border-radius: 10px; text-align: left; color: inherit; font: inherit; cursor: default; }
.gr-tramo[data-abre] { cursor: pointer; }
.gr-tramo[data-abre]:hover, .gr-tramo[data-abre]:focus-visible { background: var(--velo-hover); outline: none; }
.gr-tramo-val { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.1; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.gr-tramo-pista { height: 18px; border-radius: 9px; }
.gr-tramo-nom { font-size: var(--fs-md); color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-tramo--largo .gr-tramo-val, .gr-tramo--largo .gr-tramo-nom { color: var(--bad); font-weight: 600; }
@container (max-width: 520px) {
  .gr-tramos { flex-direction: column; align-items: stretch; gap: 2px; overflow-y: auto; }
  .gr-tramos > :first-child { margin-top: auto; }
  .gr-tramos > :last-child { margin-bottom: auto; }
  .gr-tramo { flex: none !important; display: grid; grid-template-columns: minmax(0, 40%) minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 6px 4px; }
  .gr-tramo .gr-tramo-nom { order: 1; }
  .gr-tramo .gr-tramo-pista { order: 2; height: 14px; border-radius: 7px; justify-self: start; width: calc(var(--peso, 1) * 100%); }
  .gr-tramo .gr-tramo-val { order: 3; font-size: var(--fs-card); }
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
.gr-tarjeta-prin { display: grid; grid-template-columns: auto minmax(40px, 1fr); align-items: center; column-gap: 12px; row-gap: 2px; min-width: 0; }
.gr-tarjeta-prin > .gr-tarjeta-rot { grid-column: 1 / -1; font-size: var(--fs-sm); color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-tarjeta-val { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.15; color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
.gr-tarjeta-nums { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 6px 10px; }
.gr-tarjeta-nums > div { display: flex; flex-direction: column; min-width: 0; }
.gr-tarjeta-nums span { font-size: var(--fs-sm); color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-tarjeta-nums b { font-size: var(--fs-md); font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }

.gr-disp-y { flex: none; font-size: var(--fs-sm); color: var(--dim); padding: 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-disp-x { flex: none; display: flex; gap: 12px; font-size: var(--fs-sm); color: var(--dim); padding: 0 4px; min-width: 0; }
.gr-disp-x > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-disp-x > span:last-child { margin-left: auto; }

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
