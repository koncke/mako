# Relevo · Landing Generator (el editor copiado de Gamma)

Chat del 11/10/2026 (cuenta claude3). Escrito por la sesión que hizo el trabajo, al cruzar el 85%
semanal.

## Qué se hizo
- Pedido de Martín: «Replica por completo a Gamma, que se pueda hacer todo lo que ahí se hace» en la
  tab Landing Generator, apoyándose en presenton.
- Commit «Landing Generator: el editor de landings copiado de Gamma 5» (rama `gamma-editor` del
  worktree `../wt-gamma`, rebasada y pusheada a `main`). Diseño y contratos:
  `docs/diseno-editor-landing.md`; lo aprendido y lo pendiente: `docs/hallazgos-editor-landing.md`.
- Mig 0246 aplicada en la base (tablas `landing_docs`, `landing_doc_versiones`,
  `landing_doc_comentarios` y bucket público `landing-imagenes`).
- Typecheck 0, suite completa 7507/0, build verde (sobre el árbol rebasado se corrieron tipos y suite).

## Qué quedó a medias o sin hacer (con su archivo)
1. **Mirarlo con clics.** La verificación en navegador se cortó por el límite de la cuenta al final;
   no dejó datos de prueba (0 landings, 0 archivos en el bucket). Probar en `/landing-generator`
   impersonando ws 3 (o ws 1, borrando lo creado).
2. **Imágenes con IA por Google Flow** — decisión de Martín: parchear la extensión (sacar la foto de
   referencia para imágenes de landing y no exigir haber aprendido el video), midiendo antes en ws 3
   proporción, costo, semilla y refresco de URL vencida. Nada escrito todavía. Detalle y riesgos en
   `docs/hallazgos-editor-landing.md` → «Lo que quedó sin hacer».
3. HTML personalizado con JS en la página publicada (hoy la CSP no lo deja correr): servirlo desde
   su propia URL con `sandbox`.
4. `npx next typegen` en el clon principal (se borró `app/api/landing-writer/route.ts`).
5. El worktree `../wt-gamma` (rama `gamma-editor`) se puede borrar una vez desplegado: antes de
   `git worktree remove`, sacar el junction `node_modules` con `cmd /c rmdir` y los de `.next/node_modules`.

## Qué espera una decisión de Martín
- Nada nuevo: las dos decisiones (imágenes por Flow; parchear la extensión) ya las tomó.

## Tanda 2 (12/10/2026) — en main (`577d0ebb`, deploy Ready)
Panel por documentos, crear con dictado y 22 plantillas (10 landings + 12 presentaciones), presentaciones 16:9, HTML libre con JS aislado (`/l/html`), diagnóstico como recorrido con «Solucionar con IA» y «Replicar», dominio propio (migs 0263 y 0264, aplicadas), y el feedback de Fiesta Music (landing como página continua; la tira de miniaturas). Pendiente: cargar `VERCEL_API_TOKEN`/`VERCEL_TEAM_SLUG` en producción (sin eso «Dominios» dice que no está activado: decide Martín qué token); `/l/html` desde un dominio aparte; redirecciones y `public/` servidos en el dominio del cliente; mirarlo con clics (tira de miniaturas en Chrome de Windows, Presentar, un análisis real); el parche de la extensión para imágenes con Flow sigue sin empezar. Detalle: `docs/hallazgos-editor-landing.md` → «Tanda 2».

## Tanda 3 (12/10/2026, sin agentes) — en main (`73800383`, deploy Ready por API)
Cierre al cruzar el 95% semanal. Hecho: la barra «＋ | ✨ | ▾» de la sección activa ya no queda tapada por la de abajo; las plantillas de landing son 8 DISEÑOS y el copy se elige en el pop-up «¿De qué quieres crearla?» (caja de crear y galería del Panel: `lib/editor-landing/disenos-landing.ts`, `app/landing-generator/crear/DialogoObjetivo.tsx`); agenda (Calendly/Cal.com), VSL y botón de pago entran solos según el objetivo y son la categoría «Herramientas de MaKo» del menú de bloques; sin el conmutador «Edición manual / Edición con IA» (el agente arranca abierto, se pliega, ✨ o Ctrl+E lo reabre) y sin la cabecera doble. ⚠️ El push no creó ningún deploy: se lanzó por `POST /v13/deployments` (receta en `docs/hallazgos-infra.md`).

