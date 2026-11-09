# Lo que NO se puede hacer dentro de MaKo — el registro

**Qué es esto.** Martín (8/11/2026): *«quiero que vayas anotando todo este feedback para luego
implementarlo en la aplicación. Todo lo que no se puede hacer dentro de MaKo deberías ir
anotándolo para luego corregirlo dentro de la app»*.

**La regla:** cada vez que usando MaKo hay que salirse de MaKo —abrir una terminal, tocar la base,
pedirle algo a Martín, o simplemente darse por vencido— **eso se anota acá en el momento**, con lo
que se intentó y qué lo frenó. No es un changelog ni una lista de bugs: es la lista de **huecos del
producto**, vistos usándolo.

Una entrada por hueco. Si se arregla, se marca ✅ con su commit y se deja: saber que estuvo roto
explica decisiones posteriores.

---

## 🔴 AI Avatar: no se puede crear ni guardar un preset propio

**Qué quería hacer.** Replicar el formato de un reel concreto (el de Josep Casas, «planto
pistachos»): tomas caminando en un lugar real alternadas con planos heroicos a contraluz y el
nombre en tipografía gigante. Ninguno de los presets del catálogo es eso.

**Qué lo frena.** El catálogo vive **cableado en `lib/ai-avatar/plantillas.ts`** (una copia de la
galería de Higgsfield). Y **AI Avatar NO está en `lib/creaciones-enchufes.ts`**, así que no tiene
`usePlantillasPropias(tipo)` ni el `<ModalGuardarPlantilla>` del menú «⋯» — los que Copywriter e
Image sí tienen. O sea: **la pieza ya existe en la casa y a esta tab no se le enchufó.**

**Qué hace falta.** Sumar AI Avatar como un enchufe más en `creaciones-enchufes.ts` con su
`paraPublico`, el modal de guardar en el «⋯» y `usePlantillasPropias` en el selector de presets.
Entonces una escena nueva se guarda y se reusa, en vez de tener que tocar código.

---

## ✅ AI Avatar: la foto no se subía nunca — un ÍCONO rompía la búsqueda del botón

**Arreglado** (`extension/flow-interfaz.js`). El síntoma era «MaKo está subiendo tu foto a Google,
vuelve a intentar» para siempre; en `flow_trabajos` quedaban los intentos con
**«Flow no mostró la opción de subir»**.

La causa, medida contra el DOM real: los items del menú de medios de Flow son
`<mat-icon class="google-symbols">upload</mat-icon>` + `<span>Upload</span>`, así que `textContent`
devuelve **«uploadUpload»** — y la extensión compara EXACTO. Pasaba con los cuatro:
«folderNew collection», «account_circleCreate character», «play_moviesNew scene».

⚠️ **La regla: cuando un rótulo no aparece, imprimir lo que la página devuelve de verdad.** El
nombre estaba ahí, con basura pegada. Y se excluyen los NODOS de ícono, no se recorta el texto con
una regex: lo tentador era sacar «la minúscula inicial pegada a una mayúscula», pero eso convierte
«iPhone» en «Phone».

---

## 🟠 AI Avatar: «MaKo está subiendo tu foto a Google. Vuelve a intentar»

Al generar la primera imagen, la pantalla pide **reintentar a mano** mientras sube la foto al Flow
del cliente. Es una espera que la app conoce: debería encolar el pedido y avisar cuando está, no
devolverle el trabajo al cliente. Un «vuelve a intentar» es un pedido perdido si nadie vuelve.

---

## 🟠 El checklist del puente dice el motivo equivocado

Con Flow **abierto y con sesión**, el paso 3 seguía diciendo «Abre Google Flow con tu cuenta, desde
el ícono de MaKo». La causa real era otra: **la extensión instalada era vieja** (0.74.4) y no
reconocía `flow.google.com`, así que caía al camino REST de `labs.google` y pedía un token que esa
página nunca da. El dato estaba en la base (`flow_puentes.version`) y la pantalla no lo usaba.

