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

**Cerrado el 14/10 a pedido de Martín («que se pushee todo y que los chats cierren»): NO se escribió código.** Los
agentes no llegaron a arrancar: la guardia de RAM los frenó toda la tanda (entre 1,1 y 2,4 GB libres, con 22 chats abiertos).
`wt-gamma` (rama `gamma-editor`) quedó al día con origin/main y sin cambios; el worktree `C:/dev/wt-landing-dom` se borró.

**Lo que falta, en este orden (todo sin empezar):**
1. **Mirarlo con clics** en `/landing-generator?ws=3` (producción): la barra «＋ | ✨ | ▾» en una sección del medio y en la
   última, el pop-up «¿De qué quieres crearla?» desde el Panel y desde la caja, el agente plegado y reabierto (✨ y Ctrl+E),
   la tira de miniaturas con 6-9 secciones con imágenes (sin «ResizeObserver loop») y Presentar. Detalle de cada uno en la
   Tanda 2 y la Tanda 3 de este archivo.
2. **Botón de pago por la pasarela de MaKo.** Hoy el botón es un nodo `boton` con el link pegado
   (`lib/editor-landing/catalogo-bloques.ts:121`, `disenos-landing.ts:76-110`, `app/landing-generator/editor/insertar.ts`).
   Con lo decidido (nombre y email antes del checkout): una ruta pública bajo `/api/`, con su ruta exacta en
   `lib/rutas-publicas.ts`. Lee la landing PUBLICADA, reusa el lead por `emailComparable` o lo crea por el camino del
   opt-in (`app/api/track/optin`), y llama a `crearCobro` (`lib/cobros.ts`). Las siete reglas de «Integraciones»:
   - sólo `productoId` sale de la landing; monto, moneda, montoUsd y altaCapa nunca salen del request;
   - nunca `altaCapa` desde una landing;
   - `cobroPendienteDelLead` no filtra por producto: comparar antes de reusar;
   - ante LeadDuplicadoError, reusar el lead que ya existe;
   - error genérico al visitante, y el real donde lo lea el dueño;
   - tope por IP y por email;
   - nada de server action ni de POST a `app/l/**`.
3. **/l/html desde makodigital.app** (decidido). El origen va en UN lugar (junto a `lib/app-url.ts` o en
   `lib/editor-landing/html-libre.ts`). En ese host sólo se sirve `/l/html/*`; el resto sigue con la mudanza 410 de
   `proxy.ts` (`respuestaMudanza`). Se tocan el iframe de `especificacion.ts` y la CSP de `pagina-publica.ts`; con dominio
   propio, como hoy. Van también las redirecciones de `next.config.ts` con `has: host` de MaKo y los estáticos en el dominio
   del cliente (Tanda 2 → «Lo que quedó sin hacer»). ⚠️ Con el token de Vercel ya cargado, «Dominios» queda vivo en el
   próximo deploy, y esos dos agujeros pasan a ser reales.
4. **Imágenes por Flow**: medir en ws3 (proporción, costo, semilla, URL vencida) y recién ahí parchear la extensión. Martín
   dijo «ahora no, más tarde»: preguntarle antes de pasar su extensión a ws3. El plan completo está en el scratchpad de la
   sesión f3876a09 (`plan-flow-imagenes.md`) y resumido en `docs/hallazgos-editor-landing.md` → «Lo que quedó sin hacer».
5. **Feedback de las reuniones del 13/10.** Está VALIDADO y es «de punta a punta». Fuente:
   `C:/Users/marti/Downloads/mako-feedback-y-tareas.md`.
   a. El importador por URL («Sales Machine») no extrae bien el texto de páginas externas (Fathom 858927676 @43:13).
   b. Que el análisis de una landing interactúe con lo dinámico (desplegables, botones, calendarios) (858545195 @49:44).
   c. Discutir el feedback del análisis con MaKo en el chat, y un botón «Aplicar cambios» (858545195 @50:27).
   d. En «Replicar en el editor», un selector de formato antes de mandar al editor: presentación, landing o página web
      (858545195 @59:48).
   «De punta a punta» incluye el código, la capacidad en la API de MaKo si es nueva, tests probados rompiéndolos, mirarlo
   en ws3, el pedido literal en la bitácora de /admin/dev, y el relevo y los hallazgos al cerrar.

Coordinación: «Integraciones» es el dueño de `lib/cobros*` (no tocarlo). «CRM» tocó `app/api/track/optin/route.ts`
(guarda `leads.optin_respuestas`, mig 0274) en su worktree.
