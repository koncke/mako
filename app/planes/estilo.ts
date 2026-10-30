// Los colores de las páginas públicas de los planes: fijos, como /pagar y las legales (no hay sesión, no hay tema). La
// barra de la app se esconde igual que en ellas: viaja en el HTML aunque no haya sesión.
export const CSS_PLANES = `
body:has(.planes-root) aside { display: none !important; }
body:has(.planes-root) { background: #F4F6F9; }
.planes-root { min-height: 100vh; padding: 40px 16px 56px; color: #12151B;
  font: 400 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.planes-wrap { max-width: 920px; margin: 0 auto; }
.planes-marca { font-weight: 700; font-size: 15px; color: #2F6FED; letter-spacing: .02em; }
.planes-root h1 { margin: 8px 0 6px; font-size: 30px; line-height: 1.2; }
.planes-sub { margin: 0 0 28px; color: #5B6472; }
.planes-grilla { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.planes-card { background: #fff; border: 1px solid #EAECF1; border-radius: 16px; padding: 24px 22px; display: flex; flex-direction: column;
  box-shadow: 0 1px 2px rgba(18,21,27,.04), 0 8px 24px rgba(18,21,27,.06); }
.planes-card.destacado { border-color: #2F6FED; }
.planes-card h2 { margin: 0; font-size: 20px; }
.planes-precio { margin: 10px 0 4px; font-size: 34px; font-weight: 700; }
.planes-precio small { font-size: 15px; font-weight: 500; color: #5B6472; }
.planes-card p { margin: 0 0 14px; color: #5B6472; }
.planes-card ul { margin: 0 0 20px; padding-left: 18px; color: #12151B; }
.planes-card li { margin: 4px 0; }
.planes-btn { display: inline-block; text-align: center; background: #2F6FED; color: #fff !important; text-decoration: none; font-weight: 600;
  font-size: 15px; padding: 12px 20px; border-radius: 10px; border: 0; cursor: pointer; margin-top: auto; }
.planes-btn[disabled] { opacity: .6; cursor: default; }
.planes-form { max-width: 460px; margin: 0 auto; background: #fff; border: 1px solid #EAECF1; border-radius: 16px; padding: 28px 24px;
  box-shadow: 0 1px 2px rgba(18,21,27,.04), 0 8px 24px rgba(18,21,27,.06); }
.planes-form label { display: block; font-size: 14px; font-weight: 600; margin: 14px 0 6px; }
.planes-form input[type=text], .planes-form input[type=email], .planes-form input[type=tel] { width: 100%; box-sizing: border-box; font: inherit; padding: 11px 12px;
  border: 1px solid #D5D9E0; border-radius: 10px; background: #fff; color: #12151B; }
.planes-form .planes-btn { width: 100%; margin-top: 22px; }
.planes-opcion { display: flex; gap: 10px; align-items: center; border: 1px solid #D5D9E0; border-radius: 10px; padding: 10px 12px; margin-top: 8px; cursor: pointer; }
.planes-opcion input { margin: 0; }
/* El diagnóstico del Acelerador (QuieroPlan con preguntas): una pregunta por pantalla, respuestas grandes que avanzan solas. */
.planes-pasos { display: flex; gap: 6px; margin: 0 0 18px; }
.planes-pasos span { flex: 1; height: 4px; border-radius: 2px; background: #E3E7EE; }
.planes-pasos span.hecho { background: #2F6FED; }
.planes-pregunta { margin: 0 0 16px; font-size: 20px; font-weight: 700; line-height: 1.3; outline: none; }
.planes-respuestas { display: grid; gap: 10px; }
.planes-respuesta { text-align: left; font: inherit; font-size: 15.5px; line-height: 1.4; padding: 14px 16px; border: 1px solid #D5D9E0;
  border-radius: 12px; background: #fff; color: #12151B; cursor: pointer; }
.planes-respuesta:hover, .planes-respuesta:focus-visible { border-color: #2F6FED; background: #F5F8FF; }
.planes-respuesta[aria-pressed=true] { border-color: #2F6FED; box-shadow: inset 0 0 0 1px #2F6FED; background: #F5F8FF; }
.planes-atras { display: block; margin: 16px auto 0; background: none; border: 0; padding: 4px 8px; color: #2F6FED; font: inherit;
  font-size: 14px; cursor: pointer; }
.planes-error { margin-top: 14px; color: #B42318; font-size: 14px; }
/* El código de referido del carrito (25/10/2026): un renglón chico que abre el campo, como el «Add promo code» de Stripe. */
.planes-codigo-abrir { display: block; margin: 16px 0 0; padding: 0; background: none; border: 0; color: #2F6FED; font: inherit;
  font-size: 14px; font-weight: 600; cursor: pointer; text-align: left; }
.planes-codigo-abrir:hover { text-decoration: underline; }
.planes-opcional { font-weight: 400; color: #5B6472; }
.planes-form .planes-codigo-error { margin-top: 6px; }
.planes-form input[aria-invalid=true] { border-color: #B42318; }
.planes-nota { margin-top: 14px; color: #5B6472; font-size: 13px; text-align: center; }
.planes-trampa { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
.planes-volver { display: inline-block; margin-bottom: 16px; color: #2F6FED; font-size: 14px; text-decoration: none; }
/* Los tres bloques de /planes (24/10/2026): el del medio destacado, el programa con Martín a la derecha y la comparación. */
.planes-wrap.planes-ancho { max-width: 1060px; }
.planes-grilla.planes-tres { grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); padding-top: 12px; align-items: stretch; }
.planes-card { position: relative; }
.planes-card.destacado { box-shadow: 0 0 0 1px #2F6FED, 0 14px 34px rgba(47,111,237,.18); }
.planes-insignia { position: absolute; top: -12px; left: 22px; background: #2F6FED; color: #fff; font-size: 12px; font-weight: 700;
  letter-spacing: .03em; padding: 4px 11px; border-radius: 999px; }
.planes-cuotas { margin: -2px 0 12px; color: #5B6472; font-size: 14px; }
.planes-card p.planes-despues { margin: -4px 0 18px; font-size: 13px; }
.planes-btn.planes-btn-borde { background: #fff; color: #2F6FED !important; box-shadow: inset 0 0 0 1px #2F6FED; }
.planes-compara { margin-top: 44px; }
.planes-compara h2 { margin: 0 0 14px; font-size: 22px; }
.planes-tabla-wrap { overflow-x: auto; background: #fff; border: 1px solid #EAECF1; border-radius: 16px;
  box-shadow: 0 1px 2px rgba(18,21,27,.04), 0 8px 24px rgba(18,21,27,.06); }
.planes-tabla { width: 100%; min-width: 600px; border-collapse: collapse; font-size: 14px; }
.planes-tabla th, .planes-tabla td { padding: 12px 16px; text-align: center; border-bottom: 1px solid #EAECF1; }
.planes-tabla th[scope=row] { text-align: left; font-weight: 500; color: #12151B; }
.planes-tabla thead th { background: #F8F9FB; font-weight: 700; }
.planes-tabla thead th.destacado { color: #2F6FED; }
.planes-tabla tbody tr:last-child th, .planes-tabla tbody tr:last-child td { border-bottom: 0; }
.planes-si { color: #1F9D55; font-weight: 700; }
.planes-no { color: #A0A7B4; }
.planes-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.planes-corto { display: none; }
/* En el teléfono las CUATRO columnas entran a la vez: una comparación que esconde dos planes detrás de un deslizar no compara. */
@media (max-width: 600px) {
  .planes-largo { display: none; }
  .planes-corto { display: inline; }
  .planes-tabla { min-width: 0; font-size: 12.5px; table-layout: fixed; }
  .planes-tabla th, .planes-tabla td { padding: 10px 6px; }
  .planes-tabla th[scope=row] { width: 40%; padding-left: 12px; }
}
.planes-pie { margin: 30px 0 0; text-align: center; color: #5B6472; font-size: 14px; }
.planes-pie a { color: #2F6FED; font-weight: 600; text-decoration: none; }
`;
