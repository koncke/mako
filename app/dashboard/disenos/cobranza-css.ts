// =============================================================================
// cobranza-css — la hoja de estilos del DISEÑO de la hoja Cobranza: la copia de Coffer, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que se vea exactamente igual que la copia». Es docs/diseno/mockups-dashboard/cobranza/cobranza.css
// (escrita desde lo MEDIDO del demo: valores.json, las capturas y el INFORME; nada del código de la tienda) con todo
// adentro de `.cbz` y cada clase con el prefijo `cbz-`, para no tocar nada del resto del Dashboard. La comparación con
// el original, captura contra captura, está en docs/relevo/nube-dashboards.md («Cobranza»).
//
// ⚠️ ESTA HOJA ES SÓLO DE COBRANZA: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta ni la de Closing.
// ⚠️ LOS COLORES CLAROS SON LOS DEL DEMO, EN HEX, A PROPÓSITO: es la copia de una referencia CLARA. Paleta DOBLE (6/11/2026,
//    Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene así en MaKo, y si tiene
//    dark mode, automáticamente pasarse a allí»): claro por defecto y, con data-tema="oscuro" en <html>, la regla que viene
//    justo después de la raíz redefine las MISMAS variables. Sólo CSS: cambia en vivo. El oscuro es nuestro (Coffer tiene uno
//    que no se midió).
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana: el lienzo del Dashboard tiene la barra
//    de la app al lado. El medio (641 a 1040) NO está medido en Coffer (sus capturas son 1440 y 390) y es nuestro.
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.

