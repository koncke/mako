// Los estilos de «Revisa tu correo» (./AccesoMako.tsx). En su propio archivo y no en el componente: lo que exporta un archivo
// 'use client' que no es un componente le llega al servidor como una referencia, no como el texto (tests/frontera-use-client.test.ts).

/**
 * Los estilos de «Revisa tu correo», fijos como el resto de /pagar (no hay sesión, no hay tema). Una columna centrada sin tarjeta,
 * como la maqueta: el sobre, lo que ya pasó, el título grande y una sola acción negra; las otras dos, links debajo.
 */
export const CSS_GRACIAS = `
body:has(.gr-root) aside { display: none !important; }
body:has(.gr-root) { background: #F0F0EE; }
.gr-root { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 40px 16px; box-sizing: border-box; color: #121212;
  font: 400 16px/1.55 'Geist', ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.gr { width: 100%; max-width: 480px; text-align: center; }
.gr-negocio { margin: 0 0 28px; font-weight: 700; font-size: 14px; color: #4f4f4c; }
.gr-sobre { width: 88px; height: 88px; margin: 0 auto 20px; border-radius: 24px; background: #E4E4E0; color: #121212; display: grid; place-items: center; }
.gr-chip { display: inline-block; max-width: 100%; box-sizing: border-box; margin: 0; padding: 5px 14px; border-radius: 16px; background: #DDF1E7; color: #1E6A52;
  font-size: 13.5px; font-weight: 600; line-height: 1.45; text-align: center; }
.gr-chip-p { white-space: nowrap; }
.gr-prueba { margin: 8px 0 0; font-size: 12px; font-weight: 700; color: #8F6709; }
.gr h1 { margin: 16px 0 10px; font-size: 42px; line-height: 1.08; font-weight: 800; letter-spacing: -.025em; }
.gr-txt { margin: 0 auto; max-width: 440px; color: #4f4f4c; font-size: 17px; line-height: 1.5; }
.gr-txt b { color: #121212; font-weight: 700; word-break: break-word; }
.gr-txt a { color: #121212; text-decoration: underline; text-underline-offset: 3px; word-break: break-word; }
.gr-btn { display: inline-block; box-sizing: border-box; min-width: 260px; margin-top: 26px; padding: 15px 28px; border: 0; border-radius: 12px; background: #121212;
  color: #fff !important; font: inherit; font-size: 16px; font-weight: 700; text-decoration: none; cursor: pointer; transition: background .15s ease; }
.gr-btn:hover { background: #262626; }
.gr-btn:focus-visible, .gr-links a:focus-visible, .gr-links button:focus-visible { outline: 2px solid #F2B01E; outline-offset: 2px; }
.gr-btn[disabled] { opacity: .6; cursor: default; }
.gr-links { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px 28px; margin-top: 18px; }
.gr-links a, .gr-links button { padding: 0; border: 0; background: none; color: #2b2b29; font: inherit; font-size: 14.5px; text-decoration: underline;
  text-underline-offset: 3px; cursor: pointer; }
.gr-links button[disabled] { opacity: .6; cursor: default; }
/* Fuera de la ventana del reenvío (hallazgo 4): «¿No te llegó? Escríbenos a …», con la letra de los links. */
.gr-links-txt { color: #4f4f4c; font-size: 14.5px; }
.gr-ok { margin: 16px 0 0; color: #1E6A52; font-size: 14px; }
.gr-error { margin: 14px 0 0; color: #b1412a; font-size: 14px; }
.gr-form { margin: 22px auto 0; max-width: 380px; text-align: left; }
.gr-form label { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; }
.gr-form input { width: 100%; box-sizing: border-box; padding: 12px 13px; border: 1px solid rgba(17,17,17,.2); border-radius: 10px; background: #fff; color: #121212; font: inherit; }
.gr-form input:focus { outline: none; border-color: #121212; box-shadow: 0 0 0 3px rgba(242,176,30,.35); }
.gr-form .gr-btn { width: 100%; min-width: 0; margin-top: 12px; }
.gr-cancelar { display: block; margin: 12px auto 0; padding: 0; border: 0; background: none; color: #2b2b29; font: inherit; font-size: 14px; text-decoration: underline; cursor: pointer; }
.gr-nota { margin: 34px auto 0; max-width: 400px; color: #77776f; font-size: 13px; line-height: 1.5; }
@media (max-width: 480px) {
  .gr h1 { font-size: 34px; }
  .gr-txt { font-size: 16px; }
  .gr-btn { width: 100%; min-width: 0; }
}
@media (prefers-reduced-motion: reduce) { .gr-btn { transition: none; } }
`;
