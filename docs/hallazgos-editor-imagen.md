# Hallazgos — Image Editor (el Canva de MaKo sobre Doory)

El plano está en [diseno-editor-imagen.md](diseno-editor-imagen.md) y los relevamientos en
[editor-imagen/](editor-imagen/). Acá va lo que costó: síntoma → causa → dónde vive → la regla.

⚠️ **El plano y el comentario de las plantillas estuvieron VIEJOS, y ya costaron una vez** (corregidos el 6/11/2026,
`punta/imagen-docs-al-dia`). `diseno-editor-imagen.md` describía `inicio/` y `mako/registro.ts` (con un `ProyectosPanel`)
como si existieran —ninguno de los dos existe: la pantalla de arranque es `app/_crear/PantallaCrear.tsx`, y el `grep` de
`ProyectosPanel` sobre `app/` y `lib/` da **cero**—, apuntaba a `styles/tokens.css` cuando el archivo es
`_doory/styles/tokens.css`, y su regla de colores seguía diciendo que el re-vestido cambia los valores «por la paleta medida
de Canva» cuando desde el 29/10 los `--cv-*` **son los de MaKo**. El comentario de `mako/plantillas.ts` decía dos cosas
falsas: «el crédito ya se muestra» (Martín borró `editor/CreditoDoory.tsx` el 29/10) y «el TEXTO del lienzo sigue en inglés»
(`b9a7dae2f`, 14/10: los diez documentos en español y las miniaturas redibujadas — `bold-sale-announcement.json` dice «FIN
DE TEMPORADA»).

Tres cosas que esto deja, y la tercera es la que no se ve:

1. **Un plano que miente no es inerte: PRESCRIBE.** Esa misma nota del inglés ya hizo que un plan repitiera el error una vez.
   Un documento con el porqué viejo se lee como una decisión vigente y se programa sobre él.
2. **Lo que delata a un plano viejo es un `ls`, no una lectura.** Las cuatro afirmaciones falsas se cayeron con `ls` y un
   `grep` de un minuto. Cuando un documento nombra una carpeta o un archivo, verificar que exista cuesta menos que leerlo.
3. ⚠️ **Y la lista de encargos del 6/11 también estaba vieja, en las dos direcciones.** Decía que el documento «todavía habla
   de Noto Sans y del violeta de Canva»: **«Noto Sans» no aparece ni una vez** en el archivo. Y no mencionaba tres de las
   cuatro cosas que sí estaban mal. Un encargo es una medición con fecha igual que cualquier otra: se verifica contra el
   árbol antes de trabajarlo, y lo que sobre o falte se corrige en el mismo commit.

---

---

## El chat del editor no editaba en el espacio de MaKo, y el audio escondía «Enviar» (12/11/2026)

**El chat.** En el ws 9, todo pedido al chat de un diseño (por texto o por audio) contestaba «Tu IA está conectada pero no pudo editar
el diseño ahora mismo… (image-editor-ia: openai no contestó y esta feature no se degrada ni se paga…)». `image-editor-ia` y
`marca-leer` son `deSuIA` con `fallback: []`: «su Claude o su GPT, nunca Gemini». La cascada leía `fallback: []` como «un solo
modelo, tampoco el crédito de Claude» (lib/anthropic.ts y `puedeUsarUnaCuentaDelCredito`, lib/veto-claude.ts), una regla pensada
para juicios medidos con UN proveedor (cs-sesion). En el ws 9 no hay «su IA»: queda la OpenAI de la plataforma, sin saldo. **Regla:**
`fallback: []` significa dos cosas distintas según `deSuIA`; para «su IA», el crédito de Claude del espacio de MaKo vale (es Claude).
Un negocio sigue sin el crédito. Test: tests/credito-plataforma.test.ts (3), roto a propósito.

**El audio.** Después de grabar, la barra (borrar · escuchar · seguir · enviar) pedía 363 px en una tarjeta de 316: «Enviar audio»
quedaba en 413→457 con el corte en 416. Dos causas, y la primera sola NO alcanzaba (medido inyectando la regla en producción):
- `.pie` era una grilla sin columnas: la implícita mide lo que mide su contenido (375 px);
- con la columna en `minmax(0, 1fr)`, la caja SEGUÍA en 375: `.co-caja` tiene `margin-inline: auto`, y un elemento de grilla con
  márgenes automáticos no se estira, se mide «a su contenido». Hace falta `width: 100%` en la caja.
Con las dos, «Enviar audio» queda en 354→398. El Video Editor tiene el mismo síntoma con otra hoja (`centro.css`): ahí no se tocó.

**La transcripción** de una nota de 4,5 s tardó ~105 s con «Enviando…» (`/api/plan-dictado`); salió exacta. No es de Image.

---

## «Replicar» y «Usar plantilla» sin preguntar, y el editor en el teléfono (12/11/2026, segunda vuelta)

**Sin preguntar** (memoria `replicar-deja-todo-escrito`): «Editar» arranca a escribir con lo de por defecto
(`respuestasPorDefecto`, lib/carruseles/guiado.ts: la oferta principal, su cara, sólo los textos) y lo demás va DESPUÉS, al lado
de «Abrir el diseño» («Para «otra oferta»», «Sin mi foto», «Con mis colores»; cada uno es otra vuelta del armado). Las preguntas
quedan para «Cambiar algo». ⚠️ El pedido se congela por su VALOR: la lectura de «¿tiene persona?» termina mientras se arma, cambia
`hechos`, y con un pedido recalculado por referencia el armado arrancaba de nuevo a la mitad.
«Usar plantilla» (una con contenido: un carrusel por tipo o una plantilla real; un formato en blanco no) abre con `?escribir=1` y el
chat de MaKo escribe cada texto de guía para el negocio (`conNegocio`: el chat de siempre no lleva el negocio, son tokens) con
[DATO: …] donde falte, y como la plantilla está sin tocar la deja escrita sin «Aceptar». La dirección pierde el `escribir` en el
acto: recargar no escribe encima.

**El teléfono:** el encabezado de cada página medía 372 px con la página en 279 y la pantalla en 375: el último ícono quedaba
afuera. ⚠️ **No era el mínimo de 372: era una regla que nunca ganó.** `@container (max-width: 440px) { .meta { display: none } }`
estaba ARRIBA de `.meta { display: inline-flex }` con la misma especificidad, así que el tamaño («1080 × 1350 px») no se iba nunca,
y por eso alguien había subido el mínimo a 372. Con `.header .meta` la regla gana, y el mínimo baja a 260. Medido inyectando las
reglas en producción. La barra de abajo pedía 477 px en 375 («Herramie…»): repartida por contenido y sin el piso de 60 px, entra.
Una regla de un `@container` ubicada antes que la regla base, con la misma especificidad, no hace nada: se mira el orden.

---

## El panel «Diseño» estuvo vacío cinco días: el buscador nunca encontraba nada (11/11/2026)

**Síntoma:** en el editor, el panel «Diseño» mostraba un buscador y «Todas las plantillas», y buscar «lista» contestaba «Ninguna
plantilla coincide con “lista”», aunque «Lista o tips» existe en «Nuevo diseño». La prueba de Image del 10/11 lo marcó
(docs/pruebas/image-10-11.md, caso 17).

**Por qué:** el 6/11 se borraron las 10 plantillas de Doory (material ajeno con licencia de atribución) y `servicioPlantillas`
quedó devolviendo vacío a propósito, con un test que lo fijaba. Lo que había que proteger era que no volvieran las de Doory, no
que el panel quedara vacío. Un vacío fijado por un test se vuelve permanente sin que nadie lo decida.

**La regla:** el panel sirve las plantillas REALES de MaKo (`app/image-editor/mako/plantillas.ts`), las mismas de «Nuevo
diseño». La tarjeta se dibuja con `MiniaturaDiseno` a partir de su estructura (`muestra`), porque no tienen imagen, y aplicarla
pone la estructura con ids nuevos. El test 3 de api-mako-imagen sigue cuidando que no vuelva ninguna de Doory, y
tests/image-panel-diseno.test.ts fija el panel lleno. **Sin hacer:** los carruseles por tipo no están en el panel, porque su
documento sale con la marca y el kit del negocio, que se leen en el server.

## Lo que quedó SIN hacer de los 33 encargos del editor y los 18 de Thumbnails (6/11/2026)

El barrido del 6/11 dejó 33 encargos del Image Editor y 18 de Thumbnails. Esto es lo que NO se hizo, con el archivo donde
vive y, cuando lo hay, el motivo por el que no alcanzaba con sentarse a escribirlo. **Lo primero son las tres correcciones
a la lista**, porque una lista vieja hace trabajar de más:

### La lista del 6/11 estaba vieja en tres lugares

- **Siete de los 18 encargos de Thumbnails ya estaban hechos** cuando se escribieron: cinco pedían «cargar la biblioteca»
  (ids 9, 132, 138, 199, 378) y dos «curarla» (133, 139). Medido con `estado` contra producción: **79 canales activos, 14
  excluidos, 1.520 miniaturas visibles, 0 vencidas**. La lista es una foto; antes de trabajar un encargo, el comando que lo
  mide.
- **Los números del documento de Thumbnails también estaban viejos** (85 canales / 1.643 miniaturas / 8 excluidos, del
  momento de la carga). Corregidos.
- **El encargo del plano del editor (id 166) pedía sacar cosas que no están y no nombraba tres de las cuatro que sí
  estaban mal.** «Noto Sans» no aparece ni una vez en `diseno-editor-imagen.md`. El detalle, arriba.

### No alcanza con programarlo: lo tiene que decidir o firmar Martín

- **El múltiplo de Thumbnails (y el orden de la vidriera)** espera la **enmienda III.L** de las Developer Policies de
  YouTube — un trámite, no código. Hasta que se firme, el orden es «Más vistas» y las vistas crudas **no son comparables
  entre mercados**: por eso hubo que excluir 14 canales a mano, y por eso **excluir a mano no escala** (cada relectura
  mensual trae videos nuevos de los mismos canales). `lib/thumbnails/explorar.ts` (`ENMIENDA_III_L`), y los números en
  [hallazgos-carruseles.md](hallazgos-carruseles.md).
- **Las diez caras de referentes borrosas** (encargo 544) piden **exportar el original desde Canva**, que es la cuenta de
  Martín. Medido: los 32 archivos de `public/asesores/grandes/` están los 32 a 600×600, así que **el problema no es la
  medida sino el origen** — diez son los 200×200 de Canva escalados. Vive en `public/asesores/grandes/` y
  `lib/asesores/catalogo.ts`; hay una punta abierta de otro chat (`punta/gurus-diez-caras`).
- **Reescribir el editor prestado para que la licencia deje de aplicar** (encargo 145): 444 archivos y ~39 mil líneas en
  `app/image-editor/_doory/`. Es un programa de trabajo, no una tarea; el orden medido está en el propio encargo.

### Se puede programar, y por qué no se hizo en esta tanda

- ⚠️ **Borrar la co-edición (encargo 146) NO es borrar una carpeta, y el encargo lo describe como «la forma más barata y
  rápida».** Medido: además de los 18 archivos de `_doory/editor/collab/`, **20 archivos de afuera la referencian** —
  `EditorApp.tsx`, `EditorProvider.tsx`, `engine/editor.ts`, `engine/persistence.ts`, `TopBar.tsx`, `SaveStatus.tsx`,
  `chrome/FollowBadge.tsx`, `chrome/PresenceStack.tsx`, `workspace/PresenceLayer.tsx`, `panels/AnimatePanel.tsx`,
  `panels/NotesBar.tsx`, `dialogs/Presenter.tsx`, `strings.ts` y más. Sacarla es desenchufar 20 call sites del editor que
  el cliente abre, y el veredicto de que quedó bien es un typecheck. **Sigue valiendo la pena** (son 4.396 líneas con
  licencia ajena que no corren) y entra en una tanda con el typecheck acotado a mano, no en una pasada a ciegas.
- **Borrar las diez plantillas de Doory** (encargos 155 y 548, el mismo): toca el panel, la API y **tres tests, dos de los
  cuales se rompen a propósito** (el 1 de `plantillas-crear`, «primero lo en blanco», y el 5, la lista literal
  `PLANTILLAS_NUEVO_DISENO`). Se reescriben, no se fuerzan — y eso pide correr los tests, que es justo lo que no se pudo.
  `app/image-editor/mako/plantillas/`.
- **El `window.prompt` para renombrar un diseño** (encargo 153): `ImageEditorCliente.tsx:115` y
  `carruseles/ExplorarCarruseles.tsx:213`. La referencia está en el repo (el Web Generator ya edita en el lugar), así que
  acá no hace falta ir a buscar una app de afuera.
- **Las fuentes del editor se bajan de jsDelivr** (encargo 148): 499 variantes de afuera, un archivo frío tardó 12,6 s y el
  motor corta a los 8 (`LOAD_TIMEOUT_MS`), así que el texto cae a la fuente del sistema **sin un solo error**. La regla que
  ya está pagada: **nada de `next/font/google`** (rompió el build de producción de todos los chats el 15/10, porque baja la
  fuente AL COMPILAR); si hace falta, `next/font/local` con el `woff2` en el repo.
- **Un logo SVG que el cliente sube se guarda rasterizado** (encargo 152): el bucket no acepta SVG (es un documento activo
  bajo nuestro dominio) y el adaptador lo dibuja a PNG (`mako/nube.ts`, `aRaster`). Conservarlo vectorial pide sanearlo en
  el server y servirlo **desde un origen sin cookies**, que es una decisión de infraestructura.

### Lo que sólo se cierra MIRÁNDOLO (y por qué no se pudo acá)

Cinco encargos del editor (167, 412, 407, 164, 157/406) y tres de Thumbnails (143, 200, y la prueba de «Editar» de 142/380)
no son código: son **mirar la pantalla en producción** o **correr la prueba con la IA de verdad del ws 3**. Los tres de
Thumbnails dependen de la biblioteca cargada, que ya lo está.

