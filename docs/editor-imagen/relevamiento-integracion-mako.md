# Cómo se enchufa un editor tipo Canva («Image Editor») en MaKo

Relevamiento SÓLO LECTURA del 14/10/2026 sobre `C:/dev/wt-canva` (rama `editor-imagen`, HEAD
`92a2be21`, árbol limpio: `git status` = 0 líneas). Next 16.2.6, React 19.2.4, Tailwind 4
(`package.json:49,53,85`). Todas las rutas son relativas al repo. AGENTS.md tiene 7925 líneas; sus
números salen de `grep -n '^# ' AGENTS.md`.

⚠️ **`main` va 17 commits adelante** (`a98ab025`, `git rev-list --count 92a2be21..main`), pero
`git diff --stat 92a2be21 main` sobre `nav.ts`, `lib/capas.ts`, `next.config.ts`, `proxy.ts`,
`app/globals.css`, `lib/api-mako/tipos.ts` y `lib/creaciones-reglas.ts` da vacío: lo que sigue vale
para los dos. Lo único citado de `main` lo marco `main:`.

Pedido (Martín, 14/10/2026): «Quiero que implementes end to end un "Canva" dentro de MaKo, tal cual,
copialo todo, tanto en diseño como funcionalidades. Revisa si hay algún repo que nos ahorre trabajo.
Dejalo en "Content Machine" en una tab que sea "Image"». Molde del método: el Video Editor
(`docs/diseno-editor-video.md`, `docs/editor-video/relevamiento-*.md`). Este documento re-verifica
contra el árbol de HOY cada punto del relevamiento del 11/10 (`docs/editor-video/relevamiento-integracion-mako.md`).

---

## 0. Lo que cambia el plan (leer primero)

1. **«Generar imagen con IA» por Google Flow NO EXISTE en el Landing Generator: no hay nada que
   llamar.** `app/landing-generator/editor/SelectorImagen.tsx:11` («Lo que NO está todavía:
   "Generar imagen con IA"»), bitácora en `cola` (`app/admin/dev/landing-generator/bitacora.ts:28`).
   El bloqueo está medido (`docs/hallazgos-editor-landing.md:321-330`): el Flow nuevo sólo deja
   cambiar el TEXTO; proporción, modelo y foto de referencia salen de la imagen que el cliente le
   enseñó a la extensión **con su cara**, y la extensión sólo queda lista si aprendió video E
   imagen. Hace falta parchear la extensión, y el 14/10 Martín dijo **«Ahora no, más tarde»**
   (`main:docs/relevo/landing-generator.md:61-62`). Lo que el Landing sí hace es: la IA propone una
   búsqueda y el server la resuelve con fotos libres (`docs/diseno-editor-landing.md:149`).
2. **Lo que SÍ existe y se reusa entero es la tubería de imágenes del Landing**
   (`lib/imagenes-stock.ts` + `app/api/landing-generator/imagenes/route.ts`): subida firmada con
   progreso real, verificación por magic bytes, fotos libres Openverse (sólo CC0 y dominio público) +
   Picsum, «Desde un enlace» con baranda anti-SSRF, biblioteca por workspace, y bucket público con
   CORS. Ver §5 y §7.
3. **Una foto de afuera NO se puede dibujar en el lienzo: hay que copiarla antes al bucket.**
   Openverse «NO manda CORS» (`lib/imagenes-stock.ts:209`) y Picsum tampoco
   (`app/api/portadas/route.ts:6-9`, medido el 27/09). Un `<img>` la muestra, pero un `<canvas>` que
   la dibuja queda «sucio» y el export a PNG/PDF falla. Supabase Storage público sí contesta
   `Access-Control-Allow-Origin: *` (`lib/editor-landing/exportar-png.ts:17-18`;
   `app/video-editor/desde/ImportarDesde.tsx:19-22`, medido con curl el 11/10). La regla de la casa
   ya es «SE GUARDA NUESTRA COPIA» (`lib/imagenes-stock.ts:17-19`). La CSP no frena nada (§4).
4. **La capa `superadmin` NO restringe ninguna tab, y dos textos del repo dicen lo contrario.**
   `tabEnCapa` une los dos menús (`lib/capas.ts:363-365`) y `superadmin` tiene `userNavKeys: null`
   (`lib/capas.ts:289`), así que contesta `true` a CUALQUIER key. Lo documentan
   `tests/curso-admin.test.ts:274-277` y `docs/hallazgos-customer-success.md:3755-3758`. Lo
   contradicen el comentario de `lib/capas.ts:283-286` y la regla de `AGENTS.md:7862-7867`
   («una tab que no se suma ahí no aparece para el super admin»): **es el diagnóstico obvio y está
   mal.** Sumar `'image-editor'` a esa lista no cambia nada. Ver §1.
5. **Hoy la tab «Image» la ve sólo Martín en SU barra, y lo lleva a /carousels. Mirando un cliente
   con `?ws=` no la ve nadie.** Las tres secciones son `adminOnly` (`app/_components/nav.ts:305-307`),
   y `adminOnly` exige `adminShell`, que es `rol === 'admin' && !impersonando`
   (`app/_components/Sidebar.tsx:432`; `SeccionesTab.tsx:43`). Con `?ws=`, `estaImpersonando()` da
   `true` (`lib/workspace.ts:364`). El comentario de `Sidebar.tsx:438-439` («también mirando un
   cliente con `?ws=`») quedó viejo. La tab lleva a la primera sección visible que no sea «pronto»
   (`lib/nav-visibilidad.ts:46-52`): hoy, Carousels.
6. **`adminOnly` es cosmético: `/carousels` abre hoy por URL a cualquier admin de un cliente
   `completo` o `agencia`** (`app/carousels/page.tsx:19` sólo hace `requireRolWs`). Para que el
   editor sea de verdad del super admin («Image sólo del super admin», `nav.ts:284-285`), la page
   necesita el guard por PERSONA. El molde es la primera versión de `app/video-editor/acceso.ts`
   (commit `b112e5b7`, 11/10): `getSesionAdmin()` antes de `requireRolWs`. El mismo candado va en
   cada ruta `/api/image-editor/*` (molde: `tests/video-editor-integracion.test.ts:192-201`).
7. **Guardar: el repo empuja a Supabase, no a «local-first» como el Video Editor.** Hay cuatro
   motivos, cada uno con su fuente. (a) La regla «el estado del producto va a Supabase, no a
   localStorage» (`docs/hallazgos-infra.md:377-382`). (b) Publicar un diseño como Estrella exige que
   `exportar()` lea la definición DE LA BASE: «ningún camino publica un JSON que mande el pedido»
   (`AGENTS.md:2244-2246`). (c) La API de MaKo no puede listar ni crear lo que vive en un
   navegador. (d) El motivo del Video Editor (medios de cientos de MB) no aplica: un diseño es un
   JSON chico más URLs. Molde: `landing_docs` + bucket `landing-imagenes` (mig 0246). Ver §5.7.
8. **La excepción de frontera `'use client'` está atada al Video Editor por un test.** Un motor
   portado sin directivas dentro de `app/image-editor/` necesita entrar en `CLIENTE_POR_FRONTERA`
   (`tests/frontera-use-client.test.ts:78`). Pero `tests/video-editor-integracion.test.ts:163-165`
   falla si una carpeta exenta no empieza con `app/video-editor/`. Hay que generalizar ese guard
   (que vigile la puerta de cada carpeta), no esquivarlo.
9. **El CSS del Video Editor ya dejó resuelta la mitad del choque de tokens, y dos trampas nuevas.**
   `capcut-theme.css` sumó al `@theme` los nombres de shadcn (`--color-background` →
   `var(--background)`…, `app/video-editor/capcut-theme.css:27-49`). Un port shadcn dentro de `.cv`
   los hereda gratis con sólo definir los vars en `.cv`. Las dos trampas:
   - `@custom-variant dark` quedó atado a `.ce` (`capcut-theme.css:25`), así que **ningún `dark:`
     se prende en `.cv`**;
   - `scrollbar-hidden` pinta `var(--cc-scroll, #404040)` (`capcut-theme.css:74-89`): una barra gris
     oscura sobre la interfaz clara de Canva, salvo que `.cv` defina `--cc-scroll`.

   Canva es claro, así que no hacen falta `TemaOscuro` ni `TemaOscuroScript`.
10. **No hay ninguna librería de lienzo instalada.** No están `fabric`, `konva`, `react-konva`,
    `jspdf`, `pdf-lib`, `html2canvas` ni `polotno` (medido en `node_modules`). Sí están
    `html-to-image` 1.11.13, `jszip`, `pptxgenjs` 4.0.1, `gifenc`, `culori`, `radix-ui`, `zustand`,
    `@mediapipe/tasks-vision` y `@huggingface/transformers` (§11). Elegir el motor es la decisión
    técnica grande, y `docs/editor-imagen/repos/` hoy está vacío.
11. **El «quitar fondo» del Video Editor recorta PERSONAS**: usa el modelo `selfie_segmenter`
    («El segmentador de personas», `app/video-editor/_opencut/fondo/segmentador.ts:2,34-37`). No
    sirve para la foto de un producto. `@mediapipe/tasks-vision` 1.1.0 trae además
    `InteractiveSegmenter` (se toca el objeto con un clic; está en `vision.d.ts`). La licencia de
    su modelo no la verifiqué.
12. **Un `.wasm` no lo frena la CSP: lo rompe el cargador de Turbopack en Vercel (404).** Pasó en
    producción el 12/10 (`tests/video-editor-wasm.test.ts:4-8`). Todo `.wasm` del editor se sirve
    desde `public/` con un prefijo exento del proxy (molde `public/ve/wasm/`).
