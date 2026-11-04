// =============================================================================
// focus-css — la hoja de estilos del DISEÑO de la hoja Focus: la copia de Pane, sólo de esta hoja
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia» y «Carga los de FOCUS
// que ya teníamos». Es docs/diseno/mockups-dashboard/focus-pane/pane.css (escrita desde lo MEDIDO del demo: valores.json,
// las capturas y el INFORME; nada del código de la tienda) con todo adentro de `.fp` y cada clase con el prefijo `fp-`,
// para no tocar nada del resto del Dashboard (la casa también tiene `.card`, `.btn`, `.grid`, `.chip`). Sin la barra
// lateral ni la de arriba de Pane: en MaKo las pone la app. La comparación con el original está en
// docs/relevo/nube-dashboards.md («Focus»).
//
// ⚠️ ESTA HOJA ES SÓLO DE FOCUS: otra hoja con diseño escribe la suya (la de su demo), no reusa ésta.
// ⚠️ PANE ES UN TEMA OSCURO DE VIDRIO, A PROPÓSITO: es la copia. Sus colores van en hex, como en el demo; el fondo es su
//    degradé medido (la foto borrosa de atrás no se copia).
// ⚠️ EL TELÉFONO VA POR @container (el ancho del lienzo), no por el de la ventana: el lienzo del Dashboard tiene la barra
//    de la app al lado. El medio (641 a 1040) NO está medido en Pane (sus capturas son 1440 y 390) y es nuestro.
// ⚠️ ES UN TEMPLATE LITERAL: adentro no va NINGUNA comilla invertida, ni el signo de pesos seguido de llave.

