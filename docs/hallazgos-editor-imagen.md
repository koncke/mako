# Hallazgos — Image Editor (el Canva de MaKo sobre Doory)

El plano está en [diseno-editor-imagen.md](diseno-editor-imagen.md) y los relevamientos en
[editor-imagen/](editor-imagen/). Acá va lo que costó: síntoma → causa → dónde vive → la regla.

---

## La licencia de Doory obliga a mostrar el crédito, y modificar el código no la saca

**Vive en:** `app/image-editor/_doory/LICENSE-DOORY` · `app/image-editor/editor/CreditoDoory.tsx`

Doory (`shaongitbd/doory`) es la «Attribution Assurance License»: servir su JS al navegador es
redistribuirlo, y pide «a prominent display (e.g., splash screen or banner text)» con el nombre del
autor, su identificación y la URL **cada vez que se abre**. «In whole or part, with or without
modification»: un archivo adaptado ya alcanza. Martín eligió el 14/10 portarlo igual y transformarlo
después («Copia a Doory, y luego lo modificamos completamente»).

- **Diagnóstico obvio equivocado:** «si lo cambiamos todo, ya es nuestro». Lo derivado sigue siendo
  derivado; el cartel se va sólo con permiso escrito del autor o con un editor reescrito sin su código.
- Su propio `NOTICE` dice «the rest is MIT, like the code» y contradice el `LICENSE`: no sirve de
  respaldo, sí de argumento para pedirle una licencia MIT.
- El «GPG-signed text» que exige no existe (ni el archivo ni commits firmados).
- Regla: el cartel no se saca y el editor no se abre a clientes hasta resolver esto
  (`tests/image-editor-integracion.test.ts` frena si falta el crédito).

## Instalar dependencias en el `node_modules` compartido sin `npm install`

**Vive en:** `C:/dev/canva-deps` (fuera del repo) · `package.json` / `package-lock.json`

El `node_modules` del clon tenía paquetes «sueltos» de otra sesión (`@simplewebauthn/*`, `@peculiar/*`,
WIP de passkeys sin commitear): un `npm install <pkg>` normal reconcilia el árbol contra el lock y los
habría BORRADO. Se instaló en una carpeta aparte (`npm install --prefix`), se copió sólo lo que faltaba
(sin pisar versiones distintas: `fflate` 0.8 y `pako` 2 quedaron anidados bajo `jspdf` y `fast-png`), y
el `package.json`/lock se actualizó con `npm install --package-lock-only`, que no toca `node_modules`.

- Antes de instalar algo en el clon: `npm ls --depth=0 | grep extraneous`. Si hay, no se corre `npm install`.
- ⚠️ **`fflate` local quedó en 0.4.9** (la de `rrweb`) y el `package.json` pide ^0.8.3: en Vercel se
  instala la 0.8 arriba. El ZIP de varias páginas de Doory usa `zipSync`, que la 0.4.9 ya tiene; sin probar.

## jsPDF importa en caliente tres opcionales, y Turbopack las exige igual

**Vive en:** `node_modules/jspdf/dist/jspdf.es.min.js`

`/image-editor` dio 500 con «Module not found: Can't resolve 'canvg' / 'dompurify' / 'html2canvas'»:
el build ES de jsPDF hace `import("canvg")` etc. sólo si se usan, Vite lo tolera y Turbopack resuelve
TODO import dinámico al compilar. Son `optionalDependencies` de jsPDF: el lock las trae y Vercel las
instala; local faltaban porque la instalación aparte se hizo con `--omit=optional`.

- Regla: al portar código que usa jsPDF (o cualquier paquete con imports dinámicos opcionales), se
  instalan sus opcionales también local.

## Un worktree nace sin `next-env.d.ts`, y el typecheck da 135 errores de CSS modules

**Vive en:** la raíz del worktree (archivo ignorado)

El primer typecheck acotado del port dio 137 errores; 135 eran `Cannot find module './x.module.css'`.
No era el port: `next-env.d.ts` (que trae los tipos de `*.module.css`) lo genera Next y está en
`.gitignore`, así que un worktree recién creado no lo tiene. Se copia del clon.

## El `?url` de Vite y el `import.meta.env` no existen en Next

**Vive en:** `_doory/editor/engine/bgRemoval/bundled.ts` y `session.ts` · `_doory/editor/collab/testHook.ts`

