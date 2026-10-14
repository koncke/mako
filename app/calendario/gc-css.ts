// =============================================================================
// gc-css — la hoja de la copia de Google Calendar (la tab Calendario), limitada a `.gc`
// =============================================================================
// Martín, 14/10/2026: «el calendario quiero que sea una copia fiel a Google Calendar». Como el editor del Dashboard
// copia a Looker (`.lk`, app/dashboard/editor-css.ts) y /api-mako a GitHub (`.gh`), ésta copia la web de Google Calendar
// (la de Material 3): la barra de 64 px con «Hoy», las flechas y el título; «Crear» flotante; el mes chico; «Mis
// calendarios» con sus casillas de color; la hoja blanca redondeada; la grilla de 48 px por hora con la línea roja de
// ahora; los eventos llenos del color de su calendario, y la tarjeta que se abre al hacer clic. Lo que se copia es la
// ESTRUCTURA y las medidas; los colores de superficie salen de los tokens de la casa, así el modo oscuro se da vuelta
// solo (la regla de las pantallas oscuras). Los colores de los EVENTOS son los de Google (lib/calendario-google-modelo.ts).
//
// ⚠️ Sin backticks adentro: es un template literal.
// =============================================================================

export const HORA_PX = 48;

export const CSS_GC = `
.gc{--gc-azul:var(--primary);--gc-azul-suave:var(--primary-bg);--gc-fondo:var(--bg);--gc-hoja:var(--surface);--gc-borde:var(--border);--gc-linea:var(--border);--gc-tinta:var(--ink);--gc-gris:var(--dim);--gc-tenue:var(--faint);--gc-ahora:#ea4335;--gc-sombra:0 1px 2px 0 rgba(60,64,67,.3),0 2px 6px 2px rgba(60,64,67,.15);display:flex;flex-direction:column;height:100%;min-height:0;background:var(--gc-fondo);color:var(--gc-tinta);font-size:14px}
.gc *{box-sizing:border-box}
.gc button{font-family:inherit}
.gc-barra{display:flex;align-items:center;gap:4px;height:64px;padding:0 12px 0 8px;flex:none}
.gc-ico{width:40px;height:40px;flex:none;border-radius:50%;border:none;background:transparent;display:inline-grid;place-items:center;color:var(--gc-gris);cursor:pointer;padding:0}
.gc-ico:hover{background:color-mix(in srgb,var(--gc-tinta) 8%,transparent);color:var(--gc-tinta)}
.gc-ico:focus-visible{outline:2px solid var(--gc-azul);outline-offset:1px}
.gc-ico--chico{width:28px;height:28px}
.gc-logo{display:flex;align-items:center;gap:10px;padding:0 24px 0 4px;min-width:212px;text-decoration:none}
.gc-logo-dia{width:36px;height:36px;border-radius:9px;background:var(--gc-azul);color:#fff;display:grid;place-items:center;font-weight:600;font-size:15px;box-shadow:inset 0 -3px 0 color-mix(in srgb,#000 18%,transparent)}
.gc-logo-txt{font-size:22px;color:var(--gc-tinta);letter-spacing:-.01em}
.gc-hoy{height:40px;padding:0 22px;border-radius:999px;border:1px solid var(--border-strong);background:transparent;color:var(--gc-tinta);font-size:14px;font-weight:500;cursor:pointer;margin-right:8px}
.gc-hoy:hover{background:color-mix(in srgb,var(--gc-tinta) 6%,transparent)}
.gc-titulo{font-size:22px;font-weight:400;margin:0 0 0 12px;color:var(--gc-tinta);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.gc-titulo::first-letter{text-transform:uppercase}
.gc-derecha{margin-left:auto;display:flex;align-items:center;gap:6px}
.gc-vista{position:relative}
.gc-vista-boton{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px 0 18px;border-radius:999px;border:1px solid var(--border-strong);background:transparent;color:var(--gc-tinta);font-size:14px;font-weight:500;cursor:pointer}
.gc-vista-boton:hover{background:color-mix(in srgb,var(--gc-tinta) 6%,transparent)}
.gc-menu{position:fixed;z-index:120;min-width:200px;padding:8px 0;border-radius:6px;background:var(--gc-hoja);box-shadow:var(--gc-sombra);border:1px solid var(--gc-borde)}
.gc-menu button{display:flex;align-items:center;justify-content:space-between;gap:24px;width:100%;height:36px;padding:0 16px;border:none;background:transparent;color:var(--gc-tinta);font-size:14px;cursor:pointer;text-align:left}
.gc-menu button:hover,.gc-menu button[aria-checked="true"]{background:color-mix(in srgb,var(--gc-tinta) 7%,transparent)}
.gc-menu kbd{font:inherit;font-size:12px;color:var(--gc-gris)}
.gc-menu-sep{height:1px;margin:8px 0;background:var(--gc-borde)}
.gc-cuerpo{display:flex;flex:1;min-height:0}
.gc-lado{width:256px;flex:none;padding:8px 0 16px;overflow-y:auto;display:flex;flex-direction:column}
.gc-lado[hidden]{display:none}
.gc-crear{display:inline-flex;align-items:center;gap:12px;height:56px;padding:0 20px 0 16px;margin:0 0 20px 8px;border-radius:16px;border:none;background:var(--gc-hoja);box-shadow:var(--gc-sombra);font-size:14px;font-weight:500;color:var(--gc-tinta);cursor:pointer;align-self:flex-start;transition:box-shadow .15s ease}
.gc-crear:hover{box-shadow:0 1px 3px 0 rgba(60,64,67,.3),0 4px 8px 3px rgba(60,64,67,.15);background:color-mix(in srgb,var(--gc-azul) 4%,var(--gc-hoja))}
.gc-mini{padding:0 12px 0 20px;margin-bottom:16px}
.gc-mini-cab{display:flex;align-items:center;justify-content:space-between;height:32px;padding-left:4px}
.gc-mini-mes{font-size:14px;font-weight:500;color:var(--gc-tinta)}
.gc-mini-mes::first-letter{text-transform:uppercase}
.gc-mini-grilla{display:grid;grid-template-columns:repeat(7,1fr);row-gap:2px}
.gc-mini-ini{height:24px;display:grid;place-items:center;font-size:10px;font-weight:500;color:var(--gc-gris)}
.gc-mini-dia{width:24px;height:24px;margin:0 auto;border-radius:50%;border:none;background:transparent;display:grid;place-items:center;font-size:10px;font-weight:500;color:var(--gc-tinta);cursor:pointer;padding:0}
.gc-mini-dia:hover{background:color-mix(in srgb,var(--gc-tinta) 9%,transparent)}
.gc-mini-dia--afuera{color:var(--gc-tenue)}
.gc-mini-dia--semana{background:var(--gc-azul-suave)}
.gc-mini-dia--elegido{background:color-mix(in srgb,var(--gc-azul) 22%,transparent);color:var(--gc-azul)}
.gc-mini-dia--hoy,.gc-mini-dia--hoy:hover{background:var(--gc-azul);color:#fff}
.gc-grupo{padding:0 8px 0 12px}
.gc-grupo-cab{display:flex;align-items:center;justify-content:space-between;width:100%;height:40px;padding:0 4px 0 12px;border:none;border-radius:8px;background:transparent;color:var(--gc-tinta);font-size:14px;font-weight:500;cursor:pointer;text-align:left}
.gc-grupo-cab:hover{background:color-mix(in srgb,var(--gc-tinta) 6%,transparent)}
.gc-grupo-cab span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gc-cal{display:flex;align-items:center;gap:14px;width:100%;min-height:32px;padding:4px 8px 4px 14px;border:none;border-radius:8px;background:transparent;color:var(--gc-tinta);font-size:14px;cursor:pointer;text-align:left}
.gc-cal:hover{background:color-mix(in srgb,var(--gc-tinta) 6%,transparent)}
.gc-casilla{width:18px;height:18px;flex:none;border-radius:3px;border:2px solid;display:grid;place-items:center;color:#fff}
.gc-cal-nombre{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gc-aviso{margin:4px 12px 0 26px;font-size:12px;line-height:1.45;color:var(--gc-gris)}
.gc-aviso a{color:var(--gc-azul);font-weight:500;text-decoration:none}
.gc-aviso--mal{color:var(--warn)}
.gc-hoja{flex:1;min-width:0;background:var(--gc-hoja);border-radius:24px 24px 0 0;margin-right:16px;display:flex;flex-direction:column;overflow:hidden}
.gc-hoja[data-lado="no"]{margin-left:16px}
.gc-cab{display:grid;flex:none;border-bottom:1px solid var(--gc-linea)}
.gc-cab-dia{display:flex;flex-direction:column;align-items:center;padding-top:14px;padding-bottom:6px;border-left:1px solid transparent}
.gc-cab-sem{font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--gc-gris)}
.gc-cab-num{width:46px;height:46px;margin-top:4px;border-radius:50%;border:none;background:transparent;display:grid;place-items:center;font-size:26px;font-weight:400;color:var(--gc-tinta);cursor:pointer;padding:0}
.gc-cab-num:hover{background:color-mix(in srgb,var(--gc-tinta) 8%,transparent)}
.gc-cab-dia--hoy .gc-cab-sem{color:var(--gc-azul)}
.gc-cab-dia--hoy .gc-cab-num,.gc-cab-dia--hoy .gc-cab-num:hover{background:var(--gc-azul);color:#fff}
.gc-cab-dia--pasado .gc-cab-num{color:var(--gc-gris)}
.gc-zona{font-size:10px;color:var(--gc-gris);align-self:end;justify-self:end;padding:0 8px 6px 0}
.gc-todo{position:relative;display:grid;flex:none;border-bottom:1px solid var(--gc-linea)}
.gc-todo-capa{position:relative;grid-column:2 / -1}
.gc-scroll{flex:1;min-height:0;overflow-y:auto;position:relative}
.gc-grilla{display:grid;position:relative}
.gc-hora{position:relative;height:${HORA_PX}px;font-size:10px;color:var(--gc-gris);text-align:right;padding-right:8px}
.gc-hora span{position:relative;top:-7px}
.gc-col{position:relative;border-left:1px solid var(--gc-linea);background-image:linear-gradient(to bottom,var(--gc-linea) 1px,transparent 1px);background-size:100% ${HORA_PX}px;cursor:default}
.gc-col--hoy{background-color:transparent}
.gc-ahora{position:absolute;left:-1px;right:0;height:2px;background:var(--gc-ahora);z-index:4;pointer-events:none}
.gc-ahora::before{content:"";position:absolute;left:-6px;top:-5px;width:12px;height:12px;border-radius:50%;background:var(--gc-ahora)}
.gc-ev{position:absolute;z-index:2;border-radius:6px;padding:2px 6px;overflow:hidden;color:#fff;font-size:12px;line-height:1.3;cursor:pointer;border:1px solid var(--gc-hoja);text-align:left;font-family:inherit;user-select:none;-webkit-user-select:none}
.gc-ev:focus-visible{outline:2px solid var(--gc-tinta);outline-offset:1px}
.gc-ev b{font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gc-ev i{font-style:normal;opacity:.92;white-space:nowrap}
.gc-ev--uno b{display:inline}
.gc-ev--hecho{opacity:.6}
.gc-ev--hecho b{text-decoration:line-through}
.gc-ev--rechazado{background:var(--gc-hoja)!important;border:1px solid currentColor!important;background-image:repeating-linear-gradient(-45deg,transparent 0 6px,color-mix(in srgb,currentColor 12%,transparent) 6px 7px)!important}
.gc-ev--rechazado b{text-decoration:line-through}
.gc-ev--arrastrando{opacity:.85;box-shadow:0 6px 10px 0 rgba(60,64,67,.3),0 2px 3px 0 rgba(60,64,67,.15);z-index:6}
.gc-ev-tirador{position:absolute;left:0;right:0;bottom:0;height:8px;cursor:ns-resize}
.gc-fantasma{position:absolute;z-index:5;border-radius:6px;background:var(--gc-azul);color:#fff;font-size:12px;padding:2px 6px;pointer-events:none;box-shadow:var(--gc-sombra)}
.gc-barrita{position:absolute;height:22px;border-radius:4px;padding:0 8px;color:#fff;font-size:12px;font-weight:500;line-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;border:none;text-align:left;font-family:inherit}
.gc-barrita--antes{border-top-left-radius:0;border-bottom-left-radius:0}
.gc-barrita--despues{border-top-right-radius:0;border-bottom-right-radius:0}
.gc-mes{flex:1;min-height:0;display:grid;grid-template-rows:auto 1fr}
.gc-mes-sem{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--gc-linea)}
.gc-mes-sem div{font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--gc-gris);text-align:center;padding:10px 0 4px}
.gc-mes-filas{display:grid;min-height:0}
.gc-mes-fila{position:relative;display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid var(--gc-linea);min-height:0;overflow:hidden}
.gc-mes-celda{border-left:1px solid var(--gc-linea);display:flex;flex-direction:column;align-items:stretch;min-width:0;padding:4px 0 2px}
.gc-mes-celda:first-child{border-left:none}
.gc-mes-num{align-self:center;min-width:24px;height:24px;padding:0 6px;border-radius:999px;border:none;background:transparent;font-size:12px;font-weight:500;color:var(--gc-tinta);cursor:pointer;margin-bottom:2px}
.gc-mes-num:hover{background:color-mix(in srgb,var(--gc-tinta) 8%,transparent)}
.gc-mes-celda--afuera .gc-mes-num{color:var(--gc-tenue)}
.gc-mes-celda--hoy .gc-mes-num,.gc-mes-celda--hoy .gc-mes-num:hover{background:var(--gc-azul);color:#fff}
.gc-chip{display:flex;align-items:center;gap:6px;width:calc(100% - 8px);margin:0 4px 1px;height:20px;padding:0 6px;border-radius:4px;border:none;background:transparent;color:var(--gc-tinta);font-size:12px;cursor:pointer;text-align:left;min-width:0;font-family:inherit}
.gc-chip:hover{background:color-mix(in srgb,var(--gc-tinta) 7%,transparent)}
.gc-chip-punto{width:8px;height:8px;border-radius:50%;flex:none}
.gc-chip-hora{flex:none;color:var(--gc-gris)}
.gc-chip-txt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.gc-mas{margin:0 4px;height:20px;padding:0 6px;border:none;border-radius:4px;background:transparent;color:var(--gc-tinta);font-size:12px;font-weight:600;cursor:pointer;text-align:left;font-family:inherit}
.gc-mas:hover{background:color-mix(in srgb,var(--gc-tinta) 7%,transparent)}
.gc-anio{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:28px 32px;padding:24px 32px}
.gc-anio .gc-mini{padding:0;margin:0}
.gc-agenda{flex:1;overflow-y:auto;padding:8px 0}
.gc-ag-dia{display:grid;grid-template-columns:116px 1fr;border-bottom:1px solid var(--gc-linea);padding:10px 0}
.gc-ag-fecha{display:flex;align-items:flex-start;gap:6px;padding-left:16px}
.gc-ag-num{width:32px;height:32px;border-radius:50%;border:none;background:transparent;display:grid;place-items:center;font-size:22px;color:var(--gc-tinta);cursor:pointer;padding:0}
.gc-ag-num:hover{background:color-mix(in srgb,var(--gc-tinta) 8%,transparent)}
.gc-ag-dia--hoy .gc-ag-num{background:var(--gc-azul);color:#fff}
.gc-ag-sem{font-size:11px;font-weight:500;text-transform:uppercase;color:var(--gc-gris);margin-top:9px;letter-spacing:.04em}
.gc-ag-dia--hoy .gc-ag-sem{color:var(--gc-azul)}
.gc-ag-fila{display:grid;grid-template-columns:20px 180px 1fr;align-items:center;gap:12px;width:100%;min-height:36px;padding:0 16px 0 8px;border:none;border-radius:999px;background:transparent;color:var(--gc-tinta);font-size:14px;cursor:pointer;text-align:left;font-family:inherit}
.gc-ag-fila:hover{background:color-mix(in srgb,var(--gc-tinta) 6%,transparent)}
.gc-ag-punto{width:12px;height:12px;border-radius:50%;justify-self:center}
.gc-ag-hora{color:var(--gc-tinta);font-size:13px}
.gc-ag-titulo{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.gc-ag-vacio{padding:48px 24px;text-align:center;color:var(--gc-gris)}
.gc-tarjeta{position:fixed;z-index:110;width:448px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);overflow-y:auto;border-radius:16px;background:var(--gc-hoja);box-shadow:0 24px 38px 3px rgba(0,0,0,.14),0 9px 46px 8px rgba(0,0,0,.12),0 11px 15px -7px rgba(0,0,0,.2);color:var(--gc-tinta);padding:8px 8px 20px}
.gc-tarjeta-iconos{display:flex;justify-content:flex-end;gap:2px;margin-bottom:4px}
.gc-tarjeta-fila{display:grid;grid-template-columns:40px 1fr;align-items:start;gap:12px;padding:6px 16px 6px 12px;font-size:14px;line-height:1.5}
.gc-tarjeta-fila > :first-child{display:grid;place-items:center;height:22px;color:var(--gc-gris)}
.gc-tarjeta-titulo{font-size:22px;line-height:28px;font-weight:400;margin:0;word-break:break-word}
.gc-tarjeta-sub{color:var(--gc-tinta);font-size:14px}
.gc-cuadro{width:16px;height:16px;border-radius:4px;margin-top:6px}
.gc-boton-azul{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 20px;border-radius:999px;border:none;background:var(--gc-azul);color:#fff;font-size:14px;font-weight:500;cursor:pointer;text-decoration:none}
.gc-boton-azul:hover{filter:brightness(1.08)}
.gc-boton-azul:disabled{opacity:.5;cursor:default}
.gc-boton-texto{display:inline-flex;align-items:center;height:36px;padding:0 14px;border-radius:999px;border:none;background:transparent;color:var(--gc-azul);font-size:14px;font-weight:500;cursor:pointer;text-decoration:none}
.gc-boton-texto:hover{background:var(--gc-azul-suave)}
.gc-desc{white-space:pre-wrap;word-break:break-word;color:var(--gc-tinta)}
.gc-rapido{position:fixed;z-index:110;width:460px;max-width:calc(100vw - 24px);border-radius:16px;background:var(--gc-hoja);box-shadow:0 24px 38px 3px rgba(0,0,0,.14),0 9px 46px 8px rgba(0,0,0,.12),0 11px 15px -7px rgba(0,0,0,.2);color:var(--gc-tinta);padding:8px 8px 16px}
.gc-rapido-titulo{width:100%;border:none;border-bottom:2px solid var(--gc-linea);background:transparent;color:var(--gc-tinta);font:inherit;font-size:22px;padding:8px 0 6px;outline:none}
.gc-rapido-titulo:focus{border-bottom-color:var(--gc-azul)}
.gc-pestanas{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 4px}
.gc-pestana{height:32px;padding:0 14px;border-radius:8px;border:none;background:transparent;color:var(--gc-tinta);font-size:14px;font-weight:500;cursor:pointer}
.gc-pestana[aria-pressed="true"]{background:var(--gc-azul-suave);color:var(--gc-azul)}
.gc-pestana:hover{background:color-mix(in srgb,var(--gc-tinta) 6%,transparent)}
.gc-campo{height:36px;border-radius:6px;border:1px solid var(--border-strong);background:var(--gc-hoja);color:var(--gc-tinta);font:inherit;font-size:14px;padding:0 10px}
.gc-campo:focus{outline:2px solid var(--gc-azul);outline-offset:-1px;border-color:transparent}
.gc-pie{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 8px 0}
.gc-sin{display:grid;place-items:center;flex:1;color:var(--gc-gris)}
@media (max-width:900px){.gc-lado{display:none}.gc-hoja{margin-left:8px;margin-right:8px}.gc-logo{min-width:0;padding-right:8px}.gc-logo-txt{display:none}.gc-titulo{font-size:18px}}
@media (max-width:600px){.gc-hoy{padding:0 14px}.gc-tarjeta,.gc-rapido{left:12px!important;right:12px!important;width:auto}}
@media (prefers-reduced-motion:reduce){.gc-crear{transition:none}}
`;
