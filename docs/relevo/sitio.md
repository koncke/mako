# Relevo del chat del Sitio (18/11/2026, cuenta claude2 al 96 %)

Carpeta: `C:/dev/wt-sitio-1611`, rama `sitio-1611`, punta `punta/sitio-1611` (la última, `f1f1b43e8`, VERDE en GitHub).
Las órdenes llegan del Cerebro (`local_3c82c204…`). Se commitea por ruta explícita con el trailer `Claude-Cuenta`, y antes de subir
va `git pull --rebase origin main`. Si el rebase reescribe commits ya subidos, va `--force-with-lease` y sólo sobre MI punta.

## Hecho, en la punta con verde (lo despliega el Cerebro)
- **MaKo Partners** (`app/mako-partners/`):
  - el partner cobra SIEMPRE el 30 % (`numeros.ts`, de `COMISION_PARTNER_DIRECTO`);
  - la calculadora tiene dos botones: «MaKo: US$ 97» / «MaKo: US$ 47»;
  - «Así de simple»: el paso 2 es una persona con «+», y el paso 3 dice «En dólares por Binance o en pesos» (así COBRA el
    partner);
  - el carrusel de 20 rubros (`RUBROS` en `LandingPartners.tsx`, íconos de lucide-react) va debajo de «Así de simple» y otra vez
    antes de las preguntas;
  - «¿Por qué ser partner de MaKo te conviene?» es un carrusel de una tarjeta grande (`Carrusel.tsx`), con los seis textos en
    `beneficios.ts`;
  - la tabla «MaKo vs. GoHighLevel» tiene 9 filas de ✓ / ✕ (`comparacion.ts`, cada ✕ con su fuente oficial en el código).
- **Sistema simple de pago (Martín, 18/11):**
  - los negocios pagan con Mercado Pago o pasarela;
  - ni la tabla ni la tarjeta «Hecha para Latinoamérica» dicen que se paga con Binance o por transferencia;
  - el test falla si vuelve.
- **Barra del sitio** (`app/vsl/_sitio/estilos.ts`, `CSS_BARRA`): el menú tiene «intención» (0,15 s). Cruzar «Producto» en
  diagonal ya no cambia el menú abierto; antes, el clic a «MaKo Partners» caía en «MaKo Agency». Test:
  `tests/barra-menu-intencion.test.ts`.
- **Antes, también verdes:**
  - la portada sin «Ver planes» y con el VSL antes del botón en el teléfono;
  - las páginas de detalle (FeatureDetail) sin desborde a 375, con la barra del sitio;
  - la barra en /app.
- **Cosecha:** `docs/hallazgos-landing.md`, con sus líneas en el índice `docs/hallazgos.md`. Ahí está la comparación contra
  GoHighLevel (las filas «obvias» eran falsas) y lo de «MaKo Partners no lleva a ningún lado» (no era el link, era el menú).

## El artefacto «MaKo» (uno solo, compartido entre chats)
- Link: https://claude.ai/artifact/KGn9GUek4GRqKm6M1Q345M (versión 86 al cerrar). Anclas: #portada, #precios, #partners,
  #checkout, #onboarding…
- **Fuentes:** `C:/dev/artefactos-mako`. Se arma con `node armar.mjs [pieza]` y sale a `publicar/`. Se publica copiando la
  página a `<scratchpad>/publicar/mako/`, con `index.html` como `file_path` y la página en `files`. Las notas están en `LEEME.md`.
- **Lo mío:** las páginas del sitio (portada, planes, acelerador, aplicar, closing, equipo, crm, login, partners) y el visor
  (`fuentes/comun/visor.html` → `index.html`).
- **Lo de otros chats:** NO se publica `onboarding.html` (es del chat del onboarding), ni `app-*.html` ni `pestanas/` (del chat de
  las pestañas).
- **El visor** (versión 86) muestra «← Volver al sitio» cuando el marco cae en una página que no es del sitio. `ir()` compara con
  lo que el marco muestra de verdad.
- **Al publicar:** si rechaza por «a newer version», se relee y se vuelve a publicar sin cambios cuando el `index.html` en vivo es
  igual al mío (pasó varias veces).

## A medias / ojo
- **`checkout.html`:**
  - la maqueta con transferencia y Binance, para que Martín decida, quedó en el artefacto (#checkout; la fuente es
    `C:/dev/artefactos-mako/fuentes/checkout/dibujar-checkout.tsx`);
  - el Cerebro la pasó al chat del onboarding (`local_a9a5a9e9`), que publicó su versión 81;
  - su «←» va a `/planes`, que en el artefacto lleva a una página vacía: no pasó por `armar.mjs` ni tiene `enlaces.js`;
  - Martín volvió al sistema simple: la maqueta ya no aplica tal cual.
- **Páginas de otros chats** (`app-*.html`): tienen links `/crm`, `/chats`… sin cambiar. El visor ahora deja volver, pero
  conviene que esos chats armen sus links a `<pieza>.html`.

## Espera de Martín
- **El checkout con transferencia y Binance:** si lo retoma, falta el número de WhatsApp y el email que reciben los
  comprobantes.
- **«Todo incluido en el mismo precio, sin extras»** (fila 4 de la tabla): es verdad para GoHighLevel. Del lado de MaKo, si se
  pueden comprar MaKo Tokens extra, habría que matizarla.
- **Los botones de plan de la calculadora:** el elegido va blanco sobre el azul (un relleno azul se perdía en el fondo). Si los
  quiere azules, es un cambio de dos líneas en `LandingPartners.tsx` (`.mp-calc-alt.elegido`).
