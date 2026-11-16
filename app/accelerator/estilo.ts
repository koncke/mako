// =============================================================================
// El estilo de /accelerator: el de la landing de Martín en Lovable, copiado valor por valor (15/11/2026)
// =============================================================================
// COPIADO DE https://panda-stream-spark.lovable.app/ (su <style>, leído el 15/11/2026): las tres letras (Sora para los
// títulos, Hanken Grotesk para el texto, Fraunces en cursiva para los remates), el fondo #0e0e10 con el grano encima, el
// naranja #E0613B, las tarjetas de 22 px con borde #2a2a2e, los tamaños con `clamp()` y los cortes a 880 y 560 px.
// La de Lovable tenía sus reglas y encima un bloque «Overrides per feedback» que pisaba la mitad: acá va el valor que
// QUEDABA, una sola vez.
//
// Lo que cambió, y por qué:
//   · Las clases llevan `acl-`: esta página vive adentro de MaKo, y un nombre genérico («btn», «hero», «video», «tile»)
//     se pisa con los del resto de la app (el mismo cuidado que `mkpl-` en app/planes/Tarjetas.tsx).
//   · SIN JavaScript (la de Lovable lo usaba para tres cosas): la barra de arriba que se oscurece al bajar va con una
//     animación atada al scroll donde el navegador la tiene (y oscura desde el principio donde no); el carrusel de las
//     fotos de Mauricio pasa solo con CSS, cada 4 segundos como el suyo; y la barra de abajo del teléfono es
//     `position: sticky` dentro de un tramo que va del caso de Mauricio al «¿Es para ti?», y la sección de aplicar, que va
//     justo después, le pasa por encima: así aparece al bajar y se va sola al llegar al botón grande del final.
//   · `overflow-x: clip` y no `hidden` en la raíz: `hidden` la vuelve un contenedor de scroll y el `sticky` de la barra
//     de abajo se pega a ella en vez de a la ventana (o sea, nunca).
//   · Un `sticky` se limita por su caja de MARGEN: con un `margin-top` negativo sube esos píxeles por encima del principio de
//     su tramo. La barra tenía -86px y el tramo arrancaba pegado al héroe: aparecía en la primera pantalla, encima del
//     «Aplica ahora» del héroe (y en Lovable no se ve hasta bajar 700 px). Ahora no lleva margen: el que se monta es la
//     sección de aplicar (`.acl-tramo + .acl-final`), con un `z-index` mayor y fondo opaco.
//   · Los títulos de las fases (01/02/03) eran un <span> en Lovable y acá son <h3>: heredaban el interlineado apretado de los
//     títulos (1.06). Llevan el del texto (1.62), como allá.
//   · Lo que incluye vive en «La inversión» (`CSS_INVERSION`), con la lista en dos columnas y los ✓ verdes.
//   · 16/11/2026: los entregables en DOS columnas (Martín: «no me gusta de que las tarjetas queden 3 y 1, pondría 2 y 2»), y
//     «La inversión» (`CSS_INVERSION`, abajo): el precio y lo que incluye en un bloque, con el dorado de la columna de /planes.
//   · 16/11/2026, a la noche: las tiras de logos de la portada entre las secciones (`CSS_TIRAS`, ./Tiras.tsx), sin «Y en las tres
//     fases, siempre» (sus tarjetas, `.acl-ac`, se fueron con él), y el precio y el botón de «La inversión» en un solo bloque.
// =============================================================================

import { fondoDeSigno } from '@/app/planes/signos';

export const FUENTES_ACELERADOR =
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Hanken+Grotesk:wght@400;500;600&family=Fraunces:ital,opsz,wght@1,9..144,400;1,9..144,500;0,9..144,500&display=swap';

