// =============================================================================
// extensiones/estilos-nodos — el CSS de los controles que dibujan los NodeViews
// =============================================================================
// Pedido de Martín (11/10/2026): «Quiero que implementes en la tab de "Landing
// Generator" un editor de landing tipo GAMMA. Replica por completo a Gamma, que se
// pueda hacer todo lo que ahí se hace.» Diseño: docs/diseno-editor-landing.md (D3).
//
// Lo que NO es contenido y vive adentro del lienzo: la columna de botones de cada sección
// (⋮ ✨ ▤), el «+» entre secciones, la mini barra [+ | ✨ | ▾], el hueco «Agregar imagen» de
// la imagen de acento, la cruz del punto de enfoque, los controles de una imagen y un video,
// los menús que abren, el aviso de «Subiendo…» y el placeholder de una línea vacía.
//
// Medidas y colores de Gamma (relevo gamma-tokens §9 y gamma-ui §1.3/§5.8): botones blancos de
// 28 px con radio 6 y sombra sm; menús con radio 16, padding 8, sombra 0 8px 16px; ítems de
// 28 px, 14/500, radio 6; azul trueblue #2c88f7; grises titanium. La fuente de la interfaz de
// Gamma (PP Mori) no está libre: se hereda la de `.gma` (gamma.css, paquete H) y, si no la hay,
// la del sistema.
//
// ⚠️ Prefijo `gmc-` (controles): no choca con las clases `gma-` de la hoja del armazón ni con
//    las `gm-` del contenido. Se inyecta con `<style href precedence>` desde cada NodeView
//    (React 19 la deduplica por `href`: sale UNA vez aunque haya 60 secciones).
// ⚠️ Adentro de una sección todo hereda la letra del CONTENIDO (tamaño en em, familia y color
//    del tema): cada control resetea su `font` a px. Sin eso, en un tema con títulos de 80 px
//    los botones de la sección crecían con la letra.
// ⚠️ Cadena SIN backticks ni signo pesos con llave (AGENTS.md: un backtick en un comentario de una
//    hoja en cadena la parte a la mitad, y la pantalla contesta 200 sin estilos).
// =============================================================================

const LETRA = 'font-family: var(--gma-fuente, system-ui, -apple-system, "Segoe UI", sans-serif); font-size: 14px; font-weight: 500; font-style: normal; line-height: 1.4; letter-spacing: normal; text-transform: none; text-align: left; -webkit-text-fill-color: currentColor;';

