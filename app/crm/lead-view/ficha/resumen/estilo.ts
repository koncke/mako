// =============================================================================
// ficha/resumen/estilo — la hoja de los bloques del Resumen (el molde de Attio y HubSpot, y el épico de General)
// =============================================================================
// LA REFERENCIA (16/10/2026; documentación oficial, no se entró a las apps):
//   · Attio, «Configure record pages» (attio.com/help): la tab Overview abre con hasta seis HIGHLIGHTS, cada uno UN dato
//     de un vistazo (el rótulo chico arriba, el valor grande abajo), y los «Record details» van como una lista de
//     propiedades: el rótulo a la izquierda, el valor a la derecha, y la fila entera se edita en el lugar.
//   · HubSpot, «Customize the middle column of records» (knowledge.hubspot.com): la tab del medio son TARJETAS que se
//     ponen de a dos por fila, cada una con su título y lo suyo adentro (propiedades, actividad, botones de acción).
//   · La vista ÉPICA es la de General y MaKo Mobile v3 (app/general/bloques/comun.tsx, docs/prototipos/
//     mako-mobile-tableros.html): UN protagonista por bloque, el rótulo chico en mayúsculas y nada de metadata.
// Con nuestros tokens: `.fr-dato` es el highlight, `.fr-prop` la fila de propiedad, `.fr` la tarjeta.
//
// ⚠️ SÓLO TOKENS DE LA APP (se dan vuelta en oscuro). ES UN TEMPLATE LITERAL: ni comillas invertidas ni pesos con llave.
// ⚠️ SIN `container-type`, `transform` NI `filter` en nada que tenga adentro un campo: los campos traen su toast fijo y
//    el WhatsApp no oficial su modal fijo, y los tres los atarían a la tarjeta (../ficha-css.ts). Por eso el protagonista
//    épico escala con la ventana (clamp + vw) y no con la tarjeta: la grilla épica le asegura al menos media fila.
// ⚠️ La caja de cada bloque es un <section> directo de `.fb-cuerpo`: así le llegan la densidad y el tema de la ficha
//    (../ficha-css.ts pisa `.fb-cuerpo > section` con !important) sin que el bloque sepa de ellos.
// ⚠️ Se monta UNA vez aunque haya veinte bloques: `<style href="fr-resumen" precedence>` (React 19 la deduplica).
// =============================================================================