13. **Número de migración: el 0275 ya está tomado** en `C:/dev/wt-chats` (`0275_chats.sql`). Medido
    recorriendo `git worktree list` el 14/10; el siguiente libre es el **0276**. Se re-mide antes de
    nombrar (`AGENTS.md:541-551`).

---

## 1. La tab «Image» de Content Machine

### 1.1 Cómo está hoy

| Qué | Dónde |
|---|---|
| Familia `content` («Content Machine»), con un solo bloque de tres tabs unificadas: Video, Image, Copywriting | `app/_components/nav.ts:269-325` |
| El porqué, textual de Martín (12/10): «Que sean 3 tabs funcionales que todo mundo reconoce y MaKo le agrega generación con IA». También: «Image, que hoy es todo `adminOnly`, sólo el super admin» | `nav.ts:276-285` |
| **Video**: `href: '/video-editor'`; el Editor es la PRIMERA sección, con `seccion: 'Editor'` y sin `adminOnly` (abierto el 12/10, `nav.ts:294-296`); le siguen Video Generator («Crear con IA») y Reels (`adminOnly`) | `nav.ts:290-300` |
| **Image**: `href: '/image-generator'`, `icon: 'imagegen'`, y un `match` para `/image-generator`, `/thumbnails` y `/carousels`. Sus secciones: Image Generator (`adminOnly`, `seccion: 'Crear con IA'`, `comingSoon`), Thumbnails (`adminOnly`, `comingSoon`) y Carousels (`adminOnly`, construida) | `nav.ts:301-309` |
| Una tab unificada no figura como ítem: `itemsDe()` la abre en sus secciones (títulos, capas, tests y el mapa de /admin/dev ven las keys de siempre) | `nav.ts:135-136` |
| La key es CONTRATO con la base (capas y estado del onboarding): se elige una vez | `nav.ts:36-39` |
| Quién ve un ítem: `adminOnly` (sólo `adminShell`) Y el rol (closer/setter sólo lo anotado) Y la capa (`tabEnCapa`) | `lib/nav-visibilidad.ts:29-34` |
| La tab se dibuja si hay alguna sección visible, y lleva a la primera visible que NO sea «pronto» (pisa el `href` propio de la tab) | `lib/nav-visibilidad.ts:46-52` |
| La barra de secciones se dibuja sólo con más de una sección visible y muestra `seccion ?? label`. Mientras está, deja su alto en `--alto-secciones` | `app/_components/SeccionesTab.tsx:63-72,97,16-17` |
| El título de la pestaña del navegador sale solo de nav.ts | `lib/titulo-tab.ts:8-13` |

### 1.2 Lo que hay que cambiar para sumar «Image Editor»

En `nav.ts:301-309`:

```ts
{
  key: 'image', label: 'Image', href: '/image-editor', icon: 'imagegen',
  match: (p) => starts('/image-editor')(p) || starts('/image-generator')(p) || starts('/thumbnails')(p) || starts('/carousels')(p),
  secciones: [
    { key: 'image-editor', adminOnly: true, label: 'Image Editor', seccion: 'Editor', href: '/image-editor', icon: '<ícono>', match: starts('/image-editor') },
    // … las tres de hoy, sin tocar
  ],
},
```

- **Primera sección y sin `comingSoon`**: con eso `resolverTab` manda la tab a `/image-editor` sin
  depender del `href` (`nav-visibilidad.ts:50-51`). El `href` de la tab se cambia igual, para que el
  dato no mienta.
- **`seccion: 'Editor'`**, igual que Video (`nav.ts:296`). Las otras dos sin `seccion` muestran su
  `label`.
- **Ícono**: tiene que existir en `app/_components/icons.tsx`; si no, dibuja un punto. La lista es
  `NOMBRES_ICONO = Object.keys(PATHS)` (`icons.tsx:288`). Sirven `pen` (l.83), `notepencil` (l.88),
  `creativos` (l.155) e `imagegen` (l.221); uno nuevo se agrega ahí, nunca el logo de Canva.
- **`adminOnly: true`** mientras valga la decisión del 12/10. Con eso Martín lo ve en su barra sin
  `?ws=`. **Mirando un cliente con `?ws=` NO lo ve** (§0.5): para probarlo en ws3 tiene que teclear
  `/image-editor?ws=3`, que entra si el guard lo deja (§1.3).
- **`lib/capas.ts`**:
  - `completo` (l.186) y `agencia` (l.254) tienen `navKeys: null`: la ven apenas se saque `adminOnly`;
  - `pm` (l.167) no;
  - `superadmin` la ve igual, por `userNavKeys: null` (§0.4).

  AGENTS.md:7862 pide escribir la decisión. Sumarla a la lista de `superadmin` (l.288) sirve como
  registro y no restringe nada. **Y corregir el comentario de l.283-286 y la regla de AGENTS.md:7862**
  (ver §12).
- **`lib/tab-access.ts`**: `requireRolWs([], { nav: 'image-editor' })` (l.106-114) ya hace sesión
  contra la base, rol (`[]` = admin-cliente y agencia, l.102-104), capa y onboarding. No alcanza
  para «sólo el super admin» (§1.3).

### 1.3 «Sólo el super admin» de verdad

`adminOnly` sólo esconde el link (`lib/nav-visibilidad.ts:10-11`: «Es COSMÉTICA»). El molde exacto
es la primera versión de `app/video-editor/acceso.ts` (`git show b112e5b7:app/video-editor/acceso.ts`):

- `veEditor…()` = `(await getSesionAdmin()) != null` (`lib/auth.ts:76`). La pregunta es por la
  PERSONA, a propósito: el super admin prueba ADENTRO de ws3 con `?ws=`.
- `requireEditor…()` = `requireSesion()` → si no es super admin, `redirect(await rutaConWs(homeDeCapa(...)))`
  → recién ahí `requireRolWs([], { nav })`. El orden importa: si no, un admin-cliente con el
  onboarding a medias rebota al wizard en vez de a su casa.
- Cada `route.ts` de `/api/image-editor/*` hace la misma pregunta y contesta 404 a quien no le toca.
  El test que lo fija es `tests/video-editor-integracion.test.ts:192-201`.
- El día que se abre (como el Video Editor el 12/10, commit `63bb0e63`), `acceso.ts` pasa a
  rol + capa (`app/video-editor/acceso.ts:24-32` de hoy) y se saca `adminOnly`.

### 1.4 Los tests que leen nav/capas, frente a una key nueva

Ninguno falla por sumar una key. Son éstos:

| Test | Qué mira | Pega en el editor |
|---|---|---|
| `tests/video-editor-integracion.test.ts:57-91` | la key `video-editor`, su `href`, que no lleve `adminOnly`, y que el guard de las pages use la key exacta | **molde a copiar** como `image-editor-integracion` (con `adminOnly` presente mientras sea del super admin) |
| `tests/comunidad-nav.test.ts` (ítem `cs-comunidad`) | que el ícono esté en `NOMBRES_ICONO` y que el `match` no prenda otras tabs | molde del chequeo de ícono y de `match` |
| `tests/movil-rutas.test.ts` | que cada `navKey` del teléfono exista en nav.ts | nada, salvo que el editor tenga versión /m |
| `tests/analisis-mudada.test.ts:128-130`, `tests/tabs-retiradas.test.ts:61` | el título y el destino salen del PRIMER ítem que matchea | el `match` de `image-editor` no puede tapar otra ruta |
| `tests/sin-instagram.test.ts:146` | ningún `href` de la barra apunta a lo retirado | nada |
| `tests/dev-areas.test.ts:123` | un área con bitácora tiene su fila `dev-…` en el sidebar de admin | sí, si se escribe bitácora (§2) |
| `tests/curso-admin.test.ts:274-282` | la paridad entre la barra y la página por capa | documenta el `userNavKeys: null` de §0.4 |

---

## 2. El checklist de una tab nueva, y qué se copia del Video Editor

### 2.1 Lo que hizo el Video Editor para integrarse

