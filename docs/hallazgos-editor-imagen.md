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

## Un typecheck ACOTADO no ve dos `declare module` del mismo paquete en dos áreas

**Vive en:** `app/video-editor/_opencut/export/gifenc.d.ts` · `app/image-editor/_doory/editor/engine/export/video/gifenc.d.ts`

`gifenc` no trae tipos y los dos editores lo declaran por su cuenta. TypeScript FUSIONA las dos declaraciones y gana la del Video Editor, que no tenía la opción `first` de `writeFrame`: el typecheck acotado del Image Editor (sólo `app/image-editor`) dio limpio, y el completo del pre-push frenó el push con «`first` does not exist». Se le sumó `first?` (una opción real de gifenc) a la declaración del Video Editor.

- Regla: un paquete sin tipos se declara UNA vez; si ya hay un `declare module` en otra área, se amplía ése en vez de escribir otro.


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

## Un `import './x'` a un módulo que no existe pasa el typecheck y da 500

**Vive en:** `app/image-editor/editor/PantallaEditor.tsx` → `mako/registro.ts`

En la tanda 2 la pantalla importó `'../mako/registro'` (sin nombres, sólo para que registre «Proyectos») antes de
que otro agente lo creara. Con TS 5.9 sin `noUncheckedSideEffectImports`, tsc NO marca un import de efecto a un
archivo que falta; Turbopack sí, y la página da 500.

- Regla: un módulo que se importa por su efecto se importa con un nombre (`import { registrarProyectos } from …`)
  y se usa; así tsc lo ve. Hoy la pantalla llama `registrarProyectos(ws)` con el workspace del server.

## «Proyectos» con el `?ws=` de la URL abría la base del workspace 0

**Vive en:** `app/image-editor/mako/ProyectosPanel.tsx` · `mako/registro.ts`

La consigna pedía elegir la base local por el `?ws=`. En la cuenta propia ese parámetro NO está, así que se abría
la base del workspace 0 y la lista salía vacía sin error. Diagnóstico obvio equivocado: «el `?ws=` dice el
workspace». Quien lo sabe es el server (`getWorkspaceActual`, prop de la página): la pantalla lo pasa con
`registrarProyectos(ws)`, y si falta, el panel busca en qué base del navegador está el diseño abierto.

## Las trampas de `.cv` (la raíz con los estilos base de Doory)

**Vive en:** `app/image-editor/_doory/styles/global.css` · `ImageEditorCliente.tsx`

- `.cv :where(a)` tiene la MISMA especificidad que una clase de módulo: gana el que cargue después. El link
  «Inicio» de la barra va colgado de `.editor` para ganar siempre.
- `.cv :focus-visible` les pone radio de 8 px a todos los que tienen foco: un botón redondo vuelve a declarar su
  radio con más especificidad o pierde la forma al tabular.
- `.cv` lleva `isolation: isolate`: un overlay `fixed` adentro queda DEBAJO de la barra lateral de MaKo. Un diálogo
  fuera del `EditorProvider` (el «Crear un diseño» del Inicio) va por portal a `<body>`, envuelto en `.cv` y con
  `useCapaModal`.
- Dentro del editor: un `Popover` (z 200) abierto desde un `Dialog` (z 300) queda detrás del velo; para eso está
  el prop `overModal`. `ui/Menu` no lo tiene, y tampoco se da vuelta hacia arriba: abierto desde la barra inferior
  tapa su botón (la lista del zoom usa `Popover placement="top"`).

## La barra del objeto flota SOBRE el lienzo: el lienzo le reserva la franja

**Vive en:** `_doory/editor/workspace/Workspace.tsx` (`TOOLBAR_BAND`) · `toolbar/parts.module.css`

En Canva la barra del objeto flota arriba del área del lienzo (8 px del borde, 48 de alto). Sin reservarle lugar,
tapaba el encabezado «Página 1 - Agregar título de página» y el salto a una página lo dejaba debajo.
`TOOLBAR_BAND = 64` sube el aire de arriba a 72 px, el `scrollTo` de una página deja esa franja libre y «Ajustar»
la descuenta.

- Regla: si cambia el alto o la posición de la barra, cambia `TOOLBAR_BAND` en el mismo commit.

## La selección de Canva vive en TRES lugares

**Vive en:** `_doory/editor/engine/objects/controls.ts` · `engine/objects/theme.ts`

Los tiradores (círculos blancos de 12 px con borde gris y sombra, píldoras laterales, rotación abajo) se dibujan en
`controls.ts`. Pero `theme.ts` vuelve a aplicar `selectionStyle` a TODOS los objetos al re-tematizar y a la
selección de varios: con su 1,5 de Doory, el marco volvía de 2 px a 1,5. Ahora `theme.ts` dice 2 y 12.

- ⚠️ Frágil: `controls.ts` cambia `ActiveSelection.createControls` al cargar el módulo (una subida de fabric puede
  romperlo sin aviso).

## El catálogo de Iconify: tres APIs que fallan en silencio

**Vive en:** `app/image-editor/mako/elementos.ts` · `elementos-lista.ts` (generado por `scripts/image-editor/genera-elementos.mjs`)

- `GET /collection` **banea una hora** tras ~6 pedidos seguidos: 429 «error code: 1015», `Retry-After: 3595`, sin
  CORS. Por eso los destacados de cada set quedan guardados en el repo y el editor sólo busca en vivo.
- La búsqueda es **sólo en inglés**: «casa» devuelve 0 resultados, sin error. La consulta pasa por un diccionario
  español → inglés («corazón» → «heart») antes de ir a la API.