⚠️ **Y el obstáculo de esta ventana, que conviene anotar porque se va a repetir:** la PC estuvo entre **1,3 y 2,3 GB de RAM
libre** durante toda la tanda (10-20 chats sobre el mismo clon), y la guardia de RAM bloquea `tsc` y `node --test` por
debajo de 3 GB — con razón: lo que protege es que no se caigan todos los chats a la vez. El `typecheck-lock` esperó su turno
10 minutos y después 15 más por RAM. **Lo que sí se pudo** fue pushear a `punta/…`: desde el 15/10 el pre-push sólo corre el
`tsc` local cuando el push va a `main`, así que a una punta corren sólo las guardas baratas y el chequeo de verdad lo hace
GitHub Actions, que tiene su propia RAM. Para una tanda así, **la secuencia es punta + Actions, no esperar la RAM**; lo que
no se puede delegar es la prueba que necesita la base o una clave (los scripts de la PC), y eso sí espera.

## MaKo toma la iniciativa en el Image Editor: «¿Dónde lo vas a publicar?» con el diseño en blanco (5/11/2026)

- **Qué hace:** con una página sin nada y la charla vacía, el chat del editor pregunta un hecho; «En una historia» (1080×1920),
  «En un carrusel» (1080×1350) o «En un anuncio» (1080×1080) ponen el lienzo a esa medida con `editor.pages.resize`, el mismo del
  panel de tamaño: sin IA y sin la app de escritorio. Lo contestado vale para ESE diseño. Mientras habla, el saludo y las
  píldoras se esconden.
- **Lo que no se ve en el plan:** la apertura lleva su botón de callar y como mucho cuatro botones (`MAX_BOTONES`), así que de
  los cuatro lugares del plan quedó afuera la miniatura de YouTube (sigue en el panel de tamaño).
- **«En blanco» se lee del documento** (`s.doc.pages.length === 1 && s.doc.pages[0].objects.length === 0`): un diseño de varias
  páginas vacías no es «en blanco», es uno que alguien empezó a armar.
- **Vive en:** lib/aperturas/image.ts, app/image-editor/mako/chat/PanelMakoIA.tsx. **Lo fija:** tests/iniciativa-image.test.ts
  (2 roturas).
- **Falta:** «la sugerida de esa familia» (llega con las plantillas de plantillas-reales, README §3.3), guardar el slug de la
  plantilla, y la guía de la pestaña (anclas por `donde` sobre sus `data-testid`, guia.md §6).

## La licencia de Doory obliga a mostrar el crédito, y modificar el código no la saca

**Vive en:** `app/image-editor/_doory/LICENSE-DOORY` (`editor/CreditoDoory.tsx` se borró el 29/10/2026)

> **29/10/2026, Martín decidió sacar el crédito visible, a su riesgo. El código de _doory/ se va reemplazando de a poco; cuando no quede nada suyo, la licencia deja de aplicar.** Martín, textual: «Borra igualmente la mención a Doory, iremos cambiando de a poco
> el código de allí, pero no quiero tenerla, es mi decisión y a mi riesgo». El LICENSE, el NOTICE y el COMMIT siguen en
> `_doory/` y no se muestran; tests/image-editor-integracion.test.ts (2) frena si el crédito vuelve a la pantalla. Lo que
> falta para que la licencia deje de aplicar: «Reemplazar _doory/ de a poco», abajo. Lo de esta entrada es el porqué.

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
- Regla (14/10 al 29/10/2026): el cartel no se sacaba. Desde el 29/10, ver el recuadro de arriba.

## Reemplazar `_doory/` de a poco: por dónde empezar (29/10/2026, claude3)

Para que la licencia deje de aplicar no tiene que quedar código de Doory. Hoy `_doory/` son 444 archivos (~39 mil líneas
de editor). Medido con `git log --since=2026-10-14 --name-only -- app/image-editor/_doory`, lo que MaKo más tocó desde el
port, y su tamaño:

| Orden | Parte | Archivos / líneas | Por qué primero |
|---|---|---|---|
| 1 | `editor/chrome` (TopBar, RielCanva, SaveStatus) | 8 / 630 | Ya es el armazón de Canva escrito por MaKo encima; chico |
| 2 | `editor/strings.ts` | 1 / 1.509 | Todos los textos ya son nuestros (en español); se reescribe como tabla propia |
| 3 | `editor/workspace` (BottomBar, PageGrid, PageStrip, Workspace) | 34 / 4.053 | 11 archivos tocados; la barra de abajo y el lienzo ya se rehicieron en parte |
| 4 | `editor/panels` (TemplatesPanel, registry, los paneles) | 41 / 4.866 | 19 tocados: el catálogo y las plantillas ya son de MaKo (`mako/`) |
| 5 | `editor/dialogs` y `editor/ui` | 57 / 5.521 | 32 tocados (Descargar, los menús) |
| 6 | `editor/toolbar`, `drawers`, `fonts`, `presenter` | 58 / 6.617 | Menos tocados |
| último | `editor/engine` (el envoltorio de fabric.js) | 107 / 14.924 | El corazón: lo más grande y lo menos tocado |
| ~~se borra~~ **hecho (6/11)** | `editor/collab` | 19 / 4.436 | La co-edición está apagada (decisión 6 de docs/diseno-editor-imagen.md): borrarlo no es reemplazarlo. Borrada en `punta/collab-fuera`: 41 archivos y 5.470 líneas, porque el motor tenía la costura (abajo, «Borrar la co-edición no era lo más barato») |

Cada parte reemplazada se escribe desde lo que hace (el comportamiento de Canva), no copiando y renombrando su código:
renombrar no deja de ser derivado.

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

- **Ya no aplica desde la tanda 3 (14/10):** el panel lee `/api/image-editor/disenos`, y el workspace lo decide el
  server con el `?ws=` que `WsFetch` le pone al pedido. No hay base local que elegir.

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

## Un paquete «instalado en la máquina» no es un paquete del proyecto: el deploy de main murió por `qrcode`

**Vive en:** `package.json` · `tests/image-editor-dependencias.test.ts`

El primer deploy con el editor (`353c81a8`) quedó en Error: «Module not found: Can't resolve 'qrcode'». El QR de Doory lo importa y en el `node_modules` del clon estaba instalado SUELTO por otra sesión (extraneous): local compilaba, el typecheck pasaba y Vercel, que instala desde el lock, no lo tenía. Mientras no entró el arreglo (`fac319092`, del orquestador), todo deploy de main fallaba para todos los chats.

- Al portar código, la lista de dependencias sale de BARRER sus imports contra `package.json`, no de lo que compila en la máquina: un paquete suelto de otra sesión tapa el faltante.
- Lo fija `tests/image-editor-dependencias.test.ts` (probado: sin `qrcode` en package.json falla nombrándolo).

## Sumar ~65 mil líneas al repo subió el piso de RAM de CADA push

**Vive en:** `scripts/typecheck-lock.mjs` (`CAP_HEAP_MB`) · AGENTS.md

El 14/10 el typecheck completo del pre-push con el Image Editor adentro murió a los 285 s por «heap out of memory» (Mark-Compact 4083 → 4079 MB), sin un solo error de tipos. El orquestador subió `CAP_HEAP_MB` de 4096 a 5120 (`96e66c4b`) y con eso entró (`353c81a8`). Con más heap, el piso de RAM libre que pide el lock también sube: cada push de cualquier chat paga el port.

- Diagnóstico obvio equivocado: «el push falla por tipos». El síntoma de un heap corto es un exit sin errores impresos o el mensaje de V8, no un `error TS`.
- Si el editor sigue creciendo, la salida no es subir el tope otra vez: es sacar del typecheck completo lo que no cambia (el port de Doory podría ir con su propio tsconfig y un chequeo acotado), decisión de infra a tomar con Martín.

## «No veo la tab»: los dos diagnósticos obvios estaban equivocados

**Vive en:** `lib/nav-visibilidad.ts` (`puedeVerItem`, `resolverTab`) · `lib/capas.ts` (`tabEnCapa`) · AGENTS.md ·
`tests/image-editor-integracion.test.ts` 1c

Martín, 14/10: «No veo la tab en la sidebar principal, debería estar en la sección de Content Machine».

- ⚠️ **Falso 1: «`adminOnly` se apaga mirando un cliente; que la fila pregunte por la persona».** Se hizo (una marca
  `soloSuperAdmin`) y se descartó sin pushear: mirando un cliente la barra es la del cliente, sin lo que es sólo del
  super admin, y es una regla de Martín (01/08: «tampoco las tabs que no están disponibles en los usuarios y solo en
  super admin»; docs/hallazgos-seguridad.md). Quedó en la rama `opcion-image-en-clientes` por si él la quiere.
- ⚠️ **Falso 2: «la capa `superadmin` no trae la key en `navKeys`».** Así lo decía AGENTS.md, pero `tabEnCapa` une
  `navKeys` con `userNavKeys`, y en esa capa `userNavKeys` es `null`: deja pasar CUALQUIER key. Ya lo habían anotado
  Customer Success y Ads; la regla vieja de AGENTS.md lo seguía sembrando, y se corrigió.
- **Lo medido:** con `resolverTab`, en su barra (capa `superadmin`) la tab lleva a `/image-editor`; mirando un
  cliente, `null`. El deploy con el editor (13:33) estaba Ready en hola-mako.com. O sea: o miraba un cliente con
  `?ws=`, o tenía abierta una pestaña de antes del deploy (el JS viejo no se recarga solo al navegar).
- **Medido en el DOM el 15/10** (la `Sidebar` real montada en un banco de esbuild con tres sesiones simuladas por
  `/api/auth/me`): con Content Machine abierta, la fila «Image» estaba para el super admin en su cuenta y NO
  mirando un cliente ni para un admin de cliente. Y con Content Machine PLEGADA no está para nadie: la barra es un
  acordeón, una familia cerrada no dibuja sus filas, y en una captura con la barra angosta no se distingue de una
  familia que no existe. El Chrome desde el que Martín miraba tenía la sesión de un admin de cliente (ws 10).
- **Lo que se decidió:** «Que Image aparezca en todos los workspace» (15/10). Se sacó `adminOnly` de las cuatro
  secciones, el guard pasó a la pregunta de toda tab y la barra de secciones marca «pronto» como la lateral. Medido
  después en el mismo banco: la fila está para las tres sesiones. La rama `opcion-image-en-clientes` quedó sin objeto.

## Verificar el editor sin el dev server: un banco con esbuild y Chrome sin ventana

**Vive en:** fuera del repo (el scratchpad de la sesión del 14/10) · la receta, acá

`next dev` pasa los 5 GB al compilar el editor y el vigía lo mata, y la extensión de Chrome no llega a localhost.
Lo que sí anduvo (14/10, tarde): **compilar sólo la cáscara del editor con esbuild** (`node_modules/esbuild`, 40 s
con la máquina tranquila, 185 s llena) y abrirla en el Chrome del sistema sin ventana (`--headless=new
--mute-audio`, perfil propio, CDP crudo con el `WebSocket` de Node 24). Cuatro stubs reemplazan a Next:
`next/dynamic` (un `lazy`), `next/font/google` (un objeto con `variable`), `next/navigation` y `@/app/_ui/Link` (la
ruta va en el hash); `@/` se resuelve contra el worktree con un plugin y los `.module.css` los entiende esbuild solo.
Con eso se verificó TODO lo que hace el navegador: crear, texto, plantilla, imagen soltada, guardar y reabrir, PNG
y PDF, la vista del presentador en una segunda ventana y, con la API de la entrada siguiente, la base.

- No ve la cáscara de MaKo (barra lateral, guard, `?ws=`): eso se mira en producción con la sesión de Martín.
- Una imagen se «suelta» con un `DragEvent` armado en la página (un `DataTransfer` con un `File`): el selector de
  archivos de Doory es un `<input>` suelto que CDP no alcanza sin interceptar el diálogo.

## Probar un módulo `server-only` sin Next: el diagnóstico obvio rompía React

**Vive en:** `lib/image-editor/server.ts` · la receta, acá

Para probar las funciones del server contra la base sin `next dev`: `runWithWorkspace(ws, fn)` (lib/workspace.ts)
fija el workspace sin request (`getWorkspaceActual` lee primero ese contexto) y `dotenv` carga el `.env.local`.
Lo que frenaba era `import 'server-only'`, que tira fuera de un server component.

- ⚠️ **Diagnóstico obvio equivocado: `node --conditions=react-server`.** Resuelve `server-only` a vacío, pero
  también cambia el React que se carga, y `next/navigation` (que entra por `acceso.ts`) muere con
  «`createContext` is not a function».
- ⚠️ Un hook ESM (`module.register` con `resolve`) **no lo ve**: tsx compila el `.ts` del repo a CommonJS y el
  `require('server-only')` no pasa por ahí.
- Lo que anda: `--require` de un `.cjs` que parchea `Module._resolveFilename` para que `server-only` dé un módulo
  vacío, y `--import tsx`. Así corrió la prueba de 23 pasos de la tanda 3 (ws 3, borrando todo al final), y el
  mismo truco le dio al banco una API que llama a `lib/image-editor/server.ts` sin Next.
- `after()` de `next/server` tira fuera de un request: `firmarSubida` lo envuelve y barre sin esperar.

## «Vista de presentador» abría un 404: era una página del build de Vite

**Vive en:** `app/image-editor/_doory/editor/presenter/channel.ts` (`presenterViewUrl`) · `app/image-editor/presentador/`

Doory abre las notas del presentador en una segunda ventana en `presenter-view.html`, otra entrada de su build de
Vite (`presenter/view/main.tsx`). Al portar sólo el editor, esa página no existía y el botón daba 404. Ahora es la
ruta `/image-editor/presentador` (mismo guard, sin la cáscara de MaKo, como `/integraciones/escuchando`); la vista
habla con el editor por `BroadcastChannel`, así que no necesita server.

- Regla: al portar una app de Vite, buscar sus OTRAS entradas (`*.html` del build, `main.tsx` sueltos): lo que el
  editor abre con `window.open` no lo ve el typecheck. Lo fija el test 5 de `tests/image-editor-integracion.test.ts`.