| Pieza | Dónde | Para `app/image-editor/` (scope `.cv`) |
|---|---|---|
| `acceso.ts`: UNA pregunta de acceso para las pages, la API y los botones de otras tabs | `app/video-editor/acceso.ts:1-32` (hoy rol + capa; el 11/10, `getSesionAdmin`) | **Se copia**, en su versión del 11/10 mientras Image sea sólo del super admin (§1.3) |
| `page.tsx`: guard → `getWorkspaceActual()` → `<Pagina ancho="completo" densidad="compacta" style={{ padding: 0, height: 'calc(100vh - var(--alto-secciones, 0px))', display: 'flex', flexDirection: 'column' }}>` | `app/video-editor/page.tsx:23-33`; `export const dynamic = 'force-dynamic'; revalidate = 0` en l.20-21 | **Se copia tal cual**, SIN `TemaOscuroScript` (Canva es claro). `[proyecto]/page.tsx` pasa a ser `[diseno]/page.tsx` |
| Onboarding = el estado vacío, sin entrada en el catálogo | `app/video-editor/page.tsx:10-12`; `app/api-mako/page.tsx:14` | **Se copia**: el inicio de Canva («Crear un diseño» y las plantillas) es ese estado. Ojo: choca con la regla «toda tab tiene onboarding» (memoria, 01/08); el precedente del 05/10 la exceptúa cuando «la tab ES la herramienta» |
| `VideoEditorCliente.tsx`: cliente, con el motor por `dynamic(() => import(...), { ssr: false })`; raíz `<div className="ce">` con `#ce-portal` adentro | `VideoEditorCliente.tsx:22,31,35,52,62` | **Se copia** si el motor toca `window`, `canvas` o `document` al importarse (Konva y Fabric lo hacen): raíz `.cv` y su `#cv-portal` |
| `portal.ts`: todo portal de radix se monta ADENTRO de la raíz con tema | `app/video-editor/portal.ts:12-17`; AGENTS.md:7847-7854 | **Se copia** (`portalCv()`), salvo que el editor no use radix |
| `espacio.ts`: el prefijo `mako-ws<N>-` en toda base del navegador, leído en CADA apertura | `app/video-editor/espacio.ts:20-30`; AGENTS.md:7833-7845 | **Sólo si** algo con datos de un cliente vive en IndexedDB, OPFS o localStorage (recientes, borradores). Con Supabase (§5) queda para las preferencias, y llevan el ws en la clave igual |
| `ruta.ts`: `rutaEditor(href)` agrega `?ws=` a la navegación que el motor hace desde managers fuera de React | `app/video-editor/ruta.ts:12-19` | **Sólo si** el motor navega solo; si no, alcanza `Link`/`useRouter` de `@/app/_ui/Link` |
| `capcut-theme.css`: tokens scopeados a `.ce`, nombres nuevos en `@theme`, el `@layer base` scopeado y `dark:` atado a `.ce`; lo importa `globals.css` | `capcut-theme.css:1-205`; `app/globals.css:17-21` | **Se replica** como `app/image-editor/canva-theme.css`, importado al lado de la l.20 (las directivas `@theme`/`@utility` sólo valen dentro de la entrada de Tailwind, `capcut-theme.css:22-23`). Detalle en §2.3 |
| Assets estáticos en `public/ve/` (atlas de fuentes `.json` + 15 `.avif`, formas `.svg`, `.wasm`, `.tflite`), exentos del proxy POR RUTA, porque sin sesión vuelve un 307 a `/login` | `proxy.ts:384-386,407`; AGENTS.md:7869-7876 | **Se REUSA `/ve/`** para el atlas de 1920 fuentes y las formas. Un asset propio `.json`, `.avif`, `.wasm`, `.onnx` o `.tflite` va bajo un prefijo nuevo (`cv/`) agregado al matcher, con su `assert` en `tests/redirects-gate.test.ts:98-106`. Nunca `image-editor/`: sacaría a la PÁGINA del proxy, que es el único que valida el `?ws=` (`proxy.ts:385-386`). `png/jpg/svg/webp/gif/css/js/woff2` ya están exentos por extensión (`proxy.ts:407`) |
| La barra lateral NO desaparece mientras se edita (Martín, 12/10, validado el 13/10) | `app/_components/PublicRouteGate.tsx:60-64`; `tests/video-editor-sidebar.test.ts:4-8` | **El mismo criterio**, salvo que Martín diga otra cosa: nada en `esVistaSinChrome` |
| `desde/` (`?desde=<ref>`, la URL la deriva el server) | `app/video-editor/desde/*`; `tests/video-editor-integracion.test.ts:93-133` | **Molde** de «Abrir en el editor» desde Carousels (§8) |
| `tests/video-editor-integracion.test.ts`: acceso, ref, `?ws=` en TODO el árbol del editor, la puerta única del motor y la API | 201 líneas | **Se copia** como `tests/image-editor-integracion.test.ts` |
| Registro de `/admin/dev` | `app/admin/dev/areas.ts:735-745`; `app/admin/dev/video-editor/bitacora.ts`; `app/admin/dev/registros.ts:60,114`; la fila `dev-video-editor` en `nav.ts:580-581` | **Se copia**: el área `image-editor` (familia «Content Machine»), con `vive` SIN nav.ts ni globals.css (desplazan el Change History, `areas.ts:738-741`); la bitácora con el pedido literal (AGENTS.md:4911-4930); su import y la fila `dev-image-editor`. Después, `node scripts/gen-dev-historial.mjs` |
| Hallazgos y relevo | `docs/hallazgos-video-editor.md` + su fila en `docs/hallazgos.md:28`; `docs/relevo/video-editor.md` | `docs/hallazgos-image-editor.md` (el área es donde vive el código) + su fila en el índice, **en el mismo commit**; `docs/relevo/image-editor.md` |

### 2.2 El resto del checklist

1. **Proyecto del tablero**: hoy existe `Image Generator` (`lib/plan-proyectos-catalogo.ts:112`) y
   no hay «Image Editor». `tests/dev-areas.test.ts:157-169` sólo exige el prefijo `Feature: `.
2. **`docs/dev-tabs-mapa.md`** es un relevamiento del 08/08 (`dev-tabs-mapa.md:3`) y
   **`docs/mapa-del-proyecto.md:65`** todavía dice que «Content Machine» es el label de una tab. Los
   dos están viejos y el Video Editor no tocó ninguno (`git grep video-editor`): son opcionales.
3. **Rutas públicas**: nada, salvo que se copie «Compartir → ver sólo con el enlace» de Canva. Esa
   ruta se autentica sola (token), así que va en `PUBLICOS` de `lib/rutas-publicas.ts`
   (AGENTS.md:3929-3940), como `/l/vista/<token>` del Landing.
4. **Móvil**: `rutaMovil('/image-editor')` devuelve `null` (`lib/movil-rutas.ts:262`): no hay
   pantalla /m. Qué sirve el proxy en un teléfono no lo medí.
5. **La esquina de abajo a la derecha**: Canva pone ahí el zoom y las páginas. Todo control pegado a
   ese rincón lleva `data-esquina-ocupada`; si no, la esquina de avisos lo tapa
   (AGENTS.md:4073-4085).
6. **Tests después del `git add`**: los guards barren el ÍNDICE (AGENTS.md:6761).

### 2.3 El CSS con scope `.cv` (lo que ya existe y lo que falta)

- **Ya están en el `@theme`, apuntando a vars que afuera de `.ce` no existen**:
  `--color-background, -foreground, -card(-foreground), -popover(-hover/-foreground),
  -primary-foreground, -secondary(-border/-foreground), -muted(-foreground), -accent-foreground,
  -destructive(-foreground), -constructive, -caution, -input, -ring` (`capcut-theme.css:27-49`). Un
  port shadcn en `.cv` sólo tiene que DEFINIR esos vars dentro de `.cv`, como `.ce` en l.137-161.
- **Los tres nombres que chocan siguen chocando**: `--primary`, `--border` y `--accent` existen en el
  `@theme` de MaKo apuntando a sus vars (relevamiento del 11/10, §3.2). Se redefinen DENTRO de `.cv`,
  igual que `.ce` (l.144, 151, 159). Lo mismo con los tokens de MaKo que pisan los primitives y las
  barras de scroll globales: `--bg --surface --surface-2 --ink --dim --faint --border-strong
  --on-primary --focus-ring` (l.163-172).
- **La escala de texto** `--text-xs/sm/base` va por `var(--ce-text-*, <default de Tailwind>)`
  (l.55-57). Adentro de `.cv` queda el valor de Tailwind, salvo que `.cv` defina `--ce-text-*`. El
  nombre es del Video Editor: si Canva necesita otra escala, conviene renombrar a un var neutro.
- **`dark:`**: atado a `.ce` (l.25). Si el port usa `dark:`, se amplía ESA línea
  (`(&:where(.ce, .ce *, .cv-oscuro, .cv-oscuro *))`); no se escribe una segunda declaración. Si dos
  `@custom-variant dark` conviven no lo medí.
- **`scrollbar-hidden`/`-x`/`-y`/`scrollbar-thin`** dibujan la barra fina con
  `var(--cc-scroll, #404040)` (l.74-89): `.cv` define `--cc-scroll` con su gris claro. Esconder la
  barra está prohibido (AGENTS.md:3674, regla 4).
- **`tw-animate-css`** ya está importado globalmente (`globals.css:21`): `animate-in`, `fade-in-0` y
  compañía funcionan.
- **El `@layer base` del port** (bordes y `body`) va scopeado (`.cv *, .cv ::before, .cv ::after`,
  molde l.195-199). El `:root` del port nunca.
- **Prefijo libre**: `git grep` de `.cv` y `--cv-` en `*.css/*.ts/*.tsx` = 0 aciertos.
- **Fuente de la interfaz**: la de Canva (Canva Sans) no se copia; va Geist, como en `.ce`
  (l.17-20, 180).

---

## 3. Los tests que barren el árbol entero y que un editor nuevo va a pisar

Corren con `npm test` (`node --import tsx --test tests/*.test.ts`, 848 archivos en `tests/`). **El
pre-push NO los corre** (`scripts/hooks-en-orden.sh:13`). Los que leen `git ls-files` no ven un
archivo hasta el `git add` (AGENTS.md:6761).