- `start=` contesta «Bad request»: se pide una vez con `limit=999` y se pagina en el editor.

## Las fuentes de jsDelivr: el primer pedido tarda más que el corte del motor

**Vive en:** `app/image-editor/mako/fuentes.ts` (generado por `scripts/image-editor/genera-fuentes.mjs`) · `_doory/editor/engine/fonts.ts` (`LOAD_TIMEOUT_MS`)

Un archivo «frío» de jsDelivr tardó 12,6 s y el motor corta la carga a los 8 s: la primera vez el texto puede caer
a la fuente del sistema. **Diagnóstico obvio equivocado:** al verificar las 499 variantes con 15 s de tope dieron
16 «404» que no eran tales; al repetir, todas 200 (hubo además un 503 pasajero en latin-ext).

- Regla: una verificación de URLs de CDN reintenta antes de declarar un 404. Alojar las fuentes nosotros (tanda 4)
  saca el problema de raíz.

## Detalles del motor que confunden

- **Degradados de Doory:** el ángulo 0 apunta a la DERECHA (el CSS usa ángulo + 90). `_doory/editor/engine/objects/fills.ts`.
- **Quitar tildes con una regex:** la herramienta de escritura cambia `̀` por el carácter invisible; se escribe
  `/\p{M}/gu`. (`dialogs/resizeSizes.ts` e `inicio/tamanos.ts` tienen el rango ya convertido: funciona, pero no se ve.)
- **`next/font` entra por primera vez en el repo** (Noto Sans como `--cv-font-ui`, `ImageEditorCliente.tsx`): el
  build la baja de Google al compilar.
- **Un diseño viejo puede tener un `meta.presetId` en kebab-case** (`instagram-post`): desde la tanda 2 hay UNA lista
  de tamaños (`dialogs/resizeSizes.ts`, ids camelCase) para Redimensionar, el popover de la página y el Inicio. El
  `presetId` es sólo un dato; nadie lo busca.

## Sumar ~65 mil líneas al repo subió el piso de RAM de CADA push

**Vive en:** `scripts/typecheck-lock.mjs` (`CAP_HEAP_MB`) · AGENTS.md

El 14/10 el typecheck completo del pre-push con el Image Editor adentro murió a los 285 s por «heap out of memory» (Mark-Compact 4083 → 4079 MB), sin un solo error de tipos. El orquestador subió `CAP_HEAP_MB` de 4096 a 5120 (`96e66c4b`) y con eso entró (`353c81a8`). Con más heap, el piso de RAM libre que pide el lock también sube: cada push de cualquier chat paga el port.

- Diagnóstico obvio equivocado: «el push falla por tipos». El síntoma de un heap corto es un exit sin errores impresos o el mensaje de V8, no un `error TS`.
- Si el editor sigue creciendo, la salida no es subir el tope otra vez: es sacar del typecheck completo lo que no cambia (el port de Doory podría ir con su propio tsconfig y un chequeo acotado), decisión de infra a tomar con Martín.

## Lo que quedó SIN hacer (con el archivo donde vive)

- **Verificar el editor abierto en el navegador** (crear, texto, imagen, descargar PNG/PDF): la tanda 2 (el
  re-vestido de Canva) se escribió y pasó typecheck y tests, pero NADIE la vio dibujada.
- **ESLint de Doory:** `_doory/editor/ui/ColorPicker.tsx:46` hace `setState` dentro de un efecto (venía de Doory). Si
  el pre-push pasa ESLint por `_doory/`, frena ahí.
- **Lo de Canva que Doory no trae** (tanda 5): notas adhesivas, dibujo y tablas (`drawers/ToolsPanel.tsx`), copiar
  estilo, líneas en codo/curva, texto alternativo, descargar la selección, bloquear/ocultar página, «Ir a la página».
- **Del armazón:** la vista rápida al pasar el mouse por el riel y la pestaña «Estilos» de Diseño
  (`chrome/RielCanva.tsx`); la mini-barra pegada a la selección (falta la posición en pantalla del objeto); las marcas
  de la regla con la posición del elemento (`workspace/Rulers.tsx`); el «⋯» por mosaico de la cuadrícula
  (`workspace/PageGrid.tsx`); «Editando ▾» y el avatar (no hay modos ni co-edición); en Proyectos, «Carpetas».
- **El texto del lienzo de las 10 plantillas sigue en inglés** (`mako/plantillas/*.json`): traducirlo pide volver a
  dibujar las miniaturas (`public/cv/plantillas/*.webp`), y eso necesita navegador.
- **Las fuentes salen de jsDelivr**, no de un almacenamiento propio (tanda 4).
- **El relevamiento de FUNCIONES de Canva no se escribió**: el agente se cortó con la caída de la app
  del 14/10 09:10. Falta `docs/editor-imagen/relevamiento-canva-funciones.md`.
- **Supabase** (tabla de diseños + bucket), **API de MaKo**, **Estrellas `formato_imagen`**.
- **«Presentar con notas»** abre `presenter-view.html`, que en MaKo no existe (`_doory/editor/presenter/channel.ts`).
- **Una pestaña de Canva** («Diseño sin título - Presentación», `canva.com/design/DAHX-ICTUd4`) quedó
  abierta en el grupo de pestañas de los agentes: la abrió el relevamiento de funciones antes de cortarse.
  Si lo creó en la cuenta de Martín, hay que mandarlo a la papelera a mano.