## La tanda 3 (los diseños en la base): lo que costó

**Vive en:** `supabase/migrations/0278_image_editor_disenos.sql` · `lib/image-editor/` · `app/api/image-editor/` ·
`app/image-editor/mako/{nube,adaptadorNube,mudanza}.ts`

- **El id es un uuid, no un identity**: el motor nombra los diseños con uuid y un diseño que estaba en el navegador
  sube con SU id. Así el alta es **idempotente por id** (si ya está, contesta el que hay sin pisarlo): una mudanza
  cortada se reintenta sin duplicar, y recién con el alta confirmada se borra la copia local.
- **El server rechaza un documento con `idb://` o `blob:` (422)**: en otra máquina sería un hueco. El adaptador
  sube esos `src` antes de guardar y recuerda lo subido (el documento en memoria sigue diciendo `idb://` hasta
  reabrir). Una imagen local que ya no está sale del documento con un aviso (la función es la de Doory,
  `removeMissingAssetReferences`).
- **El bucket público de Supabase manda `Access-Control-Allow-Origin: *`** (medido): el lienzo carga las imágenes
  con `crossOrigin: 'anonymous'` y el PNG sale con la imagen remota adentro. Una URL firmada habría vencido y
  matado el caché.
- **SVG y AVIF no entran al bucket** (un SVG es un documento activo bajo el dominio de Supabase): el adaptador los
  dibuja a PNG en el navegador antes de subir. Canva conserva el SVG vectorial; acá se pierde (pendiente abajo).
- **La miniatura pisa siempre el mismo archivo** y la URL guardada lleva `?v=<ms>`: sin eso el CDN sirve la vieja.
  Sube cada 15 s como mucho (lo del Doory original); no frena el guardado si falla.
- **Un MP4 y un M4A comparten firma (`ftyp`)**: `sniffArchivo` los trata como `audio/mp4`; un HEIC también tiene
  `ftyp` pero no está en la lista del bucket, así que no se puede firmar.

## ESLint de `ColorPicker`: no frena nada

**Vive en:** `_doory/editor/ui/ColorPicker.tsx:46` · `.git/hooks/pre-push`

Quedó anotado como riesgo («si el pre-push pasa ESLint por `_doory/`, frena ahí»). Medido el 14/10: el pre-push
corre tipos, el contrato de las skills y el snapshot de la API, **no ESLint**, y `next build` 16 tampoco lintea.
El `setState` en el efecto es el patrón de Doory para resetear el selector cuando cambia el objeto; se deja.

## Las plantillas en español: un texto más largo desborda su caja, y eso se MIDE

**Vive en:** nada ya — las 10 plantillas de Doory, sus WebP y los dos scripts que las traducían se borraron el
6/11/2026 (ver «Sacar las de Doory tocó SIETE archivos de test»). Queda por lo que enseña de medir un texto con su
fuente: lo usa `lib/image-editor/plantillas-reales.ts`, que genera sus medidas con el mismo criterio.

El 14/10 el texto del lienzo de las 10 plantillas pasó a español neutro (89 textos, por igualdad exacta con el
original; un texto en mayúsculas guarda el original en `caseSource` y se traduce ése). En la hoja de contactos de las
miniaturas redibujadas, dos se rompían: «OFERTA» (por «SALE») se cortaba en «OFERT» y «al atardecer» (por «Sessions»)
se montaba sobre los datos. No se adivina el tamaño: se mide con la fuente real (`measureText` con la fuente de
jsDelivr cargada en la página): «OFERTA» en Anton a 500 px = 1321 px contra 990 de caja → 360 px (951, el aire que
tenía «SALE»); «al atardecer» en Playfair itálica a 190 px = 969 contra 920 → «al ocaso» (639).

- Las miniaturas salen del propio editor: cada plantilla (su primera página) se abre en el banco, se «descarga» en PNG
  capturando el `Blob` de `URL.createObjectURL`, y en la misma página se baja a WebP de 720 px de lado mayor.
- Regla: traducir una plantilla = mirar la hoja de contactos; un texto que no entra se arregla en `AJUSTES` con la
  medida escrita, no a ojo.

## `next/font/google` rompió el build de producción con el mismo código que antes compilaba

**Vive en:** `app/image-editor/fuenteUi.tsx` (desde el 15/10, sin `next/font`)

El 15/10 el build de Vercel de `ea8cfdec1` (y su redeploy) murió con «next/font/google queries have exactly one entry»
· «Can't resolve '@vercel/turbopack-next/internal/font/google/font'», con la traza en
`presentador/PresentadorCliente.tsx` → `noto_sans_….module.css`. Frenó los deploys de todos los chats.

- ⚠️ **Diagnóstico obvio equivocado: «es el código» o «es que un `'use client'` importa la fuente y la página es
  server».** Entre el último verde (`5d0e97e9b`) y el rojo había UN solo commit, sin fuentes ni dependencias, y el
  presentador se montaba así desde el día anterior con varios deploys verdes. Lo que cambió fue el build:
  `next/font/google` baja la fuente de Google AL COMPILAR. El typecheck y los tests no lo ven nunca.
- **Arreglo:** Noto Sans entra como hoja de Google desde el navegador (`<FuenteUi />`, un `<link precedence>` que React
  19 sube al head y deduplica), como las demás fuentes del repo (`app/layout.tsx`). `tokens.css` ya caía a 'Noto Sans'.
- Regla: nada de `next/font/google` en el editor. Si alguna vez hace falta alojar la fuente, `next/font/local` con el
  woff2 en el repo, nunca algo que pida una red ajena para compilar. `app/chats/fuente.ts` (Inter) tiene el mismo riesgo.

## Las plantillas sugeridas: el panel recibe PÁGINAS, así que el orden va en el servicio

Para poner primero las sugeridas para el negocio (16/10; la regla compartida en docs/plantillas-sugeridas.md, test
`tests/plantillas-sugeridas-editores.test.ts`), el lugar obvio era `TemplatesPanel.tsx`, que es donde se ven. **No
sirve:** el panel pide `templates.list({ page, page_size: 24, q, category, orientation })` y recibe UNA página ya
filtrada. Ordenar ahí ordena una página, y ordenar lo ya filtrado elige las sugeridas entre las que quedaron: con
cuatro que coinciden y tres de tope, filtrar por «Negocios» deja sola a la cuarta y la marca «Sugerido» (la rotura
que el test caza). **La galería entera se ordena una vez en el servicio** (`servicioPlantillas(senales)`,
`mako/plantillas.ts`) y cada pedido filtra y pagina lo ya ordenado.

- Las señales bajan de la page (`[diseno]/page.tsx`) por `ImageEditorCliente` → `PantallaEditor` →
  `crearAdaptadorNube({ senales })` → `serviciosCatalogo(senales)`. El panel sólo lee `suggested_reason`, un campo que
  MaKo le sumó a `TemplateSummary` (`_doory/types/api.ts`).
- El inicio no sugiere nada a propósito: su chip «Plantillas» muestra TAMAÑOS en blanco, no plantillas.
- La mitad de las 10 de Doory no dice nada de cómo vende un negocio (frase, inversores, concierto, boda, currículum,
  YouTube): van `{}` (`mako/plantillas-etiquetas.ts`), y a quien vende por llamada no se le sugiere ninguna.

## El chat «MaKo IA» (16/10): lo que no se ve en el código

Pedido de Martín por el Cerebro: «implementes este chat en todas las tabs… quiero que la app sea AI NATIVE». Es el chat
del Video Editor en el editor de imágenes (`lib/image-editor/chat/`, `app/image-editor/mako/chat/`, ruta
`/api/image-editor/ia`, hilo en `image_editor_chats`, mig 0303; test `tests/image-editor-chat.test.ts`, 40 roturas
cazadas). Lo que costó:

- **Las refs salen del HASH DEL ID, no de la posición** (el Video Editor numera `v1`, `t2`). Con la posición, agregar
  o borrar un elemento corre las refs de los demás y una propuesta de hace un rato apunta a otro. Con el hash no se
  corren; un choque alarga la que viene después en orden de id, así que sí PUEDE cambiar si entra un id que ordena
  antes y choca: por eso la propuesta guarda sus pares ref → id y no los recalcula.
- **Fabric guarda el origen donde quiere**: el texto de la fábrica de Doory está al CENTRO, una forma también, lo que
  arma el chat arriba a la izquierda. La IA ve y pide la esquina de arriba a la izquierda con la escala aplicada
  (`cajaDe`/`ponerCaja`); girar corre el origen para que el centro quede quieto.
- **Una fuente que el editor no tiene no da error: cae a la del sistema EN SILENCIO.** La IA nombra fuentes que no
  están en el catálogo; se revisan contra `FUENTES` y las que el diseño ya usa, y se descartan con su motivo. Y se
  CARGAN antes de aplicar (`editor.fonts.load`): el motor mide el texto con la que esté cargada y la caja queda corta.
- **«Restaurar» no es volver a poner el documento de antes**: eso es OTRO paso de deshacer (y con co-edición, un
  cambio local más). Es `editor.undo()`, y sólo si `state.docVersion` es la de justo después de aplicar: cualquier
  commit la sube (una edición, un undo, un documento remoto), así que igual = el paso de arriba es el nuestro.
- **El caso de las mayúsculas es del motor** (`text/case.ts`): `caseSource` vale sólo si aplicarle el caso da el
  `text` (`toggleCase`), y «ninguno» SACA `textCase` (no deja `'none'`). Se copió en `aplicar.ts` porque el server
  no puede importar `_doory` (test 4 de `image-editor-integracion`): si el motor cambia, se copia de nuevo. Lo mismo
  los valores de lo nuevo (`POR_DEFECTO`, de `objects/factories.ts`).
- **Toda ruta de `/api/image-editor` arranca con `const p = await puerta(); if (p instanceof Response) return p;`
  LITERAL** (test 5 de `image-editor-nube`): envolver la puerta en un helper que además lee la persona lo rompe.
- **El botón redondo del riel no alcanza**: debajo de 1024 px el riel no se dibuja y las pestañas van en la tira de
  abajo, que sólo lista `rail: true`. El chat no es pestaña, así que se suma al final de la tira (`CompactTools`).


- **El chat «MaKo IA», sin mirar en el navegador** (ws9): abrirlo del riel y de la tira, pedir, aceptar con una fuente
  nueva, «Restaurar», y que el hilo vuelva al recargar (`app/image-editor/mako/chat/PanelMakoIA.tsx`). La migración
  0303 la aplica el Cerebro; sin ella el chat anda y no guarda.
- **El chat en la API de MaKo** (tanda 2: sus operaciones que PROPONEN, con su tabla de propuestas) y **«entender el
  pedido»** (tanda 3: `/api/mako/pedidos` con `tab: 'imagen'` antes de la IA, como `app/video-editor/_opencut/chat/pedidos.ts`):
  sin hacer, quedaron para después del 90 % semanal de claude3. Los objetos del área `imagen` ya están en el server.
- **Lo que el chat todavía no hace** (`NO_SE_PUEDE_CHAT_IMAGEN` de `lib/image-editor/chat/catalogo.ts`): fotos e íconos,
  imágenes con IA, quitar fondo, recortar, degradados, animar, agrupar, redimensionar, plantillas.
- **«Sugerido» en el panel de plantillas, sin mirar en el navegador** (ws9, con un funnel declarado): el orden, el
  texto al lado del nombre y el `title` con el porqué (`_doory/editor/panels/TemplatesPanel.tsx`).

- **Mirarlo en producción con la sesión de Martín** (la cáscara: la tab, la barra lateral, el `?ws=`, guardar): el
  banco ve el editor, no MaKo alrededor. El lado del cliente sí se verificó en producción (14/10, sesión de Mauricio,
  admin del ws 1): página → `/crm`, API → 404 de la puerta, sin link en la barra. Ojo al leer un 401 de
  `/api/image-editor/*`: es el proxy (sin sesión), no la puerta; la puerta contesta 404.
- **Lo de Canva que Doory no trae** (tanda 5): notas adhesivas, dibujo y tablas (`drawers/ToolsPanel.tsx`), copiar
  estilo, líneas en codo/curva, texto alternativo, descargar la selección, bloquear/ocultar página, «Ir a la página».
- **Del armazón:** la vista rápida al pasar el mouse por el riel y la pestaña «Estilos» de Diseño
  (`chrome/RielCanva.tsx`); la mini-barra pegada a la selección (falta la posición en pantalla del objeto); las marcas
  de la regla con la posición del elemento (`workspace/Rulers.tsx`); el «⋯» por mosaico de la cuadrícula
  (`workspace/PageGrid.tsx`); «Editando ▾» y el avatar (no hay modos ni co-edición); en Proyectos, «Carpetas».
- **Las fuentes salen de jsDelivr**, no de un almacenamiento propio (tanda 4).
- **Marca, versiones, compartir y comentarios**: en `null` (`mako/adaptadorNube.ts`); piden tablas propias.
- **Un SVG subido se guarda como PNG** (`mako/nube.ts` → `aRaster`): para conservarlo vectorial hay que sanearlo
  en el server y servirlo desde un origen sin cookies.
- **El relevamiento de FUNCIONES de Canva** quedó escrito el 14/10 a la noche
  (`docs/editor-imagen/relevamiento-canva-funciones.md`) contra el código, SIN navegar Canva (no había Chrome para
  claude1): si alguna fila de Canva resulta distinta al mirarla, se corrige ahí.
- **Estrellas `formato_imagen`**: espera a Martín (relevamiento-integracion-mako.md §13.6). La API de MaKo se declaró
  el 15/10 (área `imagen`; lo que costó, en docs/hallazgos-api-mako.md). Exportar por la API no existe: el render es del
  navegador.
- **Una pestaña de Canva** («Diseño sin título - Presentación», `canva.com/design/DAHX-ICTUd4`) quedó
  abierta en el grupo de pestañas de los agentes: la abrió el relevamiento de funciones antes de cortarse.
  Si lo creó en la cuenta de Martín, hay que mandarlo a la papelera a mano.