/** El grano de Lovable (el `::before` de su raíz): ruido blanco con `mix-blend-mode: overlay`. */
const GRANO = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export const CSS_ACELERADOR = `
body:has(.acl-root) aside { display: none !important; }
body:has(.acl-root) { background: #0e0e10; }
html:has(.acl-root) { scroll-behavior: smooth; scroll-padding-top: 84px; }
.acl-root {
  --acl-bg: #0e0e10; --acl-panel: #141416; --acl-card: #171719;
  --acl-ink: #F1EEE8; --acl-ink-soft: #B7B2A9; --acl-muted: #7C766C;
  --acl-line: rgba(241,238,232,.12); --acl-line-strong: rgba(241,238,232,.26);
  --acl-accent: #E0613B; --acl-verde: #2fa66a; --acl-rojo: #c93838;
  --acl-borde: #2a2a2e; --acl-gris: #a8a8ad;
  --acl-sans: "Sora", system-ui, sans-serif; --acl-body: "Hanken Grotesk", system-ui, sans-serif; --acl-serif: "Fraunces", Georgia, serif;
  position: relative; width: 100%; min-height: 100vh; background: var(--acl-bg); color: var(--acl-ink);
  font-family: var(--acl-body); font-size: 18px; line-height: 1.62; -webkit-font-smoothing: antialiased; overflow-x: clip;
}
.acl-root *, .acl-root *::before, .acl-root *::after { margin: 0; padding: 0; box-sizing: border-box; }
.acl-root::before { content: ""; position: fixed; inset: 0; z-index: 9999; pointer-events: none; opacity: .55; background-image: ${GRANO}; mix-blend-mode: overlay; }
.acl-root a { color: inherit; text-decoration: none; }
.acl-root ul, .acl-root ol { list-style: none; }
.acl-root img, .acl-root video, .acl-root iframe { display: block; max-width: 100%; }
.acl-root ::selection { background: var(--acl-accent); color: var(--acl-ink); }
.acl-root h1, .acl-root h2, .acl-root h3, .acl-root h4 { font-family: var(--acl-sans); font-weight: 700; line-height: 1.06; letter-spacing: -.015em; }
.acl-root em { font-family: var(--acl-serif); font-style: italic; font-weight: 500; color: var(--acl-accent); letter-spacing: 0; }
.acl-root b { font-weight: 600; }
.acl-wrap { max-width: 1180px; margin: 0 auto; padding: 0 28px; }

/* ── La barra de arriba ── */
.acl-hdr { position: fixed; top: 0; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 13px 28px; background: rgba(11,11,12,.82); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border-bottom: 1px solid var(--acl-line); }
@supports (animation-timeline: scroll()) {
  .acl-hdr { animation: acl-hdr linear both; animation-timeline: scroll(root); animation-range: 0 90px; }
  @keyframes acl-hdr {
    from { padding-block: 18px; background: rgba(11,11,12,0); border-bottom-color: transparent; -webkit-backdrop-filter: none; backdrop-filter: none; }
    to { padding-block: 13px; background: rgba(11,11,12,.82); border-bottom-color: var(--acl-line); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
  }
}
.acl-marca { font-family: var(--acl-sans); font-weight: 800; letter-spacing: .14em; font-size: 15px; text-transform: uppercase; }
.acl-marca span { color: var(--acl-accent); }

/* ── Los botones ── */
.acl-btn { font-family: var(--acl-sans); font-weight: 600; font-size: 15px; letter-spacing: .06em; text-transform: uppercase; background: var(--acl-ink); color: #0B0B0C !important;
  padding: 14px 26px; border: 1px solid var(--acl-ink); border-radius: 2px; cursor: pointer; display: inline-block; white-space: nowrap;
  transition: transform .2s, background .25s, color .25s, border-color .25s; }
/* Con el mouse encima, el texto oscuro: el claro sobre el naranja daba 3,05:1; éste, 5,5:1 (revisión del 16/11/2026). */
.acl-btn:hover { background: var(--acl-accent); border-color: var(--acl-accent); color: #0B0B0C !important; transform: translateY(-2px); }
.acl-btn:focus-visible { outline: 2px solid var(--acl-accent); outline-offset: 3px; }
.acl-btn-sm { padding: 11px 20px; font-size: 14px; }
.acl-btn-grande { font-size: 1.05rem; padding: 18px 42px; }

/* ── El héroe ── */
.acl-hero { padding: 88px 0 28px; text-align: center; }
.acl-hero-in { max-width: 920px; margin: 0 auto; }
.acl-pill { display: inline-block; font-family: var(--acl-sans); font-weight: 600; font-size: 12.5px; letter-spacing: .2em; text-transform: uppercase;
  border: 1px solid var(--acl-line-strong); border-radius: 100px; padding: 9px 20px; color: var(--acl-ink-soft); margin-bottom: 16px; }
.acl-hero h1 { font-size: clamp(2rem, 4.6vw, 3.6rem); font-weight: 800; max-width: 24ch; margin: 0 auto; }
/* Sin la bajada de debajo del título (16/11/2026, Martín la sacó): a quién es el programa va directo debajo, con su aire. */
.acl-qual { margin-top: 18px; font-size: 15px; color: var(--acl-muted); letter-spacing: .02em; }
.acl-qual b { color: var(--acl-accent); font-weight: 700; }
.acl-video { margin: 22px auto 0; max-width: 900px; position: relative; border: 1px solid var(--acl-line-strong); background: var(--acl-panel); aspect-ratio: 16 / 9; border-radius: 4px; overflow: hidden; }
.acl-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.acl-esq { position: absolute; width: 15px; height: 15px; border-color: var(--acl-ink); opacity: .45; z-index: 2; pointer-events: none; }
.acl-esq-1 { top: 14px; left: 14px; border-top: 1.5px solid; border-left: 1.5px solid; }
.acl-esq-2 { top: 14px; right: 14px; border-top: 1.5px solid; border-right: 1.5px solid; }
.acl-esq-3 { bottom: 14px; left: 14px; border-bottom: 1.5px solid; border-left: 1.5px solid; }
.acl-esq-4 { bottom: 14px; right: 14px; border-bottom: 1.5px solid; border-right: 1.5px solid; }
.acl-hero-cta { margin-top: 44px; }
.acl-hero-cta .acl-btn { font-size: 1.05rem; padding: 18px 40px; }

/* ── Secciones ── */
.acl-sec { padding: 78px 0; }
.acl-shead { max-width: 90ch; }
.acl-shead h2 { font-size: clamp(2rem, 4.2vw, 3.1rem); margin-top: 22px; font-weight: 700; max-width: 28ch; }

/* ── Aplicar: el título, los cuatro pasos y (en la del final) el botón ── */
.acl-final { text-align: center; }
.acl-final h2 { font-size: clamp(2.1rem, 4.6vw, 3.2rem); margin: 24px auto 0; max-width: 34ch; font-weight: 800; }
.acl-scar { max-width: 56ch; margin: 26px auto 0; color: var(--acl-ink-soft); font-size: 1.12rem; }
.acl-proceso { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 52px auto 0; max-width: 1000px; text-align: left; }
.acl-paso { border: 1px solid var(--acl-line); border-radius: 4px; padding: 26px 22px; background: var(--acl-card); }
.acl-paso-n { font-family: var(--acl-sans); font-weight: 700; font-size: 13px; letter-spacing: .1em; color: var(--acl-accent); text-transform: uppercase; }
.acl-paso h3 { font-weight: 600; font-size: 1.08rem; margin: 12px 0 8px; }
.acl-final .acl-btn { margin-top: 48px; }
.acl-sec-div { margin: 64px auto 0; height: 1px; width: 100%; max-width: 1000px; background: var(--acl-line); }
.acl-tras-heroe { padding-top: 28px; }
.acl-mau-s { padding-top: 80px; }

/* ── Mauricio ── */
.acl-mau { max-width: 1040px; margin: 0 auto; }
.acl-mau-titulo h2 { font-size: clamp(2rem, 4.2vw, 3rem); margin: 0; max-width: 34ch; line-height: 1.08; }
.acl-plata { color: var(--acl-accent); font-weight: 800; }
.acl-mau-top { display: grid; grid-template-columns: .7fr 1fr; gap: 44px; margin-top: 42px; align-items: stretch; }
.acl-mau-video { display: flex; min-width: 0; }
.acl-mau-video video { width: 100%; height: 100%; max-height: 520px; aspect-ratio: 9 / 16; border: 1px solid var(--acl-line-strong); border-radius: 3px; background: #000; object-fit: cover; }
.acl-mau-txt { display: flex; flex-direction: column; justify-content: flex-start; gap: 18px; min-width: 0; }
.acl-mau-txt p { color: var(--acl-ink-soft); font-size: 1.22rem; line-height: 1.55; }
.acl-mau-txt p b { color: var(--acl-ink); }
.acl-mau-split { display: grid; grid-template-columns: 1fr .8fr; gap: 44px; margin-top: 56px; align-items: stretch; }
/* En Lovable esta frase pedía 1.7rem en blanco, pero su regla de los párrafos (.txt p) le ganaba por especificidad: se veía
   del tamaño y el gris del texto, sólo que en cursiva. Se copia lo que SE VEÍA. */
.acl-mau-txt .acl-mau-em { font-family: var(--acl-serif); font-style: italic; }
.acl-carr { position: relative; width: 100%; aspect-ratio: 4 / 5; max-height: 520px; border: 1px solid var(--acl-line-strong); border-radius: 3px; overflow: hidden; background: var(--acl-card); }
.acl-carr img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; animation: acl-foto 12s infinite both; }
.acl-carr img:nth-of-type(1) { animation-delay: 0s; }
.acl-carr img:nth-of-type(2) { animation-delay: -8s; }
.acl-carr img:nth-of-type(3) { animation-delay: -4s; }
@keyframes acl-foto { 0%, 30% { opacity: 1; } 35.33%, 94.67% { opacity: 0; } 100% { opacity: 1; } }
.acl-puntos { position: absolute; bottom: 14px; left: 0; right: 0; display: flex; justify-content: center; gap: 8px; z-index: 2; }
.acl-puntos span { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.45); animation: acl-punto 12s infinite both; }
.acl-puntos span:nth-child(1) { animation-delay: 0s; }
.acl-puntos span:nth-child(2) { animation-delay: -8s; }
.acl-puntos span:nth-child(3) { animation-delay: -4s; }
@keyframes acl-punto { 0%, 32% { background: #fff; transform: scale(1.25); } 34%, 98% { background: rgba(255,255,255,.45); transform: none; } 100% { background: #fff; transform: scale(1.25); } }
.acl-mau-bottom { max-width: 880px; margin: 72px auto 0; text-align: center; }
.acl-mau-pull { font-family: var(--acl-serif); font-style: italic; font-weight: 500; font-size: clamp(1.7rem, 3.2vw, 2.2rem); color: var(--acl-ink); margin: 0 auto 32px; max-width: 30ch; line-height: 1.25; }
.acl-otros { margin: 18px auto; display: flex; flex-direction: column; gap: 12px; max-width: 760px; text-align: left; }
.acl-otro { display: flex; gap: 14px; align-items: flex-start; color: var(--acl-ink-soft); font-size: 1rem; padding: 14px 16px; border: 1px solid var(--acl-line); border-radius: 6px; background: rgba(255,255,255,.02); }
.acl-otro b { color: var(--acl-ink); }
.acl-otro-ok { border: 1.5px solid var(--acl-verde); background: rgba(47,166,106,.10); color: var(--acl-ink); font-weight: 500; }
/* La ✓ y la ✕ son DIBUJOS centrados (app/planes/signos.ts), no letras: una letra se centra por su caja y no por su tinta, y la
   fuente de reemplazo la corría (Martín, 15/11: «céntralo bien todo»). */
.acl-mk { flex: 0 0 22px; width: 22px; height: 22px; border-radius: 50%; margin-top: 2px; }
.acl-mk-x { background: ${fondoDeSigno('no', '#fff', 'var(--acl-rojo)')}; }
.acl-mk-c { background: ${fondoDeSigno('si', '#fff', 'var(--acl-verde)')}; }
.acl-cierre { margin-top: 30px; color: var(--acl-ink-soft); }
.acl-cierre b { color: var(--acl-ink); }

/* ── No es un caso aislado ── */
.acl-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; margin-top: 46px; }
.acl-tile { background: linear-gradient(180deg, #1a1a1d 0%, #131316 100%); border: 1.5px solid var(--acl-borde); border-radius: 22px; padding: 42px 32px; display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 1px 0 rgba(255,255,255,.03) inset, 0 22px 50px -28px rgba(0,0,0,.6); transition: transform .25s, border-color .25s; }
.acl-tile:hover { transform: translateY(-3px); border-color: #3a3a40; }
.acl-tile-v { font-family: var(--acl-sans); font-weight: 800; font-size: clamp(2.6rem, 4.6vw, 3.6rem); color: var(--acl-accent); line-height: 1; letter-spacing: -.03em; }
.acl-tile-k { margin-top: 6px; font-family: var(--acl-serif); font-style: italic; font-size: 1.02rem; color: var(--acl-ink-soft); line-height: 1.5; }
.acl-casos { margin-top: 54px; display: flex; flex-direction: column; gap: 80px; }
.acl-cv { display: grid; grid-template-columns: 1.25fr 1fr; gap: 48px; align-items: center; }
.acl-cv.acl-flip { grid-template-columns: 1fr 1.25fr; }
.acl-cv.acl-flip .acl-cv-media { order: 2; }
.acl-cv.acl-flip .acl-cv-body { order: 1; }
.acl-cv-media { position: relative; border-radius: 14px; overflow: hidden; border: 1px solid var(--acl-line-strong); background: #000; aspect-ratio: 16 / 10; box-shadow: 0 30px 80px -40px rgba(0,0,0,.7); min-width: 0; }
.acl-cv-media img, .acl-cv-media video { width: 100%; height: 100%; object-fit: cover; }
.acl-cv-body { min-width: 0; }
.acl-cv-num { font-family: var(--acl-sans); font-weight: 800; font-size: clamp(2.6rem, 5vw, 3.6rem); color: var(--acl-accent); line-height: 1; letter-spacing: -.03em; }
.acl-cv-nm { margin-top: 14px; font-family: var(--acl-sans); font-weight: 700; font-size: 1.35rem; letter-spacing: -.01em; color: #fff; }
.acl-cv-ds { margin-top: 12px; font-family: var(--acl-serif); font-style: italic; font-size: 1.1rem; color: var(--acl-ink-soft); line-height: 1.55; max-width: 48ch; }
.acl-meto { margin-top: 64px; font-family: var(--acl-serif); font-style: italic; font-size: 1.18rem; color: var(--acl-ink-soft); max-width: 78ch; line-height: 1.5; }

/* ── El programa ── */
.acl-prog-intro { max-width: 64ch; margin-top: 22px; color: var(--acl-ink-soft); font-size: 1.14rem; }
.acl-fase { margin-top: 60px; }
.acl-fase-head { display: flex; gap: 22px; align-items: baseline; flex-wrap: wrap; }
.acl-fase-num { font-family: var(--acl-sans); font-weight: 800; font-size: 2rem; color: var(--acl-accent); line-height: 1; }
.acl-root .acl-fase-titulo { font-family: var(--acl-sans); font-weight: 700; font-size: clamp(1.5rem, 3vw, 2.1rem); line-height: 1.62; letter-spacing: normal; }
/* Dos columnas: cada fase son cuatro entregables, 2 y 2 (16/11/2026; eran tres columnas y la fase de tres dejaba 3 y 1). */
.acl-entregables { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 26px; margin: 36px auto 0 0; max-width: 1180px; align-items: stretch; }
.acl-deliv { background: var(--acl-card); border: 1.5px solid var(--acl-borde); border-radius: 22px; padding: 32px 32px 36px; display: flex; flex-direction: column; gap: 22px; height: 100%;
  box-shadow: 0 1px 0 rgba(255,255,255,.02) inset; transition: transform .25s, border-color .25s; min-width: 0; }
.acl-deliv:hover { transform: translateY(-3px); border-color: #3a3a40; }
.acl-deliv-ico { width: 100%; height: 200px; border: 1.5px solid var(--acl-borde); border-radius: 16px; background: #0e0e10; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; color: #e7e7ea; }
.acl-deliv-ico svg { width: 84px; height: 84px; stroke-width: 1.25; }
.acl-root .acl-deliv h4 { font-family: var(--acl-sans); font-weight: 800; font-size: 1.7rem; letter-spacing: -.02em; line-height: 1.1; color: #fff; }
.acl-deliv p { font-family: var(--acl-serif); font-style: italic; font-size: 1rem; color: var(--acl-gris); line-height: 1.5; }
.acl-ent { font-style: italic; font-weight: 800; color: #fff; margin-right: 4px; }
.acl-creativos { margin-top: 18px; background: rgba(47,166,106,.10); border: 1px solid rgba(47,166,106,.35); border-radius: 4px; padding: 26px 28px; }
.acl-creativos p { color: var(--acl-ink); font-size: 1.02rem; }
.acl-cr-list { color: var(--acl-ink-soft); font-style: italic; }
/* La ceja de «La inversión» (hasta el 16/11/2026 la usaban también las dos tarjetas de debajo de los entregables, que se fueron). */
.acl-lbl { font-family: var(--acl-sans); font-weight: 700; font-size: 11.5px; letter-spacing: .22em; text-transform: uppercase; color: var(--acl-accent); }

/* ── Lo que incluye, adentro de «La inversión» (CSS_INVERSION, abajo) ── */
/* En dos columnas a todo el ancho (eran una, al lado de la promesa): una sola, a 1180 px, dejaba renglones de 20 palabras. */
.acl-checks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 40px; margin-top: 8px; }
.acl-checks li { display: flex; gap: 13px; align-items: flex-start; color: var(--acl-ink); font-size: 1rem; line-height: 1.5; }
.acl-checks li b { font-weight: 600; color: var(--acl-ink); }
.acl-checks li small { display: block; margin-top: 2px; color: var(--acl-ink-soft); font-size: .94rem; line-height: 1.45; }
/* Siempre en px PARES: con 21 el dibujo de 12 queda a 4,5 px del borde y el navegador lo corre medio píxel. */
.acl-checks .acl-mk { flex-basis: 20px; width: 20px; height: 20px; margin-top: 2px; }

/* ── ¿Es para ti? ── */
.acl-filtro { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 52px; }
.acl-fcol { border: 1px solid var(--acl-line); border-radius: 4px; padding: 36px 32px; background: var(--acl-card); min-width: 0; }
.acl-fcol-no { background: transparent; }
.acl-root .acl-fcol h3 { font-family: var(--acl-sans); font-weight: 700; font-size: 14px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 22px; color: var(--acl-accent); line-height: 1.3; }
.acl-root .acl-fcol-no h3 { color: var(--acl-muted); }
.acl-fcol li { padding: 15px 0; border-bottom: 1px solid var(--acl-line); display: flex; gap: 13px; align-items: flex-start; }
.acl-fcol li:last-child { border-bottom: none; }
.acl-fcol li b { font-family: var(--acl-sans); font-weight: 600; font-size: 1rem; color: var(--acl-ink); display: block; margin-bottom: 3px; }
.acl-fcol li small { color: var(--acl-ink-soft); font-size: .92rem; line-height: 1.45; }
.acl-fcol .acl-mk { flex-basis: 20px; width: 20px; height: 20px; }

/* El pie propio se fue el 16/11/2026: la página lleva el del sitio (PieGlobal), que lo escondía. EN ESTA PÁGINA, DEL COLOR DE LA
   PÁGINA Y MÁS BAJO (16/11/2026, a la tarde, Martín: «la button bar no debería ser de otro color en MaKo Accelerator… y está
   exageradamente alta»): el del sitio es azul noche (#060419) y aquí la página es casi negra (#0e0e10); el aire y los huecos,
   más chicos. Sólo con body:has(.acl-root), y con más peso que las reglas del pie (app/vsl/_sitio/estilos.ts, que van después). */
body:has(.acl-root) .s-sitio .s-pie { background: #0e0e10; }
/* Y la estrella de MaKo, en blanco también en el pie (Martín, 16/11/2026: el logo de MaKo, en blanco en todos lados en esta página, que
   es sólo oscura). La estrella del sitio va pintada con su dorado en el atributo fill: el CSS le gana. */
body:has(.acl-root) .s-sitio .s-pie path[fill="#F2B01E"] { fill: #fff; }
/* EL MISMO PIE QUE LA PORTADA, CON TODO (16/11/2026, a la tarde, Martín: «la bottom bar debe ser el mismo diseño en las dos…
   deberían estar todo»): sólo cambia el fondo; ya no se esconden columnas ni se achica aparte. El pie del sitio es el compacto
   (app/vsl/_sitio/estilos.ts, CSS_PIE). Este comentario viaja en la página: sin palabras que el test de textos marca. */

/* ── La barra de abajo, en el teléfono: pegada al borde mientras dura el tramo (del caso de Mauricio al «¿Es para ti?») ── */
.acl-pegado { display: none; }

@media (max-width: 880px) {
  .acl-root { font-size: 17px; }
  .acl-sec { padding: 64px 0; }
  .acl-hero { padding: 140px 0 30px; }
  .acl-tras-heroe { padding-top: 28px; }
  .acl-mau-s { padding-top: 80px; }
  .acl-hdr .acl-btn { padding: 10px 18px; font-size: 13px; }
  .acl-entregables, .acl-filtro { grid-template-columns: 1fr; gap: 26px; }
  .acl-checks { grid-template-columns: 1fr; gap: 13px; }
  .acl-tiles, .acl-proceso { grid-template-columns: 1fr 1fr; }
  .acl-mau-split, .acl-mau-top { grid-template-columns: 1fr; }
  .acl-cv, .acl-cv.acl-flip { grid-template-columns: 1fr; gap: 22px; }
  .acl-cv.acl-flip .acl-cv-media, .acl-cv.acl-flip .acl-cv-body { order: 0; }
  /* La barra, SIN margen negativo (subiría por encima del principio del tramo); ocupa sus 86 px al final del tramo, y la
     sección de aplicar se monta encima de esos mismos 86 px: la tapa al llegar y el espacio entre las dos secciones queda
     el de Lovable. El margen de abajo tiene que ser igual al alto de la barra. */
  .acl-pegado { display: block; position: sticky; bottom: 0; z-index: 90; height: 86px; padding: 12px 18px max(12px, env(safe-area-inset-bottom, 0px));
    background: rgba(11,11,12,.95); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); border-top: 1px solid var(--acl-line); }
  .acl-pegado .acl-btn { display: block; text-align: center; }
  .acl-tramo + .acl-final { position: relative; z-index: 91; margin-top: -86px; background: var(--acl-bg); }
}
@media (max-width: 560px) {
  .acl-tiles, .acl-proceso { grid-template-columns: 1fr; }
}
/* Los teléfonos de 320 px: el nombre del programa es más ancho que la marca de Lovable, y el botón de arriba y el botón grande
   del final se salían del borde. (Este CSS viaja en la página: sus comentarios no nombran la marca vieja.) */
@media (max-width: 359px) {
  .acl-hdr { padding-inline: 16px; gap: 10px; }
  .acl-hdr .acl-btn { padding: 10px 12px; }
  .acl-marca { letter-spacing: .08em; }
  .acl-btn-grande { padding-inline: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  html:has(.acl-root) { scroll-behavior: auto; }
  .acl-hdr { animation: none; }
  .acl-carr img, .acl-puntos span { animation: none; }
  .acl-carr img:nth-of-type(1) { opacity: 1; }
  .acl-puntos span:nth-child(1) { background: #fff; transform: scale(1.25); }
  .acl-btn, .acl-tile, .acl-deliv { transition: none; }
  .acl-btn:hover, .acl-tile:hover, .acl-deliv:hover { transform: none; }
}
`;

