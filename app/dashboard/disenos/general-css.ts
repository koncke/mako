// =============================================================================
// general-css — la hoja de estilos del DISEÑO de la hoja General: la copia de Orvel, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco». Es docs/diseno/mockups-dashboard/general-orvel/orvel.css (escrita desde lo MEDIDO del demo: valores.json, las
// capturas y el INFORME; nada del código de la tienda) con todo adentro de `.gv` y cada clase con el prefijo `gv-`, para no
// tocar nada del resto del Dashboard (la casa también tiene `.card`, `.btn`, `.chip`). Sin la barra lateral, la de arriba ni
// el dock de Orvel: en MaKo los pone la app. Lo que era del `body` (el fondo con su brillo, la letra) es de `.gv`.
//
// Lo que se suma a la copia, y es de la adaptación (general-orvel/mako.html): los vacíos («No pude leer…»), el chip de lo
// que bajó (la flecha hacia abajo, en rojo) y el medio de 761 a 1040, que Orvel no tiene medido (sus capturas son 1440 y 390).
//
// ⚠️ ESTA HOJA ES SÓLO DE GENERAL: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana. Su corte es el de Orvel (760, medido a 390).
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.
// =============================================================================

export const CSS_GENERAL = `
.gv {
  container-type: inline-size; container-name: gv;
  --font: "Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --bg: #f2efe8; --glow-a: #f7e2b3; --glow-b: #e4e7ec;
  --surface: #fffdf8; --surface-2: #f7f4ed; --raised: #fff; --well: #2e220c0e; --line: #2e220c1a; --line-2: #2e220c30;
  --shadow: 0 1px 2px #2e220c0d, 0 14px 32px -20px #2e220c47;
  --text: #1b1813; --muted: #5b554a; --faint: #6f685c;
  --primary: #f0a31a; --on-primary: #1f1400; --accent-text: #8a5200; --pill: #1b1813; --on-pill: #fbf6ea; --pill-glyph: #f5b23a;
  --ink: #1b1813; --in: #0f6a45; --out: #2c2822;
  --saffron: #e39a12; --teal: #138a7a; --sky: #2f7bc4; --violet: #7458d0; --rose: #d0475e; --lime: #5d9a2a; --slate: #66707d; --clay: #b5653a;
  --good: #0f6a45; --warn: #7f4d00; --bad: #a92d2f; --soft: 14%;
  --r-card: 22px; --r-tile: 14px; --gap: 16px;
  --ease: cubic-bezier(.2, .8, .2, 1);
}
.gv { min-height: 100%; color: var(--text); font: 500 15px/1.5 var(--font); -webkit-font-smoothing: antialiased;
  background: radial-gradient(60% 520px at 22% -80px, color-mix(in srgb, var(--glow-a) 70%, transparent), transparent 70%),
    radial-gradient(50% 600px at 100% 0, color-mix(in srgb, var(--glow-b) 80%, transparent), transparent 70%), var(--bg); }
.gv * { box-sizing: border-box; }
.gv :where(h1, h2, p, ul, li) { margin: 0; padding: 0; }
.gv :where(ul) { list-style: none; }
.gv :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.gv :where(a) { color: inherit; text-decoration: none; }
.gv :where(a, button, [role=button]):focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.gv svg.gv-i { width: 18px; height: 18px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.gv .gv-page { margin: 0 auto; max-width: 1188px; padding: 26px 26px 48px; }

.gv .gv-head { display: flex; align-items: flex-end; gap: 16px; margin-top: 21px; margin-bottom: 22px; }
.gv .gv-head__date { color: var(--muted); font-size: 14px; font-weight: 650; line-height: 21px; }
.gv .gv-head__title { margin-top: 5px; font-size: 36px; font-weight: 800; line-height: 38.16px; letter-spacing: -1.44px; }
.gv .gv-head__sum { margin-top: 10px; color: var(--muted); font-size: 17px; font-weight: 600; line-height: 25.5px; }
.gv .gv-head__sum .gv-in { color: var(--in); font-weight: 700; }
.gv .gv-head__sum a { color: var(--text); font-weight: 750; text-decoration: underline; text-decoration-thickness: 2px; text-decoration-color: var(--primary); text-underline-offset: 3px; }
.gv .gv-head__acts { margin-left: auto; display: flex; gap: 10px; margin-bottom: 1px; }
.gv .gv-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 42px; padding: 0 18px; border-radius: 12px; font-size: 15px; font-weight: 750; white-space: nowrap; transition: background-color .15s, filter .15s; }
.gv .gv-btn svg.gv-i { width: 16px; height: 16px; }
.gv .gv-btn--primary { background: var(--primary); color: var(--on-primary); box-shadow: 0 1px 0 #00000014, 0 6px 14px -8px color-mix(in srgb, var(--primary) 80%, transparent); }
.gv .gv-btn--primary:hover { filter: brightness(1.06); }
.gv .gv-btn--ghost { background: var(--raised); box-shadow: inset 0 0 0 1px var(--line); }
.gv .gv-btn--ghost:hover { background: var(--surface-2); }

.gv .gv-grid { display: grid; gap: var(--gap); }
.gv .gv-row1 { grid-template-columns: 464fr 656fr; }
.gv .gv-row3 { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: var(--gap); }
.gv .gv-card { position: relative; min-width: 0; padding: 20px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.gv .gv-card__h { display: flex; align-items: center; gap: 12px; height: 36px; }
.gv .gv-card__ic { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 9px; background: var(--well); color: var(--text); flex: none; }
.gv .gv-card__ic svg.gv-i { width: 15px; height: 15px; }
.gv .gv-card__t { font-size: 17px; font-weight: 800; line-height: 25.5px; letter-spacing: -.34px; }
.gv .gv-link { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; color: var(--accent-text); font-size: 14px; font-weight: 750; line-height: 21px; white-space: nowrap; }
.gv .gv-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.gv .gv-link svg.gv-i { width: 13px; height: 13px; stroke-width: 2.2; }
.gv .gv-card__s { margin-left: auto; color: var(--muted); font-size: 14px; font-weight: 600; }

/* Cash */
.gv .gv-cash { min-height: 606px; }
.gv .gv-cash__v { margin-top: 14px; font-size: 51.84px; font-weight: 800; line-height: 51.84px; letter-spacing: -2.592px; font-variant-numeric: tabular-nums; }
.gv .gv-cash__v small { color: var(--muted); font-size: 23.328px; font-weight: 700; letter-spacing: 0; }
.gv .gv-cash__d { display: flex; align-items: center; gap: 8px; margin-top: -1px; color: var(--muted); font-size: 14px; font-weight: 600; line-height: 21px; }
.gv .gv-delta { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 8px; background: color-mix(in srgb, var(--in) 12%, transparent); color: var(--in); font-size: 13px; font-weight: 750; }
.gv .gv-delta svg.gv-i { width: 12px; height: 12px; }
.gv .gv-split { display: flex; gap: 4px; height: 11px; margin-top: 21px; }
.gv .gv-split i { border-radius: 4px; background: var(--c); }
.gv .gv-acc { margin-top: 7px; }
.gv .gv-acc li { margin: 0 -6px; padding: 0 6px; display: grid; grid-template-columns: 8px minmax(0, 1fr) auto 50px; column-gap: 10px; align-items: center; height: 62.6px; border-bottom: 1px solid var(--line); }
.gv .gv-acc li:last-child { border-bottom: 0; }
.gv .gv-acc i { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.gv .gv-acc b { display: block; font-size: 15px; font-weight: 750; line-height: 22.5px; }
.gv .gv-acc small { display: block; color: var(--muted); font: 500 13px/19.5px var(--mono); letter-spacing: .13px; }
.gv .gv-acc em { font-style: normal; font-size: 15px; font-weight: 750; font-variant-numeric: tabular-nums; }
.gv .gv-acc span { justify-self: end; color: var(--muted); font-size: 14px; font-weight: 600; }
.gv .gv-cover2 { margin-top: 15px; padding: 14px; border-radius: 16px; background: var(--surface-2); border: 1px solid var(--line); }
.gv .gv-cover2__r { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 15px; font-weight: 650; line-height: 22.5px; }
.gv .gv-cover2__r svg.gv-i { width: 15px; height: 15px; }
.gv .gv-cover2__r b { margin-left: auto; color: var(--text); font-size: 20px; font-weight: 800; line-height: 30px; letter-spacing: -.6px; }
.gv .gv-meter { height: 7px; margin-top: 10px; border-radius: 4px; background: var(--well); overflow: hidden; }
.gv .gv-meter i { display: block; height: 100%; border-radius: 4px; background: var(--in); }
.gv .gv-cover2 p { margin-top: 8px; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 19.6px; }

/* Money in and out */
.gv .gv-seg { margin-left: auto; display: inline-flex; padding: 4px; border-radius: 14px; background: var(--well); }
.gv .gv-seg button { height: 34px; padding: 0 14px; border-radius: 10px; color: var(--muted); font-size: 14px; font-weight: 750; transition: background-color .15s, color .15s; }
.gv .gv-seg button[aria-pressed=true] { background: var(--raised); color: var(--text); box-shadow: 0 1px 2px #2e220c1f; }
.gv .gv-flow__k { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 21px; }
.gv .gv-flow__k p { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; font-weight: 600; line-height: 21px; }
.gv .gv-flow__k p i { width: 9px; height: 9px; border-radius: 2px; background: var(--c); }
.gv .gv-flow__k b { display: block; margin-top: 0; font-size: 24px; font-weight: 800; line-height: 36px; letter-spacing: -.84px; font-variant-numeric: tabular-nums; }
.gv .gv-flow__k b.gv-in { color: var(--in); }
.gv .gv-flow__k small { display: block; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 21px; }
.gv .gv-chart { position: relative; height: 396px; margin-top: 12px; }
.gv .gv-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.gv .gv-chart .gv-gl { stroke: var(--line-2); stroke-dasharray: 2 4; }
.gv .gv-chart text { fill: var(--text); font: 600 13px var(--font); }

/* Needs you */
.gv .gv-needs__l { margin-top: 12px; }
.gv .gv-needs__l a { display: grid; grid-template-columns: 36px minmax(0, 1fr) 30px 16px; column-gap: 12px; align-items: center; height: 67.3px; padding: 0 12px 0 10px; border-radius: 14px; }
.gv .gv-tile { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: color-mix(in srgb, var(--saffron) 16%, var(--surface)); color: var(--accent-text); }
.gv .gv-tile svg.gv-i { width: 16px; height: 16px; }
.gv .gv-needs__l b { display: block; font-size: 15px; font-weight: 750; line-height: 22.5px; }
.gv .gv-needs__l small { display: block; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 21px; }
.gv .gv-count { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: var(--pill); color: var(--bg); font-size: 15px; font-weight: 750; }
.gv .gv-needs__l .gv-chev, .gv .gv-rows .gv-chev { width: 14px; height: 14px; color: var(--muted); }

/* Next 3 weeks */
.gv .gv-up__sum { margin-top: 8px; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 23px; }
.gv .gv-up__sum b { font-variant-numeric: tabular-nums; }
.gv .gv-up__sum b { color: var(--text); font-size: 17px; font-weight: 800; }
.gv .gv-up__l { margin-top: 9px; }
.gv .gv-up__l li { margin: 0 -6px; padding: 0 6px; display: grid; grid-template-columns: 43px minmax(0, 1fr) auto; column-gap: 13px; align-items: center; height: 63px; border-bottom: 1px solid var(--line); }
.gv .gv-up__l li:last-child { border-bottom: 0; }
.gv .gv-date { display: grid; place-items: center; align-content: center; width: 43px; height: 43px; border-radius: 10px; box-shadow: inset 0 0 0 1px var(--line); }
.gv .gv-date b { font-size: 17px; font-weight: 750; line-height: 18.7px; }
.gv .gv-date small { color: var(--muted); font-size: 14px; font-weight: 750; line-height: 15.4px; letter-spacing: .56px; text-transform: uppercase; }
.gv .gv-up__l strong, .gv .gv-rows strong { display: block; font-size: 15px; font-weight: 750; line-height: 22.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gv .gv-up__l li > span > span, .gv .gv-rows span.gv-s { display: block; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 21px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gv .gv-amt { text-align: right; font-size: 15px; font-weight: 750; line-height: 22.5px; font-variant-numeric: tabular-nums; }
.gv .gv-amt small { display: block; color: var(--muted); font-size: 14px; font-weight: 600; line-height: 21px; }
.gv .gv-amt small.gv-warn { color: var(--warn); font-weight: 700; }
.gv .gv-more { display: inline-flex; align-items: center; gap: 6px; margin-top: 7px; color: var(--accent-text); font-size: 14px; font-weight: 750; }
.gv .gv-more svg.gv-i { width: 13px; height: 13px; stroke-width: 2.2; }

/* Owed to you */
.gv .gv-owed__v { margin-top: 14px; font-size: 32px; font-weight: 800; line-height: 48px; letter-spacing: -1.28px; }
.gv .gv-bars { display: flex; gap: 4px; height: 9px; margin-top: 13px; }
.gv .gv-bars i { border-radius: 5px; background: var(--c); }
.gv .gv-leg { display: flex; flex-wrap: wrap; column-gap: 14px; row-gap: 9px; margin-top: 11px; color: var(--muted); font-size: 14px; font-weight: 600; line-height: 21px; }
.gv .gv-leg span { display: inline-flex; align-items: center; gap: 7px; }
.gv .gv-leg i { width: 8px; height: 8px; border-radius: 2px; background: var(--c); }
.gv .gv-rows { margin-top: 12px; border-top: 1px solid var(--line); }
.gv .gv-rows li { display: grid; grid-template-columns: 31px minmax(0, 1fr) auto 32px; column-gap: 11px; align-items: center; height: 63px; border-bottom: 1px solid var(--line); }
.gv .gv-rows li:last-child { border-bottom: 0; }
.gv .gv-av { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 9px; background: color-mix(in srgb, var(--c, var(--slate)) 30%, var(--surface)); color: var(--ink); font-size: 12px; font-weight: 800; letter-spacing: .12px; }
.gv .gv-rows .gv-late { color: var(--bad); font-weight: 700; }
.gv .gv-rows em { font-style: normal; font-size: 15px; font-weight: 750; font-variant-numeric: tabular-nums; }
.gv .gv-mail { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--raised); }
.gv .gv-mail svg.gv-i { width: 14px; height: 14px; }

/* Where it went */
.gv .gv-spend__l { margin-top: 9px; }
.gv .gv-spend__l li { display: grid; grid-template-columns: minmax(0, 1fr) 75px 45px; column-gap: 24px; align-items: center; height: 35.2px; }
.gv .gv-chip { justify-self: start; display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 9px; border-radius: 8px; background: color-mix(in srgb, var(--c) 12%, var(--surface)); color: color-mix(in srgb, var(--c) 72%, #000); font-size: 13px; font-weight: 700; white-space: nowrap; transition: background-color .15s; }
.gv .gv-chip svg.gv-i { width: 12px; height: 12px; }
.gv .gv-chip:hover { background: var(--surface-2); }
.gv .gv-sb { display: grid; gap: 4px; }
.gv .gv-sb i { height: 6px; border-radius: 3px; background: var(--c); }
.gv .gv-sb i + i { height: 3px; background: var(--line-2); }
.gv .gv-spend__l b { text-align: right; font-size: 15px; font-weight: 750; font-variant-numeric: tabular-nums; }
.gv .gv-spend__k { display: flex; gap: 16px; margin-top: 8px; color: var(--muted); font-size: 14px; font-weight: 600; }
.gv .gv-spend__k span { display: inline-flex; align-items: center; gap: 7px; }
.gv .gv-spend__k i { width: 8px; height: 8px; border-radius: 2px; background: var(--c); }

/* Latest payments */
.gv .gv-pay { margin-top: 15px; }
.gv .gv-pay li { display: grid; grid-template-columns: 31px minmax(0, 1fr) auto; column-gap: 11px; align-items: center; height: 59.4px; }
.gv .gv-pay em { font-style: normal; font-size: 15px; font-weight: 750; font-variant-numeric: tabular-nums; }
.gv .gv-pay em.gv-in { color: var(--in); }
.gv .gv-pay strong { display: block; font-size: 15px; font-weight: 750; line-height: 22.5px; }
.gv .gv-pay li > span > span { display: block; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 21px; }

/* Who did what */
.gv .gv-act__l { margin-top: 14px; }
.gv .gv-act__l li { display: grid; grid-template-columns: 31px minmax(0, 1fr); column-gap: 13px; padding: 10.5px 0; border-bottom: 1px solid var(--line); }
.gv .gv-act__l li:last-child { border-bottom: 0; }
.gv .gv-act__l p { font-size: 15px; font-weight: 500; line-height: 22.5px; }
.gv .gv-act__l p b { font-weight: 750; }
.gv .gv-act__l p u { text-decoration-color: var(--line-2); text-underline-offset: 3px; }
.gv .gv-act__l small { display: block; color: var(--muted); font-size: 14px; line-height: 21px; }

/* ── el teléfono (medido a 390, con el corte de Orvel) ───────────────────────────────────────── */
@container gv (max-width: 760px) {
  .gv .gv-flow .gv-card__h { flex-wrap: wrap; height: auto; row-gap: 2px; }
  .gv .gv-flow .gv-seg { margin-left: 0; }
  .gv .gv-flow__k { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 12px; }
  .gv .gv-chart { height: 219px; margin-top: 16px; }
  .gv .gv-head { flex-direction: column; align-items: stretch; gap: 12px; margin-top: 16px; }
  .gv .gv-head__title { margin-top: 4px; font-size: 30px; line-height: 33px; }
  .gv .gv-head__sum { line-height: 24px; }
  .gv .gv-head__acts { margin: 0; }
  .gv .gv-head__acts .gv-btn { flex: 1; }
  .gv .gv-row1, .gv .gv-row3 { grid-template-columns: minmax(0, 1fr); }
  .gv .gv-card { padding: 16px; }
  .gv .gv-cash { min-height: 0; }
  .gv .gv-cash__v { font-size: 42px; line-height: 44px; }
}

/* ── lo de la adaptación ───────────────────────────────────────────────────────────────────── */
.gv .gv-vacio { padding: 16px 2px 4px; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 21px; }
.gv .gv-head { margin-top: 0; }
.gv .gv-delta--baja { background: color-mix(in srgb, var(--bad) 11%, transparent); color: var(--bad); }
/* «Ver todo en la grilla»: el botón de ícono de Orvel (el de su barra de arriba), para no partir la frase de la cabecera */
.gv .gv-ibtn { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; background: var(--raised); box-shadow: inset 0 0 0 1px var(--line); color: var(--text); transition: background-color .15s; }
.gv .gv-ibtn:hover { background: var(--well); }
.gv .gv-ibtn svg.gv-i { width: 17px; height: 17px; }
/* Una fila es un link (o un texto, en una hoja compartida): la caja la pone el renglón, no el link */
.gv .gv-needs__l > span { display: grid; grid-template-columns: 36px minmax(0, 1fr) 30px 16px; column-gap: 12px; align-items: center; height: 67.3px; padding: 0 12px 0 10px; border-radius: 14px; }
.gv .gv-needs__l a { transition: background-color .15s; }
.gv .gv-needs__l a:hover { background: var(--well); }
.gv .gv-fila { display: contents; }
.gv .gv-pay .gv-fila > span > span { display: block; color: var(--muted); font-size: 14px; font-weight: 500; line-height: 21px; }
.gv .gv-act__x { display: block; min-width: 0; }
.gv a.gv-act__x:hover b { text-decoration: underline; text-decoration-color: var(--line-2); text-underline-offset: 3px; }
.gv .gv-up__l strong a:hover { text-decoration: underline; text-underline-offset: 3px; }
.gv .gv-spend__k a:hover { color: var(--text); }
/* Un nombre largo (una etapa, un cliente) no se monta sobre el de al lado */
.gv .gv-chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.gv .gv-pay strong, .gv .gv-pay .gv-fila > span > span, .gv .gv-needs__l b, .gv .gv-needs__l small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gv .gv-card__s { max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── el medio (761 a 1040: no está medido en Orvel) ───────────────────────────────────────────── */
@container gv (max-width: 1040px) {
  .gv .gv-row1 { grid-template-columns: minmax(0, 1fr); }
  .gv .gv-cash { min-height: 0; }
  .gv .gv-row3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gv .gv-row3 > :last-child:nth-child(odd) { grid-column: 1 / -1; }
}
@container gv (max-width: 760px) {
  .gv .gv-page { padding: 16px 14px 40px; }
  .gv .gv-row3 { grid-template-columns: minmax(0, 1fr); }
  .gv .gv-row3 > :last-child:nth-child(odd) { grid-column: auto; }
  .gv .gv-head__acts .gv-ibtn { flex: none; }
}

/* Sin la entrada de la página: el INFORME de Orvel no la trae (vive en un chunk que no muestra) y no se inventa. */
@media (prefers-reduced-motion: reduce) { .gv * { transition: none !important; } }
`;