export const CSS_NODOS = [
  // Tokens del chrome (claro y oscuro: se redefinen tokens, no reglas)
  '.gmc { --gmc-fondo: #ffffff; --gmc-borde: #dfdfe0; --gmc-texto: #38383c; --gmc-tenue: #66666b; --gmc-hover: #f5f5f6; --gmc-activo: #ebf3fe; --gmc-azul: #2c88f7; --gmc-azul-fuerte: #0858f7; --gmc-rojo: #dc2626; --gmc-sombra-sm: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); --gmc-sombra-menu: 0 8px 16px rgba(0,0,0,0.15); }',
  '[data-tema="oscuro"] .gmc { --gmc-fondo: #212327; --gmc-borde: #3d444c; --gmc-texto: #dfdfe0; --gmc-tenue: #aeaeb2; --gmc-hover: #2f3339; --gmc-activo: #0b2e79; --gmc-azul: #63acf7; --gmc-azul-fuerte: #84c1fa; --gmc-rojo: #f87171; --gmc-sombra-menu: 0 8px 16px rgba(0,0,0,0.45); }',

  // El botón de 28 px (los tres de la columna de la sección y los de la imagen de acento)
  '.gmc-btn { ' + LETRA + ' position: relative; width: 28px; height: 28px; padding: 0; display: grid; place-items: center; border-radius: 6px; background: var(--gmc-fondo); border: 1px solid var(--gmc-borde); box-shadow: var(--gmc-sombra-sm); color: var(--gmc-tenue); cursor: pointer; }',
  '.gmc-btn:hover, .gmc-btn[aria-expanded="true"] { color: var(--gmc-texto); background: var(--gmc-hover); }',
  '.gmc-btn:focus-visible { outline: 2px solid var(--gmc-azul); outline-offset: 1px; }',
  '.gmc-btn svg { width: 16px; height: 16px; display: block; }',
  '.gmc-btn[data-asa] { cursor: grab; }',
  '.gmc-btn[data-con-notas]::after { content: ""; position: absolute; top: 3px; right: 3px; width: 6px; height: 6px; border-radius: 50%; background: var(--gmc-azul); }',

  // La columna de la sección, por FUERA del módulo a la izquierda. Arranca en el borde de la
  // sección y el aire va como padding: con un margin, cruzar el hueco apagaba el hover.
  '.gmc-lado { position: absolute; top: 0; right: 100%; padding: 2px 6px 0 0; display: flex; flex-direction: column; gap: 4px; opacity: 0; pointer-events: none; transition: opacity 0.12s ease; z-index: 6; }',
  '.gm-tarjeta:hover > .gmc-lado, .gm-tarjeta[data-activa="si"] > .gmc-lado, .gmc-lado[data-abierto] { opacity: 1; pointer-events: auto; }',
  // A sangre (ancho completo) no hay lugar afuera: la columna va adentro, arriba a la izquierda.
  // y lo mismo en la vista de teléfono o tableta, donde la sección ocupa todo el ancho del marco.
  // Y en una LANDING todas van a sangre (css.ts, bloque 15c, feedback del 12/10/2026): las
  // tarjetas con aire son sólo de una presentación, así que ahí la columna sigue afuera.
  '.gm-tarjeta[data-ancho="completo"] > .gmc-lado, [data-dispositivo="movil"] .gm-tarjeta > .gmc-lado, [data-dispositivo="tableta"] .gm-tarjeta > .gmc-lado, .gm-doc:not([data-formato="presentacion"]) .gm-tarjeta > .gmc-lado { right: auto; left: 12px; top: 12px; padding: 0; }',

  // El «+» entre secciones: ocupa el hueco de arriba de la sección (el margin-top de 3.5em).
  '.gmc-entre { position: absolute; left: 0; right: 0; bottom: 100%; height: 3.5em; display: flex; align-items: center; justify-content: center; z-index: 4; }',
  '.gm-tarjeta[data-ancho="completo"] > .gmc-entre, .gm-doc:not([data-formato="presentacion"]) .gm-tarjeta > .gmc-entre { height: 1.6em; bottom: calc(100% - 0.8em); }',
  '.gm-tarjeta[data-activa="si"] + .gm-tarjeta > .gmc-entre { display: none; }',
  '.gmc-entre > button { ' + LETRA + ' width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--gmc-borde); background: var(--gmc-fondo); color: var(--gmc-tenue); box-shadow: var(--gmc-sombra-sm); display: grid; place-items: center; cursor: pointer; opacity: 0; transition: opacity 0.12s ease; padding: 0; }',
  '.gmc-entre:hover > button, .gmc-entre > button:focus-visible { opacity: 1; }',
  '.gmc-entre > button:hover { color: var(--gmc-azul-fuerte); border-color: var(--gmc-azul); }',
  '.gmc-entre > button svg { width: 14px; height: 14px; }',

  // La mini barra debajo de la sección activa: [ + | ✨ | ▾ ]
  '.gmc-mini { ' + LETRA + ' position: absolute; top: 100%; left: 50%; transform: translate(-50%, 0.75em); display: flex; align-items: stretch; height: 30px; border-radius: 999px; background: var(--gmc-fondo); border: 1px solid var(--gmc-borde); box-shadow: var(--gmc-sombra-sm); overflow: hidden; z-index: 6; }',
  '.gm-tarjeta[data-ancho="completo"] > .gmc-mini, .gm-doc:not([data-formato="presentacion"]) .gm-tarjeta > .gmc-mini { transform: translate(-50%, -50%); }',
  '.gmc-mini > button { display: grid; place-items: center; width: 36px; border: 0; background: none; color: var(--gmc-tenue); cursor: pointer; padding: 0; }',
  '.gmc-mini > button + button { border-left: 1px solid var(--gmc-borde); }',
  '.gmc-mini > button:hover, .gmc-mini > button[aria-expanded="true"] { background: var(--gmc-hover); color: var(--gmc-texto); }',
  '.gmc-mini > button svg { width: 15px; height: 15px; }',

  // La marca de sección oculta (además del 50% de opacidad que pone la hoja del contenido)
  '.gmc-oculta { ' + LETRA + ' position: absolute; top: 10px; right: 10px; display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: var(--gmc-texto); color: var(--gmc-fondo); font-size: 12px; z-index: 5; pointer-events: none; }',
  '.gmc-oculta svg { width: 14px; height: 14px; }',

  // Arrastrar una sección por su ⋮: la que se mueve se marca con un borde (sin tocar su tamaño)
  '.gm-tarjeta[data-arrastrando="si"] { outline: 2px solid #2c88f7; outline-offset: 4px; }',
  '.gmc-indicador { position: fixed; height: 3px; border-radius: 2px; background: #2c88f7; box-shadow: 0 0 0 2px rgba(44,136,247,0.25); pointer-events: none; z-index: 400; }',

  // La imagen de acento en el editor: el hueco, la barra y el punto de enfoque
  '.ProseMirror .gm-acento[data-vacio="si"] { background-image: none; background-color: var(--gm-superficie, rgba(127,127,127,0.1)); box-shadow: inset 0 0 0 0.0625em var(--gm-borde-neutro, rgba(0,0,0,0.15)); }',
  '.ProseMirror .gm-acento[data-soltando="si"] { box-shadow: inset 0 0 0 3px #2c88f7; }',
  '.gmc-acento-capa { position: absolute; inset: 0; border-radius: inherit; }',
  '.gmc-hueco { ' + LETRA + ' position: absolute; inset: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; border: 0; background: none; color: var(--gm-texto-tenue, #66666b); cursor: pointer; padding: 12px; text-align: center; }',
  '.gmc-hueco:hover { color: var(--gm-texto, #38383c); }',
  '.gmc-hueco svg { width: 28px; height: 28px; }',
  '.gmc-hueco-pildora { ' + LETRA + ' display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--gmc-borde); background: var(--gmc-fondo); color: var(--gmc-texto); box-shadow: var(--gmc-sombra-sm); cursor: pointer; }',
  '.gmc-hueco-pildora svg { width: 15px; height: 15px; }',
  '.gmc-acento-barra { position: absolute; top: 10px; right: 10px; display: flex; gap: 4px; opacity: 0; transition: opacity 0.12s ease; }',
  '.gm-acento:hover .gmc-acento-barra, .gmc-acento-barra:focus-within, .gmc-acento-barra[data-fija] { opacity: 1; }',
  '.gmc-esquina { position: absolute; top: 10px; right: 10px; z-index: 5; display: flex; gap: 4px; }',
  '.gmc-foco { position: absolute; inset: 0; cursor: crosshair; background: rgba(0,0,0,0.18); border-radius: inherit; z-index: 7; touch-action: none; }',
  '.gmc-foco-cruz { position: absolute; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(0,0,0,0.45); pointer-events: none; }',
  '.gmc-foco-cruz::before, .gmc-foco-cruz::after { content: ""; position: absolute; background: #ffffff; box-shadow: 0 0 0 1px rgba(0,0,0,0.35); }',
  '.gmc-foco-cruz::before { left: 50%; top: -8px; bottom: -8px; width: 2px; margin-left: -1px; }',
  '.gmc-foco-cruz::after { top: 50%; left: -8px; right: -8px; height: 2px; margin-top: -1px; }',
  '.gmc-foco-listo { ' + LETRA + ' position: absolute; right: 10px; bottom: 10px; height: 30px; padding: 0 14px; border-radius: 999px; border: 0; background: #0540ad; color: #ffffff; cursor: pointer; }',
  '.gmc-cargando { ' + LETRA + ' position: absolute; inset: 0; display: grid; place-items: center; background: rgba(255,255,255,0.6); color: #38383c; font-size: 13px; border-radius: inherit; }',

  // Imagen y video del contenido, en el editor
  '.ProseMirror .gm-imagen, .ProseMirror .gm-video { position: relative; }',
  '.ProseMirror .react-renderer.ProseMirror-selectednode > .gm-imagen, .ProseMirror .react-renderer.ProseMirror-selectednode > .gm-video { outline: 2px solid #2c88f7; outline-offset: 3px; border-radius: 2px; }',
  '.ProseMirror .gm-imagen img { pointer-events: auto; }',
  '.gmc-img-barra { ' + LETRA + ' position: absolute; top: 8px; left: 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; max-width: calc(100% - 16px); padding: 4px; background: var(--gmc-fondo); color: var(--gmc-texto); border: 1px solid var(--gmc-borde); border-radius: 10px; box-shadow: var(--gmc-sombra-menu); z-index: 6; font-size: 13px; }',
  '.gmc-img-op { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 28px; min-width: 28px; padding: 0 8px; border-radius: 6px; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; white-space: nowrap; }',
  '.gmc-img-op:hover { background: var(--gmc-hover); }',
  '.gmc-img-op[aria-pressed="true"] { background: var(--gmc-activo); color: var(--gmc-azul-fuerte); }',
  '.gmc-img-op svg { width: 16px; height: 16px; flex: none; }',
  '.gmc-img-sep { width: 1px; align-self: stretch; margin: 4px 2px; background: var(--gmc-borde); }',
  '.gmc-img-asa { position: absolute; bottom: -7px; right: -7px; width: 14px; height: 14px; padding: 0; border-radius: 50%; background: #ffffff; border: 2px solid #2c88f7; cursor: nwse-resize; z-index: 6; touch-action: none; }',
  '.gmc-img-asa[data-lado="izq"] { right: auto; left: -7px; cursor: nesw-resize; }',
  '.gmc-img-pct { ' + LETRA + ' position: absolute; bottom: 10px; right: 10px; padding: 2px 8px; border-radius: 6px; background: rgba(0,0,0,0.7); color: #ffffff; font-size: 12px; pointer-events: none; z-index: 6; }',
  '.gmc-editar { ' + LETRA + ' position: absolute; top: 8px; left: 8px; height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--gmc-borde); background: var(--gmc-fondo); color: var(--gmc-texto); box-shadow: var(--gmc-sombra-sm); cursor: pointer; opacity: 0; z-index: 5; font-size: 12px; }',
  '.react-renderer:hover > .gm-video .gmc-editar, .gmc-editar:focus-visible { opacity: 1; }',

  // Los menús y paneles que abren los controles (portaleados al body)
  '.gmc-flota { ' + LETRA + ' background: var(--gmc-fondo); color: var(--gmc-texto); border: 1px solid var(--gmc-borde); border-radius: 16px; padding: 8px; box-shadow: var(--gmc-sombra-menu); box-sizing: border-box; }',
  '.gmc-flota * { box-sizing: border-box; }',
  '.gmc-menu-titulo { font-size: 12px; font-weight: 600; color: var(--gmc-tenue); padding: 4px 8px 6px; }',
  '.gmc-fila { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 28px; padding: 6px 8px; border-radius: 6px; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }',
  '.gmc-fila:hover, .gmc-fila:focus-visible { background: var(--gmc-hover); outline: none; }',
  '.gmc-fila:disabled { opacity: 0.4; cursor: default; background: none; }',
  '.gmc-fila[data-peligro] { color: var(--gmc-rojo); }',
  '.gmc-fila svg { width: 16px; height: 16px; flex: none; color: var(--gmc-tenue); }',
  '.gmc-fila[data-peligro] svg { color: inherit; }',
  '.gmc-fila-txt { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
  '.gmc-sep { height: 1px; margin: 4px 2px; background: var(--gmc-borde); }',
  '.gmc-campo { display: block; width: 100%; height: 34px; padding: 0 10px; border: 1px solid var(--gmc-borde); border-radius: 8px; background: var(--gmc-fondo); color: inherit; font-family: inherit; font-size: 14px; font-weight: 400; line-height: 1.4; }',
  '.gmc-campo:focus { outline: none; border-color: var(--gmc-azul); box-shadow: 0 0 0 3px rgba(44,136,247,0.2); }',
  '.gmc-rotulo { display: block; font-size: 12px; font-weight: 600; color: var(--gmc-tenue); margin: 8px 2px 4px; }',
  '.gmc-notas textarea { display: block; width: 100%; min-height: 150px; resize: vertical; padding: 10px; border: 1px solid var(--gmc-borde); border-radius: 8px; background: var(--gmc-fondo); color: inherit; font-family: inherit; font-size: 14px; font-weight: 400; line-height: 1.5; }',
  '.gmc-notas textarea:focus { outline: none; border-color: var(--gmc-azul); box-shadow: 0 0 0 3px rgba(44,136,247,0.2); }',
  '.gmc-casilla { display: flex; align-items: center; gap: 8px; padding: 6px 2px; font-size: 13px; cursor: pointer; }',
  '.gmc-pie { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }',
  '.gmc-boton { height: 30px; padding: 0 14px; border-radius: 999px; border: 0; font-family: inherit; font-size: 13px; font-weight: 500; line-height: 1; cursor: pointer; background: #0540ad; color: #ffffff; }',
  '.gmc-boton[data-suave] { background: var(--gmc-hover); color: var(--gmc-texto); }',
  '.gmc-error { font-size: 12px; color: var(--gmc-rojo); margin: 4px 2px 0; }',

  // El aviso de una subida en curso (widget de ProseMirror)
  '.gmc-subiendo { display: inline-block; margin: 0 4px; padding: 2px 10px; border-radius: 999px; background: #f5f5f6; color: #66666b; font: 500 12px/1.6 system-ui, sans-serif; vertical-align: middle; }',

  // El placeholder de una línea o un título vacío (Placeholder de TipTap: .is-empty + data-placeholder)
  '.ProseMirror .is-empty[data-placeholder]:not([data-placeholder=""])::before { content: attr(data-placeholder); float: left; height: 0; pointer-events: none; color: var(--gm-texto-tenue, #8b8b90); -webkit-text-fill-color: var(--gm-texto-tenue, #8b8b90); opacity: 0.75; }',
].join('\n');