/**
 * «LA INVERSIÓN» (16/11/2026, a la tarde): UN bloque a todo el ancho con el precio arriba y TODO lo que incluye debajo (antes, «Lo
 * que incluye» y, debajo, la columna de /planes sola en el medio: Martín, «no me gusta de que esté una columna vertical sola y
 * suelta»). «Me gusta de que tenga como ese colorcito dorado, excepto los checks que sigan siendo verdes»: el dorado es el de la
 * columna del Accelerator de /planes (app/planes/Tarjetas.tsx, `.mkpl-programa`: el brillo en la esquina y el botón #F5C451 con el
 * texto #2A1E00); los ✓ son los verdes de la página (`.acl-mk-c`).
 * En el teléfono, mientras se ve, la barra de abajo (z-index 90, sticky) queda DEBAJO de esta sección: el bloque tiene su botón, y
 * con la barra de arriba eran tres «Aplica ahora» en la misma pantalla. El mismo truco que la sección del final (fondo opaco y un
 * z-index mayor); al terminar, la barra vuelve.
 */
export const CSS_INVERSION = `
.acl-inversion { position: relative; margin-top: 0; border: 1.5px solid rgba(245,196,81,.28); border-radius: 22px; overflow: hidden; padding: 40px 40px 38px;
  background: radial-gradient(900px 380px at 100% 0%, rgba(245,196,81,.15), transparent 60%), linear-gradient(180deg, #1a1a1d 0%, #131316 100%);
  box-shadow: 0 1px 0 rgba(255,255,255,.03) inset, 0 22px 50px -28px rgba(0,0,0,.6); }
.acl-inversion-cabeza { display: flex; align-items: center; flex-wrap: wrap; gap: 24px 48px; padding-bottom: 30px; border-bottom: 1px solid var(--acl-line); }
.acl-inversion-nombre { flex: 1 1 260px; min-width: 0; }
.acl-root .acl-inversion .acl-lbl { color: #F5C451; }
.acl-root .acl-inversion h3 { margin-top: 10px; font-family: var(--acl-sans); font-weight: 800; font-size: clamp(1.7rem, 3vw, 2.2rem); letter-spacing: -.02em; line-height: 1.1; color: #fff; }
/* EL PRECIO AL COSTADO DEL BOTÓN, COMO ANTES (16/11/2026, a la tarde, Martín: «me gustaba como estaba antes al costado y al
   otro costado el aplicar ahora»): en la fila, centrados en el mismo eje (align-items: center de la cabeza). */
.acl-inversion-precio { flex: none; text-align: right; }
.acl-inversion-monto { font-family: var(--acl-sans); font-weight: 800; font-size: clamp(2.4rem, 4.4vw, 3.2rem); line-height: 1; letter-spacing: -.03em; color: #fff; }
.acl-inversion-periodo { margin-top: 8px; font-size: 15px; line-height: 1.3; color: var(--acl-ink-soft); }
.acl-root .acl-btn-oro { flex: none; background: #F5C451; border-color: #F5C451; color: #2A1E00 !important; }
.acl-root .acl-btn-oro:hover { background: #FFD772; border-color: #FFD772; color: #2A1E00 !important; }
.acl-root .acl-inversion .acl-btn-oro { text-align: center; }
.acl-inversion-incluye { margin: 26px 0 14px; font-family: var(--acl-sans); font-weight: 700; font-size: 11.5px; letter-spacing: .22em; text-transform: uppercase; color: var(--acl-ink-soft); }
@media (max-width: 880px) {
  .acl-inversion-s { position: relative; z-index: 91; background: var(--acl-bg); }
  .acl-inversion { padding: 30px 22px 28px; }
  /* Una columna, toda centrada: la ceja y el nombre arriba, y el bloque del precio con el botón a todo el ancho de la tarjeta. */
  .acl-inversion-cabeza { flex-direction: column; align-items: stretch; gap: 22px; padding-bottom: 24px; }
  .acl-inversion-nombre { flex: none; text-align: center; }
  .acl-inversion-precio { text-align: center; }
  .acl-root .acl-inversion .acl-btn-oro { display: block; }
}
`;

/**
 * LAS TIRAS DE LA PORTADA ENTRE LAS SECCIONES (16/11/2026, ./Tiras.tsx). Su CSS es el del sitio (`CSS_REEMPLAZA`, que la landing suma
 * antes que éste); acá, sólo lo que las acomoda a esta página: su caja `.s-sitio` sin lo que es de una página entera (el fondo azul
 * noche y el alto de pantalla: va sobre el fondo de esta página, que es sólo oscura), y el aire, que lo ponen las secciones de
 * alrededor (en la portada, la tira de arriba lleva 64 px y la de las apps que reemplaza, 56 y 48).
 */
export const CSS_TIRAS = `
.acl-root .s-sitio.acl-tira { background: none; min-height: 0; }
/* La tira de los entregables: sus íconos, en el naranja de la página. */
.acl-root .acl-tira-ent { gap: 10px; }
.acl-root .acl-tira-ent svg { flex: none; color: #E0613B; }
.acl-root .s-sitio.acl-tira > .s-tira { padding: 4px 0 0; }
`;