| Test | La regla | Alcance | Cómo se cumple o se exime |
|---|---|---|---|
| `tests/puente-panel-copy.test.ts:651-678` | Nada de voseo en el texto que se DIBUJA (las formas se generan de los infinitivos, no de una lista) | `git ls-files app lib components` (l.528-532), más de 500 archivos | El copy en «tú». Las excepciones van en `FUERA_DE_ALCANCE`, con su porqué, y un test cuida que sigan existiendo (l.714). Los rótulos de Canva en español ya vienen en «tú»; los comentarios del port pueden seguir en rioplatense |
| `tests/puente-panel-copy.test.ts:746-775` | Todo `var(--fs-*)` existe en `globals.css` | `git grep` sobre app y lib | Usar los 7 `--fs-*` que hay o la escala propia de `.cv` |
| `tests/borrar-tacho-casa.test.ts` | Borrar es UN tacho rojo: ni 🗑, ni un trazo de tacho dibujado a mano (tapa de 10 a 19 + manija), ni los nombres `IconTrash`, `I_BORRAR`, `IconoTachoFila`, `IconoPapelera`, `basura:` | `git ls-files app lib components`, sin comentarios | `BotonBorrar`/`IconoBorrar` (`app/_ui/BotonBorrar.tsx`), `icono: 'borrar'` o `Icon name="trash"` (AGENTS.md:3654-3666). El tacho de Canva no se copia |
| `tests/frontera-use-client.test.ts` | Un módulo de server no importa un VALOR (no PascalCase) de un `'use client'` | `git ls-files` (l.56-61) | El motor entra por UN componente cliente. Si el port no lleva directivas, va a `CLIENTE_POR_FRONTERA` (l.78) **y hay que generalizar** `video-editor-integracion.test.ts:154-190` (§0.8) |
| `tests/campana-producto.test.ts:194-208` | Un archivo `'use server'` sólo exporta funciones async (y tipos) | `app` + `lib` del disco | Las constantes y tipos del editor, en módulos de datos (AGENTS.md:349) |
| `tests/confirm-encima-de-modales.test.ts:40-75` | Ningún overlay `position:'fixed'` + `inset:0` con `zIndex >= Z_CONFIRM` | todo `app/` del disco | `Z_CONFIRM = 3500` (`app/_ui/Confirm.tsx:50`): los modales del editor van por debajo |
| `tests/layout-sin-suspense.test.ts:72-90` | Un `loading.tsx` sólo si está en `LOADING_PERMITIDOS` | `app/` | No agregar `app/image-editor/loading.tsx` sin sumarlo |
| `tests/catalogo-fuera-del-bundle.test.ts`, `tests/sin-datos-del-dueno-en-bundle.test.ts` | Un `'use client'` no trae el catálogo de credenciales ni datos de una persona | `app` + `lib` | Lo del negocio llega del server, por props (AGENTS.md:2093) |
| `tests/veto-claude.test.ts:139-150` | El `fetch` a Anthropic vive en un solo archivo; toda feature de IA está en el catálogo | `app` + `lib` | La IA del editor («Escribir con IA», textos) va por `chatClaude(..., { feature })` con un `def` gratis (AGENTS.md:3392-3460) |
| `tests/sin-instagram.test.ts`, `sin-clarity`, `sin-whop`, `sin-chatwoot` | Nada vuelve a cablear lo retirado | repo | Canva publica directo en Instagram: **no se copia** (la tab salió el 06/10; IG volvió sólo como canal de Automations) |
| `tests/tabs-retiradas.test.ts` | Ningún link a una ruta retirada | `git ls-files` | Nada |
| `tests/link-con-workspace.test.ts` | Un link que se MANDA afuera lleva el `?ws=` (`linkApp`) | repo | Sólo si el editor manda avisos o mails con links |
| `tests/redirects-gate.test.ts:98-106` | El matcher real del proxy: `/ve/...` exento y la PÁGINA del editor no | `proxy.ts` | Si se suma `cv/`, se suma su `assert` |
| `tests/pantalla-links-ws.test.ts:36-51` | Lista A MANO de pantallas sin `next/link` ni router de Next | 11 archivos | El editor lleva su propio barrido (molde `video-editor-integracion.test.ts:135-152`), más los botones que lo abren desde otras tabs en esta lista |
| `tests/dev-areas.test.ts:35,98,123,157` | Cada ruta de `vive` existe; el doc de hallazgos existe; bitácora ⇒ fila en el sidebar; el prefijo del proyecto | `app/admin/dev` | §2.1 |
| `tests/tenant-tables-contract.test.ts` | Toda tabla de `TENANT_TABLES` tiene `workspace_id` en alguna migración | migraciones + `lib/workspace.ts` | La tabla de diseños (§5) |
| `tests/funnel-declarado.test.ts` | Una VISTA lleva `security_invoker` + `revoke` | migraciones | Sólo si hay vista |
| `tests/api-mako-registro.test.ts` + `tests/api-mako-http.snapshot.txt` | Paridad def ↔ run, ids únicos, `rolMinimo`, lo que sale por HTTP | `lib/api-mako` | §6 |
| `tests/creaciones.test.ts` | Cada tipo está en `ENCHUFADOS` o en `POR_ENCHUFAR`, nunca en los dos | `lib/creaciones-*` | Si se enchufa `formato_imagen` (§7.4) |

**Lo que NO tiene guard de árbol entero** (medido):

- **Hex sueltos.** Los guards de color son POR ARCHIVO (`dashboard-pantalla.test.ts:358-373`,
  `movil-shell.test.ts:102`, `recorrido.test.ts:367`, `vista-adjuntos.test.ts:234`,
  `cs-kanban-fases.test.ts:771`). La paleta de Canva en hex dentro de `.cv` es válida; el molde es
  `capcut-theme.css:93-134`.
- **El largo de los textos.** La regla de AGENTS.md:1258 (toast de 3-4 palabras, rótulo de 1-3,
  estado vacío de una frase) no tiene barrido global: la cumple quien escribe.

**El pre-push** (no son tests):

- el typecheck del árbol ENTERO (AGENTS.md:98-125; necesita RAM, AGENTS.md:330);
- `scripts/hooks-en-orden.sh`: rules-of-hooks sobre los `.tsx` que cambian. Un hook condicional del
  port bloquea el push;
- `generar-api-doc --check` y `generar-plugin --check` (AGENTS.md:188-212).

---

## 4. CSP y cabeceras hoy (`next.config.ts`)

Hay cuatro bloques de `headers()`:

