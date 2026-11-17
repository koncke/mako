// =============================================================================
// El estilo del formulario de /accelerator/aplicar (16/11/2026): el lenguaje de la landing, para escribir
// =============================================================================
// Va DESPUÉS de `CSS_ACELERADOR` (app/accelerator/estilo.ts: el fondo #0e0e10 con el grano, Sora en los títulos, Hanken Grotesk
// en el texto, Fraunces en cursiva para los remates, el naranja #E0613B, las tarjetas #171719 con borde #2a2a2e y 22 px de radio,
// el botón `.acl-btn`) y de `CSS_BARRA_ACCELERATOR`. Las clases llevan `apl-`: viven adentro de MaKo, como las `acl-`.
//
// Lo propio de un formulario:
//   · Los campos, oscuros y hundidos en la tarjeta: borde de 1,5 px, 12 px de radio, 54 px de alto y letra de 17 px (con menos
//     de 16 el iPhone agranda la página al tocar el campo). Con el foco, el naranja y un anillo; con un error, el rojo.
//   · Las opciones son tarjetas grandes, con el radio o el casillero de verdad adentro (escondido, pero es el que recibe el foco
//     y las flechas del teclado). La elegida, con el borde naranja, el fondo teñido y su marca llena. En dos columnas en la
//     computadora; en una si alguna opción es larga, y siempre en una en el teléfono.
//   · El rojo de los errores no es el de la landing (#c93838): sobre el fondo oscuro no se lee. Es uno más claro (6:1).
//   · El gris tenue tampoco es el de la landing (--acl-muted, #7C766C): medido el 16/11/2026, daba 4,28:1 en la nota y 3,86:1 en
//     «(opcional)» sobre la tarjeta, y el placeholder (#67635c) 3,23:1; lo mínimo para texto chico es 4,5:1. --apl-tenue (#8E887E)
//     da 4,9:1 o más sobre la página, la tarjeta y las opciones, y sigue lejos del texto escrito (16,6:1).
//   · Con `prefers-reduced-motion`, nada se mueve.
// ⚠️ ESTO ES UN TEMPLATE LITERAL: ni un acento grave adentro, tampoco en un comentario (lo cierra a la mitad).
// =============================================================================

/** Un dibujo para un `background`, con el trazo centrado en su lienzo de 16. */
function dibujo(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'>${svg}</svg>`)}")`;
}
const TILDE = (color: string, grosor = 2.2) => dibujo(`<path d='M3.5 8.5l3 3 6-7' fill='none' stroke='${color}' stroke-width='${grosor}' stroke-linecap='round' stroke-linejoin='round'/>`);
const ALERTA = dibujo(`<circle cx='8' cy='8' r='6.6' fill='none' stroke='#F87171' stroke-width='1.5'/><path d='M8 4.6v4.1' stroke='#F87171' stroke-width='1.6' stroke-linecap='round'/><circle cx='8' cy='11.2' r='.95' fill='#F87171'/>`);

