# Cómo se integra una tab «Video Editor» (copia de CapCut sobre el motor de OpenCut) en MaKo

Relevamiento SOLO LECTURA del 11/10/2026 sobre `C:/dev/wt-video-editor` (rama `video-editor`,
HEAD `98efa6d5`, Next 16.2.6, React 19.2.4, Tailwind 4) y sobre el clon de OpenCut classic
(`scratchpad/ext/classic/apps/web`, Next 16.1.3). Todas las rutas son relativas al repo de MaKo
salvo que diga lo contrario. Las líneas de AGENTS.md salen de `grep -n '^#' AGENTS.md` (7562 líneas).

---

## 0. Lo que cambia el plan (leer primero)

1. **El árbol NO está limpio.** `git status` (11/10, durante el relevamiento): `M package.json`,
   `M package-lock.json`, `?? app/video-editor/` con **597 archivos** en `app/video-editor/_opencut/`
   más `app/video-editor/page.tsx` y `app/video-editor/[proyecto]/page.tsx` (aparecieron mientras
   leía). Otro agente ya está portando. `package.json` suma 26 dependencias (hugeicons, lucide-react,
   react-icons, radix-ui, zustand, mediabunny, opencut-wasm, @huggingface/transformers, motion,
   sonner, react-resizable-panels…). Este informe describe **origin/main** y marca lo que ya choca
   en el port (§8).
2. **CSP permisiva: nada bloquea wasm, blob:, workers ni descargas de huggingface/jsdelivr.** La única
   CSP es `frame-ancestors 'none'; object-src 'none'; base-uri 'self'` (next.config.ts, `headers()`).
   No hay `script-src`, `connect-src` ni `worker-src` → no hace falta `'wasm-unsafe-eval'`. **No hay
   COOP/COEP** → `crossOriginIsolated === false` → sin `SharedArrayBuffer` (OpenCut no lo usa: 0
   coincidencias en `src/`; onnxruntime-web del Whisper local corre en un solo hilo).
3. **La trampa grande del proxy:** el matcher de `proxy.ts:306-308` sólo exime `png|jpe?g|svg|webp|gif|ico|css|js|woff2?|webmanifest`,
   `_next/static`, `cono-tx/` y `cono-doc/`. Los assets de OpenCut en `public/` (`fonts/font-atlas.json`
   + 15 `font-chunk-*.avif`) y cualquier `.json/.avif/.wasm/.mp3/.mp4/.ttf/.onnx` estático **pasan por
   el gate**: con sesión andan (y cuestan una invocación del proxy cada uno); sin sesión vuelven un
   307 a `/login` con HTML y status 200 → `.json()` explota. Y **no se puede eximir el prefijo
   `video-editor/`**: el lookahead del matcher también sacaría del proxy a la PÁGINA
   `/video-editor/<id>`, y el proxy es el único que valida el `?ws=` del super admin (pone
   `x-mako-ws`): sin él, el editor abriría en la cuenta propia del admin. Los assets van bajo un
   prefijo que no sea ruta (molde `cono-tx/`), y `tests/redirects-gate.test.ts:37-45` lee el matcher.
4. **Los tokens de shadcn chocan en TRES nombres**: `--color-primary`, `--color-border`,
   `--color-accent` ya existen en el `@theme inline` de MaKo (`app/globals.css:356-385`) apuntando a
   `var(--primary)`, `var(--border)`, `var(--accent)` — **los mismos nombres de variable que usa
   OpenCut**. Y el `:root` de OpenCut redefine `--primary`, `--accent`, `--border` y **`--sidebar`**
   (MaKo pinta su barra con `--sidebar: #14161B`). Copiar su `globals.css` repinta MaKo entera. La
   salida es redefinir esos vars DENTRO de un scope `.ce` (§3).
5. **Tailwind v4 sin `@custom-variant dark` = `dark:` sigue al SISTEMA OPERATIVO.** OpenCut declara
   `@custom-variant dark (&:where(.dark, .dark *))`; MaKo no declara nada → los `dark:` del port
   (14 archivos en OpenCut) se prenderían según `prefers-color-scheme` del usuario. MaKo usa **cero**
   `dark:` (medido), así que declararlo es seguro.
6. **El texto que ve el cliente va en ESPAÑOL NEUTRO (tú), no rioplatense.** AGENTS.md:2402 + el
   guard `tests/puente-panel-copy.test.ts:651` barre `git ls-files app lib components` y falla con
   cualquier voseo en copy visible — incluido el port entero. Rioplatense es la voz de MaKo hacia
   Martín y los comentarios del código.
7. **OpenCut guarda los proyectos en IndexedDB/OPFS POR ORIGEN, no por workspace**
   (`services/storage/indexeddb-adapter.ts:24`, `opfs-adapter.ts:11`). El super admin mira varios
   clientes en el mismo navegador con `?ws=N`: sin namespacing por workspace vería los proyectos de
   todos mezclados. Y el panel de sonidos de OpenCut llama a la **API de Freesound en runtime**
   (`src/app/api/sounds/search/route.ts`), que en un SaaS **está prohibido por contrato** (§6).
8. **Storage: el tope real no está medido.** Los comentarios de `lib/curso-admin.ts:133,316` dicen
   «5 GiB de tope para TODA la plataforma»; `docs/hallazgos-customer-success.md:4537` dice que otra
   entrada mide 100 GB en Pro. Con cualquiera de los dos, guardar el material crudo de cada proyecto
   en Supabase no escala → local-first (como OpenCut) y subir sólo lo exportado.

---

## 1. Cómo se agrega una tab — el checklist exacto

### 1.1 Los dos ejemplos recientes que sirven de molde

| Commit | Qué | Archivos que tocó para «existir como tab» |
|---|---|---|
| `f2c0a04b` (08/10) | `/api-mako` copiada de GitHub (CSS `.gh`) | `app/_components/icons.tsx` (+3: ícono `api`), `app/_components/nav.ts` (+5: item en `USER_NAV` y fila `dev-api-mako`), `app/api-mako/*` (page + componentes + `actions.ts` + `datos.ts` + `github.css`), `tests/api-mako-tokens.test.ts` |
| `1d5fa520` (11/10) | Dashboard = editor copiado de Looker Studio (CSS `.lk`) | `nav.ts` (match), `app/admin/dev/areas.ts` (`vive` del área), `app/admin/dev/dashboard/bitacora.ts` (+71, bitácora nueva), `app/admin/dev/registros.ts` (+2), `docs/hallazgos-graficos.md` (+87, doc nuevo), `docs/hallazgos.md` (+1, índice), `tests/graficos.test.ts`, `package.json` (+react-grid-layout) |

### 1.2 Checklist (archivo → qué va)

1. **`app/_components/nav.ts`** — en `FAMILIAS`, familia `content` («Content Machine»), grupo `ads`
   (líneas ~285-290, hoy: Ads Writer · Image Generator · Video Generator):
   `{ key: 'video-editor', label: 'Video Editor', href: '/video-editor', icon: '<existente>', match: starts('/video-editor') }`.
   - ⚠️ **La `key` es contrato con la base** (comentario de cabecera de nav.ts: la leen `tabEnCapa()`
     y el estado de onboarding por tab). Elegirla una vez. El port en curso ya usa `'video-editor'`.
   - El `icon` tiene que existir en `app/_components/icons.tsx` o dibuja un punto (AGENTS.md:1131,
     tope 3). Hay `video` (l.75), `tijera` (l.183), `videogen` (l.200). Un ícono nuevo se agrega ahí
     como hizo `f2c0a04b` con `api`. **No el logo de CapCut.**
   - Para lanzar oculto: `adminOnly: true` (lo filtra el Sidebar con `/api/auth/me`) **más** un guard
     de página (el filtro del sidebar es cosmético, `lib/tab-access.ts:4-6`).
