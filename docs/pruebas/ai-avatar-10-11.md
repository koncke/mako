# AI Avatar: prueba de punta a punta en producción (10/11/2026)

Pedido de Martín, 10/11/2026: *«vi que todavía AI Avatar no se combinó con video, entonces también deberíamos hacer en el
mientras tanto… que funcione todo a la perfección, que lo pruebe también»*. La unión con Video la hace el chat de la nube
«Tab Video». Esto es la tab tal como está hoy.

**Dónde y cómo:** hola-mako.com, con el navegador de la app (sesión de super admin), entrando al negocio de prueba (ws 3,
«Cliente de Prueba») y a su propio negocio (ws 9). Escritorio a 1440 × 900 y teléfono a 375 × 812, en claro y en oscuro. Se
escribió sólo en el ws 3. Las capturas están en [`ai-avatar-10-11/`](ai-avatar-10-11/).

## En números

- **35 casos probados.**
- **12 fallas encontradas.** La línea pegada aparece en dos casos (5 y 23, computadora y teléfono) y cuenta como una; lo
  revés, los casos 31 y 33 son dos fallas: la imagen se abría en vez de bajarse, y los videos no tenían «Descargar».
- **9 arregladas**, en la rama `punta/ai-avatar-pruebas`. Cada arreglo tiene su test, y cada test se probó rompiendo el
  arreglo.
- **3 sin arreglar:**
  - la subida de la foto a Flow;
  - el techo de créditos del video;
  - la caja del chat, que es compartida.
- **Lo que no se pudo probar:** generar el avatar y el video. Ningún negocio generó nunca un avatar, y no hay ningún
  navegador con la sesión de Martín y la extensión a la vez (ver «Lo que bloquea» más abajo).

## Lo que bloquea generar (lo más importante)

1. **El motor no sube tu foto a Flow desde el 8/11.**
   - Medido en la base: las 5 subidas de foto del 8 y 9/11 (ws 9) fallaron, 5 de 5.
   - Los motivos:
     - «Flow no mostró la opción de subir», tres veces;
     - «La pestaña de Flow se cerró antes de empezar»;
     - «Flow no terminó de procesar la foto».
   - Sin la foto en Flow no hay cara, y sin cara no sale ningún avatar.
   - La última generación que terminó bien, de cualquier tipo, fue el **8/09**.
   - Vive en la extensión: `extension/flow-interfaz.js`, que busca los botones de la pantalla de Flow.
   - Para arreglarlo hay que mirar Flow abierto con una cuenta. Ver «Lo que falta».
2. **El techo de créditos del video es más bajo que lo que cobra Flow hoy.**
   - El motor no aprieta «Generar» si Flow cotiza más de **15 créditos por toma** (`TOPE_CREDITOS.video`, en
     `lib/flow-interfaz.ts`).
   - Ese 15 salió de una medición del 19/09 (Omni a 720p: 7, 10, 12 o 15 créditos por 4, 6, 8 o 10 s).
   - El 9/11 se midió en Flow un clip de **8 s a 720p con Omni 1.2 Flash: 24 créditos**
     (`docs/hallazgos-ai-avatar.md`).
   - Si ese precio sigue, cada toma de 8 s se frena con «Flow pide 24 créditos y el tope es 15», y la pantalla promete
     «hasta 15 por toma».
   - **No se cambió:** subir el techo es gastar más créditos del cliente por toma. Primero hay que leer la cotización de Flow
     para 4, 6, 8 y 10 s (leerla no gasta nada).
3. **El negocio de prueba (ws 3) nunca conectó la extensión.** No tiene fila en el registro de la extensión.
   - Los dos Chrome conectados a Claude en esta PC tienen abierta la sesión de MaKo de **Leandro (ws 10)**, no la de
     Martín, y ahí no se escribe.
   - El navegador de la app sí tiene la sesión de Martín, pero no tiene la extensión.

## Caso por caso

Leyenda: ✅ pasa · ❌ falla · 🔧 fallaba y quedó arreglado (en la rama, sale con el próximo despliegue) · ⛔ no se pudo
probar.

### Escritorio, negocio de prueba (ws 3), modo claro

