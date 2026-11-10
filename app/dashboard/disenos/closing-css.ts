// =============================================================================
// closing-css — la hoja de estilos del DISEÑO de la hoja Closing: la copia de Halden, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que se vea exactamente igual que la copia». Es docs/diseno/mockups-dashboard/closing/closing.css
// (escrita desde lo MEDIDO del demo: valores.json, las capturas y el INFORME; nada del código de la tienda) con todo
// adentro de `.hc` y cada clase con el prefijo `hc-`, para no tocar nada del resto del Dashboard. La comparación con
// el original, captura contra captura, está en docs/relevo/nube-dashboards.md.
//
// ⚠️ ESTA HOJA ES SÓLO DE CLOSING. Martín rechazó las 20 hojas porque compartían la cara: otra hoja con diseño escribe
//    la suya (la de su demo), no reusa ésta.
// ⚠️ LOS COLORES CLAROS SON LOS DEL DEMO, EN HEX, A PROPÓSITO: es la copia de una referencia CLARA. Paleta DOBLE (6/11/2026,
//    Martín: «los que vienen en dark mode deben acompañar siempre el white mode si el usuario lo tiene así en MaKo, y si tiene
//    dark mode, automáticamente pasarse a allí»): claro por defecto y, con data-tema="oscuro" en <html>, la regla que viene
//    justo después de la raíz redefine las MISMAS variables. Sólo CSS: cambia en vivo. El oscuro NO es de Halden (no se midió):
//    es nuestro, con el tono de la casa.
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana: el lienzo del Dashboard tiene la
//    barra de la app al lado.
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.