2. **`lib/capas.ts`** — `completo` y `agencia` tienen `navKeys: null` → ven la tab **apenas se
   despliega** (o sea, todos los clientes con esa capa). `pm` (l.164) y `superadmin` (l.280) tienen
   lista explícita y NO la ven. Decidir.
3. **`app/video-editor/page.tsx`** (Server Component) — primera línea
   `await requireRolWs([], { nav: 'video-editor' })` (`lib/tab-access.ts:117-126`): sesión fresca
   contra la base, capa (`tabEnCapa`), rol (`[]` = admin-cliente y agencia; closer/setter no) y el
   onboarding global. Después `getWorkspaceActual()`: si es `null` (agencia sin impersonar) se
   muestra un `EmptyState` «Entra a un cliente» como `app/api-mako/page.tsx:50-52`.
   - Molde de pantalla completa con la barra al lado (`app/dashboard/page.tsx`):
     `<Pagina ancho="completo" densidad="compacta" style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>`.
     El `<main>` es `Pagina` siempre (AGENTS.md:3471 regla 1); el hijo estira con `flex: 1; min-height: 0`,
     nunca `height: 100%` (regla 3: Safari da cero → pantalla en blanco). El `h-screen w-screen` de
     OpenCut (`app/editor/[project_id]/page.tsx:45`, `mobile-gate.tsx:39`, `editor-provider.tsx:92-113`)
     desborda al lado de la barra: hay que cambiarlo.
   - `export const dynamic = 'force-dynamic'; export const revalidate = 0;` como todas las tabs.
   - Tema oscuro: `<TemaOscuroScript />` en el server (`app/_components/TemaOscuroScript.tsx`) **y**
     `<TemaOscuro />` en el cliente (los dos, siempre: uno evita el fogonazo blanco, el otro devuelve
     el tema al salir). Molde: `app/video-generator/page.tsx`.
4. **Pantalla completa sin barra (opcional, decisión):** `app/_components/PublicRouteGate.tsx`,
   función `esVistaSinChrome`, sumarle `/^\/video-editor\/[^/]+\/?$/`. Esconde Sidebar,
   ImpersonationBanner, AlertaVozMaKo, la esquina de avisos (`AvisoPixelViejo`, `MakoConfirmGate`
   ya la consultan). ⚠️ **Esconde también el cartel «salir de la vista» del super admin** → el editor
   necesita su propio «Volver» con `?ws=` (AGENTS.md, final de la sección de L921: «si la única salida
   vive adentro de una pantalla condicional, no hay salida»).
5. **Onboarding — la tab ES la herramienta → su onboarding es su ESTADO VACÍO**, sin entrada en
   `lib/tab-onboarding-catalogo.ts`. Precedentes: `app/api-mako/page.tsx:14` («esta tab ES la
   herramienta, así que su onboarding es su estado vacío (la regla del 05/10)») y el Dashboard, que
   tampoco tiene entrada; Automations y CRM son las otras dos excepciones escritas
   (`docs/relevo/onboarding.md:19-22`). El estado vacío de CapCut («Nuevo proyecto» + importar) es
   exactamente eso. Si en cambio se quiere un recorrido: entrada en `TAB_ONBOARDINGS` con keys
   prefijadas (`ve_…`; `tests/onboarding-keys-colision.test.ts` frena keys repetidas entre tabs),
   `requiere: 'video-generator'` si aplica, y sumar la key a los dos `ORDEN_CONFIG`
   (`lib/api-mako/areas/negocio.helpers.ts:363`, `app/api/onboarding/listo/route.ts:40`). ⚠️ Agregar
   un paso NO opcional después reabre el wizard a todos (comentario en `tab-onboarding-catalogo.ts`,
   entrada `video-generator`).
6. **Registro de `/admin/dev`** (AGENTS.md:4687, «el tercer destino, el que se olvida»):
   - `app/admin/dev/areas.ts`: un objeto `{ slug: 'video-editor', titulo: 'Video Editor', familia: 'Content Machine', grupo: 'Ads', estado, verEnApp: '/video-editor', alcance, vive: [...], proyectos: ['Feature: Video Editor'], hallazgos: 'hallazgos-video-editor' }`
     (molde: `video-generator`, l.661-674). `tests/dev-areas.test.ts` exige: cada ruta de `vive`
     **existe en disco** (l.35), el doc de `hallazgos` existe (l.98), el proyecto usa un prefijo del
     catálogo (`Feature: `, l.157). ⚠️ No meter archivos calientes compartidos (nav.ts, globals.css)
     en `vive`: desplazan el Change History propio (comentario de `reels`, l.678-684).
   - Bitácora (si se quiere el pedido textual de Martín): `app/admin/dev/video-editor/bitacora.ts`
     (`PARTES` + `BITACORA` con un hito `tipo: 'prompt'` y `pedido` literal; molde
     `app/admin/dev/dashboard/bitacora.ts`), su import y entrada en `app/admin/dev/registros.ts`, y
     **su fila `dev-video-editor` en `ADMIN_FAMILIAS › dev › grupos › dev-registros` de nav.ts**
     (`tests/dev-areas.test.ts:123` «un área con bitácora tiene su fila en el sidebar»; la key de una
     fila nueva de admin NO lleva `dev-` salvo que sea registro).
   - Después: `node scripts/gen-dev-historial.mjs` (regenera `_historial.generado.ts`, a mano).
   - Proyecto del tablero `Feature: Video Editor` en `lib/plan-proyectos-catalogo.ts` si se quiere
     Roadmap (hoy existe `Video Generator`, l.113).
   - `docs/dev-tabs-mapa.md` es un relevamiento del 08/08 (Video Generator figura como ComingSoon):
     opcional, ya está viejo.
7. **Rutas públicas — NO se toca `lib/rutas-publicas.ts`.** Toda la tab va detrás de la sesión. Sólo
   entra ahí una ruta que se autentica sola (bearer/firma) y no lee la cookie (AGENTS.md:3726). Si
   algún día un render se hace en el worker de montaje, su puerta es `/api/montaje/worker` (ya está).
8. **Los `?ws=` (AGENTS.md:921, las cinco formas):** `Link` y `useRouter` de `@/app/_ui/Link` (nunca
   `next/link` ni el `useRouter` de `next/navigation`); `window.location.href = conWs(destino, useWs())`
   (`lib/ws-tab.ts:51` + `app/_ui/Link.tsx:34`); `redirect(await rutaConWs(...))` en el server
   (`lib/workspace.ts:65`); los `fetch('/api/...')` salen solos por el parche de `app/_components/WsFetch.tsx`
   (sólo `window.fetch`, sólo `/api/`; un Worker no está parcheado). Nunca leer `?ws=` de la URL para
   decidir datos (IDOR, AGENTS.md:610 «Una cosa, un lugar»).
9. **Título de la pestaña:** sale solo de nav.ts (`lib/titulo-tab.ts` lee `TODOS_LOS_ITEMS`).
10. **Hallazgos:** `docs/hallazgos-video-editor.md` nuevo (el área es donde vive el código:
    `app/video-editor`) + su fila en `docs/hallazgos.md` **en el mismo commit**. Las reglas que
    gobiernen código nuevo van a AGENTS.md.
