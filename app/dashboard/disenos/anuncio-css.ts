// =============================================================================
// anuncio-css — la hoja de estilos de la hoja «Anuncio ganador» con su diseño propio (la copia de Prism)
// =============================================================================
// GENERADA por scratchpad/prs/armar-prs.py desde la hoja de la copia (docs/diseno/mockups-dashboard/anuncio-prism/prism.css): todo
// adentro de `.prs`, cada clase con el prefijo `prs-`, sin el armazón de Prism (el fondo fijo, el rango, el reloj, el avatar y el logo,
// que es su dibujo) y con @container en lugar de @media. Lo de la adaptación va al final (los pasos de 1320 y 1000 px, la cabecera de
// la hoja, los vacíos y las filas que se tocan). Se escribió desde lo MEDIDO del demo: nada del código de la tienda.
// Paleta doble (6/11/2026, Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene así en MaKo, y si
// tiene dark mode, automáticamente pasarse a allí»): Prism nació oscuro (marino con teal); ahora el claro es el de partida (tarjetas blancas,
// tinta marina) y el marino original queda bajo [data-tema="oscuro"] de <html>, sólo con variables.
// ⚠️ En un template literal no va ningún backtick (ni en un comentario) ni un «dólar con llave».
// =============================================================================

export const CSS_ANUNCIO = `
@font-face { font-family: 'Prism Geist'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geist/v4/gyByhwUxId8gMEwcGFWNOITd.woff2) format('woff2'); }
@font-face { font-family: 'Prism Geist Mono'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(https://fonts.gstatic.com/s/geistmono/v4/or3nQ6H-1_WfwkMZI_qYFrcdmhHkjko.woff2) format('woff2'); }
.prs {
  container-type: inline-size; container-name: prs;
  --font: 'Prism Geist', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'Prism Geist Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --page: #edf1f8;
  --page-hi: #dce7fb;
  --card: #ffffff;
  --card-top: #f8faff;
  --well: #eaeff7;
  --hair: #dbe2ee;
  --hair-2: #c4cee1;
  --grid: #e1e7f1;
  --axis: #b3bfd5;
  --dots: #1b3a7a14;
  --ink: #0b1a33;
  --dim: #44536f;
  --faint: #5a6987;
  --spark: #44536f8c;
  --s1: #0b8f86;
  --s2: #d02a9a;
  --s3: #6f8f06;
  --s4: #6a45e0;
  --s5: #b78900;
  --s6: #2a61e0;
  --s-muted: #7385a4;
  --good: #12794a;
  --warn: #9a5b00;
  --crit: #c4243a;
  --accent: #0b8f86;
  --on-accent: #04121a;
  --hud: color-mix(in oklab, #0b8f86 60%, transparent);
  --glow: color-mix(in oklab, #0b8f86 12%, transparent);
  --shadow: 0 18px 40px -22px #1b2a4a59;
  --card-edge: #ffffff;
  --btn-bg: #ffffffcc;
  --tag-bg: #ffffffee;
  --hover: #1b3a7a0f;
  --bar-a: #9fb0cc;
  --bar-b: #7d90b2;
  --s3-deep: #4f6a04;
  --s5-deep: #8a6700;
  --s5-glow: #b7890033;
  --ticker-bg: #eef2f9;
  --ease: cubic-bezier(.22, 1, .36, 1);
  --r: 14px;
  --gap: 12px;
  position: relative; isolation: isolate; overflow: clip; color: var(--ink); font: 400 13px/18.2px var(--font); -webkit-font-smoothing: antialiased;
  background: radial-gradient(1200px 600px at 70% -10%, var(--page-hi), transparent 60%), radial-gradient(circle, var(--dots) 1px, transparent 1.4px) 0 0 / 22px 22px, var(--page);
}
/* Oscuro: el marino original de Prism (tarjetas azul noche, series neón). Sólo cambian variables. */
.prs:where([data-tema="oscuro"] *) {
  --page: #050a14;
  --page-hi: #0d1b36;
  --card: #0b1424;
  --card-top: #0f1b30;
  --well: #142139;
  --hair: #7aa6ff1f;
  --hair-2: #7aa6ff3d;
  --grid: #96b9ff14;
  --axis: #96b9ff42;
  --dots: #96b9ff12;
  --ink: #eef4ff;
  --dim: #a9b7cf;
  --faint: #8190ab;
  --spark: #a9b7cf8c;
  --s1: #2ee6d6;
  --s2: #ff5cc8;
  --s3: #c6f432;
  --s4: #8f6bff;
  --s5: #ffe14d;
  --s6: #3d7bff;
  --s-muted: #5d7299;
  --good: #3ddc84;
  --warn: #ffb020;
  --crit: #ff5d6c;
  --accent: #2ee6d6;
  --on-accent: #04121a;
  --hud: color-mix(in oklab, #2ee6d6 60%, transparent);
  --glow: color-mix(in oklab, #2ee6d6 12%, transparent);
  --shadow: 0 18px 40px -18px #000000e6;
  --card-edge: #ffffff0a;
  --btn-bg: #0b142499;
  --tag-bg: #071222e6;
  --hover: #7aa6ff14;
  --bar-a: #56688a;
  --bar-b: #34425e;
  --s3-deep: #7d9a1c;
  --s5-deep: #b89a1f;
  --s5-glow: #ffe14d33;
  --ticker-bg: #142139b3;
}
.prs *, .prs *::before, .prs *::after { box-sizing: border-box; }
.prs button { font: inherit; color: inherit; cursor: pointer; }
.prs a { color: inherit; text-decoration: none; }
.prs h1, .prs h2, .prs h3, .prs p, .prs ul { margin: 0; }
.prs ul { padding: 0; list-style: none; }
.prs svg.prs-i { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.prs :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 6px; }

/* ── la copia ──────────────────────────────────────────────────────────────────────────────── */
.prs * { box-sizing: border-box; }
.prs .prs-mono { font-family: var(--mono); }
.prs .prs-top { height: 62px; display: flex; align-items: center; gap: 14px; padding: 0 18px; border-bottom: 1px solid var(--hair); }
.prs .prs-brand { display: inline-flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; line-height: 19.6px; letter-spacing: 1.96px; }
.prs .prs-org { display: inline-flex; align-items: center; gap: 8px; padding-left: 16px; border-left: 1px solid var(--hair); font-size: 12.5px; line-height: 17.5px; color: var(--dim); }
.prs .prs-env { padding: 3px 7px; border: 1px solid var(--hair-2); border-radius: 6px; font: 500 10.5px/10.5px var(--mono); letter-spacing: .63px; text-transform: uppercase; color: var(--dim); }
.prs .prs-btn { height: 34px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; border: 1px solid var(--hair-2); border-radius: 10px; background: var(--btn-bg); font-size: 12.5px; font-weight: 600; line-height: 17.5px; transition: border-color .2s, background-color .2s; }
.prs .prs-icon-btn { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid var(--hair-2); border-radius: 10px; background: var(--btn-bg); transition: border-color .2s, background-color .2s; }
.prs .prs-btn:hover, .prs .prs-icon-btn:hover { border-color: color-mix(in oklab, var(--accent) 60%, transparent); }
.prs .prs-top__r { display: flex; align-items: center; gap: 10px; }
.prs .prs-view { padding: 13px 18px 18px; display: grid; gap: var(--gap); }
.prs .prs-row { display: grid; gap: var(--gap); }
.prs .prs-row--1 { grid-template-columns: 696fr 342fr 342fr; }
.prs .prs-row--2, .prs .prs-row--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.prs .prs-row--4 { grid-template-columns: 814fr 578fr; }
.prs .prs-row--1 > .prs-card { height: 248px; }
.prs .prs-row--2 > .prs-card { height: 206px; }
.prs .prs-row--3 > .prs-card { height: 179px; }
.prs .prs-row--4 > .prs-card { height: 137px; }
.prs .prs-card { position: relative; min-width: 0; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border: 1px solid var(--hair); border-radius: var(--r); background: linear-gradient(180deg, var(--card-top), var(--card)); box-shadow: 0 1px 0 var(--card-edge) inset, var(--shadow); overflow: hidden; }
.prs .prs-hud { position: absolute; inset: 6px; pointer-events: none; opacity: .55; }
.prs .prs-hud i { position: absolute; width: 10px; height: 10px; border: 0 solid var(--hud); }
.prs .prs-hud i:nth-child(1) { left: 0; top: 0; border-left-width: 1.5px; border-top-width: 1.5px; }
.prs .prs-hud i:nth-child(2) { right: 0; top: 0; border-right-width: 1.5px; border-top-width: 1.5px; }
.prs .prs-hud i:nth-child(3) { left: 0; bottom: 0; border-left-width: 1.5px; border-bottom-width: 1.5px; }
.prs .prs-hud i:nth-child(4) { right: 0; bottom: 0; border-right-width: 1.5px; border-bottom-width: 1.5px; }
.prs .prs-card__h { display: flex; align-items: flex-start; gap: 12px; }
.prs .prs-card__t { font-size: 13.5px; font-weight: 600; line-height: 18.9px; letter-spacing: .135px; }
.prs .prs-card__s { margin-top: 2px; font: 500 11px/14.3px var(--mono); letter-spacing: .22px; color: var(--faint); }
.prs .prs-card__r { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.prs .prs-leg { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; line-height: 16.1px; color: var(--dim); }
.prs .prs-leg i { width: 9px; height: 9px; border-radius: 2px; }
.prs .prs-leg i.prs-ln { width: 14px; height: 2px; border-radius: 1px; }
.prs .prs-leg b { font: 600 11.5px/11.5px var(--mono); color: var(--ink); }
.prs .prs-s1 { background: var(--s1); }
.prs .prs-s2 { background: var(--s2); }
.prs .prs-s3 { background: var(--s3); }
.prs .prs-s4 { background: var(--s4); }
.prs .prs-s5 { background: var(--s5); }
.prs .prs-sm { background: var(--s-muted); }
.prs .prs-up { color: var(--good); }
.prs .prs-down { color: var(--crit); }
.prs .prs-rev__big { display: flex; align-items: baseline; gap: 14px; margin-top: -4px; }
.prs .prs-rev__big b { font-size: 44.64px; font-weight: 600; line-height: 44.64px; letter-spacing: -.8928px; }
.prs .prs-delta { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 900; line-height: 16.8px; }
.prs .prs-delta svg { width: 12px; height: 12px; stroke-width: 2.2; }
.prs .prs-vs { font-size: 12px; font-weight: 500; line-height: 16.8px; color: var(--faint); }
.prs .prs-plot { position: relative; flex: 1; min-height: 0; margin-top: 2px; }
.prs .prs-plot svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.prs .prs-ax { font: 500 10.5px/10.5px var(--mono); fill: var(--faint); }
.prs .prs-gridln { stroke: var(--grid); stroke-width: 1; }
.prs .prs-tag { position: absolute; padding: 4px 6px; border: 1px solid color-mix(in oklab, var(--accent) 70%, transparent); border-radius: 6px; background: var(--tag-bg); font: 600 11px/11px var(--mono); color: var(--ink); transform: translate(-100%, -130%); white-space: nowrap; }
.prs .prs-donut { flex: 1; min-height: 0; display: grid; grid-template-columns: 144px minmax(0, 1fr); align-items: center; gap: 22px; }
.prs .prs-donut__g { position: relative; width: 144px; height: 144px; }
.prs .prs-donut__g svg { width: 100%; height: 100%; overflow: visible; transform: rotate(-90deg); }
.prs .prs-donut__c { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.prs .prs-donut__c b { font-size: 19px; font-weight: 600; line-height: 26.6px; letter-spacing: -.19px; }
.prs .prs-donut__c span { font: 500 10.5px/12.6px var(--mono); color: var(--faint); }
.prs .prs-dlist { display: grid; gap: 7px; }
.prs .prs-dlist li { display: grid; grid-template-columns: 9px minmax(0, 1fr) auto; align-items: center; gap: 10px; font-size: 12px; line-height: 16.8px; color: var(--dim); }
.prs .prs-dlist--d li { grid-template-columns: 9px minmax(0, 1fr) auto 44px; }
.prs .prs-dlist li i { width: 9px; height: 9px; border-radius: 2px; }
.prs .prs-dlist li b { font: 600 11.5px/11.5px var(--mono); color: var(--ink); text-align: right; }
.prs .prs-dlist li em { font: 600 10.5px/10.5px var(--mono); font-style: normal; text-align: right; }
.prs .prs-hb__tgt { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; line-height: 16.8px; color: var(--dim); }
.prs .prs-hb__tgt::before { content: ''; width: 2px; height: 12px; border-radius: 1px; background: var(--ink); }
.prs .prs-hb { display: grid; gap: 7.3px; margin-top: 4px; }
.prs .prs-hb li { display: grid; grid-template-columns: 122px minmax(0, 1fr) 46px; align-items: center; gap: 0; font-size: 12px; line-height: 15px; color: var(--ink); }
.prs .prs-hb__track { position: relative; height: 10px; margin-right: 12px; border-radius: 3px; background: var(--well); }
.prs .prs-hb__fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; transform-origin: 0 50%; }
.prs .prs-hb__fill.prs-s1 { background: linear-gradient(90deg, color-mix(in oklab, var(--s1) 55%, transparent), var(--s1)); }
.prs .prs-hb__fill.prs-sm { background: linear-gradient(90deg, color-mix(in srgb, var(--s-muted) 60%, transparent), var(--s-muted)); }
.prs .prs-hb__target { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--ink); }
.prs .prs-hb__val { font: 600 12px/12px var(--mono); text-align: right; }
.prs .prs-kpis { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.prs .prs-kpi { position: relative; display: flex; flex-direction: column; padding: 11px 12px 8px; border: 1px solid var(--hair); border-radius: 10px; background: var(--well); overflow: hidden; }
.prs .prs-kpi__l { font: 500 11px/13.2px var(--mono); letter-spacing: .22px; color: var(--faint); }
.prs .prs-kpi__n { margin-top: 4px; font-size: 24.48px; font-weight: 600; line-height: 26.928px; letter-spacing: -.4896px; }
.prs .prs-kpi__d { margin-top: 4px; display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 900; line-height: 16.1px; }
.prs .prs-kpi__d svg { width: 11px; height: 11px; stroke-width: 2.4; }
.prs .prs-kpi__sp { position: relative; flex: 1; min-height: 30px; margin-top: 6px; }
.prs .prs-kpi__sp svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.prs .prs-badge { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border: 1px solid color-mix(in oklab, var(--good) 60%, transparent); border-radius: 999px; background: color-mix(in srgb, var(--good) 9%, transparent); font-size: 11.5px; font-weight: 600; line-height: 16.1px; color: var(--good); }
.prs .prs-badge svg { width: 14px; height: 14px; }
.prs .prs-health { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 184px; gap: 12px; align-items: center; }
.prs .prs-gauge { position: relative; width: 180px; height: 140px; margin: -6px auto 0; }
.prs .prs-gauge svg { width: 100%; height: 100%; overflow: visible; }
.prs .prs-gauge__c { position: absolute; left: 0; right: 0; bottom: 6px; display: grid; justify-items: center; }
.prs .prs-gauge__c b { font-size: 15px; font-weight: 600; line-height: 21px; letter-spacing: -.15px; }
.prs .prs-gauge__c span { font: 500 9.5px/9.5px var(--mono); color: var(--faint); }
.prs .prs-gauge__tk { font: 500 9.5px/9.5px var(--mono); fill: var(--dim); }
.prs .prs-hstats { display: grid; gap: 7px; padding-left: 12px; border-left: 1px solid var(--hair-2); }
.prs .prs-hstats span { display: block; font: 500 11px/13.2px var(--mono); letter-spacing: .22px; color: var(--faint); }
.prs .prs-hstats b { display: block; margin-top: 3px; font-size: 15px; font-weight: 600; line-height: 21px; letter-spacing: -.15px; }
.prs .prs-vb { position: relative; flex: 1; min-height: 0; }
.prs .prs-vb svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.prs .prs-vb__ann { position: absolute; font-size: 11px; font-weight: 600; line-height: 11px; color: var(--ink); white-space: nowrap; }
.prs .prs-sg__big { display: flex; align-items: baseline; gap: 22px; margin-top: -2px; }
.prs .prs-sg__big span { display: inline-flex; align-items: baseline; gap: 8px; }
.prs .prs-sg__big b { font-size: 22px; font-weight: 600; line-height: 30.8px; letter-spacing: -.44px; }
.prs .prs-sg__big em { font: 500 11px/11px var(--mono); font-style: normal; color: var(--faint); }
.prs .prs-cust { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); align-items: end; gap: 22px; padding: 0 12px; }
.prs .prs-cust li { display: grid; justify-items: center; gap: 6px; }
.prs .prs-cust li .prs-cust__l { margin-top: -6px; }
.prs .prs-cust li > b { font-size: 11px; font-weight: 600; line-height: 11px; }
.prs .prs-cust__bar { width: 24px; border-radius: 4px 4px 0 0; background: linear-gradient(180deg, var(--bar-a), var(--bar-b)); transform-origin: 50% 100%; }
.prs .prs-cust li.prs-is-now .prs-cust__bar { background: linear-gradient(180deg, var(--s5), var(--s5-deep)); box-shadow: 0 0 16px var(--s5-glow); }
.prs .prs-cust__l { width: 100%; padding-top: 8px; border-top: 1px solid var(--axis); text-align: center; font: 500 10.5px/10.5px var(--mono); color: var(--dim); }
.prs .prs-cust__d { font: 500 10px/10px var(--mono); color: var(--faint); }
.prs .prs-lat__leg b { font: 700 11.5px/11.5px var(--mono); color: var(--ink); }
.prs .prs-slo { font: 500 10px/10px var(--mono); fill: var(--faint); }
.prs .prs-c-dock { gap: 6px; }
.prs .prs-ticker { position: relative; flex: none; height: 30px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border: 1px solid var(--hair-2); border-radius: 8px; background: var(--ticker-bg); overflow: hidden; }
.prs .prs-ticker svg { color: var(--accent); }
.prs .prs-ticker__k { font: 500 10.5px/10.5px var(--mono); color: var(--faint); }
.prs .prs-ticker__v { display: inline-flex; align-items: baseline; gap: 8px; font-size: 12px; line-height: 16.8px; color: var(--dim); }
.prs .prs-ticker__v b { font: 600 12.5px/12.5px var(--mono); color: var(--ink); }
.prs .prs-dock { flex: none; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); margin-top: 2px; }
.prs .prs-dock__btn { display: grid; justify-items: center; gap: 6px; padding: 0; border: 0; background: none; font: 500 10.5px/10.5px var(--mono); color: var(--faint); }
.prs .prs-dock__ring { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid var(--hair-2); border-radius: 50%; background: var(--well); color: var(--ink); transition: border-color .2s, background-color .2s; }
.prs .prs-dock__btn.prs-is-on .prs-dock__ring { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 16px var(--glow); }
.prs .prs-dock__btn:hover .prs-dock__ring { border-color: color-mix(in oklab, var(--accent) 70%, transparent); background: color-mix(in oklab, var(--accent) 12%, var(--well)); }
.prs .prs-ticker__v { position: relative; flex: 1; align-self: stretch; overflow: hidden; }
.prs .prs-ticker__v > span { position: absolute; inset: 0; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; }

@container prs (max-width: 760px) {
  .prs .prs-top { height: auto; flex-wrap: wrap; gap: 9px 10px; padding: 12px 12px 9px; }
  .prs .prs-org { display: none; }
  .prs .prs-top .prs-btn { width: 34px; padding: 0; justify-content: center; }
  .prs .prs-top .prs-btn span { display: none; }
  .prs .prs-card { padding: 13px 14px; }
  .prs .prs-kpi { padding: 9px 11px; }
  .prs .prs-top__r { margin-left: auto; display: flex; gap: 8px; }
  .prs .prs-top__r { display: flex; align-items: center; gap: 10px; }
  .prs .prs-view { padding: 12px; }
  .prs .prs-row--1, .prs .prs-row--2, .prs .prs-row--3, .prs .prs-row--4 { grid-template-columns: minmax(0, 1fr); }
  .prs .prs-row--1 > .prs-card, .prs .prs-row--2 > .prs-card, .prs .prs-row--3 > .prs-card, .prs .prs-row--4 > .prs-card { height: auto; }
  .prs .prs-c-rev { height: 330px !important; }
  .prs .prs-c-rev .prs-card__h { flex-wrap: wrap; }
  .prs .prs-c-rev .prs-card__r { order: 3; flex: 1 0 100%; margin: 0 0 -6px; }
  .prs .prs-rev__big b { font-size: 34px; line-height: 34px; letter-spacing: -.68px; }
  .prs .prs-c-rev .prs-rev__big { order: 4; }
  .prs .prs-c-rev .prs-plot { order: 5; }
  .prs .prs-donut { grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 24px; padding: 6px 0 0; }
  .prs .prs-donut__g { width: 180px; height: 180px; }
  .prs .prs-donut__c b { font-size: 19px; }
  .prs .prs-dlist { width: 100%; }
  .prs .prs-kpis { grid-template-columns: minmax(0, 1fr); }
  .prs .prs-kpi { height: 98px; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto auto 1fr; gap: 3px 10px; }
  .prs .prs-kpi__l { grid-column: 1; grid-row: 1; }
  .prs .prs-kpi__n { grid-column: 1; grid-row: 2; margin: 0; font-size: 20px; line-height: 22px; letter-spacing: -.4px; }
  .prs .prs-kpi__d { grid-column: 2; grid-row: 1 / 3; align-self: start; margin: 0; }
  .prs .prs-kpi__sp { grid-column: 1 / -1; grid-row: 3; min-height: 0; margin: 2px 0 0; }
  .prs .prs-hb { gap: 0; margin-top: 2px; }
  .prs .prs-hb li { grid-template-columns: minmax(0, 1fr) auto; row-gap: 4px; }
  .prs .prs-hb__track { grid-column: 1 / -1; grid-row: 2; margin: 0; }
  .prs .prs-hb__val { grid-column: 2; grid-row: 1; }
  .prs .prs-health { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .prs .prs-hstats { grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 12px 0 0; border-left: 0; border-top: 1px solid var(--hair-2); }
  .prs .prs-vb { min-height: 150px; }
  .prs .prs-cust { min-height: 150px; gap: 10px; padding: 0; }
  .prs .prs-c-lat .prs-card__h { flex-wrap: wrap; }
  .prs .prs-c-lat .prs-card__r { flex: 1 0 100%; margin: 0; gap: 12px; flex-wrap: wrap; }
  .prs .prs-c-lat .prs-vb { min-height: 110px; }
  .prs .prs-dock { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 12px; }
}

/* ── lo de la adaptación (DESPUÉS de los @container de la copia: los pisa en el mismo ancho) ──────────── */
.prs .prs-quieta { opacity: .72; pointer-events: none; }
.prs .prs-sin { color: var(--faint); }
.prs .prs-vacio { flex: 1; min-height: 0; display: grid; place-content: center; padding: 12px; text-align: center; font-size: 12.5px; line-height: 18px; color: var(--dim); }
.prs [role='button'] { cursor: pointer; }
.prs .prs-top { border-bottom: 1px solid var(--hair); }
.prs .prs-brand { text-transform: uppercase; white-space: nowrap; }
.prs .prs-brand__i { width: 30px; height: 22px; display: grid; place-items: center; color: var(--accent); }
.prs .prs-brand__i .prs-i { width: 18px; height: 18px; }
.prs .prs-top__r { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.prs a.prs-btn, .prs a.prs-icon-btn, .prs a.prs-dock__btn { text-decoration: none; }
.prs .prs-c-vacia { min-height: 160px; justify-content: center; align-items: center; text-align: center; }
.prs .prs-delta.prs-sin { font-weight: 500; font-size: 11px; }
.prs .prs-hb__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 10px; }
.prs .prs-hb li[role='button'], .prs .prs-dlist li[role='button'] { margin: 0 -6px; padding: 0 6px; border-radius: 6px; transition: background-color .2s; }
.prs .prs-hb li[role='button']:hover, .prs .prs-dlist li[role='button']:hover { background: var(--hover); }
.prs .prs-dlist li > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prs .prs-dlist--d li { grid-template-columns: 9px minmax(0, 1fr) auto auto; }
.prs .prs-dlist--d li em { color: var(--faint); font-weight: 500; }
.prs .prs-dlist--d li { column-gap: 8px; }
.prs .prs-kpi__n { white-space: nowrap; }
.prs .prs-badge { flex: none; white-space: nowrap; }
.prs .prs-badge--cero { border-color: var(--hair-2); background: transparent; color: var(--dim); }
.prs .prs-hstats span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.prs .prs-vb__ann { transform: none; }
.prs .prs-cust__d { min-height: 10px; }
.prs .prs-tag { transform: translate(-100%, -130%); }
.prs .prs-ticker { transition: border-color .2s; }
.prs .prs-ticker[role='button']:hover { border-color: color-mix(in oklab, var(--accent) 60%, transparent); }
.prs .prs-ticker .prs-i { color: var(--accent); }
.prs .prs-ticker__v > span { min-width: 0; }
.prs .prs-ticker__n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prs .prs-ticker__c { flex: none; color: var(--faint); }
.prs .prs-dock { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.prs .prs-dock__btn { cursor: pointer; }
.prs .prs-lat__leg { flex-wrap: wrap; justify-content: flex-end; }
@container prs (max-width: 1320px) {
  .prs .prs-row--1 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .prs .prs-row--1 > .prs-c-rev { grid-column: 1 / -1; }
  .prs .prs-row--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .prs .prs-row--2 > .prs-c-kpi { grid-column: 1 / -1; order: -1; }
  .prs .prs-row--4 { grid-template-columns: minmax(0, 1fr); }
  .prs .prs-org { display: none; }
}
@container prs (max-width: 1000px) {
  .prs .prs-row--3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .prs .prs-row--3 > .prs-c-signup { grid-column: 1 / -1; order: 1; }
  .prs .prs-row--2 > .prs-c-camp, .prs .prs-row--2 > .prs-c-health { grid-column: 1 / -1; }
}
@container prs (max-width: 760px) {
  .prs .prs-top { height: auto; flex-wrap: wrap; gap: 9px 10px; padding: 12px 12px 9px; }
  .prs .prs-top .prs-btn { width: 34px; padding: 0; justify-content: center; }
  .prs .prs-top .prs-btn span { display: none; }
  .prs .prs-row--1, .prs .prs-row--2, .prs .prs-row--3, .prs .prs-row--4 { grid-template-columns: minmax(0, 1fr); }
  .prs .prs-row--3 > .prs-c-signup { grid-column: auto; }
  .prs .prs-row--2 > .prs-c-kpi { order: 0; }
  .prs .prs-hb { gap: 6px; }
  .prs .prs-hstats span { white-space: normal; }
  .prs .prs-ticker__c { display: none; }
}
@media (prefers-reduced-motion: reduce) { .prs *, .prs *::before, .prs *::after { transition: none !important; animation: none !important; } }
`;