export const CSS_APLICAR = `
/* SIN ANCLAJE DEL SCROLL (revisión del 16/11/2026): quien bajaba hasta «Siguiente» y pasaba a un paso más largo veía la página
   bajar de golpe y después subir sola. Chrome deja quieto en la pantalla el botón mientras el paso crece debajo y después el
   formulario la lleva a la tarjeta: medio segundo de página volando (1.330 px de más del paso 1 al 2 a 1440). Sin el ancla va
   directo y se queda quieta a los 364 ms en vez de 746. */
html:has(.apl-root) { overflow-anchor: none; }
.apl-root { --apl-error: #F87171; --apl-campo: #0e0e10; --apl-borde-campo: #303036; --apl-tenue: #8E887E; }
.apl-main { position: relative; padding: 136px 0 104px; }
.apl-main::before { content: ""; position: absolute; left: 50%; top: 0; width: min(980px, 100%); height: 460px; transform: translateX(-50%); pointer-events: none;
  background: radial-gradient(48% 58% at 50% 0%, rgba(224,97,59,.12), rgba(224,97,59,0) 72%); }
.apl-wrap { position: relative; max-width: 760px; margin: 0 auto; padding: 0 28px; }
.apl-oculto { position: absolute !important; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* ── La barra de arriba, en esta página: el botón de la derecha VUELVE al programa, no es la acción (la acción es el
   formulario), así que va con borde y sin relleno. En el teléfono, más chico y la marca en un renglón (medido de 320 a 430). ── */
.apl-root .acl-hdr .acl-btn { background: transparent; color: var(--acl-ink) !important; border-color: var(--acl-line-strong); }
.apl-root .acl-hdr .acl-btn:hover { background: rgba(241,238,232,.07); border-color: var(--acl-ink-soft); color: var(--acl-ink) !important; }
@media (max-width: 520px) {
  .apl-root .acl-hdr { padding-inline: 16px; gap: 10px; }
  .apl-root .acl-hdr .acl-marca { font-size: 13px; letter-spacing: .1em; white-space: nowrap; }
  /* Del alto de un dedo: medía 34 a 37 px de 320 a 390 (revisión del 16/11/2026). */
  .apl-root .acl-hdr .acl-btn { display: inline-flex; align-items: center; min-height: 44px; padding: 8px 12px; font-size: 11.5px; letter-spacing: .05em; }
}
@media (max-width: 380px) { .apl-root .acl-hdr .acl-marca { letter-spacing: .08em; } }
@media (max-width: 359px) {
  .apl-root .acl-hdr .acl-marca { font-size: 11.5px; letter-spacing: .03em; }
  .apl-root .acl-hdr .acl-btn { padding: 7px 10px; font-size: 11px; }
  .apl-root .acl-hdr-marca { gap: 7px; }
}

/* ── La cabeza: la ceja, el nombre del programa y lo que dice Martín ── */
.apl-cabeza { text-align: center; margin-bottom: 40px; }
.apl-cabeza .acl-pill { margin-bottom: 18px; }
.apl-root .apl-cabeza h1 { font-size: clamp(2.4rem, 5.4vw, 3.6rem); font-weight: 800; letter-spacing: -.02em; }
.apl-bajada { margin: 16px auto 0; max-width: 36em; font-family: var(--acl-serif); font-style: italic; font-weight: 500; font-size: 1.22rem; line-height: 1.45;
  color: var(--acl-ink-soft); text-wrap: balance; }
.apl-retomada { display: inline-block; margin-top: 20px; padding: 7px 16px; border-radius: 14px; font-size: 14.5px; line-height: 1.45; color: var(--acl-ink-soft);
  background: rgba(47,166,106,.08); border: 1px solid rgba(47,166,106,.32); }

/* ── La tarjeta del paso ── */
.apl-tarjeta { position: relative; padding: 32px 40px 30px; border-radius: 22px; border: 1.5px solid var(--acl-borde); scroll-margin-top: 16px;
  background: linear-gradient(180deg, #1a1a1d 0%, #141416 100%); box-shadow: 0 1px 0 rgba(255,255,255,.035) inset, 0 40px 80px -48px rgba(0,0,0,.85); }
.apl-barra { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 28px; }
.apl-barra span { position: relative; height: 4px; border-radius: 4px; overflow: hidden; background: rgba(241,238,232,.10); }
.apl-barra span::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: var(--acl-accent); transform: scaleX(0); transform-origin: left center;
  transition: transform .5s cubic-bezier(.22,.8,.24,1); }
.apl-barra .apl-hecho::after, .apl-barra .apl-actual::after { transform: scaleX(1); }
.apl-barra .apl-hecho::after { opacity: .55; }
.apl-root .apl-titulo-paso { outline: none; font-family: var(--acl-sans); font-weight: 700; font-size: clamp(1.65rem, 3.2vw, 2.05rem); line-height: 1.15; letter-spacing: -.015em; }
.apl-paso-n { display: block; margin-bottom: 10px; font-family: var(--acl-sans); font-weight: 600; font-size: 12.5px; line-height: 1.3; letter-spacing: .18em; text-transform: uppercase; color: var(--acl-accent); }
.apl-tarjeta-bajada { margin-top: 10px; max-width: 60ch; font-size: 1.02rem; line-height: 1.55; color: var(--acl-ink-soft); }
.apl-campos { display: flex; flex-direction: column; gap: 30px; margin-top: 30px; }
.apl-entra { animation: apl-entra .38s cubic-bezier(.22,.8,.24,1) both; }
@keyframes apl-entra { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.apl-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 30px 18px; }

/* ── Un campo: la pregunta, su ayuda, el control y el error ── */
/* El alto de la barra fija ya lo descuenta el scroll-padding-top de la raíz (CSS_ACELERADOR): aquí sólo un poco de aire. */
.apl-campo { min-width: 0; border: 0; scroll-margin-top: 24px; }
.apl-rotulo { display: block; margin-bottom: 9px; font-family: var(--acl-body); font-weight: 600; font-size: 17px; line-height: 1.42; color: var(--acl-ink); }
legend.apl-rotulo { float: left; width: 100%; }
legend.apl-rotulo + * { clear: both; }
.apl-opcional { font-weight: 400; color: var(--apl-tenue); }
.apl-ayuda { margin: -3px 0 11px; font-size: 15px; line-height: 1.45; color: var(--acl-ink-soft); }
.apl-input { display: block; width: 100%; height: 54px; padding: 0 16px; font-family: var(--acl-body); font-size: 17px; line-height: 1.4; color: var(--acl-ink);
  background: var(--apl-campo); border: 1.5px solid var(--apl-borde-campo); border-radius: 12px; -webkit-appearance: none; appearance: none;
  transition: border-color .16s ease, box-shadow .16s ease, background-color .16s ease; }
.apl-input::placeholder { color: var(--apl-tenue); opacity: 1; }
.apl-input:hover { border-color: #46464e; }
.apl-input:focus { outline: none; border-color: var(--acl-accent); background: #101012; box-shadow: 0 0 0 4px rgba(224,97,59,.20); }
.apl-input[aria-invalid="true"] { border-color: var(--apl-error); }
.apl-input[aria-invalid="true"]:focus { box-shadow: 0 0 0 4px rgba(248,113,113,.18); }
.apl-input:-webkit-autofill { -webkit-text-fill-color: var(--acl-ink); caret-color: var(--acl-ink); box-shadow: 0 0 0 1000px #17171b inset; transition: background-color 9999s ease 0s; }
.apl-input:-webkit-autofill:focus { box-shadow: 0 0 0 1000px #17171b inset, 0 0 0 4px rgba(224,97,59,.20); }
/* ── El WhatsApp: el código de país que se elige y el número (TelefonoConPais, el del checkout). El selector y su menú son los de
   la app y se pintan con sus variables: aquí valen las del oscuro del formulario. El menú se dibuja en .apl-menus (portalTo),
   adentro de la tarjeta y FUERA de los campos: en el cuerpo de la página tomaba los colores del tema de la app, y adentro de los
   campos, que entran con un transform, se ubicaba mal mientras duraba la animación. El número es un .apl-input más. ── */
.apl-tel, .apl-menus { --surface: #141416; --surface-2: #232328; --border: #2c2c31; --border-strong: #3a3a41; --ink: var(--acl-ink);
  --dim: var(--acl-ink-soft); --faint: var(--apl-tenue); --primary: var(--acl-accent); --primary-bg: rgba(224,97,59,.14);
  --focus-ring: 0 0 0 4px rgba(224,97,59,.20); }
.apl-tel button[aria-haspopup="listbox"] { transition: border-color .16s ease, box-shadow .16s ease; }
.apl-tel button[aria-haspopup="listbox"]:hover { border-color: #46464e !important; }
.apl-tel button[aria-haspopup="listbox"]:focus-visible, .apl-tel button[aria-expanded="true"] { border-color: var(--acl-accent) !important; box-shadow: 0 0 0 4px rgba(224,97,59,.20); }
.apl-menus [role="listbox"] { box-shadow: 0 28px 60px -24px rgba(0,0,0,.9) !important; }
.apl-menus [role="listbox"] button { font-family: var(--acl-body) !important; font-size: 15px !important; }
/* El buscador del menú: con menos de 16 px el iPhone agranda la página al tocarlo. */
.apl-menus [role="listbox"] input { font-size: 16px !important; background: var(--apl-campo); color: var(--acl-ink); }
/* ── El Instagram y el YouTube (16/11/2026): el campo, lo que dice la búsqueda y las cuentas para elegir (CampoCanal). Cada cuenta
   es un botón del alto de un dedo, con su foto (o su inicial, si la foto no carga), su nombre, su @ y «Es la mía». ── */
.apl-canal-estado { min-height: 0; margin-top: 8px; font-size: 14.5px; line-height: 1.45; color: var(--acl-ink-soft); }
.apl-canal-estado:empty { display: none; }
.apl-canal-ok { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin-top: 9px; font-size: 14.5px; line-height: 1.45; font-weight: 600; color: var(--acl-ink); }
.apl-canal-ok svg { flex: none; color: var(--acl-verde); }
.apl-canal-ok span { font-weight: 400; color: var(--acl-ink-soft); }
.apl-canal-lista { display: grid; gap: 8px; margin-top: 10px; }
.apl-canal-op { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 8px 14px 8px 10px; border-radius: 12px; cursor: pointer;
  text-align: left; font: inherit; color: var(--acl-ink); background: #111113; border: 1.5px solid #2c2c31; transition: border-color .16s ease, background-color .16s ease; }
.apl-canal-op:hover { border-color: var(--acl-accent); background: rgba(224,97,59,.08); }
.apl-canal-op:focus-visible { outline: none; border-color: var(--acl-accent); box-shadow: 0 0 0 4px rgba(224,97,59,.24); }
.apl-canal-foto { position: relative; flex: none; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center;
  font-family: var(--acl-sans); font-weight: 700; font-size: 16px; color: var(--acl-ink-soft); background: #232328; }
.apl-root .apl-canal-foto img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.apl-canal-quien { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; line-height: 1.35; }
.apl-canal-quien b { font-weight: 600; font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.apl-canal-quien span { font-size: 13.5px; color: var(--acl-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.apl-canal-es { flex: none; font-family: var(--acl-sans); font-weight: 600; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--acl-accent); }
/* Crece con lo que se escribe (FormularioAplicacion.tsx, AreaQueCrece): sin la manija de agrandar ni barra adentro. */
textarea.apl-input { height: auto; min-height: 150px; padding: 14px 16px; line-height: 1.55; resize: none; overflow-y: auto; }
.apl-pie-campo { display: flex; align-items: flex-start; gap: 14px; margin-top: 9px; }
.apl-pie-campo:empty { display: none; }
.apl-contador { margin-left: auto; flex: none; font-size: 13.5px; line-height: 1.45; color: var(--apl-tenue); font-variant-numeric: tabular-nums; }
.apl-contador-tope { color: var(--acl-accent); }
.apl-error { display: flex; align-items: flex-start; gap: 8px; font-size: 15px; line-height: 1.45; color: var(--apl-error); }
.apl-error::before { content: ""; flex: none; width: 16px; height: 16px; margin-top: 2px; background: ${ALERTA} center / 16px 16px no-repeat; }
.apl-campo > .apl-error { margin-top: 9px; }

/* ── Las opciones: tarjetas con su radio o su casillero de verdad adentro ── */
.apl-opciones { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.apl-opciones.apl-una-col { grid-template-columns: 1fr; }
.apl-op { position: relative; display: flex; align-items: center; gap: 14px; min-height: 58px; padding: 14px 18px; border-radius: 14px; cursor: pointer;
  background: #111113; border: 1.5px solid #2c2c31; color: var(--acl-ink); font-size: 16.5px; line-height: 1.4; -webkit-tap-highlight-color: transparent;
  transition: border-color .16s ease, background-color .16s ease, transform .16s ease; }
.apl-op:hover { border-color: #47474f; background: #151517; }
.apl-op:active { transform: scale(.992); }
.apl-op-sel, .apl-op-sel:hover { border-color: var(--acl-accent); background: rgba(224,97,59,.10); }
.apl-op-input { position: absolute; top: 50%; left: 18px; width: 1px; height: 1px; margin: 0; opacity: 0; pointer-events: none; }
.apl-marca { position: relative; flex: none; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid #5a5a63; background: #0b0b0d;
  transition: border-color .16s ease, background-color .16s ease, box-shadow .16s ease; }
.apl-marca::after { content: ""; position: absolute; inset: 3.5px; border-radius: 50%; background: var(--acl-accent); transform: scale(0); transition: transform .18s cubic-bezier(.3,1.35,.5,1); }
.apl-op-sel .apl-marca { border-color: var(--acl-accent); }
.apl-op-sel .apl-marca::after { transform: scale(1); }
.apl-op-caja .apl-marca { border-radius: 6px; }
.apl-op-caja .apl-marca::after { inset: -1.5px; border-radius: 6px; background: ${TILDE('#fff')} center / 13px 13px no-repeat, var(--acl-accent); }
.apl-op-input:focus-visible + .apl-marca { box-shadow: 0 0 0 4px rgba(224,97,59,.32); }
.apl-op:has(.apl-op-input:focus-visible) { border-color: var(--acl-accent); }
.apl-con-error .apl-op:not(.apl-op-sel) { border-color: rgba(248,113,113,.5); }
.apl-op-confirmo { align-items: flex-start; padding: 18px 20px; line-height: 1.5; }
.apl-op-confirmo .apl-marca { margin-top: 2px; }

/* ── Atrás, Siguiente y Enviar ── */
.apl-nav { display: flex; align-items: center; gap: 16px; margin-top: 38px; padding-top: 24px; border-top: 1px solid var(--acl-line); }
.apl-atras { display: inline-flex; align-items: center; gap: 8px; padding: 12px 6px; border: 0; border-radius: 6px; background: none; cursor: pointer;
  font-family: var(--acl-sans); font-weight: 600; font-size: 14px; letter-spacing: .06em; text-transform: uppercase; color: var(--acl-ink-soft); }
.apl-atras:hover { color: var(--acl-ink); }
.apl-atras:focus-visible { outline: 2px solid var(--acl-accent); outline-offset: 2px; }
.apl-atras svg, .apl-nav .acl-btn svg { width: 17px; height: 17px; flex: none; }
.apl-nav .acl-btn { margin-left: auto; display: inline-flex; align-items: center; justify-content: center; gap: 10px; }
.apl-nav .acl-btn[disabled], .apl-nav .acl-btn[disabled]:hover { cursor: progress; opacity: .78; transform: none; background: var(--acl-ink); border-color: var(--acl-ink); color: #0B0B0C !important; }
/* Sin mouse (el teléfono), el :hover de la landing queda PEGADO después de tocar (iOS): el «Siguiente» del paso nuevo seguía
   naranja con el texto claro, 3,05:1 (medido el 16/11/2026). Ahí, tocarlo no lo cambia. */
@media (hover: none) {
  .apl-nav .acl-btn:hover { background: var(--acl-ink); border-color: var(--acl-ink); color: #0B0B0C !important; transform: none; }
}
.apl-girando { flex: none; width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(11,11,12,.22); border-top-color: #0B0B0C; animation: apl-gira .8s linear infinite; }
@keyframes apl-gira { to { transform: rotate(360deg); } }
.apl-aviso-error { margin-top: 26px; padding: 14px 16px; border-radius: 12px; font-size: 15.5px; line-height: 1.5; color: #FCA5A5;
  background: rgba(248,113,113,.08); border: 1px solid rgba(248,113,113,.35); }
/* Sin la nota de debajo ni los legales (16/11/2026, Martín: «no pongas textos innecesarios»): se fueron .apl-nota y .apl-legales. */
/* El campo trampa: fuera de la pantalla, sin foco ni lector de pantalla (un bot lo llena; una persona, nunca). */
.apl-trampa { position: absolute; left: -10000px; top: auto; width: 1px; height: 1px; overflow: hidden; }
.apl-sinjs { margin-bottom: 18px; text-align: center; font-size: 15px; color: var(--acl-ink-soft); }

/* ── La pantalla final ── */
.apl-fin { text-align: center; outline: none; }
.apl-fin-ico { width: 60px; height: 60px; margin: 0 auto 24px; border-radius: 50%; background: ${TILDE('#fff', 1.9)} center / 28px 28px no-repeat, var(--acl-verde);
  box-shadow: 0 0 0 9px rgba(47,166,106,.13); }
.apl-root .apl-fin h1 { font-size: clamp(2.3rem, 5vw, 3.3rem); font-weight: 800; letter-spacing: -.02em; outline: none; }
.apl-fin-texto { margin: 18px auto 0; max-width: 44ch; font-size: 1.2rem; line-height: 1.55; color: var(--acl-ink-soft); text-wrap: balance; }
/* El video de Martín (16/11/2026): el marco del VSL de la landing (.acl-video, con sus esquinas), del ancho del texto. Sólo con
   video (VIDEO_DE_GRACIAS, ./reglas.ts): sin él no hay bloque (revisión del 16/11/2026, ya no dice «Muy pronto»). */
.apl-video { position: relative; margin: 30px auto 0; max-width: 560px; aspect-ratio: 16 / 9; border-radius: 4px; overflow: hidden;
  border: 1px solid var(--acl-line-strong); background: radial-gradient(60% 70% at 50% 45%, #22201d 0%, #141416 70%); }
.apl-root .apl-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
/* TU SIGUIENTE PASO, BIEN VISIBLE (16/11/2026, Martín: «está bien la parte de arriba, gracias, pero pondría como una sección más
   visible del siguiente paso»): su propia tarjeta, la de los pasos del formulario con el borde y el brillo naranjas, el título grande
   y los botones, nada más («no hace falta tanto texto… Tal vez solamente los botones»). Hasta ahí era una ceja de 12 px sobre los
   botones, suelta debajo del gracias. Los dos botones en un renglón en la computadora. */
.apl-main:has(.apl-fin) { padding-top: 116px; }
.apl-siguiente { position: relative; margin: 40px auto 0; max-width: 640px; padding: 34px 36px 36px; border-radius: 22px; overflow: hidden;
  border: 1.5px solid rgba(224,97,59,.55);
  background: radial-gradient(70% 90% at 50% 0%, rgba(224,97,59,.16), rgba(224,97,59,0) 70%), linear-gradient(180deg, #1a1a1d 0%, #141416 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.035) inset, 0 40px 80px -48px rgba(0,0,0,.85); }
.apl-root .apl-siguiente-titulo { font-family: var(--acl-sans); font-weight: 800; font-size: clamp(1.6rem, 3.4vw, 2.1rem); line-height: 1.15; letter-spacing: -.015em; color: #fff; }
.apl-siguiente-botones { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 22px; }
.apl-siguiente-botones .acl-btn, .apl-boton-borde { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: 14px 24px; }
.apl-root .apl-boton-borde { font-family: var(--acl-sans); font-weight: 600; font-size: 15px; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap;
  color: var(--acl-ink); border: 1px solid var(--acl-line-strong); border-radius: 2px; transition: border-color .25s, background .25s; }
.apl-root .apl-boton-borde:hover { background: rgba(241,238,232,.07); border-color: var(--acl-ink-soft); }
.apl-boton-borde:focus-visible { outline: 2px solid var(--acl-accent); outline-offset: 3px; }
.apl-otra { margin-top: 40px; font-size: 14px; color: var(--apl-tenue); }
.apl-otra button { padding: 0; border: 0; background: none; font: inherit; color: var(--acl-ink-soft); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.apl-otra button:hover { color: var(--acl-ink); }
.apl-otra button:focus-visible { outline: 2px solid var(--acl-accent); outline-offset: 3px; border-radius: 3px; }

@media (max-width: 880px) {
  .apl-main { padding: 118px 0 80px; }
}
@media (max-width: 640px) {
  .apl-wrap { padding: 0 16px; }
  .apl-cabeza { margin-bottom: 28px; }
  .apl-bajada { font-size: 1.1rem; }
  .apl-tarjeta { padding: 24px 20px 22px; border-radius: 18px; }
  .apl-barra { margin-bottom: 22px; }
  .apl-campos { gap: 26px; margin-top: 24px; }
  .apl-fila, .apl-opciones { grid-template-columns: 1fr; }
  .apl-fila { gap: 26px; }
  .apl-op { min-height: 54px; padding: 13px 16px; }
  /* Atrás, un cuadrado con la flecha; el botón principal, todo el resto (solo, todo el ancho). Medido el 16/11/2026: con el texto,
     «Enviar aplicación» se salía de la tarjeta a 360 y a 320 px. */
  .apl-nav { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; margin-top: 30px; padding-top: 20px; }
  .apl-atras { justify-content: center; width: 52px; height: 52px; padding: 0; border: 1.5px solid var(--acl-line-strong); border-radius: 2px; }
  .apl-atras-texto { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .apl-nav .acl-btn { margin-left: 0; min-width: 0; padding: 15px 12px; font-size: 14px; letter-spacing: .05em; }
  .apl-nav .acl-btn:only-child { grid-column: 1 / -1; }
  .apl-siguiente { padding: 26px 20px 24px; border-radius: 18px; }
  .apl-siguiente-botones { flex-direction: column; align-items: stretch; margin-top: 18px; }
  /* En un renglón de 320 a 430 (medido con el texto más largo que tuvo esta pantalla, que con 15 px iba en dos). */
  .apl-siguiente-botones .acl-btn, .apl-root .apl-boton-borde { font-size: 13.5px; letter-spacing: .04em; padding-inline: 12px; }
  .apl-siguiente-botones .acl-btn, .apl-boton-borde { white-space: normal; text-align: center; }
}
@media (max-width: 359px) {
  .apl-tarjeta { padding: 22px 16px 20px; }
  /* A 320 el número del WhatsApp mide 130 px al lado del código de país: con menos aire adentro, uno de 10 cifras entra entero. */
  .apl-tel .apl-input { padding-inline: 11px; }
  .apl-op { gap: 12px; padding: 12px 14px; }
  .apl-nav .acl-btn { padding-inline: 10px; font-size: 13px; letter-spacing: .04em; }
}
/* ── EL PRIMER PASO, SIN SCROLL (Martín, 16/11/2026, a la noche: «no debería tener scroll… al menos en el primer paso del formulario;
   en los otros, si es más largo, bueno, se entiende»). Medido antes a 1440 × 900: 419 px de más. La cabeza sin la ceja y más baja, la
   tarjeta más apretada y, en una pantalla ancha, las tres respuestas de «¿Ya tienes cuenta en MaKo?» en un renglón. Los demás pasos
   quedan como estaban. */
.apl-wrap[data-paso="0"] .apl-cabeza { margin-bottom: 22px; }
.apl-wrap[data-paso="0"] .apl-cabeza .acl-pill { display: none; }
.apl-root .apl-wrap[data-paso="0"] .apl-cabeza h1 { font-size: clamp(2.1rem, 4.2vw, 2.8rem); }
.apl-wrap[data-paso="0"] .apl-bajada { margin-top: 8px; font-size: 1.12rem; }
.apl-wrap[data-paso="0"] .apl-tarjeta { padding-top: 26px; padding-bottom: 24px; }
.apl-wrap[data-paso="0"] .apl-barra { margin-bottom: 20px; }
.apl-wrap[data-paso="0"] .apl-campos { gap: 20px; margin-top: 20px; }
.apl-wrap[data-paso="0"] .apl-fila { row-gap: 20px; }
.apl-wrap[data-paso="0"] .apl-rotulo { margin-bottom: 7px; font-size: 16px; }
.apl-wrap[data-paso="0"] .apl-input { height: 50px; }
.apl-wrap[data-paso="0"] .apl-op { min-height: 52px; padding-block: 10px; }
.apl-wrap[data-paso="0"] .apl-nav { margin-top: 24px; padding-top: 18px; }
.apl-main:has(.apl-wrap[data-paso="0"]) { padding-top: 104px; padding-bottom: 24px; }
@media (min-width: 721px) {
  .apl-wrap[data-paso="0"] .apl-opciones.apl-una-col { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .apl-wrap[data-paso="0"] .apl-op { font-size: 15.5px; gap: 10px; padding-inline: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .apl-entra, .apl-girando { animation: none; }
  .apl-barra span::after, .apl-op, .apl-marca, .apl-marca::after, .apl-input { transition: none; }
  .apl-op:active { transform: none; }
}
`;