11. **Tests:** `npm test` (= `node --import tsx --test tests/*.test.ts`, 607 archivos) **después** del
    `git add`: los guards de repo usan `git ls-files` y no ven archivos nuevos sin stagear
    (AGENTS.md:6537). Sumar los archivos de navegación del editor a la lista de
    `tests/pantalla-links-ws.test.ts` (hoy enumera 7 pantallas a mano).

---

## 2. Build y bundling

### 2.1 `next.config.ts` (completo, 170 líneas)

- `typescript: { ignoreBuildErrors: true }` — el typecheck no corre en el build (AGENTS.md:98).
- `turbopack: { root: __dirname }`. **Sin `webpack`, sin `serverExternalPackages`, sin
  `transpilePackages`, sin `images`.** Next 16 compila con Turbopack por default.
- `outputFileTracingIncludes` sólo para `/admin/docs`.
- `experimental.proxyClientMaxBodySize: '20mb'` — el proxy **trunca en silencio** un cuerpo más
  grande (comentario en el archivo). Ningún video sube por una ruta: va directo a Storage.
- `rewrites` (/vsl/mako-cs) y `redirects` (/todo, /graphics, /leads, /extension…).
- `headers()` sobre `/:path*`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `HSTS`, y la CSP mínima de arriba. No hay
  `Cross-Origin-Opener-Policy` ni `Cross-Origin-Embedder-Policy` en next.config, vercel.json ni
  proxy.ts (grep: 0).
- ⚠️ **No agregar COEP global** si algún día se quiere multihilo para Whisper/ffmpeg.wasm: rompe todo
  recurso cruzado sin CORP (imágenes de Meta, Supabase, YouTube, Panda, Google Fonts). Si hiciera
  falta, `headers()` con `source: '/video-editor/:path*'` y `credentialless`, medido antes.

### 2.2 El motor de OpenCut contra este build

- **`opencut-wasm` usa la integración ESM de wasm**: `node_modules/opencut-wasm/opencut_wasm.js`
  hace `import * as wasm from "./opencut_wasm_bg.wasm"` (3.037.899 bytes) y `wasm.__wbindgen_start()`
  al importarse. OpenCut lo compila con Next 16.1.3 + Turbopack **sin ninguna config**
  (`apps/web/next.config.ts` sólo tiene `images`, `compiler.removeConsole`, `output: 'standalone'`,
  `withBotId`, `withContentCollections`), así que debería andar en 16.2.6. **NO VERIFICADO en MaKo:
  la prueba es el primer `npm run build`**, que el pre-push NO corre (AGENTS.md:98: «si tocaste rutas
  nuevas, corré `npm run build`»; y si se toca un `'use server'`, también, L296).
- **SSR:** un componente cliente montado por una page server se renderiza en el server en cada
  request (todas las pages son dinámicas por el `getSesionAdmin()` del layout, AGENTS.md:3677). O sea
  que el wasm se instanciaría en Node por request y el bundle del server se lleva 95k líneas.
  Recomendación: un wrapper `'use client'` que haga `dynamic(() => import('./Editor'), { ssr: false })`
  (`ssr: false` no se permite en un Server Component).
- **Workers:** `src/services/transcription/service.ts:114`
  `new Worker(new URL("./worker.ts", import.meta.url), { type: 'module' })` — Turbopack reconoce
  `new Worker()` (`node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md:129`) y debería
  emitirlo bajo `/_next/static` (exento del proxy; **no medido**). Adentro del worker no corre el
  parche de `?ws=` (no importa: sólo baja de huggingface).
- **transformers.js** baja los pesos de `huggingface.co` y el wasm de onnxruntime de
  `cdn.jsdelivr.net` → la CSP no lo frena. Costo: decenas a cientos de MB por navegador (Cache
  Storage), nada de plata; el audio no sale de la máquina.
- **CSRF del proxy:** todo `POST/PUT/PATCH/DELETE` a `/api/*` con `Origin` exige que el host coincida
  (`proxy.ts` ~l.222-231). Mismo origen → sin problema.
- **Topes que no dan error** (AGENTS.md:1131): server action **1 MB** (no hay
  `serverActions.bodySizeLimit`); función de Vercel ~4,5 MB (comentario de `supabase/migrations/0202_curso.sql:139-141`);
  proxy 20 MB truncando. `fetch` no da progreso de subida → `xhr.upload.onprogress`, molde
  `putWithProgress` en `app/ads-manager/creativeUpload.ts:49`.

### 2.3 ESLint, typecheck y el pre-push

- `eslint.config.mjs`: `eslint-config-next/core-web-vitals` + `/typescript`, ignora `scripts/**`,
  `no-unused-vars` en `warn`. `npm run lint` tarda 3 min 19 s y no está en el build («Starting with
  Next.js 16, `next build` no longer runs the linter automatically»,
  `node_modules/next/dist/docs/01-app/01-getting-started/01-installation.md:385`) ni en el pre-push →
  **ESLint no puede tumbar el build**.
