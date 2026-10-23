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
.planes-form input[type=text], .planes-form input[type=email] { width: 100%; box-sizing: border-box; font: inherit; padding: 11px 12px;
  border: 1px solid #D5D9E0; border-radius: 10px; background: #fff; color: #12151B; }
.planes-form .planes-btn { width: 100%; margin-top: 22px; }
.planes-opcion { display: flex; gap: 10px; align-items: center; border: 1px solid #D5D9E0; border-radius: 10px; padding: 10px 12px; margin-top: 8px; cursor: pointer; }
.planes-opcion input { margin: 0; }
.planes-error { margin-top: 14px; color: #B42318; font-size: 14px; }
.planes-nota { margin-top: 14px; color: #5B6472; font-size: 13px; text-align: center; }
.planes-trampa { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
.planes-volver { display: inline-block; margin-bottom: 16px; color: #2F6FED; font-size: 14px; text-decoration: none; }
`;