**Qué hace falta.** Que el checklist compare la versión que reporta el puente contra la mínima que
el server necesita, y diga «tu extensión está desactualizada» en vez de mandar a abrir algo que ya
está abierto. Un cartel que pide lo que ya se hizo es peor que ninguno.

---

## 🟠 La extensión cargada descomprimida pierde el emparejamiento, y MaKo no lo dice

Cargar la extensión desde una carpeta le da **otro id de Chrome** y almacenamiento vacío: se pierde
el token del paso 2. MaKo lo vive como «no hay extensión» y repite «instala la extensión», cuando
en realidad hay una instalada y lo que falta es volver a conectarla.

**Qué hace falta.** Detectar «hay extensión pero no está emparejada» y ofrecer «Conectar» en vez
del cartel de instalar.

---

## 🔴 Un competidor se puede dar de alta sin ningún canal, y queda muerto

Se pueden crear competidores con **sólo el nombre** —sin Instagram, YouTube, TikTok ni web—. Para
la biblioteca de anuncios el nombre alcanza, pero para contenido no hay de dónde leer, y la ficha
se abre **vacía y sin decir por qué**: se lee como «se rompió». Pasó con 17 en el ws 9.

**Qué hace falta.** O exigir un canal en el alta, o que la ficha vacía diga qué le falta a ese
competidor para poder leerse.

## El reel de Instagram: todo el trabajo terminó fuera de MaKo (8/11/2026)

Martín pidió replicar un reel con la metodología Avatar Hype (foto → imagen → video). **Ni una sola
imagen se pudo generar desde MaKo.** Lo que frenó, en orden:

1. **El puente de Flow se cuelga en `tomado` y nadie lo marca fallido.** El trabajo #688
   (`subir_imagen`, ws9) quedó `tomado` con `intentos = 0` y nunca volvió. La pantalla repite «MaKo
   está subiendo tu foto a Google. En unos segundos vuelve a intentar» **para siempre**, porque el
   mensaje sale del trabajo pendiente y no hay plazo que lo pase a `fallido`. Un trabajo sin plazo
   no es un trabajo lento: es un cartel que miente. Falta un vencimiento en `flow_trabajos`.
2. **El arreglo de la extensión no subió la versión.** El commit `93e3f29b6` arregló el matcher de
   íconos de Material, pero `extension/manifest.json` siguió en **0.77.0**, igual que el que está
   cargado en Chrome. Con eso **no hay forma de saber si el navegador corre el build con el
   arreglo** — ni mirando la extensión, ni desde el aviso de «tu extensión quedó vieja», ni desde
   `flow_puentes.version`, que informa 0.77.0 en los dos casos. Todo cambio de `extension/` tiene
   que subir la versión; es la misma lección del zip con nombre fijo, un paso antes.
3. **MaKo manda a subir la foto por el menú «Upload» de Flow, que abre el selector nativo.** Medido
   el 8/11: **pegar la imagen en la caja de prompt de Flow funciona** (`ctrl+V` con la foto en el
   portapapeles) y deja la foto como ingrediente, sin selector de archivos y sin menú. El puente
   debería pegar en vez de pelearse con el menú.
4. **«Tu cara» guarda una sola foto y no hay galería.** Para elegir una buena referencia hubo que
   abrir el álbum de Google Photos de Martín por fuera ([[fotos-de-martin-album]]) y subirla a mano.
5. **«Diseñar un personaje» está en la pantalla y dice «No disponible todavía».** Una opción muerta
   a la vista es peor que no tenerla.
6. **No hay formato ni escena fuera del catálogo** (ya anotado arriba): el reel pedía cuatro
   escenarios que no son ninguno de los presets, y el 9:16 hubo que ponerlo en Flow.

**Lo que sí quedó medido y sirve:** en Flow las imágenes dicen **«Generating will use 0 credits»** —
son gratis de verdad, y el ajuste de formato (16:9 / 4:3 / 1:1 / 3:4 / 9:16) vive en el panel del
botón de modelo, no en el prompt: pedirle «vertical 9:16» al texto **no alcanza**, sale horizontal.