- **Pre-push** (`.git/hooks/pre-push` del clon principal, 194 líneas, 13 chequeos). Los que tocan al port:
  1. **Typecheck del árbol ENTERO** vía `scripts/typecheck-lock.mjs` (lock por máquina en
     `%TEMP%/mako-typecheck.lock`, espera hasta 10 min; `tsc` pide 1-2,4 GB). `tsconfig.json`:
     `strict`, `target ES2017`, `moduleResolution bundler`, `include **/*.ts(x)` → el port entra
     entero. OpenCut usa las mismas opciones (strict, ES2017, bundler) → compatibles; **pero
     `@/*` → `./*` en MaKo y `./src/*` en OpenCut**: cada import se reescribe (el port en curso ya lo
     hizo: 1601 imports `from "@/app/…"`). Esta máquina tiene además un hook «Guardia de RAM» que
     corta comandos pesados con <2,5 GB libres (me pasó durante este relevamiento).
  2. **`scripts/hooks-en-orden.sh`**: `rules-of-hooks` sobre los `.tsx` que cambian contra
     `origin/main` (saltea los sin commitear). Con ~400 `.tsx` nuevos, un solo hook condicional de
     OpenCut **bloquea el push** («Minified React error #300», pantalla en blanco).
  3. Los otros once (skills, gramática, plugin, zip de la extensión, replay, catálogo de cursos,
     operaciones/BOQ/puede-filmar del puente, referencia de la API) no miran `app/video-editor`.
- Guards de `npm test` que barren TODO `app/` + `lib/` (y por lo tanto el port): voseo y
  `var(--fs-*)` (`tests/puente-panel-copy.test.ts:651,746`), frontera `'use client'`
  (`tests/frontera-use-client.test.ts`), tacho de borrar único (`tests/borrar-tacho-casa.test.ts`:
  emoji 🗑, trazos de tacho propios, nombres `IconTrash`/`I_BORRAR`/`IconoPapelera`…), exports de
  `'use server'` (`tests/campana-producto.test.ts`), `loading.tsx` en lista blanca
  (`tests/layout-sin-suspense.test.ts`), `sin-instagram`/`sin-clarity`/`sin-whop`/`sin-chatwoot`.

---

## 3. Estilos

### 3.1 Lo que hay en `app/globals.css` (1161 líneas)

- l.1 `@import "tailwindcss"` (preflight global), l.13 `@source not "../docs"`, l.16
  `@import "./_ui/ui.css"` (2178 líneas, clases `mk-*`).
- `:root` (l.24-~245): `--bg #F4F6F9`, `--surface`, `--surface-2`, `--velo-hover`, `--border #EAECF1`,
  `--border-strong`, `--ink #12151B`, `--dim`, `--faint`, `--sidebar #14161B`, `--sidebar-2`,
  `--sidebar-line`, `--grafo-*`, `--sidebar-text`, `--on-sidebar`, `--on-ink`, `--primary #2F6FED`,
  `--primary-strong/-bg/-weak`, `--on-primary`, `--mako #F2B01E` (+lite/ink/bg/border),
  `--accent: var(--mako-ink)`, `--accent-soft`, `--good/-bg`, `--warn/-bg/-fill`, `--bad/-bg`,
  `--fs-*` (7 niveles), `--touch`, `--focus-ring`, `--r-sm/md/lg/xl`, `--wa*`, y alias viejos
  (`--text`, `--card-bg`…).
- `[data-tema="oscuro"]` (l.283-336): el oscuro de la casa (`--bg #22262E`, `--surface #2A2F39`,
  `--ink #F3F5F8`, `--primary #7FA6F8`…). Es «UNA pantalla que se pinta oscura» (AGENTS.md:3649), lo
  usan `/second-brain`, `/video-generator`, `/ads-writer`, `/onboarding`.
- `@theme inline` (l.356-385): `--color-mako`, `-mako-ink`, `-mako-bg`, **`-bg`**, `-surface`,
  `-surface-2`, **`-border`**, `-border-strong`, `-ink`, `-dim`, `-faint`, **`-accent`**,
  `-accent-soft`, **`-primary`**, `-primary-bg`, `-good`, `-warn`, `-bad`, `-card-bg`,
  `-card-border`, `-text`, `-text-dim`, `-text-pending`, `-accent-yellow`, `-accent-green`,
  `-accent-orange`; `--font-display`/`--font-body: 'Geist'`.
- Global que se mete en cualquier pantalla: `* { box-sizing }`, `select { appearance: none }` (l.401),
  `body { background: var(--bg); color: var(--ink); font-family: Geist }` (l.462), y las barras de
  scroll finas para `*` con `color-mix(var(--ink) …)` (l.1111-1127) — en un editor oscuro con
  `--ink` claro de MaKo el pulgar no se ve: hay que redefinir `--ink` en el scope.

### 3.2 Choques con los tokens de shadcn de OpenCut (`apps/web/src/app/globals.css`)

| Token de OpenCut | En MaKo | Riesgo |
|---|---|---|
| `--color-primary: var(--primary)` | **existe**, mismo var | `bg-primary` del port pinta el azul de MaKo salvo que `.ce` redefina `--primary` |
| `--color-border: var(--border)` | **existe**, mismo var | ídem |
| `--color-accent: var(--accent)` | **existe**, `--accent` = dorado legible | los hover del port saldrían dorados |
| `background, foreground, card(-foreground), popover(-hover/-foreground), primary-foreground, secondary(-border/-foreground), muted(-foreground), accent-foreground, destructive(-foreground), constructive(-fg), caution(-fg), input, ring, chart-1..5, sidebar-*` | **no existen** | libres; sin definir resuelven a nada (AGENTS.md:1131 tope 3: «un var inexistente HEREDA») |
| `:root { --sidebar: … }` (OpenCut l.49) | **`--sidebar` es la barra de MaKo** | pegarlo en `:root` aclara la barra lateral de toda la app |
| `@theme inline { --text-xs .72rem; --text-sm .79rem; --text-base .92rem; --radius-sm/md/lg; --font-sans: var(--font-inter); --breakpoint-xs }` | MaKo no los toca | en el `@theme` global cambiarían `text-sm`/`rounded-md` de MaKo (poco usados: 37 apariciones de utilidades de layout en 13 archivos) |
| `@layer base { * { @apply border-border outline-ring/50 } body { @apply bg-background text-foreground } }` | — | global: recolorea todos los bordes y el `body` de MaKo |
| `@custom-variant dark (&:where(.dark, .dark *))` | no hay | sin esto `dark:` = `prefers-color-scheme` |
| `@plugin "tailwindcss-animate"`, `@plugin "@tailwindcss/typography"` | no hay (el port no los sumó a package.json) | `animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*` (~45 usos) quedan **mudos sin error** |
| `@utility scrollbar-hidden` (7 usos) + `-x`/`-y` | — | **prohibido** en la casa (AGENTS.md:3471 regla 4: `scrollbar-width: none` en ningún eje) |

Medido en MaKo fuera del port: **0** `className` con `bg-primary|text-primary|border-border|bg-accent|text-accent|bg-surface…`
(los aciertos del grep eran `var(--text-dim)` en estilos inline) y **0** `dark:`. MaKo es inline +
`mk-*`; casi no usa utilidades de color de Tailwind. Por eso sumar nombres al `@theme` es barato.

### 3.3 Cómo están hechas las dos copias que ya existen

- **`.gh` (`/api-mako`, GitHub):** hoja aparte `app/api-mako/github.css` (330 líneas) importada desde
  el componente cliente (`app/api-mako/ApiMako.tsx:21` `import './github.css'`). Todas las reglas
  bajo `.gh`; los tokens `--gh-fg`, `--gh-bg`, `--gh-border`… se definen EN `.gh`; la raíz es
  `<div className="gh">`. Valores de Primer (MIT), «sin su logo ni su marca». No usa `PageHeader` ni
  `Tabs` de `app/_ui` a propósito (AGENTS.md, sección de L694: «No se "arregla" a los componentes de
  la casa»), pero sí la vista en `?tab=` leída en el server y `app/_ui/Link`.
- **`.lk` (Dashboard, Looker Studio):** constante `CSS` inline renderizada con `<style>{CSS}</style>`
  (`app/dashboard/EditorInforme.tsx:1150` en adelante, montada en l.543); tokens `--lk-*` en `.lk`;
  mezcla los tokens de MaKo para las tarjetas (`var(--surface)`, `var(--ink)`). Comentario l.26: «El
  CSS vive limitado a `.lk` (como el de GitHub en /api-mako)».

### 3.4 Recomendación concreta para el port (Tailwind-pesado)

1. Raíz del editor `<div className="ce">` (prefijo libre: 0 reglas `.ce`/`.cc` en el repo).
2. Hoja `app/video-editor/capcut.css` (molde `.gh`, no `<style>` inline: el volumen no entra) con
   **todos** los vars de CapCut definidos en `.ce`: los de shadcn (`--background`, `--foreground`,
   `--card`, `--popover`, `--secondary`, `--muted`, `--destructive`, `--input`, `--ring`…), **y la
   redefinición de los de MaKo que se cruzan**: `--primary`, `--border`, `--accent`, `--ink`,
   `--surface`, `--bg`, `--dim`, `--faint`, `--focus-ring`, `--on-primary`. Así `bg-primary` del
   port, los primitives de `app/_ui` que se monten adentro y las barras de scroll globales salen
   todos con los valores de CapCut, sin tocar una regla.
3. En `app/globals.css`, dentro del `@theme inline` existente, **sólo nombres que hoy no existen**,
   apuntando a vars que sólo viven en `.ce`: `--color-background: var(--background)`,
   `--color-foreground`, `--color-card`, … (afuera de `.ce` no resuelven a nada y nadie los usa).
   Para la escala de texto/radio: `--text-xs: var(--ce-text-xs, 0.75rem)` (el default de Tailwind
   como respaldo), o aceptar los valores de Tailwind. **No verificado**: medir en build que las
   utilidades salgan con `var()`.
4. `@custom-variant dark (&:where(.ce, .ce *));` en globals.css: CapCut es oscuro siempre y MaKo no
   usa `dark:`.
5. El `@layer base` de OpenCut va **scopeado**: `.ce, .ce * { border-color: var(--border) }`,
   nunca `*`/`body`.
6. `tailwindcss-animate` (o `tw-animate-css`) con `@plugin` en globals.css si se quieren las
   animaciones de los popovers; `scrollbar-hidden` se reemplaza por la variante fina oscura
   (`.mk-scroll-oscuro`).
7. Fuente: el port depende de `var(--font-inter)` (next/font en el layout de OpenCut) que en MaKo no
   existe → cae a la del `body` (Geist). La fuente de la UI de CapCut es propietaria: **no se copia**;
   Geist/Inter (OFL) o `system-ui`.
8. Tema: `<TemaOscuroScript />` + `<TemaOscuro />` igual, para que el fogonazo inicial y la barra
   lateral vayan oscuros; los colores reales del editor salen de `.ce`, no de `[data-tema="oscuro"]`
   (que es el oscuro azulado de MaKo, no el de CapCut).

---

## 4. Datos

### 4.1 Migraciones

- 250 archivos en `supabase/migrations/`; los últimos: `0233_secuencia_posiciones`,
  `0240_…`, `0241_…`, `0242_canales_zernio`, `0245_email_entrantes` (hay huecos y colisiones
  históricas). El número es **recurso compartido**: `git pull` + `ls supabase/migrations | tail -5`
  justo antes de nombrar (AGENTS.md:323 «Hay dos cuentas»).
- Skill del repo `.claude/skills/author-numbered-migration/SKILL.md`: `begin; … commit;`,
  idempotente (`if not exists`), `workspace_id bigint not null default 1 references workspaces(id) on delete cascade`,
  índice por `workspace_id`, `alter table … enable row level security;` **sin políticas** +
  `revoke all on … from anon, authenticated;` (todo el runtime entra con `service_role`). Se aplica
  por conexión directa (`scripts/apply-migration.mjs`), no hay `supabase db push`.
- **Cabecera obligatoria con el ORDEN DE DESPLIEGUE** (AGENTS.md:4283). Molde textual,
  `0245_email_entrantes.sql:4-8`: «⚠️ ORDEN DE DESPLIEGUE: ANTES o JUNTO con el deploy que trae …
  Agrega y no saca nada». Lo que AGREGA algo que el código nuevo ya lee: antes o junto; lo que SACA:
  después. Una VISTA lleva `security_invoker = on` + `revoke` (no tiene RLS).
- Una tabla nueva por workspace son **tres listas más**: `TENANT_TABLES` en `lib/workspace.ts:85`
  (sin eso `getTenantDb()` es PASSTHROUGH: devuelve filas de todos los clientes, sin error),
  `TABLAS_DE_INQUILINO` en `lib/tablas-de-inquilino.ts:45` (reset y borrado de un cliente; 120 tablas
  al 09/10), y si hay bucket, `BUCKETS` en `lib/reset-workspace.ts:51` (asume rutas `<ws>/…`).

### 4.2 Dónde se guarda hoy un documento grande por workspace

| Caso | Dónde | Notas |
|---|---|---|
| Informe del Dashboard (Looker) | `app_settings`, clave `graficos.tablero.<userSub>` (`lib/graficos-tablero.ts`) | por persona Y workspace (el super admin mirando no le pisa la vista al dueño); lee con `getSettingEstricto` y **si la lectura falló no guarda** («no pude leer ≠ no armó ninguno») |
| Historial del Video Generator | `app_settings` `video-generator.historial` (`app/video-generator/video-datos.ts:28`), tope 10 | texto JSON; «historial de conveniencia» |
| Anuncios terminados | `app_settings` `video-generator.anuncios` (`anuncios-datos.ts:32`) | URLs; hoy archivos en `public/anuncios/` (deuda escrita) |
| Lienzo de Automations | `nutricion_secuencias.pasos` (jsonb, mig 0223) + `nutricion_secuencias.posiciones` (jsonb, mig 0233) | layout en su propia columna y su propia acción, nunca adentro de `pasos` (AGENTS.md:6643) |
| Landing Generator (spec) | `landing_drafts.spec jsonb` (mig 0120) | una fila por versión |

`lib/settings.ts`: `getSetting` (tolerante), `getSettingEstricto` (tira), `setSetting`,
`cambiarSettingSi` (compare-and-set). Todo por el workspace de la pestaña.
**Para proyectos del editor**: el documento del timeline puede pasar 1 MB → no por server action
(tope 1 MB); route handler o `app_settings`/tabla con la escritura por `fetch`. Recomendación: tabla
`video_proyectos` (`workspace_id`, `id uuid`, `nombre`, `doc jsonb`, `version`, `updated_at`,
`creado_por`) con las tres listas de arriba, guardado por compare-and-set de `version` (dos pestañas).

### 4.3 Supabase Storage

| Bucket | Público | Tope | MIME | Dónde se creó |
|---|---|---|---|---|
| `video-clips` | **sí** | 100 MB | sólo video | **fuera de migraciones** (comentario `app/video-generator/video-action.ts:197-208`) |
| `curso-videos` | no | **2 GiB** | mp4/webm/quicktime/m4v | `0202_curso.sql:142-144` |
| `branding` | no | 200 MB | — | `0098` |
| `curso-entregas` | no | 100 MB | lista | `0218` |
| `curso-notas`, `curso-adjuntos`, `comunidad-adjuntos` | no | 25 MB | lista | `0208`, `0216`, `0217` |
| `replays` | no | 2 MiB | — | `0191` |
| `wa-media`, `archivero`, `ig-media` | no | NULL (global) | — | `0073`, `0097`, `0136` |
| `avatars`, `contratos`, `ads-creatives`, `portadas` | — | — | — | fuera de migraciones |

- **Subida directa del navegador** (molde `urlSubidaAdjunto`, `lib/comunidad-datos.ts:550-571`): el
  server valida MIME y bytes (`TOPE_ADJUNTO_BYTES`, 25 MB), el permiso, arma la ruta
  `<ws>/<producto>/<uuid>.<ext>` con `pathDeAdjunto` (`lib/comunidad-reglas.ts:662`, el nombre
  original NUNCA va en la ruta), llama `createSignedUploadUrl(path)` y devuelve
  `{ path, signedUrl, apikey }`; el navegador hace PUT con progreso (`putWithProgress`).
- **Servir:** `createSignedUrl(path, 3600, { download })` (`comunidad-datos.ts:535`), firmado al
  leer, una hora.
- **Todo path que vuelve del navegador se valida exacto** contra el workspace
  (`pathEsDeLaComunidad`, `comunidad-reglas.ts:670`; `pathEsDelWorkspace`,
  `app/customer-success/curso/reglas.ts:178`).
- ⚠️ **La URL firmada NO hace cumplir el tamaño declarado** (`docs/hallazgos-customer-success.md:4529-4538`):
  sólo el `file_size_limit` del bucket. Y subir sin guardar deja huérfanos (molde de purga:
  `descartarVideo` en `lib/curso-admin.ts` ~l.317 y `lib/curso-purga.ts`).
- ⚠️ `video-clips` guarda en `video-generator/<plan>/…` **sin el prefijo `<ws>/`** → el reset de un
  workspace (que lista `<ws>/` en cada bucket) no lo limpia, y la autorización es por URL DERIVADA
  (comentario `lib/creativo-mako.ts:15-24`). Un bucket nuevo del editor va con `<ws>/`.

### 4.4 Cómo se valida el workspace

- `getWorkspaceActual()` (`lib/workspace.ts:249`): usuario → su workspace; admin → el `?ws=` de la
  pestaña (sólo vía el header `x-mako-ws` que pone `proxy.ts` después de verificar la sesión firmada),
  si no la cookie de impersonación, si no `null` (fail-closed); cron/webhook → contexto de
  `runWithWorkspace`.
- **Server actions = endpoints públicos**: cada una repite la puerta. Molde `puerta()` de
  `app/api-mako/actions.ts:33-42`: `getUsuarioActual()` + `getRolWsEfectivo()` (null → «tu sesión
  venció») + rol + `tabEnCapa(<key>, await getCapaActual())` + `getWorkspaceActual()` (null → «entra a
  un cliente»), y `rateLimit` en lo caro. En un archivo `'use server'` sólo se exportan funciones
  async (AGENTS.md:296; `tests/campana-producto.test.ts`).
- Lecturas/escrituras por `getTenantDb()` (auto-filtra las `TENANT_TABLES`).
- Route handlers: la misma puerta + el chequeo de `Origin` del proxy para mutaciones.

### 4.5 Lo local (IndexedDB/OPFS) del motor

OpenCut guarda proyectos, medios y miniaturas en IndexedDB + OPFS del navegador, por origen. En MaKo:
- **Namespacing por workspace** (nombre de base / carpeta OPFS con el `ws`), o el super admin con
  varias pestañas `?ws=` ve todo mezclado y un cliente le «hereda» proyectos a otro en el mismo
  navegador.
- Es por navegador y por máquina: no lo ve el equipo del cliente, se pierde al limpiar datos. Si se
  quiere compartir, el documento va a la tabla (§4.2) y los medios quedan locales hasta exportar.
- AGENTS.md:1071: lo que restaura `localStorage` es una PREFERENCIA, nunca pisa una DECISIÓN.

---

## 5. Video Generator → «Editar en el editor»

### 5.1 Dónde queda cada cosa

- **El anuncio montado**: bucket `video-clips`, ruta `video-generator/<planId>/montado-<trabajoId>.mp4`
  (`app/api/montaje/worker/route.ts:134`; `rutaDelMontado` en `lib/creativo-mako.ts:114-116`). Lo
  sube el worker (`worker/montar-cola.mjs`, contenedor con ffmpeg) con una URL firmada que se acuña al
  entregar el trabajo (45 min, `route.ts:139-140`).
- **La fila**: tabla `montaje_trabajos` (mig `0151_montaje_cola.sql`, en `TENANT_TABLES`): `id`,
  `workspace_id`, `plan_id`, `pedido jsonb` (`clips` = URLs de las tomas, `guion`, `segundosPorToma`,
  `plan`, `musica`, `titulo`), `estado` (`pendiente|tomado|listo|fallido`), `resultado jsonb`
  (`ruta`, `url`, `segundosAntes`, `segundosDespues`, `palabrasPerdidas`, **`plan`**), `motivo`, `error`.
- **Las tomas**: mismo bucket, `video-generator/<planId>/toma-<n>-<operacion>.mp4`
  (`video-action.ts:313`; `rutaDeToma`, `creativo-mako.ts:119-121`); el plan con sus tomas vive en
  `app_settings` `video-generator.historial` (`video[n] = { url, mediaId, operacion }`).
- **Lectores listos y ya scopeados** (`lib/creativo-mako-fuentes.ts`, `server-only`):
  `montadosDelWorkspace()`, `tomasDelWorkspace()`, `resolverCreativoMako(ref)`. Las refs que viajan
  desde el navegador son `montaje:<id>` o `toma:<plan>:<n>:<op>` (`leerRefCreativo`,
  `creativo-mako.ts:100-111`): **la URL se DERIVA en el server, nunca se acepta del navegador**. Hoy
  las usa Ads Manager («Mis creativos»).

### 5.2 El editor de cortes que ya existe

- `app/video-generator/plan-montaje.ts`: `Plan = { total, segs: Tramo[] }`,
  `Tramo = { toma (1-based), ini, fin }` (segundos del CLIP), `leerPlan` (recalcula el total) y
  `porQueNoSirveElPlan(plan, cuantasTomas, segundosPorToma[])` — existe porque ffmpeg NO falla con un
  tramo invertido ni pasado del final: devuelve menos y calla.
- `app/video-generator/editor-cortes.ts` (puro, con test): `moverBorde`, `quitarTramo`, `partirTramo`,
  `inicios`, `enSegundo`, `mismoPlan`; `MINIMO_SEG = 0.35`; regla «ACOTA, no rechaza».
- `app/video-generator/EditorAnuncio.tsx` (581 líneas, cliente): props
  `{ clips: string[], segundosPorToma: number[], plan, musica, onAplicar(plan, musica), onCerrar }`;
  previsualiza saltando entre las tomas originales (sin render); escala fija; pila de deshacer en
  `window` sin mirar el foco (correcto ahí, AGENTS.md:7267 punto 3). Lo monta
  `PasoMontaje.tsx:187` sólo si `estado.plan` existe; «Aplicar» re-encola el montaje con el plan
  editado y el worker NO recalcula (escribe `plan.json`).

### 5.3 Cómo se conectaría el botón

- **Dónde:** en `PasoMontaje.tsx` (estado `listo`, al lado de «Descargar el anuncio» y «Ajustar los
  cortes», ~l.155-182) y en la lista de anuncios de `VideoGeneratorApp.tsx`.
- **Qué falta:** el estado `listo` de `EstadoMontaje` (`video-action.ts:2260-2264`) no trae el `id`
  del trabajo → sumarlo para poder armar `montaje:<id>`, o pasar el `planId`.
- **Navegación:** `Link` de `@/app/_ui/Link` a `/video-editor/nuevo?desde=montaje:<id>` (o
  `?plan=<planId>`). La page del editor (server) resuelve con `resolverCreativoMako` en el workspace
  de la sesión, valida con `leerPlan`, y baja por props SÓLO `{ titulo, urls de tomas, segundosPorToma, plan, urlMontado }`
  (AGENTS.md:1950: frontera de datos). El cliente crea el proyecto local y baja los medios a Blob
  (las URLs públicas de Supabase: CORS **a verificar con una medición**; sin CORS no se puede
  decodificar con WebCodecs ni dibujar en canvas sin ensuciarlo).
- **Mapeo Plan → timeline:** cada `seg[i]` = un clip de la pista principal con fuente
  `clips[toma-1]`, `trimStart = ini`, `trimEnd = duracionToma - fin`, `start = inicios(plan)[i]`.
  Si la persona sólo recorta/reordena tramos, se puede **volver a convertir a `Plan`** y re-montar con
  el worker (conserva subtítulos Anton, música, loudnorm y verificación de palabras). Cualquier cosa
  más (texto, efectos, transiciones) sólo existe en el export del navegador.
- **Qué se pierde según qué se importe:** las tomas + plan son material CRUDO (el montaje agrega
  subtítulos quemados con `scripts/subs-anuncio.mjs`, música y nivelación); el `montado` ya trae los
  subtítulos quemados → sumarle subtítulos de CapCut los duplica. Decisión de producto (§ decisiones).
- **La vuelta:** el mp4 exportado se sube con URL firmada a un bucket privado con `<ws>/` y se
  registra con un origen nuevo (`'editor'`) en `lib/creativo-mako.ts`, para que aparezca en Ads
  Manager. Futuro.

---

## 6. Capacidades que ya existen y cómo se pueden reusar

| Capacidad | Dónde | Cómo sirve al editor | Trampa |
|---|---|---|---|
| Transcripción (texto) | `transcribirAudio(base64, mime, opts)` en `lib/ai-cheap.ts:1333`; cascada `CASCADA_STT = ['gemini','groq','openai']` (l.249); BYOK por workspace (`credWs`) + red de plataforma; detector `salidaDegenerada` | texto plano, sin tiempos | base64 por server action topea en 1 MB; Gemini no da tiempos por palabra |
| Transcripción con tiempos por palabra | sólo `scripts/subs-anuncio.mjs` (Groq `verbose_json` + `timestamp_granularities[]=word`, `GROQ_API_KEY` de entorno) — corre en el worker | subtítulos automáticos estilo CapCut | **Groq §6.3(c) prohíbe un endpoint de transcripción «pass-through»** (reventa) — `docs/hallazgos-video-pipeline.md:112-114`; y sus tiempos por palabra NO sirven para POSICIONAR cortes (§12.1, l.780), sí para subtítulos |
| Transcripción local | la de OpenCut: transformers.js + Whisper en un Worker | gratis, privada, sin cuota, sin contrato | descarga de modelo; CPU del cliente |
| Voz (TTS/STS/clon) | `lib/elevenlabs.ts`: `MODELO_TTS eleven_multilingual_v2`, `MODELO_STS eleven_multilingual_sts_v2`, `decirConVoz`, `convertirVoz`, `clonarVoz`, `preflightEleven`; `app/video-generator/voz-cliente.ts` | «Texto a voz»/«Cambiar voz» de CapCut | **BYOK**: `elevenKey()` = `credDelCliente('ELEVENLABS_API_KEY')` (l.154); sin key la feature se apaga; ElevenLabs free no tiene licencia comercial |
| Música | `lib/musica-catalogo.ts`: `PISTAS = []` **vacío a propósito** (licencia pendiente: Epidemic Sound Connect); `hayMusica()` decide si se dibuja el selector | biblioteca de audio | un mp3 cualquiera = reclamo de copyright sobre la campaña del cliente |
| Efectos de sonido | ninguno | — | **la API de Freesound está prohibida en SaaS** (API ToS §4(d) «service bureau», `hallazgos-video-pipeline.md` §6); OpenCut la llama en `src/app/api/sounds/search/route.ts` → **no se porta así**; la salida limpia es un pack CC0 bajado una vez a storage propio, con registro de id+uploader+licencia |
| Fuentes | `worker/fuentes/Anton-Regular.ttf` + `OFL.txt` (subtítulos del worker) | fuente de subtítulos | Arial Black/Helvetica prohibidas (EULA y libass cae en silencio); el selector de OpenCut usa la API CSS de Google Fonts en runtime (OFL/Apache, OK) + un atlas en `public/fonts` (ver la trampa del proxy) |
| Imagen/video IA | el puente a Google Flow (`lib/flow*.ts`, extensión) | «IA» de CapCut | gasta créditos del cliente: default NO reintentar (AGENTS.md:6220); lo que se paga entra por el trabajo real, no por un botón de probar (6194) |
| Claude | `lib/veto-claude.ts` | — | **vetado por default**: cualquier feature nueva necesita fila en `CLAUDE_PERMITIDO` con vencimiento (AGENTS.md:3189); `def` del catálogo = proveedor GRATIS, si cobra `pagoPorque` (3223, `tests/model-registry.test.ts`); y la memoria: «el Plan NUNCA paga IA» |

Fuente de NOMBRES en español de CapCut: el curso «Taller Capcut PRO» ya está en el repo
(`app/conocimientos/curso-taller-capcut-pro-gg.ts`, 63 clases: «Recorte Automático», «Chroma Key»,
«Máscara», «Keyframes», «Herramienta capas»…) con transcripciones en `public/cono-tx/<videoId>.json`.

---

## 7. Las reglas de AGENTS.md que más pegan en un editor grande del lado del cliente

| Línea | Regla | Qué exige acá |
|---|---|---|
| 2 | «This is NOT the Next.js you know» | leer `node_modules/next/dist/docs/` antes de usar una API de Next |
| 98 | El typecheck no corre en el build | correr `npm run build` al agregar rutas; nunca `--no-verify` |
| 296 | En `'use server'` sólo funciones async | constantes del editor en módulos de datos |
| 610 | Una cosa, un lugar | `?ws=` sólo por `getWorkspaceActual`; `Link`/`useRouter` de `app/_ui/Link` |
| 694 | Una capacidad nueva se DECLARA en el registro de la API | si MaKo/WhatsApp/la API tienen que crear o exportar un proyecto, va en `lib/api-mako/areas/<área>.def.ts` + `.run.ts`, no en una ruta suelta |
| 921 | Cinco formas de navegar, las cinco con `?ws=` | el port tiene 4 archivos con `next/link`/`next/navigation` (§8) |
| 1131 | Tres topes que no dan error | server action 1 MB, sin progreso de subida en `fetch`, `var()` inexistente hereda |
| 1159 | La pantalla dice QUÉ pasó (techos de texto) | toast 3-4 palabras, rótulo 1-3, estado vacío una frase; el porqué al código |
| 1290 | ¿Tiene el tamaño que le corresponde? | escalas de tipografía heredadas de otra jerarquía |
| 1328 / 1372 / 1440 | Arrastre HTML5: la foto la saca el SO, el nodo origen no se colapsa, la foto se toma al terminar `dragstart` | arrastrar medios del panel al timeline |
| 1389 | Un GESTO se verifica arrastrando en un navegador | al segundo «sigue sin andar», Playwright fuera del repo |
| 1457 / 1761 / 1779 | Layout con el valor más largo; un layout que se auto-mide tiene que acertar siempre; `scrollWidth` no es el ancho natural | rótulos de CapCut en español (más largos que en inglés) |
| 1510 | Lo que vale para TODOS se escribe en el choke point | el deshacer va en el command manager del motor (OpenCut ya tiene `core/managers/commands.ts`) |
| 1950 | `'use client'` es frontera de DATOS | a la página baja sólo lo que el editor dibuja; `server-only` en los módulos de datos; `tests/frontera-use-client.test.ts` |
| 2142 / 2187 | El fuente y lo servido no son el mismo texto; `//` entre etiquetas JSX es TEXTO | CSS en template literal sin backticks; comentarios movidos |
| 2402 | La voz de MaKo es rioplatense, el texto del CLIENTE no | copy en español neutro (tú); guard de voseo sobre todo el port |
| 3189 / 3223 / 3256 / 3307 | Claude vetado; un default que cobra; un fallback que no cobra; Claude último recurso | toda IA del editor por la cascada gratis y BYOK |
| 3451 | Borrar es UN tacho, rojo; íconos en cada opción de desplegable | `BotonBorrar`/`IconoBorrar`; `tests/borrar-tacho-casa.test.ts` barre el port |
| 3471 | Dos reglas de layout (Pagina; sin scroll horizontal en barras; pantalla completa con flex; `scrollbar-width: none` prohibido) | el `h-screen w-screen` y `scrollbar-hidden` de OpenCut |
| 3649 | Una pantalla oscura se hace redefiniendo TOKENS | el scope `.ce` |
| 3677 | Ningún `<Suspense>` grande en página pública; `loading.tsx` en lista blanca | no agregar `app/video-editor/loading.tsx` sin sumarlo al test |
| 3870 | Un control en el rincón de abajo a la derecha lleva `data-esquina-ocupada` | si la ruta conserva el chrome |
| 3999 / 4050 | Montar una pantalla adentro de un modal; `<Modal>` con `onCerrar` de identidad fija | los diálogos de exportar/proyecto |
| 4142 | El `fetch` va con `signal` | subidas/descargas largas |
| 4240 | Un eje en `hidden` convierte el otro en `auto` y rompe todo `sticky` | regla del timeline y paneles |
| 4283 | Toda migración decide su ORDEN de despliegue | la tabla de proyectos |
| 4361 | Una medida adentro de `transform: scale(k)` no es la que vas a ver | zoom del timeline y del preview: handles divididos por la escala; posiciones leídas del DOM |
| 4388 | Si se corre la vista para un panel, al cerrarlo se DEVUELVE | paneles del inspector |
| 4651 / 4687 | La cosecha y el registro de `/admin/dev` | `docs/hallazgos-video-editor.md` + bitácora |
| 5018 | Un campo nuevo en un objeto que se guarda ENTERO se busca en todos los escritores | el documento del proyecto |
| 5104 | Deshacer algo destructivo devuelve la MISMA identidad | borrar un clip/pista y deshacer |
| 5233 | Si cambia QUÉ EXISTE, se navega duro (con `conWs`) | crear/borrar proyectos |
| 5389 | En Windows todo texto entre herramientas trae `\r` | scripts que generen o lean listas |
| 6046 | Un test se prueba rompiéndolo | el resultado de la rotura en el comentario |
| 6537 | `npm test` antes del `git add` no ve los archivos nuevos | |
| 6643 / 6716 / 6769 | Un lienzo dibuja una afirmación; pointer events con tres trampas (`setPointerCapture` retargetea el `pointerup`, `overflow: hidden` no impide el scroll por código, `ResizeObserver` dispara al suscribirse); el delta del arrastre se divide por la escala | timeline y preview |
| 7267 | Una pila de deshacer se llena en el CHOKE POINT; UNA vez por gesto; el Ctrl+Z nativo del texto gana (se mira `document.activeElement`, `isContentEditable` y el `type` del input); deshacer escribe en el server; rehacer se borra al apilar; el botón apagado es obligatorio | OpenCut ya hace `blur()` del foco tipeable (`actions/use-keybindings.ts:32-39`): revisar que un campo de texto de un título no pierda su Ctrl+Z |
| 7346 | Un `useState` sembrado de props no se resiembra: `key` | inspector que cambia de clip seleccionado |

Memoria del usuario que aplica: «el texto que se DIBUJA es corto», «Copiar una app TAL CUAL»,
«Cambios impactan a clientes», «Pushear no es desplegar», «Bootear local ESCRIBE en prod».

---

## 8. Lo que ya choca en el port en curso (`app/video-editor/`, sin commitear, leído el 11/10)

- `app/video-editor/page.tsx` y `[proyecto]/page.tsx` ya aplican `requireRolWs([], { nav: 'video-editor' })`
  — pero `video-editor` **todavía no está en nav.ts** de origin/main: `tabEnCapa` sólo lo ve en capas
  con `navKeys: null`; en `pm`/`superadmin` rebota.
- **Cuatro archivos pierden el `?ws=`**: `_opencut/components/editor/editor-header.tsx:12,15`,
  `_opencut/components/editor/mobile-gate.tsx:4,8`, `_opencut/components/providers/editor-provider.tsx:6`
  («si no existe, el EditorProvider crea uno nuevo y reemplaza la URL»), `_opencut/inicio/projects-page.tsx:4,5`
  — todos importan `next/link` y/o el `useRouter` de `next/navigation`. Hay un `app/video-editor/ruta.ts`
  que lee `?ws=` de `window.location.search` (para navegar está bien; para decidir datos no).
- No hay `.css` todavía en `app/video-editor/` → nada de §3 resuelto aún.
- `package.json` no suma `tailwindcss-animate` ni `@tailwindcss/typography`.
- Se conserva `_opencut/LICENSE-OPENCUT` (MIT exige el aviso: bien).
- Tres sets de íconos nuevos (hugeicons, lucide, react-icons): la regla del tacho y la de íconos en
  desplegables (AGENTS.md:3451) piden el set de la casa (`app/_ui/iconos-menu.tsx`) donde se pueda.
  Licencia de `@hugeicons/core-free-icons`: **no verificada**.

---

## 9. Qué cosechar y dónde (para el que cierre la corrida)

- `docs/hallazgos-video-editor.md` (área = `app/video-editor`) + fila en `docs/hallazgos.md`: la
  trampa del matcher del proxy con assets y con el prefijo de la ruta; el choque de tokens y la
  receta del scope `.ce`; `dark:` sin `@custom-variant`; IndexedDB/OPFS no es por workspace;
  Freesound prohibido; el wasm ESM sin verificar en build.
- AGENTS.md (regla que gobierna código nuevo): «una copia de app basada en shadcn/Tailwind se
  scopea redefiniendo sus vars dentro de su raíz; jamás su `:root` ni su `@layer base` globales» y
  «el matcher del proxy no exime un prefijo que también es una ruta».
- `app/admin/dev/video-editor/bitacora.ts` con el pedido textual de Martín.

---

## 10. Decisiones que este relevamiento obliga a tomar (con la recomendación)

1. **¿Quién la ve al desplegar?** `completo`/`agencia` la ven solos. → Lanzar oculta (`adminOnly`
   en nav + guard de página por super admin) hasta que exporte un video de punta a punta; después
   abrirla. Decidir si entra en `pm`/`superadmin`.
2. **¿Pantalla con la barra de MaKo o sin chrome como CapCut?** → Inicio (lista de proyectos) con
   barra; el editor `/video-editor/<id>` sin chrome (`esVistaSinChrome`) con su propio «Volver» que
   conserva el `?ws=`.
3. **¿Dónde viven los proyectos?** → Local-first (IndexedDB/OPFS del motor) con namespacing por
   workspace; el documento del timeline opcionalmente en una tabla `video_proyectos` para no
   perderlo; los medios crudos NUNCA en Supabase (tope de storage no medido: 5 GiB vs 100 GB).
4. **¿Onboarding?** → Estado vacío (la tab es la herramienta), sin entrada en el catálogo, como
   `/api-mako` y el Dashboard.
5. **¿Qué se importa desde el Video Generator: el montado o las tomas + el plan?** → Ofrecer las
   tomas con el plan como timeline (editable y re-montable por el worker) y el montado como clip
   único; avisar que el montado ya trae subtítulos quemados.
6. **¿Subtítulos automáticos con qué?** → Whisper local del motor (gratis, privado, sin contrato);
   Groq sólo dentro del worker (su contrato prohíbe exponer la transcripción como servicio).
7. **¿Sonidos y música?** → Sin la API de Freesound; biblioteca vacía hasta tener licencia
   (Epidemic Connect / pack CC0 propio), con `hayMusica()` decidiendo si se dibuja.
8. **¿CSS?** → Scope `.ce` + hoja propia (molde `.gh`), nombres nuevos en el `@theme` de
   globals.css, `@custom-variant dark` hacia `.ce`, nada del `:root` ni del `@layer base` de OpenCut.