- **Global** `/:path*` (`next.config.ts:132-145`): `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y una CSP
  mínima: **`frame-ancestors 'none'; object-src 'none'; base-uri 'self'`** (l.142). Su comentario lo
  dice: «Sin default-src: no restringe script/img/etc.».
- **HSTS**, sólo en los hosts de MaKo (l.153-158).
- **`/l/html/:path*`** y el diagnóstico de landings, con `CABECERAS_HTML_LIBRE` (l.168-169).
- **`/sw.js`**, con su CSP propia (l.176-183).

No hay COOP ni COEP: `git grep` en app, lib, `proxy.ts`, `next.config.ts` y `vercel.json` = 0.

| Recurso | ¿Lo bloquea la CSP? | Lo que sí lo limita |
|---|---|---|
| Google Fonts (`fonts.googleapis.com/css2` + `fonts.gstatic.com`) | **No**: no hay `style-src` ni `font-src` | Nada: el layout ya carga Geist de ahí (`app/layout.tsx:130-135`) y el Video Editor pide cada familia al vuelo (`_opencut/fonts/google-fonts.ts:4,55-79`). Para dibujar en canvas hay que esperar `document.fonts.load()` (ya lo hace `google-fonts.ts:73-77`). `html-to-image` necesita las fuentes incrustadas una vez (`exportar-png.ts:14-16`) |
| Fotos de APIs (Openverse, Pexels, Unsplash, Pixabay) | **No**: no hay `img-src` ni `connect-src` | **CORS y keys.** Openverse y Picsum no mandan CORS (§0.3), así que van por el server y se copian. Unsplash, Pexels y Pixabay piden key; la casa eligió no depender de una (`portadas/route.ts:13-17`: «una feature que necesita una variable de entorno nace apagada»). Sus términos (hotlink de Unsplash, descarga obligada de Pixabay) y su CORS **no los medí**. Openverse figura como «licencia NO VERIFICADA» para anuncios (`imagenes-stock.ts:211-213`) |
| `blob:` y `data:` | **No** (no hay `img-src`, `media-src` ni `worker-src`) | Sólo la página PÚBLICA de una landing tiene CSP propia (`lib/editor-landing/pagina-publica.ts:444-445`): si un diseño se incrusta en una landing publicada, va como URL del bucket, nunca `blob:` |
| Web Workers | **No** (no hay `script-src` ni `worker-src`) | El parche del `?ws=` sólo cubre `window.fetch` (`app/_components/WsFetch.tsx:51-55`): un worker que llama a `/api` pierde la pestaña |
| WebAssembly | **No** (sin `script-src` no hace falta `'wasm-unsafe-eval'`) | El cargador de wasm de Turbopack pide un nombre con el `?dpl=` de Vercel adentro → **404 en producción** (`tests/video-editor-wasm.test.ts:4-8`). Se carga a mano desde `public/` (molde `public/ve/wasm/opencut-wasm-0.2.10.wasm`) |
| Modelos de transformers.js / MediaPipe desde un CDN | **No** | MediaPipe baja su wasm de jsdelivr con la versión FIJA (`segmentador.ts:32-33`) y el modelo de `/ve/modelos` o de `storage.googleapis.com` (l.34-37). transformers.js corre con sus hosts por default (`_opencut/services/transcription/worker.ts:23` no toca `env`). **Sin COOP/COEP no hay `SharedArrayBuffer`**: onnxruntime corre en un solo hilo |
| iframes de MaKo dentro de MaKo | **Sí**: `X-Frame-Options: DENY` + `frame-ancestors 'none'` también cortan al mismo origen | Sólo `/l/html` y el diagnóstico se exceptúan (l.160-169). El PDF del Landing usa un iframe con el documento escrito adentro (`lib/editor-landing/exportar-pdf.ts:28-40`), que no carga una URL de MaKo |

⚠️ **No agregar COEP global** (lo dice el relevamiento del 11/10, §2.1): rompe todo recurso cruzado
sin CORP.

---

## 5. GUARDAR

### 5.1 Dónde guardan hoy los otros editores

| Editor | Documento | Imágenes | Fuente |
|---|---|---|---|
| **Landing Generator (Gamma)** | Tabla `landing_docs`: `contenido jsonb` (ProseMirror saneado), `config jsonb`, `version` para compare-and-set, `publicado` como foto, `slug`, `vista_token`; además `landing_doc_versiones` y `landing_doc_comentarios` | Bucket PÚBLICO `landing-imagenes`, 100 MiB, MIME en lista; rutas `<ws>/<uuid>.<ext>` | `supabase/migrations/0246_editor_landing.sql:27-60,140-163` |
| — cómo guarda | Una RUTA y no server actions: el autoguardado encola actions y una action topea en 1 MB (`app/api/landing-generator/route.ts:9-11`). Guardado parcial y compare-and-set (`lib/editor-landing/server.ts:358-405`); 409 con «Hay una versión más nueva». Tope 1,5 MB (`lib/editor-landing/doc.ts:313`, `validar.ts:631-640`) | | |
| **Video Editor (CapCut)** | IndexedDB + OPFS del navegador, con prefijo por workspace | Locales hasta exportar | `app/video-editor/espacio.ts`; AGENTS.md:7833 |
| **Dashboard (Looker)** | `app_settings`, clave `graficos.tablero.<sub>`, por persona Y workspace | Bucket público `portadas`, `ws<N>/dashboard/…`, por multipart de hasta 4 MB | `lib/graficos-tablero.ts:2-10,48`; `app/api/graficos/imagen/route.ts:1-35` |
| **Automations (lienzo)** | `nutricion_secuencias.pasos` / `.posiciones` (jsonb) | — | relevamiento del 11/10, §4.2 |
| **Creaciones (Estrellas)** | `creaciones.definicion jsonb` de hasta 400 KB, de TODOS los negocios (`workspace_origen`, no `workspace_id`) | — | `0273_creaciones.sql:20-23`; `lib/creaciones-reglas.ts:57` |

### 5.2 Los buckets que existen

| Bucket | Público | Tope | Dónde nace | En `BUCKETS` del reset |
|---|---|---|---|---|
| `landing-imagenes` | **sí** | 100 MiB, MIME en lista | `0246:154-163` | sí |
| `portadas` | **sí** | sin tope en el bucket (la ruta: 6 MB y 4 MB) | **en código**, `createBucket` (`app/api/portadas/route.ts:130`, `graficos/imagen/route.ts:86`, `lib/imagenes-stock.ts:506`) | **no**, y además usa `ws<N>/` (`graficos/imagen/route.ts:21-24`) |
| `avatars` | **sí** | — | en código (`app/api/perfil/avatar/route.ts:47`) | no |
| `video-clips` | **sí** | 100 MB (relevamiento del 11/10) | fuera de migraciones | sí |
| `ads-creatives` | no | — | en código (`app/api/ads-manager/creative-signurl/route.ts:38`) | sí |
| `branding` | no | 200 MiB | `0098` | sí |
| `curso-videos` | no | 2 GiB | `0202` | no |
| `curso-notas`, `curso-adjuntos`, `comunidad-adjuntos`, `lead-notas` | no | 25 MiB | `0208`, `0216`, `0217`, `0267` | los tres primeros sí |
| `curso-entregas` | no | 100 MiB | `0218` | sí |
| `replays` | no | 2 MiB | `0191` | no |
| `wa-media`, `archivero`, `ig-media`, `contratos` | no | sin tope | `0073`, `0097`, `0136`, en código | sí |

La lista del reset está en `lib/reset-workspace.ts:52`; las de las migraciones salen de
`git grep "insert into storage.buckets"`. Los usos de `.storage.from(`: 43 con la constante
`BUCKET`, 8 `BUCKET_CURSO`, 7 `MEDIA_BUCKET`, 7 `BUCKET_ADJUNTOS_WA`, 7 `'contratos'`,
6 `'archivero'`, 4 `BUCKET_LANDING`, entre otros.

### 5.3 Cómo se suben imágenes hoy (tres formas)

1. **Firmar → el navegador sube → registrar** (la buena para un editor): la ruta valida el tipo y el
   tamaño, arma `<ws>/subidas/<uuid>.<ext>` y llama a `createSignedUploadUrl`. El navegador hace un
   PUT con XHR y progreso real. `registrar` verifica que exista, mira los MAGIC BYTES, aplica el
   tope y la muda a `<ws>/`; si no da, la BORRA. Lo que nunca se registró se barre a la hora, con
   `after()` (`app/api/landing-generator/imagenes/route.ts:8-17,53-80`).
2. **Multipart a una ruta**: `/api/graficos/imagen` hasta 4 MB (`route.ts:9-17`) y `/api/portadas`
   hasta 6 MB (`route.ts:39-40`).
3. **Copia del server**: `copiarStockABucket(id, bucket, ws)` (el navegador manda el ID, nunca una
   URL, `imagenes-stock.ts:522`) y `copiarUrlABucket` con la baranda SSRF
   (`imagenes-stock.ts:563`).

Los topes que no dan error:

- una server action, 1 MB (AGENTS.md:1230-1240);
- una función de Vercel, ~4,5 MB, un 413 con HTML («NO lo medí acá», `graficos/imagen/route.ts:12-14`);
- el proxy, 20 MB, y **trunca en silencio** (`next.config.ts:40-46`);
- la URL firmada no hace cumplir el tamaño declarado; sólo lo hace el `file_size_limit` del bucket
  (`docs/hallazgos-customer-success.md:4529-4531`);
- `fetch` no da progreso de subida (AGENTS.md:1240-1245).

### 5.4 Los límites medidos

- **Storage**: 1,07 GB en 6 buckets, contra los 100 GB que incluye Pro; base de 374 MB de 8 GB
  (`docs/hallazgos-infra.md:2089-2090`, medido el 13/08). Los comentarios de `lib/curso-admin.ts`
  dicen «5 GiB para TODA la plataforma»: **el tope real no está medido**
  (`hallazgos-customer-success.md:4531-4539`). El tope GLOBAL de subida del proyecto tampoco
  (`0246:152-153`).
- **Egress**: una URL firmada nueva por request mata el caché del CDN y triplica el costo
  (`hallazgos-infra.md:2398-2405`). Las imágenes de un diseño van a un bucket PÚBLICO con URL
  estable, como `landing-imagenes`.
- **Basura**: un cleanup «best-effort» dejó 525 MB huérfanos (`hallazgos-infra.md:2382-2390`). El
  barrido de `subidas/` del Landing es el molde.

### 5.5 Migraciones: numeración, autoría y aplicación

- `supabase/migrations/` tiene 275 archivos; en este árbol el último es `0274_lead_resumen.sql`. Hay
  números repetidos (`0128`, `0129`, `0136`, `0177`, `0223`). **El número es un recurso
  compartido**: `git pull`, `git worktree list` y listar cada `supabase/migrations/`
  (AGENTS.md:541-551). Medido el 14/10: el 0275 lo tiene `wt-chats`.
- **La cabecera dice el ORDEN DE DESPLIEGUE** (AGENTS.md:4497-4512). El molde es textual:
  `0273_creaciones.sql:4-6` y `0246:4-10`. Lo que AGREGA y el código nuevo ya lee va antes o junto
  con el deploy.
- **El patrón de hoy** (más nuevo que la skill):
  - `workspace_id bigint not null references workspaces(id) on delete cascade` **SIN `default 1`**,
    porque «el 1 es un cliente (Mauricio)» (`0271_calendario_eventos.sql:27,36`; `0264:30`;
    `0246:15-18`);
  - un índice por workspace;
  - `enable row level security` sin políticas + **`revoke all … from anon, authenticated`**
    (`0271:61-62`). El servidor entra con `service_role`.

  ⚠️ La skill `.claude/skills/author-numbered-migration/SKILL.md:32,46` todavía dice `default 1`:
  está vieja.
- **Tres registros que el compilador no ve** (`0246:20-23`):
  - `TENANT_TABLES` (`lib/workspace.ts:85`; las de landing en l.204-208): sin esto, `getTenantDb()`
    es PASSTHROUGH;
  - `TABLAS_DE_INQUILINO` (`lib/tablas-de-inquilino.ts:48`);
  - el bucket en `BUCKETS` (`lib/reset-workspace.ts:52`, que asume rutas `<ws>/`).
- **Aplicación**: la aplica A MANO quien la escribe, con
  `node scripts/apply-migration.mjs supabase/migrations/NNNN_x.sql`. El script lee `DATABASE_URL` de
  `.env.local` (es PRODUCCIÓN: no hay staging), aborta si `leads < 50` y hace
  `NOTIFY pgrst, 'reload schema'` (`scripts/apply-migration.mjs:1-40`). No hay `supabase db push`
  (SKILL.md:12) y **el deploy no aplica migraciones** (`docs/mapa-del-proyecto.md:255-259`). Para
  verificar sin escribir: `scripts/check-migrations.mjs` (sólo lectura).
- **Server actions = endpoints públicos**: cada una repite la puerta (molde
  `app/api/landing-generator/route.ts:29-35`: `rol == null` → 401; `ws == null || rol !== 'admin'`
  → 403; `!tabEnCapa(key)` → 404). Para un editor que autoguarda: ruta, no action.

### 5.6 La tabla que usaría el editor (forma, no código)

`disenos`, molde `landing_docs`:

- columnas: `id bigint identity`, `workspace_id` (sin default), `titulo`, `ancho`, `alto`,
  `doc jsonb` (páginas y elementos con URLs del bucket, nunca `blob:` ni `data:`), `version` (para
  compare-and-set), `miniatura` (URL), `creado_por`, `created_at`, `updated_at` y, si hay papelera,
  `borrado_at`;
- índice `(workspace_id, updated_at)`, RLS sin políticas y `revoke`;
- los tres registros;
- un tope de bytes del `doc`, con 413 y aviso.

Las imágenes:

- o el bucket `landing-imagenes`: Canva comparte «Subidos» entre todos los diseños, igual que la
  «Biblioteca multimedia» del Landing, y la puerta de esa ruta pide `landing-writer`
  (`imagenes/route.ts:41-47`);
- o un bucket público propio, `<ws>/…`, en `BUCKETS`.

Plantillas «de MaKo»: filas del workspace de la plataforma o creaciones `de_mako`
(`0273_creaciones.sql`).

### 5.7 Local-first contra Supabase, para un diseño (JSON chico + imágenes)

| Criterio | Local-first (IndexedDB/OPFS, como el Video Editor) | Supabase (tabla + bucket, como el Landing) |
|---|---|---|
| Lo que dice el repo | Aceptado SÓLO por el peso de los medios crudos del video (relevamiento del 11/10, §0.8 y §4.5) | «El estado del producto va a Supabase» (`hallazgos-infra.md:377-382`) |
| El equipo del cliente y otra máquina | No lo ven; se pierde al limpiar datos | Lo ven |
| Super admin con varios `?ws=` | Exige el prefijo por ws en cada apertura (AGENTS.md:7833-7845) | Lo resuelve `getTenantDb()` |
| Estrellas (`formato_imagen`) | **Imposible**: `exportar()` lee la base (AGENTS.md:2244-2246) | Enchufe directo (§7.4) |
| API de MaKo (regla del 13/10) | Nada que listar ni crear | `listar/crear/duplicar` con runner |
| Costo | Cero | Un diseño pesa KB; las imágenes, MB en un bucket público con caché. Hoy hay 1,07 GB de 100 GB |
| Tamaño | Sin tope | Ruta (no action), tope de bytes, compare-and-set |

**Recomendación**: Supabase para el documento y las imágenes. Local, sólo un borrador de respaldo
con el ws en la clave, si se quiere el «sin conexión».

---

## 6. La API de MaKo: cómo se declara un área y qué declararía el editor

### 6.1 La mecánica (re-verificada)

- **Definiciones**: `lib/api-mako/areas/<área>.def.ts` (sin `server-only`, español neutro) y
  **cuerpos** en `<área>.run.ts` (`server-only`), cruzados por id (`lib/api-mako/runners.ts:1-9`).
- **Registro**: el import y la entrada en `POR_AREA` (`lib/api-mako/registro.ts:36-66`). Los ids
  son contrato (l.15-18).
- **Un área nueva** también la suma a `AREAS` y a `AREA_INFO` (`lib/api-mako/tipos.ts:33-37,41-75`)
  y, si sale por REST, a `lib/api-mako/rest.ts` (molde `calendario`, l.29-31). El precedente
  completo es el commit `b202da4e` (Calendario): def, run, `registro.ts`, `runners.ts`, `tipos.ts`,
  `rest.ts`, `docs/api-mako.md`, el snapshot y un test.
- ⚠️ **Un área nueva no la tienen los tokens detallados que ya existen**: el permiso es por área
  (comentario de `cobros`, `tipos.ts:68-70`).
- **Regenerar**:
  - `node --import tsx scripts/generar-api-doc.mjs` escribe `docs/api-mako.md` y
    `tests/api-mako-http.snapshot.txt` (`generar-api-doc.mjs:1-14`). Exponer algo por HTTP es
    regenerar el snapshot y commitearlo: decidirlo;
  - `node --import tsx scripts/generar-plugin.mjs` regenera `plugin/`, la copia pública de la skill,
    con guard de tokens (`generar-plugin.mjs:1-21`). `lib/agente-skill.ts` no importa `AREAS`, así
    que un área nueva probablemente no la cambia, pero el pre-push corre igual su `--check`
    (AGENTS.md:188-194);
  - el `--check` de los dos corre en el pre-push y se abstiene si `lib/api-mako` tiene cambios sin
    commitear (`generar-api-doc.mjs:22-29`).
- **Lo que cada definición declara** (AGENTS.md:766-800):
  - `canales` en positivo;
  - `confirmacion` `chat` o `pantalla`, nunca directo; lo que cuesta plata, `pantalla` + admin;
  - `gating.rolMinimo: 'admin'` si la page hace `requireRolWs([])`;
  - `gating.tab` mira la CAPA, no a la persona.

  `Gating` sólo trae `soloWs1`, `integracion`, `tab` y `rolMinimo` (`tipos.ts:160-178`): **no hay
  «sólo el super admin»**.

### 6.2 Qué declararía el editor (propuesta)

- **Dónde**: en `contenido` (ya es «Content Machine: Ads Writer, Reels, Carousels, Stories»,
  `areas/contenido.def.ts:9`) o en un área nueva `imagen`. Un área nueva separa los permisos de los
  tokens, pero ningún token existente la tiene.
- **Lecturas** (`gratis`, `gating: { tab: 'image-editor', rolMinimo: 'admin' }`): `listar_disenos`,
  `ver_diseno` (páginas, tamaños y los TEXTOS, sin URLs firmadas) y `listar_plantillas_diseno`.
- **Acciones**: `crear_diseno` (desde un tamaño o una plantilla; `pantalla` con link al editor),
  `crear_diseno_desde_carrusel` (§8), `cambiar_textos_diseno` (`chat`), `duplicar_diseno` y
  `borrar_diseno` (`pantalla` + admin). Cada una que crea algo devuelve su id en `datos`
  (`docs/hallazgos-api-mako.md:891-895`).
- **Exportar a PNG/PDF por la API no se puede hoy**: el render vive en el navegador y no hay
  renderer de server. La API devuelve el link.
- **Publicar como Estrella** ya lo cubre el área `creaciones` en cuanto se enchufe el tipo
  (`lib/creaciones-enchufes.ts:15`: «la tabla, las estrellas, la galería y la API ya son de todos»).
- ⚠️ **La tensión con «Image sólo del super admin»**: con `gating.tab: 'image-editor'`, todo cliente
  `completo` o `agencia` lo usaría por token o por WhatsApp aunque su barra no lo muestre (es la
  regla «un flag de visibilidad protege la PANTALLA», AGENTS.md:2275-2306). O se agrega un gating
  nuevo, o se declara el día que se abre a los clientes: decisión de Martín (§13).

---

## 7. IA

### 7.1 «Generar imagen con IA» por el puente a Google Flow

- **No está construido en el Landing** (§0.1). El contrato que existe es el del Video Generator:
  - `encolar('generar_imagen', { prompt, path: ENDPOINTS.generarImagenes('x'), parches: parchesImagenEscena({...}) })`
    (`app/video-generator/video-action.ts:1446-1470`; también `puente-actions.ts:245`);
  - `encolar` (`lib/flow-cola.ts:222`) inserta en `flow_trabajos` del workspace y devuelve el id, o
    `null` con log;
  - la extensión del cliente lo busca por polling, lo ejecuta con SU cuenta y SUS créditos de
    Google, y devuelve el resultado (`flow-cola.ts:1-24`);
  - el pedido son PARCHES, no un cuerpo, porque el modelo y la cara sólo los sabe la plantilla
    (`lib/flow-imagen.ts:1-53`).
- **Para que otro editor lo llame faltan cuatro cosas**:
  - el parche de la extensión (sin referencia de cara y sin exigir el video);
  - copiar la URL de Flow al bucket ANTES de ponerla en el diseño, porque vence;
  - que el cron `flow-abandono` no le avise «tus videos no se generan» al cliente por una imagen;
  - el riesgo de doble reencolado (`hallazgos-editor-landing.md:321-330`).
- **Y un «no» vigente**: «Ahora no, más tarde» (14/10). En lo que gasta plata ajena, el default es
  NO reintentar (AGENTS.md:6444), y lo que se paga entra por el trabajo real, no por un botón de
  probar (AGENTS.md:6418).

### 7.2 «Image Generator» (comingSoon)

- `app/image-generator/page.tsx`: 8 líneas, `requireRolWs([], { nav: 'image-generator' })` + `<ComingSoon>`.
- Área en `/admin/dev`: «por-construir». Sus dos insumos existen (la Brand Persona con las fotos y el
  formato de imagen del Ad Detail); falta el generador (`app/admin/dev/areas.ts:714-718`). Queda
  como la sección «Crear con IA» de la tab, al lado del Editor.

### 7.3 Quitar fondo

- El del Video Editor: `ImageSegmenter` de `@mediapipe/tasks-vision` 1.1.0 (Apache-2.0) con
  `selfie_segmenter.tflite`, de 244 KB (`public/ve/modelos/`). Corre en modo IMAGEN, con GPU y
  respaldo de CPU, tope de carga de 2 minutos, y el wasm de jsdelivr con la versión atada al
  paquete (`segmentador.ts:1-37,48-53`).
- **Es de personas**: no sirve para un producto, un logo ni un objeto.
- Lo instalado que podría servir, **sin licencias verificadas**:
  - `InteractiveSegmenter` del mismo paquete (seleccionar un objeto con un clic);
  - un modelo de quitar fondo por `@huggingface/transformers` 3.8.1 (Apache-2.0 la librería). Los
    modelos conocidos de quitar fondo genérico, según su ficha, suelen ser de uso NO comercial: hay
    que leerla antes.
- Sin COOP/COEP, onnxruntime corre en un solo hilo (§4).

### 7.4 Estrellas: `formato_imagen`

- Hoy: `INFO_TIPO.formato_imagen = { feature: 'Image Generator', ruta: '/image-generator', nav: 'image-generator' }`
  (`lib/creaciones-reglas.ts:32`). Está en `POR_ENCHUFAR` como «Content Machine» (l.46) y
  `ENCHUFADOS` sólo tiene `automatizacion` (l.41).
- Enchufarlo son cuatro funciones en `lib/creaciones-enchufes.ts`: `opciones`, `exportar`
  (la DEFINICIÓN, sin datos del negocio, leída de la base), `resumir` y `usar` (la crea en
  borrador). Hay que pasar el tipo a `ENCHUFADOS` y poner el botón «Publicar»
  (`creaciones-enchufes.ts:5-15`; AGENTS.md:2237-2250).
- Tope de 400 KB por definición (`creaciones-reglas.ts:57`). Las URLs de imágenes de OTRO workspace
  dentro de una plantilla publicada:
  - en un bucket público, siguen andando;
  - si el autor las borra, la plantilla queda con huecos.

  `usar()` debería copiarlas al bucket de quien la usa. **Si «formato de imagen» es una plantilla del
  editor o un formato del Image Generator lo decide Martín**: cambia `nav` y `ruta` en
  `INFO_TIPO`.

### 7.5 Texto con IA («Escribir con IA» de Canva)

- Va por la cascada gratis y BYOK, con una feature en `lib/model-catalogo.ts` y un `def` gratis;
  Claude está vetado (AGENTS.md:3392-3460).
- Los prompts van en el registro editable, en español neutro, con el bloque de idioma del cliente
  (AGENTS.md:2605-2640; molde D5 del Landing, `diseno-editor-landing.md:128-149`).

---

## 8. Carousels y Thumbnails

### 8.1 `/carousels` hoy

- **Escribe el carrusel; no lo dibuja.** Recibe un pedido y un tipo (educativo, storytelling o
  venta) y devuelve una `PiezaCarrusel`: `{ slides: [{ texto, visual }], caption, cta, palabraClave }`
  (`lib/ig-writer.ts:72-87`), con 2 a 10 slides. `texto` es la frase DENTRO de la imagen y `visual`
  describe la escena. La pantalla las muestra como tarjetas editables y termina en «Copiar el
  carrusel», texto para publicar a mano (`app/carousels/CarouselsApp.tsx:1-18,355-372`).
- El motor es `lib/ig-writer.ts`, compartido con Reels y Stories (`areas.ts:766-780`). La tab tiene
  su onboarding de 2 pasos (`lib/tab-onboarding-catalogo.ts:173-180`).
- **Sin persistencia**: el historial es la memoria de la página y se pierde al recargar
  (`CarouselsApp.tsx:79-84`). No hay un id de server.
- Los límites de Instagram: 2 a 10 ítems, 4:5, JPEG de hasta 8 MB (`lib/ig-formatos.ts:61-76`). La
  pieza se sube a mano, y la app acepta PNG (`CarouselsApp.tsx:358-359`).
- **No se solapa con Canva, lo completa**: Carousels es el GUION y el editor es donde las slides se
  vuelven imágenes.

### 8.2 «Abrir en el editor» (recomendado)

- El botón, al lado de «Copiar el carrusel», hace un POST de la pieza (sólo TEXTO, validado y con
  topes) a una acción del editor que crea en el server un diseño de N páginas de 1080×1350: `texto`
  como titular, `visual` como nota y, opcional, una foto libre buscada con `visual`
  (`buscarYCopiar`, `imagenes-stock.ts:589`, el mismo truco del Landing). Navega con el `Link` de la
  casa a `/image-editor/<id>`.
- **No hay ref que resolver** (no hay fila), así que no aplica el `?desde=<ref>` del Video Editor
  tal cual. Lo que se cuida es lo mismo: el navegador no manda URLs, sólo texto.
- Va a la API como `crear_diseno_desde_carrusel` (§6.2).

### 8.3 Thumbnails

- `app/thumbnails/page.tsx`: `ComingSoon` de 8 líneas.
- El área: «por-construir»; lo único decidido es el lugar y la economía, US$0,068 por 2 variantes,
  cobrado por intento (`areas.ts:809-816`).
- Con el editor, un tamaño «Miniatura de YouTube (1280×720)» cubre la parte manual; generarla con IA
  es otra cosa. Si Thumbnails pasa a ser un tamaño del editor lo decide Martín.

---

## 9. Las reglas de AGENTS.md que más pegan en un editor nuevo

| Línea | Regla | Qué exige acá |
|---|---|---|
| 2 | «This is NOT the Next.js you know» | Leer `node_modules/next/dist/docs/` antes de una API de Next |
| 98 / 330 | El typecheck no corre en el build y la guardia de RAM puede negar | `npm run build` al agregar rutas, en una máquina con RAM |
| 349 | En `'use server'` sólo funciones async | §3 |
| 682 / 712-716 | Una cosa, un lugar. **NUNCA leer `?ws=` de la URL para decidir datos (IDOR)** | `getWorkspaceActual()` → prop. Reusar `imagenes-stock.ts`, no una tercera copia del sniff |
| 766 | Una capacidad nueva se DECLARA en el registro de la API | §6 (y la memoria del 13/10) |
| 993 | Hay CINCO formas de navegar y las cinco llevan el `?ws=` | `Link`/`useRouter` de `@/app/_ui/Link`, `conWs`, `rutaConWs`, `linkApp`; el parche de fetch no llega a los workers |
| 1230 | Tres topes que no dan error | La ruta, no una action, para guardar y subir; XHR para el progreso |
| **1258** | **La pantalla dice QUÉ pasó** (toast de 3-4 palabras, rótulo de 1-3, estado vacío de una frase) | Los rótulos de Canva son cortos: se copian; el porqué va al código |
| 1389 / 1556 | El tamaño que le corresponde; el layout con el valor MÁS LARGO | Los nombres de fuentes y plantillas en español |
| 1427 / 1471 / 1539 / 1488 | Arrastre HTML5 (la foto la saca el SO, el nodo origen no se toca, la foto se toma al terminar `dragstart`); un GESTO se verifica arrastrando | Arrastrar elementos y fotos del panel al lienzo |
| 2093 | `'use client'` es una frontera de DATOS | A la página baja sólo lo que el editor dibuja |
| 2237 | Una creación publicada es la DEFINICIÓN, y cada tipo se enchufa en UN lugar | §7.4 |
| 2275 | Un flag de visibilidad protege la PANTALLA; la API se cierra aparte | `adminOnly` frente a la API (§6.2) |
| **2605** | **La voz de MaKo es rioplatense; el texto DEL CLIENTE, no** | Copy en «tú»; prompts con su bloque de idioma |
| 3392 / 3426 / 3459 / 3510 | Claude vetado; un default que cobra; un fallback que no cobra; Claude último recurso | Toda IA del editor |
| **3654** | **Borrar es UN tacho, rojo**; los desplegables llevan ícono | `BotonBorrar`; el set `app/_ui/iconos-menu.tsx` |
| 3674 | Dos reglas de layout: `Pagina`; pantalla completa con flex; prohibido `scrollbar-width: none` | §2.1 y §2.3 |
| 3852 / 7847 | Una pantalla con tema se hace redefiniendo TOKENS; el tema limitado a una clase no llega a los PORTALES | `.cv` + `portalCv()` |
| 3880 / 3929 | Ningún `<Suspense>` grande; una ruta con auth propia va en `rutas-publicas.ts` | `loading.tsx`; «Compartir enlace» |
| 4073 | El rincón de abajo a la derecha lleva `data-esquina-ocupada` | El zoom y las páginas de Canva |
| 4202 / 4253 | Montar una pantalla en un modal; `<Modal>` con `onCerrar` de identidad fija | Los diálogos de Descargar, Redimensionar y Compartir |
| 4350 | El `fetch` va con `signal` | Subidas y búsquedas |
| 4448 | Un eje en `hidden` vuelve `auto` el otro y rompe `sticky` | Los paneles laterales |
| 4497 | Toda migración decide su ORDEN de despliegue | §5.5 |
| **4575** | **Una medida adentro de `transform: scale(k)` no es la que vas a ver** | Los tiradores y las zonas de clic del lienzo con zoom: escala inversa |
| 4602 | Si se corre la vista para un panel, al cerrarlo se DEVUELVE | El panel de propiedades |
| 4865 / 4911 | La cosecha y el registro de `/admin/dev` | §2.1, §12 |
| 5242 | Un campo nuevo en un objeto que se guarda ENTERO se busca en todos los escritores | El `doc` del diseño |
| 5328 | Deshacer algo destructivo devuelve la MISMA identidad | Borrar un elemento o una página y deshacer |
| 5457 | Si cambia QUÉ EXISTE, se navega duro (`conWs`) | Crear, duplicar y borrar diseños |
| 6270 / 6761 | Un test se prueba rompiéndolo; `npm test` antes del `git add` no ve lo nuevo | Los tests nuevos |
| 6418 / 6444 | Lo que se paga entra por el trabajo real; en lo que gasta plata ajena, NO reintentar | Flow |
| 6678 | Antes de construir una máquina nueva, buscá qué pantalla ya hace algo parecido | El selector de imágenes y el export del Landing (§5, §11) |
| 7031 | Un BORRADOR no es un DEFAULT; publicar promueve lo GUARDADO | Estrellas y compartir |
| **7491** | **Una pila de deshacer se llena en el CHOKE POINT, una vez por gesto, y el Ctrl+Z nativo gana en un texto** | La edición de texto dentro del lienzo |
| 7570 | Un `useState` sembrado de props no se resiembra: `key` | El panel de propiedades al cambiar de elemento |
| 7782 | Apoyar algo sobre el borde de un lienzo son CUATRO lugares | Las guías y el «ajustar» a los bordes |
| 7833 | Lo que se guarda en el NAVEGADOR lleva el workspace en la clave | §2.1 |
| 7862 | «Una tab nueva decide si entra en la capa superadmin» | **Premisa falsa** (§0.4): se decide y se escribe igual, sabiendo que no restringe |
| 7869 | El 200 también puede ser NUESTRO (el 307 al login con HTML) | Validar el `content-type` de todo `.json` y `.avif` bajado de `public/` |

Las memorias que aplican: «el texto que se DIBUJA es corto», «Copiar una app TAL CUAL (antes de
crear, revisar la fuente y, si no está, AVISAR)», «Cambios impactan a clientes», «Pushear no es
desplegar» y «toda feature nueva va a la API de MaKo».

---

## 10. Las fuentes que hay hoy

- **No se usa `next/font` en ningún lado** (`git grep "next/font"` sobre app y lib: sólo el
  comentario de `app/_cursos/fuentes.ts:23-24`, que lo dice).
- **Geist y Geist Mono** se cargan como hoja de Google en el layout
  (`app/layout.tsx:130-135`), y `globals.css` las usa por nombre.
- Los catálogos que existen:

  | Catálogo | Dónde | Tamaño |
  |---|---|---|
  | Del curso | `app/_cursos/fuentes.ts:59` | 24 familias, cada una con su hoja de Google pedida cuando hace falta |
  | Del Dashboard | `lib/graficos-temas.ts:84-86` | Geist + las del curso |
  | De los temas del Landing | `lib/editor-landing/temas.ts:108`; `urlFuentes`, l.1160-1177 | ~48 entradas (conteo por regex) |
  | Del cromo del Landing | `app/landing-generator/cliente.ts:36` | Instrument Sans |
  | Conocimientos | `app/conocimientos/CursoPortal.tsx:281-284` | Bricolage, DM Sans, Spline Sans Mono |
  | **El atlas del Video Editor** | `public/ve/fonts/font-atlas.json` + 15 `font-chunk-*.avif` | **1920 familias de Google Fonts** (medido con node), con su muestra en sprites; cada familia se baja al elegirla (`google-fonts.ts:55-79`) |

- **El atlas del Video Editor es el selector de fuentes de Canva casi hecho**: está en `/ve/`, exento
  del proxy (§2.1), y son fuentes OFL/Apache.
- Las fuentes propias de Canva (Canva Sans y las de su biblioteca paga) no se copian.

---

## 11. Las dependencias ya instaladas que sirven para un editor de lienzo

Las versiones son las de `node_modules/<p>/package.json` y las licencias, su campo `license`.

| Paquete | Versión | Licencia | Hoy lo usa | Para el editor |
|---|---|---|---|---|
| `html-to-image` | 1.11.13 | MIT | `lib/editor-landing/exportar-png.ts` | Exportar a PNG si el lienzo es DOM y no canvas (`backdrop-filter` no sale, `exportar-png.ts:19-20`) |
| `jszip` | 3.10.1 | MIT o GPL-3.0 | export del Landing, second-brain | Descargar varias páginas en un .zip |
| `pptxgenjs` | 4.0.1 | MIT | `lib/editor-landing/exportar-pptx.ts` | «Descargar como PPTX» |
| `gifenc` | 1.0.3 | MIT | `_opencut/export/gif.ts` | GIF animado |
| `mediabunny` | 1.61.3 | — | Video Editor | MP4 de un diseño animado |
| `culori` | 4.0.2 | MIT | Video Editor (color) | Selector de color y paletas |
| `radix-ui` | 1.7.0 | MIT | Video Editor | Menús, popovers, diálogos, slider, tooltips (con `portalCv`) |
| `zustand` | 5.0.15 | MIT | Video Editor | Estado del editor |
| `react-resizable-panels` | 2.1.9 | MIT | Video Editor | Paneles |
| `motion` | 12.43.0 | MIT | Video Editor | Animaciones de la interfaz y de los elementos |
| `sonner` | 1.7.4 | — | Video Editor | Toasts (o los de la casa) |
| `lucide-react` | 0.562.0 | ISC | — | Íconos (el tacho: el de la casa) |
| `@hugeicons/react` / `core-free-icons` | 1.1.10 / 3.3.0 | MIT / MIT | Video Editor | Íconos (la licencia, verificada ahora: MIT) |
| `react-icons` | ^5.7.0 | — | Video Editor | Íconos |
| `@tiptap/*` | 3.31.4 | MIT | Landing, curso | Texto enriquecido en una caja de texto |
| `@mediapipe/tasks-vision` | 1.1.0 | Apache-2.0 | Video Editor (fondo) | `ImageSegmenter` (personas), `InteractiveSegmenter` (§7.3) |
| `@huggingface/transformers` | 3.8.1 | Apache-2.0 | Video Editor (Whisper, en un worker) | Modelos locales (con licencias a verificar) |
| `unpdf` | 1.8.0 | — | archivero, adjuntos | Importar un PDF (leerlo; dibujarlo no lo medí) |
| `nanoid` | 5.1.16 | — | — | Ids de elementos |
| `class-variance-authority`, `clsx`, `tailwind-merge` | 0.7.1 / 2.1.1 / 3.7.0 (rangos de `package.json`) | — | Video Editor (shadcn) | Un port shadcn |
| `tw-animate-css` | 1.4.0 | — | `globals.css:21` | Las animaciones de los menús |
| **No instalados** | `fabric`, `konva`, `react-konva`, `jspdf`, `pdf-lib`, `html2canvas`, `polotno`, `@imgly/background-removal`, `opentype.js`, `fontkit` | | | El motor de lienzo y el PDF vectorial son las dos piezas que faltan. El PDF del Landing sale por `window.print()` (`exportar-pdf.ts:1-20`) |

Las licencias marcadas «—» no las leí. Las de `jszip` y `hugeicons` salen de su `package.json`.

---

## 12. Qué cosechar y dónde (para el que cierre la corrida)

1. **El diagnóstico obvio equivocado: «la capa superadmin restringe las tabs».** La realidad es que
   `tabEnCapa` une con `userNavKeys: null` y deja pasar todo. Hay que corregir
   `lib/capas.ts:283-286` y la regla de `AGENTS.md:7862-7867`, que hoy enseñan lo contrario
   (`hallazgos-customer-success.md:3755-3758` ya lo sabía). El hallazgo va al documento del área
   donde vive el código: `lib/capas.ts`, o sea plataforma/capas.
2. **`adminOnly` no deja ver al super admin mirando un cliente.** `adminShell` excluye a quien
   impersona (`Sidebar.tsx:432`); el comentario de `Sidebar.tsx:438-439` está viejo. Y `adminOnly`
   tampoco cierra la URL (`/carousels` abre hoy para cualquier admin de un cliente `completo`).
3. **Para el editor**, en `docs/hallazgos-image-editor.md` + su fila en `docs/hallazgos.md`:
   - una foto de afuera ensucia el canvas: hay que copiarla al bucket;
   - `@custom-variant dark` y `scrollbar-hidden` ya están atados a `.ce`;
   - la exención de frontera está atada al Video Editor por un test;
   - «Generar imagen con IA» no existe en ningún editor;
   - el selfie_segmenter es de personas.
4. **La skill `author-numbered-migration` está vieja** (`default 1`, contra la práctica sin default
   desde 0246).

---

## 13. Decisiones que sólo puede tomar Martín

1. **¿Quién la ve?** ¿Sólo él, con guard por persona como el Video Editor del 11/10 (§1.3), o
   abierta a los clientes desde el día uno, como el Video Editor el 12/10?
2. **¿Barra lateral visible mientras se edita?** El precedente del Video Editor dice que sí (12/10).
3. **¿Dónde viven los diseños?** La recomendación es Supabase (§5.7). Y, ligado: ¿la biblioteca
   «Subidos» se comparte con la del Landing (`landing-imagenes`) o va en un bucket propio?
4. **¿Fotos de stock sólo libres sin key** (Openverse CC0 y Picsum, como hoy) **o con un catálogo
   con key** (Unsplash, Pexels o Pixabay: cuenta, términos y atribución)?
5. **¿IA de imagen por Flow en el editor?** Hoy no existe en ningún editor, y el 14/10 dijo «ahora
   no, más tarde».
6. **`formato_imagen` de las Estrellas**: ¿es una plantilla del editor o un formato del Image
   Generator?
7. **La API mientras sea sólo de él**: ¿declarar ya, con un gating nuevo «sólo plataforma», o
   declarar el día que se abre? Hoy declararla con `tab` la abre por token a todo cliente.
8. **¿Onboarding?** ¿Estado vacío (precedente del 05/10) o el wizard de la regla del 01/08?
9. **Carousels**: ¿«Abrir en el editor» (§8.2)? **Thumbnails**: ¿pasa a ser un tamaño del editor?
10. **Quitar fondo de objetos**: ¿un modelo local (licencia a verificar), sólo personas, o nada?

---

## 14. Lo que NO pude medir

- **La capa real del workspace propio de Martín.** `wsSuperAdmin()` cae a 9 si no encuentra
  (`lib/workspace.ts:494-501`). La conclusión de §0.5 es del código, no de la base.
- **Nada corrió**: ni `npm install`, ni `tsc`, ni `next build`, ni tests (por la RAM). En particular
  no está verificado:
  - que un segundo `@custom-variant dark` conviva;
  - que un motor de lienzo compile con Turbopack;
  - cómo sirve el proxy `/image-editor` en un teléfono.
- **Lo externo**: el CORS y los términos de Unsplash, Pexels y Pixabay; la licencia del modelo de
  `InteractiveSegmenter` y la de los modelos de quitar fondo de Hugging Face; los hosts por default
  de transformers.js (no se tocan en el repo).
- **El tope real de Storage** (5 GiB contra 100 GB) y el tope global de subida del proyecto de
  Supabase (`0246:152-153`).
- **Si un iframe con `srcdoc` o `about:blank` sufre el `X-Frame-Options: DENY`.** El PDF del Landing
  lo usa y no hay un hallazgo en contra, pero no lo medí.
- **Las licencias** de `mediabunny`, `sonner`, `react-icons`, `unpdf`, `nanoid` y
  `tw-animate-css` (no leí su `package.json`).