Doory importaba el `.wasm` de onnxruntime con `?url`; Turbopack no lo entiende y un `.wasm` del build da
404 en Vercel. El worker ahora lo baja de jsDelivr con la versión EXACTA del runtime instalado
(`ort.env.versions.web`). El onnxruntime-web instalado es el 1.22.0-dev que trae `@huggingface/transformers`
y no tipa el subpath `./wasm`: hay un `.d.ts` que lo apunta a `onnxruntime-common`.

- ⚠️ **Quitar fondo está APAGADO**: Doory lo prende sólo si su backend le manda la descripción del modelo
  (`configureBackgroundRemoval`). Falta alojar el modelo (U²-Net u2netp, Apache-2.0, o BiRefNet_lite MIT
  para objetos) y llamar a esa función desde la cáscara.

## El dev server local no aguanta compilar el editor con la máquina llena

**Vive en:** el entorno (`~/.claude/guardia/vigia.ps1`)

El 14/10 el inicio (`/image-editor`) se dibujó bien en un `next dev` local (worktree hermano del clon,
`turbopack.root` subido sólo en esa copia), y al abrir un diseño el proceso pasó los 5,4 GB y el vigía de
RAM lo mató por «fuga next dev». Es lo mismo que le pasó al Video Editor (que se verificó en producción).
Además, la extensión Claude in Chrome **no tiene acceso a `localhost`**: la captura falla con «Chrome
blocked the extension». Para mirar local va Playwright headless de la caché de npx, con `--mute-audio`.

- Con la máquina llena, el editor se verifica en producción (está detrás del guard del super admin).

## Lo que el relevamiento de integración midió y cambia el plan

**Vive en:** `docs/editor-imagen/relevamiento-integracion-mako.md`

- **La capa `superadmin` NO restringe ninguna tab** (`userNavKeys: null` en `lib/capas.ts`), y el
  comentario de `lib/capas.ts:283-286` y la regla de AGENTS.md dicen lo contrario. Diagnóstico obvio
  equivocado.
- **`adminOnly` es cosmético**: `/carousels` abre por URL a cualquier admin de cliente. Por eso el
  editor lleva guard por PERSONA (`acceso.ts`, molde `b112e5b7`).
- **«Generar imagen con IA» por Flow NO existe** en el Landing Generator: falta parchear la extensión.
- **Una foto de afuera no se puede dibujar en el lienzo sin copiarla antes al bucket**: Openverse y
  Picsum no mandan CORS y el export a PNG/PDF falla con el canvas «sucio».

## Lo que quedó SIN hacer (con el archivo donde vive)

- **Verificar el editor abierto** (crear, texto, imagen, descargar PNG/PDF): sólo se vio el inicio.
- **El re-vestido de Canva** (tanda 2): `_doory/editor/TopBar.tsx`, `chrome/ToolHost.tsx`,
  `builtins/panels.tsx`, `toolbar/`, `workspace/` (Workspace, PageStrip, ZoomControls), `dialogs/`,
  `app/image-editor/inicio/`. La paleta ya está en `_doory/styles/tokens.css`; la especificación en
  `docs/editor-imagen/relevamiento-canva-armazon.md`.
- **El relevamiento de FUNCIONES de Canva no se escribió**: el agente se cortó con la caída de la app
  del 14/10 09:10. Falta `docs/editor-imagen/relevamiento-canva-funciones.md`.
- **Los catálogos**: `app/image-editor/mako/servicios.ts` tiene 28 fuentes y los elementos/plantillas de
  prueba de Doory (en inglés). Las 10 plantillas de Doory (AAL) están en su repo, `backend/data/templates`.
- **Supabase** (tabla de diseños + bucket), **API de MaKo**, **Estrellas `formato_imagen`**.
- **«Presentar con notas»** abre `presenter-view.html`, que en MaKo no existe (`_doory/editor/presenter/channel.ts`).
- **Los textos visibles** siguen el vocabulario de Doory traducido; los rótulos exactos de Canva van con el
  re-vestido.
- **Una pestaña de Canva** («Diseño sin título - Presentación», `canva.com/design/DAHX-ICTUd4`) quedó
  abierta en el grupo de pestañas de los agentes: la abrió el relevamiento de funciones antes de cortarse.
  Si lo creó en la cuenta de Martín, hay que mandarlo a la papelera a mano.