export const CSS_CLOSING = `
.hc{
  container-type:inline-size;container-name:hc;
  --a-950:#0a3338; --a-800:#0d4f57; --a-700:#12707a; --a-600:#198591; --a-400:#55b4bc; --a-100:#dff1f1;
  --page:#f3f4f3; --panel:#eceeed; --card:#fdfdfc; --hair:#e0e4e3; --hair-strong:#d2d8d7;
  --ink:#111a1b; --muted:#5d6869; --faint:#667172;
  --accent:#12707a; --accent-soft:#dff1f1; --hatch:#8f9c9d; --on-accent:#f1f8f8; --deep:#0a3338;
  --good:#1d7745; --good-bg:#e3f3e8; --amber:#a5620a; --amber-bg:#fdf2e0; --rose:#bf3838; --rose-bg:#fdeceb;
  /* los cuatro tramos de la barra del pipeline: el acento mezclado con la tarjeta (medidos pixel a pixel) */
  --st-1:#adcdd0; --st-2:#83b4b8; --st-3:#5d9da4; --st-4:#38878f;
  /* MaKo: el tramo de lo perdido. Halden no tiene uno (sus tramos son todos «abiertos»): el rosa del demo bajado a la
     misma luz que los tramos claros, para que no grite más que lo ganado. */
  --rosa-st:#e3a3a0;
  --r-lg:18px; --r-md:14px; --r-sm:10px; --gap:14px;
  --shadow:0 1px 2px #111a1b0a;
  --ring:inset 0 0 0 1px var(--hair);
  /* la curva de las transiciones de CSS de Halden (la var --ease medida) */
  --ease:cubic-bezier(.22,1,.36,1);
  /* las curvas de GSAP, traducidas */
  --p4o:cubic-bezier(.165,.84,.44,1);
  --p3o:cubic-bezier(.215,.61,.355,1);
  --p3io:cubic-bezier(.645,.045,.355,1);
  --b2:cubic-bezier(.34,1.56,.64,1);
  --font:"Manrope",system-ui,-apple-system,"Segoe UI",sans-serif;
  --focus:0 0 0 2px #fdfdfc,0 0 0 4px #198591;
  /* lo que antes estaba escrito en hex dentro de las reglas: ahora son variables para que el oscuro las cambie */
  --hoy:#0a3338; --you:#2a8089; --rose-t:#9c2f2f; --av-ink:#111a1bc7;
  --av-1:#f3cdb8; --av-2:#f6e5b9; --av-3:#cfe0f6; --av-4:#d6efd6; --av-5:#f1dcf2;
  --tn-amber-bg:#fbeedb; --tn-amber:#9a5b0b; --tn-cyan-bg:#ddf0f6; --tn-cyan:#0d6580; --tn-violet-bg:#efe5fb; --tn-violet:#6d36ad;
  --tn-blue-bg:#e2ebfb; --tn-blue:#1d4fa3; --tn-rose-bg:#fbe5e5; --tn-rose:#b13535; --tn-sky-bg:#e2eaf8; --tn-sky:#2a5698;
}
/* En oscuro las superficies SUBEN de luminosidad al elevarse (página < tarjeta < pozo), las líneas son colores opacos a dos
   pasos del fondo y la tinta es un blanco cálido. La tarjeta oscura del héroe (la tasa) es un acento y queda oscura en los
   dos modos: sus colores van escritos en la regla, no en variables. :where deja la especificidad igual a la de .hc. */
.hc:where([data-tema="oscuro"] *){
  --page:#0b1112; --panel:#1a2324; --card:#141c1d; --hair:#243031; --hair-strong:#33413f;
  --ink:#ededeb; --muted:#a9b2b1; --faint:#8e9897;
  --accent:#4fb4bd; --accent-soft:#12383c; --hatch:#7d8a8b; --on-accent:#041a1d;
  --a-100:#123a3f; --a-800:#7ccdd4;
  --good:#4fc088; --good-bg:#12301f; --amber:#e3a24a; --amber-bg:#3a2a10; --rose:#f08581; --rose-bg:#3b1b1b;
  --shadow:0 1px 2px #0008; --focus:0 0 0 2px #141c1d,0 0 0 4px #4fb4bd;
  --hoy:#e6f6f7; --you:#7ccdd4; --rose-t:#f2a3a0; --av-ink:#f2eeea;
  --av-1:#5c3b2d; --av-2:#5c4a22; --av-3:#2a4566; --av-4:#2b5a2f; --av-5:#5a3a5c;
  --tn-amber-bg:#3a2a10; --tn-amber:#e8b062; --tn-cyan-bg:#10343f; --tn-cyan:#6cc6e0; --tn-violet-bg:#2d2141; --tn-violet:#b79cef;
  --tn-blue-bg:#16294a; --tn-blue:#8fb2f2; --tn-rose-bg:#3b1b1b; --tn-rose:#f09a9a; --tn-sky-bg:#172a45; --tn-sky:#8fb5ee;
}
.hc{background:var(--page);color:var(--ink);font:500 14px/1.45 var(--font);-webkit-font-smoothing:antialiased;min-height:100%}
.hc *{box-sizing:border-box;margin:0;padding:0}
.hc :where(button){font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.hc :where(a){color:inherit;text-decoration:none}
.hc :where(svg){display:block;flex:none}
.hc-ic{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.hc :where(a,button,[tabindex]):focus-visible{box-shadow:var(--focus);outline:none}

/* ── La cabecera de la hoja ───────────────────────────────────────────────────────────── */
.hc-vista{padding:16px 22px 17px}
.hc-cab{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:14px}
.hc-eyebrow{font-size:12px;font-weight:700;letter-spacing:.96px;text-transform:uppercase;color:var(--accent)}
.hc-titulo{font-size:32px;line-height:35.84px;font-weight:800;letter-spacing:-1.12px;margin-top:2px;overflow:hidden;padding-bottom:2px}
.hc-titulo .hc-l{display:inline-block;white-space:pre}
.hc-bajada{font-size:14.5px;color:var(--muted);margin-top:2px}
.hc-cab__btns{display:flex;gap:11px;padding-bottom:0}
.hc-btn{height:42px;padding:0 19px;border-radius:11px;display:flex;align-items:center;gap:9px;font-size:14.5px;font-weight:700;
  transition:background-color .2s,box-shadow .2s,color .2s}
.hc-btn--ghost{background:var(--card);box-shadow:inset 0 0 0 1px var(--hair-strong)}
.hc-btn--ghost:hover{background:var(--panel)}
.hc-btn--primary{background:var(--accent);color:var(--on-accent)}
.hc-btn--primary:hover{background:var(--a-800)}

/* ── La grilla: 12 columnas, como Halden ──────────────────────────────────────────────── */
.hc-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:var(--gap)}
.hc-c7{grid-column:span 7}.hc-c5{grid-column:span 5}.hc-c4{grid-column:span 4}.hc-c3{grid-column:span 3}
.hc-card{position:relative;background:var(--card);border-radius:var(--r-lg);padding:16px 18px;box-shadow:var(--ring),var(--shadow);
  display:flex;flex-direction:column;min-width:0}
.hc-card__h{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.hc-card__t{font-size:15.5px;font-weight:800;letter-spacing:-.31px;line-height:22.475px}
.hc-card__s{font-size:12.5px;color:var(--muted);line-height:18.125px}
.hc-card__h .hc-card__s{margin-top:2px}
.hc-link{font-size:13px;font-weight:700;color:var(--accent);line-height:18.85px;transition:color .2s}
.hc-link:hover{text-decoration:underline;text-underline-offset:3px}
.hc-chip{height:19px;padding:0 7px;border-radius:7px;display:inline-flex;align-items:center;font-size:11px;font-weight:700;white-space:nowrap}
.hc-chip--amber{background:var(--amber-bg);color:var(--amber)}
.hc-chip--grey{background:var(--panel);color:var(--muted);font-size:11.5px}
.hc-chip--soft{background:var(--card);color:var(--accent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 35%,transparent)}

/* ── El héroe: lo ganado y la meta ────────────────────────────────────────────────────── */
.hc-hero{background:var(--deep);color:#eef7f7;box-shadow:none;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) 94.4px;
  column-gap:26px;padding:16px 18px}
/* el resplandor arriba a la derecha y la cuadrícula de 28px que se ve más hacia ese lado (medidos: líneas cada 28px
   desde el borde, blancas al ~1% a la izquierda y al ~5% a la derecha) */
.hc-hero::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(420px 205px at 100% 0%,#156d77 0%,#0a3338 100%)}
.hc-hero::after{content:"";position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px);
  background-size:28px 28px;background-position:0 0;
  -webkit-mask-image:linear-gradient(90deg,#0002,#000);mask-image:linear-gradient(90deg,#0002,#000)}
.hc-hero>*{position:relative;z-index:1}
.hc-hero__main{display:flex;flex-direction:column;min-width:0}
.hc-hero__h{display:flex;justify-content:space-between;align-items:flex-start}
.hc-hero__t{font-size:14px;font-weight:700;color:#c5e0e1;line-height:20.3px}
.hc-arrow{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;color:#eef7f7;box-shadow:inset 0 0 0 1.5px #eef7f7d9;
  margin-top:-1px;transition:transform .35s var(--ease),background .2s,color .2s}
.hc-arrow:hover{transform:rotate(45deg);color:var(--a-950);background:#eef7f7}
.hc-arrow .hc-ic{width:18px;height:18px}
.hc-hero__num{font-size:50px;line-height:50px;font-weight:800;letter-spacing:-2.5px;margin-top:6px;font-variant-numeric:tabular-nums}
.hc-hero__delta{display:flex;align-items:center;gap:8px;font-size:13px;color:#c5e0e1;margin-top:8px;line-height:18.85px}
.hc-pill-up{height:17px;padding:0 5px;border-radius:5px;background:#a9f0c8;color:#0b2b1a;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
.hc-hero__goal{margin-top:auto}
.hc-goal{height:8px;border-radius:999px;background:#eef7f721;overflow:hidden;margin-bottom:12px}
.hc-goal__fill{height:100%;width:100%;border-radius:999px;transform-origin:0 50%;background:linear-gradient(90deg,var(--a-400),#c6f1f3)}
.hc-goal__row{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:#c5e0e1;line-height:18.85px}
.hc-goal__row>span:last-child{flex:none;white-space:nowrap}
.hc-goal__row b{color:#fff;font-weight:700}
.hc-hero__stats{position:relative;display:flex;flex-direction:column;justify-content:center;padding-left:28px;
  box-shadow:-1px 0 0 #eef7f726}
.hc-stat{padding:5px 0 6px;box-shadow:0 1px 0 #eef7f71f}
.hc-stat:last-child{box-shadow:none}
.hc-stat dt{font-size:12.5px;font-weight:600;color:#c5e0e1;line-height:18.125px}
.hc-stat dd{font-size:21px;font-weight:800;letter-spacing:-.735px;line-height:23.1px;margin-top:3px;white-space:nowrap;font-variant-numeric:tabular-nums}

/* ── El pipeline abierto ──────────────────────────────────────────────────────────────── */
.hc-big{display:flex;align-items:baseline;gap:11px;margin-top:8px}
.hc-big__n{font-size:40px;line-height:40px;font-weight:800;letter-spacing:-1.8px;font-variant-numeric:tabular-nums}
.hc-big__s{font-size:13px;color:var(--muted)}
.hc-big__s b{color:var(--ink);font-weight:700}
.hc-stages{display:flex;gap:2px;height:28px;border-radius:9px;overflow:hidden;margin-top:14px;transform-origin:0 50%}
.hc-stages>i{display:block;height:100%}
.hc-legend{display:grid;grid-template-columns:1fr 1fr;column-gap:18px;row-gap:6px;margin-top:12px}
.hc-leg{display:grid;grid-template-columns:auto 1fr auto;column-gap:7px;align-items:center}
.hc-leg i{width:10px;height:10px;border-radius:3px}
.hc-leg span{font-size:13px;font-weight:600;color:var(--muted);line-height:18.85px}
.hc-leg b{font-size:13px;font-weight:800;line-height:18.85px;font-variant-numeric:tabular-nums}
.hc-leg small{grid-column:2/4;font-size:12px;color:var(--faint);line-height:17.4px;margin-top:2px}

/* ── Las barras de la semana ──────────────────────────────────────────────────────────── */
.hc-legend-mini{display:flex;gap:14px;font-size:12px;color:var(--muted);line-height:17.4px}
.hc-legend-mini span{display:flex;align-items:center;gap:6px}
.hc-sw{width:10px;height:10px;border-radius:3px;background:var(--accent)}
.hc-sw--hatch{background:repeating-linear-gradient(135deg,var(--hatch) 0 1.5px,transparent 1.5px 3.6px);box-shadow:inset 0 0 0 1px var(--hatch)}
.hc-bars{position:relative;flex:1;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));column-gap:15px;margin-top:14px;
  align-items:end;min-height:150px}
.hc-bars::after{content:"";position:absolute;left:0;right:0;bottom:25.8px;height:1px;background:var(--hair)}
.hc-bar{display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;cursor:default}
.hc-bar__track{width:44px;flex:1;display:flex;align-items:flex-end;overflow:hidden;border-radius:9px 9px 0 0;margin-bottom:1px}
.hc-bar__fill{width:100%;border-radius:9px;background:var(--accent);transition:filter .2s}
.hc-bar:hover .hc-bar__fill{filter:brightness(1.08)}
.hc-bar--hoy .hc-bar__fill{background:var(--hoy)}
.hc-bar--plan .hc-bar__fill{background:var(--card) repeating-linear-gradient(135deg,var(--hatch) 0 2.1px,transparent 2.1px 7.07px);
  box-shadow:inset 0 0 0 1px var(--hatch)}
.hc-bar__l{font-size:12px;font-weight:600;color:var(--faint);line-height:17.4px;margin-top:7px;margin-bottom:2px}
.hc-bar--hoy .hc-bar__l{font-weight:800;color:var(--ink)}
.hc-tip{position:absolute;left:0;top:0;padding:3px 8px;border-radius:8px;background:var(--ink);color:var(--card);font-size:11.5px;font-weight:700;
  line-height:16.675px;pointer-events:none;white-space:nowrap}
.hc-tip::after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;margin-left:-4px;background:var(--ink);transform:rotate(45deg);border-radius:1px}

/* ── Las listas ───────────────────────────────────────────────────────────────────────── */
.hc-deals{list-style:none;margin-top:5px}
.hc-ditem{display:flex;align-items:center;gap:12px;padding:6px 0 5px;border-bottom:1px solid var(--hair)}
.hc-ditem:last-child{border-bottom:0}
.hc-tile{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-size:12.5px;font-weight:800;letter-spacing:-.25px;flex:none}
.hc-t-amber{background:var(--tn-amber-bg);color:var(--tn-amber)}.hc-t-cyan{background:var(--tn-cyan-bg);color:var(--tn-cyan)}.hc-t-violet{background:var(--tn-violet-bg);color:var(--tn-violet)}
.hc-t-blue{background:var(--tn-blue-bg);color:var(--tn-blue)}.hc-t-rose{background:var(--tn-rose-bg);color:var(--tn-rose)}.hc-t-sky{background:var(--tn-sky-bg);color:var(--tn-sky)}
.hc-ditem__b{flex:1;min-width:0}
.hc-ditem__n{font-size:14px;font-weight:700;line-height:18.2px}
.hc-ditem__m{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);line-height:17.4px}
.hc-ditem__m i{width:7px;height:7px;border-radius:2px}
.hc-ditem__v{text-align:right;font-size:14px;font-weight:800;line-height:20.3px;font-variant-numeric:tabular-nums}
.hc-ditem__v small{display:block;font-size:11.5px;font-weight:600;color:var(--faint);line-height:16.675px}

/* ── Lo que viene ─────────────────────────────────────────────────────────────────────── */
.hc-nextup{background:var(--a-100);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 22%,transparent)}
.hc-nextup__t{font-size:21px;font-weight:800;letter-spacing:-.63px;line-height:25.2px;margin-top:12px}
.hc-nextup__s{font-size:13px;color:var(--muted);margin-top:8px;line-height:18.85px}
.hc-join{margin-top:auto;height:42px;border-radius:11px;background:var(--accent);color:var(--on-accent);display:flex;align-items:center;
  justify-content:center;gap:9px;font-size:14.5px;font-weight:700;transition:background-color .2s}
.hc-join:hover{background:var(--a-800)}

/* ── La cuota de cada uno ─────────────────────────────────────────────────────────────── */
.hc-quota{list-style:none;margin-top:10px;display:flex;flex-direction:column;gap:6px}
.hc-lrow{display:grid;grid-template-columns:30px 1fr auto;column-gap:12px;align-items:center}
.hc-ava{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-size:10.5px;font-weight:700;letter-spacing:.21px;color:var(--av-ink);grid-row:span 2}
.hc-lrow__n{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;line-height:20.3px}
.hc-you{height:18px;padding:0 6px;border-radius:6px;font-size:11px;font-weight:700;color:var(--you);background:var(--accent-soft);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 25%,transparent);display:inline-flex;align-items:center}
.hc-lrow__v{font-size:12.5px;font-weight:700;line-height:18.125px;font-variant-numeric:tabular-nums}
.hc-lrow__v span{font-weight:500;color:var(--muted)}
.hc-meter{grid-column:2/4;height:6px;border-radius:999px;background:var(--panel);overflow:hidden;margin-top:2px}
.hc-meter__fill{height:100%;width:100%;border-radius:999px;background:var(--accent);transform-origin:0 50%}

/* ── El asistente ─────────────────────────────────────────────────────────────────────── */
.hc-assist__ic{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;color:#eef7f7;
  background:linear-gradient(140deg,#16747f,#0a3338)}
.hc-assist__ic .hc-ic{width:14px;height:14px}
.hc-assist__h{display:flex;align-items:center;gap:9px}
.hc-aitems{list-style:none;display:flex;flex-direction:column;gap:7px;margin-top:9px}
.hc-aitem{display:flex;align-items:center;gap:11px;padding:5.5px 12px 5.5px 10px;border-radius:12px;background:var(--panel)}
.hc-aitem .hc-tile{width:28px;height:28px;border-radius:9px;font-size:11px;letter-spacing:-.22px}
.hc-aitem__b{flex:1;min-width:0}
.hc-aitem__n{font-size:13.5px;font-weight:700;line-height:19.575px}
.hc-aitem__m{font-size:12px;color:var(--muted);line-height:17.4px}
.hc-aitem__v{font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
.hc-btn-line{align-self:flex-start;margin-top:10px;height:36px;padding:0 12px;border-radius:9px;display:flex;align-items:center;gap:8px;
  font-size:13.5px;font-weight:700;background:var(--card);box-shadow:inset 0 0 0 1px var(--hair-strong);transition:background-color .2s}
.hc-btn-line:hover{background:var(--panel)}
.hc-btn-line .hc-ic{width:14px;height:14px}

/* ── La sesión de llamadas: el reloj de dígitos que ruedan ────────────────────────────── */
.hc-dialer__clock{margin:auto 0 0;display:flex;justify-content:center;align-items:center;height:58px;font-size:40px;font-weight:800;
  letter-spacing:-.8px;font-variant-numeric:tabular-nums}
.hc-dg{height:46px;overflow:hidden;display:inline-block;line-height:46px}
.hc-dg__col{display:flex;flex-direction:column}
.hc-dg__col span{height:46px;display:block}
.hc-colon{color:var(--faint);line-height:58px;margin:0 1px}
.hc-tbtns{display:flex;justify-content:center;gap:10px;margin-top:18px}
.hc-tbtn{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:var(--panel);color:var(--ink);transition:background .2s}
.hc-tbtn:hover{background:var(--hair-strong)}
.hc-tbtn--log{background:var(--accent);color:var(--on-accent)}.hc-tbtn--log:hover{background:var(--a-800)}
.hc-tbtn--stop{background:#c43636;color:#fff}.hc-tbtn--stop:hover{background:#a82b2b}
.hc-tbtn .hc-fill{fill:currentColor;stroke:none}

/* ── MaKo: lo que reemplaza a los tres botones de la sesión — la duración de lo ganado contra lo perdido ──── */
.hc-durs{display:flex;justify-content:center;gap:8px;margin-top:18px}
.hc-dur{height:40px;padding:0 12px;border-radius:11px;display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;white-space:nowrap}
.hc-dur b{font-weight:800}
.hc-dur .hc-ic{width:14px;height:14px}
.hc-dur--gana{background:var(--accent-soft);color:var(--a-800)}
.hc-dur--pierde{background:var(--rose-bg);color:var(--rose-t)}

/* ── El medio (641 a 1040 de lienzo): NO está medido en Halden (sus capturas son 1440 y 390) y es nuestro. Con la barra
   lateral y la lista de hojas, una ventana de 1024 deja ~780 de lienzo, y ahí tres columnas ya no entran: dos, en el
   orden del teléfono, con la tasa y la duración a lo ancho. ─────────────────────────────────────────────────────────── */
@container hc (min-width:641px) and (max-width:1040px){
  .hc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .hc-c7,.hc-c5,.hc-c4,.hc-c3{grid-column:auto}
  .hc-hero,.hc-o-8{grid-column:1/-1}
  .hc-o-1{order:1}.hc-o-2{order:2}.hc-o-3{order:3}.hc-o-4{order:4}.hc-o-5{order:5}.hc-o-6{order:6}.hc-o-7{order:7}.hc-o-8{order:8}
}

/* ── El teléfono (pagina-390.png): una columna, padding 14, tarjetas con 20 ───────────── */
@container hc (max-width:640px){
  .hc-solo-tel{display:flex}
  .hc-solo-compu{display:none}
  .hc-vista{padding:17px 14px 93px}
  .hc-cab{flex-direction:column;align-items:stretch;gap:14px;margin-bottom:20px}
  .hc-titulo{font-size:26px;line-height:29.12px;letter-spacing:-.91px;margin-top:5px}
  .hc-bajada{margin-top:3px}
  .hc-cab__btns .hc-btn{flex:1;justify-content:center}
  .hc-grid{grid-template-columns:minmax(0,1fr);gap:12px}
  .hc-c7,.hc-c5,.hc-c4,.hc-c3{grid-column:auto}
  .hc-card{padding:20px}
  .hc-o-1{order:1}.hc-o-2{order:2}.hc-o-3{order:3}.hc-o-4{order:4}.hc-o-5{order:5}.hc-o-6{order:6}.hc-o-7{order:7}.hc-o-8{order:8}
  .hc-hero{grid-template-columns:minmax(0,1fr);row-gap:18px;padding:20px}
  .hc-hero__num{font-size:46px;line-height:46px;letter-spacing:-2.3px}
  .hc-hero__delta{margin-top:11px}
  .hc-hero__goal{margin-top:19px}
  .hc-hero__stats{flex-direction:row;margin:0;padding:22px 0 7px;box-shadow:0 -1px 0 #eef7f729;display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
  .hc-stat{padding:0 0 0 12px;box-shadow:-1px 0 0 #eef7f71f}
  .hc-stat:first-child{padding-left:0;box-shadow:none}
  .hc-stat dd{font-size:20px;letter-spacing:-.7px;line-height:22px}
  .hc-big{margin-top:12px}
  .hc-big__n{font-size:32px;line-height:32px;letter-spacing:-1.44px}
  .hc-stages{height:34px;margin-top:18px}
  .hc-legend{row-gap:10px;margin-top:15px}
  .hc-rev .hc-card__h{flex-direction:column;align-items:stretch;gap:11px}
  .hc-rev .hc-card__h .hc-card__s{margin-top:4px}
  .hc-bars{min-height:178px;column-gap:8px;margin-top:32px}
  .hc-bar__track{width:100%}
  .hc-deals{margin-top:11px}
  .hc-ditem{padding:9px 0 8px}
  .hc-aitems{gap:8px;margin-top:12px}
  .hc-btn-line{margin-top:14px}
  .hc-aitem{padding:9px 12px 9px 10px}
  .hc-quota{gap:12px;margin-top:16px}
  .hc-lrow{grid-template-columns:34px 1fr auto}
  .hc-ava{width:34px;height:34px;font-size:11.5px;letter-spacing:.23px}
  .hc-meter{margin-top:6px}
  .hc-dg{height:46.4px;line-height:46.4px}
  .hc-dialer__clock{font-size:32px;letter-spacing:-.64px;margin-top:0}
  .hc-tbtns{margin-top:13px}
  .hc-join{margin-top:20px}
  .hc-tbtn{width:44px;height:44px}
  .hc-durs{margin-top:13px}
  .hc-dur{height:44px}
}

/* ── El movimiento: el estado de PARTIDA de lo que entra (lo pone closing.hc-js) ─────────── */
.hc[data-antes] [data-card]{opacity:0}
@media (prefers-reduced-motion:reduce){ .hc[data-antes] [data-card]{opacity:1} }

/* ── Lo que suma MaKo en el Dashboard: lo que dice que un bloque no tiene datos, sin inventar un cero ──── */
.hc-solo-tel{display:none}
@container hc (max-width:640px){ .hc-solo-tel{display:flex} }
.hc-vacio{flex:1;display:grid;place-items:center;text-align:center;font-size:13px;color:var(--faint);padding:12px 6px;line-height:18.85px}
.hc-c3 .hc-vacio,.hc-nextup .hc-vacio{color:var(--muted)}
.hc-ic--chica{width:9px;height:9px;stroke-width:3.4}
.hc-ditem--clic{cursor:pointer;border-radius:10px;transition:background-color .2s}
.hc-ditem--clic:hover{background:var(--panel)}

/* ── El primer contacto (5/11/2026): una fila entera abajo, con el número a la izquierda y los que más esperaron ──── */
.hc-c12{grid-column:1/-1}
.hc-contacto{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start;margin-top:4px}
.hc-contacto__stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}
.hc-contacto__stats dt{font-size:12px;font-weight:600;color:var(--muted);line-height:17.4px}
.hc-contacto__stats dd{font-size:20px;font-weight:800;letter-spacing:-.6px;line-height:24px;margin-top:3px;white-space:nowrap;font-variant-numeric:tabular-nums}
.hc-contacto__fila{display:flex;align-items:center;gap:12px;width:100%;color:inherit;text-decoration:none}
.hc-contacto__nota{grid-column:1/-1;font-size:12px;color:var(--muted);line-height:17.4px}
.hc-contacto__grabar{display:flex;flex-direction:column;gap:8px;padding:14px 16px;border-radius:12px;background:var(--amber-bg);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--amber) 30%,transparent)}
.hc-contacto__grabar-t{margin:0;font-size:13.5px;line-height:19.5px;color:var(--ink)}
.hc-contacto__pasos{margin:0;padding-left:20px;font-size:13px;line-height:19px;color:var(--ink);display:flex;flex-direction:column;gap:2px}
.hc-contacto__grabar .hc-btn{align-self:flex-start;height:36px;padding:0 16px;font-size:13.5px}
@container hc (max-width:1040px){ .hc-o-9{order:9} .hc-contacto{grid-template-columns:minmax(0,1fr);gap:16px} }
`;