**29/10/2026, plantillas reales: Lo que el editor no hace cambia cómo se diseña una plantilla.** (docs/plantillas-reales/)
- **Quitar fondo apagado:** la miniatura de manual, con la persona recortada y un contorno blanco, no se puede diseñar
  ni repetir con la foto del usuario. Las plantillas ponen la foto en un marco con máscara.
- **El chat no pone ni cambia fotos** (`NO_SE_PUEDE_CHAT_IMAGEN`): el experto pide la foto, no la cambia. Para que
  tocarla ofrezca reemplazarla, tiene que ser un marcador (`isPlaceholder` + `slot`); una `image` común no lo ofrece.
- **Claude no genera imágenes:** las skills copiables están atadas a Gemini o a Nano Banana. El experto entrega
  operaciones sobre las capas, y los «4 conceptos en grilla» quedan como 2 versiones dentro de la misma plantilla.

**Vive en:** lib/image-editor/chat/catalogo.ts · app/image-editor/_doory/editor/engine/objects/dory.ts:39-41
(`isPlaceholder?`, `slot?`) · app/image-editor/_doory/types/document.ts:138 (`SlotSpec`) · app/image-editor/mako/plantillas/

## «0 filas en `image_editor_chats`» no era que el chat no guardaba: nadie lo había usado (22/10/2026, TB2)

El relevamiento del 22/10 vio la tabla con 0 filas y sospechó que el chat no guardaba. **El diagnóstico obvio era el
equivocado.** Medido ese día en producción: en todo MaKo había 2 diseños (ws1 y ws15) y ninguno con charla. En el ws3,
desde el Chrome de Martín, un pedido en «MaKo IA» dejó su fila (2 mensajes) y recargar la trajo de vuelta. Antes de
«arreglar» un guardado que da 0, se cuenta si la pantalla de arriba tiene uso.

- **Lo que sí estaba mal: abrir el chat volvía a guardar** lo mismo que acababa de leer (la versión pasó de 2 a 3 con los
  mismos 2 mensajes). `cargarHilo` une lo leído con la pestaña por `cambiarHilo`, y todo `cambiarHilo` programaba un
  guardado. Ahora lo leído entra con `guardar: false`; lo que la pestaña escribió antes de que llegara ya marcó `sucio` y
  se guarda unido. Importa para el Ops Center (OC8): ordena por `updated_at`, y mirar un chat lo subía arriba.
- En el ws3 sin IA conectada, MaKo contesta «No hay ninguna IA conectada… con Gemini alcanza» (el texto de IA9): el
  mensaje y la respuesta igual se guardan.
- Quedaron en el ws3, para OC8: el diseño `75e60d6f-fa28-4fb0-890e-7d049472617b` con su charla (persona u1).

**Vive en:** app/image-editor/mako/chat/hilo.ts (`cargarHilo`) · tests/image-editor-chat.test.ts (41) ·
*22/10/2026, chat «Chats de las tabs».*

## El chat «MaKo IA» con las piezas del Ops Center (22/10/2026, TB3)

El hilo es `HiloMako` (con la criatura «Image Editor», la que lo nombra en el Ops Center) y la caja es `CajaChat`; el motor
sigue siendo el de app/image-editor/mako/chat/acciones.ts, que edita el diseño ABIERTO y no aplica nada sin «Aceptar». La
propuesta con «Original | Modificado» va en el hueco `enMensaje` de la respuesta de MaKo que la trajo. Dos cosas que se
perdieron a propósito: el rótulo del alcance dentro de la burbuja de la persona (`HiloMako` sólo dibuja «desde …», que dice
OTRA cosa; el alcance sigue en sus chips), y el `maxLength` del campo (la caja única no tiene tope): el tope lo pone
`enviar`, con `TOPES_CHAT_IMAGEN.instruccion`. **Vive en:** app/image-editor/mako/chat/PanelMakoIA.tsx ·
tests/editores-chat-piezas.test.ts · *22/10/2026, chat «Chats de las tabs».*

## Los colores de MaKo y la pantalla de Create: el lienzo nunca había tenido el color del tema (29/10/2026, claude3)

Martín, 29/10: «en las tabs de Editor e Image, pongas los colores de MaKo». Los `--cv-*` pasaron a los tokens de la app (claro
y oscuro), sin el violeta ni el degradé de Canva, con Geist. Y la tab monta app/_crear/PantallaCrear.tsx. Lo que costó:

- **El lienzo leía los colores donde no existen.** La selección del lienzo era SIEMPRE el violeta de Doory (`#6a52d9`):
  `readCanvasTheme` leía los `--cv-*` de `<html>`, y sólo existen en `.cv`; caía al respaldo sin un error. Además
  `watchTheme` no miraba `data-tema`: cambiar de tema no repintaba la selección. Ahora lee de `.cv` y mira el atributo
  (`_doory/editor/engine/objects/theme.ts`, `engine/editor.ts`). **Regla:** lo que el lienzo lee con `getComputedStyle`
  tiene que resolver a un hex plano (un `color-mix()` ahí se descarta en silencio).
- **Salir del editor perdía lo no guardado.** `engine.stop()` → `persistence.dispose()` limpia el autoguardado pendiente SIN
  mandarlo; el panel de Proyectos viejo lo tapaba con `saveNow` y una recarga entera. Medido en el banco: sin el arreglo, 0
  PATCH al cambiar de diseño; con él, sale. `PantallaEditor` llama `saveNow` en la limpieza de su efecto (React desmonta de
  arriba abajo: corre antes que la del hijo).
- **Lo que se portalea fuera de `.cv` no ve los `--cv-*`.** El chat (PanelMakoIA) va a la tarjeta del shell: sus estilos usan
  los tokens de MaKo. Y `[hidden]` sobre un elemento con `display:flex` en su módulo no lo esconde: hace falta
  `[hidden]{display:none}` explícito.
- **Renombrar el diseño abierto directo en la base da 409** en el próximo autoguardado (la versión): el renombre va por el
  `meta.title` del editor.
- **El banco (actualiza «Verificar el editor sin el dev server»):** con `splitting`, el CSS de los chunks perezosos no se
  enlaza solo (cada `out/*.css` va al HTML); los módulos `'use server'` se reemplazan con un `onLoad` que lee sus exports (si
  no, esbuild arrastra el server); `window.__MAKO_E2E__ = true` expone el motor para medir cosas como la del autoguardado.
- **Worktree compartido:** `git rm` deja el borrado EN EL ÍNDICE, y otro chat que commitea sin rutas se lo lleva. Se borra con
  `rm` y se commitea por ruta.

**Quedó sin hacer:** `docs/diseno-editor-imagen.md` todavía describe `inicio/`, Proyectos, Noto Sans y el violeta (reglas 2 y
9); «Cambiar nombre» usa `window.prompt` (no en el lugar, como el Web Generator: `ImageEditorCliente.tsx`); el «‹» del
editor del teléfono (`salir`) no se vio en el banco; los 30 tamaños de Canva menos usados y «Tamaño personalizado» viven
sólo en Redimensionar (`_doory/editor/dialogs/resizeSizes.ts`). Capturas del banco: `C:/dev/revisiones/create-shell-2910/`.

**Vive en:** app/image-editor/_doory/styles/tokens.css · app/image-editor/plantillas-crear.ts · app/image-editor/actions.ts ·
app/image-editor/ImageEditorCliente.tsx · app/image-editor/editor/PantallaEditor.tsx · tests/image-editor-colores-mako.test.ts ·
tests/image-editor-plantillas-crear.test.ts

## No faltaban plantillas: faltaban el ejemplo lleno y la foto (29/10/2026)

- **Síntoma:** «Nuevo diseño» se ve vacío.
- **Causa:** las 10 de Doory son de bodas, conciertos y currículums, con rectángulos grises
  (`rgba(140,128,132,0.18)`) en lugar de fotos.
- **Ojo con el comentario de cabecera:** app/image-editor/mako/plantillas.ts (líneas 12 y 13) todavía dice que el texto
  del lienzo «sigue en inglés». No: `b9a7dae2f` (14/10) lo pasó al español y redibujó las miniaturas
  (bold-sale-announcement.json dice «FIN DE TEMPORADA»). El plan lo repitió hasta la revisión.
- **Regla:** salen de «Nuevo diseño». Entran 12 de negocio high ticket, con foto y texto reales. El crédito de Doory se
  queda, porque es del código, y el comentario se corrige (image.md 5.1).

**Vive en:** app/image-editor/mako/plantillas/ · app/image-editor/plantillas-crear.ts · public/cv/plantillas/

## Una cara de stock junto a una promesa es prueba falsa (29/10/2026)

- **Causa:** la licencia de Pexels (leída) prohíbe «imply endorsement» y mostrar a alguien «in a bad light». El
  «personaje base» ficticio que daba por hecho el primer borrador no existe en el repo.
- **Lo que se pasó por alto:** la guarda de descarga cuida el diseño, pero la tarjeta de la galería
  (`public/cv/plantillas/<slug>.webp`) es pública. La primera versión ponía una cara de Pexels junto a «Pago recibido
  · USD 1,500» en la tarjeta de la miniatura 1, y rotulaba a otra como «Nutrióloga desde 2016 · 140 alumnas».
- **Regla:**
  - ninguna cara de stock va en un fracaso, en un «antes», en un testimonio ni junto a un pago, una cifra del negocio o
    una credencial; ahí va una silueta propia (`persona-silueta.webp`) hasta que existan los retratos hechos en Flow;
  - ninguna tarjeta de la galería muestra una cara de stock;
  - las fotos de muestra `persona-` y `lugar-` no se descargan sin reemplazarlas;
  - Unsplash no se usa: su licencia prohíbe compilar fotos para un servicio que compite, y su API exige hotlink.

**Vive en:** public/cv/plantillas/fotos/ · app/image-editor/_doory/editor/dialogs/DownloadDialog.tsx

## Los ids de la plantilla viajan al diseño (29/10/2026)

- **Causa:** `documentoDePlantilla` copia el JSON tal cual.
- **Lo bueno:** permite saber de qué plantilla viene un diseño, sin migración.
- **Regla:** el generador da ids estables, y las fotos de `public/cv/plantillas/fotos/` no se renombran nunca, porque
  los diseños guardados las apuntan por ruta.

**Vive en:** app/image-editor/mako/plantillas.ts · public/cv/plantillas/fotos/

## Texto, tachado y medidas: lo que el español y el motor no perdonan (29/10/2026)

- **Desborde:** «OFERTA» se cortaba en «OFERT». Cada texto se mide con la fuente real, y el experto acorta: no baja el
  tamaño de la letra.
- **Tachado:** `linethrough` usa el color del texto, así que no hay tachado rojo sobre un texto oscuro.
- **Resaltado:** una forma puesta detrás de unas palabras se desacomoda al cambiar el texto. El resaltado va en su
  propio texto, con el efecto `background`.
- **Medidas viejas:** `anuncio_facebook` es 1200 × 628 (lib/image-editor/tamanos.ts), y Redimensionar no tiene
  1440 × 1800. Los anuncios van a 1080 × 1350 y se descargan ×2.
- **Topes de palabras:** el test del plan medía solo las capas «Titular», «Texto» y «Gancho», y los ejemplos rompían
  el tope que el Diseñador le pide a la IA (la historia 8 tenía 38 palabras con un tope de 12; el anuncio 11, 56 con
  uno de 20). El tope cuenta todas las capas de texto de la página, y la plantilla que no entra en el de su formato
  declara el suyo (`topePalabras`), que viaja en `{{plantilla}}`.

