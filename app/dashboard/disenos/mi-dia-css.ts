// =============================================================================
// mi-dia-css — la hoja de estilos del DISEÑO de la hoja «Mi día»: la copia de Lumora, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia» y «Carga los de FOCUS
// que ya teníamos». Es docs/diseno/mockups-dashboard/focus-lumora/lumora.css (escrita desde lo MEDIDO del demo: valores.json,
// las capturas y el INFORME; nada del código de la tienda) con todo adentro de `.ld` y cada clase con el prefijo `ld-`, para
// no tocar nada del resto del Dashboard (la casa también tiene `.card`, `.btn`, `.pill`). Sin la barra de arriba ni el dock
// de Lumora: en MaKo los pone la app. La comparación con el original está en docs/relevo/nube-dashboards.md («Mi día»).
//
// Lo que se suma a la copia, y es de la adaptación (focus-lumora/mako.html): la barrita (`meter`, de la página Goals del
// mismo demo) en vez de la línea de cada número; los tonos cielo y limón de la cinta y del día (la copia trae dos); y la
// caja de la cinta, que se corre de costado cuando un día tiene más eventos de los que entran (Lumora tiene siete fijos).
//
// ⚠️ ESTA HOJA ES SÓLO DE «MI DÍA»: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana. Su corte es el de Lumora (760, medido a
//    390); el medio (761 a 1040) NO está medido en Lumora (sus capturas son 1440 y 390) y es nuestro.
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.

