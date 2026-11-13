// Los colores de las páginas públicas de los planes: fijos, como /pagar y las legales (no hay sesión, no hay tema). La
// barra de la app se esconde igual que en ellas: viaja en el HTML aunque no haya sesión.
//
// EL DISEÑO DE LA PASARELA (12/11/2026, Martín: «Puedes hacer absolutamente todo el diseño de la pasarela de pago»). La
// referencia la eligió el Cerebro y NO se inventa: el checkout de un plan copia la ESTRUCTURA de Stripe Checkout (a la izquierda
// el resumen: el plan, el precio grande, qué incluye, el período y el total; a la derecha el formulario: tus datos y las formas
// de pago como filas; en el teléfono el resumen arriba y plegable, «Ver detalle»), y /planes la de la Pricing Table de Stripe.
// Lo que es de MaKo son los colores y la letra (app/globals.css): la tinta #121212, el botón negro, el dorado #F2B01E de la marca
// y Urbanist (declarada como «Geist»). SIN CREMA (12/11/2026, Martín: «unificar el color del fondo en todos lados, porque en
// precios está como un color cremita», y después «sigue estando el fondo en color cremita, eso ya te lo había dicho»): el fondo
// y las superficies son blancos, como el sitio, y lo elegido se marca en azul claro. Las tarjetas de /planes son las de
// app/planes/Tarjetas.tsx tal cual (ya no se repintan aquí con los colores de la Pricing Table de Stripe). Las capturas de la referencia y del resultado,
// en docs/hallazgos-planes-y-cobro.md → «El diseño de la pasarela».
//
// ⚠️ Las tarjetas de /planes (CSS_TARJETAS, app/planes/Tarjetas.tsx) las comparte la landing de /vsl: acá se pintan SÓLO dentro
// de `.planes-root`, para no tocar la landing.
export const CSS_PLANES = `
body:has(.planes-root) aside { display: none !important; }
body:has(.planes-root) { background: #FFFFFF; }
.planes-root { min-height: 100vh; padding: 40px 16px 56px; color: #121212;
  font: 400 16px/1.55 'Geist', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.planes-root a { color: inherit; }
.planes-wrap { max-width: 920px; margin: 0 auto; }
.planes-marca { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 16px; color: #121212; letter-spacing: -.01em; }
.planes-root h1 { margin: 8px 0 6px; font-size: 34px; line-height: 1.15; font-weight: 800; letter-spacing: -.02em; }
.planes-sub { margin: 0 0 28px; color: #4f4f4c; }
.planes-grilla { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.planes-card { background: #FFFFFF; border: 1px solid rgba(17,17,17,.09); border-radius: 16px; padding: 24px 22px; display: flex; flex-direction: column;
  box-shadow: 0 1px 2px rgba(17,17,17,.04), 0 8px 24px rgba(17,17,17,.06); }
.planes-card.destacado { border-color: #F2B01E; }
.planes-card h2 { margin: 0; font-size: 20px; }
.planes-precio { margin: 10px 0 4px; font-size: 34px; font-weight: 800; }
.planes-precio small { font-size: 15px; font-weight: 500; color: #4f4f4c; }
.planes-card p { margin: 0 0 14px; color: #4f4f4c; }
.planes-card ul { margin: 0 0 20px; padding-left: 18px; color: #121212; }
.planes-card li { margin: 4px 0; }
.planes-btn { display: inline-block; text-align: center; background: #121212; color: #fff !important; text-decoration: none; font-weight: 700;
  font-size: 16px; padding: 13px 20px; border-radius: 10px; border: 0; cursor: pointer; margin-top: auto; font-family: inherit;
  transition: background .15s ease, transform .1s ease; }
.planes-btn:hover { background: #202020; }
.planes-btn:active { transform: translateY(1px); }
.planes-btn:focus-visible { outline: 2px solid #F2B01E; outline-offset: 2px; }
.planes-btn[disabled] { opacity: .6; cursor: default; }
.planes-form { max-width: 460px; margin: 0 auto; background: #FFFFFF; border: 1px solid rgba(17,17,17,.09); border-radius: 16px; padding: 28px 24px;
  box-shadow: 0 1px 2px rgba(17,17,17,.04), 0 8px 24px rgba(17,17,17,.06); }
.planes-form label, .ck-formulario label { display: block; font-size: 14px; font-weight: 600; margin: 14px 0 6px; color: #2b2b29; }
.planes-form input[type=text], .planes-form input[type=email], .planes-form input[type=tel],
.ck-formulario input[type=text], .ck-formulario input[type=email], .ck-formulario input[type=tel] { width: 100%; box-sizing: border-box; font: inherit;
  padding: 11px 12px; border: 1px solid rgba(17,17,17,.17); border-radius: 10px; background: #fff; color: #121212;
  box-shadow: 0 1px 1px rgba(17,17,17,.04); transition: border-color .15s ease, box-shadow .15s ease; }
.planes-form input:focus, .ck-formulario input:focus { outline: none; border-color: #121212; box-shadow: 0 0 0 3px rgba(242,176,30,.35); }
.planes-form .planes-btn, .ck-formulario .planes-btn { width: 100%; margin-top: 22px; }
.planes-opcion { display: flex; gap: 10px; align-items: center; border: 1px solid rgba(17,17,17,.17); border-radius: 10px; padding: 10px 12px; margin-top: 8px; cursor: pointer; }
.planes-opcion input { margin: 0; }
/* El diagnóstico del Acelerador (QuieroPlan con preguntas): una pregunta por pantalla, respuestas grandes que avanzan solas. */
.planes-pasos { display: flex; gap: 6px; margin: 0 0 18px; }
.planes-pasos span { flex: 1; height: 4px; border-radius: 2px; background: #E6EAF0; }
.planes-pasos span.hecho { background: #121212; }
.planes-pregunta { margin: 0 0 16px; font-size: 20px; font-weight: 700; line-height: 1.3; outline: none; }
.planes-respuestas { display: grid; gap: 10px; }
.planes-respuesta { text-align: left; font: inherit; font-size: 15.5px; line-height: 1.4; padding: 14px 16px; border: 1px solid rgba(17,17,17,.17);
  border-radius: 12px; background: #fff; color: #121212; cursor: pointer; }
.planes-respuesta:hover, .planes-respuesta:focus-visible { border-color: #121212; background: #EEF4FF; }
.planes-respuesta[aria-pressed=true] { border-color: #121212; box-shadow: inset 0 0 0 1px #121212; background: #EEF4FF; }
.planes-atras { display: block; margin: 16px auto 0; background: none; border: 0; padding: 4px 8px; color: #121212; font: inherit;
  font-size: 14px; cursor: pointer; text-decoration: underline; }
.planes-error { margin-top: 14px; color: #b1412a; font-size: 14px; }
/* El código de referido del carrito (25/10/2026): un renglón chico que abre el campo, como el «Add promo code» de Stripe. */
.planes-codigo-abrir { display: inline-block; margin: 18px 0 0; padding: 7px 12px; background: #F1F3F7; border: 0; border-radius: 8px; color: #121212; font: inherit;
  font-size: 14px; font-weight: 600; cursor: pointer; text-align: left; }
.planes-codigo-abrir:hover { background: #E6EAF0; }
.planes-opcional { font-weight: 400; color: #636360; }
.planes-form .planes-codigo-error, .ck-formulario .planes-codigo-error { margin-top: 6px; }
.planes-form input[aria-invalid=true], .ck-formulario input[aria-invalid=true] { border-color: #b1412a; }
.planes-nota { margin-top: 14px; color: #4f4f4c; font-size: 13px; line-height: 1.5; text-align: center; }
.planes-trampa { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
.planes-volver { display: inline-block; margin-bottom: 16px; color: #121212; font-size: 14px; text-decoration: none; }
/* Los tres bloques de /planes (24/10/2026): el del medio destacado, el programa con Martín a la derecha y la comparación. */
.planes-wrap.planes-ancho { max-width: 1060px; }
.planes-grilla.planes-tres { grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); padding-top: 12px; align-items: stretch; }
.planes-card { position: relative; }
.planes-card.destacado { box-shadow: 0 0 0 1px #F2B01E, 0 14px 34px rgba(17,17,17,.10); }
.planes-insignia { position: absolute; top: -12px; left: 22px; background: #F2B01E; color: #1A1813; font-size: 12px; font-weight: 700;
  letter-spacing: .03em; padding: 4px 11px; border-radius: 999px; }
.planes-cuotas { margin: -2px 0 12px; color: #4f4f4c; font-size: 14px; }
.planes-card p.planes-despues { margin: -4px 0 18px; font-size: 13px; }
.planes-btn.planes-btn-borde { background: #FFFFFF; color: #121212 !important; box-shadow: inset 0 0 0 1px #121212; }
.planes-btn.planes-btn-borde:hover { background: #F1F3F7; }
.planes-compara { margin-top: 64px; }
.planes-compara-cab { display: grid; grid-template-columns: minmax(0, 1.6fr) repeat(var(--n, 3), minmax(0, 1fr)); gap: 16px; align-items: end;
  padding-bottom: 16px; border-bottom: 1px solid #E3E7EF; }
.planes-compara-cab h2 { margin: 0; font-size: 32px; line-height: 1.1; font-weight: 800; letter-spacing: -.02em; }
.planes-compara-plan { display: grid; gap: 8px; }
.planes-compara-plan b { font-size: 18px; line-height: 24px; font-weight: 600; }
.planes-compara-btn { display: block; text-align: center; padding: 8px 12px; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none;
  background: #12151B; color: #fff !important; }
.planes-compara-btn.azul { background: #2F6FED; }
.planes-grupo-d { border-bottom: 1px solid #E3E7EF; }
.planes-grupo-d summary { cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; padding: 20px 4px;
  font-size: 18px; line-height: 24px; font-weight: 600; }
.planes-grupo-d summary::-webkit-details-marker { display: none; }
.planes-grupo-d summary::after { content: ""; width: 9px; height: 9px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
  transform: rotate(45deg); margin: -4px 8px 0 0; transition: transform .15s ease; }
.planes-grupo-d[open] summary::after { transform: rotate(-135deg); margin-top: 4px; }
.planes-tabla { width: 100%; border-collapse: collapse; font-size: 14px; table-layout: fixed; margin-bottom: 8px; }
.planes-tabla col.planes-col-que { width: 38.5%; }
.planes-tabla th, .planes-tabla td { padding: 12px 4px; text-align: left; border-top: 1px solid #EEF1F5; vertical-align: top; }
.planes-tabla th[scope=row] { font-weight: 500; color: #12151B; padding-right: 16px; }
.planes-tabla td { color: #12151B; }
.planes-si { color: #12151B; font-weight: 700; }
/* ── La comparación con movimiento (13/11/2026, la llamada con Leila: «muy plana») ── */
.planes-compara-cab { z-index: 5; padding-top: 14px; background: rgba(255,255,255,.88); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
/* Pegada arriba al bajar, debajo de la barra del sitio (76 px y su borde) donde la hay (/planes); en la landing, arriba de todo. */
.planes-compara-cab { position: sticky; top: 0; }
body:has(.s-barra) .planes-compara-cab { top: 77px; }
.planes-compara-plan { position: relative; padding: 12px; border-radius: 14px; transition: transform .2s ease, box-shadow .2s ease; }
.planes-compara-plan[data-destacado] { background: linear-gradient(180deg, #EEF4FF, #fff); box-shadow: 0 10px 28px rgba(47,111,237,.16), inset 0 0 0 1.5px rgba(47,111,237,.35); }
.planes-compara-plan:hover { transform: translateY(-2px); }
.planes-compara-reco { position: absolute; top: -11px; left: 12px; padding: 2px 10px; border-radius: 999px; background: #2F6FED; color: #fff; font-size: 11.5px; font-weight: 700; letter-spacing: .02em; }
.planes-compara-btn { transition: filter .15s ease, transform .15s ease; }
.planes-compara-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
.planes-grupo-d { margin-top: 12px; border: 1px solid #E3E7EF; border-radius: 16px; padding: 0 16px; background: #fff; transition: box-shadow .2s ease, border-color .2s ease; interpolate-size: allow-keywords; }
.planes-grupo-d:hover { border-color: #C9D6EE; }
.planes-grupo-d[open] { box-shadow: 0 12px 32px rgba(18,21,27,.07); border-color: #C9D6EE; }
.planes-grupo-d::details-content { block-size: 0; overflow: hidden; transition: block-size .35s ease, content-visibility .35s allow-discrete; }
.planes-grupo-d[open]::details-content { block-size: auto; }
.planes-grupo-n { margin-left: 10px; margin-right: auto; padding: 1px 9px; border-radius: 999px; background: #EEF1F5; color: #5B6170; font-size: 12.5px; font-weight: 600; }
.planes-tabla td[data-destacado] { background: rgba(47,111,237,.06); }
.planes-tabla tr { transition: background-color .15s ease; }
.planes-tabla tbody tr:hover { background: #F6F8FC; }
.planes-si { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #12151B; color: #fff; }
.planes-tabla td[data-destacado] .planes-si { background: #2F6FED; }
.planes-grupo-d[open] .planes-si { animation: planes-tilde .38s cubic-bezier(.34,1.56,.64,1) both; animation-delay: calc(var(--i, 0) * 45ms + 80ms); }
@keyframes planes-tilde { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@supports (animation-timeline: view()) {
  .planes-tabla tbody tr { animation: planes-fila linear both; animation-timeline: view(); animation-range: entry 0% entry 60%; }
  @keyframes planes-fila { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
}
@media (prefers-reduced-motion: reduce) {
  .planes-grupo-d[open] .planes-si, .planes-tabla tbody tr { animation: none; }
  .planes-grupo-d::details-content { transition: none; }
}
.planes-no { color: #9AA1AD; }
.planes-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.planes-corto { display: none; }
/* En el teléfono: los nombres cortos arriba, y cada fila con su nombre a todo el ancho y los tres valores abajo. */
@media (max-width: 600px) {
  .planes-largo { display: none; }
  .planes-corto { display: inline; }
  .planes-compara-cab { grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); }
  .planes-compara-cab h2 { grid-column: 1 / -1; font-size: 26px; }
  .planes-compara-btn { display: none; }
  .planes-tabla, .planes-tabla tbody { display: block; }
  .planes-tabla colgroup { display: none; }
  .planes-tabla tr { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid #EEF1F5; }
  .planes-tabla th, .planes-tabla td { border-top: 0; }
  .planes-tabla th[scope=row] { grid-column: 1 / -1; padding: 12px 4px 2px; }
  .planes-tabla td { padding: 4px 4px 12px; font-size: 13px; }
  .planes-root h1 { font-size: 28px; }
}
.planes-pie { margin: 30px 0 0; text-align: center; color: #4f4f4c; font-size: 14px; }
.planes-pie a { color: #121212; font-weight: 700; text-decoration: underline; }

/* ── El checkout de un plan: la estructura de Stripe Checkout ─────────────────────────────────────────────────────────
   Computadora: dos mitades, el resumen a la izquierda (columna pegada al centro) y el formulario a la derecha, separados
   por una sombra. Teléfono: la marca, el resumen plegado («Ver detalle»), el formulario y el pie. */
body:has(.ck-root) { background: #FFFFFF; }
.planes-root.ck-root { padding: 0; }
.ck { display: grid; min-height: 100vh; grid-template-columns: 1fr 1fr; grid-template-areas: "res form" "pie form"; grid-template-rows: 1fr auto; }
.ck-resumen { grid-area: res; background: #FFFFFF; display: flex; justify-content: flex-end; padding: 56px 64px 24px 24px; }
.ck-pie { grid-area: pie; background: #FFFFFF; display: flex; justify-content: flex-end; padding: 0 64px 32px 24px; }
.ck-form { grid-area: form; background: #FFFFFF; padding: 56px 24px 48px 64px; box-shadow: -1px 0 0 rgba(17,17,17,.08), -18px 0 36px -26px rgba(17,17,17,.22); }
.ck-col { width: 100%; max-width: 400px; }
.ck-form .ck-col { max-width: 420px; }
.ck-marca { display: flex; align-items: center; gap: 10px; margin: 0 0 32px; font-weight: 800; font-size: 16px; letter-spacing: -.01em; }
.ck-volver { display: inline-grid; place-items: center; width: 30px; height: 30px; margin-left: -6px; border-radius: 8px; color: #4f4f4c;
  text-decoration: none; font-size: 18px; line-height: 1; transition: background .15s ease; }
.ck-volver:hover { background: rgba(17,17,17,.06); color: #121212; }
.ck-etiqueta { margin: 0 0 4px; color: #4f4f4c; font-size: 16px; font-weight: 500; }
.ck-precio { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin: 0 0 6px; font-size: 38px; font-weight: 800; letter-spacing: -.025em; line-height: 1.1; }
.ck-precio small { font-size: 15px; font-weight: 500; letter-spacing: 0; color: #4f4f4c; line-height: 1.25; }
.ck-otros { margin: 0 0 4px; color: #4f4f4c; font-size: 14px; }
.ck-detalle { margin-top: 28px; }
.ck-item { display: grid; grid-template-columns: 44px 1fr auto; gap: 14px; align-items: start; }
.ck-item-icono { width: 44px; height: 44px; border-radius: 12px; overflow: hidden; }
.ck-item b { display: block; font-size: 15px; font-weight: 700; }
.ck-item small { display: block; color: #636360; font-size: 13px; margin-top: 2px; }
.ck-item-precio { font-weight: 700; font-size: 15px; white-space: nowrap; }
.ck-incluye { list-style: none; margin: 14px 0 0 58px; padding: 0; display: grid; gap: 7px; }
.ck-incluye li { position: relative; padding-left: 22px; font-size: 13.5px; line-height: 1.45; color: #2b2b29; }
.ck-incluye li::before { content: "✓"; position: absolute; left: 0; top: 0; width: 16px; height: 16px; border-radius: 999px; background: #EEF4FF;
  color: #8F6709; font-size: 10px; font-weight: 800; display: grid; place-items: center; margin-top: 2px; }
.ck-totales { margin: 22px 0 0 58px; padding: 0; }
.ck-totales div { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid rgba(17,17,17,.09); font-size: 14.5px; }
.ck-totales dt { margin: 0; color: #2b2b29; }
.ck-totales dd { margin: 0; font-weight: 600; white-space: nowrap; }
.ck-totales div.ck-total { font-weight: 800; font-size: 15.5px; }
.ck-totales div.ck-total dt, .ck-totales div.ck-total dd { font-weight: 800; color: #121212; }
.ck-totales div.ck-descuento dd { color: #22735c; }
.ck-nota-res { margin: 10px 0 0 58px; color: #636360; font-size: 13px; line-height: 1.45; }
.ck-pie .ck-col { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; color: #636360; font-size: 12.5px; }
.ck-pie a { color: #636360; text-decoration: none; }
.ck-pie a:hover { color: #121212; text-decoration: underline; }
.ck-pie .ck-procesa { padding-right: 14px; border-right: 1px solid rgba(17,17,17,.15); }
.ck-pie b { color: #4f4f4c; font-weight: 700; }
.ck-plegable { display: none; }
.ck-titulo { margin: 0 0 4px; font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
.ck-formulario .ck-titulo:not(:first-child) { margin-top: 28px; }
.ck-formulario label:first-of-type { margin-top: 10px; }
.ck-sub { margin: 0 0 6px; color: #636360; font-size: 13.5px; }
.ck-medios { margin-top: 10px; border: 1px solid rgba(17,17,17,.17); border-radius: 12px; overflow: hidden; background: #fff; }
.ck-formulario label.ck-medio { display: grid; grid-template-columns: 18px 28px 1fr auto; gap: 12px; align-items: center; margin: 0; padding: 14px 16px;
  cursor: pointer; font-weight: 500; border-top: 1px solid rgba(17,17,17,.09); transition: background .15s ease; }
.ck-formulario label.ck-medio:first-child { border-top: 0; }
.ck-formulario label.ck-medio:hover { background: #f7f7f6; }
.ck-medio input { margin: 0; width: 16px; height: 16px; accent-color: #121212; }
.ck-medio-icono { width: 28px; height: 20px; border-radius: 4px; display: grid; place-items: center; background: #F1F3F7; color: #4f4f4c; font-size: 13px; }
.ck-medio-texto b { display: block; font-size: 15px; font-weight: 600; color: #121212; }
.ck-medio-texto small { display: block; font-size: 12.5px; color: #636360; margin-top: 1px; }
.ck-marcas { display: flex; gap: 4px; }
.ck-marcas span { font-size: 9.5px; font-weight: 800; letter-spacing: .02em; padding: 3px 5px; border-radius: 4px; background: #F1F3F7; color: #4f4f4c; }
.ck-medio:has(input:checked) { background: #EEF4FF !important; box-shadow: inset 3px 0 0 #F2B01E; }
.ck-legal { margin: 16px 0 0; color: #636360; font-size: 12.5px; line-height: 1.5; text-align: center; }
/* Teléfono (como Stripe debajo de ~900px): una columna; el resumen arriba y plegado. */
@media (max-width: 899px) {
  .ck { grid-template-columns: 1fr; grid-template-areas: "res" "form" "pie"; grid-template-rows: auto; min-height: 0; }
  .ck-resumen { justify-content: center; padding: 20px 16px 18px; }
  .ck-form { padding: 22px 16px 28px; box-shadow: 0 -1px 0 rgba(17,17,17,.08); border-radius: 18px 18px 0 0; margin-top: -10px; }
  .ck-pie { justify-content: center; background: #FFFFFF; padding: 4px 16px 32px; }
  .ck-col, .ck-form .ck-col { max-width: 480px; }
  .ck-marca { margin-bottom: 18px; }
  .ck-abierto { display: none; }
  .ck-plegable { display: block; }
  .ck-plegable > summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: 1fr; gap: 2px; }
  .ck-plegable > summary::-webkit-details-marker { display: none; }
  .ck-plegable .ck-etiqueta { font-size: 15px; }
  .ck-plegable .ck-precio { font-size: 32px; }
  .ck-ver { justify-self: start; display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 7px 12px; border-radius: 8px;
    background: rgba(17,17,17,.06); font-size: 14px; font-weight: 600; }
  .ck-ver::after { content: ""; width: 6px; height: 6px; border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: translateY(-2px) rotate(45deg); transition: transform .2s ease; }
  .ck-plegable[open] .ck-ver::after { transform: translateY(2px) rotate(225deg); }
  .ck-plegable[open] .ck-ver-abrir, .ck-plegable:not([open]) .ck-ver-cerrar { display: none; }
  .ck-detalle { margin-top: 18px; }
  .ck-incluye, .ck-totales, .ck-nota-res { margin-left: 0; }
  .ck-pie .ck-col { justify-content: center; text-align: center; }
}
@media (prefers-reduced-motion: reduce) {
  .planes-btn, .ck-volver, .ck-plegable .ck-ver::after, .ck-medio { transition: none; }
}
`;