Después, la sesión de Chatbot sacó la caja de «¿Qué vas a crear hoy?» a `app/landing-generator/CajaPedido.tsx` (+ `Ico.tsx`) para montarla también en Automations (`51a3ad96`): **el diseño de la caja se cambia ahí** y le llega a las dos pantallas.

Pendiente (con su archivo):
1. Mirarlo con clics: la barra en una sección del medio y en la última; el pop-up desde el Panel y desde la caja; el agente plegado y reabierto.
2. El botón de pago no arma el link desde la pasarela de MaKo (`lib/cobros.ts`, `crearCobro`): hoy se pega el link de Stripe o Mercado Pago.
3. Tres tests rojos en main que NO son de esta área (medido 14:57 UTC): `tests/mover-etapa-validacion.test.ts` (CRM), `tests/plan-filtro-cliente.test.ts` y `tests/plan-proyectos-catalogo.test.ts` (Plan / nav.ts).
4. Lo de la tanda 2 sigue igual (token de Vercel en producción, `/l/html` en dominio aparte, parche de la extensión para imágenes con Flow).

## Tanda 4 (13-14/10/2026, cuenta claude2) — en curso

Pedido de Martín (13/10, por el chat «Estrategia 3 cuentas»): «En la cuenta 3 quedaron muchos pendientes que frenamos
porque estabamos llegando al limite semanal, dile a esos chats que continuen y cierren lo que ya habiamos planificado».

**Decisiones de Martín (14/10, no se re-preguntan):**
- El botón de pago de una landing pide **nombre y email** antes del checkout (crearCobro exige un lead; así el pago entra
  al CRM a su nombre).
- «Dominios» usa **el token de Vercel de Mauricio que está en `.env.local`** (`VERCEL_API_TOKEN` + `VERCEL_TEAM_SLUG`).
- El HTML con JavaScript de los clientes sale desde **makodigital.app** («el otro dominio que tengo en pork»; ya está en el
  proyecto de Vercel). Si la landing tiene dominio propio, sale desde ese. Las landings siguen en hola-mako.com/l/<slug>.
  Preguntó: «no entiendo lo del login, porque desde landing generator no deberían poder crear logins» → el bloque «HTML
  personalizado» y «Replicar» permiten pegar o copiar cualquier página; el freno `pideContrasena` se esquiva armando el
  campo por JavaScript.
- Medir las imágenes por Flow en ws3: **«Ahora no, más tarde»** (hay que pasar la extensión de su Chrome de Windows,
  hoy en ws10 Leandro Tejado, al ws3). No empezar sin volver a preguntar.

**Hecho:**
- `npx next typegen` en el clon (13/10 18:51 AR): `.next/types/validator.ts` ya no nombra `app/api/landing-writer/route.ts`.
- `VERCEL_API_TOKEN` y `VERCEL_TEAM_SLUG` cargadas en producción por la API de Vercel (14/10, `target: production`,
  encrypted). Entran con el próximo deploy de producción.

**En curso (worktrees):** botón de pago por la pasarela de MaKo en `wt-gamma` (rama `gamma-editor`); /l/html en
makodigital.app + redirecciones con `has: host` en `C:/dev/wt-landing-dom` (rama `landing-dominio`); verificación con
clics en /landing-generator?ws=3 (producción). Coordinado con «Integraciones» (dueño de lib/cobros.ts: siete reglas para
llamar a crearCobro desde una ruta pública) y avisado por «CRM» (tocó app/api/track/optin/route.ts, sin pushear).