export const CSS_MI_DIA = `
.ld {
  container-type: inline-size; container-name: ld;
  --font: "Urbanist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --bg: #eef1f0; --card: #fbfcfc; --surface-2: #f3f6f5; --control: #fff; --well: #16221f0d;
  --line: #16221f14; --line-2: #16221f26; --edge: #16221f12;
  --shadow: 0 1px 2px #16221f0a, 0 10px 28px -18px #16221f33;
  --text: #1c2524; --muted: #59645f; --faint: #6e7975; --ink: #1c2524; --pill: #1c2524; --on-pill: #f7f9f4;
  --primary: #13695d; --on-primary: #f2fbf8;
  --t-mint: #bfe6d1; --t-sky: #c5dbf5; --t-peach: #f8cdb7; --t-lemon: #f3e19d; --tile-dim: #1c2524ad; --tile-well: #ffffff8c;
  --pine: #1d9a85; --marigold: #d8960f; --coral: #e5694a; --sky: #3f84d8; --clay: #a8714b; --moss: #4f9a2c; --rose: #d9475f; --slate: #66737a;
  --good: #23864a; --warn: #a96b05; --bad: #c2372b;
  --r-card: 26px; --r-tile: 18px; --gap: 16px;
  --ease: cubic-bezier(.2, .8, .2, 1);
}
.ld { min-height: 100%; background: var(--bg); color: var(--text); font: 500 14px/1.45 var(--font); -webkit-font-smoothing: antialiased; }
.ld * { box-sizing: border-box; }
.ld :where(h1, h2, p, ul, li) { margin: 0; padding: 0; }
.ld :where(ul) { list-style: none; }
.ld :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.ld :where(a) { color: inherit; text-decoration: none; }
.ld :where(a, button, [role=button]):focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
.ld-i { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.ld-vacio { padding: 18px 4px 6px; color: var(--muted); font-size: 13px; font-weight: 500; }

.ld-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; height: 44px; padding: 0 20px; border-radius: 22px; font-size: 14px; font-weight: 600; white-space: nowrap; transition: background-color .15s, filter .15s; }
.ld-btn--primary { background: var(--pill); color: var(--on-pill); }
.ld-btn--primary:hover { filter: brightness(1.2); }
.ld-btn--ghost { box-shadow: inset 0 0 0 1px var(--line-2); background: #ffffff8c; }
.ld-btn--ghost:hover { background: var(--control); }
.ld-btn--xs { height: 34px; padding: 0 14px; border-radius: 12px; font-size: 13px; background: var(--control); box-shadow: inset 0 0 0 1px var(--line-2); gap: 8px; }
.ld-btn .ld-i { width: 16px; height: 16px; }

/* ── la página ─────────────────────────────────────────────────────────────────────────────── */
.ld-dash { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--gap); align-items: start;
  margin: 0 auto; max-width: 1340px; padding: 24px 26px 48px; }
.ld-dash__main, .ld-dash__rail { display: flex; flex-direction: column; gap: var(--gap); min-width: 0; }
.ld-card { position: relative; border-radius: var(--r-card); background: var(--card); border: 1px solid #16221f12; box-shadow: var(--shadow); padding: 20px; min-width: 0; }
.ld-card__h { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 34px; }
.ld-card__h:has(> div) { align-items: flex-start; }
.ld-card__t { font-size: 15px; font-weight: 600; line-height: 21.75px; letter-spacing: -.075px; }
.ld-card__s { margin-top: 1px; color: var(--muted); font-size: 12.5px; font-weight: 500; line-height: 18.125px; }
.ld-card__link { display: inline-flex; align-items: center; gap: 6px; height: 30px; color: var(--primary); font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.ld-card__link:hover { text-decoration: underline; text-underline-offset: 3px; }
.ld-card__link .ld-i { width: 14px; height: 14px; }
.ld-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gap); }

/* El hero: la fecha, el saludo, el resumen, dos botones y la cinta del día con la línea del ahora */
.ld-hero { padding: 24px; overflow: hidden;
  background: radial-gradient(48% 70% at 92% 6%, #bfe6d166, transparent 72%), radial-gradient(42% 60% at 6% 104%, #f8cdb729, transparent 72%), var(--card); }
.ld-hero::before { content: ""; position: absolute; inset: 0 0 0 48%; background: radial-gradient(#16221f1c 1px, transparent 1.3px) 0 0 / 16px 16px;
  -webkit-mask: linear-gradient(90deg, transparent, #000 40%); mask: linear-gradient(90deg, transparent, #000 40%); pointer-events: none; }
.ld-hero > * { position: relative; }
.ld-hero__date { color: var(--muted); font-size: 12.5px; font-weight: 600; line-height: 18.125px; }
.ld-hero__title { margin-top: 9px; font-size: 38px; font-weight: 600; line-height: 39.52px; letter-spacing: -.95px; }
.ld-hero__title .ld-w { display: inline-block; overflow: hidden; vertical-align: top; padding-bottom: .08em; }
.ld-hero__title .ld-l { display: inline-block; white-space: pre; }
.ld-hero__sum { margin-top: 6px; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 20.3px; }
.ld-hero__sum b { color: var(--text); font-weight: 600; }
.ld-hero__sum a { color: var(--primary); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.ld-hero__warn { display: inline-flex; align-items: center; gap: 6px; margin-left: 4px; color: #94600a; font-weight: 600; }
.ld-hero__warn .ld-i { width: 15px; height: 15px; }
.ld-hero__acts { display: flex; gap: 10px; margin-top: 16px; }
.ld-ribbon-caja { margin-top: 6px; padding-top: 34px; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; scrollbar-color: var(--line-2) transparent; }
.ld-ribbon { position: relative; display: flex; align-items: stretch; gap: 4px; width: max-content; min-width: 100%; }
.ld-ribbon__it { position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 2px; width: 139px; height: 92px; padding: 9px 9px 8px 11px; border-radius: 12px; text-align: left; flex: none; }
.ld-ribbon__it b { font-size: 12.5px; font-weight: 600; line-height: 18.125px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ld-ribbon__it span { color: var(--muted); font-size: 11px; font-weight: 600; line-height: 15.95px; }
.ld-ribbon__it--slot { background: color-mix(in srgb, var(--tone) 32%, var(--card)); box-shadow: inset 3px 0 0 var(--tone-edge, transparent); }
.ld-ribbon__it.ld-is-ppa { --tone: #fff; color: var(--faint); opacity: .78;
  background: repeating-linear-gradient(135deg, #16221f0a 0 7px, transparent 7px 14px), var(--card); box-shadow: inset 0 0 0 1px var(--line); }
.ld-ribbon__it.ld-is-ppa b { color: var(--faint); font-weight: 600; }
.ld-ribbon__it.ld-is-now { --tone: var(--t-sky); box-shadow: inset 0 0 0 2px var(--sky); }
.ld-ribbon__it.ld-is-pine { --tone: var(--t-mint); --tone-edge: var(--pine); }
.ld-ribbon__it.ld-is-clay { --tone: var(--t-peach); --tone-edge: var(--clay); }
.ld-ribbon__it.ld-is-sky { --tone: var(--t-sky); --tone-edge: var(--sky); }
.ld-ribbon__it.ld-is-lemon { --tone: var(--t-lemon); --tone-edge: var(--marigold); }
.ld-ribbon__it--free { width: 141px; border: 1px dashed var(--line-2); }
.ld-ribbon__it--break { width: 30px; display: grid; place-items: center; padding: 0; color: #8b9691; }
.ld-ribbon__it--break .ld-i { width: 14px; height: 14px; }
.ld-ribbon__now { position: absolute; left: 158px; top: -34px; bottom: 0; width: 0; pointer-events: none; z-index: 2; }
.ld-ribbon__now::before { content: ""; position: absolute; left: -1px; top: 24px; bottom: 0; width: 2px; background: var(--coral); }
.ld-ribbon__now b { position: absolute; left: 0; top: 0; transform: translateX(-50%); padding: 2px 6px; border-radius: 6px; background: var(--coral); color: #fff; font-size: 11px; font-weight: 600; line-height: 13px; }
.ld-ribbon__now i { position: absolute; left: -5px; top: 21px; width: 10px; height: 10px; border-radius: 50%; background: var(--coral); box-shadow: 0 0 0 3px #e5694a40; }

/* Las dos tarjetas de la IA */
.ld-ai-card { display: grid; grid-template-columns: 44px minmax(0, 1fr); column-gap: 14px; row-gap: 10px; align-content: start; height: 128px; padding: 18px;
  background: linear-gradient(120deg, color-mix(in srgb, var(--t-sky) 42%, var(--card)), color-mix(in srgb, var(--t-mint) 26%, var(--card))); }
.ld-ai-card--b { background: linear-gradient(120deg, color-mix(in srgb, var(--t-peach) 32%, var(--card)), color-mix(in srgb, var(--t-lemon) 26%, var(--card))); }
.ld-ai-card__ic { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--control); box-shadow: 0 1px 2px #16221f14; }
.ld-ai-card__ic .ld-i { width: 18px; height: 18px; }
.ld-ai-card b { display: block; font-size: 14px; font-weight: 600; line-height: 20.3px; letter-spacing: -.14px; }
.ld-ai-card small { display: block; color: var(--muted); font-size: 12.5px; font-weight: 500; line-height: 18.125px; }
.ld-ai-card .ld-btn--xs { grid-column: 1 / -1; justify-self: start; }

/* Los cuatro números con su línea */
.ld-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gap); }
.ld-kpi { display: grid; grid-template-rows: auto 1fr auto; gap: 8px; height: 132px; padding: 16px 18px; border: 1px solid transparent; box-shadow: none; background: var(--tone); color: var(--ink); }
.ld-kpi__l { display: flex; align-items: flex-start; justify-content: space-between; color: var(--tile-dim); font-size: 12.5px; font-weight: 500; line-height: 18.125px; }
.ld-kpi__ic { display: grid; place-items: center; width: 36px; height: 36px; margin: -4px -4px 0 0; border-radius: 50%; background: var(--tile-well); color: var(--ink); }
.ld-kpi__ic .ld-i { width: 16px; height: 16px; }
.ld-kpi__m { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
.ld-kpi__v { font-size: 26px; font-weight: 600; line-height: 26px; letter-spacing: -.52px; font-variant-numeric: tabular-nums; }
/* La barrita de la adaptación (en MaKo no hay serie para la línea): el meter de Lumora, del mismo demo */
.ld-meter { width: 78px; height: 6px; flex: none; margin-bottom: 8px; border-radius: 3px; background: var(--tile-well); overflow: hidden; }
.ld-meter__fill { display: block; height: 100%; border-radius: 3px; background: var(--ink); transform-origin: left center; }
.ld-kpi__f { color: var(--tile-dim); font-size: 12px; font-weight: 600; line-height: 16.2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ld-kpi__f b { color: var(--ink); font-weight: 600; }
.ld-kpi__f u { color: var(--ink); text-decoration-color: var(--coral); text-decoration-thickness: 2px; text-underline-offset: 3px; }

/* Accesos */
.ld-quick__grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
.ld-quick__a { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 94px; border-radius: 18px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); font-size: 12.5px; font-weight: 600; transition: background-color .15s; }
.ld-quick__a:hover { background: var(--control); }
.ld-quick__ic { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: color-mix(in srgb, var(--tone) 18%, var(--card)); color: var(--tone); }
.ld-quick__ic .ld-i { width: 16px; height: 16px; }

/* Lo que viene */
.ld-upc__list { margin-top: 17px; }
.ld-upc__row { display: grid; grid-template-columns: 44px minmax(0, 1fr); column-gap: 14px; align-items: center; height: 61px; padding: 0 4px; border-radius: 12px; }
.ld-upc__d { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 10px; background: color-mix(in srgb, var(--tone) 16%, var(--card)); color: color-mix(in srgb, var(--tone) 80%, #000); }
.ld-upc__d small { font-size: 11px; font-weight: 600; line-height: 11.55px; letter-spacing: .44px; text-transform: uppercase; }
.ld-upc__d b { font-size: 20px; font-weight: 600; line-height: 21px; letter-spacing: -.4px; }
.ld-upc__row strong { display: block; font-size: 14px; font-weight: 600; line-height: 20.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ld-upc__row strong + span { display: block; color: var(--muted); font-size: 12px; font-weight: 500; line-height: 17.4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Las entregas: la dona y su leyenda */
.ld-select { height: 44px; padding: 0 12px; border-radius: 12px; box-shadow: inset 0 0 0 1px var(--line-2); background: var(--control); font-size: 13.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 18px; }
.ld-hw__b { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 28px; align-items: center; margin-top: 14px; }
.ld-donut { position: relative; width: 130px; height: 130px; }
.ld-donut svg { width: 130px; height: 130px; transform: rotate(-90deg); }
.ld-donut circle { fill: none; stroke-width: 15; }
.ld-donut__c { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.ld-donut__c b { font-size: 26px; font-weight: 600; line-height: 37.7px; letter-spacing: -.52px; }
.ld-donut__c small { color: var(--muted); font-size: 12px; font-weight: 500; line-height: 17.4px; }
.ld-legend li { display: flex; align-items: center; gap: 10px; height: 28px; font-size: 13.5px; font-weight: 500; }
.ld-legend li b { margin-left: auto; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.ld-legend i { width: 9px; height: 9px; border-radius: 2px; background: var(--c); }
.ld-hw__more { margin-top: 14px; }

/* El rendimiento por clase */
.ld-gbars { position: relative; height: 184px; margin: 20px 4px 0 44px; }
.ld-gbars__grid { position: absolute; inset: 0 0 26px 0; display: flex; flex-direction: column; justify-content: space-between; }
.ld-gbars__grid span { position: relative; border-top: 1px dashed var(--line-2); }
.ld-gbars__grid span::before { content: attr(data-v); position: absolute; right: calc(100% + 10px); top: -9px; color: var(--muted); font-size: 12px; font-weight: 500; }
.ld-gbars__cols { position: absolute; inset: 0 0 26px 0; display: grid; grid-template-columns: repeat(4, 1fr); }
.ld-gbars__g { position: relative; display: flex; align-items: flex-end; justify-content: center; gap: 4px; }
.ld-gbars__bar { width: 16px; border-radius: 3px 3px 0 0; background: var(--c); transform-origin: bottom center; transition: opacity .2s; }
.ld-gbars:hover .ld-gbars__bar:not(.ld-is-hi) { opacity: .55; }
.ld-gbars__g label { position: absolute; bottom: -24px; left: 0; right: 0; text-align: center; color: var(--muted); font-size: 12px; font-weight: 500; }
.ld-gbars__k { display: flex; justify-content: center; gap: 18px; margin-top: 12px; font-size: 12.5px; font-weight: 500; color: var(--muted); }
.ld-gbars__k span { display: inline-flex; align-items: center; gap: 7px; }
.ld-gbars__k i { width: 9px; height: 9px; border-radius: 2px; background: var(--c); }

/* La lista de vigilancia */
.ld-risk__list { margin-top: 9px; }
.ld-risk__row { display: flex; align-items: center; gap: 12px; height: 62px; border-bottom: 1px solid var(--line); }
.ld-risk__row:last-child { border-bottom: 0; }
.ld-av { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; flex: none; background: var(--tone); font-size: 12.5px; font-weight: 600; color: var(--ink); }
.ld-risk__who { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
.ld-risk__who b { display: block; font-size: 14px; font-weight: 600; line-height: 20.3px; }
.ld-risk__who small { display: block; color: var(--muted); font-size: 12px; font-weight: 500; line-height: 17.4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ld-pill { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: 13px; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.ld-pill i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .9; }
.ld-pill--high { background: #f6dcdc; color: #7c2f28; } .ld-pill--high i { background: var(--bad); }
.ld-pill--med { background: #f6ead2; color: #7f560e; } .ld-pill--med i { background: var(--marigold); }
.ld-risk__h .ld-i { width: 16px; height: 16px; color: var(--marigold); }

/* Avisos */
.ld-notes__list { margin-top: 10px; }
.ld-notes__row { display: grid; grid-template-columns: 36px minmax(0, 1fr); column-gap: 14px; align-items: center; height: 52px; margin-bottom: 3px; }
.ld-notes__ic { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: color-mix(in srgb, var(--tone) 16%, var(--card)); color: var(--tone); }
.ld-notes__ic .ld-i { width: 15px; height: 15px; }
.ld-notes__row b { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; line-height: 16.875px; }
.ld-notes__row.ld-is-unread b::after { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--coral); flex: none; }
.ld-notes__row small { display: block; color: var(--muted); font-size: 12px; font-weight: 500; line-height: 17.4px; }

/* El riel: el mes, el día y los recordatorios */
.ld-cal { padding: 18px; }
.ld-cal__h { display: flex; align-items: center; justify-content: space-between; height: 32px; }
.ld-cal__h b { font-size: 15px; font-weight: 600; letter-spacing: -.225px; }
.ld-cal__grid { display: grid; grid-template-columns: repeat(7, 1fr); margin-top: 10px; }
.ld-cal__dow { height: 30px; display: grid; place-items: center; color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: .44px; }
.ld-cal__d { position: relative; display: grid; place-items: center; height: 40px; margin: 1px 1px 0; border-radius: 12px; font-size: 12.5px; font-weight: 600; }
.ld-cal__d.ld-is-out { color: #8b9691; }
.ld-cal__d.ld-is-we { color: #a6b1ac; }
.ld-cal__d.ld-is-hol { background: repeating-linear-gradient(135deg, #16221f0d 0 5px, transparent 5px 10px); }
.ld-cal__d.ld-is-today { background: var(--primary); color: var(--on-primary); }
.ld-cal__d .ld-dots { position: absolute; bottom: 5px; left: 0; right: 0; display: flex; justify-content: center; gap: 2px; }
.ld-cal__d .ld-dots i { width: 4px; height: 4px; border-radius: 50%; background: var(--c); }
.ld-cal__d.ld-is-today .ld-dots i { background: var(--on-primary); }
.ld-sch__list, .ld-rem__list { margin-top: 16px; display: flex; flex-direction: column; gap: 6px; }
.ld-rem .ld-card__h { align-items: center; }
.ld-rem__list { margin-top: 17px; gap: 7px; }
.ld-sch__row { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; column-gap: 14px; align-items: center; min-height: 56px; padding: 8px 10px 8px 12px; border-radius: 14px; text-align: left;
  background: color-mix(in srgb, var(--tone, transparent) 30%, var(--card)); box-shadow: inset 3px 0 0 var(--tone-edge, transparent); }
.ld-sch__row--free { background: transparent; box-shadow: none; border: 1px dashed var(--line-2); }
.ld-sch__row--sky { --tone: var(--t-sky); --tone-edge: var(--sky); box-shadow: inset 0 0 0 2px var(--sky); }
.ld-sch__row--pine { --tone: var(--t-mint); --tone-edge: var(--pine); }
.ld-sch__row--clay { --tone: var(--t-peach); --tone-edge: var(--clay); }
.ld-sch__row--lemon { --tone: var(--t-lemon); --tone-edge: var(--marigold); }
.ld-sch__row--cielo { --tone: var(--t-sky); --tone-edge: var(--sky); }
.ld-sch__t b { display: block; font-size: 12.5px; font-weight: 600; line-height: 15.625px; letter-spacing: -.25px; }
.ld-sch__t small { display: block; color: var(--muted); font-size: 11px; font-weight: 600; line-height: 13.75px; letter-spacing: -.25px; }
.ld-sch__x { min-width: 0; }
.ld-sch__x b { display: block; font-size: 12.5px; font-weight: 600; line-height: 18.125px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ld-sch__x small { display: block; color: var(--muted); font-size: 12px; font-weight: 500; line-height: 17.4px; }
.ld-now { padding: 2px 8px; border-radius: 6px; background: var(--sky); color: #fff; font-size: 11px; font-weight: 600; line-height: 15.95px; }
.ld-rem__row { display: grid; grid-template-columns: 36px minmax(0, 1fr) 24px; gap: 12px; align-items: center; padding: 10px; border-radius: 14px; background: var(--surface-2); box-shadow: inset 0 0 0 1px #16221f14; }
.ld-rem__row--todo { background: transparent; box-shadow: none; border: 1px dashed var(--line-2); grid-template-columns: 20px minmax(0, 1fr) 24px; padding: 6px 10px 6px 12px; }
.ld-rem__ic { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: color-mix(in srgb, var(--tone) 18%, var(--card)); color: var(--tone); }
.ld-rem__ic .ld-i { width: 16px; height: 16px; }
.ld-rem__row b { display: block; font-size: 12.5px; font-weight: 600; line-height: 18.125px; }
.ld-rem__row small { display: block; color: var(--muted); font-size: 12px; font-weight: 500; line-height: 17.4px; }
.ld-rem__row > .ld-i { width: 16px; height: 16px; color: var(--muted); justify-self: center; }
.ld-check { width: 20px; height: 20px; border-radius: 6px; background: var(--control); box-shadow: inset 0 0 0 1.5px var(--line-2); }


/* ── lo de la adaptación ───────────────────────────────────────────────────────────────────── */
/* Tildar una tarea de hoy: la fila es un div con el botón y el link al lado (un botón no va adentro de un link) */
.ld-rem__row--todo .ld-check { display: grid; place-items: center; transition: background-color .15s; }
.ld-rem__row--todo button.ld-check:hover { background: var(--surface-2); }
.ld-check--on { background: var(--primary); box-shadow: none; color: var(--on-primary); }
.ld-check--on .ld-i { width: 14px; height: 14px; stroke-width: 2.4; }
.ld-rem__row--hecha b { color: var(--muted); text-decoration: line-through; }
.ld-rem__x { min-width: 0; }
.ld-rem__x b, .ld-rem__x small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Lo que dice un bloque de la cinta va en un renglón (el detalle de un evento real puede ser largo) */
.ld-ribbon__it span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Un OKR con un nombre largo no se monta sobre el de al lado */
.ld-gbars__g label { padding: 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* El nombre del funnel (sin flecha: un selector que no cambia nada sería un control muerto) */
.ld-select { min-width: 0; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; line-height: 44px; }

/* ── el medio (761 a 1040: no está medido en Lumora): el riel baja, en dos columnas ───────────────── */
@container ld (max-width: 1040px) {
  .ld-dash { grid-template-columns: minmax(0, 1fr); }
  .ld-dash__rail { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
  .ld-rem { grid-column: 1 / -1; }
}
@container ld (max-width: 900px) {
  .ld-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ld-quick__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

/* ── el teléfono (medido a 390, con el corte de Lumora) ───────────────────────────────────────── */
@container ld (max-width: 760px) {
  .ld-dash { grid-template-columns: minmax(0, 1fr); padding: 16px 14px 40px; }
  .ld-dash__main, .ld-dash__rail { display: contents; }
  .ld-hero { order: 1; padding: 18px; } .ld-kpis { order: 2; } .ld-sch { order: 3; } .ld-two--ai { order: 4; } .ld-rem { order: 5; }
  .ld-quick { order: 6; } .ld-upc-hw { order: 7; } .ld-perf { order: 8; } .ld-risk-notes { order: 9; } .ld-cal { order: 10; }
  .ld-rem { grid-column: auto; }
  .ld-hero__title { font-size: 30px; line-height: 32px; }
  .ld-hero__acts { flex-direction: column; } .ld-hero__acts .ld-btn { width: 100%; }
  .ld-ribbon-caja { margin: 6px -18px 0 -17px; }
  .ld-ribbon__it { width: 94px; } .ld-ribbon__it--free { width: 94px; } .ld-ribbon__it--break { width: 30px; }
  .ld-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .ld-kpi { height: auto; min-height: 118px; padding: 13px 14px; }
  .ld-kpi__f { white-space: normal; }
  .ld-kpi__l { align-items: center; }
  .ld-kpi__ic { width: 32px; height: 32px; border-radius: 10px; margin: -2px -2px 0 0; }
  .ld-two { grid-template-columns: minmax(0, 1fr); }
  .ld-two--ai { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .ld-ai-card { height: auto; padding: 14px; grid-template-columns: minmax(0, 1fr); row-gap: 8px; }
  .ld-ai-card small { display: none; }
  .ld-ai-card__ic { width: 36px; height: 36px; border-radius: 10px; }
  .ld-ai-card b { font-size: 13.5px; }
  .ld-quick__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .ld-hw__b { grid-template-columns: 110px minmax(0, 1fr); gap: 18px; }
  .ld-donut, .ld-donut svg { width: 110px; height: 110px; }
  .ld-card { padding: 16px; }
}

/* La entrada: hasta que corre, las tarjetas no se ven (la mueve el efecto de la hoja) */
.ld[data-antes] [data-card] { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .ld[data-antes] [data-card] { opacity: 1; } .ld * { transition: none !important; } }
`;