| # | Caso | Resultado | Captura |
|---|---|---|---|
| 1 | Abrir AI Avatar: 33 presets, el abanico de ejemplos, la barra y «Antes de generar» plegado | ✅ | [01](ai-avatar-10-11/01-inicio.jpg) |
| 2 | Elegir un preset en la grilla: la baldosa dice «Elegido» y la barra muestra «Cambiar» | ✅ | [02](ai-avatar-10-11/02-preset-elegido.jpg) |
| 3 | Menú «Modelo» | ✅ | |
| 4 | Menús «Formato» y «Cantidad»: se abrían pegados a la izquierda de la barra, lejos de la pastilla tocada. Higgsfield los abre arriba de la pastilla | 🔧 | [03](ai-avatar-10-11/03-menu-formato-lejos.jpg) |
| 5 | Tocar «HD» u otra pieza sin motor: «2K y 4K: no disponible todavía» quedaba **para siempre** y tapaba lo que falta para generar. El botón seguía apagado sin decir por qué. Ahora se va solo a los 6 s | 🔧 | [04](ai-avatar-10-11/04-linea-pegada.jpg) |
| 6 | «Personaje» sin fotos: «Tu cara», el «+» para subir y «Diseñar un personaje» | ✅ | [05](ai-avatar-10-11/05-personaje.jpg) |
| 7 | «Antes de generar» desplegado: el paso 1 empezaba en minúscula («instala la extensión…») | 🔧 | [06](ai-avatar-10-11/06-antes-de-generar-minuscula.jpg) |
| 8 | La lista de proyectos (la «←») vacía: «Todavía no hay ninguno.» | ✅ | |
| 9 | «Nuevo avatar»: las 10 plantillas de venta con su duración y sus secciones | ✅ | [07](ai-avatar-10-11/07-nuevo-avatar.jpg) |
| 10 | «Ver ejemplo» de una plantilla de venta: **no abría nada**. El modal existía, pero escondido detrás de «Nuevo avatar» (ancho 0) | 🔧 | |
| 11 | Usar una plantilla de venta: cierra «Nuevo avatar» y pone su preset y su escena en la barra | ✅ | [08](ai-avatar-10-11/08-plantilla-con-blusa.jpg) |
| 12 | La escena de dos plantillas ponía **«Con blusa…»** en la barra de quien la usa, y un hombre salía con blusa. Ahora dicen «camisa» | 🔧 | [08](ai-avatar-10-11/08-plantilla-con-blusa.jpg) |
| 13 | «Buscar presets» sin resultados: «Ningún preset con «zzz».» | ✅ | [09](ai-avatar-10-11/09-busqueda-vacia.jpg) |
| 14 | «Buscar presets» con «playa»: sale «Atardecer en la playa» | ✅ | |
| 15 | Filtro «Producto»: los 2 presets de producto | ✅ | |
| 16 | El selector de presets («Cambiar»): **las baldosas se dibujaban una encima de otra**. Las filas medían 65 px y las baldosas 255 | 🔧 | [10](ai-avatar-10-11/10-selector-encimado.jpg) → [11](ai-avatar-10-11/11-selector-arreglado.jpg) |
| 17 | En el selector, filtrar por «Negocio» y usar un preset: se cierra y queda puesto | ✅ | |
| 18 | En el selector, Escape lo cierra | ✅ | |

### Modo oscuro y teléfono

| # | Caso | Resultado | Captura |
|---|---|---|---|
| 19 | Modo oscuro: la grilla, la barra y «Antes de generar». Se midió el contraste: ningún texto queda debajo de 3:1 | ✅ | [12](ai-avatar-10-11/12-oscuro.jpg) |
| 20 | Modo oscuro, el selector de presets | ✅ | [13](ai-avatar-10-11/13-oscuro-selector.jpg) |
| 21 | Teléfono (375): «Nueva», los presets y la barra de abajo | ✅ | [14](ai-avatar-10-11/14-telefono.jpg) |
| 22 | Teléfono, la línea de lo que falta decía «Antes de generar: En tu computadora: instala…», con dos «:» seguidos | 🔧 | [15](ai-avatar-10-11/15-telefono-dos-puntos.jpg) |
| 23 | Teléfono, «Nano Banana», «9:16» y «1/4»: dicen que no están disponibles. La línea también quedaba pegada | 🔧 | |
| 24 | Teléfono, la hoja «Tu cara» | ✅ | [16](ai-avatar-10-11/16-telefono-tu-cara.jpg) |
| 25 | Teléfono en modo oscuro | ✅ | [17](ai-avatar-10-11/17-telefono-oscuro.jpg) |

### Las funciones