export const CSS_RESUMEN = `
.fr { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; min-width: 0; box-sizing: border-box; color: var(--ink); font-family: 'Geist', sans-serif; }
.fr-cab { display: flex; align-items: center; gap: 8px; min-height: 22px; min-width: 0; }
.fr-tit { font-family: 'Geist Mono', monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--dim); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fr-cab-fin { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; flex: none; }
.fr-link { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; padding: 0; font: inherit; font-size: 13px; font-weight: 600; color: var(--primary); text-decoration: none; cursor: pointer; white-space: nowrap; }
.fr-link:hover { text-decoration: underline; }
.fr-nada { margin: 0; font-size: 13.5px; color: var(--faint); }
.fr-sub { font-size: 13px; color: var(--dim); line-height: 1.45; }

/* La fila de propiedad (Attio «Record details»): la fila entera abre su campo.
   ⚠️ DECIDE POR SU PROPIO ANCHO, no por la ventana (verificación del 16/10/2026): un bloque de ½ en la tablet mide 347 px
   con la ventana a 820, y con el rótulo al lado el email salía de a tres letras por renglón. Sin container-type
   (prohibido acá, ver arriba): el rótulo pide (440px - 100%) * 999 de base, que en una fila de menos de 440 px es
   enorme (va solo arriba, a lo ancho) y en una más ancha da negativo, se recorta a 0 y queda en su 30%. */
.fr-props { display: flex; flex-direction: column; margin: 0 -8px; }
.fr-prop { display: flex; flex-wrap: wrap; align-items: center; column-gap: 12px; row-gap: 2px; min-height: 40px; padding: 3px 8px; border-radius: 10px; }
.fr-prop > .fr-v { flex: 1 1 0; }
.fr-prop > .fr-acc { flex: none; }
.fr-props > * + * > .fr-prop, .fr-props > .fr-prop + .fr-prop { box-shadow: 0 -1px 0 var(--border); }
.campo-caja:hover > .fr-prop { background: var(--velo-hover); box-shadow: none; }
.fr-k { font-size: 13px; color: var(--dim); line-height: 1.3; flex: 0 1 calc((440px - 100%) * 999); min-width: max(78px, 30%); overflow-wrap: anywhere; }
.fr-v { font-size: 14.5px; font-weight: 600; color: var(--ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; overflow-wrap: anywhere; }
.fr-v--vacio { color: var(--faint); font-weight: 500; }
.fr-acc { display: inline-flex; align-items: center; gap: 4px; }
.fr-ico { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: none; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--dim); cursor: pointer; text-decoration: none; padding: 0; }
.fr-ico:hover { color: var(--primary); border-color: var(--primary); }
.fr-ico--wa { color: var(--good); }

/* El dato (Attio «Highlights»): el rótulo arriba, el valor grande. */
.fr-dato { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.fr-num { font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.08; font-variant-numeric: tabular-nums; color: var(--ink); overflow-wrap: anywhere; }
.fr-num--rojo { color: var(--bad); } .fr-num--ambar { color: var(--warn); } .fr-num--verde { color: var(--good); }

/* Los chips (redes, el canal, el equipo). */
.fr-chips { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.fr-chip { display: inline-flex; align-items: center; gap: 7px; min-height: 32px; max-width: 100%; box-sizing: border-box; padding: 0 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface-2); font-size: 13.5px; font-weight: 600; color: var(--ink); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
a.fr-chip:hover, button.fr-chip:hover { border-color: var(--primary); color: var(--primary); }
button.fr-chip { font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
.fr-chip--falta { background: transparent; border-style: dashed; color: var(--dim); font-weight: 500; }

/* Tres botones (la calificación): segmentado, el elegido con su color. */
.fr-seg { display: inline-flex; flex-wrap: wrap; gap: 3px; padding: 3px; border-radius: 12px; background: var(--surface-2); max-width: 100%; box-sizing: border-box; }
.fr-seg > button { min-height: 32px; padding: 0 12px; border: 0; border-radius: 9px; background: transparent; font: inherit; font-size: 13px; font-weight: 600; color: var(--dim); cursor: pointer; }
.fr-seg > button:hover:not(:disabled) { color: var(--ink); }
.fr-seg > button[aria-pressed="true"] { background: var(--surface); color: var(--ink); box-shadow: 0 0 0 1px var(--border), 0 1px 2px rgba(18, 21, 27, .08); }
.fr-seg > button[aria-pressed="true"][data-v="si"] { color: var(--good); }
.fr-seg > button[aria-pressed="true"][data-v="no"] { color: var(--bad); }
.fr-seg > button:disabled { cursor: default; opacity: .55; }
/* Los tres (o pocos) que llenan el ancho y no bajan de renglón: en una tarjeta de ⅓ «Sin marcar» caía solo abajo.
   Reparten el ancho POR SU TEXTO (1 1 auto): con partes iguales «No calificado» se cortaba en ⅓ a 1440. */
.fr-seg--llena { display: flex; flex-wrap: nowrap; width: 100%; }
.fr-seg--llena > button { flex: 1 1 auto; min-width: 0; padding: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* El nombre del setter y del closer, en grande en la épica (el desplegable trae su letra en línea). */
.fr--epico .fr-persona button { font-size: clamp(18px, .8vw + 13px, 24px) !important; }

/* El banner (la siguiente acción, los duplicados). */
.fr-banner { display: flex; align-items: center; gap: 12px 16px; flex-wrap: wrap; padding: 14px 18px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface); box-sizing: border-box; min-width: 0; }
.fr-banner[data-tono="warn"] { background: var(--warn-bg); border-color: color-mix(in srgb, var(--warn) 28%, transparent); }
.fr-banner[data-tono="info"] { background: var(--primary-bg); border-color: color-mix(in srgb, var(--primary) 26%, transparent); }
.fr-banner[data-tono="good"] { background: var(--good-bg); border-color: color-mix(in srgb, var(--good) 28%, transparent); }
.fr--tono[data-tono="warn"] { background: var(--warn-bg); border-color: color-mix(in srgb, var(--warn) 28%, transparent); }
.fr--tono[data-tono="info"] { background: var(--primary-bg); border-color: color-mix(in srgb, var(--primary) 26%, transparent); }
.fr--tono[data-tono="good"] { background: var(--good-bg); border-color: color-mix(in srgb, var(--good) 28%, transparent); }
.fr--tono[data-tono="good"] .fr-tit { color: var(--good); }
.fr--tono[data-tono="warn"] .fr-tit { color: var(--warn); }
.fr-banner-txt { flex: 1 1 220px; min-width: 0; }
.fr-banner-tit { font-size: 15.5px; font-weight: 650; line-height: 1.3; color: var(--ink); overflow-wrap: anywhere; }
.fr-banner-det { margin-top: 3px; font-size: 13.5px; color: var(--dim); line-height: 1.45; overflow-wrap: anywhere; }

/* La barra contra un plazo. */
.fr-barra { height: 8px; border-radius: 999px; background: var(--border); overflow: hidden; }
.fr-barra > span { display: block; height: 100%; border-radius: inherit; background: var(--good); }
.fr-barra[data-tono="ambar"] > span { background: var(--warn); }
.fr-barra[data-tono="rojo"] > span { background: var(--bad); }
.fr-barra[data-tono="gris"] > span { background: var(--dim); }

/* Lo que contestó. */
.fr-grupo { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.fr-grupo + .fr-grupo { padding-top: 12px; border-top: 1px solid var(--border); }
.fr-fuente { font-size: 12px; font-weight: 600; color: var(--dim); }
.fr-qa { margin: 0; display: flex; flex-direction: column; gap: 10px; }
.fr-qa dt { font-size: 12.5px; color: var(--dim); line-height: 1.35; }
.fr-qa dd { margin: 2px 0 0; font-size: 14.5px; font-weight: 600; color: var(--ink); line-height: 1.4; overflow-wrap: anywhere; }
.fr-tabla { margin: 0; display: grid; grid-template-columns: minmax(110px, 40%) minmax(0, 1fr); }
.fr-tabla > dt, .fr-tabla > dd { margin: 0; padding: 8px 0; border-top: 1px solid var(--border); font-size: 13.5px; line-height: 1.4; overflow-wrap: anywhere; }
.fr-tabla > dt { color: var(--dim); padding-right: 12px; }
.fr-tabla > dd { font-weight: 600; color: var(--ink); }
.fr-tabla > dt:first-of-type, .fr-tabla > dt:first-of-type + dd { border-top: 0; }
.fr-tarjetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 10px; }
.fr-tarjeta { padding: 12px 14px; border-radius: 12px; background: color-mix(in srgb, var(--ink) 4.5%, transparent); min-width: 0; }
.fr-tarjeta dt { font-size: 12px; color: var(--dim); line-height: 1.35; }
.fr-tarjeta dd { margin: 4px 0 0; font-size: 16px; font-weight: 650; line-height: 1.3; overflow-wrap: anywhere; }
.fr-linea { font-size: 14px; line-height: 1.5; color: var(--ink); overflow-wrap: anywhere; }
.fr-linea b { font-weight: 600; color: var(--dim); }
.fr-plegado > summary { cursor: pointer; font-size: 13.5px; font-weight: 600; color: var(--ink); padding: 4px 0; }
.fr-plegado[open] > summary { margin-bottom: 8px; }

/* De dónde vino: las migas Canal › Campaña › Conjunto › Anuncio. */
.fr-migas { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; font-size: 14px; line-height: 1.45; min-width: 0; }
.fr-migas > span { overflow-wrap: anywhere; }
.fr-migas > .fr-sep { color: var(--faint); }
.fr-migas > .fr-fuerte { font-weight: 650; color: var(--ink); }
.fr-tono-accent { color: var(--accent); } .fr-tono-good { color: var(--good); } .fr-tono-dim { color: var(--dim); }

/* El equipo: dos cajas. */
.fr-dos { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 10px; }
.fr-caja { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--ink) 4.5%, transparent); }

/* La botonera grande del contacto: Llamar · WhatsApp · Email. */
.fr-botonera { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 120px), 1fr)); gap: 10px; }
.fr-boton { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 64px; padding: 10px; border-radius: 14px; border: 1px solid var(--border); background: var(--surface-2); color: var(--ink); font: inherit; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; }
.fr-boton:hover { border-color: var(--primary); color: var(--primary); }
.fr-boton[aria-disabled="true"] { color: var(--faint); cursor: default; }
.fr-boton[aria-disabled="true"]:hover { border-color: var(--border); }

/* LA VISTA ÉPICA (General y MaKo Mobile v3): un protagonista, el rótulo chico, sin metadata. */
.fr--epico { gap: 16px; }
.fr--epico .fr-tit { font-size: 13px; }
.fr-p { font-size: clamp(36px, 2.4vw + 18px, 64px); font-weight: 800; letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums; color: var(--ink); overflow-wrap: anywhere; }
.fr-frase { margin: 0; font-size: clamp(24px, 1.4vw + 15px, 40px); font-weight: 700; letter-spacing: -.025em; line-height: 1.12; text-wrap: balance; color: var(--ink); overflow-wrap: anywhere; }
.fr--epico .fr-prop { min-height: 52px; }
.fr--epico .fr-k { font-size: 14px; }
.fr--epico .fr-v { font-size: clamp(17px, .5vw + 13px, 22px); }
.fr--epico .fr-num { font-size: clamp(34px, 2vw + 18px, 56px); font-weight: 800; letter-spacing: -.035em; }
.fr--epico .fr-banner { padding: 22px 24px; border-radius: 18px; }
.fr--epico .fr-banner-tit { font-size: clamp(22px, 1.2vw + 14px, 34px); font-weight: 700; letter-spacing: -.02em; }
.fr--epico .fr-banner-det { font-size: 16px; }
.fr--epico .fr-boton { min-height: 96px; font-size: 16px; border-radius: 18px; }
.fr--epico .fr-seg > button { min-height: 44px; padding: 0 18px; font-size: 15px; }
.fr--epico .fr-chip { min-height: 40px; font-size: 15px; padding: 0 16px; }
.fr--epico .fr-tarjeta dd { font-size: clamp(18px, .8vw + 13px, 26px); }

/* El bloque «Automatizaciones» (./automatizaciones.tsx), REDISEÑADO el 24/10/2026: cada automatización es una tarjeta con
   un SELLO de forma y color adelante del nombre (su estado se ve antes de leer), una franja del mismo color a la izquierda
   (varias se distinguen de un vistazo), un RIEL vertical con lo que le salió y lo que viene, y un PIE con las acciones. Un
   color, un significado (app/_ui/tokens.ts): dorado MaKo, naranja traba, rojo falló, verde contestó o terminó, gris quieto.
   ⚠️ Nada de transform, filter ni container-type en lo que tenga un campo o un modal adentro: el único transform es el
   giro del chevron, que es una hoja. */
.fr-aut-lista { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.fr-aut, .fr-aut-fila { --aut-fill: var(--mako); --aut-ink: var(--mako-ink); --aut-bg: var(--mako-bg); }
.fr-aut[data-tono="good"], .fr-aut-fila[data-tono="good"] { --aut-fill: var(--good); --aut-ink: var(--good); --aut-bg: var(--good-bg); }
.fr-aut[data-tono="warn"], .fr-aut-fila[data-tono="warn"] { --aut-fill: var(--warn-fill); --aut-ink: var(--warn); --aut-bg: var(--warn-bg); }
.fr-aut[data-tono="bad"], .fr-aut-fila[data-tono="bad"] { --aut-fill: var(--bad); --aut-ink: var(--bad); --aut-bg: var(--bad-bg); }
.fr-aut[data-tono="neutral"], .fr-aut-fila[data-tono="neutral"] { --aut-fill: var(--border-strong); --aut-ink: var(--dim); --aut-bg: var(--surface-2); }
.fr-aut { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 12px 14px 12px 16px; border: 1px solid var(--border); border-radius: 12px; box-shadow: inset 3px 0 0 var(--aut-fill); }

/* La cabecera: el sello, el nombre y debajo el estado con su cuándo. */
.fr-aut-cab { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; column-gap: 10px; align-items: center; min-width: 0; }
.fr-aut-sello { width: 24px; height: 24px; box-sizing: border-box; border-radius: 50%; display: grid; place-items: center; background: var(--aut-bg); color: var(--aut-ink); }
.fr-aut-sello[data-forma="disco"]::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--aut-ink); }
.fr-aut-sello[data-forma="cuadro"]::after { content: ''; width: 8px; height: 8px; border-radius: 2px; background: var(--aut-ink); }
.fr-aut-sello[data-forma="aro"] { background: transparent; border: 1.5px dashed var(--aut-ink); }
.fr-aut-sello[data-forma="tilde"], .fr-aut-sello[data-forma="alerta-llena"] { background: var(--aut-fill); color: var(--surface); }
.fr-aut-glifo { font-size: 13px; font-weight: 800; line-height: 1; }
.fr-aut-titulos { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.fr-aut-nombre { font-size: var(--fs-card); font-weight: 650; color: var(--ink); text-decoration: none; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fr-aut-nombre:hover { color: var(--primary); text-decoration: underline; }
.fr-aut-estado { font-size: 13px; font-weight: 600; color: var(--aut-ink); min-width: 0; overflow-wrap: anywhere; }
.fr-aut-estado-cuando { color: var(--dim); font-weight: 500; }
.fr-aut-plegar { border: none; background: none; padding: 4px; border-radius: 8px; cursor: pointer; color: var(--dim); display: grid; place-items: center; }
.fr-aut-plegar:hover { background: var(--velo-hover); }
.fr-aut-plegar:focus-visible, .fr-aut-fila:focus-visible, .fr-aut-frenar:focus-visible, .fr-aut-antes:focus-visible, .fr-aut-mas:focus-visible { outline: none; box-shadow: var(--focus-ring); }
/* El foco con teclado en el nombre, como en las tabs y el resto de la ficha (chat «CRM», 24/10/2026). */
.fr-aut-nombre:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: 4px; }

/* El riel: una línea vertical que une las marcas; el tramo que llega a lo próximo, punteado. La línea pasa por x = 11,25 px
   del riel (el centro del sello de arriba); cada marca la corta con un aro del fondo, en los dos temas. */
.fr-aut-riel { list-style: none; margin: 0; padding: 0 0 0 32px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.fr-aut-nodo { position: relative; min-width: 0; }
.fr-aut-nodo::before { content: ''; position: absolute; left: -21px; top: 9px; bottom: -19px; border-left: 1.5px solid var(--border); }
.fr-aut-nodo:last-child::before { display: none; }
.fr-aut-nodo:has(+ .fr-aut-nodo[data-tipo="proximo"])::before { border-left-style: dashed; border-left-color: var(--border-strong); }
.fr-aut-marca { position: absolute; left: -24.25px; top: 5px; width: 8px; height: 8px; box-sizing: border-box; border-radius: 50%; background: var(--dim); box-shadow: 0 0 0 3px var(--surface); }
.fr-aut-nodo[data-tipo="contesto"] .fr-aut-marca { left: -25.25px; top: 4px; width: 10px; height: 10px; background: var(--good); }
.fr-aut-nodo[data-tipo="fallo"] .fr-aut-marca { left: -25.25px; top: 4px; width: 10px; height: 10px; background: var(--bad); }
.fr-aut-nodo[data-tipo="borrador"] .fr-aut-marca { left: -25.25px; top: 4px; width: 10px; height: 10px; background: var(--surface); border: 1.5px dashed var(--faint); }
.fr-aut-nodo[data-tipo="quieto"] .fr-aut-marca, .fr-aut-nodo[data-tipo="antes"] .fr-aut-marca { left: -23.25px; top: 6px; width: 6px; height: 6px; background: var(--surface); border: 1.5px solid var(--faint); }
.fr-aut-nodo[data-tipo="antes"] .fr-aut-marca { border-style: dashed; }
.fr-aut-nodo[data-tipo="noentro"] .fr-aut-marca { left: -23.25px; top: 6px; width: 6px; height: 6px; background: var(--warn-fill); }
.fr-aut-nodo[data-tipo="proximo"] .fr-aut-marca { left: -25.25px; top: 4px; width: 10px; height: 10px; background: var(--surface); border: 2px solid var(--mako-ink); }
.fr-aut-nodo[data-apagado] .fr-aut-marca { border-color: var(--faint); }
.fr-aut-nodo-cab { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; font-size: 13px; line-height: 1.4; }
.fr-aut-nodo-tit { min-width: 0; font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }
.fr-aut-nodo[data-tipo="contesto"] .fr-aut-nodo-tit { color: var(--good); }
.fr-aut-nodo[data-tipo="fallo"] .fr-aut-nodo-tit { color: var(--bad); }
.fr-aut-nodo[data-tipo="noentro"] .fr-aut-nodo-tit { color: var(--warn); }
.fr-aut-nodo[data-tipo="borrador"] .fr-aut-nodo-tit, .fr-aut-nodo[data-apagado] .fr-aut-nodo-tit { color: var(--dim); }
.fr-aut-nodo[data-tipo="quieto"] .fr-aut-nodo-tit { color: var(--dim); font-weight: 500; font-size: 12.5px; }
.fr-aut-cuando { flex: none; font-size: 12.5px; color: var(--dim); white-space: nowrap; font-variant-numeric: tabular-nums; }
.fr-aut-nodo[data-tipo="proximo"] .fr-aut-cuando { color: var(--ink); font-weight: 600; }
.fr-aut-zona { color: var(--faint); font-weight: 500; }
/* La cita: el mensaje como le llegó, en una burbuja. La respuesta del lead, en verde; lo que no salió o no salió todavía,
   con el borde punteado. */
.fr-aut-cita { margin: 4px 0 0; padding: 7px 10px; border: 1px solid var(--border); border-radius: 4px 12px 12px 12px; background: var(--surface-2); color: var(--ink); font-size: 13.5px; line-height: 1.45; overflow-wrap: anywhere; }
.fr-aut-nodo[data-tipo="contesto"] .fr-aut-cita { background: var(--good-bg); border-color: transparent; }
.fr-aut-nodo[data-tipo="fallo"] .fr-aut-cita { background: transparent; border-style: dashed; border-color: var(--bad); }
.fr-aut-nodo[data-tipo="borrador"] .fr-aut-cita, .fr-aut-nodo[data-tipo="proximo"] .fr-aut-cita { background: transparent; border-style: dashed; border-color: var(--border-strong); color: var(--dim); }
.fr-aut-detalle { margin: 3px 0 0; font-size: 12.5px; line-height: 1.4; color: var(--dim); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fr-aut-nodo[data-tipo="fallo"] .fr-aut-detalle { color: var(--bad); }
.fr-aut-antes, .fr-aut-mas { border: none; background: none; padding: 0; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--primary); cursor: pointer; text-align: left; }
.fr-aut-antes:hover, .fr-aut-mas:hover { text-decoration: underline; }
.fr-aut-vacio { margin: 0; font-size: 13px; color: var(--dim); }

/* El pie: «Frenar» a la izquierda, en rojo y como texto (el modal de WhatsApp del Ops Center); «Empezar de nuevo» a la
   derecha, como botón. */
.fr-aut-pie { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.fr-aut-pie-fin { margin-left: auto; }
.fr-aut-frenar { border: none; background: none; padding: 4px 0; border-radius: 6px; font: inherit; font-size: 13px; font-weight: 600; color: var(--bad); cursor: pointer; }
.fr-aut-frenar:hover { text-decoration: underline; }
.fr-aut-error { flex-basis: 100%; margin: 0; font-size: 12.5px; color: var(--bad); }

/* Las terminadas: filas finas con su sello; un toque la abre como tarjeta en el lugar. */
.fr-aut-filas { display: flex; flex-direction: column; min-width: 0; }
.fr-aut-filas > .fr-aut { margin: 8px 0; }
.fr-aut-fila { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto 16px; align-items: center; column-gap: 10px; width: 100%; box-sizing: border-box; padding: 9px 4px; border: none; border-top: 1px solid var(--border); border-radius: 0; background: none; font: inherit; text-align: left; color: var(--ink); cursor: pointer; }
.fr-aut-fila:hover { background: var(--velo-hover); }
.fr-aut-fila .fr-aut-sello { width: 20px; height: 20px; }
.fr-aut-fila-nombre { min-width: 0; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fr-aut-fila-estado { font-size: 12.5px; color: var(--dim); white-space: nowrap; }
.fr-aut-chev { display: grid; place-items: center; color: var(--dim); }
/* El único transform del bloque: el chevron de la tarjeta abierta, que es una hoja (sin campos ni modales adentro). */
.fr-aut-chev[data-abierto] { transform: rotate(180deg); }
.fr-aut-mas { padding: 8px 4px; align-self: flex-start; }
.fr-aut-noentro { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 12px; background: var(--warn-bg); border: 1px solid color-mix(in srgb, var(--warn) 28%, transparent); font-size: 13.5px; color: var(--ink); }
.fr-aut-noentro-fila { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; justify-content: space-between; }
.fr--epico .fr-aut-nombre { font-size: 17px; }
.fr--epico .fr-aut-nodo-cab { font-size: 14.5px; }
.fr--epico .fr-aut-cita { font-size: 15px; }
/* En el celular (y en la vista «Celular» de «Personalizar»): la tarjeta respira menos y, en una fila terminada, el estado
   baja debajo del nombre. El pie sigue en una fila: Frenar a la izquierda, Empezar de nuevo a la derecha. */
@media (max-width: 720px) {
  .fr-aut { padding: 12px 12px 12px 15px; }
  .fr-aut-fila { grid-template-columns: 20px minmax(0, 1fr) 16px; row-gap: 2px; }
  .fr-aut-fila-estado { grid-column: 2; grid-row: 2; }
}
.fb-pagina[data-dispositivo="movil"] .fr-aut { padding: 12px 12px 12px 15px; }
.fb-pagina[data-dispositivo="movil"] .fr-aut-fila { grid-template-columns: 20px minmax(0, 1fr) 16px; row-gap: 2px; }
.fb-pagina[data-dispositivo="movil"] .fr-aut-fila-estado { grid-column: 2; grid-row: 2; }
@media (pointer: coarse) {
  .fr-aut-frenar, .fr-aut-antes, .fr-aut-mas, .fr-aut-fila, .fr-aut-plegar { min-height: var(--touch); }
}

/* «Posibles duplicados» (23/10/2026, ./duplicados.tsx): por ficha parecida, el nombre con «Abrir» y «Unificar», por qué
   se parece, en qué CRM está y desde cuándo. */
.fr-dup-lista { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.fr-dup { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--ink) 4.5%, transparent); min-width: 0; }
.fr-dup-nombre { font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 720px) { .fr-dup .fr-cab { flex-wrap: wrap; } .fr-dup .fr-cab-fin { margin-left: 0; } }
.fb-pagina[data-dispositivo="movil"] .fr-dup .fr-cab { flex-wrap: wrap; }
/* El pop-up de «Unificar» (./UnificarFichas.tsx): qué queda de cada una, por secciones, y lo que choca en ámbar. */
.fr-unif { display: flex; flex-direction: column; gap: 10px; }
.fr-unif-tit { margin: 0; font-size: 15.5px; font-weight: 700; color: var(--ink); }
.fr-unif-sec h4 { margin: 4px 0 4px; font-size: 13px; font-weight: 700; color: var(--dim); text-transform: none; }
.fr-unif-sec ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; font-size: 13.5px; color: var(--ink); }
.fr-unif-otra { color: var(--primary); }
.fr-unif-choque { color: var(--warn); }
.fr-unif-acciones { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
@media (max-width: 720px) { .fr-unif-acciones > * { flex: 1 1 auto; } }

/* El celular: lo de a dos baja a uno, y las acciones de una fila no se apilan. */
/* En el celular (y en la vista «Celular» de «Personalizar»), el rótulo de una fila va ARRIBA del valor, como la lista
   de propiedades de Attio en el teléfono: a 390 px el rótulo a la izquierda dejaba el teléfono cortado al lado de sus
   dos botones de 44 px. */
@media (max-width: 720px) {
  .fr { padding: 16px; }
  .fr-prop { padding-top: 6px; padding-bottom: 6px; }
  .fr-prop > .fr-k { flex-basis: 100%; font-size: 12px; }
}
.fb-pagina[data-dispositivo="movil"] .fr-prop { padding-top: 6px; padding-bottom: 6px; }
.fb-pagina[data-dispositivo="movil"] .fr-prop > .fr-k { flex-basis: 100%; font-size: 12px; }
/* Pantalla táctil: 44 px de toque (AGENTS.md, por capacidad, no por ancho). */
@media (pointer: coarse) {
  .fr-ico { width: var(--touch); height: var(--touch); }
  .fr-prop { min-height: var(--touch); }
  .fr-seg > button { min-height: var(--touch); }
  .fr-chip { min-height: var(--touch); }
  .fr-link { min-height: var(--touch); }
}
`;