export const CSS_FOCUS = `
.fp{
  container-type:inline-size;container-name:fp;
  --font:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
  --fp-title:clamp(34px,2.2vw + 14px,58px);
  --r-xl:30px; --r-lg:24px; --r-md:18px; --r-sm:12px;
  --gap:clamp(12px,.6vw + 8px,20px);
  --ease:cubic-bezier(.22,.8,.24,1);
  --blue:#4b8eff; --purple:#a07cff; --pink:#f2649f; --orange:#ff8a3d; --green:#34c46b; --teal:#22c3c0; --indigo:#7a7af0; --yellow:#f5b82e;
  --ring-tasks:#ff2d6f; --ring-focus:#4ade6b; --ring-meet:#22c3f0; --danger:#ff5a64;
  --accent-soft:color-mix(in srgb,#1f6fe6 14%,transparent);
  --glass:rgb(26 26 36 / .42);
  --text:#f5f5f7; --muted:rgba(235,235,245,.7); --faint:rgba(235,235,245,.55);
  --fill:rgba(150,150,175,.16); --fill-hover:rgba(150,150,175,.22); --hair:rgba(255,255,255,.08);
  --link:#7db4ff; --up:#5fd88a;
  --glass-sombra:rgba(255,255,255,.3) 0 1px 1px 0 inset,rgba(255,255,255,.1) 0 -1px 1px 0 inset,rgba(255,255,255,.24) 3px 4px 12px -6px inset,
    rgba(255,255,255,.12) -4px -6px 14px -8px inset,rgba(0,0,0,.45) 0 -16px 28px -18px inset,rgba(0,0,0,.3) 0 1px 2px 0,rgba(0,0,0,.25) 0 12px 30px -12px;
}
.fp{color:var(--text);font:400 15px/1.45 var(--font);font-optical-sizing:auto;-webkit-font-smoothing:antialiased;min-height:100%;
  background:linear-gradient(#232428 0,#16171b 900px,#101010 900px) #101010}
.fp *{box-sizing:border-box}
.fp :where(h1,h2,p,ul,li){margin:0;padding:0}
.fp :where(ul){list-style:none}
.fp :where(button){font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.fp :where(a){color:inherit;text-decoration:none}
.fp-i{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.fp :where(a,button,[role=button]):focus-visible{outline:2.5px solid #7db4ff;outline-offset:2px}

.fp-glass{background:var(--glass);box-shadow:var(--glass-sombra);-webkit-backdrop-filter:blur(24px) saturate(1.4);backdrop-filter:blur(24px) saturate(1.4)}

/* la página: la adaptación (focus.html), sin el armazón de Pane */
.fp-page{margin:0 auto;max-width:1180px;padding:14px 26px 48px}
.fp-head{display:flex;align-items:flex-end;gap:16px;margin-bottom:23px}
.fp-title{font:700 var(--fp-title)/1.02 var(--font);letter-spacing:-.03em}
.fp-title .fp-l{display:inline-block;white-space:pre}
.fp-title .fp-w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.06em}
.fp-sub{margin-top:6px;color:var(--muted);font-size:17px;font-weight:500;line-height:24.65px}
.fp-stats{display:flex;gap:10px;margin-top:19px}
.fp-stat{min-width:112px;height:65px;padding:11px 16px 0;border-radius:var(--r-md);white-space:nowrap}
.fp-stat__l{color:var(--muted);font-size:12.5px;font-weight:560;line-height:18.125px}
.fp-stat__v{font-size:22px;font-weight:900;line-height:24.2px;letter-spacing:-.44px;font-variant-numeric:tabular-nums}
.fp-stat__v small{color:var(--muted);font-size:14px;font-weight:600;letter-spacing:-.44px}
.fp-actions{margin-left:auto;display:flex;gap:10px;margin-bottom:12px}
.fp-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:42px;padding:0 20px 0 18px;border-radius:21px;font-size:15px;font-weight:600;white-space:nowrap;transition:background .2s,color .2s,box-shadow .2s}
.fp-btn--glass{background:rgba(255,255,255,.14);box-shadow:rgba(255,255,255,.4) 0 1px 1px 0 inset,rgba(255,255,255,.06) 0 -1px 2px 0 inset,rgba(0,0,0,.3) 0 2px 6px -2px}
.fp-btn--glass:hover{background:rgba(255,255,255,.2)}
.fp-btn--accent{color:#fff;background:linear-gradient(180deg,#6aa6ff,#3d82f5);box-shadow:rgba(255,255,255,.6) 0 1px 1px 0 inset,rgba(0,0,0,.14) 0 -2px 4px 0 inset,rgba(61,130,245,.45) 0 8px 22px -8px}
.fp-btn--accent:hover{filter:brightness(1.06)}
.fp-btn--sm{height:34px;padding:0 13px;border-radius:17px;font-size:14px}
.fp-btn--ghost{color:var(--link)}
.fp-btn--ghost:hover{background:var(--accent-soft)}

.fp-grid{display:grid;gap:calc(var(--gap) + .36px)}
.fp-row1{grid-template-columns:repeat(3,minmax(0,1fr))}
.fp-row2{grid-template-columns:minmax(0,458fr) minmax(0,647fr);margin-top:calc(var(--gap) + .36px)}
.fp-row3{grid-template-columns:minmax(0,647fr) minmax(0,458fr);margin-top:calc(var(--gap) + .36px)}
.fp-card{position:relative;border-radius:var(--r-xl);padding:20.64px;min-width:0;display:flex;flex-direction:column}
.fp-row1 .fp-card{height:368px}.fp-row2 .fp-card{height:564px}.fp-row3 .fp-card{height:434px}
.fp-card__h{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.fp-card__t{font-size:17px;font-weight:650;line-height:21.25px;letter-spacing:-.17px}
.fp-card__s{margin-top:1px;color:var(--muted);font-size:13.5px;line-height:19.575px}
.fp-card__h .fp-btn--sm{margin:-2px -3px 0 0}
.fp-ibtn{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;transition:background .2s}
.fp-ibtn:hover{background:var(--fill-hover)}
.fp-vacio{margin:auto 0;padding:18px 4px;color:var(--muted);font-size:14px;line-height:20px;text-align:center}

/* Hoy: los anillos (14 de trazo, radios 53 · 38,5 · 24 en un lienzo de 120) */
.fp-rings{flex:1;display:flex;align-items:center;justify-content:center;gap:28px;padding-top:14px}
.fp-rings svg{width:120px;height:120px;display:block}
.fp-rings .tr{fill:none;stroke-width:14}
.fp-rings .ar{fill:none;stroke-width:14;stroke-linecap:round}
.fp-rings__l{display:flex;flex-direction:column;gap:12.5px}
.fp-rk{height:44px;padding-left:12px;border-left:3px solid}
.fp-rk__l{color:var(--muted);font-size:13px;font-weight:600;line-height:18.85px}
.fp-rk__v{font-size:22px;font-weight:900;line-height:24.2px;letter-spacing:-.44px}
.fp-rk__v small{color:var(--muted);font-size:14px;font-weight:600}

/* Lo que viene */
.fp-next{display:flex;flex-direction:column;gap:6px;margin-top:14px;padding:16px;border-radius:20px;text-align:left;color:var(--text);
  background:color-mix(in srgb,var(--blue) 16%,rgba(255,255,255,.04));box-shadow:color-mix(in srgb,var(--blue) 26%,transparent) 0 0 0 1px inset;transition:background .2s}
a.fp-next:hover{background:color-mix(in srgb,var(--blue) 20%,rgba(255,255,255,.05))}
.fp-next__en{color:var(--muted);font-size:13px;font-weight:650;line-height:18.85px}
.fp-next__en b{color:var(--text);font-weight:700}
.fp-next__t{font-size:19px;font-weight:650;line-height:22.8px;letter-spacing:-.19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-next__m{color:var(--muted);font-size:14px;line-height:20.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-next__pie{display:flex;align-items:center;justify-content:flex-end;margin-top:6px}
.fp-btn--join{height:32px;padding:0 14px;gap:7px;border-radius:16px;font-size:14px}
.fp-ev{display:flex;align-items:center;gap:12px;height:39px;padding-left:20px;position:relative;text-align:left;width:100%}
.fp-ev::before{content:"";position:absolute;left:6px;top:9px;bottom:9px;width:3px;border-radius:2px;background:var(--c,var(--pink))}
.fp-ev b{font-size:14.5px;font-weight:550;line-height:21px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-ev span{margin-left:auto;color:var(--muted);font-size:14px;flex:none}
.fp-evs{margin-top:10px}

/* La meta (en Pane, el temporizador de foco) */
.fp-seg{position:relative;display:inline-flex;flex:none;padding:3px;border-radius:17px;background:var(--fill)}
.fp-seg__pill{position:absolute;top:3px;left:0;width:100px;height:28px;border-radius:14px;background:rgba(255,255,255,.18);box-shadow:rgba(255,255,255,.3) 0 1px 1px 0 inset;transform-origin:left center}
.fp-seg__btn{position:relative;z-index:1;height:28px;padding:0 11px;border-radius:14px;color:var(--muted);font-size:13px;font-weight:600;transition:color .2s}
.fp-seg__btn[aria-pressed=true]{color:var(--text)}
.fp-focus__b{display:flex;align-items:center;gap:22px;margin-top:17px;padding-left:5px}
.fp-timer{position:relative;width:98px;height:98px;flex:none;display:grid;place-content:center;text-align:center;border-radius:50%;box-shadow:inset 0 0 0 6px rgba(150,150,175,.22)}
.fp-timer b{display:block;font-size:24px;font-weight:650;line-height:24px;letter-spacing:-.48px;font-variant-numeric:tabular-nums}
.fp-timer small{display:block;margin-top:4px;color:var(--muted);font-size:12px;font-weight:600;line-height:17.4px}
.fp-focus__c{flex:1;min-width:0}
.fp-focus__on{color:var(--muted);font-size:12.5px;font-weight:600;line-height:18.125px;margin-bottom:4px}
.fp-select{display:block;width:100%;height:40px;padding:0 12px;border-radius:var(--r-sm);background:var(--fill);font-size:14.5px;font-weight:520;line-height:40px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fp-focus__go{width:100%;margin-top:7px}
.fp-well{margin-top:auto;padding:13px 14px 12px;border-radius:var(--r-md);background:var(--fill)}
.fp-well__r{display:flex;justify-content:space-between;gap:10px;color:var(--muted);font-size:13px;font-weight:560;line-height:18.85px}
.fp-well__r b{color:var(--text);font-size:14px;font-weight:650;white-space:nowrap}
.fp-bar{height:5px;margin-top:9px;border-radius:3px;background:rgba(150,150,175,.28);overflow:hidden}
.fp-bar i{display:block;height:100%;border-radius:3px;background:var(--orange);transform-origin:left center}

/* Mis tareas */
.fp-tasks{margin-top:14px;min-height:0;overflow:hidden}
.fp-task{display:grid;grid-template-columns:22px minmax(0,1fr) auto;column-gap:12px;align-items:center;height:67px;padding:0 4px;border-bottom:1px solid var(--hair)}
.fp-task:last-child{border-bottom:0}
.fp-check{width:22px;height:22px;border-radius:50%;border:1.5px solid rgba(235,235,245,.38);display:grid;place-items:center;transition:background .2s,border-color .2s}
button.fp-check:hover{border-color:rgba(235,235,245,.7)}
.fp-check--on{background:var(--blue);border-color:var(--blue)}
.fp-check--on .fp-i{width:14px;height:14px;stroke-width:2.6;color:#fff}
.fp-task__t{font-size:15px;font-weight:560;line-height:21.75px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-task--hecha .fp-task__t{color:var(--faint);text-decoration:line-through}
.fp-task__m{display:flex;align-items:center;gap:10px;margin-top:3px;color:var(--muted);font-size:13px;line-height:18.85px;min-width:0}
.fp-chip{display:inline-flex;align-items:center;gap:6px;height:21px;padding:0 8px 0 7px;border-radius:7px;font-size:12px;font-weight:600;line-height:12px;color:var(--text);background:color-mix(in srgb,var(--c) 22%,transparent);min-width:0;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.fp-dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--c)}
.fp-prio{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 8px;border-radius:7px;font-size:12px;font-weight:650;line-height:12px}
.fp-prio--alta{color:#ffb27a;background:rgba(255,138,61,.16)}
.fp-prio--urgente{color:#ff8b92;background:rgba(255,90,100,.14)}
.fp-prio .fp-i{width:12px;height:12px;stroke-width:2}

/* La semana */
.fp-big{display:flex;align-items:baseline;gap:8px;margin-top:11px}
.fp-big>b{font-size:28px;font-weight:700;line-height:28px;letter-spacing:-.56px}
.fp-big>span{color:var(--muted);font-size:15px}
.fp-big>em{margin-left:4px;font-style:normal;color:var(--up);font-size:12.5px;font-weight:650}
.fp-big em.fp-malo{color:#ff8b92}
.fp-bars{flex:1;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));column-gap:9px;margin-top:16px;min-height:0}
.fp-bar7{display:flex;flex-direction:column;min-height:0}
.fp-bar7__t{position:relative;flex:1;border-radius:13px;background:rgba(150,150,175,.16);overflow:hidden}
.fp-bar7__f{position:absolute;left:0;right:0;bottom:0;border-radius:13px;background:linear-gradient(180deg,#6c98d6,#5b85c0);transform-origin:bottom center}
.fp-bar7--hoy .fp-bar7__f{background:linear-gradient(180deg,#8cc0ff,#6fa6f2)}
.fp-bar7__f--cero{height:3px !important;border-radius:2px;background:#4e6fa3}
.fp-bar7__l{margin-top:9px;text-align:center;color:var(--muted);font-size:12px;font-weight:560;line-height:17.4px}
.fp-bar7--hoy .fp-bar7__l{color:var(--text)}

/* Proyectos */
.fp-projs{margin-top:15px;min-height:0;overflow:hidden}
.fp-hproject{display:grid;grid-template-columns:38px minmax(0,1fr) 171px 42px 64px;column-gap:14px;align-items:center;height:61.5px;border-bottom:1px solid var(--hair);padding:0 7px 0 6px}
li:last-child>.fp-hproject{border-bottom:0}
.fp-tile{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;color:#fff;font-size:17px;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 82%,#fff),var(--c));box-shadow:rgba(255,255,255,.4) 0 1px 1px 0 inset}
.fp-hproject b{display:block;font-size:15px;font-weight:600;line-height:21px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-hproject small{display:block;color:var(--muted);font-size:13px;line-height:18.85px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-hproject__bar{height:6px;border-radius:3px;background:rgba(150,150,175,.2);overflow:hidden}
.fp-hproject__bar i{display:block;height:100%;border-radius:3px;background:var(--c);transform-origin:left center}
.fp-hproject__pct{text-align:right;font-size:13.5px;font-weight:650}
.fp-mas{display:grid;place-items:center;justify-self:end;height:24px;min-width:24px;padding:0 5px;border-radius:12px;background:#34343c;color:var(--muted);font-size:12px;font-weight:650;line-height:12px;border:2px solid #1c1c22;white-space:nowrap}

/* Te está esperando (en Pane, «Right now») */
.fp-people{margin-top:12px;min-height:0;overflow:hidden}
.fp-person{display:flex;align-items:center;gap:12px;height:58px;padding:0 4px;min-width:0}
.fp-ava{position:relative;width:36px;height:36px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:12px;font-weight:700;color:#1a1a20}
.fp-ava i{position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:50%;border:2px solid #1c1c22}
.fp-person b{display:block;font-size:15px;font-weight:600;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-person small{display:block;color:var(--muted);font-size:13px;line-height:18.85px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fp-person>span:last-child{min-width:0}

/* el medio (641 a 1040, nuestro): dos tarjetas por fila arriba, y las de abajo a lo ancho */
@container fp (max-width:1040px){
  .fp-row1{grid-template-columns:repeat(2,minmax(0,1fr))}
  .fp-row1 .fp-card:nth-child(3){grid-column:1 / -1;height:auto}
  .fp-row1 .fp-card:nth-child(3) .fp-well{margin-top:18px}
  .fp-row2,.fp-row3{grid-template-columns:minmax(0,1fr)}
  .fp-row2 .fp-card,.fp-row3 .fp-card{height:auto}
  .fp-bars{min-height:200px;height:220px;flex:none}
}
/* el teléfono (medido a 390) */
@container fp (max-width:640px){
  .fp-page{padding:20px 14px 40px}
  .fp-head{flex-direction:column;align-items:stretch;gap:14px;margin-bottom:18px}
  .fp-sub{font-size:14.5px;line-height:20px;margin-top:6px}
  .fp-stats{margin-top:14px;gap:8px}
  .fp-stat{flex:1;min-width:0;width:auto;height:60px;padding:9px 12px 0}
  .fp-actions{margin:0}
  .fp-actions .fp-btn{flex:1}
  .fp-row1,.fp-row2,.fp-row3{grid-template-columns:minmax(0,1fr)}
  .fp-row1 .fp-card,.fp-row2 .fp-card,.fp-row3 .fp-card{height:auto}
  .fp-rings{padding:8px 0 4px}
  .fp-bars{min-height:120px;height:140px;flex:none}
  .fp-hproject{grid-template-columns:38px minmax(0,1fr) 46px;grid-template-rows:auto auto;row-gap:10px;height:auto;padding:14px 4px 16px}
  .fp-hproject .fp-tile{grid-row:1;grid-column:1}
  .fp-hproject>span:nth-child(2){grid-row:1;grid-column:2;min-width:0}
  .fp-hproject__pct{grid-row:1;grid-column:3}
  .fp-hproject__bar{grid-row:2;grid-column:2 / -1}
  .fp-hproject .fp-mas{display:none}
}
.fp[data-antes] [data-card],.fp[data-antes] [data-stat]{opacity:0}
@media (prefers-reduced-motion:reduce){ .fp[data-antes] [data-card],.fp[data-antes] [data-stat]{opacity:1} .fp *{transition:none !important} }
`;