| # | Caso | Resultado |
|---|---|---|
| 26 | Subir una foto con el «+». El navegador de la app no abre el selector de archivos. Por código, es la misma subida que la cara de marca del onboarding | ⛔ |
| 27 | Crear el personaje desde una foto (generar el avatar). Bloqueado: ver «Lo que bloquea», puntos 1 y 3 | ⛔ ❌ |
| 28 | El video con Google Flow (Omni). Bloqueado: no hay avatar que animar, y el techo de créditos (punto 2) lo frenaría | ⛔ ❌ |
| 29 | La voz (ElevenLabs, de voz a voz con el clon). **No existe en la tab**: «Tu voz · Pronto» dice «no disponible todavía». El reemplazo de voz vive sólo en scripts | ❌ (falta) |
| 30 | La biblioteca (la lista de proyectos y «Ver todos en grilla»). Vacía: «Ver todos» no aparece sin avatares | ⛔ |
| 31 | «Descargar» en calidad original. Era un link que **abría** la imagen en otra pestaña en vez de bajarla, porque el archivo está en otro dominio. Y los videos no tenían «Descargar». Ahora se baja el archivo de Flow tal cual, en su calidad original, con nombre («Avatar - Charla en el auto.jpg»), y cada video tiene «Descargar» | 🔧 (sin un avatar real para bajar) |

### Personas

| # | Caso | Resultado | Captura |
|---|---|---|---|
| 32 | Super admin en su propio negocio (ws 9): ve su foto en «Personaje» y «Te falta 1 de 4 · Abre Google Flow» | ✅ | [18](ai-avatar-10-11/18-superadmin-su-negocio.jpg) |
| 33 | Esencial contra Pro. Por código, los tres planes ven AI Avatar igual, y en /planes no se vende todavía. Pero el único camino para llevarse un video era «Editar y exportar», que abre el Video Editor, y el Video Editor es de Pro: un Esencial quedaba con el candado. Con «Descargar» en cada video (caso 31), ya se lo lleva | 🔧 |  |
| 34 | Un miembro (no administrador). Por código, la página lo manda al inicio y las acciones dicen «Todavía no tienes acceso a AI Avatar». No se miró: la app no deja ver como otro rol sin una cuenta | ⛔ |  |
| 35 | La caja del chat de la tab sin la app de escritorio: «Instala MaKo para escribir» se corta en dos líneas dentro de una caja de 40 px. Es el chat compartido de todas las tabs, no de AI Avatar | ❌ (no arreglado) | [01](ai-avatar-10-11/01-inicio.jpg) |

## Mejoras, copiando la referencia

AI Avatar copia a **Higgsfield** desde el 29/10 (`docs/hallazgos-ai-avatar.md`). El pedido decía HeyGen, pero la pantalla de
hoy es la de Higgsfield, así que cada arreglo copia a Higgsfield.

- **Hecho:**
  - Higgsfield abre cada menú arriba de su pastilla (caso 4).
  - Cada generación de su «History» se descarga con un toque (caso 31).
- **Propuestas, sin hacer:**
  - **Las tarjetas «Motion» y «Crear influencer»** se ven sólo para decir «no disponible todavía». Higgsfield no muestra
    funciones que no andan. Sacarlas es más limpio, pero es una decisión de producto.
  - **«1/4» en «Cantidad»** promete hasta 4 imágenes y genera 1. Lo mismo: la pieza de Higgsfield está, sin motor atrás.

## Lo que falta, y dónde vive

- **Arreglar la subida de la foto a Flow** (punto 1). Vive en `extension/flow-interfaz.js`. Pide un Chrome con la extensión y
  Flow abierto con la cuenta de Google de Martín, para mirar qué cambió en la pantalla de Flow. Hoy los dos Chrome conectados
  a Claude tienen la sesión de Leandro.
- **Medir la cotización de Flow** para 4, 6, 8 y 10 s con Omni a 720p, y con eso decidir el techo (punto 2). Vive en
  `lib/flow-interfaz.ts` (`TOPE_CREDITOS`) y en `lib/ai-avatar/requisitos.ts` (`CREDITOS`, el texto «hasta 15 por toma»).
  Subir el techo es plata del cliente: decide Martín, con el número medido.
- **Generar UN avatar en el ws 3, y con el sí de Martín a la imagen, UN video**. Recién con los dos puntos de arriba
  resueltos.
- **La voz clonada en el video** (caso 29). Vive en `lib/elevenlabs.ts` (`convertirVoz`, sin llamadores en `app/`).
- **Las dos «ramas»** (Flow o MaKo Tokens, 7/11) están en `lib/ai-avatar/requisitos.ts`, pero ninguna pantalla deja elegir:
  todo va por Flow.
- **La caja del chat compartido** (caso 35). Vive en `app/_chat/`: es del chat de cada tab, no de AI Avatar.
- **Después del despliegue:** mirar los 9 arreglos en producción.