export const CSS_COBRANZA = `
.cbz{
  container-type:inline-size;container-name:cbz;
  --a-950:#05070b; --a-800:#2a303c; --a-700:#111622; --a-600:#3a4150; --a-400:#9097a5; --a-100:#e6e8ed;
  --page:#f4f5f7; --panel:#eceef2; --card:#fdfdfe; --hair:#e3e6eb; --hair-strong:#cfd4dc;
  --ink:#111622; --muted:#4a5263; --faint:#5c6576;
  --accent-soft:#e6e8ed; --on-accent:#f6f7fd; --ring:#3a4150;
  --info:#2453c7; --info-bg:#e5ecfb; --good:#1b6e44; --good-bg:#e0f1e6;
  --amber:#8f5300; --amber-bg:#fbeed6; --rose:#b02e2b; --rose-bg:#fbe6e4;
  --c-in:#3a4150; --c-out:#c4cad4; --c-net:#111622; --grid:#eaedf1;
  --cat-1:#2a78d6; --cat-2:#eb6834; --cat-3:#1baf7a; --cat-4:#eda100; --cat-5:#8a5cd1; --cat-other:#a3abb8;
  --font:"Manrope",system-ui,-apple-system,"Segoe UI",sans-serif;
  --r-lg:12px; --r-md:10px; --r-sm:8px;
  --shadow-card:0 1px 2px #1018280a;
  --focus:0 0 0 2px #fdfdfe,0 0 0 4px #3a4150;
  /* lo que antes estaba escrito en hex dentro de las reglas */
  --pill:#fdfdfe; --on-rose:#fff8f7; --av-rose:#f4d7e1; --av-rose-t:#602438; --av-teal:#d7edf4; --av-teal-t:#245160;
}
/* En oscuro las superficies SUBEN de luminosidad al elevarse, las líneas son opacas a dos pasos del fondo y el primario
   (que en claro es tinta sobre blanco) pasa a ser blanco sobre oscuro: por eso on-accent se oscurece. */
.cbz:where([data-tema="oscuro"] *){
  --a-800:#ffffff;
  --page:#0d0f14; --panel:#1e232c; --card:#161a21; --hair:#272d38; --hair-strong:#363e4c;
  --ink:#ecedef; --muted:#a9aeb8; --faint:#8e94a1;
  --accent-soft:#252b37; --on-accent:#111622; --ring:#c4cad4;
  --info:#7aa2f0; --info-bg:#16264a; --good:#4cc487; --good-bg:#12301f;
  --amber:#e3a548; --amber-bg:#3a2a0e; --rose:#f08581; --rose-bg:#3d1b1a;
  --c-in:#aeb6c6; --c-out:#6a7488; --c-net:#ecedef; --grid:#262c37;
  --cat-1:#5b9bf0; --cat-2:#f2845a; --cat-3:#2fcf94; --cat-4:#f2b632; --cat-5:#a98af0; --cat-other:#6d7587;
  --shadow-card:0 1px 2px #0008; --focus:0 0 0 2px #161a21,0 0 0 4px #c4cad4;
  --pill:#323a48; --on-rose:#2a0d0c; --av-rose:#4a2230; --av-rose-t:#f4c4d2; --av-teal:#173843; --av-teal-t:#a8dbe9;
}
.cbz{background:var(--page);color:var(--ink);font:400 15px/1.5 var(--font);-webkit-font-smoothing:antialiased;min-height:100%}
.cbz *{box-sizing:border-box}
.cbz :where(h1,h2,p,ul,li,dl,dd){margin:0;padding:0}
.cbz :where(ul){list-style:none}
.cbz :where(button){font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.cbz :where(a){color:inherit;text-decoration:none}
.cbz-i{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.cbz :where(a,button,[tabindex]):focus-visible{box-shadow:var(--focus);border-radius:8px;outline:none}

/* ── La página ─────────────────────────────────────────────────────────────────────────────── */
.cbz-vista{padding:28px 32px 56px}
.cbz-head{display:flex;align-items:flex-end;gap:16px;margin-bottom:22px}
.cbz-hello{font-size:13px;font-weight:600;line-height:19.5px}
.cbz-titulo{margin:0 0 6px;font-size:32px;font-weight:700;line-height:36.8px;letter-spacing:-.8px}
.cbz-titulo .cbz-w{display:inline-block;overflow:hidden;vertical-align:top}
.cbz-titulo .cbz-l{display:inline-block;white-space:pre}
.cbz-sub{color:var(--muted);font-size:15px;line-height:22.5px}
.cbz-acciones{margin-left:auto;display:flex;gap:10px}
.cbz-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:40px;padding:0 17px 0 18px;border-radius:var(--r-sm);
  font-size:14px;font-weight:600;white-space:nowrap;transition:background-color .2s,border-color .2s,color .2s}
.cbz-btn--ghost{padding:0 15px 0 16px;border:1px solid var(--hair);background:var(--card);color:var(--ink)}
.cbz-btn--ghost:hover{border-color:var(--muted)}
.cbz-btn--primary{background:var(--ink);color:var(--on-accent)}
.cbz-btn--primary:hover{background:var(--a-800)}

.cbz-card{background:var(--card);border:1px solid var(--hair);border-radius:var(--r-lg);box-shadow:var(--shadow-card);padding:20px 22px;min-width:0}
.cbz-card__h{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.cbz-card__t{margin:0;font-size:15.5px;font-weight:700;line-height:23.25px;letter-spacing:-.155px}
.cbz-meta{color:var(--faint);font-size:13px;line-height:19.5px;padding-top:2px}
.cbz-link{font-size:14px;font-weight:550;line-height:21px;text-decoration:underline;text-decoration-color:var(--hair-strong);text-underline-offset:3px;transition:color .2s}
.cbz-link:hover{text-decoration-color:currentColor}

.cbz-fila{display:grid;gap:16px;margin-top:16px}
.cbz-fila--top{margin-top:0;grid-template-columns:repeat(2,minmax(0,1fr))}
.cbz-fila--mid,.cbz-fila--bot{grid-template-columns:repeat(3,minmax(0,1fr))}
.cbz-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}

/* Lo que te deben: la cifra, lo vencido con su botón y la barra de la antigüedad */
.cbz-owed{display:flex;flex-direction:column;gap:18px}
.cbz-owed__top{display:flex;justify-content:space-between;gap:16px}
.cbz-lbl{color:var(--muted);font-size:13px;font-weight:600;line-height:19.5px}
.cbz-owed__big{margin-top:6px;font-size:46px;font-weight:700;line-height:52.9px;letter-spacing:-1.38px;font-variant-numeric:tabular-nums}
.cbz-owed__sub{margin-top:2px;color:var(--faint);font-size:13px;line-height:19.5px}
.cbz-owed__late{display:flex;flex-direction:column;align-items:flex-end;text-align:right}
.cbz-owed__late-n{margin-top:8px;color:var(--rose);font-size:26px;font-weight:700;line-height:29.9px;letter-spacing:-.78px;font-variant-numeric:tabular-nums}
.cbz-owed__late-n[data-cero]{color:var(--ink)}
.cbz-btn--rose{margin-top:8px;height:34px;padding:0 14px;gap:8px;border-radius:var(--r-sm);background:var(--rose);color:var(--on-rose);font-size:13px}
.cbz-aging{position:relative;height:14px;margin-top:auto;border-radius:7px;overflow:hidden;background:var(--panel)}
.cbz-aging__seg{position:absolute;inset:0;transform-origin:left center}
.cbz-aging__legend{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}
.cbz-ag__name{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:12.5px;line-height:18.75px}
.cbz-sw{width:10px;height:10px;border-radius:2px;flex:none;display:inline-block}
.cbz-ag__val{font-size:18px;font-weight:700;line-height:23.4px;letter-spacing:-.36px;font-variant-numeric:tabular-nums}
.cbz-ag__n{color:var(--faint);font-size:12px;line-height:18px}

.cbz-kpi{display:flex;flex-direction:column}
.cbz-kpi__val{margin-top:12px;font-size:30px;font-weight:700;line-height:34.5px;letter-spacing:-.9px;font-variant-numeric:tabular-nums}
.cbz-kpi__note{margin-top:auto;padding-top:8px;color:var(--faint);font-size:13px;line-height:19.5px}
.cbz-kpi__note--bad{color:var(--rose)}

/* El flujo: lo que entró arriba de la línea y lo que sigue sin pagar abajo */
.cbz-flow{grid-column:span 2}
.cbz-flow__sub{margin-top:2px;color:var(--faint);font-size:13px;line-height:19.5px}
.cbz-legend{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:10px;color:var(--muted);font-size:13px;line-height:19.5px}
.cbz-legend span{display:inline-flex;align-items:center;gap:7px}
.cbz-seg{position:relative;display:inline-flex;flex:none;padding:3px;border:1px solid var(--hair);border-radius:var(--r-sm);background:var(--panel)}
.cbz-seg__pill{position:absolute;top:3px;left:0;width:100px;height:calc(100% - 6px);border-radius:6px;background:var(--pill);box-shadow:0 1px 2px #10182814;transform-origin:left center}
.cbz-seg__btn{position:relative;z-index:1;height:28px;padding:0 12px;border-radius:6px;color:var(--muted);font-size:13px;font-weight:600;transition:color .2s}
.cbz-seg__btn[aria-pressed=true]{color:var(--ink)}
.cbz-chart{margin-top:9px;min-height:261px}
.cbz-chart svg{display:block;width:100%;height:auto;overflow:visible}
.cbz-chart text{font:500 12px var(--font);fill:var(--faint)}
.cbz-chart .gl{stroke:var(--grid);stroke-width:1}
.cbz-chart .zero{stroke:var(--hair-strong)}
.cbz-chart .b-in{fill:var(--c-in)}
.cbz-chart .b-out{fill:var(--c-out)}

/* A quién perseguir */
.cbz-due-list{margin:3px 0 0}
.cbz-due{display:grid;grid-template-columns:34px minmax(0,1fr) auto;grid-template-areas:"av main amt" "av main act";column-gap:12px;row-gap:4px;padding:12px 0}
.cbz-due + .cbz-due{border-top:1px solid var(--hair)}
.cbz-due .cbz-avatar{grid-area:av;align-self:center}
.cbz-due__main{grid-area:main;align-self:center;min-width:0;text-align:left}
.cbz-due__main b{display:block;font-size:15px;font-weight:600;line-height:20.25px;transition:color .2s;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cbz-due__main small{display:block;color:var(--faint);font-size:13px;line-height:17.55px}
.cbz-due__main small em{font-style:normal;color:var(--rose)}
.cbz-due__main small em.cbz-a-tiempo{color:var(--faint)}
.cbz-due__amt{grid-area:amt;justify-self:end;font-size:15px;font-weight:700;line-height:22.5px;font-variant-numeric:tabular-nums}
.cbz-btn--soft{grid-area:act;justify-self:end;height:34px;padding:0 13px;gap:8px;border-radius:var(--r-sm);background:var(--accent-soft);color:var(--ink);font-size:13px}
.cbz-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;flex:none;font-size:12px;font-weight:700;letter-spacing:.24px}
.cbz-av-rose{background:var(--av-rose);color:var(--av-rose-t)}
.cbz-av-teal{background:var(--av-teal);color:var(--av-teal-t)}

/* Lo último que entró */
.cbz-feed{margin:22px 0 10px;display:flex;flex-direction:column;gap:18px}
.cbz-feed li{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:12px;align-items:center}
.cbz-feed__ic{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--good-bg);color:var(--good)}
.cbz-feed__ic .cbz-i{width:14px;height:14px}
.cbz-feed__text{font-size:14px;line-height:18.9px;text-align:left;min-width:0;transition:color .2s}
.cbz-feed__text small{display:block;color:var(--faint);font-size:12.5px;line-height:16.875px}
.cbz-feed__amt{font-size:14px;font-weight:700;line-height:21px;font-variant-numeric:tabular-nums;color:var(--good)}

/* Los que más pagaron */
.cbz-hbars{margin:14px 0 0;display:flex;flex-direction:column;gap:13px}
.cbz-hbar__row{display:flex;justify-content:space-between;gap:12px;font-size:14px;font-weight:500;line-height:21px;width:100%;text-align:left}
.cbz-hbar__row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.cbz-hbar__row b{font-weight:700;font-variant-numeric:tabular-nums}
.cbz-hbar__track{height:8px;margin-top:5px;border-radius:4px;background:var(--panel);overflow:hidden}
.cbz-hbar__fill{height:100%;border-radius:4px;background:var(--ink);transform-origin:left center}

/* Pendiente por funnel: el anillo y su leyenda */
.cbz-spend{display:grid;grid-template-columns:160px minmax(0,1fr);gap:20px;align-items:start;margin-top:15px}
.cbz-donut{position:relative;width:160px;height:160px}
.cbz-donut svg{width:100%;height:100%;display:block}
.cbz-donut .d-track{fill:none;stroke:var(--panel);stroke-width:18}
.cbz-donut .d-arc{fill:none;stroke-width:18}
.cbz-donut__centre{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
.cbz-donut__centre b{font-size:20px;font-weight:700;line-height:20px;letter-spacing:-.4px}
.cbz-donut__centre small{margin-top:2px;color:var(--faint);font-size:12px;line-height:13.8px}
.cbz-spend__list{margin:-1.5px 0 0;display:flex;flex-direction:column;gap:7.95px}
.cbz-spend__list li{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center;font-size:13.5px;line-height:20.25px}
.cbz-spend__list li span{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cbz-spend__list b{font-weight:700;font-variant-numeric:tabular-nums}

/* ── Lo que suma MaKo en el Dashboard: un bloque sin datos lo dice, sin inventar un cero; las filas que se tocan ── */
.cbz-vacio{flex:1;display:grid;place-items:center;text-align:center;font-size:13px;color:var(--faint);padding:18px 6px;line-height:18.85px}
.cbz-clic{cursor:pointer;border-radius:8px;transition:background-color .2s}
.cbz-clic:hover{background:var(--panel)}

/* ── El medio (641 a 1040 de lienzo): NO está medido en Coffer. Con la barra de la app y la lista de hojas, una ventana
   de 1024 deja ~780 de lienzo, y ahí lo de arriba no entra en dos columnas: la deuda a lo ancho, los cuatro números en
   una fila, el flujo a lo ancho y lo de abajo en dos (el anillo a lo ancho). ─────────────────────────────────────────── */
@container cbz (min-width:641px) and (max-width:1040px){
  .cbz-fila--top{grid-template-columns:minmax(0,1fr)}
  .cbz-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
  .cbz-kpi__val{font-size:24px;line-height:27.6px;letter-spacing:-.72px}
  .cbz-fila--mid{grid-template-columns:minmax(0,1fr)}
  .cbz-flow{grid-column:auto}
  .cbz-fila--bot{grid-template-columns:repeat(2,minmax(0,1fr))}
  .cbz-fila--bot > :last-child{grid-column:1/-1}
}

/* ── El teléfono (medido a 390): una columna, padding 16, tarjetas con 16 ─────────────────── */
@container cbz (max-width:640px){
  .cbz-vista{padding:20px 16px 96px}
  .cbz-head{flex-direction:column;align-items:stretch;gap:16px;margin-bottom:22px}
  .cbz-titulo{font-size:26px;line-height:29.9px;letter-spacing:-.65px;margin:3px 0 11px}
  .cbz-acciones{margin-left:0;display:flex;gap:10px}
  .cbz-acciones .cbz-btn{flex:1 1 auto}
  .cbz-fila--top,.cbz-fila--mid,.cbz-fila--bot{grid-template-columns:minmax(0,1fr)}
  .cbz-flow{grid-column:auto}
  .cbz-card{padding:16px}
  .cbz-owed__big{font-size:36px;line-height:41.4px;letter-spacing:-1.08px}
  .cbz-aging__legend{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .cbz-kpi__val{font-size:22px;line-height:25.3px;letter-spacing:-.66px}
  .cbz-spend{grid-template-columns:minmax(0,1fr);justify-items:center;gap:21px}
  .cbz-donut{margin:0}
  .cbz-spend__list{width:100%;margin:0}
}

/* ── El movimiento: el estado de PARTIDA de lo que entra (lo pone HojaCobranza) ─────────── */
.cbz[data-antes] [data-card]{opacity:0}
@media (prefers-reduced-motion:reduce){ .cbz[data-antes] [data-card]{opacity:1} .cbz *{transition:none !important} }
`;