**Vive en:** app/image-editor/mako/plantillas/*.json · lib/image-editor/tamanos.ts

## La investigación les atribuía a sus fuentes cifras que no dicen (29/10/2026)

- **1of10 NO dice que la cara rinda peor en «negocios».** Dice que, en general, con o sin cara rinden parecido, que
  ayuda en finanzas y que daña en salud y fitness. Por eso la versión sin cara puede ir por defecto (la miniatura 2 de
  Pulso Dental la usa porque no hay ventaja general de la cara), y las piezas de Consulta Rentable (nutrición, salud)
  van sin cara en la miniatura.
- **La legibilidad verificada** es 320 × 180 (skill MIT de miniaturas) y ~360 px para el feed. No es 120 px.
- **Regla:** cada cifra del prompt del Diseñador se relee en su fuente antes de entrar.

**Vive en:** lib/image-editor/chat/prompts.ts (`image_editor.experto`)

## La marca del negocio en Image, y el chat sin Gemini (5/11/2026)

- **Síntoma (Leila, 30/10):** los carruseles sólo tomaban el fondo de su marca. **Causa medida el 5/11:** no había dónde
  guardar la marca de un negocio. El chat de Image recibía sólo la persona y el núcleo de MaKo (`brandSystem`), y los
  carruseles de MaKo salían con el estilo fijo de su tipo y las iniciales del negocio.
- **Lo que quedó:** kits de marca en `app_settings` (`marca.kits`, sin migración: 30 kits como mucho, sin bytes; el logo es un
  archivo de «Subidos»). Los kits se guardan con compare-and-set y lo que lee la IA del manual es un BORRADOR que la persona
  confirma. El bloque del prompt tiene menos de 400 caracteres y sólo nombra las fuentes que el editor tiene: una que no
  tiene se cae en silencio. El logo va como una foto más de «fotos», con `"logo": true`.
- **La contradicción de abajo (Gemini por defecto) se cerró:** `image-editor-ia` y `marca-leer` corren con `deSuIA` (su
  Claude por la segunda puerta del veto, su GPT por clave, `fallback: []`), y la cascada saca Gemini aun con «sólo su IA»
  (`sinGemini`, lib/ai-cheap.ts). Lo fija tests/solo-su-ia.test.ts corriendo la cascada de verdad.
- **Lo que NO se pudo desde la nube:** mirar las pantallas en un navegador con datos, ni medir cómo lee la visión un brand
  board real (la caja del logo es lo más frágil: si se sale de la imagen, no se recorta y se sube a mano).

**Vive en:** lib/marca/kits.ts · lib/marca/leer-manual.ts · app/second-brain/MarcaView.tsx · lib/carruseles/marca-kit.ts

## El chat de imagen corre con Gemini por defecto (29/10/2026) — cerrado el 5/11 (arriba)

- **Causa:** `lib/model-catalogo.ts:241` tiene GEMINI por defecto para `image-editor-ia`, y la decisión del 22/10 es
  «sin Gemini».
- **Lo que hace el plan:** el experto va en su propia feature, `image-editor-adaptar`, con un modelo que escribe mejor.
  La contradicción de `image-editor-ia` queda sin resolver.

**Vive en:** lib/model-catalogo.ts

## Sacar las de Doory tocó SIETE archivos de test, y los dos que el plan nombraba no eran ninguno (6/11/2026, claude1)

**Vive en:** `app/image-editor/mako/plantillas.ts` · `lib/api-mako/areas/imagen.run.ts` · los siete tests de abajo.

Las 10 plantillas de Doory se borraron el 6/11/2026 (encargos 155 y 548): sus 10 JSON, sus 10 WebP, su tabla de
etiquetas y los dos scripts que sólo las traducían. Eran material ajeno adentro del producto: la Attribution Assurance
License del código portado aplica «in whole or part, with or without modification», así que sacar el crédito visible el
29/10 (`editor/CreditoDoory.tsx`) no la desactivaba. El motor (`_doory/`) se queda, con su crédito en `LICENSE-DOORY`:
lo que se fue es su CONTENIDO.

**El diagnóstico obvio era el equivocado.** Esta sección decía, desde el 29/10, que se rompían «el test 1 de
`image-editor-plantillas-crear` y el 5», y el encargo lo repetía. Al medirlo: **esos dos ya estaban adaptados** por
`bebd4cde0` (6/11), que sacó las de Doory de «Nuevo diseño» una semana después de escribirse el hallazgo — el test 1 ya
verificaba que NO estuvieran. Los que se rompían eran otros, y eran siete archivos, no dos:

| Archivo | Qué le pasó |
|---|---|
| `api-mako-imagen.test.ts` | el test 3 recorría las 10 (`lista.length === 10`). Ahora es el GUARD de que no vuelvan |
| `plantillas-sugeridas-editores.test.ts` | cuatro tests de qué se le sugiere a quién en Imagen: sin sujeto |
| `chat-bloques.test.ts` | exigía `<img src="/cv/plantillas/<slug>.webp">` y el WebP **en disco** |
| `_bloques-tarjeta-hijo.ts` | `catalogoPlantillas()[0]?.slug ?? ''` daba `''` y la tarjeta se creaba sin plantilla |
| `image-plantillas-reales.test.ts` | el assert de «no choca con una de Doory» se quedó sin con qué chocar |
| `image-editor-plantillas-crear.test.ts` | el test **4** (no el 1 ni el 5): fijaba la rama `documentoDePlantilla` |
| `image-editor-colores-mako.test.ts` | un `if (f.includes('/mako/plantillas/')) continue` que ya no saltea nada |

**Reglas:**

- **Un hallazgo sobre qué tests rompe un cambio caduca.** Dice qué se rompía con el código de ESE día; una semana
  después, otra punta puede haber adaptado justo esos dos. Antes de confiarle el alcance a un hallazgo de tests, se
  mide: `grep` de los símbolos que se van (acá `catalogoPlantillas`, `documentoDePlantilla`, `ETIQUETAS_IMAGEN`) más el
  slug de cada cosa borrada. Eso dio los siete; el hallazgo daba dos, y ninguno.
- **Lo que un test exige en DISCO no lo encuentra ningún grep de símbolos.** `chat-bloques` pedía que
  `public/cv/plantillas/<slug>.webp` existiera (`existsSync`), y lo sacaba del slug que le devolvía un proceso hijo: no
  nombra ningún archivo borrado. Apareció al barrer por slug, no por símbolo.
- **Los diez slugs viven en UN solo test.** El guard contra la reincidencia (`api-mako-imagen.test.ts`, test 3) los
  lista una vez y chequea el panel, la API y el disco; los otros seis tests apuntan a él en vez de repetir la lista.
- **Un test que pierde su sujeto se reescribe sobre lo que SÍ hay que proteger, o se va.** Los cuatro de «qué se le
  sugiere a quién en Imagen» se fueron (no hay plantillas que ordenar) y quedó uno que fija que el panel no sugiera
  nada; el test 3 pasó de recorrer las diez a vigilar que no vuelvan. Lo que no se hizo: duplicar sobre las plantillas
  reales lo que ya cuidan `image-plantillas-reales.test.ts` y `-crear.test.ts` (que se puedan guardar como diseño, sin
  fotos locales y bajo el tope).
- **El cableado se queda aunque se vaya el contenido.** Las señales del negocio siguen bajando desde la page hasta
  `servicioPlantillas` (su test lo fija): es lo primero que hará falta cuando el panel sirva las plantillas propias.
- ⚠️ **Vaciar una carpeta de `public/` deja su exención del proxy abierta, y eso es un hueco de seguridad.** Los 10 WebP
  eran los ÚNICOS archivos de `public/cv/`, así que al borrarlos `cv` quedó en la lista de carpetas que `proxy.ts`
  saltea por extensión sin tener nada que servir. No lo vio ningún grep de este cambio: lo cazó
  `tests/proxy-matcher-completo.test.ts` («sólo abre un hueco») en Actions. **Regla:** una carpeta de `public/` que se
  vacía SALE de esa lista, igual que una nueva entra. El comentario de `proxy.ts` ahora lo dice. **Medido en las dos
  direcciones** (base 5/0): con `cv` en la lista y la carpeta vacía, 4/1; con un archivo en `public/cv/` y `cv`
  FUERA de la lista, 4/1 («estos archivos pasan por el proxy: sin sesión, un visitante recibe el login en vez del
  archivo»). ⚠️ Para la segunda, el archivo tiene que estar **en el índice de git**: ese test lee `public/` con
  `git ls-files`, no del disco.

**Los tres rojos del primer push, y que ninguno era un test «ya adaptado»** (corrida 455): el typecheck cazó un
`c.plantilla` que quedó en el test del carrusel (el campo se había ido del tipo), `image-plantillas-reales-crear` fijaba
la frase vieja de la descripción de la API («el id o el slug») y `proxy-matcher-completo`, lo de `cv`. **Los tres son el
cambio, no el entorno:** se arreglaron en un ciclo. El cuarto rojo de esa corrida
(`tests/coaches-ops-center.test.ts`) lo marcó el propio runner como FLAKY — rojo en proceso compartido, verde aislado.

**Lo que el panel «Diseño» muestra ahora:** nada, a propósito. `PLANTILLAS` y `CATEGORIAS` se fueron enteras (ocho
categorías con 0 no llevan a ningún lado) y el texto del panel manda a donde SÍ hay plantillas:
`templates.empty` = «Las plantillas están en «Nuevo diseño».» (`_doory/editor/strings.ts`).

**Medido en la PC, no sólo en Actions (6/11/2026, 3,2 GB libres).** Los ocho archivos de test que toca el borrado,
juntos: **57 pasan / 0 fallan en 82 s** (`node --import tsx --test --test-concurrency=2`, por el turno de
`C:/dev/con-turno.mjs`). Toda la ventana anterior la PC estuvo entre 0,8 y 1,7 GB libres y la guardia bloquea
`node --test` bajo 3 GB, así que hasta acá el veredicto era el de Actions. Las roturas, de a una y restaurando, están
en el pie de cada test; dos cosas que enseñaron:

- **`documentoDePlantilla` de vuelta rompe DOS tests, no uno** (5/2): el 3 lo caza leyendo el texto de
  `imagen.run.ts`, y el 7 —el runner del área cargado en un node suelto con `--conditions=react-server`— se cae al
  importar un símbolo que ya no existe. El guard contra la reincidencia no está solo.
- ⚠️ **El guard lee `imagen.run.ts` SIN sacar los comentarios:** nombrar `catalogoPlantillas` ahí, aunque sea en un
  comentario, lo pone rojo. Falla cerrado y se deja así.

**Lo que quedó SIN hacer:**

- **El bloque «creado» del chat perdió su miniatura.** Era la única con WebP: las plantillas reales se generan por
  código y no tienen uno, así que al crear un diseño desde el chat va el marco con «ancho × alto»
  (`app/_chat/BloqueHilo.tsx`, `Creado`, que ya lo manejaba). Lo arreglaría el WebP de cada real, en el banco de esbuild
  + Chrome sin ventana, o dibujar `MiniaturaDiseno` en el bloque.
- **El panel «Diseño» sirviendo las plantillas propias del negocio:** es lo que lo vuelve a llenar
  (`app/creaciones/usePlantillasPropias.ts` hoy sólo alimenta «Nuevo diseño»). Necesita una miniatura por plantilla:
  el panel espera una URL (`thumbnail_url`), no un SVG.
- **No se miró en el editor.** Que el panel vacío se vea bien (y no como una pestaña rota) está leído en el código
  (`TemplatesPanel.tsx` ya dibuja `templates.empty` sin plantillas), no medido en la pantalla.
- **Las fotos de muestra del ejemplo y las preguntas al crear** siguen pendientes, y **no son parte de este borrado**:
  en `docs/relevo/nube-plantillas.md` figuran como lo que FALTA AGREGAR a las plantillas reales (hoy los marcos dicen
  «Tu foto»), no como algo de Doory que sacar. El encargo las listaba bajo «qué hay que borrar» leyendo mal la coma de
  `hallazgos-plantillas.md`; no hay fotos de muestra en el repo (`public/cv/plantillas/` quedó vacío).

## «Páginas 1 / 1» se pisaba con la cuadrícula a 1366: la barra de abajo miraba la VENTANA (29/10/2026, claude3)

Medido en el banco de QA de Create (C:/dev/revisiones/create-qa-2910/antes-image-editor-1366.png): con la tarjeta de MaKo
abierta, la barra de abajo mide ~520 px y no entraban Notas, Duración, el deslizador del zoom, «Páginas 1 / 1» y los dos
íconos; los botones se ENCOGÍAN por debajo de su texto (`white-space: nowrap` con `flex-shrink: 1`) y se pisaban. Lo que
cede estaba en `@media (max-width: 640px)`: la ventana de 1366 no sabe cuánto le dejan la sidebar, la tarjeta y el panel
de Diseño. Ahora `container-type: inline-size` en la barra y `@container (max-width: 600px)` (ceden los rótulos de
Notas/Duración y el deslizador), y los botones `flex: none`. Plegando la tarjeta (`plegable`), el centro pasa de 950 a
1238 px y la barra entra entera. Vive en: _doory/editor/workspace/BottomBar.module.css.

## El carrusel quedaba en blanco, con el fondo y nada más: validar dos veces tiraba todo el texto (30/10/2026, claude1)

**Vive en:** `lib/image-editor/chat/catalogo.ts` (`validarOperacion`) · `app/image-editor/mako/chat/acciones.ts` · `lib/image-editor/chat/ia.ts`.

**Síntoma:** en la prueba en vivo, Leila pegó un carrusel de 9 slides. MaKo contestó «Voy a crear el carrusel» y sólo cambió el fondo de una página. A «Puedes aplicar los cambios que te pedí?» contestó que no había elementos. En la llamada se anotó como tres bugs: no pone imágenes, no recuerda, de la marca sólo aplica el fondo. En la base, el hilo tenía la propuesta con una operación (`fondo`) y 12 y 20 descartes.

**Causa, en capas (cada una tapaba a la siguiente):**

1. La ruta valida y el panel vuelve a validar lo que contestó la ruta. `validarOperacion` recibe el estilo suelto y lo devuelve adentro de `estilo`, y la segunda pasada lo rechaza: `agregar_texto` y `estilo_texto` no pasaron nunca desde que existe el chat (16/10). Video tenía lo mismo en `estilo_texto`, `transformar` y `ajustar_color`.
2. Con eso arreglado, la IA de verdad seguía perdiendo el texto: le pone a lo nuevo sus propias refs («t1», «p1k1», «n1» a una página) y se rechazaba el texto entero por el nombre. Esto no se ve con un test: apareció corriéndolo contra el modelo.
3. Un carrusel con más slides que páginas no podía poner nada en las páginas nuevas: `agregar_pagina` no daba una ref.
4. Cada pedido iba solo a la IA: el hilo se guardaba y se mostraba, pero no se le mandaba.

**El diagnóstico obvio era el equivocado:** «no pone imágenes» y «Replicar no trae las imágenes» parecían la misma causa, y no comparten nada: Replicar es la dirección base de la página (ver hallazgos-editor-landing.md). Y «de la marca sólo aplica el fondo» no era un problema de la marca: el fondo era lo único que sobrevivía. Tampoco era la IA: los tests pasaban porque su respuesta de mentira traía la forma suelta, que la ruta real nunca devuelve.

**Reglas:**

- Una validación que corre dos veces sobre lo mismo tiene que aceptar lo que ella misma devuelve. Lo fija un test recorriendo todo el catálogo (imagen y video).
- La respuesta de mentira de un test sale de la función real, no escrita a mano.
- Un nombre raro no es motivo para perder el contenido: la ref se acepta y, si no existe, lo dice `aplicar.ts`.
- Un chat con IA se prueba al menos una vez contra el modelo: `node --require <sin-server-only.cjs> --import tsx` con `runWithWorkspace`. El ws3 no tiene IA conectada; se usó el ws9.

**Medido con la IA real (ws9, diseño en blanco de 5 páginas, 9 slides):** 24 operaciones, 0 descartes, 9 páginas con su fondo, todo el texto y la tipografía pedida. Sólo la estructura: no se miró cómo queda dibujado.

**Trampa con el tope de la respuesta:** con `maxTokens` en 8.000 se cortó dos veces a los 90 s; con 4.000 armó las páginas. Son pocas corridas y Gemini también se cortó con 4.000, así que no está probado que el tope sea la causa: quedó en 4.000 porque es lo único que anduvo.

**Lo que encontró la revisión que intentó refutar el arreglo (tres lecturas independientes). El arreglo mismo había abierto dos:**

- ⚠️ **Aceptar cualquier ref abrió un choque:** las refs de la vista son prefijo + 0 o 1 + un carácter (`t11`, `p10`), así que un «t11» inventado puede ser un texto de la persona. Si lo nuevo no se agregaba, el `borrar` siguiente caía sobre lo suyo. Ahora, lo que se anunció como nuevo nunca cae sobre lo que ya estaba (`declaradas` en aplicar.ts, `caidas` en catalogo.ts).
- **La segunda validación ahora siempre da vacío:** el panel mostraba sólo sus descartes y nunca los de la ruta, que vienen aparte. Lo que tiraba la ruta no se decía. Imagen y Video leen `r.descartes`.
- **Una fuente que el editor no tiene tiraba el texto entero:** el mismo síntoma por otra vía. Helvetica, Arial, Futura, Georgia y otras no están en `FUENTES`. Ahora el texto entra con otra y se avisa.
- **Los topes tienen que cuadrar entre sí:** a la densidad de ese carrusel, más de unos 4.000 caracteres no entran en los 4.000 tokens de la respuesta (estimado, no medido contra el modelo). La instrucción, la memoria y el hilo quedaron en 4.000, y los cambios guardados en 80, como las operaciones. Lo fija un test.
- Una ref repetida entre slides hacía perder el segundo título: ahora vale la última.
- Video: al abrirle el paso a `transformar`, `mezcla: 'constructor'` llegaba a los params por usar `in` sobre el catálogo: `Object.hasOwn`.

**Lo que quedó SIN hacer:**

- **Video, ahora que esas tres operaciones llegan al editor por primera vez:** `cambiar_texto` sobre un texto de plantilla lo devuelve a su ancla y deshace un `transformar` anterior sin avisar (`app/video-editor/_opencut/chat/comandos.ts`). `opacidad_fondo` o `grosor_trazo` sueltos pueden no hacer nada, o prender un trazo que la revisión no muestra (`linea.ts`). Una propuesta vieja que sólo tenía esas operaciones puede reaparecer una vez al abrir el proyecto (no se midió si hay alguna).
- **Dos propuestas pendientes:** pedir de nuevo no cierra la anterior; aceptar las dos duplica las páginas. Pide dos clics y sale el aviso «Cambiaste el diseño».
- `contenidoNoConfiable` (lib/prompt-render-pure.ts) no neutraliza `</etiqueta >` con un espacio. Lo usan todos los prompts, y en este chat el texto es de la misma persona.
- En un enlace de sólo lectura, una página angosta también pierde el tamaño.
- **Poner fotos desde el chat:** hecho el mismo 30/10, en la entrada de abajo.
- **La marca completa:** el chat no conoce colores ni logo del negocio. Depende del brand board (pendientes-30-10.md, 2.9).
- **Los motivos de «No se aplica»** están escritos para el programador (««estilo» no es algo de…»).
- **Cómo se ve:** falta mirarlo en el editor, con una sesión que no sea de un cliente.

## «Página 1» se montaba sobre los íconos en un carrusel (30/10/2026, claude1)

**Vive en:** `app/image-editor/_doory/editor/workspace/PageSlot.module.css`.

**Síntoma:** Leila, con la barra y el chat abiertos: se rompe el texto al lado de «Página 1, 2, 3». **Causa:** con varias páginas, el tamaño y los cinco íconos piden unos 250 px y no se encogen; el encabezado mide desde 372 (`HEADER_MIN_WIDTH`). Con una página sola hay menos íconos y entra, por eso se ve en un carrusel.

**Regla:** en el encabezado, lo primero que se va es el tamaño (también está en Redimensionar). Medido en una réplica con las mismas reglas (el título pasaba 6 px sobre los íconos; ahora les quedan 8 libres), no en el editor real.

**El diagnóstico obvio era el equivocado:** sumar las pantallas de Create a `RUTAS_QUE_PLIEGAN`, como pide 2.13. Choca con la decisión del 24/10 (la flecha fija la barra y se respeta; lo cuida `tests/sidebar-plegada-por-defecto.test.ts`). La barra ya arranca plegada: sólo queda abierta para quien la fijó.

**Lo que quedó SIN hacer:** con la barra fijada y el chat abierto puede haber otras roturas: «se rompe» no está medido en la pantalla real.

## Las fotos desde el chat: la IA elige por ref y nunca ve una dirección (30/10/2026, claude1)

**Vive en:** `lib/image-editor/chat/catalogo.ts` (`agregar_foto`, `fondo_foto`) · `aplicar.ts` (`objetoFoto`) · `vista.ts` («fotos») · `hilo.ts` (`fotosGuardadas`) ·
`app/image-editor/mako/chat/acciones.ts` (`fotosParaPedir`). Decisión de alcance: el Cerebro, sin esperar el minuto 01:37 de la llamada con Leila.

- **La IA no recibe direcciones:** ve «o1, foto.jpg, 2000×1000» y contesta con la ref. Así no puede meter una URL de internet en el diseño, y lo que tira `validarOperacion` por no ser una ref es justamente eso.
- **Las adjuntas se suben ANTES de pedir,** para que tengan dirección cuando vuelve la propuesta, y van primero en la lista con `adjunta`. Quedan en Subidos aunque se descarte la propuesta. Si una no sube, se dice en «No se aplica» y el pedido sigue.
- **La propuesta guarda las fotos que usa,** no toda la lista: aceptar después de recargar tiene que encontrarlas. El saneo del hilo tira lo que no sea http(s): ese texto llega a un `src`.
- ⚠️ **`cubrir` usa `cropX`/`cropY` en píxeles de la foto, y `width`/`height` son la parte de la foto que se ve:** escala pareja siempre. Con ancho y alto sueltos, Fabric la deformaría sin avisar.
- **Probado contra el cargador real** (`deserializeObjects` y `buildBackground`, `scripts/banco-editor-web`, `/foto`): entera, cubriendo y de fondo se dibujan sin deformarse; al serializar vuelven el `src`, el `assetId` y el recorte. El motor saca `crossOrigin` al guardar y lo vuelve a poner al cargar (`prepareImage`).

**Lo que encontró la revisión independiente (ya arreglado):**

- ⚠️ **La copia que se manda a leer no es la que va al diseño.** `useAdjuntosDelChat` achica toda imagen de más de 1,5 MB a JPEG de 1600 px para la lectura y el POST. Subir ESA copia dejaba un PNG sin fondo sobre un rectángulo negro y un GIF quieto. Se sube el original (`originalDe`).
- **Un `abort` que ya pasó no dispara el evento:** con la subida en el medio, «Detener» no hacía nada y el pedido salía igual, gastando la IA del cliente.
- **Un SVG o un AVIF adjunto se leía como texto** y nunca entraba en «fotos», y el prompt le decía «adjúntala», que es lo que acababa de hacer. Se aceptan, se suben, y no van a la ruta, que los rechazaría por su firma.
- **La lista de fotos podía tirar un pedido que no tenía nada que ver:** contaba contra el tope de la vista. Se mide antes de subir, y la lista se achica.
- **Reintentar duplicaba en Subidos:** si ya hay una con el mismo nombre y peso, se usa ésa.

**Lo que quedó SIN hacer:**

- **La subida no tiene plazo** (XHR sin `timeout`, `app/customer-success/curso/`): con la red trabada, «corriendo» espera a que el navegador se rinda.
- **No visto en el editor completo ni con la IA de verdad eligiendo fotos** (`vivo-carrusel` queda por correr con «fotos» en la vista). El banco prueba el objeto y el cargador, no el flujo de la pantalla.
- **La lista es de Subidos:** las 40 más nuevas, con las adjuntas primero. Otra biblioteca (las fotos de stock del panel) no entra.
- **Una foto borrada de Subidos después de proponer:** `deserializeObjects` cae a `fallbackObject`, no rompe; no se dice nada en la propuesta.
- **El Video Editor no tiene esto.**

## El explorador de carruseles: las funciones de otro, los datos de Spy (4/11/2026, nube)

**El pedido:** «copies las funcionalidades y todos los carruseles de ejemplo» de un explorador de carruseles a la sección de
imagen. **Vive en:** `lib/carruseles/explorar.ts` (lo puro), `lib/carruseles/explorar-servidor.ts`,
`app/image-editor/carruseles/`, `lib/spy-medio.ts`, `supabase/migrations/0391_spy_medio_carruseles.sql`.

- **La biblioteca no se copia, y por dos razones distintas:** sus términos prohíben raspar, bajar en lote y republicar, y su
  `robots.txt` cierra `/explore`; además cada carrusel es de su creador. Son los dos permisos de AGENTS.md («Copiar código y
  usar el dato son DOS permisos»): acá ni siquiera hay código que copiar, sólo funciones, y ésas son de quien las construye.
- **De dónde salen los carruseles:** de lo que Competitors Spy YA trae de las cuentas que el negocio sigue, con su clave y su
  tope. El explorador no lee nada nuevo ni gasta: si no hay cuentas, la pantalla dice cómo sumar una.
- **Spy no sabía qué publicación era un carrusel.** Toda publicación que no es un reel se guardaba `tipo = 'publicacion'`, y
  un carrusel de 7 láminas era igual que una foto. Las dos fuentes lo decían (Meta `media_type`, Apify `type` y `childPosts`) y
  se tiraba en `vistaDeInstagram`. Va en la 0391 (`medio`, `laminas`) y se escribe APARTE del upsert (`guardarMedios`, el
  molde del `funnel` de la 0373): con la columna en el upsert, una migración sin aplicar tiraba la lectura entera de Instagram.
  Lo que ya estaba guardado no tiene el dato y no se adivina: se completa en la próxima lectura. Meta no da las láminas.
- **El outlier es el de Spy, por cuenta:** `mejoresPiezas` (lib/spy-detalle.ts) con tope = todas devuelve las veces de cada
  pieza contra la mediana de SU cuenta. Con la mediana de todas las cuentas juntas, una cuenta grande pisa a la chica (el
  test lo rompe así). Sólo Instagram: YouTube no lleva métricas derivadas sin la enmienda III.L.
- **`cambiarSettingSi` sirve para valores largos:** con un `esperado` de varios KB compara por `updated_at`, no por la URL. Los
  guardados del negocio (hasta 500) se escriben con compare-and-set y reintento (`escribirConCas`).
- **Una familia del clasificador que no hace falta no se suma:** con «buscame carruseles con outlier alto…» la operación ya
  llegaba al turno de la app. Medido sacando la familia: 48/48 igual. Quedaron las frases en el test como red.
- **Trampa de tipos:** un genérico que se infiere de un callback con una rama `{ error }` sale `T | undefined`; va explícito
  (`escribirConCas<Guardado[]>`).
- **Desde la nube no se llega a topcarousels.com** (el proxy rechaza el host). Lo público que su `robots.txt` deja leer
  (`/carousel-ideas/*`, `/blog/*`, `/llms-full.txt`) sirve para los tipos y sus estructuras: queda para leer desde la PC
  (docs/relevo/nube-carruseles.md).

**Lo que quedó SIN hacer (en esta etapa):** «Hacer el mío» y las plantillas propias por tipo (etapa 2); mirar la pantalla con
un negocio de verdad (el banco usa datos inventados); y la 0391 sin aplicar.

## Carruseles por tipo y «Hacer el mío»: la estructura, nunca las palabras (4/11/2026, nube)

**Vive en:** `lib/carruseles/tipos.ts`, `lib/carruseles/documento.ts`, `lib/carruseles/referencia.ts`, `lib/carruseles/texto.ts`,
`lib/carruseles/crear-servidor.ts`, `app/image-editor/carruseles/MiniaturaCarrusel.tsx` y `DialogosCarrusel.tsx`.

- **La miniatura dibuja el MISMO documento que se crea** (`documentoDeCarrusel` → `PaginaCarrusel`, con `cqw` contra el ancho
  de la página), no una imagen aparte: la regla de Martín del 29/10 («nunca en blanco») sin un segundo dibujo que se desfase.
- **El ejemplo va aparte** («Ver ejemplo», un negocio ficticio del elenco) y la tarjeta muestra la estructura con el nombre del
  NEGOCIO: lo que se ve es lo que se crea. El @ del negocio no se guarda en MaKo (Zernio no deja el usuario): la cabecera va sin
  @ y nunca se inventa uno.
- **«Nunca sus palabras» lo cuida el TIPO:** `Estructura` no tiene el texto de la referencia, así que armar las láminas no tiene
  cómo copiarlo. Lo que se toma: el tipo (por el formato que Spy le leyó, `tipoDeFormato`), las láminas, con qué abre (el
  `tipoGancho` de Spy) y qué pide al final (`cierreDeTexto`, gana la ÚLTIMA pista). Sin tipo claro se pregunta, no se adivina.
- **El cierre se lee del texto ENTERO, en el explorador.** Al navegador el texto viaja cortado a 320 caracteres y la llamada a la
  acción va al final: con el texto cortado, la confirmación decía «sin cierre» y el server, que lee entero, creaba otro. Ahora
  `carruselesDe` calcula `cierre` antes de cortar y «Hacer el mío» usa ése (test con un pie de 600 caracteres).
- **Un rango de láminas tiene que caber en su estructura.** Tres tipos declaraban un mínimo menor que sus láminas fijas
  (portada, resumen, cierre…): «Historia de 5» salía de 6. Lo cazó el test que arma cada tipo con cada número de su rango.
- **«Ver ejemplo» va AL LADO de la tarjeta** (un botón no va adentro de otro): `.cr-plantilla-con`, con `verEjemplo` en la
  plantilla y `onVerEjemplo` en `PantallaCrear` (las otras tabs no cambian). La miniatura lleva `zIndex: 0` para que sus
  láminas apiladas no tapen las marcas de la tarjeta, y va más abajo (19 %) para no tapar la cabecera de la portada.
- **`plano` se mudó a `texto.ts`** (`explorar.ts` lo re-exporta): `referencia.ts` importa de `explorar.ts` y el explorador
  necesitaba `cierreDeTexto`, un ciclo.

**Lo que quedó SIN hacer:** que MaKo escriba el texto de cada lámina con los datos del negocio (hoy son guías); «Hacer el mío» y
«Ver ejemplo» en el teléfono (allí se crea con la plantilla, sin el diálogo); y mirar las fuentes del documento abierto en el
editor de verdad (el banco dibuja la miniatura, no el lienzo de Doory).

## La biblioteca de ejemplos: lo de todos al lado de lo de cada uno, sin pisarse (4/11/2026, nube)

**Vive en:** `lib/carruseles/biblioteca.ts` (puro), `lib/carruseles/biblioteca-servidor.ts`, `scripts/carruseles-biblioteca.mts`,
`supabase/migrations/0392_carruseles_biblioteca.sql`, `app/image-editor/carruseles/EditarBiblioteca.tsx`.

- **Los ids de la biblioteca van en NEGATIVO** (`idDeBiblioteca`). El explorador ya usaba el id de `spy_piezas` para los
  guardados del negocio, «Hacer el mío», el filtro por cuenta (`?de=`) y la API: en negativo, todo eso sigue con UN número sin
  chocar. Costó dos cambios que no se ven: `sanearGuardados` tiraba los ids `<= 0` y `filtrosDeQuery` también; ahora sólo el
  cero (que no es ninguno). Un test de cada lado.
- **El outlier, sólo de las cuentas de la LISTA.** De un tema se leen publicaciones sueltas de cientos de cuentas: no hay
  mediana de su cuenta, y lo que no se midió no se dice (`outlier: null`, al final del orden por outlier, nunca como cero).
  Las de la lista se leen enteras y llevan el mismo cálculo de Spy, por eso de ellas se guardan también las imágenes sueltas.
- **La biblioteca NO necesita la 0391.** El Cerebro creía que sí (para saber cuáles son carruseles y sus láminas): esas columnas
  son de `spy_piezas`, y la biblioteca guarda `medio` y `laminas` en su propia tabla, al leer. El script lo dice en `estado`.
- **La clave de Apify es la de Spy, y Spy la sigue usando.** El techo de la corrida es el menor entre lo pedido y lo que deja
  libre el crédito del mes por encima de `RESERVA_CREDITO_USD` (US$2): con el plan gratis de US$5 y US$1,80 usados, una corrida
  pedida de US$2 gasta como mucho US$1,20. Sin poder leer el crédito, no se gasta (`techoConCredito` → null). Cada corrida
  lleva además su `maxTotalChargeUsd`.
- **El texto vence a los 30 días (`podarVencido`), el tipo y el cierre no:** se clasifican AL GUARDAR (`formatoPorTexto`,
  `cierreDeTexto`) y quedan en sus columnas.
- **Sacar a un creador es UNA fila** (`estado = 'excluida'`, con el motivo), valga para la lista o para los temas. Sacar a uno
  que todavía no está lo anota fuera igual (puede llegar por un tema mañana), y un «sumar» no lo vuelve a meter: hace falta
  «Volver a sumar» a propósito (`decidirCambio`).
- **La misma publicación sale UNA vez.** En la base, por `ref` (único); en el explorador, si el negocio sigue en Spy a alguien
  que también está en la biblioteca, queda la del negocio (`unirConBiblioteca`, por el link sin `?` ni barra final).
- **El @ de los referentes del Ops Center no está en el repo y no se inventa:** `buscar` del script los busca por nombre en
  Instagram y lista candidatos; el bueno lo suma una persona con `sumar … --referente <id>`.
- **En la consola, una palabra que empieza con `#` es un comentario:** `--solo #ventas` le llega al script como `--solo` sin
  nada. Los comandos del relevo llevan el `#` entre comillas.
- **Una lectura con tope corta por las VIEJAS si se ordena por id ascendente:** la primera versión leía de a tandas de cuentas y
  `orden: 'id'`, así que con la biblioteca grande lo nuevo no entraba nunca. Ahora lee de la más nueva a la más vieja (hasta
  4.000), una vez cada 2 minutos por proceso (es la misma para todos los negocios); los creadores se leen SIEMPRE, así uno que
  salió deja de verse en el acto. Y al navegador viajan como mucho 800 (`recortarBiblioteca`): sólo carruseles, primero lo de
  los últimos 14 días y después lo que mejor rindió.
- **En la tarjeta, «Biblioteca» se cortaba en «Bi…»** al lado del tipo («List…»): va un ícono con su `aria-label` y su `title`.
  Y los creadores de los temas pueden ser cientos: «Cuentas» muestra los 12 que más tienen y «Ver todos».
- **Global a propósito** (como `spy_lecturas_canal`): sin `workspace_id`, fuera de `TENANT_TABLES`, RLS prendida sin políticas y
  el `revoke` también sobre las secuencias. Ningún negocio escribe ahí: la puerta es `puedeEditarBiblioteca` (admin del negocio
  de la plataforma), en la pantalla, la acción y la API, y `cambiar_biblioteca_carruseles` va en `NO_EN_FLUJOS`.

**Lo que quedó SIN hacer:** correr la primera carga (la nube no llega a Apify ni a la base: el comando está en
`docs/relevo/nube-carruseles.md`); sumar los @ de los referentes del Ops Center (salen de `buscar`); y las miniaturas que no se
pudieron bajar en una corrida (por el tiempo de `guardarMiniaturas`) se quedan con la del CDN de Instagram, que vence, hasta la
próxima lectura de esa fuente (una semana después).

## La primera carga de la biblioteca: lo que midió el Cerebro y qué se corrigió (4/11/2026, nube)

**Vive en:** `lib/carruseles/clasificar.ts` (nuevo, puro), `lib/carruseles/biblioteca.ts`, `lib/carruseles/explorar.ts`,
`scripts/carruseles-biblioteca.mts`, `supabase/migrations/0393_carruseles_biblioteca_contenido.sql`.

Lo medido (el Cerebro, ~21:20 UTC, en producción): 160 carruseles de 10 temas y 7 cuentas; **142 «sin tipo»** (87 de temas, 55
de cuentas); el primero por outlier de @leilahormozi, una foto de su embarazo («Anytime now….», 9,7×); `buscar` trajo cuentas
equivocadas («Alex Hormozi» → @damaristradesww, @hormoziw); los temas devolvieron **15 a 30 de las 80** publicaciones pedidas y
el plan prometía «hasta 300» (entraron 97 de temas); @sofiacontreras trajo **1**.

- **Por qué el texto no alcanzaba para el tipo.** El clasificador de Spy (`formatoPorTexto`) tiene sus frases fuertes en
  español y las cuentas de la lista escriben en inglés; la lista sólo se reconocía con doce sustantivos pegados al número
  («5 formas», «3 lessons», «7 simple ways» quedaban afuera); y, sobre todo, **en un carrusel el formato está en las láminas, no
  en el pie** («Guárdalo 📌»). `tipoDeCarrusel` usa primero Spy (lo de antes no cambia), después una lista amplia (número de 2 a
  30 y un sustantivo contable, con una palabra en el medio), frases en inglés que el catálogo tiene en español, y «Cómo» CON
  TILDE al arrancar el gancho («Como emprendedora…» no es un tutorial). Lo que no dice nada sigue «sin tipo»: es la verdad.
- **La portada dice el tipo.** Instagram escribe un texto para las personas ciegas («May be an image of text that says
  '5 errores…'»). Si el actor de Apify lo manda (`alt`, o el de la primera lámina), se lee el tipo de ahí antes que del pie y no
  se guarda (sólo lo que se deduce). ⚠️ **No está confirmado que lo mande:** desde la nube no se llega a apify.com. La lectura
  cuenta cuántas publicaciones lo traían («N de M traían el texto de la portada») para medirlo en la próxima carga.
- **Volver a clasificar es GRATIS** (`reclasificar`): toma el texto guardado y sólo LLENA lo que falta (nunca pisa un tipo que
  pudo venir de la portada). Lo que ya no tiene texto (vence a los 30 días) no se adivina.
- **Lo personal se BAJA, no se esconde** (`pareceContenido`, tres valores, medible): `true` si tiene tipo, pide algo al final o
  la portada tiene texto; `false` si la portada es de personas sin texto, o el pie es corto (menos de 8 palabras) sin tipo, sin
  cierre y sin un número; `null` si no se puede decir. Sólo cambia el orden de «Mayor outlier» y «Más interacción» (y el recorte
  de la biblioteca): lo `false` va después, con su número a la vista; por fecha no se mueve. **Cubre** la foto personal con un pie
  corto y, con la portada, la portada de personas sin texto. **No cubre** un pie personal LARGO sin portada leída (queda `null`,
  donde lo pone su outlier), y **puede bajar de más** un carrusel de contenido con un pie de una palabra y sin portada (se sigue
  viendo, más abajo). Vale también para las cuentas que el negocio sigue en Spy: es la misma función.
- **La señal se guarda al leer (mig 0393, `parece_contenido`)** porque sale de la portada, que no se guarda, y del pie, que
  vence. Sin la columna, la pantalla la calcula del texto que queda y el script no la manda (una columna que no existe hace que
  PostgREST rechace la fila ENTERA: el script lo pregunta antes con un `select` de esa columna).
- **Buscar por nombre trae cuentas equivocadas, y no se arregla buscando mejor:** la búsqueda de Instagram devuelve parecidos.
  `buscar` ahora los ordena por cuánto se parecen al nombre y lo dice, y **no da ninguno por bueno**. Para confirmar está
  `verificar @x --referente id` (lee el perfil, ~US$0,003): «confirmada» sólo si el nombre del perfil tiene el nombre de pila y
  un apellido, y la cuenta está verificada o tiene 100.000 seguidores o más, y publica (30 o más). Una pariente verificada con el
  mismo apellido no pasa: el nombre de pila manda. Lo más simple sigue siendo que el superadmin cargue el @ que le pasa Martín.
- **El plan prometía el techo.** Un hashtag devuelve 15 a 30: `PUBLICACIONES_POR_TEMA` pasó de 80 a 30 (pedir 80 no traía más
  y reservaba el techo de 80 por tema, que dejaba fuentes afuera). El plan en seco dice lo ESPERADO con lo medido (unos 10
  carruseles por tema y 9 por cuenta) y lo PROBABLE en dólares (Apify cobra lo que llega); `--max-carruseles` es un techo.
- **Una cuenta que trae casi nada (menos de 5) se marca, no se saca:** la lectura lo avisa con el comando para verificarla, y
  `estado`, el panel («¿es su cuenta?», con el @ que abre el perfil) y `ver_biblioteca_carruseles` lo dicen.
- **Nada de esto necesita otra carga grande** (quedaban US$1,07 libres): `reclasificar` no gasta, `verificar` cuesta unos
  centavos por cuenta, y la próxima lectura semanal de cada fuente llena lo que sale de la portada.

**Lo que quedó SIN hacer:** confirmar que el actor manda `alt` (lo dice la próxima carga); y si no lo manda, el tipo de la mayoría
de los carruseles de los temas va a seguir sin saberse por el pie: la salida sería leer la portada con la IA del negocio, que
no es parte de este pedido («sin inventar», sin gasto de IA).

## Con la barra fijada y el chat abiertos, el panel se comía el lienzo (6/11/2026, Recorrido visual, nube, `punta/recorrido-visual`)

- **Síntoma** (Leila 5/11 y recorrido 1.4): con la barra lateral fijada (240 px) y la tarjeta de MaKo (348), a 1280 px el
  lienzo tenía **257 px**: la página y su encabezado (pide 372) se cortaban, y «Animar» y la barra de abajo se pisaban.
- **El diagnóstico obvio era el equivocado:** `122071b5c` arregló el encabezado de la página (PageSlot) en una RÉPLICA, y en la
  réplica entraba. En el editor de verdad lo que no deja lugar es el panel de herramientas (350 + márgenes), que EMPUJA el
  lienzo. Una réplica que no monta el panel no puede ver esto.
- **El arreglo:** el cuerpo del editor (`.body`) es un contenedor (`container-type: inline-size`) y, por debajo de 820 px de
  editor, el panel va `position: absolute` encima del lienzo, al lado del riel, como Canva con la ventana chica. A 1280 el lienzo
  pasa a 619 px; a 1440 (852 de editor) no cambia nada.
- **Tres trampas medidas en el banco:**
  - una media query mide la VENTANA, que no sabe cuánto se comen la barra y el chat: va `@container`;
  - el contenedor va SIN nombre: con `container-name` la consulta del otro módulo CSS no aplicaba;
  - sin `z-index: calc(var(--cv-z-sticky) + 1)`, la barra flotante del objeto le tapa al panel el «‹» que lo cierra.
- **El banco:** `EditorApp` de verdad con `memoryAdapter`, un carrusel 1080×1350 de tres páginas, una barra falsa de 240 y una
  tarjeta falsa de 348 (docs/relevo/nube-recorrido-visual.md). Antes y después en docs/recorrido-visual/imagen-barra-chat-*.png.

**Vive en:** app/image-editor/_doory/editor/EditorApp.module.css, app/image-editor/_doory/editor/chrome/ToolHost.module.css, tests/recorrido-imagen-panel.test.ts

---

## Lo que el cliente ve cuando el chat del editor NO puede aplicar algo (6/11/2026, `punta/imagen-chat-fallas`)

Tres encargos del barrido del 6/11 que son el mismo tema: el camino de la falla del chat de MaKo en el editor. Los tres se
veían bien leyendo el código y los tres se leen mal desde la pantalla.

### 1. Una subida trabada no es un error: es un «corriendo» para siempre

**Síntoma.** El cliente adjunta una foto al chat con la red trabada, ve el spinner, y nunca se le dice que falló: tiene que
cerrar y empezar de nuevo.

**La causa.** `subirConProgreso` (`app/customer-success/curso/subir-video.ts`) —que el adaptador del editor usa para subir a
«Subidos», vía `subirArchivo` de `mako/nube.ts`— **no fijaba `xhr.timeout`**. Un XHR sin plazo con el socket abierto y sin
bytes moviéndose no falla: espera a que el navegador se rinda, y eso puede no pasar.

**Lo que NO se hizo, y es la parte interesante.** La salida obvia es `xhr.timeout`, y está mal: `xhr.timeout` es el TOTAL de
la petición, así que el mismo número mataría un video de 300 MB del portal de cursos que va perfecto por una línea lenta —
esa función la comparten los dos. Lo que se mide es el **ATASCO**: un reloj de 1 s que compara contra el último evento de
progreso, reiniciado por cada `upload.onprogress` **y por `upload.onload`** (después de que salen los bytes no llegan más
eventos de progreso, y ahí el mismo reloj pasa a medir cuánto tarda el bucket en contestar, que también puede no llegar
nunca). `trabadaMs` ausente o 0 = como antes, sin plazo: **lo elige quien llama**, porque un video de una clase y una foto de
2 MB no se esperan lo mismo. El editor pasa 45 s.

**La regla:** *un plazo para una transferencia se pone sobre el PROGRESO, no sobre la duración.* Un tope de duración castiga
al lento y al trabado por igual, así que se termina eligiendo entre cortar subidas buenas o no cortar ninguna.

Y la otra mitad: un `abort` nuestro por atasco y un `abort` de la persona son **el mismo evento del XHR**. El mensaje los
separa («se quedó trabada / revisa tu conexión» vs «Subida cancelada»), porque para quien lo lee son dos cosas distintas.

### 2. El motivo de un descarte lo LEE la persona, y nombraba campos del JSON

**Síntoma.** El panel dibuja `No se aplica: <motivo> · <motivo>` tal cual. Decía cosas como `«estilo» no es algo de
cambiar_texto`, `un texto nuevo con una ref inválida`, `un color que no es #RRGGBB`, `un «cubrir» que no es true o false`.

**La causa no es descuido: es que el campo tenía DOS lectores y uno sólo.** El comentario de `validarOperacion`
(`lib/image-editor/chat/catalogo.ts`) ya decía «el motivo es corto: lo ve la persona», y aun así 27 de los 51 motivos
nombraban una clave del JSON, el id de una operación o un formato interno — porque son también lo único que había para
entender por qué la IA propuso algo inválido. Un campo que sirve para la pantalla **y** para depurar termina escrito para
el que depura: es el que lo lee todos los días.

**El arreglo son dos cosas, no una.** Los 27 motivos reescritos en castellano de pantalla, y lo técnico mandado a
`console.warn` **con la operación entera** — que además es más útil que la frase que se perdió. Los nombres de los campos
del estilo salen de un mapa (`NOMBRE_ESTILO`), para que agregar uno nuevo obligue a elegirle un nombre en vez de filtrar
el interno.

**Y la red es un test, no la regla escrita.** `tests/image-editor-chat.test.ts` manda ~60 operaciones malformadas, una por
familia de rechazo, y falla si algún motivo contiene un id de operación, una clave del JSON (`ref`, `pagina`, `cubrir`,
`nueva`…) o un formato interno (`#RRGGBB`, `true`, `null`, `n1`, `la vista`, `inválid`) — y también si pasa de 90
caracteres o arranca en mayúscula, que son las otras dos formas de romper la línea donde se concatena.

### 3. Dos pedidos seguidos dejaban dos «Aceptar» vivos, y aceptar los dos duplicaba las páginas

**Síntoma.** El cliente pide un cambio, no lo acepta, pide otro, y acepta los dos: el diseño queda con las páginas
repetidas y las tiene que borrar a mano sin entender qué pasó.

**La causa.** `pedirEdicion` sumaba el mensaje nuevo y **no tocaba la propuesta anterior**, que seguía `pendiente` con su
botón. Las dos propuestas son tandas de operaciones completas sobre el mismo diseño: aplicar las dos aplica las dos.

**La regla:** *pedir de nuevo ES descartar lo anterior.* El pedido nuevo se escribió MIRANDO lo que la propuesta vieja no
resolvió, y su `refs` apunta a una vista del documento que ya no es la de ahora. Se cierran sólo las `pendiente`: una
`aplicando` está a mitad de camino y la cierra su propio `aceptarPropuesta`.

⚠️ **Y el detalle del texto:** se marca igual que el botón «Descartar» (estado + `aviso` limpio), **no** con un `aviso`
propio. El `aviso` se dibuja con `role="alert"` y un «reportar a soporte» al lado (`PanelMakoIA.tsx`): usarlo para un
reemplazo normal convierte en falla algo que no lo es. La tarjeta se apaga a «Descartado» justo arriba del pedido nuevo, y
en ese contexto se lee solo.
## Borrar la co-edición no era lo más barato: el borrado llega al MOTOR (6/11/2026, claude1, `punta/collab-fuera`)

**Vive en:** `app/image-editor/_doory/editor/engine/editor.ts` y `engine/persistence.ts` · `engine/pageCanvas.ts` ·
`types/adapter.ts` · `features/editor/adapters/{accountAdapter,sharedAdapter}.ts`

El encargo 146 del barrido del 6/11 lo describía como «la forma más barata y rápida de reducir el código con licencia
ajena»: 18 archivos y 4.396 líneas de `editor/collab/`, con 20 archivos de afuera que la referencian. Medido al hacerlo:
**41 archivos y 5.470 líneas**, y lo que lo encarece no es el tamaño.

- ⚠️ **Diagnóstico obvio equivocado: «`collab/` es una hoja del árbol, se poda y listo».** No es una hoja: el motor tiene
  una COSTURA hecha para ella. `engine/editor.ts` traía `LiveSession` y `LocalChange` (dos interfaces), el campo
  `private live`, `attachLive`, `liveSession`, `setLiveReadOnly`, `liveReadOnly`, `setRemoteEditLocks`,
  `editBlockedHandler`, `refreshHistoryStatus`, `applyRemoteDocument`, y una rama `if (this.live)` en los DOS `push` al
  historial, en `loadDocument`, en `canResetDesign`, en `updateHistoryStatus`, en `sealHistory` y en `undo` / `redo`.
  O sea: borrar la co-edición es operar el historial de deshacer, que es lo último que la tabla de «Reemplazar `_doory/`
  de a poco» (29/10, acá arriba) dejó para el final a propósito — «el corazón: lo más grande y lo menos tocado». Barato
  en líneas que se van; caro en dónde hay que cortar.
- ⚠️ **Y la lista de archivos a desenchufar NO sale de un `grep collab`.** De los 20 que nombraba el encargo, **nueve
  sólo lo dicen en un comentario** (`animation/playback.ts`, `audio/runtime.ts`, `dialogs/Presenter.tsx`,
  `engine/pageCanvas.ts`, `panels/{AnimatePanel,AudioTracks,NotesBar}.tsx`, `presenter/{pageProps,timing}.ts`) y **uno
  era un falso positivo**: `mako/elementos-lista.ts` tiene un ícono que se llama `'collaboration'`. Y le faltaban
  **cinco que sí importan**, porque en el código se llaman por la presencia y no por la co-edición:
  `workspace/usePresenceTracking.ts`, `features/editor/adapters/realtime.ts` (huérfano: nadie lo importaba),
  `workspace/Workspace.tsx` (monta `FollowBadge` y llama `usePresenceTracking`) y `workspace/PageSlot.tsx` (monta
  `PresenceLayer`), más los tres `.module.css` de esos componentes. La lista sale de **quién IMPORTA la carpeta, y
  después quién importa a ésos**, nunca de la palabra.
- **Lo que se borró entero:** `editor/collab/` (19 archivos, 4.436 líneas — no 18 / 4.396: la tabla del 29/10 quedó
  corta en un archivo), la UI que existía sólo para la presencia (`chrome/FollowBadge.tsx`, `chrome/PresenceStack.tsx`,
  `workspace/PresenceLayer.tsx`, `workspace/usePresenceTracking.ts` y sus `.module.css`) y
  `features/editor/adapters/realtime.ts`. Con `setRemoteEditLocks` fuera, los candados de texto de `pageCanvas.ts`
  (`editLocks`, `setEditLocks`, `onEditBlocked` del host) se quedaban sin quién los llene: se fueron también, y
  `configure` deja el `editable = true` explícito en vez de depender del default de fabric.
- **Un mensaje de pantalla vivía adentro de los textos de la co-edición** (`t.collab.titleNotSaved`, «No se pudo guardar
  el título nuevo.»), y lo usaba `engine/persistence.ts`. No hubo que mudarlo porque murió con el camino que lo mostraba
  (`saveLiveTitle`, que sólo corre con una sala viva), pero es el modo en que un texto desaparece sin que nada avise:
  antes de borrar una carpeta de `strings`, se mira quién la lee desde AFUERA.
- **Y el `realtime` del adaptador era un enchufe de MaKo también.** `types/adapter.ts` declaraba
  `realtime?: RealtimeConnection | null` y la interfaz entera (24 líneas); `mako/adaptadorNube.ts` nunca lo seteó
  (decisión 6), así que el camino estaba muerto desde el port. Los dos adaptadores propios de Doory
  (`accountAdapter`, `sharedAdapter`) sí lo armaban, y no los alcanza ninguna pantalla de MaKo: sólo se re-exportan
  desde `features/editor/adapters/index.ts`, que nadie importa. Lo que MaKo usa de esa carpeta son `errors`, `images` y
  `migrateLocalDesign`.
- **Lo que se queda y no es nuestro:** `features.realtime` y `limits.realtime_max_participants` de
  `types/api.ts` describen el JSON del servidor Django de Doory, no código que corra acá.
- **Trampa del entorno, otra vez el CRLF:** los archivos del port están en CRLF (`core.autocrlf=true`), así que un
  `perl -0pe 's/…\n…/…/'` de varias líneas **no calza y no falla**: deja el archivo igual y sigue. Va `\r?\n` en todo
  patrón multilínea, o se edita por coincidencia exacta. Es la misma regla que AGENTS.md ya tiene para las guardas y los
  tests que leen fuente — vale también para EDITAR.
- Regla: la co-edición no vuelve por la puerta de atrás. Si algún día se quiere, se diseña desde lo que hace (como
  cualquier parte que se reemplaza), no reponiendo `LiveSession` en el motor.

- **Lo que el typecheck NO ve, y acá casi muerde: `tests/image-editor-dependencias.test.ts` tiene un umbral de CONTEO**
  (`vistos.length > 300`, puesto para que el barrido no quede mirando una carpeta vacía). Un borrado grande lo voltea sin
  tocar un tipo: hoy quedan 459 archivos `.ts/.tsx` y pasa, pero se cuenta ANTES de borrar en masa. Y ese guard es de UNA
  sola dirección —todo lo importado tiene que estar declarado, no al revés—, así que **ningún test caza un paquete
  declarado que ya nadie importa**: el `yjs` huérfano de acá abajo no lo encuentra nada automático.
- **Once comentarios quedaron hablando de «collaborators»**: `animation/playback.ts`, `audio/runtime.ts`,
  `presenter/{pageProps,timing}.ts`, `panels/{AnimatePanel,AudioTracks,NotesBar}.tsx`, `dialogs/Presenter.tsx`,
  `engine/pageCanvas.ts` y `workspace/{TimelineTracks,TimelineAudio}.tsx` — los dos últimos no estaban ni en la lista del
  encargo, que decía veinte. No se borraron a propósito: explican POR QUÉ el modelo de datos es como es (una propiedad
  por entrada, nada en `undefined`), y esa forma quedó aunque la capa que la pedía no esté. Quien los lea tiene que saber
  que la co-edición ya no existe.

**Lo que quedó SIN hacer:** `yjs` (^13.6.27), `y-protocols` (^1.0.7) y `lib0` (^0.2.114) quedaron **huérfanos en
`package.json`** (líneas 62, 95 y 96): ya no los importa nadie. No se sacaron en este commit a propósito —
`package.json` sin el lock rompe el `npm ci` de Vercel, y regenerar el lock desde un worktree es justo la trampa de la
decisión 8 (el `node_modules` compartido tiene paquetes puestos a mano). Se saca con `npm install --package-lock-only`
en el CLON, mirando antes `npm ls --depth=0 | grep extraneous`, y en un commit propio que se pueda revertir solo.

**Lo que quedó SIN MIRAR, y DÓNDE se prueba (8/11/2026):** que el editor abre, guarda y deshace igual **no se vio en
pantalla**, y no por no intentarlo: `next dev` desde el worktree murió dos veces y la segunda la mató el vigía de RAM
con 621 MB libres (el detalle, y la receta que sí funciona, en `docs/hallazgos-infra.md` → «Mirar una pantalla de esta
app en un worktree»). Producción todavía no sirve para mirarlo: despliega UNA vez por día a las 11:05 UTC
(`lib/desplegar-main.ts`), y a la hora del merge estaba sirviendo un build de tres horas antes. **Se prueba en
producción, en el workspace de prueba (ws3), después del despliegue diario.** Y lo que hay que ejercitar no es sólo
abrir y guardar: el borrado tocó el HISTORIAL del motor, así que se prueba **deshacer y rehacer** sobre un diseño nuevo
— ahí vivía la rama `if (this.live)` de los dos push, de `sealHistory` y de `undo`/`redo`. Precedente del 17/10: cuando
la máquina no da, el recorrido se pasa a producción y se anota acá dónde.

**Y el verde de los tests NO cubre eso, aunque lo parezca (8/11/2026):** los cuatro tests del editor de imagen dan
69/69 en local, y el único que nombra `undo` —`tests/image-editor-chat.test.ts`— le **inyecta un motor falso**
(`undo: async () => { log.push('deshacer') }`): mide que el paso del chat llame a deshacer UNA vez, no que la
historia del motor ande. El `this.history` que quedó después de sacar la costura no lo prueba nada automático. Por eso
el recorrido en pantalla no es un trámite.
